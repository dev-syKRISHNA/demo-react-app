// Mock data for Cognior Portal (Azure Portal replica)

export interface Resource {
  id: string;
  name: string;
  type: string;
  resourceGroup: string;
  location: string;
  subscription: string;
  status: 'Running' | 'Stopped' | 'Failed' | 'Deploying';
  lastViewed: string;
  tags: Record<string, string>;
  isFavorite: boolean;
}

export interface ResourceGroup {
  id: string;
  name: string;
  subscription: string;
  location: string;
  resourceCount: number;
  status: 'Active' | 'Failed' | 'Deleting';
  lastModified: string;
  tags: Record<string, string>;
}

export interface Subscription {
  id: string;
  name: string;
  subscriptionId: string;
  status: 'Active' | 'Disabled' | 'Deleted';
  directory: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  services: AzureService[];
}

export interface AzureService {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  popular: boolean;
  featured: boolean;
  tags: string[];
}

// Mock Subscriptions
export const mockSubscriptions: Subscription[] = [
  {
    id: '1',
    name: 'Cognior Enterprise',
    subscriptionId: '12345678-1234-1234-1234-123456789012',
    status: 'Active',
    directory: 'Default Directory (RAKS777G...)'
  },
  {
    id: '2',
    name: 'Azure for Students',
    subscriptionId: '87654321-4321-4321-4321-210987654321',
    status: 'Active',
    directory: 'Default Directory (RAKS777G...)'
  }
];

// Mock Resource Groups
export const mockResourceGroups: ResourceGroup[] = [
  {
    id: '1',
    name: 'Analytics',
    subscription: 'Cognior Enterprise',
    location: 'East US',
    resourceCount: 8,
    status: 'Active',
    lastModified: 'a few seconds ago',
    tags: { environment: 'production', project: 'analytics' }
  },
  {
    id: '2',
    name: 'CogniorAnalytics',
    subscription: 'Cognior Enterprise',
    location: 'West US 2', 
    resourceCount: 12,
    status: 'Active',
    lastModified: '2 weeks ago',
    tags: { environment: 'development', team: 'cognior' }
  },
  {
    id: '3',
    name: 'DefaultResourceGroup-EUS',
    subscription: 'Azure for Students',
    location: 'East US',
    resourceCount: 3,
    status: 'Active',
    lastModified: '1 month ago',
    tags: { created: 'auto', purpose: 'default' }
  }
];

// Mock Resources
export const mockResources: Resource[] = [
  {
    id: '1',
    name: 'Analytics',
    type: 'Resource group',
    resourceGroup: '',
    location: 'East US',
    subscription: 'Cognior Enterprise',
    status: 'Running',
    lastViewed: 'a few seconds ago',
    tags: { environment: 'production' },
    isFavorite: true
  },
  {
    id: '2',
    name: 'analyticsdb',
    type: 'SQL database',
    resourceGroup: 'Analytics',
    location: 'East US',
    subscription: 'Cognior Enterprise',
    status: 'Running',
    lastViewed: '2 weeks ago',
    tags: { tier: 'standard' },
    isFavorite: false
  },
  {
    id: '3',
    name: 'CogniorAnalytics',
    type: 'Function App',
    resourceGroup: 'CogniorAnalytics',
    location: 'West US 2',
    subscription: 'Cognior Enterprise',
    status: 'Running',
    lastViewed: '3 weeks ago',
    tags: { runtime: 'dotnet' },
    isFavorite: false
  },
  {
    id: '4',
    name: 'cognioranalyticssadls',
    type: 'Storage account',
    resourceGroup: 'CogniorAnalytics',
    location: 'West US 2',
    subscription: 'Cognior Enterprise',
    status: 'Running',
    lastViewed: '3 weeks ago',
    tags: { replication: 'LRS' },
    isFavorite: false
  },
  {
    id: '5',
    name: 'cognior-analytics',
    type: 'Synapse workspace',
    resourceGroup: 'Analytics',
    location: 'East US',
    subscription: 'Cognior Enterprise',
    status: 'Running',
    lastViewed: 'a month ago',
    tags: { environment: 'production' },
    isFavorite: false
  },
  {
    id: '6',
    name: 'cognior-analytics-usmi',
    type: 'Managed Identity',
    resourceGroup: 'Analytics',
    location: 'East US',
    subscription: 'Cognior Enterprise',
    status: 'Running',
    lastViewed: 'a month ago',
    tags: { type: 'system-assigned' },
    isFavorite: false
  },
  {
    id: '7',
    name: 'cognior-analytics-sql',
    type: 'SQL server',
    resourceGroup: 'Analytics',
    location: 'East US',
    subscription: 'Cognior Enterprise',
    status: 'Running',
    lastViewed: 'a month ago',
    tags: { version: '12.0' },
    isFavorite: false
  },
  {
    id: '8',
    name: 'Cognior Enterprise',
    type: 'Subscription',
    resourceGroup: '',
    location: 'Global',
    subscription: 'Cognior Enterprise',
    status: 'Running',
    lastViewed: '2 months ago',
    tags: {},
    isFavorite: false
  }
];

// Mock Azure Services
export const mockAzureServices: AzureService[] = [
  {
    id: '1',
    name: 'Function App',
    description: 'Create serverless functions',
    category: 'Compute',
    icon: 'Zap',
    popular: true,
    featured: true,
    tags: ['serverless', 'compute', 'functions']
  },
  {
    id: '2',
    name: 'Web App',
    description: 'Create and deploy web applications',
    category: 'Compute',
    icon: 'Globe',
    popular: true,
    featured: true,
    tags: ['web', 'app service', 'hosting']
  },
  {
    id: '3',
    name: 'Virtual network',
    description: 'Create isolated network environments',
    category: 'Networking',
    icon: 'Network',
    popular: true,
    featured: false,
    tags: ['networking', 'vnet', 'isolation']
  },
  {
    id: '4',
    name: 'Key Vault',
    description: 'Secure key and secret management',
    category: 'Security',
    icon: 'Key',
    popular: true,
    featured: false,
    tags: ['security', 'keys', 'secrets']
  },
  {
    id: '5',
    name: 'Virtual machine',
    description: 'Create virtual machines in the cloud',
    category: 'Compute',
    icon: 'Monitor',
    popular: true,
    featured: true,
    tags: ['vm', 'compute', 'iaas']
  },
  {
    id: '6',
    name: 'Storage account',
    description: 'Scalable cloud storage solution',
    category: 'Storage',
    icon: 'Database',
    popular: true,
    featured: true,
    tags: ['storage', 'blob', 'files']
  },
  {
    id: '7',
    name: 'Data Factory',
    description: 'Data integration service',
    category: 'Analytics',
    icon: 'Factory',
    popular: true,
    featured: false,
    tags: ['etl', 'data', 'integration']
  },
  {
    id: '8',
    name: 'Logic App',
    description: 'Workflow automation service',
    category: 'Integration',
    icon: 'GitBranch',
    popular: false,
    featured: false,
    tags: ['workflow', 'automation', 'logic']
  },
  {
    id: '9',
    name: 'SQL Database',
    description: 'Managed SQL database service',
    category: 'Databases',
    icon: 'Database',
    popular: true,
    featured: true,
    tags: ['sql', 'database', 'managed']
  },
  {
    id: '10',
    name: 'Cosmos DB',
    description: 'Globally distributed NoSQL database',
    category: 'Databases',
    icon: 'Database',
    popular: true,
    featured: true,
    tags: ['nosql', 'cosmosdb', 'global']
  }
];

// Service Categories
export const serviceCategories: ServiceCategory[] = [
  {
    id: 'compute',
    name: 'Compute',
    services: mockAzureServices.filter(s => s.category === 'Compute')
  },
  {
    id: 'networking',
    name: 'Networking',
    services: mockAzureServices.filter(s => s.category === 'Networking')
  },
  {
    id: 'storage',
    name: 'Storage',
    services: mockAzureServices.filter(s => s.category === 'Storage')
  },
  {
    id: 'databases',
    name: 'Databases',
    services: mockAzureServices.filter(s => s.category === 'Databases')
  },
  {
    id: 'analytics',
    name: 'Analytics',
    services: mockAzureServices.filter(s => s.category === 'Analytics')
  },
  {
    id: 'security',
    name: 'Security',
    services: mockAzureServices.filter(s => s.category === 'Security')
  },
  {
    id: 'integration',
    name: 'Integration',
    services: mockAzureServices.filter(s => s.category === 'Integration')
  }
];

// Popular services for quick access
export const popularServices = mockAzureServices.filter(s => s.popular);
export const featuredServices = mockAzureServices.filter(s => s.featured);

// Analytics Events for DAP instrumentation
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // In a real implementation, this would send to analytics service
  console.log(`[DAP Analytics] ${eventName}`, properties);
};

// Common event types
export const AnalyticsEvents = {
  // Timing
  TIMER_START: 'timer_start',
  TIMER_END: 'timer_end',
  // Navigation
  PAGE_VIEW: 'page_view',
  NAVIGATION_CLICK: 'navigation_click',
  BREADCRUMB_CLICK: 'breadcrumb_click',
  
  // Search
  SEARCH_QUERY: 'search_query',
  SEARCH_RESULT_CLICK: 'search_result_click',
  
  // Resource Management
  RESOURCE_CREATE_START: 'resource_create_start',
  RESOURCE_CREATE_STEP: 'resource_create_step',
  RESOURCE_CREATE_COMPLETE: 'resource_create_complete',
  RESOURCE_CREATE_CANCEL: 'resource_create_cancel',
  RESOURCE_CREATE_ERROR: 'resource_create_error',
  
  // Form Interactions
  FORM_FIELD_FOCUS: 'form_field_focus',
  FORM_FIELD_BLUR: 'form_field_blur',
  FORM_VALIDATION_ERROR: 'form_validation_error',
  FORM_SUBMIT: 'form_submit',
  FORM_CANCEL: 'form_cancel',
  
  // Resource Actions
  RESOURCE_VIEW: 'resource_view',
  RESOURCE_FAVORITE: 'resource_favorite',
  RESOURCE_DELETE: 'resource_delete',
  RESOURCE_START: 'resource_start',
  RESOURCE_STOP: 'resource_stop',
  
  // Marketplace
  MARKETPLACE_OPEN: 'marketplace_open',
  MARKETPLACE_CATEGORY_CLICK: 'marketplace_category_click',
  MARKETPLACE_SERVICE_CLICK: 'marketplace_service_click',
  
  // Help & Support
  HELP_TOOLTIP_VIEW: 'help_tooltip_view',
  HELP_COPILOT_OPEN: 'help_copilot_open',
  HELP_DOCUMENTATION_CLICK: 'help_documentation_click',
  
  // Onboarding
  ONBOARDING_START: 'onboarding_start',
  ONBOARDING_STEP_COMPLETE: 'onboarding_step_complete',
  ONBOARDING_SKIP: 'onboarding_skip',
  ONBOARDING_COMPLETE: 'onboarding_complete'
} as const;