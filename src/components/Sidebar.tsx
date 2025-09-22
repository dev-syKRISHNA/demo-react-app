import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Grid3x3, 
  Layers, 
  CreditCard, 
  Database, 
  Zap, 
  ShoppingCart, 
  BarChart3, 
  Shield, 
  MessageSquare,
  ChevronRight,
  Star,
  Plus,
  Monitor,
  Globe,
  Key,
  Network,
  Box,
  DollarSign,
  Lightbulb
} from 'lucide-react';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

interface SidebarProps {
  isCollapsed: boolean;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { to: '/', icon: Home, label: 'Home' },
      { to: '/all-services', icon: Grid3x3, label: 'All services' },
      { to: '/create', icon: Plus, label: 'Create a resource' }
    ]
  },
  {
    title: 'Navigate',
    items: [
      { to: '/resource-groups', icon: Layers, label: 'Resource groups' },
      { to: '/subscriptions', icon: CreditCard, label: 'Subscriptions' }
    ]
  },
  {
    title: 'Services',
    items: [
      { to: '/virtual-machines', icon: Monitor, label: 'Virtual machines' },
      { to: '/storage-accounts', icon: Database, label: 'Storage accounts' },
      { to: '/function-apps', icon: Zap, label: 'Function Apps' },
      { to: '/sql-databases', icon: Database, label: 'SQL databases' },
      { to: '/app-services', icon: Globe, label: 'App Services' },
      { to: '/key-vaults', icon: Key, label: 'Key vaults' },
      { to: '/virtual-networks', icon: Network, label: 'Virtual networks' },
      { to: '/kubernetes-service', icon: Box, label: 'Kubernetes services' }
    ]
  },
  {
    title: 'General',
    items: [
      { to: '/marketplace', icon: ShoppingCart, label: 'Marketplace' },
      { to: '/cost-management', icon: DollarSign, label: 'Cost Management + Billing' },
      { to: '/monitor', icon: BarChart3, label: 'Monitor' },
      { to: '/advisor', icon: Lightbulb, label: 'Advisor' },
      { to: '/security-center', icon: Shield, label: 'Microsoft Defender for Cloud' }
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed }) => {
  const handleNavClick = (item: NavItem) => {
    trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { 
      element: 'sidebar_nav',
      destination: item.to,
      label: item.label
    });
  };

  return (
    <aside className={`bg-background-elevated border-r border-border transition-all duration-300 ${
      isCollapsed ? 'w-12' : 'w-64'
    } flex flex-col`}>
      <div className="flex-1 py-4">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            {section.title && !isCollapsed && (
              <div className="px-4 mb-2">
                <h3 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">
                  {section.title}
                </h3>
              </div>
            )}
            
            <nav className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => handleNavClick(item)}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 text-sm transition-colors group ${
                      isActive
                        ? 'nav-item-active bg-accent text-accent-foreground'
                        : 'text-nav-item hover:text-nav-item-hover hover:bg-secondary'
                    }`
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  <item.icon size={16} className="flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="ml-3 flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
        
        {/* Favorites Section */}
        <div className="px-4 mb-2">
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-foreground-secondary uppercase tracking-wide">
              Favorites
            </h3>
          )}
        </div>
        
        <div className="space-y-1">
          <NavLink
            to="/resource-groups/analytics"
            className="flex items-center px-4 py-2 text-sm text-nav-item hover:text-nav-item-hover hover:bg-secondary transition-colors"
            title={isCollapsed ? 'Analytics Resource Group' : undefined}
            onClick={() => trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { 
              element: 'favorites',
              destination: '/resource-groups/analytics'
            })}
          >
            <Star size={16} className="flex-shrink-0 text-warning" />
            {!isCollapsed && <span className="ml-3">Analytics</span>}
          </NavLink>
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button 
          className="flex items-center w-full px-2 py-2 text-sm text-nav-item hover:text-nav-item-hover hover:bg-secondary rounded transition-colors"
          onClick={() => trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { element: 'feedback' })}
          title={isCollapsed ? 'Give feedback' : undefined}
        >
          <MessageSquare size={16} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Give feedback</span>}
        </button>
      </div>
    </aside>
  );
};