import React from 'react';
import { LucideIcon } from 'lucide-react';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

interface ServiceTileProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick: () => void;
  className?: string;
  featured?: boolean;
}

export const ServiceTile: React.FC<ServiceTileProps> = ({
  icon: Icon,
  title,
  subtitle,
  onClick,
  className = '',
  featured = false
}) => {
  const handleClick = () => {
    trackEvent(AnalyticsEvents.MARKETPLACE_SERVICE_CLICK, {
      service: title,
      featured,
      location: 'service_tile'
    });
    onClick();
  };

  return (
    <div
      onClick={handleClick}
      className={`service-tile flex flex-col items-center justify-center p-6 text-center min-h-[120px] ${className}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      <div className="mb-3">
        <Icon size={32} className="text-primary" />
      </div>
      <h3 className="font-medium text-sm text-foreground mb-1">{title}</h3>
      {subtitle && (
        <p className="text-xs text-foreground-secondary line-clamp-2">{subtitle}</p>
      )}
    </div>
  );
};