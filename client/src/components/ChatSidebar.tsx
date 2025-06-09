import React from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../app/store"; // Update path as needed
import { 
  FiShoppingBag, 
  FiPackage, 
  FiSettings, 
  FiLogOut,
  FiMessageCircle,
  FiUser,
  FiHeart,
  FiTrendingUp,
  FiMenu,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  unread?: number;
}

interface ChatSidebarProps {
  chatSessions: ChatSession[];
  activeChat: string;
  sidebarCollapsed: boolean;
  onChatSelect: (chatId: string) => void;
  onToggleCollapse: () => void;
  onMenuSelect?: (menu: string) => void;
}

// Desktop Hamburger Button Component
const DesktopHamburgerButton: React.FC<{ 
  isCollapsed: boolean; 
  onClick: () => void; 
  isDarkMode: boolean; 
}> = ({ isCollapsed, onClick, isDarkMode }) => (
  <button
    onClick={onClick}
    className={`
      hidden md:flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 hover:scale-110
      ${isDarkMode 
        ? 'hover:bg-slate-700/50 text-slate-300 hover:text-blue-300' 
        : 'hover:bg-slate-100/50 text-slate-600 hover:text-blue-600'
      }
    `}
    aria-label="Toggle sidebar"
    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
  >
    {isCollapsed ? (
      <FiChevronRight className="w-5 h-5 transition-transform duration-300" />
    ) : (
      <FiChevronLeft className="w-5 h-5 transition-transform duration-300" />
    )}
  </button>
);

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  sidebarCollapsed,
  onToggleCollapse,
  onMenuSelect,
}) => {
  const isDarkMode = useSelector((state: RootState) => state.ui.darkMode);

  const primaryMenuItems = [
    { id: 'jaj-assistant', label: 'AI Assistant', icon: FiMessageCircle, count: 3, isActive: true },
    { id: 'products', label: 'Browse Products', icon: FiShoppingBag, count: 0 },
    { id: 'orders', label: 'Order History', icon: FiPackage, count: 2 },
  ];

  const secondaryMenuItems = [
    { id: 'favorites', label: 'Favorites', icon: FiHeart, count: 0 },
    { id: 'analytics', label: 'Insights', icon: FiTrendingUp, count: 0 },
    { id: 'settings', label: 'Settings', icon: FiSettings, count: 0 },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {!sidebarCollapsed && (
        <div 
          className={`fixed inset-0 backdrop-blur-sm z-40 md:hidden transition-all duration-300 ease-in-out
            ${isDarkMode ? 'bg-slate-900/60' : 'bg-slate-900/40'}
          `}
          onClick={onToggleCollapse}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 md:z-10
        flex flex-col border-r transition-all duration-300 ease-in-out overflow-hidden
        ${sidebarCollapsed ? 'w-0 md:w-14' : 'w-72 md:w-64 lg:w-72'}
        ${sidebarCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
        ${isDarkMode 
          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700/40' 
          : 'bg-gradient-to-br from-white via-slate-50/30 to-slate-50/20 border-slate-200/60'
        }
        shadow-lg md:shadow-md backdrop-blur-xl
      `}>
        
        {/* Header Section - Updated with desktop hamburger */}
        <div className={`relative z-10 p-3 border-b backdrop-blur-sm flex-shrink-0 ${
          isDarkMode 
            ? 'border-slate-700/20 bg-slate-800/20' 
            : 'border-slate-200/40 bg-white/20'
        }`}>
          <div className="flex items-center justify-between">
            {/* Left side - Desktop Hamburger (only visible on desktop when sidebar is expanded) */}
            <div className="flex items-center">
              {!sidebarCollapsed && (
                <DesktopHamburgerButton
                  isCollapsed={sidebarCollapsed}
                  onClick={onToggleCollapse}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>

            {/* Center - Logo and Brand */}
            <div className="flex items-center justify-center flex-1">
              {!sidebarCollapsed ? (
                <div className="flex items-center space-x-2">
                  <div className="relative group">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center backdrop-blur-sm border shadow-lg overflow-hidden transition-all duration-300 group-hover:scale-105 ${
                      isDarkMode 
                        ? 'bg-gradient-to-br from-blue-600/30 to-slate-600/20 border-blue-500/30' 
                        : 'bg-gradient-to-br from-blue-500/20 to-slate-500/15 border-blue-400/30'
                    }`}>
                      <img 
                        src="https://res.cloudinary.com/df3lhzzy7/image/upload/v1748836703/jaj-icon_n4pqll.png" 
                        alt="JAJ Delivery" 
                        className="w-full h-full object-contain drop-shadow-lg"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-0.5">
                    <h1 className={`text-lg font-bold bg-clip-text text-transparent ${
                      isDarkMode 
                        ? 'bg-gradient-to-r from-blue-400 to-slate-400' 
                        : 'bg-gradient-to-r from-blue-600 to-slate-600'
                    }`}>
                      JAJ
                    </h1>
                    <div className={`flex items-center space-x-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-green-400' : 'bg-green-500'} animate-pulse`} />
                      <span>Online</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2">
                  {/* Collapsed state - Show hamburger button at top */}
                  <DesktopHamburgerButton
                    isCollapsed={sidebarCollapsed}
                    onClick={onToggleCollapse}
                    isDarkMode={isDarkMode}
                  />
                  
                  {/* Logo below hamburger in collapsed state */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center backdrop-blur-sm border shadow-lg overflow-hidden ${
                    isDarkMode 
                      ? 'bg-gradient-to-r from-blue-600/20 to-slate-600/20 border-slate-600/30' 
                      : 'bg-gradient-to-r from-blue-500/20 to-slate-500/20 border-slate-200/30'
                  }`}>
                    <img 
                      src="https://res.cloudinary.com/df3lhzzy7/image/upload/v1748836703/jaj-icon_n4pqll.png" 
                      alt="JAJ Delivery" 
                      className="w-full h-full object-contain drop-shadow-lg"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right side - Empty space for balance */}
            <div className="flex items-center">
              {/* This ensures the center content stays centered */}
            </div>
          </div>
        </div>

        {/* Menu Items - Updated with more compact design */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-transparent">
          <div className="relative z-10 px-2 py-3">
            {!sidebarCollapsed && (
              <h3 className={`text-xs font-semibold uppercase tracking-wider px-2 mb-2 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Main Menu
              </h3>
            )}
            
            <div className="space-y-1">
              {primaryMenuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onMenuSelect?.(item.id)}
                    className={`
                      group relative w-full flex items-center p-2 rounded-xl transition-all duration-300
                      hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5
                      ${sidebarCollapsed ? 'justify-center' : 'justify-between'}
                      ${item.isActive 
                        ? (isDarkMode 
                            ? 'bg-gradient-to-r from-blue-600/20 to-slate-600/20 shadow-md shadow-blue-500/20 border border-blue-500/30' 
                            : 'bg-gradient-to-r from-blue-500/15 to-slate-500/15 shadow-md shadow-blue-500/20 border border-blue-400/30'
                          )
                        : (isDarkMode 
                            ? 'hover:bg-slate-700/40' 
                            : 'hover:bg-slate-100/60'
                          )
                      }
                    `}
                    style={{ animationDelay: `${index * 50}ms` }}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`relative p-1.5 rounded-lg transition-all duration-300 ${
                        item.isActive 
                          ? (isDarkMode 
                              ? 'bg-blue-500/20' 
                              : 'bg-blue-500/20'
                            )
                          : 'group-hover:bg-current group-hover:bg-opacity-10'
                      }`}>
                        <Icon className={`w-4 h-4 transition-all duration-300 ${
                          item.isActive 
                            ? (isDarkMode 
                                ? 'text-blue-300' 
                                : 'text-blue-600'
                              )
                            : (isDarkMode 
                                ? 'text-slate-400 group-hover:text-blue-300' 
                                : 'text-slate-600 group-hover:text-blue-600'
                              )
                        }`} />
                      </div>
                      {!sidebarCollapsed && (
                        <span className={`font-medium text-sm transition-all duration-300 ${
                          item.isActive 
                            ? (isDarkMode 
                                ? 'text-blue-200' 
                                : 'text-blue-700'
                              )
                            : (isDarkMode 
                                ? 'text-slate-200 group-hover:text-blue-200' 
                                : 'text-slate-700 group-hover:text-blue-700'
                              )
                        }`}>
                          {item.label}
                        </span>
                      )}
                    </div>
                    
                    {/* Notification badges - Updated design */}
                    {!sidebarCollapsed && item.count > 0 && (
                      <div className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        isDarkMode 
                          ? 'bg-blue-500/20 text-blue-300' 
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {item.count}
                      </div>
                    )}
                    
                    {sidebarCollapsed && item.count > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-[10px] text-white font-medium">{item.count}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Secondary Menu - Updated with more compact design */}
            <div className="mt-4">
              {!sidebarCollapsed && (
                <h3 className={`text-xs font-semibold uppercase tracking-wider px-2 mb-2 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Quick Access
                </h3>
              )}
              
              <div className="space-y-0.5">
                {secondaryMenuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onMenuSelect?.(item.id)}
                      className={`
                        group w-full flex items-center p-2 rounded-lg transition-all duration-300
                        hover:scale-[1.01] hover:-translate-y-0.5
                        ${sidebarCollapsed ? 'justify-center' : 'justify-start space-x-2'}
                        ${isDarkMode 
                          ? 'hover:bg-slate-700/30' 
                          : 'hover:bg-slate-100/50'
                        }
                      `}
                      style={{ animationDelay: `${(index + 3) * 50}ms` }}
                      title={sidebarCollapsed ? item.label : ''}
                    >
                      <Icon className={`w-4 h-4 transition-colors duration-300 ${
                        isDarkMode 
                          ? 'text-slate-400 group-hover:text-blue-400' 
                          : 'text-slate-500 group-hover:text-blue-500'
                      }`} />
                      {!sidebarCollapsed && (
                        <span className={`text-sm font-medium transition-colors duration-300 ${
                          isDarkMode 
                            ? 'text-slate-400 group-hover:text-blue-300' 
                            : 'text-slate-600 group-hover:text-blue-600'
                        }`}>
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* User Profile Section - Updated with more compact design */}
        <div className={`relative z-10 p-2 border-t backdrop-blur-sm flex-shrink-0 ${
          isDarkMode 
            ? 'border-slate-700/20 bg-slate-800/20' 
            : 'border-slate-200/30 bg-white/20'
        }`}>
          {!sidebarCollapsed ? (
            <div className={`p-2 rounded-xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-gradient-to-r from-slate-800/50 to-slate-700/30 border border-slate-600/30' 
                : 'bg-gradient-to-r from-white/50 to-slate-50/30 border border-slate-200/40'
            }`}>
              <div className="flex items-center space-x-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-blue-600/30 to-slate-600/30' 
                    : 'bg-gradient-to-r from-blue-500/20 to-slate-500/20'
                }`}>
                  <FiUser className={`w-4 h-4 ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`} />
                </div>
                <div>
                  <p className={`font-medium text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    Campus User
                  </p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Premium
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                isDarkMode 
                  ? 'bg-gradient-to-r from-blue-600/30 to-slate-600/30' 
                  : 'bg-gradient-to-r from-blue-500/20 to-slate-500/20'
              }`}>
                <FiUser className={`w-4 h-4 ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`} />
              </div>
            </div>
          )}
          
          {/* Logout Button - Updated design */}
          <button
            onClick={() => onMenuSelect?.('logout')}
            className={`
              group w-full flex items-center p-2 mt-2 rounded-lg transition-all duration-300
              hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5
              ${sidebarCollapsed ? 'justify-center' : 'justify-start space-x-2'}
              ${isDarkMode 
                ? 'hover:bg-red-900/30' 
                : 'hover:bg-red-50'
              }
            `}
            title={sidebarCollapsed ? 'Logout' : ''}
          >
            <div className={`p-1.5 rounded-lg transition-all duration-300 ${
              isDarkMode 
                ? 'group-hover:bg-red-500/20' 
                : 'group-hover:bg-red-100'
            }`}>
              <FiLogOut className="w-4 h-4 text-red-500 group-hover:text-red-600 transition-colors duration-300" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-medium text-sm text-red-600 group-hover:text-red-700 transition-colors duration-300">
                Sign Out
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default ChatSidebar;