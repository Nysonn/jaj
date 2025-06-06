import React, { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../app/store";
import { useMutation } from "@tanstack/react-query";
import axios from "../api/axiosClient";
import toast from "react-hot-toast";
import { FiSend } from "react-icons/fi";

interface ChatRequest {
  message: string;
}

interface ChatResponse {
  reply: string;
}

const ChatPage: React.FC = () => {
  const token = useSelector((state: RootState) => state.auth.token);
  const [input, setInput] = useState("");
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mutation to send chat prompt
  const mutation = useMutation({
    mutationFn: (payload: ChatRequest) =>
      axios.post<ChatResponse>("/chat/prompt", payload, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: (res) => {
      setLastReply(res.data.reply);
      setLoading(false);
    },
    onError: (err: any) => {
      setLoading(false);
      toast.error(err.message || "Chat failed");
    },
  });

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setLastReply(null);
    mutation.mutate({ message: trimmed });
    setInput("");
  };

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <img
            src="https://res.cloudinary.com/df3lhzzy7/image/upload/v1748836703/jaj-icon_n4pqll.png"
            alt="JAJ Logo"
            className="w-8 h-8"
          />
          <h1 className="text-xl font-semibold text-[#FA5D0F]">JAJ Chat</h1>
        </div>
        <a
          href="/orders"
          className="text-secondary font-medium hover:underline"
        >
          My Orders
        </a>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-auto p-4 bg-gray-50">
        {/* If there is a lastReply, display it in a "bot bubble" */}
        {lastReply && (
          <div className="max-w-lg mx-auto mb-4">
            <div className="bg-white rounded-lg shadow px-4 py-3">
              <p className="text-gray-800 whitespace-pre-line">{lastReply}</p>
            </div>
          </div>
        )}

        {/* If loading, show a spinner placeholder */}
        {loading && (
          <div className="max-w-lg mx-auto mb-4">
            <div className="bg-white rounded-lg shadow px-4 py-3 animate-pulse">
              <p className="text-gray-400">JAJ is typing…</p>
            </div>
          </div>
        )}
      </main>

      {/* Message Input (fixed at bottom) */}
      <footer className="border-t border-gray-200 p-4 bg-white">
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#FA5D0F]"
            disabled={loading}
          />
          <button
            type="submit"
            className={`bg-[#FA5D0F] hover:bg-[#e1550c] text-white p-3 rounded-full transition disabled:opacity-50`}
            disabled={loading || input.trim() === ""}
          >
            <FiSend size={20} />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default ChatPage;