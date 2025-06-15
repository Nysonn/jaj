import type { JSX } from "react"
import { Provider } from "react-redux";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ToastContainer from "./components/ToastContainer";
import store from "./app/store";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "./app/store";
import { useEffect } from "react";
import { useGet } from "./api/reactQuery";
import { setUser, logout } from "./app/slices/authSlice";

// Imports for the Application Pages.
import WelcomePage from "./pages/WelcomePage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import VerifyPage from "./pages/VerifyEmailPage";
import ChatPage from "./pages/ChatPage";
import OrdersPage from "./pages/OrdersPage";
import ResetPasswordPage from "./pages/ResetPasswordPage"
import NewPassword from "./pages/NewPassword"
// import AdminLayout from "./pages/Admin/AdminLayout";
// import AdminCatalogPage from "./pages/Admin/CatalogPage";
// import AdminOrdersPage from "./pages/Admin/OrdersPage";
import NotFoundPage from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 401 errors (authentication failures)
        if (error?.response?.status === 401) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

// Auth provider to check session on app load
function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // Check if user has a valid session on app load
  const { data: user, error, isLoading } = useGet<{
    id: number;
    username: string;
    email: string;
  }>(
    ['me'],
    '/me',
    {
      enabled: !isAuthenticated, // Only check if not already authenticated
      retry: false, // Don't retry on failure
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (user) {
      dispatch(setUser(user));
    } else if (error && !isLoading) {
      // If there's an error fetching user info, ensure logout state
      dispatch(logout());
    }
  }, [user, error, isLoading, dispatch]);

  return <>{children}</>;
}

// Protect routes by checking authentication status
function PrivateRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const dispatch = useDispatch<AppDispatch>();

  // Check session validity when accessing protected routes
  const { error } = useGet<{
    id: number;
    username: string;
    email: string;
  }>(
    ['me'],
    '/me',
    {
      enabled: isAuthenticated,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  // Handle session invalidation on error
  useEffect(() => {
    if (error) {
      dispatch(logout());
    }
  }, [error, dispatch]);

  if (error?.message?.includes('401') || error?.message?.includes('session')) {
    return <Navigate to="/login" replace />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppContent() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/password-reset-submit-email" element={<ResetPasswordPage />} />
        <Route path="/password-reset" element={<NewPassword />} />

        {/* Chat and Orders require authentication */}
        <Route
          path="/chat"
          element={
            <PrivateRoute>
              <ChatPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <PrivateRoute>
              <OrdersPage />
            </PrivateRoute>
          }
        />

        {/* Admin: nested under /admin */}
        {/* <Route
          path="/admin/*"
          element={
            <PrivateRoute>
              <AdminLayout />
            </PrivateRoute>
          }
        /> */}

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <ToastContainer />
    </AuthProvider>
  );
}

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AppContent />
        </Router>
      </QueryClientProvider>
    </Provider>
  )
}

export default App;