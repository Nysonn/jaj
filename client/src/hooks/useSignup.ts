import { useMutation } from '@tanstack/react-query';

// Types for the signup functionality
export interface SignupData {
  username: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface SignupError {
  message: string;
  errors?: {
    [key: string]: string;
  };
}

// API function to handle signup
const signupUser = async (userData: SignupData): Promise<SignupResponse> => {
  const response = await fetch('http://localhost:8080/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Custom hook for signup functionality
export const useSignup = () => {
  return useMutation<SignupResponse, Error, SignupData>({
    mutationFn: signupUser,
    onSuccess: (data) => {
      // Handle successful signup
      console.log('Signup successful:', data);
    },
    onError: (error) => {
      // Handle signup error
      console.error('Signup failed:', error.message);
    },
  });
};

// Alternative hook with additional configuration options
export const useSignupWithOptions = (options?: {
  onSuccess?: (data: SignupResponse) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation<SignupResponse, Error, SignupData>({
    mutationFn: signupUser,
    onSuccess: (data) => {
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
};