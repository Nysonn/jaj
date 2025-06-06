import React from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../app/slices/authSlice";
import type { RootState } from "../app/store";

const Navbar: React.FC = () => {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <img
          src="https://res.cloudinary.com/df3lhzzy7/image/upload/v1748836703/jaj-icon_n4pqll.png"
          alt="JAJ Logo"
          className="w-8 h-8"
        />
        <span className="text-2xl font-bold text-[#FA5D0F]">JAJ</span>
      </Link>
      <div className="flex items-center gap-4">
        {token ? (
          <>
            <Link to="/chat" className="text-gray-700 hover:text-[#FA5D0F]">
              Chat
            </Link>
            <Link to="/orders" className="text-gray-700 hover:text-[#FA5D0F]">
              Orders
            </Link>
            <button
              onClick={() => dispatch(logout())}
              className="text-red-500 hover:text-red-700"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-gray-700 hover:text-[#FA5D0F]"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="bg-[#FA5D0F] text-white px-3 py-1 rounded hover:bg-[#e1550c]"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
