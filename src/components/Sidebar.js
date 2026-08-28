import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  FolderKanban,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Zap,
  Search,
  Bell,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Team', href: '/team', icon: Users },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <>
      <div 
        className="sidebar-overlay" 
        onClick={() => document.body.classList.remove('mobile-menu-open')}
      />
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Zap size={20} color="white" />
          </div>
          <span className="sidebar-logo-text">NovaSaaS</span>
          <button 
            className="mobile-close-btn"
            onClick={() => document.body.classList.remove('mobile-menu-open')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main Menu</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => document.body.classList.remove('mobile-menu-open')}
              >
                <Icon size={20} className="sidebar-link-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'Guest'}</div>
            <div className="sidebar-user-email">{user?.email || ''}</div>
          </div>
          <button className="sidebar-logout-btn" onClick={logout} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}

export function Header({ title }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleMobileMenu = () => {
    document.body.classList.toggle('mobile-menu-open');
  };

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <button className="header-mobile-toggle" onClick={toggleMobileMenu}>
          <Menu size={24} />
        </button>
        <h1 className="header-title">{title}</h1>
      </div>
      <div className="header-actions">
        <div className="header-search hide-on-mobile">
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Search..." />
        </div>
        <button 
          className="header-icon-btn theme-toggle-btn" 
          onClick={toggleTheme} 
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button className="header-icon-btn">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>
      </div>
    </header>
  );
}
