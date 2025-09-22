import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

interface BreadcrumbItem {
  label: string;
  href?: string;
  isActive?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    trackEvent(AnalyticsEvents.BREADCRUMB_CLICK, {
      label: item.label,
      href: item.href
    });
  };

  return (
    <nav className="text-sm text-foreground-secondary py-2">
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight size={16} className="mx-2 text-foreground-muted" />
            )}
            
            {item.href && !item.isActive ? (
              <Link
                to={item.href}
                onClick={() => handleBreadcrumbClick(item)}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={item.isActive ? 'text-foreground font-medium' : ''}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};