import React from "react";
import { Toaster } from "react-hot-toast";

const ToastContainer: React.FC = () => (
  <Toaster
    position="top-right"
    toastOptions={{
      style: {
        fontFamily: "Roboto, sans-serif",
      },
    }}
  />
);

export default ToastContainer;
