import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Settings, 
  Users, 
  Eye,
  Trash2,
  Play,
  Square,
  Activity,
  Tag
} from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import {
  trackEvent,
  AnalyticsEvents,
  Resource,
  ResourceGroup
} from '@/data/mockData';
import { useAppStore } from '@/lib/store';

const ResourceGroupDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  
  const resourceGroups = useAppStore((s) => s.resourceGroups);
  const allResources = useAppStore((s) => s.resources);
  const resourceGroup = resourceGroups.find((rg) => rg.id === id);
  const resources = allResources.filter((r) => r.resourceGroup === resourceGroup?.name);

  useEffect(() => {
    if (resourceGroup) {
      trackEvent(AnalyticsEvents.PAGE_VIEW, { 
        page: 'resource_group_detail',
        resourceGroupId: id,
        resourceGroupName: resourceGroup.name
      });
    }
  }, [id, resourceGroup]);

  if (!resourceGroup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Resource group not found</h1>
          <p className="text-foreground-secondary mb-4">The requested resource group could not be found.</p>
          <button
            onClick={() => navigate('/resource-groups')}
            className="azure-button-primary"
          >
            Back to Resource Groups
          </button>
        </div>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Resource groups', href: '/resource-groups' },
    { label: resourceGroup.name, isActive: true }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'activity-log', label: 'Activity log', icon: Activity },
    { id: 'access-control', label: 'Access control (IAM)', icon: Users },
    { id: 'tags', label: 'Tags', icon: Tag },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    trackEvent(AnalyticsEvents.NAVIGATION_CLICK, {
      element: 'resource_group_tab',
      tab: tabId,
      resourceGroupId: id
    });
  };

  const handleAddResource = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      context: 'resource_group',
      resourceGroupId: id
    });
    navigate('/create-resource', { 
      state: { preselectedResourceGroup: resourceGroup.name }
    });
  };

  const handleResourceClick = (resource: Resource) => {
    trackEvent(AnalyticsEvents.RESOURCE_VIEW, {
      resourceId: resource.id,
      resourceType: resource.type,
      context: 'resource_group'
    });
    navigate(`/resources/${resource.id}`);
  };

  const handleResourceAction = (action: string, resourceId: string) => {
    trackEvent(AnalyticsEvents.RESOURCE_START + '_' + action.toLowerCase(), {
      resourceId,
      context: 'resource_group'
    });
  };

  const handleSelectResource = (resourceId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedResources(prev => [...prev, resourceId]);
    } else {
      setSelectedResources(prev => prev.filter(id => id !== resourceId));
    }
  };

  const getStatusColor = (status: Resource['status']) => {
    switch (status) {
      case 'Running': return 'text-success';
      case 'Stopped': return 'text-foreground-muted';
      case 'Failed': return 'text-error';
      case 'Deploying': return 'text-warning';
      default: return 'text-foreground-secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 mt-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded flex-shrink-0 flex items-center justify-center">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{resourceGroup.name}</h1>
              <p className="text-sm text-foreground-secondary">
                Resource group • {resourceGroup.location} • {resourceGroup.subscription}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAddResource}
              className="azure-button-primary flex items-center space-x-2"
            >
              <Plus size={16} />
              <span>Add</span>
            </button>
            
            <button className="azure-button-secondary">
              <Trash2 size={16} />
            </button>
            
            <button className="azure-button-secondary">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex space-x-8 mb-6 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`pb-2 text-sm font-medium transition-colors border-b-2 flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-foreground-secondary border-transparent hover:text-foreground hover:border-border'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Resource group info */}
            <div className="bg-card rounded-lg border border-card-border p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Essentials</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <dt className="text-sm text-foreground-secondary">Resource group</dt>
                  <dd className="text-sm font-medium text-foreground mt-1">{resourceGroup.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-foreground-secondary">Status</dt>
                  <dd className="text-sm font-medium text-success mt-1">{resourceGroup.status}</dd>
                </div>
                <div>
                  <dt className="text-sm text-foreground-secondary">Location</dt>
                  <dd className="text-sm font-medium text-foreground mt-1">{resourceGroup.location}</dd>
                </div>
                <div>
                  <dt className="text-sm text-foreground-secondary">Subscription</dt>
                  <dd className="text-sm font-medium text-foreground mt-1">{resourceGroup.subscription}</dd>
                </div>
                <div>
                  <dt className="text-sm text-foreground-secondary">Subscription ID</dt>
                  <dd className="text-sm font-medium text-foreground mt-1">12345678-1234-1234-1234-123456789012</dd>
                </div>
                <div>
                  <dt className="text-sm text-foreground-secondary">Tags</dt>
                  <dd className="text-sm font-medium text-foreground mt-1">
                    {Object.keys(resourceGroup.tags).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(resourceGroup.tags).map(([key, value]) => (
                          <span key={key} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    ) : (
                      'No tags'
                    )}
                  </dd>
                </div>
              </div>
            </div>

            {/* Resources */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Resources</h2>
                
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted" size={16} />
                    <input
                      type="text"
                      placeholder="Search resources"
                      className="azure-input pl-10 w-64"
                    />
                  </div>
                  
                  <button className="azure-button-secondary flex items-center space-x-2">
                    <Filter size={16} />
                    <span>Add filter</span>
                  </button>
                </div>
              </div>

              {/* Bulk actions */}
              {selectedResources.length > 0 && (
                <div className="bg-accent border border-accent-foreground/20 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {selectedResources.length} resource{selectedResources.length !== 1 ? 's' : ''} selected
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      <button className="azure-button-secondary text-sm flex items-center space-x-1">
                        <Play size={14} />
                        <span>Start</span>
                      </button>
                      <button className="azure-button-secondary text-sm flex items-center space-x-1">
                        <Square size={14} />
                        <span>Stop</span>
                      </button>
                      <button className="azure-button-secondary text-sm flex items-center space-x-1">
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-card rounded-lg border border-card-border overflow-hidden">
                <table className="azure-table">
                  <thead>
                    <tr>
                      <th className="w-12">
                        <input
                          type="checkbox"
                          className="rounded"
                        />
                      </th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Location</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map((resource) => (
                      <tr 
                        key={resource.id}
                        className="cursor-pointer"
                        onClick={() => handleResourceClick(resource)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedResources.includes(resource.id)}
                            onChange={(e) => handleSelectResource(resource.id, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-primary rounded-sm flex-shrink-0"></div>
                            <span className="text-primary hover:underline">{resource.name}</span>
                          </div>
                        </td>
                        <td className="text-foreground-secondary">{resource.type}</td>
                        <td>
                          <span className={`text-sm ${getStatusColor(resource.status)}`}>
                            {resource.status}
                          </span>
                        </td>
                        <td className="text-foreground-secondary">{resource.location}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <button className="p-1 hover:bg-secondary rounded transition-colors">
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {resources.length === 0 && (
                  <div className="text-center py-8 text-foreground-secondary">
                    <p className="mb-4">This resource group is empty</p>
                    <button
                      onClick={handleAddResource}
                      className="azure-button-primary"
                    >
                      Add a resource
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'overview' && (
          <div className="text-center py-12">
            <p className="text-foreground-secondary">
              {tabs.find(t => t.id === activeTab)?.label} content would be implemented here in a full version.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceGroupDetail;