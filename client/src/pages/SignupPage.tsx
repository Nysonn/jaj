import React, { useState, useEffect } from "react";
import { Eye, EyeOff, User, Mail, Lock, ArrowRight, CheckCircle, AlertCircle, X } from "lucide-react";
import { useSignup } from "../hooks/useSignup"; 

const SignupPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    show: boolean;
  }>({
    type: null,
    message: '',
    show: false
  });

  // Use the custom signup hook
  const signupMutation = useSignup();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message, show: true });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.username) {
      newErrors.username = 'Username is required';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/^(?=.*[0-9]).*$/.test(formData.password)) {
      newErrors.password = 'Password must include at least one number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    // Use the mutation with updated success/error handling
    signupMutation.mutate(formData, {
      onSuccess: (data) => {
        showNotification('success', 'Account created successfully! Redirecting to verification...');
        // Reset form on success
        setFormData({ username: '', email: '', password: '' });
        setErrors({});
        
        // Redirect to verify page after a short delay to show the success message
        setTimeout(() => {
          window.location.href = '/verify';
        }, 2000);
      },
      onError: (error) => {
        // Show error notification but stay on the signup page
        showNotification('error', error.message || 'Something went wrong. Please try again.');
        // No redirection on error - user stays on signup page
      }
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({...prev, [field]: value}));
    if (errors[field]) {
      setErrors(prev => ({...prev, [field]: ''}));
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Toast Notification */}
      <div className={`fixed top-6 right-6 z-50 transform transition-all duration-500 ease-in-out ${
        notification.show 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
      }`}>
        <div className={`max-w-sm rounded-2xl shadow-2xl backdrop-blur-xl border p-4 ${
          notification.type === 'success'
            ? 'bg-green-50/90 border-green-200/50 shadow-green-500/20'
            : 'bg-red-50/90 border-red-200/50 shadow-red-500/20'
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
              notification.type === 'success' 
                ? 'bg-green-500' 
                : 'bg-red-500'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-white" />
              ) : (
                <AlertCircle className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {notification.type === 'success' ? 'Success!' : 'Error'}
              </p>
              <p className={`text-sm mt-1 ${
                notification.type === 'success' ? 'text-green-700' : 'text-red-700'
              }`}>
                {notification.message}
              </p>
            </div>
            <button
              onClick={hideNotification}
              className={`flex-shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors ${
                notification.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

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
      <div className="relative z-10 flex items-center justify-center px-4 py-8 min-h-screen">
        <div className={`relative max-w-md w-full transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-pink-500/30 rounded-2xl blur-xl opacity-50 scale-110"></div>
              <div className="relative inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#FA5D0F] to-orange-400 rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-300 hover:scale-110">
                <User className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FA5D0F] via-orange-600 to-pink-600 bg-clip-text text-transparent mb-2 hover:scale-105 transition-transform duration-300">
              Create Account
            </h1>
            <p className="text-gray-700/80 font-medium">
              Join us today and start your journey
            </p>
          </div>

          {/* Main Form Card with glassmorphic design */}
          <div className="backdrop-blur-xl bg-white/70 border border-white/30 rounded-3xl shadow-2xl shadow-orange-500/10 hover:shadow-orange-500/20 p-8 transition-all duration-500 hover:scale-[1.02] relative">
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-12 h-12 bg-gradient-to-r from-orange-400/20 to-pink-400/20 rounded-full blur-xl"></div>
            <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-gradient-to-r from-purple-400/20 to-orange-400/20 rounded-full blur-lg"></div>

            <div className="space-y-6">
              {/* Username Field */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className={`h-5 w-5 transition-colors ${
                      errors.username 
                        ? 'text-red-400' 
                        : 'text-gray-400 group-focus-within:text-[#FA5D0F]'
                    }`} />
                  </div>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    disabled={signupMutation.isPending}
                    className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl backdrop-blur-sm bg-white/50 focus:bg-white/80 transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed ${
                      errors.username
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/20 bg-red-50/30"
                        : "border-white/30 focus:border-[#FA5D0F] focus:ring-[#FA5D0F]/20"
                    }`}
                    placeholder="Enter your username"
                  />
                  {errors.username && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
                    </div>
                  )}
                </div>
                <div className={`transition-all duration-300 overflow-hidden ${
                  errors.username ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0'
                }`}>
                  <div className="flex items-center space-x-2 p-3 bg-red-50/80 border border-red-200/50 rounded-lg backdrop-blur-sm">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm font-medium">{errors.username}</p>
                  </div>
                </div>
              </div>

              {/* Email Field */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className={`h-5 w-5 transition-colors ${
                      errors.email 
                        ? 'text-red-400' 
                        : 'text-gray-400 group-focus-within:text-[#FA5D0F]'
                    }`} />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={signupMutation.isPending}
                    className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl backdrop-blur-sm bg-white/50 focus:bg-white/80 transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed ${
                      errors.email
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/20 bg-red-50/30"
                        : "border-white/30 focus:border-[#FA5D0F] focus:ring-[#FA5D0F]/20"
                    }`}
                    placeholder="Enter your email"
                  />
                  {errors.email && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
                    </div>
                  )}
                </div>
                <div className={`transition-all duration-300 overflow-hidden ${
                  errors.email ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0'
                }`}>
                  <div className="flex items-center space-x-2 p-3 bg-red-50/80 border border-red-200/50 rounded-lg backdrop-blur-sm">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm font-medium">{errors.email}</p>
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className={`h-5 w-5 transition-colors ${
                      errors.password 
                        ? 'text-red-400' 
                        : 'text-gray-400 group-focus-within:text-[#FA5D0F]'
                    }`} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    disabled={signupMutation.isPending}
                    className={`w-full pl-12 pr-12 py-3.5 border-2 rounded-xl backdrop-blur-sm bg-white/50 focus:bg-white/80 transition-all duration-200 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed ${
                      errors.password
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/20 bg-red-50/30"
                        : "border-white/30 focus:border-[#FA5D0F] focus:ring-[#FA5D0F]/20"
                    }`}
                    placeholder="Create a strong password"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center space-x-2 pr-4">
                    {errors.password && (
                      <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={signupMutation.isPending}
                      className={`text-gray-400 hover:text-[#FA5D0F] transition-colors disabled:opacity-50 ${
                        errors.password ? 'hover:text-red-600' : ''
                      }`}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className={`transition-all duration-300 overflow-hidden ${
                  errors.password ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0'
                }`}>
                  <div className="flex items-center space-x-2 p-3 bg-red-50/80 border border-red-200/50 rounded-lg backdrop-blur-sm">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm font-medium">{errors.password}</p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={signupMutation.isPending}
                className="group w-full py-4 bg-gradient-to-r from-[#FA5D0F] to-orange-600 text-white rounded-2xl font-semibold hover:from-orange-600 hover:to-pink-600 transition-all duration-300 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-[#FA5D0F]/30"
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>
                    {signupMutation.isPending ? "Creating Account..." : "Create Account"}
                  </span>
                  {!signupMutation.isPending && (
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  )}
                </span>
              </button>

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/30"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 backdrop-blur-sm bg-white/70 text-gray-500">Already have an account?</span>
                </div>
              </div>

              {/* Login Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => window.location.href = '/login'}
                  className="group inline-flex items-center space-x-2 text-[#FA5D0F] hover:text-orange-600 font-medium transition-colors duration-200"
                >
                  <span>Sign in instead</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 text-sm text-gray-500/80">
            By creating an account, you agree to our{" "}
            <a href="#" className="text-[#FA5D0F] hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-[#FA5D0F] hover:underline">
              Privacy Policy
            </a>
          </div>

          {/* Floating particles */}
          <div className="absolute -top-10 left-10 w-2 h-2 bg-orange-400/40 rounded-full animate-ping"></div>
          <div className="absolute -bottom-8 right-16 w-1 h-1 bg-pink-400/60 rounded-full animate-ping delay-700"></div>
          <div className="absolute top-1/3 -right-12 w-1.5 h-1.5 bg-purple-400/50 rounded-full animate-ping delay-300"></div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;