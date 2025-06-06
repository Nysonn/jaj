import React from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { usePost } from "../api/reactQuery";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

type SignupInputs = {
  username: string;
  email: string;
  password: string;
};

interface SignupResponse {
  message: string;
}

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInputs>();

  // React Query mutation for signup
  const signupMutation = usePost<SignupInputs, SignupResponse>(
    "signup",
    "/signup",
    {
      onSuccess: () => {
        toast.success("Signup successful! Check your email for verification.");
        navigate("/verify");
      },
      onError: (err) => {
        toast.error(err.message || "Signup failed");
      },
    }
  );

  const onSubmit: SubmitHandler<SignupInputs> = (data) => {
    signupMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full space-y-6">
        <h2 className="text-2xl font-semibold text-center text-[#FA5D0F]">
          Create an Account
        </h2>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 bg-gray-50 p-6 rounded-lg shadow-sm"
        >
          {/* Username */}
          <div>
            <label className="block text-gray-700">Username</label>
            <input
              type="text"
              {...register("username", { required: "Username is required" })}
              className={`mt-1 w-full px-3 py-2 border rounded-md focus:outline-none focus:ring ${
                errors.username
                  ? "border-red-500 focus:ring-red-200"
                  : "border-gray-300 focus:ring-[#FA5D0F]/50"
              }`}
            />
            {errors.username && (
              <p className="text-red-500 text-sm mt-1">
                {errors.username.message}
              </p>
            )}
          </div>

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
              {...register("password", {
                required: "Password is required",
                minLength: {
                  value: 8,
                  message: "Password must be at least 8 characters",
                },
                pattern: {
                  value: /^(?=.*[0-9]).*$/,
                  message: "Password must include at least one number",
                },
              })}
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
            disabled={isSubmitting || signupMutation.isPending}
            className="w-full py-3 bg-[#FA5D0F] text-white rounded-lg font-medium disabled:opacity-50"
          >
            {signupMutation.isPending ? "Signing up..." : "Sign Up"}
          </button>

          <p className="text-center text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="text-[#FA5D0F] hover:underline">
              Log In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;