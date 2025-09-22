import React, { useState } from 'react';
import { Search, Bell, HelpCircle, Settings, User, Menu, Bot } from 'lucide-react';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    trackEvent(AnalyticsEvents.SEARCH_QUERY, { query: searchQuery });
  };

  const handleSearchFocus = () => {
    trackEvent(AnalyticsEvents.FORM_FIELD_FOCUS, { field: 'global_search' });
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { element: 'notifications' });
  };

  const handleCopilotClick = () => {
    trackEvent(AnalyticsEvents.HELP_COPILOT_OPEN, { location: 'header' });
  };

  const handleUserMenuClick = () => {
    setShowUserMenu(!showUserMenu);
    trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { element: 'user_menu' });
  };

  return (
    <header className="bg-header-bg text-header-text border-b border-border">
      <div className="flex items-center justify-between px-4 py-2 h-12">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
              <div className="w-4 h-4 bg-header-bg rounded-sm"></div>
            </div>
            <span className="font-semibold text-lg">Cognior Portal</span>
          </div>
        </div>

        {/* Center search */}
        <div className="flex-1 max-w-2xl mx-8">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <Search 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                size={16} 
              />
              <input
                type="text"
                placeholder="Search resources, services, and docs (G+/)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                className="w-full pl-10 pr-4 py-2 bg-white text-foreground rounded border border-border focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent text-sm"
              />
            </div>
          </form>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-2">
          {/* Copilot */}
          <button
            onClick={handleCopilotClick}
            className="flex items-center space-x-1 px-3 py-1 bg-white text-header-bg rounded text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Bot size={16} />
            <span>Copilot</span>
          </button>

          {/* Portal for Mobile */}
          <button className="p-2 hover:bg-white/10 rounded transition-colors hidden sm:block">
            <div className="w-4 h-4 bg-white/20 rounded"></div>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={handleNotificationClick}
              className="p-2 hover:bg-white/10 rounded transition-colors relative"
              aria-label="Notifications"
            >
              <Bell size={16} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white text-foreground rounded-lg shadow-lg border border-border z-50">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="p-4 text-sm text-foreground-secondary">
                  No new notifications
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button 
            className="p-2 hover:bg-white/10 rounded transition-colors"
            aria-label="Settings"
            onClick={() => trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { element: 'settings' })}
          >
            <Settings size={16} />
          </button>

          {/* Help */}
          <button 
            className="p-2 hover:bg-white/10 rounded transition-colors"
            aria-label="Help"
            onClick={() => trackEvent(AnalyticsEvents.HELP_DOCUMENTATION_CLICK, { location: 'header' })}
          >
            <HelpCircle size={16} />
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={handleUserMenuClick}
              className="flex items-center space-x-2 p-2 hover:bg-white/10 rounded transition-colors"
            >
              <User size={16} />
              <span className="text-sm hidden sm:block">don.cognior@gmail.com</span>
            </button>
            
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white text-foreground rounded-lg shadow-lg border border-border z-50">
                <div className="p-4 border-b border-border">
                  <div className="font-semibold">don.cognior@gmail.com</div>
                  <div className="text-sm text-foreground-secondary">DEFAULT DIRECTORY (RAKS777G...)</div>
                </div>
                <div className="p-2">
                  <button className="w-full text-left px-3 py-2 hover:bg-secondary rounded transition-colors text-sm">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};