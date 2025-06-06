import { useQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import axiosClient from "./axiosClient";
import toast from "react-hot-toast";

// Generic GET wrapper
export function useGet<T>(
  key: string | readonly unknown[],
  url: string,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">
) {
  const query = useQuery<T, Error>({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: async () => {
      const { data } = await axiosClient.get<T>(url);
      return data;
    },
    ...options,
  });

  // Handle errors with toast notifications
  if (query.error) {
    toast.error(query.error.message || "An error occurred");
  }

  return query;
}

// Generic POST/MUTATION wrapper
export function usePost<TRequest, TResponse>(
  key: string | readonly unknown[],
  url: string,
  options?: Omit<UseMutationOptions<TResponse, Error, TRequest>, "mutationFn">
) {
  return useMutation<TResponse, Error, TRequest>({
    mutationFn: async (body: TRequest) => {
      const { data } = await axiosClient.post<TResponse>(url, body);
      return data;
    },
    onError: (err: Error) => {
      toast.error(err.message || "An error occurred");
    },
    ...options,
  });
}