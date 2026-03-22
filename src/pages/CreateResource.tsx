import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, ChevronRight } from 'lucide-react';
import { ServiceTile } from '@/components/ServiceTile';
import { 
  mockCogniorServices, 
  serviceCategories,
  trackEvent, 
  AnalyticsEvents,
  CogniorService 
} from '@/data/mockData';

const CreateResource: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filteredServices, setFilteredServices] = useState<CogniorService[]>(mockCogniorServices);

  useEffect(() => {
    trackEvent(AnalyticsEvents.MARKETPLACE_OPEN, { location: 'create_resource' });
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

  const handleClose = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_CANCEL, { stage: 'marketplace' });
    navigate('/');
  };

  const handleServiceClick = (service: CogniorService) => {
    trackEvent(AnalyticsEvents.MARKETPLACE_SERVICE_CLICK, {
      serviceId: service.id,
      serviceName: service.name,
      category: service.category
    });
    navigate(`/create/${service.route}`);
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    trackEvent(AnalyticsEvents.MARKETPLACE_CATEGORY_CLICK, { category: categoryId });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query) {
      trackEvent(AnalyticsEvents.SEARCH_QUERY, { 
        query, 
        context: 'marketplace' 
      });
    }
  };

  const popularServices = filteredServices.filter(s => s.popular);
  const featuredServices = filteredServices.filter(s => s.featured);

  return (
    <div className="h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-background-elevated border-r border-border p-4">
        <div className="mb-6">
          <h3 className="font-semibold text-foreground mb-3">Get Started</h3>
          <div className="space-y-1">
            <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary rounded transition-colors">
              Recently created
            </button>
          </div>
        </div>

        <div className="mb-6">
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
              All
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
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-4">
            <nav className="text-sm text-foreground-secondary">
              <span 
                onClick={() => navigate('/')}
                className="cursor-pointer hover:text-foreground"
              >
                Home
              </span>
              <ChevronRight size={16} className="inline mx-2" />
              <span className="text-foreground">Create a resource</span>
            </nav>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-secondary rounded transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <h1 className="text-2xl font-semibold text-foreground mb-6">Create a resource</h1>

          {/* Search and AI suggestions */}
          <div className="mb-8">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted" size={16} />
              <input
                type="text"
                placeholder="Search services and marketplace"
                value={searchQuery}
                onChange={handleSearchChange}
                className="azure-input pl-10"
              />
            </div>
            
            <div className="text-sm text-foreground-secondary mb-4">
              Getting started? 
              <button className="text-primary hover:underline ml-1">
                Explore the Quickstart Center
              </button>
            </div>

            {/* AI suggestions */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="px-3 py-1 bg-accent text-accent-foreground rounded-full text-sm cursor-pointer hover:bg-accent/80 transition-colors">
                Help me compare Cognior services for my workload
              </span>
              <span className="px-3 py-1 bg-accent text-accent-foreground rounded-full text-sm cursor-pointer hover:bg-accent/80 transition-colors">
                Design a new Cognior workload
              </span>
              <span className="px-3 py-1 bg-accent text-accent-foreground rounded-full text-sm cursor-pointer hover:bg-accent/80 transition-colors">
                I need a new low-cost VM
              </span>
            </div>
          </div>

          {/* Popular services */}
          {popularServices.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Popular Cognior services</h2>
                <button
                  className="text-primary hover:underline text-sm"
                  onClick={() => navigate('/all-services')}
                >
                  See more in All services
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {popularServices.slice(0, 8).map((service) => (
                  <div
                    key={service.id}
                    onClick={() => handleServiceClick(service)}
                    className="bg-card border border-card-border rounded-lg p-4 hover:bg-tile-hover cursor-pointer transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-primary rounded flex-shrink-0 flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-sm"></div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground mb-1">{service.name}</h3>
                        <p className="text-sm text-primary cursor-pointer hover:underline">Create</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All services */}
          {filteredServices.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {selectedCategory === 'all' ? 'All services' : `${selectedCategory} services`}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredServices.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => handleServiceClick(service)}
                    className="bg-card border border-card-border rounded-lg p-4 hover:bg-tile-hover cursor-pointer transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-primary rounded flex-shrink-0 flex items-center justify-center">
                        <div className="w-4 h-4 bg-white rounded-sm"></div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground mb-1">{service.name}</h3>
                        <p className="text-xs text-foreground-secondary mb-2 line-clamp-2">
                          {service.description}
                        </p>
                        <p className="text-sm text-primary cursor-pointer hover:underline">Create</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredServices.length === 0 && (
            <div className="text-center py-12">
              <p className="text-foreground-secondary">No services found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateResource;