import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, MoreHorizontal, Star, StarOff } from 'lucide-react';
import { 
  mockResourceGroups, 
  trackEvent, 
  AnalyticsEvents,
  ResourceGroup
} from '@/data/mockData';

const ResourceGroups: React.FC = () => {
  const navigate = useNavigate();
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>(mockResourceGroups);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<ResourceGroup[]>(mockResourceGroups);

  useEffect(() => {
    trackEvent(AnalyticsEvents.PAGE_VIEW, { page: 'resource_groups' });
  }, []);

  useEffect(() => {
    const filtered = resourceGroups.filter(group =>
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.subscription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredGroups(filtered);
  }, [searchQuery, resourceGroups]);

  const handleCreateResourceGroup = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, { resourceType: 'Resource Group' });
    navigate('/create/resource-group');
  };

  const handleResourceGroupClick = (group: ResourceGroup) => {
    trackEvent(AnalyticsEvents.RESOURCE_VIEW, {
      resourceId: group.id,
      resourceType: 'Resource Group',
      resourceName: group.name
    });
    navigate(`/resource-groups/${group.id}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query) {
      trackEvent(AnalyticsEvents.SEARCH_QUERY, { 
        query, 
        context: 'resource_groups' 
      });
    }
  };

  const handleSelectGroup = (groupId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedGroups(prev => [...prev, groupId]);
    } else {
      setSelectedGroups(prev => prev.filter(id => id !== groupId));
    }
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedGroups(filteredGroups.map(g => g.id));
    } else {
      setSelectedGroups([]);
    }
    
    trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { 
      element: 'select_all',
      selected: isSelected,
      count: filteredGroups.length
    });
  };

  const getStatusColor = (status: ResourceGroup['status']) => {
    switch (status) {
      case 'Active': return 'text-success';
      case 'Failed': return 'text-error';
      case 'Deleting': return 'text-warning';
      default: return 'text-foreground-secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Resource groups</h1>
            <p className="text-sm text-foreground-secondary mt-1">
              A resource group is a container that holds related resources for an Azure solution.
            </p>
          </div>
          
          <button
            onClick={handleCreateResourceGroup}
            className="azure-button-primary flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Create</span>
          </button>
        </div>

        {/* Search and filters */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted" size={16} />
            <input
              type="text"
              placeholder="Search resource groups"
              value={searchQuery}
              onChange={handleSearchChange}
              className="azure-input pl-10"
            />
          </div>
          
          <button className="azure-button-secondary flex items-center space-x-2">
            <Filter size={16} />
            <span>Add filter</span>
          </button>
          
          <button className="azure-button-secondary">
            Manage view
          </button>
        </div>

        {/* Bulk actions */}
        {selectedGroups.length > 0 && (
          <div className="bg-accent border border-accent-foreground/20 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-foreground">
                  {selectedGroups.length} resource group{selectedGroups.length !== 1 ? 's' : ''} selected
                </span>
                <button className="text-primary hover:underline text-sm">
                  Clear selection
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <button className="azure-button-secondary text-sm">
                  Delete
                </button>
                <button className="azure-button-secondary text-sm">
                  Move
                </button>
                <button className="azure-button-secondary text-sm">
                  Add tags
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resource groups table */}
        <div className="bg-card rounded-lg border border-card-border overflow-hidden">
          <table className="azure-table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedGroups.length === filteredGroups.length && filteredGroups.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
                <th>Name</th>
                <th>Subscription</th>
                <th>Location</th>
                <th>Resources</th>
                <th>Status</th>
                <th>Last modified</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => (
                <tr 
                  key={group.id}
                  className="cursor-pointer"
                  onClick={() => handleResourceGroupClick(group)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={(e) => handleSelectGroup(group.id, e.target.checked)}
                      className="rounded"
                    />
                  </td>
                  <td>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-primary rounded-sm flex-shrink-0"></div>
                      <span className="text-primary hover:underline font-medium">{group.name}</span>
                    </div>
                  </td>
                  <td className="text-foreground-secondary">{group.subscription}</td>
                  <td className="text-foreground-secondary">{group.location}</td>
                  <td className="text-foreground-secondary">{group.resourceCount}</td>
                  <td>
                    <span className={`text-sm ${getStatusColor(group.status)}`}>
                      {group.status}
                    </span>
                  </td>
                  <td className="text-foreground-secondary">{group.lastModified}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="p-1 hover:bg-secondary rounded transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        trackEvent(AnalyticsEvents.NAVIGATION_CLICK, { 
                          element: 'resource_menu',
                          resourceId: group.id
                        });
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredGroups.length === 0 && (
            <div className="text-center py-8 text-foreground-secondary">
              {searchQuery ? 'No resource groups found matching your search.' : 'No resource groups found.'}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mt-4 text-sm text-foreground-secondary">
          Showing {filteredGroups.length} of {resourceGroups.length} resource groups
        </div>
      </div>
    </div>
  );
};

export default ResourceGroups;