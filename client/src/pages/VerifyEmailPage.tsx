import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useVerifyToken } from "../hooks/useVerify";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const VerifyEmailPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const query = useQuery();
  const token = query.get("token");

  const { data, isLoading, isError, error, isVerified } = useVerifyToken(token, {
    onSuccess: (data) => {
      console.log("Verification successful:", data);
    },
    onError: (error) => {
      console.error("Verification failed:", error);
    },
    redirectTo: "/login",
    redirectDelay: 2000,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

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
        <div className={`max-w-lg w-full text-center transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Glassmorphic container */}
          <div className="backdrop-blur-xl bg-white/70 border border-white/30 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 hover:shadow-orange-500/20 transition-all duration-500">
            
            {/* Logo with glow effect */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-pink-500/30 rounded-full blur-xl opacity-50 scale-110"></div>
              <img
                src="https://res.cloudinary.com/df3lhzzy7/image/upload/v1748836703/jaj-icon_n4pqll.png"
                alt="JAJ Logo"
                className="relative mx-auto w-20 h-20 drop-shadow-lg"
              />
            </div>

            {/* Content based on verification state */}
            {!token && (
              <>
                {/* Email verification instruction */}
                <div className="mb-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FA5D0F] via-orange-600 to-pink-600 bg-clip-text text-transparent mb-4">
                    Check Your Email
                  </h1>
                  
                  <p className="text-gray-700/80 mb-6 text-lg leading-relaxed">
                    We've sent a verification link to your email address. 
                    <span className="block mt-2 text-orange-600 font-semibold">
                      Click the link to verify your JAJ account.
                    </span>
                  </p>
                </div>

                {/* Back to login button */}
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
              </>
            )}

            {/* Loading state */}
            {token && isLoading && (
              <>
                <div className="mb-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-orange-500/20 to-pink-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-orange-600 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-[#FA5D0F] via-orange-600 to-pink-600 bg-clip-text text-transparent mb-4">
                    Verifying Your Account
                  </h1>
                  
                  <p className="text-gray-700/80 text-lg">
                    Please wait while we verify your email address...
                  </p>
                </div>
              </>
            )}

            {/* Success state */}
            {token && isVerified && data && (
              <>
                <div className="mb-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent mb-4">
                    Email Verified!
                  </h1>
                  
                  <p className="text-gray-700/80 text-lg mb-4">
                    {data.message}
                  </p>
                  
                  <p className="text-green-600 font-semibold">
                    Redirecting you to login...
                  </p>
                </div>
              </>
            )}

            {/* Error state */}
            {token && isError && (
              <>
                <div className="mb-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 via-pink-600 to-rose-600 bg-clip-text text-transparent mb-4">
                    Verification Failed
                  </h1>
                  
                  <p className="text-gray-700/80 text-lg mb-6">
                    {(error as Error)?.message || "Unable to verify your email address."}
                  </p>
                  
                  <button
                    onClick={() => window.location.href = '/signup'}
                    className="group w-full py-3 bg-gradient-to-r from-[#FA5D0F] to-orange-600 text-white rounded-2xl font-semibold hover:from-orange-600 hover:to-pink-600 transition-all duration-300 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transform hover:-translate-y-1 active:scale-95"
                  >
                    Try Again
                  </button>
                </div>
              </>
            )}
            
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
            <span className="font-medium">
              {!token ? "Check your email to continue" : "Verifying your account"}
            </span>
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

export default VerifyEmailPage;