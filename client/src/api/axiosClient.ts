import axios from "axios";

const axiosClient = axios.create({
  baseURL: "http://localhost:8080", // Your backend URL
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
    if (error.response?.status === 401) {
      // Session expired or invalid - redirect to login
      // You might want to dispatch a logout action here
      window.location.href = '/login';
    }
    
    // Extract error message from response
    const message = error.response?.data?.message || 
                   error.response?.data?.error || 
                   error.message || 
                   'An unexpected error occurred';
    
    return Promise.reject(new Error(message));
  }
);

export default axiosClient;