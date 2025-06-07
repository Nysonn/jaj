import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import { usePost } from "../api/reactQuery";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../app/store";
import { loginStart, loginSuccess, loginFailure } from "../app/slices/authSlice";
import { useNavigate, Link } from "react-router-dom";

type LoginInputs = {
  email: string;
  password: string;
};

interface LoginResponse {
  token: string;
}

// Custom notification component
interface NotificationProps {
  type: 'success' | 'error';
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

const CustomNotification: React.FC<NotificationProps> = ({ type, message, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const isSuccess = type === 'success';

  return (
    <div className={`fixed top-6 right-6 z-50 transform transition-all duration-500 ${
      isVisible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'
    }`}>
      <div className={`relative backdrop-blur-xl border rounded-2xl p-4 shadow-2xl max-w-sm w-full ${
        isSuccess 
          ? 'bg-gradient-to-r from-green-50/90 to-emerald-50/90 border-green-200/50 shadow-green-500/20' 
          : 'bg-gradient-to-r from-red-50/90 to-pink-50/90 border-red-200/50 shadow-red-500/20'
      }`}>
        {/* Decorative glow */}
        <div className={`absolute inset-0 rounded-2xl blur-xl opacity-30 ${
          isSuccess ? 'bg-gradient-to-r from-green-400/30 to-emerald-400/30' : 'bg-gradient-to-r from-red-400/30 to-pink-400/30'
        }`}></div>
        
        <div className="relative flex items-start space-x-3">
          {/* Icon */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isSuccess ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            {isSuccess ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
              {isSuccess ? 'Login Successful!' : 'Login Failed'}
            </p>
            <p className={`text-sm mt-1 ${isSuccess ? 'text-green-700/80' : 'text-red-700/80'}`}>
              {message}
            </p>
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-200 ${
              isSuccess 
                ? 'hover:bg-green-200/50 text-green-600 hover:text-green-700' 
                : 'hover:bg-red-200/50 text-red-600 hover:text-red-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress bar */}
        <div className={`absolute bottom-0 left-0 h-1 rounded-b-2xl ${
          isSuccess ? 'bg-green-500/30' : 'bg-red-500/30'
        } overflow-hidden`}>
          <div className={`h-full rounded-b-2xl animate-[shrink_4000ms_linear_forwards] ${
            isSuccess ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
        </div>
      </div>
    </div>
  );
};

const LoginPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
    isVisible: boolean;
  }>({
    type: 'success',
    message: '',
    isVisible: false
  });

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInputs>();

  // pulled from Redux state to show loading (optional)
  const authLoading = useSelector((state: RootState) => state.auth.loading);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({
      type,
      message,
      isVisible: true
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

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
        showNotification('success', 'Welcome back! Redirecting to your dashboard...');
        setTimeout(() => {
          navigate("/chat");
        }, 1500);
      },
      onError: (err) => {
        dispatch(loginFailure(err.message));
        showNotification('error', err.message || 'Please check your credentials and try again.');
      },
    }
  );

  const onSubmit: SubmitHandler<LoginInputs> = (data) => {
    loginMutation.mutate(data);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Custom Notification */}
      <CustomNotification
        type={notification.type}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      <div className="min-h-screen relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-orange-100">
          <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 via-transparent to-pink-500/5"></div>
        </div>
        
        {/* Floating orbs for visual depth */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-orange-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-r from-purple-400/15 to-orange-400/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-gradient-to-r from-blue-400/10 to-orange-400/10 rounded-full blur-2xl animate-pulse delay-500"></div>
        
        {/* Additional ambient lighting */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-px h-32 bg-gradient-to-b from-orange-400/30 to-transparent"></div>
        <div className="absolute bottom-0 left-1/4 w-px h-24 bg-gradient-to-t from-pink-400/20 to-transparent"></div>
        <div className="absolute bottom-0 right-1/4 w-px h-20 bg-gradient-to-t from-purple-400/20 to-transparent"></div>

        {/* Main content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <div className={`max-w-md w-full space-y-6 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Logo with glow effect */}
            <div className="relative mb-4 flex justify-center">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-pink-500/30 rounded-full blur-xl opacity-50 scale-110"></div>
              <img
                src="https://res.cloudinary.com/df3lhzzy7/image/upload/v1748836703/jaj-icon_n4pqll.png"
                alt="JAJ Logo"
                className="relative w-20 h-20 drop-shadow-lg hover:scale-110 transition-transform duration-300"
              />
            </div>

            {/* Enhanced title with gradient text */}
            <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-[#FA5D0F] via-orange-600 to-pink-600 bg-clip-text text-transparent hover:scale-105 transition-transform duration-300">
              Log In
            </h2>
            
            {/* Glassmorphic form container */}
            <div className="relative backdrop-blur-xl bg-white/70 border border-white/30 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 hover:shadow-orange-500/20 transition-all duration-500 hover:scale-[1.02]">
              {/* Decorative elements */}
              <div className="absolute -top-6 -right-6 w-12 h-12 bg-gradient-to-r from-orange-400/20 to-pink-400/20 rounded-full blur-xl"></div>
              <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-gradient-to-r from-purple-400/20 to-orange-400/20 rounded-full blur-lg"></div>
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Email */}
                <div className="space-y-2">
                  <label className="block text-gray-700 font-medium">Email Address</label>
                  <input
                    type="email"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: "Invalid email format",
                      },
                    })}
                    className={`w-full px-4 py-3 backdrop-blur-sm bg-white/50 border rounded-2xl focus:outline-none focus:ring-2 transition-all duration-300 ${
                      errors.email
                        ? "border-red-400/50 focus:ring-red-200/50 bg-red-50/30"
                        : "border-orange-200/50 focus:ring-[#FA5D0F]/30 hover:bg-white/60"
                    }`}
                    placeholder="Enter your email"
                  />
                  {errors.email && (
                    <div className="relative backdrop-blur-sm bg-red-50/80 border border-red-200/50 rounded-xl p-3 shadow-sm">
                      <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                          <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-red-700 text-sm font-medium">{errors.email.message}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="block text-gray-700 font-medium">Password</label>
                  <input
                    type="password"
                    {...register("password", { required: "Password is required" })}
                    className={`w-full px-4 py-3 backdrop-blur-sm bg-white/50 border rounded-2xl focus:outline-none focus:ring-2 transition-all duration-300 ${
                      errors.password
                        ? "border-red-400/50 focus:ring-red-200/50 bg-red-50/30"
                        : "border-orange-200/50 focus:ring-[#FA5D0F]/30 hover:bg-white/60"
                    }`}
                    placeholder="Enter your password"
                  />
                  {errors.password && (
                    <div className="relative backdrop-blur-sm bg-red-50/80 border border-red-200/50 rounded-xl p-3 shadow-sm">
                      <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                          <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-red-700 text-sm font-medium">{errors.password.message}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enhanced submit button with success state */}
                <button
                  type="submit"
                  disabled={isSubmitting || authLoading || loginMutation.isPending}
                  className={`group w-full py-4 rounded-2xl font-semibold transition-all duration-300 shadow-lg transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 ${
                    loginMutation.isSuccess 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-green-500/50' 
                      : 'bg-gradient-to-r from-[#FA5D0F] to-orange-600 text-white hover:from-orange-600 hover:to-pink-600 shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105'
                  }`}
                >
                  <span className="flex items-center justify-center space-x-2">
                    {loginMutation.isPending ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Logging in...</span>
                      </>
                    ) : loginMutation.isSuccess ? (
                      <>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Success!</span>
                      </>
                    ) : (
                      <>
                        <span>Log In</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>

                {/* Enhanced links with glassmorphic styling */}
                <div className="space-y-3 pt-4 border-t border-white/30">
                  <p className="text-center text-gray-600/80">
                    Don't have an account?{" "}
                    <Link 
                      to="/signup" 
                      className="text-[#FA5D0F] hover:text-orange-600 font-semibold hover:underline transition-all duration-300 hover:scale-105 inline-block"
                    >
                      Sign Up
                    </Link>
                  </p>

                  <p className="text-center text-gray-600/80">
                    Forgot password?{" "}
                    <Link 
                      to="/password-reset" 
                      className="text-[#FA5D0F] hover:text-orange-600 font-semibold hover:underline transition-all duration-300 hover:scale-105 inline-block"
                    >
                      Reset here
                    </Link>
                  </p>
                </div>
              </form>
            </div>
            
            {/* Floating particles */}
            <div className="absolute -top-10 left-10 w-2 h-2 bg-orange-400/40 rounded-full animate-ping"></div>
            <div className="absolute -bottom-8 right-16 w-1 h-1 bg-pink-400/60 rounded-full animate-ping delay-700"></div>
            <div className="absolute top-1/3 -right-12 w-1.5 h-1.5 bg-purple-400/50 rounded-full animate-ping delay-300"></div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  );
};

export default LoginPage;