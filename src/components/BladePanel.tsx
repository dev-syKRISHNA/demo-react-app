import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

interface BladePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const widthClasses = {
  sm: 'w-96',
  md: 'w-[32rem]',
  lg: 'w-[48rem]',
  xl: 'w-[64rem]'
};

export const BladePanel: React.FC<BladePanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 'lg',
  className = ''
}) => {
  useEffect(() => {
    if (isOpen) {
      trackEvent(AnalyticsEvents.NAVIGATION_CLICK, {
        element: 'blade_panel_open',
        title
      });
    }
  }, [isOpen, title]);

  const handleClose = () => {
    trackEvent(AnalyticsEvents.NAVIGATION_CLICK, {
      element: 'blade_panel_close',
      title
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={handleClose}
      />
      
      {/* Blade panel */}
      <div className={`
        fixed top-0 right-0 h-full bg-blade-bg border-l border-blade-border z-50
        ${widthClasses[width]} ${className}
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        blade-panel
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-secondary rounded transition-colors"
            aria-label="Close panel"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </>
  );
};