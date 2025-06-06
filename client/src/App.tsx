import type { JSX } from "react"
import { Provider } from "react-redux";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ToastContainer from "./components/ToastContainer";
import store from "./app/store";
import { useSelector } from "react-redux";
import type { RootState } from "./app/store";

// Imports for the Application Pages.
import WelcomePage from "./pages/WelcomePage";
import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import VerifyPage from "./pages/VerifyEmailPage";
import ChatPage from "./pages/ChatPage";
import OrdersPage from "./pages/OrdersPage";
// import AdminLayout from "./pages/Admin/AdminLayout";
// import AdminCatalogPage from "./pages/Admin/CatalogPage";
// import AdminOrdersPage from "./pages/Admin/OrdersPage";
import NotFoundPage from "./pages/NotFound";

const queryClient = new QueryClient();

// Protect routes by checking if token exists in Redux
function PrivateRoute({ children }: { children: JSX.Element }) {
  const token = useSelector((state: RootState) => state.auth.token);
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <Router>
              <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify" element={<VerifyPage />} />

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
        </Router>
      </QueryClientProvider>
    </Provider>
  )
}

export default App;
