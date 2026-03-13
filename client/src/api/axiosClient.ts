import axios from "axios";

interface AxiosClientError extends Error {
  status?: number;
  data?: unknown;
}

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  withCredentials: true, // This is crucial for sending cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor to handle errors globally
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract error message from response
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      (status === 401 ? "Unauthorized (401)" : error.message) ||
      "An unexpected error occurred";

    const normalizedError: AxiosClientError = new Error(message);
    normalizedError.status = status;
    normalizedError.data = error.response?.data;

    return Promise.reject(normalizedError);
  }
);

export default axiosClient;