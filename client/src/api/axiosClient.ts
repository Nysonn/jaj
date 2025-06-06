import axios from "axios";
import type { RootState } from "../app/store";
import store from "../app/store";

const baseURL = import.meta.env.VITE_API_URL || "";

const axiosClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to inject JWT
axiosClient.interceptors.request.use((config) => {
  const state: RootState = store.getState();
  const token = state.auth.token;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
