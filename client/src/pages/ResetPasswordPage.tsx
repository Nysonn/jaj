import React, { useEffect, useState } from "react";
import usePasswordReset from "../hooks/usePasswordReset"; 

const ResetPasswordPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"email" | "reset">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Use the custom hook
  const { sendResetEmail, resetPassword } = usePasswordReset({
    baseUrl: "http://localhost:8080", 
    onEmailSuccess: () => {
      // Redirect to password-reset page after successful email submission
      console.log("Reset email sent successfully");
      window.location.href = '/password-reset';
    },
    onPasswordResetSuccess: () => {
      // Any additional logic after password is reset successfully
      console.log("Password reset successfully");
    },
    redirectUrl: "/login",
    redirectDelay: 2000,
  });

  // Get token from URL params if present
  useEffect(() => {
    setMounted(true);
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      setStep("reset");
    }
  }, []);

  const handleEmailSubmit = () => {
    if (email.trim()) {
      sendResetEmail.mutate({ email: email.trim() });
    }
  };

  const handlePasswordSubmit = () => {
    if (newPassword && newPassword === confirmPassword && token) {
      resetPassword.mutate({ token, newPassword });
    }
  };

  const isEmailValid = email.includes("@") && email.includes(".");
  const isPasswordValid = newPassword.length >= 6;
  const doPasswordsMatch = newPassword === confirmPassword;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-orange-100">
        <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 via-transparent to-pink-500/5"></div>
      </div>
      
      {/* Floating orbs for visual depth */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-orange-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-r from-purple-400/15 to-orange-400/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-gradient-to-r from-blue-400/10 to-orange-400/10 rounded-full blur-2xl animate-pulse delay-500"></div>
      
      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className={`max-w-md w-full text-center transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Glassmorphic container */}
          <div className="backdrop-blur-xl bg-white/70 border border-white/30 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 hover:shadow-orange-500/20 transition-all duration-500">
            
            {/* Logo with glow effect */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-pink-500/30 rounded-full blur-xl opacity-50 scale-110"></div>
              <img
                src="https://res.cloudinary.com/df3lhzzy7/image/upload/v1748836703/jaj-icon_n4pqll.png"
                alt="JAJ Logo"
                className="relative mx-auto w-24 h-24 drop-shadow-lg hover:scale-110 transition-transform duration-300"
              />
            </div>
            
            {/* Dynamic Title */}
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FA5D0F] via-orange-600 to-pink-600 bg-clip-text text-transparent mb-4 hover:scale-105 transition-transform duration-300">
              {step === "email" ? "Reset Password" : "Set New Password"}
            </h1>
            
            {/* Dynamic Subtitle */}
            <p className="text-gray-700/80 mb-8 text-base leading-relaxed">
              {step === "email" 
                ? "Enter your email address and we'll send you a link to reset your password."
                : "Enter your new password to complete the reset process."
              }
            </p>

            {/* Email Step Form */}
            {step === "email" && (
              <div className="space-y-6">
                <div className="text-left">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                {/* Error Message - Only show on failure, user stays on this page */}
                {sendResetEmail.isError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{sendResetEmail.error?.message || "Failed to send reset email"}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleEmailSubmit}
                  disabled={!isEmailValid || sendResetEmail.isPending}
                  className="group w-full py-4 bg-gradient-to-r from-[#FA5D0F] to-orange-600 text-white rounded-2xl font-semibold hover:from-orange-600 hover:to-pink-600 transition-all duration-300 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
                >
                  <span className="flex items-center justify-center space-x-2">
                    {sendResetEmail.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Reset Link</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </div>
            )}

            {/* Password Reset Step Form */}
            {step === "reset" && (
              <div className="space-y-6">
                <div className="text-left">
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                      placeholder="Enter new password (min 6 characters)"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showPassword ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        )}
                      </svg>
                    </button>
                  </div>
                  {newPassword && !isPasswordValid && (
                    <p className="mt-1 text-sm text-red-600">Password must be at least 6 characters long</p>
                  )}
                </div>

                <div className="text-left">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                      placeholder="Confirm your new password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showConfirmPassword ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        )}
                      </svg>
                    </button>
                  </div>
                  {confirmPassword && !doPasswordsMatch && (
                    <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
                  )}
                </div>

                {/* Success Message */}
                {resetPassword.isSuccess && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Password reset successful! Redirecting to login...</span>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {resetPassword.isError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{resetPassword.error?.message || "Failed to reset password"}</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePasswordSubmit}
                  disabled={!isPasswordValid || !doPasswordsMatch || resetPassword.isPending}
                  className="group w-full py-4 bg-gradient-to-r from-[#FA5D0F] to-orange-600 text-white rounded-2xl font-semibold hover:from-orange-600 hover:to-pink-600 transition-all duration-300 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
                >
                  <span className="flex items-center justify-center space-x-2">
                    {resetPassword.isPending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <span>Update Password</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </div>
            )}

            {/* Back to Login Link */}
            <div className="mt-4">
               <button
                  onClick={() => window.location.href = '/login'}
                  className="group w-full py-3 backdrop-blur-sm bg-white/50 border-2 border-orange-500/30 text-[#FA5D0F] rounded-2xl font-semibold hover:bg-orange-500/10 hover:border-orange-500/50 transition-all duration-300 shadow-lg hover:shadow-orange-500/20 hover:scale-105 transform hover:-translate-y-1 active:scale-95"
                >
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back to Login</span>
                  </span>
                </button>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-12 h-12 bg-gradient-to-r from-orange-400/20 to-pink-400/20 rounded-full blur-xl"></div>
            <div className="absolute -bottom-4 -left-4 w-8 h-8 bg-gradient-to-r from-purple-400/20 to-orange-400/20 rounded-full blur-lg"></div>
          </div>
          
          {/* Floating particles */}
          <div className="absolute -top-10 left-10 w-2 h-2 bg-orange-400/40 rounded-full animate-ping"></div>
          <div className="absolute -bottom-8 right-16 w-1 h-1 bg-pink-400/60 rounded-full animate-ping delay-700"></div>
          <div className="absolute top-1/3 -right-12 w-1.5 h-1.5 bg-purple-400/50 rounded-full animate-ping delay-300"></div>
        </div>
        
        {/* Bottom decoration */}
        <div className={`mt-12 transition-all duration-1500 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="flex items-center space-x-2 text-gray-500/60 text-sm">
            <div className="w-8 h-px bg-gradient-to-r from-transparent to-gray-400/50"></div>
            <span className="font-medium">Secure password reset</span>
            <div className="w-8 h-px bg-gradient-to-l from-transparent to-gray-400/50"></div>
          </div>
        </div>
      </div>
      
      {/* Additional ambient lighting */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-px h-32 bg-gradient-to-b from-orange-400/30 to-transparent"></div>
      <div className="absolute bottom-0 left-1/4 w-px h-24 bg-gradient-to-t from-pink-400/20 to-transparent"></div>
      <div className="absolute bottom-0 right-1/4 w-px h-20 bg-gradient-to-t from-purple-400/20 to-transparent"></div>
    </div>
  );
};

export default ResetPasswordPage;