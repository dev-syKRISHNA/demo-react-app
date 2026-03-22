import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Layers,
  Database,
  Zap,
  ShoppingBag,
  BarChart3,
  Rocket,
  Bot,
  Box,
  ArrowRight,
  Star,
  StarOff
} from 'lucide-react';
import { ServiceTile } from '@/components/ServiceTile';
import {
  trackEvent,
  AnalyticsEvents,
  Resource
} from '@/data/mockData';
import { actions, useAppStore } from '@/lib/store';

interface ResourceTableProps {
  resources: Resource[];
  onToggleFavorite: (resourceId: string) => void;
}

const ResourceTable: React.FC<ResourceTableProps> = ({ resources, onToggleFavorite }) => {
  const navigate = useNavigate();

  const handleResourceClick = (resource: Resource) => {
    trackEvent(AnalyticsEvents.RESOURCE_VIEW, {
      resourceId: resource.id,
      resourceType: resource.type,
      resourceName: resource.name
    });
    
    if (resource.type === 'Resource group') {
      navigate(`/resource-groups/${resource.id}`);
    } else {
      navigate(`/resources/${resource.id}`);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent, resourceId: string) => {
    e.stopPropagation();
    onToggleFavorite(resourceId);
    trackEvent(AnalyticsEvents.RESOURCE_FAVORITE, { resourceId });
  };

  return (
    <div className="bg-card rounded-lg border border-card-border overflow-hidden">
      <table className="azure-table">
        <thead>
          <tr>
            <th className="w-8"></th>
            <th>Name</th>
            <th>Type</th>
            <th>Last Viewed</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr 
              key={resource.id}
              onClick={() => handleResourceClick(resource)}
              className="cursor-pointer"
            >
              <td>
                <button
                  onClick={(e) => handleFavoriteClick(e, resource.id)}
                  className="p-1 hover:bg-secondary rounded transition-colors"
                  aria-label={resource.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {resource.isFavorite ? (
                    <Star size={14} className="text-warning fill-current" />
                  ) : (
                    <StarOff size={14} className="text-foreground-muted" />
                  )}
                </button>
              </td>
              <td>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-primary rounded-sm flex-shrink-0"></div>
                  <span className="text-primary hover:underline">{resource.name}</span>
                </div>
              </td>
              <td className="text-foreground-secondary">{resource.type}</td>
              <td className="text-foreground-secondary">{resource.lastViewed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'recent' | 'favorite'>('recent');
  const resources = useAppStore((s) => s.resources);
  const quickTiles = [
    { icon: Plus, title: 'Create a resource', path: '/create-resource', className: 'bg-accent border-accent-foreground/20', featured: true },
    { icon: Layers, title: 'Resource groups', path: '/resource-groups' },
    { icon: Database, title: 'Cognior Cosmos DB', path: '/cosmos-db' },
    { icon: Zap, title: 'Function App', path: '/function-apps' },
    { icon: ShoppingBag, title: 'Storage accounts', path: '/storage-accounts' },
    { icon: BarChart3, title: 'Monitor', path: '/monitor' },
    { icon: Rocket, title: 'Quickstart Center', path: '/all-services' },
    { icon: Bot, title: 'Cognior AI Foundry', path: '/all-services' },
    { icon: Box, title: 'Kubernetes services', path: '/kubernetes-service' },
    { icon: ArrowRight, title: 'More services', path: '/all-services' }
  ] as const;

  useEffect(() => {
    trackEvent(AnalyticsEvents.PAGE_VIEW, { page: 'dashboard' });
  }, []);

  const handleServiceClick = (tile: typeof quickTiles[number]) => {
    trackEvent(AnalyticsEvents.MARKETPLACE_SERVICE_CLICK, {
      service: tile.title,
      location: 'dashboard_tiles'
    });
    navigate(tile.path);
  };

  const handleToggleFavorite = (resourceId: string) => {
    const resource = resources.find((item) => item.id === resourceId);
    if (!resource) return;
    actions.updateResource(resourceId, { isFavorite: !resource.isFavorite });
  };

  const filteredResources = resources.filter(resource =>
    activeTab === 'recent' ? true : resource.isFavorite
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Cognior services section */}
      <section className="p-6">
        <h1 className="text-xl font-semibold text-foreground mb-6">Cognior services</h1>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          {quickTiles.map((tile) => (
            <ServiceTile
              key={tile.title}
              icon={tile.icon}
              title={tile.title}
              onClick={() => handleServiceClick(tile)}
              className={tile.className ?? ''}
              featured={Boolean(tile.featured)}
            />
          ))}
        </div>
      </section>

      {/* Resources section */}
      <section className="px-6 pb-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Resources</h2>
        
        {/* Tab navigation */}
        <div className="flex space-x-8 mb-4 border-b border-border">
          <button
            onClick={() => {
              setActiveTab('recent');
              trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { element: 'recent_tab' });
            }}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'recent'
                ? 'text-primary border-primary'
                : 'text-foreground-secondary border-transparent hover:text-foreground hover:border-border'
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => {
              setActiveTab('favorite');
              trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { element: 'favorite_tab' });
            }}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'favorite'
                ? 'text-primary border-primary'
                : 'text-foreground-secondary border-transparent hover:text-foreground hover:border-border'
            }`}
          >
            Favorite
          </button>
        </div>

        {/* Resources table */}
        <ResourceTable 
          resources={filteredResources}
          onToggleFavorite={handleToggleFavorite}
        />
        
        {filteredResources.length === 0 && (
          <div className="text-center py-8 text-foreground-secondary">
            {activeTab === 'favorite' 
              ? "You don't have any favorite resources yet." 
              : "No recent resources found."
            }
          </div>
        )}
        
        <div className="mt-4">
          <button 
            onClick={() => {
              trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { element: 'see_all_resources' });
              navigate('/all-resources');
            }}
            className="text-primary hover:underline text-sm"
          >
            See all
          </button>
        </div>
      </section>
    </div>
  );
};