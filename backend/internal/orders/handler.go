package orders

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"server/internal/auth"
	"server/internal/email"

	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
)

// CreateOrderRequest represents the payload to create a new order.
type CreateOrderRequest struct {
	Items []struct {
		ItemID   int `json:"itemId"`
		Quantity int `json:"quantity"`
	} `json:"items"`
}

// OrderItemResponse represents an item in the order response.
type OrderItemResponse struct {
	ItemID    int    `json:"itemId"`
	Name      string `json:"name"`
	Quantity  int    `json:"quantity"`
	UnitPrice int    `json:"unitPrice"`
	Subtotal  int    `json:"subtotal"`
}

// OrderResponse represents the order details sent back to the client.
type OrderResponse struct {
	OrderID       int                 `json:"orderId"`
	Status        string              `json:"status"`
	Items         []OrderItemResponse `json:"items"`
	TransportFee  int                 `json:"transportFee"`
	TotalCost     int                 `json:"totalCost"`
	CreatedAt     time.Time           `json:"createdAt"`
	PickupTime    string              `json:"pickupTime"`
	PickupStation string              `json:"pickupStation"`
}

// MakeOrdersHandler now accepts mailer but will not pass orders package types into email.
func MakeOrdersHandler(
	db *sql.DB,
	logger *zap.Logger,
	meter *prometheus.CounterVec,
	mailer *email.Client, // use only SendMail on plain strings
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			handleCreateOrder(w, r, db, logger, meter, mailer)
		case http.MethodGet:
			handleListOrders(w, r, db, logger)
		case http.MethodDelete:
			handleCancelOrder(w, r, db, logger, mailer)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}
}

// handleCreateOrder processes a new order from a student.
func handleCreateOrder(
	w http.ResponseWriter,
	r *http.Request,
	db *sql.DB,
	logger *zap.Logger,
	meter *prometheus.CounterVec,
	mailer *email.Client,
) {
	ctx := r.Context()
	uidVal := ctx.Value(auth.ContextUserIDKey)
	userID, _ := uidVal.(int)

	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if len(req.Items) == 0 {
		http.Error(w, "order must contain at least one item", http.StatusBadRequest)
		return
	}

	// 1. Compute transportFee by counting today's confirmed orders
	today := time.Now().Truncate(24 * time.Hour)
	var count int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM orders WHERE user_id=$1 AND created_at >= $2`, userID, today,
	).Scan(&count); err != nil {
		logger.Error("failed to count orders", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	transportFee := calculateTransportFee(count + 1)

	// 2. Begin transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		logger.Error("failed to begin transaction", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// 3. Insert into orders table
	status := "CONFIRMED"
	totalCost := transportFee
	var orderID int
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO orders (user_id, status, transport_fee, total_cost)
         VALUES ($1, $2, $3, $4) RETURNING id`,
		userID, status, transportFee, totalCost,
	).Scan(&orderID); err != nil {
		logger.Error("failed to insert order", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// 4. For each requested item, fetch price, insert order_items, accumulate subtotal
	var itemsResponse []OrderItemResponse
	for _, it := range req.Items {
		var (
			name      string
			unitPrice int
		)
		// Only available items
		err := tx.QueryRowContext(ctx,
			`SELECT name, price_ugx FROM items WHERE id=$1 AND available = TRUE`,
			it.ItemID,
		).Scan(&name, &unitPrice)
		if err == sql.ErrNoRows {
			http.Error(w, fmt.Sprintf("item %d not available", it.ItemID), http.StatusBadRequest)
			return
		} else if err != nil {
			logger.Error("failed to fetch item", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		subtotal := unitPrice * it.Quantity
		totalCost += subtotal

		// Insert into order_items
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO order_items (order_id, item_id, quantity, unit_price)
             VALUES ($1, $2, $3, $4)`,
			orderID, it.ItemID, it.Quantity, unitPrice,
		); err != nil {
			logger.Error("failed to insert order_item", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		itemsResponse = append(itemsResponse, OrderItemResponse{
			ItemID:    it.ItemID,
			Name:      name,
			Quantity:  it.Quantity,
			UnitPrice: unitPrice,
			Subtotal:  subtotal,
		})
	}

	// 5. Update the total_cost in orders row
	if _, err := tx.ExecContext(ctx,
		`UPDATE orders SET total_cost=$1 WHERE id=$2`, totalCost, orderID,
	); err != nil {
		logger.Error("failed to update total cost", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// 6. Commit transaction
	if err := tx.Commit(); err != nil {
		logger.Error("transaction commit failed", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// 7. Send confirmation email asynchronously (build the body here)
	go func() {
		// Lookup user email
		var userEmail string
		if err := db.QueryRowContext(ctx,
			`SELECT email FROM users WHERE id=$1`, userID,
		).Scan(&userEmail); err != nil {
			logger.Error("failed to lookup user email", zap.Error(err))
			return
		}

		// Build email subject + body
		subject := fmt.Sprintf("Your JAJ Order #%d Confirmation", orderID)
		var lines []string
		lines = append(lines, fmt.Sprintf("Thank you for your order!"))
		lines = append(lines, fmt.Sprintf("Order ID: %d", orderID))
		lines = append(lines, "")
		lines = append(lines, "Items:")
		for _, it := range itemsResponse {
			lines = append(
				lines,
				fmt.Sprintf("%s x%d @ UGX %d = UGX %d",
					it.Name, it.Quantity, it.UnitPrice, it.Subtotal,
				),
			)
		}
		lines = append(lines, "")
		lines = append(lines, fmt.Sprintf("Transport Fee: UGX %d", transportFee))
		lines = append(lines, fmt.Sprintf("Total Cost: UGX %d", totalCost))
		lines = append(lines, "")
		lines = append(lines, "Pickup at 18:00, F2 17")

		body := strings.Join(lines, "\n")
		if err := mailer.SendMail(userEmail, subject, body); err != nil {
			logger.Error("failed to send order confirmation email", zap.Error(err))
		}
	}()

	// 8. Build HTTP response
	resp := OrderResponse{
		OrderID:       orderID,
		Status:        status,
		Items:         itemsResponse,
		TransportFee:  transportFee,
		TotalCost:     totalCost,
		CreatedAt:     time.Now(),
		PickupTime:    "18:00",
		PickupStation: "F2 17",
	}

	meter.WithLabelValues("orders_created").Inc()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

// calculateTransportFee applies the tier logic.
func calculateTransportFee(orderCountToday int) int {
	switch {
	case orderCountToday <= 3:
		return 1000
	case orderCountToday <= 6:
		return 2000
	default:
		return 3000 // you can extend tiers as needed
	}
}

// handleListOrders returns orders for the authenticated user, with filtering.
func handleListOrders(w http.ResponseWriter, r *http.Request, db *sql.DB, logger *zap.Logger) {
	ctx := r.Context()
	uidVal := ctx.Value(auth.ContextUserIDKey)
	userID, _ := uidVal.(int)

	// Query params: status (optional), date (optional: YYYY-MM-DD), page, limit
	q := r.URL.Query().Get("status")
	dateStr := r.URL.Query().Get("date")
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	// Defaults
	var filters []string
	var args []interface{}
	argIdx := 1

	filters = append(filters, fmt.Sprintf("user_id = $%d", argIdx))
	args = append(args, userID)
	argIdx++

	if q != "" {
		filters = append(filters, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, q)
		argIdx++
	}
	if dateStr != "" {
		// Parse date
		date, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			next := date.Add(24 * time.Hour)
			filters = append(filters, fmt.Sprintf("created_at >= $%d AND created_at < $%d", argIdx, argIdx+1))
			args = append(args, date, next)
			argIdx += 2
		}
	}
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	// Build query
	whereClause := "WHERE " + strings.Join(filters, " AND ")
	query := fmt.Sprintf(
		`SELECT id, status, transport_fee, total_cost, created_at FROM orders %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1,
	)
	args = append(args, limit, offset)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		logger.Error("database query error", zap.Error(err))
		http.Error(w, "database query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var results []OrderResponse
	for rows.Next() {
		var o OrderResponse
		var createdAt time.Time
		if err := rows.Scan(&o.OrderID, &o.Status, &o.TransportFee, &o.TotalCost, &createdAt); err != nil {
			logger.Error("row scan error", zap.Error(err))
			http.Error(w, "row scan error", http.StatusInternalServerError)
			return
		}
		o.CreatedAt = createdAt
		o.PickupTime = "18:00"
		o.PickupStation = "F2 17"

		// Fetch items for this order
		itemRows, err := db.QueryContext(ctx,
			`SELECT oi.item_id, i.name, oi.quantity, oi.unit_price FROM order_items oi JOIN items i ON oi.item_id=i.id WHERE oi.order_id=$1`, o.OrderID)
		if err != nil {
			logger.Error("failed to fetch order items", zap.Error(err))
			http.Error(w, "failed to fetch order items", http.StatusInternalServerError)
			return
		}
		defer itemRows.Close()

		var items []OrderItemResponse
		for itemRows.Next() {
			var it OrderItemResponse
			var quantity, unitPrice int
			if err := itemRows.Scan(&it.ItemID, &it.Name, &quantity, &unitPrice); err != nil {
				logger.Error("order_item scan error", zap.Error(err))
				http.Error(w, "order_item scan error", http.StatusInternalServerError)
				return
			}
			it.Quantity = quantity
			it.UnitPrice = unitPrice
			it.Subtotal = quantity * unitPrice
			items = append(items, it)
		}
		o.Items = items
		results = append(results, o)
	}
	if err := rows.Err(); err != nil {
		logger.Error("row iteration error", zap.Error(err))
		http.Error(w, "row iteration error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// handleCancelOrder cancels an existing order if within allowed time.
func handleCancelOrder(w http.ResponseWriter, r *http.Request, db *sql.DB, logger *zap.Logger, mailer *email.Client) {
	ctx := r.Context()
	uidVal := ctx.Value(auth.ContextUserIDKey)
	userID, _ := uidVal.(int)

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "order id is required", http.StatusBadRequest)
		return
	}
	orderID, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid order id", http.StatusBadRequest)
		return
	}

	// Verify ownership and status
	var (
		ownerID   int
		status    string
		createdAt time.Time
	)
	if err := db.QueryRowContext(ctx,
		`SELECT user_id, status, created_at FROM orders WHERE id=$1`,
		orderID,
	).Scan(&ownerID, &status, &createdAt); err == sql.ErrNoRows {
		http.Error(w, "order not found", http.StatusNotFound)
		return
	} else if err != nil {
		logger.Error("database error", zap.Error(err))
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	if ownerID != userID {
		http.Error(w, "not authorized", http.StatusForbidden)
		return
	}
	if status != "PENDING" && status != "CONFIRMED" {
		http.Error(w, "order cannot be cancelled", http.StatusBadRequest)
		return
	}
	now := time.Now()
	cutoff := time.Date(now.Year(), now.Month(), now.Day(), 17, 0, 0, 0, now.Location())
	if now.After(cutoff) {
		http.Error(w, "cancellation window closed", http.StatusForbidden)
		return
	}

	// Update status to CANCELLED
	if _, err := db.ExecContext(ctx,
		`UPDATE orders SET status='CANCELLED' WHERE id=$1`, orderID,
	); err != nil {
		logger.Error("failed to cancel order", zap.Error(err))
		http.Error(w, "failed to cancel order", http.StatusInternalServerError)
		return
	}

	// Send cancellation email asynchronously
	go func() {
		// Lookup user email
		var userEmail string
		if err := db.QueryRowContext(ctx,
			`SELECT email FROM users WHERE id=$1`, userID,
		).Scan(&userEmail); err != nil {
			logger.Error("failed to lookup user email", zap.Error(err))
			return
		}

		// Build subject & body
		subject := fmt.Sprintf("Your JAJ Order #%d Cancellation", orderID)
		body := fmt.Sprintf(
			"Your order #%d has been cancelled. If you have any questions, contact support.",
			orderID,
		)
		if err := mailer.SendMail(userEmail, subject, body); err != nil {
			logger.Error("failed to send cancellation email", zap.Error(err))
		}
	}()

	w.WriteHeader(http.StatusNoContent)
}
