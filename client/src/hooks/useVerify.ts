import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

interface VerifyResponse {
  message: string;
}

interface UseVerifyTokenOptions {
  onSuccess?: (data: VerifyResponse) => void;
  onError?: (error: Error) => void;
  redirectTo?: string;
  redirectDelay?: number;
}

const verifyToken = async (token: string): Promise<VerifyResponse> => {
  const response = await fetch(`http://localhost:8080/verify?token=${encodeURIComponent(token)}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Verification failed: ${response.statusText}`);
  }
  
  return response.json();
};

export const useVerifyToken = (
  token: string | null,
  options: UseVerifyTokenOptions = {}
) => {
  const navigate = useNavigate();
  const {
    onSuccess,
    onError,
    redirectTo = "/login",
    redirectDelay = 1500,
  } = options;

  // Use TanStack Query v4 to call GET /verify?token=<token>
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["verify", token],
    queryFn: () => verifyToken(token!),
    enabled: Boolean(token),
    retry: false, // Don't retry verification requests
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    staleTime: Infinity, // Keep successful verification data fresh
  });

  useEffect(() => {
    if (data && !isLoading && !isError) {
      const successMessage = data.message || "Email verified! You can now log in.";
      toast.success(successMessage);
      
      if (onSuccess) {
        onSuccess(data);
      }
      
      setTimeout(() => {
        navigate(redirectTo);
      }, redirectDelay);
    }
    
    if (isError && error) {
      const errorMessage = (error as Error).message || "Verification failed";
      toast.error(errorMessage);
      
      if (onError) {
        onError(error as Error);
      }
    }
  }, [data, isLoading, isError, error, navigate, onSuccess, onError, redirectTo, redirectDelay]);

  return {
    data,
    isLoading,
    isError,
    error,
    isVerified: Boolean(data && !isLoading && !isError),
  };
};