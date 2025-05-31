package admin

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"go.uber.org/zap"
)

// Item represents a catalog item.
type Item struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Category  string `json:"category"`
	PriceUGX  int    `json:"priceUGX"`
	Available bool   `json:"available"`
}

// ConfigEntry represents a configuration key/value.
type ConfigEntry struct {
	Key   string          `json:"key"`
	Value json.RawMessage `json:"value"`
}

// MakeAdminRouter returns an http.Handler for all admin routes under /admin/.
func MakeAdminRouter(db *sql.DB, logger *zap.Logger) http.Handler {
	mux := http.NewServeMux()

	// Catalog (items) CRUD
	mux.HandleFunc("/admin/items", func(w http.ResponseWriter, r *http.Request) {
		// Only allow admin users (RequireJWT applied upstream ensures authenticated user).
		// Further role checks can be added here by examining context.
		switch r.Method {
		case http.MethodGet:
			handleListItems(w, r, db)
		case http.MethodPost:
			handleCreateItem(w, r, db)
		case http.MethodPut:
			handleUpdateItem(w, r, db)
		case http.MethodDelete:
			handleDeleteItem(w, r, db)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Configuration CRUD
	mux.HandleFunc("/admin/config", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handleListConfig(w, r, db)
		case http.MethodPut:
			handleUpdateConfig(w, r, db)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Return the mux directly since JWT check is already applied upstream in main.go
	return mux
}

// handleListItems returns all items (with optional query by category or availability).
func handleListItems(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	ctx := r.Context()

	// Optional filters: category, available
	q := r.URL.Query().Get("category")
	availStr := r.URL.Query().Get("available")

	var filters []string
	var args []interface{}
	argIdx := 1

	if q != "" {
		filters = append(filters, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, q)
		argIdx++
	}
	if availStr != "" {
		avail, err := strconv.ParseBool(availStr)
		if err == nil {
			filters = append(filters, fmt.Sprintf("available = $%d", argIdx))
			args = append(args, avail)
			argIdx++
		}
	}
	whereClause := ""
	if len(filters) > 0 {
		whereClause = "WHERE " + filters[0]
		for i := 1; i < len(filters); i++ {
			whereClause += " AND " + filters[i]
		}
	}

	query := fmt.Sprintf("SELECT id, name, category, price_ugx, available FROM items %s ORDER BY name", whereClause)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		http.Error(w, "database query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Name, &it.Category, &it.PriceUGX, &it.Available); err != nil {
			http.Error(w, "row scan error", http.StatusInternalServerError)
			return
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "row iteration error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// handleCreateItem adds a new catalog item.
func handleCreateItem(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	ctx := r.Context()
	var it Item
	if err := json.NewDecoder(r.Body).Decode(&it); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	if it.Name == "" || it.Category == "" || it.PriceUGX <= 0 {
		http.Error(w, "name, category, and positive priceUGX are required", http.StatusBadRequest)
		return
	}
	const q = `INSERT INTO items (name, category, price_ugx, available) VALUES ($1, $2, $3, $4) RETURNING id`
	err := db.QueryRowContext(ctx, q, it.Name, it.Category, it.PriceUGX, it.Available).Scan(&it.ID)
	if err != nil {
		http.Error(w, "database insert error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(it)
}

// handleUpdateItem updates an existing catalog item by id.
func handleUpdateItem(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	ctx := r.Context()
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "id query parameter is required", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var it Item
	if err := json.NewDecoder(r.Body).Decode(&it); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	const q = `UPDATE items SET name=$1, category=$2, price_ugx=$3, available=$4 WHERE id=$5`
	res, err := db.ExecContext(ctx, q, it.Name, it.Category, it.PriceUGX, it.Available, id)
	if err != nil {
		http.Error(w, "database update error", http.StatusInternalServerError)
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "item not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleDeleteItem removes a catalog item by id.
func handleDeleteItem(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	ctx := r.Context()
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "id query parameter is required", http.StatusBadRequest)
		return
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	const q = `DELETE FROM items WHERE id=$1`
	res, err := db.ExecContext(ctx, q, id)
	if err != nil {
		http.Error(w, "database delete error", http.StatusInternalServerError)
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "item not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleListConfig returns all configuration entries.
func handleListConfig(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	ctx := r.Context()
	rows, err := db.QueryContext(ctx, `SELECT key, value_json FROM config ORDER BY key`)
	if err != nil {
		http.Error(w, "database query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var entries []ConfigEntry
	for rows.Next() {
		var ce ConfigEntry
		if err := rows.Scan(&ce.Key, &ce.Value); err != nil {
			http.Error(w, "row scan error", http.StatusInternalServerError)
			return
		}
		entries = append(entries, ce)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, "row iteration error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// handleUpdateConfig updates a configuration entry by key.
func handleUpdateConfig(w http.ResponseWriter, r *http.Request, db *sql.DB) {
	ctx := r.Context()
	var ce ConfigEntry
	if err := json.NewDecoder(r.Body).Decode(&ce); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	if ce.Key == "" {
		http.Error(w, "key is required", http.StatusBadRequest)
		return
	}
	const q = `UPDATE config SET value_json=$1 WHERE key=$2`
	res, err := db.ExecContext(ctx, q, ce.Value, ce.Key)
	if err != nil {
		http.Error(w, "database update error", http.StatusInternalServerError)
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		// Insert if not exists
		const ins = `INSERT INTO config (key, value_json) VALUES ($1, $2)`
		if _, err := db.ExecContext(ctx, ins, ce.Key, ce.Value); err != nil {
			http.Error(w, "database insert error", http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}
