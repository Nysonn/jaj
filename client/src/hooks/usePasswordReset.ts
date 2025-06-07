import { useMutation } from "@tanstack/react-query";

interface ResetEmailRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

interface ApiResponse {
  message: string;
}

interface PasswordResetConfig {
  baseUrl?: string;
  onEmailSuccess?: () => void;
  onPasswordResetSuccess?: () => void;
  redirectUrl?: string;
  redirectDelay?: number;
}

interface UsePasswordResetReturn {
  sendResetEmail: {
    mutate: (data: ResetEmailRequest) => void;
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    error: Error | null;
  };
  resetPassword: {
    mutate: (data: ResetPasswordRequest) => void;
    isPending: boolean;
    isSuccess: boolean;
    isError: boolean;
    error: Error | null;
  };
}

const usePasswordReset = (config?: PasswordResetConfig): UsePasswordResetReturn => {
  const {
    baseUrl = "http://localhost:8080",
    onEmailSuccess,
    onPasswordResetSuccess,
    redirectUrl = "/login",
    redirectDelay = 2000,
  } = config || {};

  // Email submission mutation
  const emailMutation = useMutation({
    mutationFn: async (data: ResetEmailRequest): Promise<ApiResponse> => {
      const response = await fetch(
        `${baseUrl}/password-reset?email=${encodeURIComponent(data.email)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to send reset email");
      }

      return response.json();
    },
    onSuccess: () => {
      onEmailSuccess?.();
    },
  });

  // Password reset mutation
  const resetMutation = useMutation({
    mutationFn: async (data: ResetPasswordRequest): Promise<ApiResponse> => {
      const response = await fetch(`${baseUrl}/password-reset`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to reset password");
      }

      return response.json();
    },
    onSuccess: () => {
      onPasswordResetSuccess?.();
      
      // Redirect after successful reset
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, redirectDelay);
    },
  });

  return {
    sendResetEmail: {
      mutate: emailMutation.mutate,
      isPending: emailMutation.isPending,
      isSuccess: emailMutation.isSuccess,
      isError: emailMutation.isError,
      error: emailMutation.error,
    },
    resetPassword: {
      mutate: resetMutation.mutate,
      isPending: resetMutation.isPending,
      isSuccess: resetMutation.isSuccess,
      isError: resetMutation.isError,
      error: resetMutation.error,
    },
  };
};

export default usePasswordReset;