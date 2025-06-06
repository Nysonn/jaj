import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGet } from "../api/reactQuery";
import toast from "react-hot-toast";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const VerifyPage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const token = query.get("token") || "";

  // Use React Query to call GET /verify?token=<token>
  const { data, isLoading, isError, error } = useGet<{ message: string }>(
    ["verify", token],
    `/verify?token=${encodeURIComponent(token)}`,
    {
      enabled: Boolean(token),
    }
  );

  useEffect(() => {
    if (data && !isLoading && !isError) {
      toast.success("Email verified! You can now log in.");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    }
    if (isError && error) {
      toast.error((error as Error).message || "Verification failed");
    }
  }, [data, isLoading, isError, error, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full space-y-4 text-center">
        {isLoading && <p className="text-gray-600">Verifying...</p>}
        {isError && (
          <p className="text-red-500">{(error as Error).message}</p>
        )}
        {!isLoading && data && (
          <p className="text-green-600">{data.message}</p>
        )}
        {!token && (
          <p className="text-red-500">No verification token provided.</p>
        )}
      </div>
    </div>
  );
};

export default VerifyPage;
