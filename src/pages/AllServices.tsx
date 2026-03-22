import React, { useState, useEffect } from 'react';
import { Search, Star, StarOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  mockCogniorServices, 
  serviceCategories,
  trackEvent, 
  AnalyticsEvents,
  CogniorService 
} from '@/data/mockData';
import { useAppStore } from '@/lib/store';

const AllServices: React.FC = () => {
  const navigate = useNavigate();
  useAppStore((s) => s.resources);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filteredServices, setFilteredServices] = useState<CogniorService[]>(mockCogniorServices);

  useEffect(() => {
    trackEvent(AnalyticsEvents.PAGE_VIEW, { page: 'all_services' });
  }, []);

  useEffect(() => {
    let filtered = mockCogniorServices;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(service => 
        service.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredServices(filtered);
  }, [searchQuery, selectedCategory]);

  const handleServiceClick = (service: CogniorService) => {
    trackEvent(AnalyticsEvents.MARKETPLACE_SERVICE_CLICK, {
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      location: 'all_services'
    });
    navigate(`/create/${service.route}`);
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    trackEvent(AnalyticsEvents.MARKETPLACE_CATEGORY_CLICK, { 
      category: categoryId,
      location: 'all_services'
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query) {
      trackEvent(AnalyticsEvents.SEARCH_QUERY, { 
        query, 
        context: 'all_services' 
      });
    }
  };

  const handleToggleFavorite = (serviceId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId];
      
      trackEvent(AnalyticsEvents.RESOURCE_FAVORITE, {
        serviceId,
        action: newFavorites.includes(serviceId) ? 'add' : 'remove',
        location: 'all_services'
      });
      
      return newFavorites;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground mb-2">All services</h1>
          <p className="text-foreground-secondary">
            Browse all Cognior services by category or search for specific services.
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted" size={16} />
            <input
              type="text"
              placeholder="Search services"
              value={searchQuery}
              onChange={handleSearchChange}
              className="azure-input pl-10"
            />
          </div>
        </div>

        <div className="flex gap-6">
          {/* Categories sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-card rounded-lg border border-card-border p-4">
              <h3 className="font-semibold text-foreground mb-3">Categories</h3>
              <div className="space-y-1">
                <button
                  onClick={() => handleCategoryClick('all')}
                  className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  All services ({mockCogniorServices.length})
                </button>
                
                {serviceCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    {category.name} ({category.services.length})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Services grid */}
          <div className="flex-1">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                {selectedCategory === 'all' 
                  ? `All services (${filteredServices.length})`
                  : `${serviceCategories.find(c => c.id === selectedCategory)?.name || ''} services (${filteredServices.length})`
                }
              </h2>
            </div>

            {filteredServices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredServices.map((service) => (
                  <div
                    key={service.id}
                    className="bg-card border border-card-border rounded-lg p-4 hover:bg-tile-hover transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary rounded flex-shrink-0 flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded-sm"></div>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground">{service.name}</h3>
                          {service.popular && (
                            <span className="text-xs text-primary">Popular</span>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(service.id);
                        }}
                        className="p-1 hover:bg-secondary rounded transition-colors opacity-0 group-hover:opacity-100"
                        aria-label={favorites.includes(service.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {favorites.includes(service.id) ? (
                          <Star size={16} className="text-warning fill-current" />
                        ) : (
                          <StarOff size={16} className="text-foreground-muted" />
                        )}
                      </button>
                    </div>
                    
                    <p className="text-sm text-foreground-secondary mb-3 line-clamp-2">
                      {service.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {service.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => handleServiceClick(service)}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-foreground-secondary mb-4">
                  No services found matching your search criteria.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="azure-button-secondary"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllServices;