import React, { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "../app/store";
import { useMutation } from "@tanstack/react-query";
import axios from "../api/axiosClient";
import toast from "react-hot-toast";
import { FiSend, FiMoon, FiSun, FiMenu, FiX } from "react-icons/fi";
import ChatSidebar from "../components/ChatSidebar";
import type { ChatSession } from "../components/ChatSidebar";
import { toggleDarkMode } from "../app/slices/uiSlice";

interface ChatRequest {
  message: string;
}

interface ChatResponse {
  reply: string;
}

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const ChatPage: React.FC = () => {
  const token = useSelector((state: RootState) => state.auth.token);
  const isDarkMode = useSelector((state: RootState) => state.ui.darkMode);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();

  // Mock chat sessions
  const [chatSessions] = useState<ChatSession[]>([
    {
      id: "1",
      title: "JAJ Assistant",
      lastMessage: "How can I help you today?",
      timestamp: new Date(),
      unread: 0
    },
    {
      id: "2", 
      title: "Order Support",
      lastMessage: "Your order has been confirmed",
      timestamp: new Date(Date.now() - 3600000),
      unread: 2
    },
    {
      id: "3",
      title: "Campus Services",
      lastMessage: "Library hours updated",
      timestamp: new Date(Date.now() - 7200000),
      unread: 0
    }
  ]);

  const [activeChat, setActiveChat] = useState("1");

  // Mount animation
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Mutation to send chat prompt
  const mutation = useMutation({
    mutationFn: (payload: ChatRequest) =>
      axios.post<ChatResponse>("/chat/prompt", payload, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: (res) => {
      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + '_assistant',
        content: res.data.reply,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
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

    const userMessage: ChatMessage = {
      id: Date.now().toString() + '_user',
      content: trimmed,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    mutation.mutate({ message: trimmed });
    setInput("");
  };

  // Handler for chat selection from sidebar
  const handleChatSelect = (chatId: string) => {
    setActiveChat(chatId);
    // Here you would typically load messages for the selected chat
    // For now, we'll just clear messages to simulate switching chats
    if (chatId !== activeChat) {
      setMessages([]);
    }
  };

  // Handler for sidebar collapse toggle
  const handleToggleCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleDarkModeToggle = () => {
    dispatch(toggleDarkMode());
  };

  return (
    <div className="h-screen flex overflow-hidden relative">
      {/* Animated gradient background */}
      <div className={`absolute inset-0 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' 
          : 'bg-gradient-to-br from-orange-50 via-white to-orange-100'
      }`}>
        <div className={`absolute inset-0 ${
          isDarkMode 
            ? 'bg-gradient-to-tr from-blue-900/10 via-transparent to-slate-800/20' 
            : 'bg-gradient-to-tr from-orange-500/5 via-transparent to-pink-500/5'
        }`}></div>
      </div>
      
      {/* Floating orbs for visual depth */}
      <div className={`absolute top-20 left-20 w-72 h-72 rounded-full blur-3xl animate-pulse ${
        isDarkMode 
          ? 'bg-gradient-to-r from-blue-600/10 to-slate-600/10' 
          : 'bg-gradient-to-r from-orange-400/15 to-pink-400/15'
      }`}></div>
      <div className={`absolute bottom-20 right-20 w-96 h-96 rounded-full blur-3xl animate-pulse delay-1000 ${
        isDarkMode 
          ? 'bg-gradient-to-r from-blue-600/15 to-slate-600/15' 
          : 'bg-gradient-to-r from-slate-400/10 to-orange-400/10'
      }`}></div>
      <div className={`absolute top-1/2 left-1/3 w-64 h-64 rounded-full blur-2xl animate-pulse delay-500 ${
        isDarkMode 
          ? 'bg-gradient-to-r from-indigo-600/12 to-slate-600/12' 
          : 'bg-gradient-to-r from-blue-400/8 to-orange-400/8'
      }`}></div>

      {/* Sidebar Component */}
      <div className="relative z-20">
        <ChatSidebar
          chatSessions={chatSessions}
          activeChat={activeChat}
          sidebarCollapsed={sidebarCollapsed}
          onChatSelect={handleChatSelect}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Chat Header - Updated with mobile hamburger */}
        <div className={`backdrop-blur-xl border-b px-4 py-3 flex items-center justify-between shadow-lg ${
          isDarkMode 
            ? 'bg-slate-800/70 border-slate-700/30 shadow-blue-900/10' 
            : 'bg-white/70 border-white/30 shadow-orange-500/5'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden relative">
              <div className={`absolute inset-0 rounded-full blur-sm ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-blue-600/30 to-slate-600/30' 
                  : 'bg-gradient-to-r from-orange-500/20 to-pink-500/20'
              }`}></div>
              <img 
                src="https://res.cloudinary.com/df3lhzzy7/image/upload/v1748836703/jaj-icon_n4pqll.png" 
                alt="JAJ Assistant" 
                className="w-full h-full object-contain relative z-10 drop-shadow-sm"
              />
            </div>
            
            <div>
              <h3 className={`font-semibold bg-clip-text text-transparent ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-blue-400 to-slate-400' 
                  : 'bg-gradient-to-r from-[#FA5D0F] to-orange-600'
              }`}>JAJ Assistant</h3>
              <p className={`text-sm font-medium ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}>Online</p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center space-x-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={handleDarkModeToggle}
              className={`p-2 rounded-lg transition-all duration-300 hover:scale-110 hover:rotate-12 ${
                isDarkMode 
                  ? 'hover:bg-yellow-400/20 hover:shadow-lg hover:shadow-yellow-400/20' 
                  : 'hover:bg-blue-100/80 hover:shadow-lg hover:shadow-blue-400/20'
              }`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <FiSun className="w-5 h-5 text-yellow-400" />
              ) : (
                <FiMoon className="w-5 h-5 text-blue-600" />
              )}
            </button>

            {/* Mobile Hamburger Menu - Only visible on mobile */}
            <button
              onClick={handleToggleCollapse}
              className={`md:hidden relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300
                ${isDarkMode 
                  ? 'hover:bg-slate-700/50' 
                  : 'hover:bg-slate-100/50'
                }
              `}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? (
                <FiMenu className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} />
              ) : (
                <FiX className={`w-5 h-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} />
              )}
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Glassmorphic overlay */}
          <div className={`absolute inset-0 backdrop-blur-sm ${
            isDarkMode ? 'bg-slate-800/20' : 'bg-white/20'
          }`} />
          
          <div className="relative z-10 p-4 space-y-4">
            {/* Chat Messages */}
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl relative ${
                  message.isUser ? 'ml-12' : 'mr-12'
                }`}>
                  <div className={`px-4 py-3 rounded-2xl shadow-lg transition-all duration-300 hover:scale-105 ${
                    message.isUser 
                      ? isDarkMode
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-md shadow-blue-600/30'
                        : 'bg-gradient-to-r from-[#FA5D0F] to-orange-600 text-white rounded-br-md shadow-orange-500/30'
                      : isDarkMode
                        ? 'backdrop-blur-xl bg-slate-700/80 text-slate-100 rounded-bl-md border border-slate-600/40 shadow-slate-900/20'
                        : 'backdrop-blur-xl bg-white/80 text-gray-800 rounded-bl-md border border-white/40 shadow-gray-500/10'
                  }`}>
                    <p className="whitespace-pre-line text-sm md:text-base leading-relaxed">
                      {message.content}
                    </p>
                    <div className={`text-xs mt-2 ${
                      message.isUser 
                        ? isDarkMode ? 'text-blue-100' : 'text-orange-100'
                        : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
                  {/* Message glow effect */}
                  {message.isUser && (
                    <div className={`absolute inset-0 rounded-2xl blur-xl -z-10 opacity-50 ${
                      isDarkMode 
                        ? 'bg-gradient-to-r from-blue-600/30 to-slate-600/30' 
                        : 'bg-gradient-to-r from-orange-500/20 to-pink-500/20'
                    }`}></div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Animation - Enhanced */}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl mr-12">
                  <div className={`px-4 py-3 rounded-2xl rounded-bl-md shadow-lg border ${
                    isDarkMode 
                      ? 'backdrop-blur-xl bg-slate-700/80 border-slate-600/40 shadow-slate-900/20' 
                      : 'backdrop-blur-xl bg-white/80 border-white/40 shadow-gray-500/10'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className={`w-2 h-2 rounded-full animate-bounce ${
                          isDarkMode 
                            ? 'bg-gradient-to-r from-blue-400 to-slate-400' 
                            : 'bg-gradient-to-r from-orange-400 to-pink-400'
                        }`}></div>
                        <div className={`w-2 h-2 rounded-full animate-bounce delay-100 ${
                          isDarkMode 
                            ? 'bg-gradient-to-r from-blue-400 to-slate-400' 
                            : 'bg-gradient-to-r from-orange-400 to-pink-400'
                        }`}></div>
                        <div className={`w-2 h-2 rounded-full animate-bounce delay-200 ${
                          isDarkMode 
                            ? 'bg-gradient-to-r from-blue-400 to-slate-400' 
                            : 'bg-gradient-to-r from-orange-400 to-pink-400'
                        }`}></div>
                      </div>
                      <span className={`text-sm bg-clip-text text-transparent font-medium ${
                        isDarkMode 
                          ? 'bg-gradient-to-r from-blue-400 to-slate-400' 
                          : 'bg-gradient-to-r from-[#FA5D0F] to-orange-600'
                      }`}>JAJ is typing...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area - Glassmorphic */}
        <div className={`backdrop-blur-xl border-t p-4 shadow-lg ${
          isDarkMode 
            ? 'bg-slate-800/70 border-slate-700/30 shadow-blue-900/10' 
            : 'bg-white/70 border-white/30 shadow-orange-500/5'
        }`}>
          <form onSubmit={handleSubmit}>
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className={`w-full px-6 py-4 backdrop-blur-sm border rounded-full focus:outline-none focus:ring-2 text-sm md:text-base transition-all duration-300 shadow-inner ${
                    isDarkMode 
                      ? 'bg-slate-700/60 border-slate-600/40 focus:ring-blue-500/30 focus:bg-slate-700/80 focus:border-blue-500/40 text-slate-100 placeholder-slate-400'
                      : 'bg-white/60 border-white/40 focus:ring-[#FA5D0F]/30 focus:bg-white/80 focus:border-[#FA5D0F]/40 text-gray-900 placeholder-gray-500/70'
                  }`}
                  disabled={loading}
                />
                {/* Input field glow */}
                <div className={`absolute inset-0 rounded-full blur-xl opacity-0 focus-within:opacity-100 transition-opacity duration-300 -z-10 ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-blue-600/20 to-slate-600/20' 
                    : 'bg-gradient-to-r from-orange-500/10 to-pink-500/10'
                }`}></div>
              </div>

              <button
                type="submit"
                className={`relative group p-4 text-white rounded-full transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110 transform hover:-translate-y-1 active:scale-95 ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-600/30 hover:shadow-blue-600/50' 
                    : 'bg-gradient-to-r from-[#FA5D0F] to-orange-600 hover:from-orange-600 hover:to-pink-600 shadow-orange-500/30 hover:shadow-orange-500/50'
                }`}
                disabled={loading || input.trim() === ""}
              >
                {/* Button glow effect */}
                <div className={`absolute inset-0 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-110 ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-blue-600/40 to-slate-600/40' 
                    : 'bg-gradient-to-r from-orange-500/30 to-pink-500/30'
                }`}></div>
                <FiSend className="w-5 h-5 relative z-10 group-hover:rotate-12 transition-transform duration-300" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Floating particles */}
      <div className={`absolute top-20 left-1/4 w-2 h-2 rounded-full animate-ping ${
        isDarkMode ? 'bg-blue-500/40' : 'bg-orange-400/40'
      }`}></div>
      <div className={`absolute bottom-32 right-1/3 w-1 h-1 rounded-full animate-ping delay-700 ${
        isDarkMode ? 'bg-pink-500/60' : 'bg-pink-400/60'
      }`}></div>
      <div className={`absolute top-1/3 right-20 w-1.5 h-1.5 rounded-full animate-ping delay-300 ${
        isDarkMode ? 'bg-indigo-500/50' : 'bg-slate-400/50'
      }`}></div>
      
      {/* Additional ambient lighting */}
      <div className={`absolute top-0 right-1/2 w-px h-32 bg-gradient-to-b from-transparent to-transparent ${
        isDarkMode ? 'via-blue-500/20' : 'via-orange-400/20'
      }`}></div>
      <div className={`absolute bottom-0 left-1/4 w-px h-24 bg-gradient-to-t from-transparent to-transparent ${
        isDarkMode ? 'via-pink-500/15' : 'via-pink-400/15'
      }`}></div>
    </div>
  );
};

export default ChatPage;