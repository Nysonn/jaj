import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../app/store";
import { useQuery } from "@tanstack/react-query";
import axios from "../api/axiosClient";
import toast from "react-hot-toast";
import dayjs from "dayjs";

interface OrderItem {
  itemId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  orderId: number;
  status: string;
  transportFee: number;
  totalCost: number;
  createdAt: string; // ISO date string
  pickupTime: string; // e.g. "18:00"
  pickupStation: string; // e.g. "F2 17"
  items: OrderItem[];
}

interface FetchOrdersParams {
  status?: string;
  date?: string; // "YYYY-MM-DD"
  page?: number;
  limit?: number;
}

const fetchOrders = async (
  token: string,
  params: FetchOrdersParams
): Promise<Order[]> => {
  const response = await axios.get<Order[]>("/orders", {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

const OrdersPage: React.FC = () => {
  const token = useSelector((state: RootState) => state.auth.token);

  // Local filter controls
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>(""); // YYYY-MM-DD
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  // React Query to fetch orders
  const {
    data: orders,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["orders", { status: statusFilter, date: dateFilter, page }],
    queryFn: () =>
      fetchOrders(token!, {
        status: statusFilter || undefined,
        date: dateFilter || undefined,
        page,
        limit,
      }),
    // Remove onError and handle errors with useEffect instead
  });

  // Handle errors using useEffect
  useEffect(() => {
    if (isError && error) {
      const errorMessage = (error as any)?.message || "Failed to load orders";
      toast.error(errorMessage);
    }
  }, [isError, error]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFilter(e.target.value);
    setPage(1);
  };

  return (
    <div className="max-w-screen-lg mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-[#FA5D0F]">My Orders</h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Status Filter */}
        <label className="flex items-center gap-2">
          <span className="font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            className="border rounded px-3 py-1"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FULFILLED">Fulfilled</option>
          </select>
        </label>

        {/* Date Filter */}
        <label className="flex items-center gap-2">
          <span className="font-medium">Date:</span>
          <input
            type="date"
            value={dateFilter}
            onChange={handleDateChange}
            max={dayjs().format("YYYY-MM-DD")}
            className="border rounded px-3 py-1"
          />
        </label>

        {/* Refresh Button */}
        <button
          onClick={() => refetch()}
          className="ml-auto bg-secondary hover:bg-[#e6aa2b] text-white px-4 py-2 rounded transition"
        >
          Refresh
        </button>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="text-center text-gray-500">Loading orders…</div>
      ) : isError ? (
        <div className="text-center text-red-500">Error loading orders.</div>
      ) : !Array.isArray(orders) || orders.length === 0 ? (
        <div className="text-center text-gray-600">No orders found.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: Order) => (
            <div
              key={order.orderId}
              className="border rounded-lg p-4 shadow-sm hover:shadow-md transition"
            >
              <div className="flex justify-between mb-2">
                <div>
                  <span className="font-semibold">Order ID:</span>{" "}
                  {order.orderId}
                </div>
                <div>
                  <span className="font-semibold">Status:</span>{" "}
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-800"
                        : order.status === "CONFIRMED"
                        ? "bg-blue-100 text-blue-800"
                        : order.status === "CANCELLED"
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                <span className="font-medium">Placed:</span>{" "}
                {dayjs(order.createdAt).format("YYYY-MM-DD HH:mm")}
              </div>
              <div className="mb-2">
                <span className="font-medium">Items:</span>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  {order.items.map((it: OrderItem) => (
                    <li key={it.itemId}>
                      {it.name} × {it.quantity} @ {it.unitPrice} UGX each (
                      {it.subtotal} UGX)
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t">
                <div>
                  <span className="font-medium">Transport:</span>{" "}
                  {order.transportFee} UGX
                </div>
                <div>
                  <span className="font-medium">Total:</span>{" "}
                  {order.totalCost} UGX
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex justify-center items-center gap-4 mt-6">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-1 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50 transition"
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          className="px-4 py-1 bg-gray-200 hover:bg-gray-300 rounded transition"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default OrdersPage;