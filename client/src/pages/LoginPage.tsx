import React from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { usePost } from "../api/reactQuery";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../app/store";
import { loginStart, loginSuccess, loginFailure } from "../app/slices/authSlice";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

type LoginInputs = {
  email: string;
  password: string;
};

interface LoginResponse {
  token: string;
}

const LoginPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInputs>();

  // pulled from Redux state to show loading (optional)
  const authLoading = useSelector((state: RootState) => state.auth.loading);

  // React Query mutation for login
  const loginMutation = usePost<LoginInputs, LoginResponse>(
    "login",
    "/login",
    {
      onMutate: () => {
        dispatch(loginStart());
      },
      onSuccess: (data) => {
        dispatch(loginSuccess(data.token));
        toast.success("Login successful!");
        navigate("/chat");
      },
      onError: (err) => {
        dispatch(loginFailure(err.message));
      },
    }
  );

  const onSubmit: SubmitHandler<LoginInputs> = (data) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full space-y-6">
        <h2 className="text-2xl font-semibold text-center text-[#FA5D0F]">
          Log In to JAJ
        </h2>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 bg-gray-50 p-6 rounded-lg shadow-sm"
        >
          {/* Email */}
          <div>
            <label className="block text-gray-700">Email Address</label>
            <input
              type="email"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Invalid email format",
                },
              })}
              className={`mt-1 w-full px-3 py-2 border rounded-md focus:outline-none focus:ring ${
                errors.email
                  ? "border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:ring-[#FA5D0F]/50"
              }`}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-gray-700">Password</label>
            <input
              type="password"
              {...register("password", { required: "Password is required" })}
              className={`mt-1 w-full px-3 py-2 border rounded-md focus:outline-none focus:ring ${
                errors.password
                  ? "border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:ring-[#FA5D0F]/50"
              }`}
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || authLoading || loginMutation.isPending}
            className="w-full py-3 bg-[#FA5D0F] text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loginMutation.isPending ? "Logging in..." : "Log In"}
          </button>

          <p className="text-center text-gray-600">
            Don't have an account?{" "}
            <Link to="/signup" className="text-[#FA5D0F] hover:underline">
              Sign Up
            </Link>
          </p>

          <p className="text-center text-gray-600">
            Forgot password?{" "}
            <Link to="/password-reset" className="text-[#FA5D0F] hover:underline">
              Reset here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;