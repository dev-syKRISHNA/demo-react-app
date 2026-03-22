import { mockResourceGroups, mockSubscriptions } from './mockData';

export type FieldType = 'text' | 'select' | 'radio' | 'toggle' | 'textarea' | 'number';

export type FieldOption = {
  label: string;
  value: string;
  description?: string;
  badge?: string;
};

export type FieldValidation = {
  message: string;
  test: (value: any, formState: Record<string, any>) => boolean;
};

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helper?: string;
  tooltip?: string;
  suffix?: string;
  min?: number;
  max?: number;
  required?: boolean;
  options?: FieldOption[];
  dataSource?: 'subscriptions' | 'resourceGroups';
  multiple?: boolean;
  validation?: FieldValidation[];
}

export interface WizardSection {
  id: string;
  title: string;
  description?: string;
  fields: FieldDefinition[];
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  sections: WizardSection[];
}

export type CreateAction =
  | 'resourceGroup'
  | 'storageAccount'
  | 'functionApp'
  | 'sqlDatabase'
  | 'virtualMachine'
  | 'webApp'
  | 'keyVault'
  | 'cosmosDb'
  | 'virtualNetwork'
  | 'dataFactory'
  | 'logicApp'
  | 'managedDisk';

export interface SummaryField {
  label: string;
  field: string;
}

export interface CreateBlueprint {
  id: string;
  title: string;
  route: string;
  icon: string;
  category: string;
  description: string;
  steps: WizardStep[];
  defaultValues: Record<string, any>;
  summaryFields: SummaryField[];
  action: CreateAction;
  successPath: string;
  resourceType: string;
}

const regions = [
  '(Asia Pacific) Central India',
  '(Asia Pacific) Southeast Asia',
  '(Europe) West Europe',
  '(Europe) North Europe',
  '(Americas) East US',
  '(Americas) West US 2',
];

export const createBlueprints: Record<string, CreateBlueprint> = {
  'resource-group': {
    id: 'resource-group',
    route: 'resource-group',
    icon: 'Layers',
    category: 'Management',
    title: 'Resource group',
    description: 'Organize Cognior resources into a logical container.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroupName: '',
      region: '(Americas) East US',
      managedBy: '',
      tagsEnvironment: 'production',
      tagsOwner: 'team-cognior',
      lockType: 'Not locked',
      inheritTags: false,
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            description:
              'Choose the subscription and region for this new resource group.',
            fields: [
              {
                id: 'subscription',
                label: 'Subscription',
                type: 'select',
                dataSource: 'subscriptions',
                required: true,
              },
              {
                id: 'resourceGroupName',
                label: 'Resource group',
                type: 'text',
                placeholder: 'my-resource-group',
                helper: 'Use alphanumeric characters, hyphen, or underscore.',
                required: true,
                validation: [
                  {
                    message: 'Name must be between 1 and 90 characters.',
                    test: (value) =>
                      typeof value === 'string' &&
                      value.length > 0 &&
                      value.length <= 90,
                  },
                ],
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
            ],
          },
          {
            id: 'management',
            title: 'Management',
            fields: [
              {
                id: 'managedBy',
                label: 'Managed by (optional)',
                type: 'text',
                placeholder: 'mailto:owner@cognior.cloud',
              },
            ],
          },
        ],
      },
      {
        id: 'hosting',
        title: 'Hosting options',
        description: 'Select the Cognior Functions hosting plan that aligns with your workload and networking requirements.',
        sections: [
          {
            id: 'planSelector',
            title: 'Select a hosting option',
            fields: [
              {
                id: 'hostingPlanChoice',
                label: 'Hosting plan',
                type: 'radio',
                options: [
                  {
                    label: 'Flex Consumption',
                    value: 'Flex Consumption',
                    description: 'Scales to 1000 instances, supports virtual networking, pay-as-you-go billing.',
                  },
                  {
                    label: 'Functions Premium',
                    value: 'Functions Premium',
                    description: 'Event-driven scaling with dedicated compute and advanced networking.',
                  },
                  {
                    label: 'App Service',
                    value: 'App Service',
                    description: 'Run Cognior Functions alongside web apps with metrics-based scaling.',
                  },
                  {
                    label: 'Container Apps environment',
                    value: 'Container Apps environment',
                    description: 'Host containerized microservices with KEDA-driven scaling.',
                  },
                  {
                    label: 'Consumption',
                    value: 'Consumption',
                    description: 'Classic pay-per-execution model without VNet integration.',
                  },
                ],
                required: true,
              },
            ],
          },
          {
            id: 'planCapabilities',
            title: 'Plan capabilities',
            fields: [
              { id: 'scaleToZero', label: 'Scale to zero supported', type: 'toggle' },
              { id: 'planVirtualNetworking', label: 'Virtual networking available', type: 'toggle' },
              { id: 'planDedicated', label: 'Dedicated compute required', type: 'toggle' },
              {
                id: 'planMaxInstances',
                label: 'Maximum scale-out (instances)',
                type: 'number',
                min: 1,
                max: 5000,
              },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            description: 'Apply metadata to help organize your inventory.',
            fields: [
              {
                id: 'tagsEnvironment',
                label: 'Environment',
                type: 'select',
                options: [
                  { label: 'production', value: 'production' },
                  { label: 'staging', value: 'staging' },
                  { label: 'dev', value: 'dev' },
                ],
                required: true,
              },
              {
                id: 'tagsOwner',
                label: 'Owner',
                type: 'text',
                placeholder: 'team-cognior',
              },
            ],
          },
        ],
      },
      {
        id: 'advanced',
        title: 'Advanced',
        sections: [
          {
            id: 'locks',
            title: 'Resource locks',
            description: 'Prevent accidental deletion or modification.',
            fields: [
              {
                id: 'lockType',
                label: 'Lock type',
                type: 'select',
                options: [
                  { label: 'Not locked', value: 'Not locked' },
                  { label: 'Read-only', value: 'ReadOnly' },
                  { label: 'Delete', value: 'CanNotDelete' },
                ],
              },
            ],
          },
          {
            id: 'inheritance',
            title: 'Tag inheritance',
            fields: [
              {
                id: 'inheritTags',
                label: 'Inherit tags from subscription',
                type: 'toggle',
              },
            ],
          },
        ],
      },
      {
        id: 'review',
        title: 'Review + create',
        sections: [],
      },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroupName' },
      { label: 'Region', field: 'region' },
      { label: 'Environment', field: 'tagsEnvironment' },
      { label: 'Lock', field: 'lockType' },
      { label: 'Inherit tags', field: 'inheritTags' },
    ],
    action: 'resourceGroup',
    successPath: '/resource-groups',
    resourceType: 'Resource group',
  },
  'storage-account': {
    id: 'storage-account',
    route: 'storage-account',
    icon: 'Database',
    category: 'Storage',
    title: 'Storage account',
    description: 'Durable, highly available storage for any workload.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      storageAccountName: '',
      region: '(Asia Pacific) Central India',
      performance: 'Standard',
      redundancy: 'GRS',
      accessTier: 'Hot',
      networkAccess: 'Public endpoint (all networks)',
      privateEndpoint: false,
      firewallIp: '',
      softDeleteDays: 7,
      blobVersioning: true,
      requireSecureTransfer: true,
      tagsEnvironment: 'production',
      infrastructureEncryption: true,
      cmkEncryption: false,
      directoryEncryption: 'Microsoft-managed keys',
      enableManagedIdentity: false,
      identityType: 'System-assigned',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              {
                id: 'subscription',
                label: 'Subscription',
                type: 'select',
                dataSource: 'subscriptions',
                required: true,
              },
              {
                id: 'resourceGroup',
                label: 'Resource group',
                type: 'select',
                dataSource: 'resourceGroups',
                required: true,
              },
              {
                id: 'storageAccountName',
                label: 'Storage account name',
                type: 'text',
                placeholder: 'cogniorstorage001',
                helper:
                  'Name must be globally unique, 3-24 lowercase letters and numbers.',
                required: true,
                validation: [
                  {
                    message: 'Name must be 3-24 lowercase letters or numbers.',
                    test: (value) => /^[a-z0-9]{3,24}$/.test(String(value || '')),
                  },
                ],
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
            ],
          },
          {
            id: 'performance',
            title: 'Performance',
            fields: [
              {
                id: 'performance',
                label: 'Performance',
                type: 'radio',
                options: [
                  { label: 'Standard', value: 'Standard', description: 'General purpose v2' },
                  { label: 'Premium', value: 'Premium', description: 'Low latency workloads' },
                ],
                required: true,
              },
              {
                id: 'redundancy',
                label: 'Redundancy',
                type: 'select',
                options: [
                  { label: 'Locally redundant (LRS)', value: 'LRS' },
                  { label: 'Zone redundant (ZRS)', value: 'ZRS' },
                  { label: 'Geo-redundant (GRS)', value: 'GRS' },
                  { label: 'Geo-zone redundant (GZRS)', value: 'GZRS' },
                ],
                required: true,
              },
              {
                id: 'accessTier',
                label: 'Access tier (default)',
                type: 'radio',
                options: [
                  { label: 'Hot', value: 'Hot' },
                  { label: 'Cool', value: 'Cool' },
                ],
                required: true,
              },
            ],
          },
        ],
      },
      {
        id: 'networking',
        title: 'Networking',
        sections: [
          {
            id: 'connectivity',
            title: 'Connectivity',
            fields: [
              {
                id: 'networkAccess',
                label: 'Public network access',
                type: 'select',
                options: [
                  {
                    label: 'Public endpoint (all networks)',
                    value: 'Public endpoint (all networks)',
                  },
                  {
                    label: 'Public endpoint (selected networks)',
                    value: 'Public endpoint (selected networks)',
                  },
                  { label: 'Disable public access', value: 'Disable public access' },
                ],
                required: true,
              },
              {
                id: 'privateEndpoint',
                label: 'Enable private endpoint',
                type: 'toggle',
              },
              {
                id: 'firewallIp',
                label: 'Firewall allow list',
                type: 'text',
                placeholder: '0.0.0.0/0',
              },
            ],
          },
        ],
      },
      {
        id: 'security',
        title: 'Security + encryption',
        sections: [
          {
            id: 'encryption',
            title: 'Encryption',
            fields: [
              {
                id: 'infrastructureEncryption',
                label: 'Enable infrastructure encryption',
                type: 'toggle',
              },
              {
                id: 'cmkEncryption',
                label: 'Use customer-managed keys',
                type: 'toggle',
              },
              {
                id: 'directoryEncryption',
                label: 'Directory service encryption type',
                type: 'select',
                options: [
                  { label: 'Microsoft-managed keys', value: 'Microsoft-managed keys' },
                  { label: 'Customer-managed keys', value: 'Customer-managed keys' },
                ],
              },
            ],
          },
          {
            id: 'identity',
            title: 'Identity',
            fields: [
              {
                id: 'enableManagedIdentity',
                label: 'Enable managed identity',
                type: 'toggle',
              },
              {
                id: 'identityType',
                label: 'Identity type',
                type: 'select',
                options: [
                  { label: 'System-assigned', value: 'System-assigned' },
                  { label: 'User-assigned', value: 'User-assigned' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'dataProtection',
        title: 'Data protection',
        sections: [
          {
            id: 'recovery',
            title: 'Recovery',
            fields: [
              {
                id: 'softDeleteDays',
                label: 'Soft delete retention (days)',
                type: 'number',
                min: 1,
                max: 365,
                suffix: 'days',
              },
              {
                id: 'blobVersioning',
                label: 'Enable blob versioning',
                type: 'toggle',
              },
              {
                id: 'requireSecureTransfer',
                label: 'Require secure transfer for REST API operations',
                type: 'toggle',
              },
            ],
          },
          {
            id: 'restore',
            title: 'Point-in-time restore',
            fields: [
              {
                id: 'enablePointInTimeRestore',
                label: 'Enable point-in-time restore for containers',
                type: 'toggle',
              },
              {
                id: 'restoreDays',
                label: 'Restore retention (days)',
                type: 'number',
                min: 1,
                max: 30,
                suffix: 'days',
              },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            fields: [
              {
                id: 'tagsEnvironment',
                label: 'Environment',
                type: 'select',
                options: [
                  { label: 'production', value: 'production' },
                  { label: 'staging', value: 'staging' },
                  { label: 'dev', value: 'dev' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'review',
        title: 'Review + create',
        sections: [],
      },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Name', field: 'storageAccountName' },
      { label: 'Region', field: 'region' },
      { label: 'Performance', field: 'performance' },
      { label: 'Redundancy', field: 'redundancy' },
      { label: 'Encryption', field: 'directoryEncryption' },
      { label: 'Managed identity', field: 'enableManagedIdentity' },
    ],
    action: 'storageAccount',
    successPath: '/storage-accounts',
    resourceType: 'Storage account',
  },
  'function-app': {
    id: 'function-app',
    route: 'function-app',
    icon: 'Zap',
    category: 'Compute',
    title: 'Function App',
    description: 'Serverless compute for event-driven apps.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      appName: '',
      region: '(Americas) East US',
      runtimeStack: 'Node.js',
      runtimeVersion: '20 LTS',
      os: 'Linux',
      hostingPlanChoice: 'Flex Consumption',
      hostingPlan: 'Consumption (serverless)',
      instanceSize: 'Flex small',
      scaleToZero: true,
      planVirtualNetworking: true,
      planDedicated: false,
      planMaxInstances: 1000,
      zoneRedundancy: 'Disabled',
      storageAccount: 'Create new',
      enableAppInsights: true,
      insightsRegion: '(Americas) East US',
      applicationInsightsName: 'Auto generate',
      enableVnetIntegration: false,
      subnetIntegration: '',
      enableAccessRestrictions: false,
      allowedIps: '',
      enableDeploymentSlots: false,
      deploymentSlotName: 'staging',
      appLogsEnabled: true,
      ftpState: 'FTPS only',
      tagsEnvironment: 'dev',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              {
                id: 'subscription',
                label: 'Subscription',
                type: 'select',
                dataSource: 'subscriptions',
                required: true,
              },
              {
                id: 'resourceGroup',
                label: 'Resource group',
                type: 'select',
                dataSource: 'resourceGroups',
                required: true,
              },
              {
                id: 'appName',
                label: 'Function app name',
                type: 'text',
                placeholder: 'cognior-fn-app',
                required: true,
                validation: [
                  {
                    message: 'Name must be 2-60 characters and unique.',
                    test: (value) =>
                      typeof value === 'string' &&
                      value.length >= 2 &&
                      value.length <= 60,
                  },
                ],
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
              {
                id: 'instanceSize',
                label: 'Instance size',
                type: 'select',
                options: [
                  { label: 'Flex small', value: 'Flex small' },
                  { label: 'Flex medium', value: 'Flex medium' },
                  { label: 'Flex large', value: 'Flex large' },
                ],
              },
              {
                id: 'zoneRedundancy',
                label: 'Zone redundancy',
                type: 'radio',
                options: [
                  { label: 'Enabled', value: 'Enabled' },
                  { label: 'Disabled', value: 'Disabled' },
                ],
              },
            ],
          },
          {
            id: 'runtime',
            title: 'Runtime stack',
            fields: [
              {
                id: 'runtimeStack',
                label: 'Runtime stack',
                type: 'select',
                options: [
                  { label: 'Node.js', value: 'Node.js' },
                  { label: '.NET', value: '.NET' },
                  { label: 'Python', value: 'Python' },
                  { label: 'Java', value: 'Java' },
                ],
              },
              {
                id: 'runtimeVersion',
                label: 'Runtime version',
                type: 'select',
                options: [
                  { label: '20 LTS', value: '20 LTS' },
                  { label: '18 LTS', value: '18 LTS' },
                  { label: '16 LTS', value: '16 LTS' },
                ],
              },
              {
                id: 'os',
                label: 'Operating system',
                type: 'radio',
                options: [
                  { label: 'Linux', value: 'Linux' },
                  { label: 'Windows', value: 'Windows' },
                ],
              },
            ],
          },
          {
            id: 'hosting',
            title: 'Hosting plan',
            fields: [
              {
                id: 'hostingPlan',
                label: 'Plan type',
                type: 'select',
                options: [
                  { label: 'Consumption (serverless)', value: 'Consumption (serverless)' },
                  { label: 'Premium (elastic)', value: 'Premium (elastic)' },
                  { label: 'App Service Plan', value: 'App Service Plan' },
                ],
              },
              {
                id: 'storageAccount',
                label: 'Storage account',
                type: 'select',
                options: [
                  { label: 'Create new', value: 'Create new' },
                  { label: 'Use existing', value: 'Use existing' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        sections: [
          {
            id: 'insights',
            title: 'Application Insights',
            fields: [
              {
                id: 'enableAppInsights',
                label: 'Enable App Insights',
                type: 'toggle',
              },
              {
                id: 'applicationInsightsName',
                label: 'Application Insights resource',
                type: 'text',
                placeholder: 'Auto generate',
              },
              {
                id: 'insightsRegion',
                label: 'Insights region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
              },
            ],
          },
          {
            id: 'diagnostics',
            title: 'Diagnostics logs',
            fields: [
              { id: 'appLogsEnabled', label: 'Enable application logging', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'networking',
        title: 'Networking',
        sections: [
          {
            id: 'vnet',
            title: 'VNet integration',
            fields: [
              { id: 'enableVnetIntegration', label: 'Enable VNet integration', type: 'toggle' },
              { id: 'subnetIntegration', label: 'Integration subnet', type: 'text', placeholder: 'subnet-apps' },
            ],
          },
          {
            id: 'accessRestrictions',
            title: 'Access restrictions',
            fields: [
              { id: 'enableAccessRestrictions', label: 'Use access restriction rules', type: 'toggle' },
              { id: 'allowedIps', label: 'Allowed IP ranges', type: 'text', placeholder: '10.0.0.0/24' },
            ],
          },
        ],
      },
      {
        id: 'deployment',
        title: 'Deployment slots',
        sections: [
          {
            id: 'slots',
            title: 'Slots',
            fields: [
              { id: 'enableDeploymentSlots', label: 'Enable deployment slots', type: 'toggle' },
              { id: 'deploymentSlotName', label: 'Slot name', type: 'text', placeholder: 'staging' },
            ],
          },
          {
            id: 'ftp',
            title: 'FTPS state',
            fields: [
              {
                id: 'ftpState',
                label: 'FTPS state',
                type: 'select',
                options: [
                  { label: 'All allowed', value: 'All allowed' },
                  { label: 'FTPS only', value: 'FTPS only' },
                  { label: 'Disabled', value: 'Disabled' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tags',
            description:
              'Tags are name/value pairs that enable you to categorise resources and view consolidated billing by applying the same tag to multiple Cognior resources and resource groups.',
            fields: [
              {
                id: 'vmTagsTable',
                label: 'Tags',
                type: 'text',
              },
            ],
          },
        ],
      },
      {
        id: 'review',
        title: 'Review + create',
        sections: [],
      },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Name', field: 'appName' },
      { label: 'Hosting plan', field: 'hostingPlanChoice' },
      { label: 'Runtime', field: 'runtimeStack' },
      { label: 'Plan', field: 'hostingPlan' },
      { label: 'Instance size', field: 'instanceSize' },
      { label: 'Zone redundancy', field: 'zoneRedundancy' },
      { label: 'VNet integration', field: 'enableVnetIntegration' },
      { label: 'App Insights', field: 'enableAppInsights' },
    ],
    action: 'functionApp',
    successPath: '/function-apps',
    resourceType: 'Function App',
  },
  'sql-database': {
    id: 'sql-database',
    route: 'sql-database',
    icon: 'Database',
    category: 'Databases',
    title: 'SQL database',
    description: 'Managed SQL with built-in intelligence.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      databaseName: '',
      serverName: 'cognior-sql',
      computeTier: 'Standard',
      serviceLevel: 'S2',
      zoneRedundant: false,
      backupRetention: 7,
      tagsEnvironment: 'production',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              {
                id: 'subscription',
                label: 'Subscription',
                type: 'select',
                dataSource: 'subscriptions',
                required: true,
              },
              {
                id: 'resourceGroup',
                label: 'Resource group',
                type: 'select',
                dataSource: 'resourceGroups',
                required: true,
              },
              {
                id: 'databaseName',
                label: 'Database name',
                type: 'text',
                placeholder: 'cognior-db',
                required: true,
              },
              {
                id: 'serverName',
                label: 'Server',
                type: 'text',
                placeholder: 'cognior-sql',
                helper: 'Specify an existing logical server or provide a new name.',
                required: true,
              },
            ],
          },
        ],
      },
      {
        id: 'computeStorage',
        title: 'Compute + storage',
        sections: [
          {
            id: 'tier',
            title: 'Service tier',
            fields: [
              {
                id: 'computeTier',
                label: 'Compute tier',
                type: 'select',
                options: [
                  { label: 'Basic', value: 'Basic' },
                  { label: 'Standard', value: 'Standard' },
                  { label: 'Premium', value: 'Premium' },
                  { label: 'Business critical', value: 'Business critical' },
                ],
              },
              {
                id: 'serviceLevel',
                label: 'Service objective (DTU)',
                type: 'select',
                options: [
                  { label: 'S0 (10 DTU)', value: 'S0' },
                  { label: 'S1 (20 DTU)', value: 'S1' },
                  { label: 'S2 (50 DTU)', value: 'S2' },
                  { label: 'S4 (100 DTU)', value: 'S4' },
                ],
              },
              {
                id: 'zoneRedundant',
                label: 'Zone redundant',
                type: 'toggle',
              },
            ],
          },
        ],
      },
      {
        id: 'backup',
        title: 'Backup',
        sections: [
          {
            id: 'policies',
            title: 'Retention',
            fields: [
              {
                id: 'backupRetention',
                label: 'Backup retention (days)',
                type: 'number',
                min: 7,
                max: 35,
                suffix: 'days',
              },
            ],
          },
        ],
      },
      {
        id: 'networking',
        title: 'Networking',
        sections: [
          {
            id: 'connectivity',
            title: 'Connectivity method',
            fields: [
              {
                id: 'connectionPolicy',
                label: 'Connectivity',
                type: 'select',
                options: [
                  { label: 'Public endpoint', value: 'Public' },
                  { label: 'Private endpoint', value: 'Private' },
                ],
              },
              {
                id: 'firewallStartIp',
                label: 'Firewall start IP',
                type: 'text',
                placeholder: '0.0.0.0',
              },
              {
                id: 'firewallEndIp',
                label: 'Firewall end IP',
                type: 'text',
                placeholder: '255.255.255.255',
              },
            ],
          },
        ],
      },
      {
        id: 'additionalSettings',
        title: 'Additional settings',
        sections: [
          {
            id: 'collation',
            title: 'Collation and data source',
            fields: [
              {
                id: 'collation',
                label: 'Collation',
                type: 'text',
                placeholder: 'SQL_Latin1_General_CP1_CI_AS',
              },
              {
                id: 'useExistingBackup',
                label: 'Use existing data',
                type: 'select',
                options: [
                  { label: 'None', value: 'None' },
                  { label: 'Backup', value: 'Backup' },
                  { label: 'Sample', value: 'Sample' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            fields: [
              {
                id: 'tagsEnvironment',
                label: 'Environment',
                type: 'select',
                options: [
                  { label: 'dev', value: 'dev' },
                  { label: 'test', value: 'test' },
                  { label: 'production', value: 'production' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'review',
        title: 'Review + create',
        sections: [],
      },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Database name', field: 'databaseName' },
      { label: 'Server', field: 'serverName' },
      { label: 'Tier', field: 'computeTier' },
      { label: 'Networking', field: 'connectionPolicy' },
      { label: 'Defender', field: 'enableDefender' },
    ],
    action: 'sqlDatabase',
    successPath: '/sql-databases',
    resourceType: 'SQL database',
  },
  'virtual-machine': {
    id: 'virtual-machine',
    route: 'virtual-machine',
    icon: 'Server',
    category: 'Compute',
    title: 'Virtual machine',
    description: 'Highly available, scalable compute instances.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      vmName: '',
      region: '(Americas) East US',
      availabilityOption: 'No infrastructure redundancy required',
      zoneOption: 'Self-selected zone',
      availabilityZone: 'Zone 1',
      securityType: 'Trusted launch',
      vmArchitecture: 'x64',
      image: 'Windows Server 2022 Datacenter: Cognior Edition',
      size: 'Standard_D2ds_v5',
      authenticationType: 'Password',
      username: 'cognioradmin',
      sshKeySource: 'Generate new key pair',
      sshKeyType: 'RSA',
      keyPairName: '',
      password: '',
      confirmPassword: '',
      inboundPorts: ['3389'],
      osDiskType: 'Premium SSD (locally-redundant storage)',
      enableUltraDisk: false,
      osDiskCaching: 'Read/write',
      tempDisk: 'Automatic',
      osDiskDeleteWithVm: true,
      osDiskKeyManagement: 'Platform-managed key',
      vnetName: 'default-vnet',
      subnetName: 'default',
      nicName: 'cognior-vm-nic',
      publicIp: 'Create new',
      acceleratedNetworking: true,
      loadBalancer: 'None',
      enableBootDiagnostics: true,
      enableGuestMonitoring: true,
      autoShutdown: false,
      autoShutdownTime: '1900',
      patchMode: 'ImageDefault',
      customData: '',
      tagsEnvironment: 'staging',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              {
                id: 'subscription',
                label: 'Subscription',
                type: 'select',
                dataSource: 'subscriptions',
                required: true,
              },
              {
                id: 'resourceGroup',
                label: 'Resource group',
                type: 'select',
                dataSource: 'resourceGroups',
                required: true,
              },
              {
                id: 'vmName',
                label: 'Virtual machine name',
                type: 'text',
                placeholder: 'cognior-vm',
                required: true,
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
              {
                id: 'availabilityOption',
                label: 'Availability options',
                type: 'select',
                options: [
                  { label: 'No infrastructure redundancy required', value: 'none' },
                  { label: 'Availability zone', value: 'zone' },
                  { label: 'Availability set', value: 'set' },
                ],
              },
            ],
          },
          {
            id: 'instance',
            title: 'Instance details',
            fields: [
              {
                id: 'availabilityZone',
                label: 'Availability zone',
                type: 'select',
                options: [
                  { label: 'Zone 1', value: 'Zone 1' },
                  { label: 'Zone 2', value: 'Zone 2' },
                  { label: 'Zone 3', value: 'Zone 3' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'imageSize',
        title: 'Image + size',
        sections: [
          {
            id: 'image',
            title: 'Image',
            fields: [
              {
                id: 'securityType',
                label: 'Security type',
                type: 'select',
                options: [
                  { label: 'Trusted launch virtual machines', value: 'Trusted launch' },
                  { label: 'Standard', value: 'Standard' },
                ],
              },
              {
                id: 'image',
                label: 'Image',
                type: 'select',
                options: [
                  { label: 'Windows Server 2022 Datacenter: Cognior Edition', value: 'Windows Server 2022 Datacenter: Cognior Edition' },
                  { label: 'Ubuntu Server 22.04 LTS', value: 'Ubuntu Server 22.04 LTS' },
                  { label: 'Red Hat Enterprise Linux 9.3', value: 'RHEL 9.3' },
                  { label: 'Cognior Linux 1.0', value: 'Cognior Linux 1.0' },
                ],
              },
              {
                id: 'vmArchitecture',
                label: 'VM architecture',
                type: 'radio',
                options: [
                  { label: 'Arm64', value: 'Arm64' },
                  { label: 'x64', value: 'x64' },
                ],
              },
              {
                id: 'runWithSpot',
                label: 'Run with Azure Spot discount',
                type: 'toggle',
              },
              {
                id: 'size',
                label: 'Size',
                type: 'select',
                options: [
                  { label: 'Standard_D2ds_v5 (2 vCPU, 8 GiB RAM)', value: 'Standard_D2ds_v5' },
                  { label: 'Standard_D4ds_v5 (4 vCPU, 16 GiB RAM)', value: 'Standard_D4ds_v5' },
                  { label: 'Standard_E4s_v5 (4 vCPU, 32 GiB RAM)', value: 'Standard_E4s_v5' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'disks',
        title: 'Disks',
        sections: [
          {
            id: 'diskEncryption',
            title: 'VM disk encryption',
            description:
              'Cognior disk encryption automatically protects your data stored on managed OS and data disks.',
            fields: [
              {
                id: 'encryptionAtHost',
                label: 'Encryption at host',
                type: 'toggle',
              },
            ],
          },
          {
            id: 'osDisk',
            title: 'OS disk',
            fields: [
              {
                id: 'osDiskType',
                label: 'OS disk type',
                type: 'select',
                options: [
                  { label: 'Premium SSD (LRS)', value: 'Premium SSD (locally-redundant storage)' },
                  { label: 'Standard SSD (LRS)', value: 'Standard SSD (LRS)' },
                  { label: 'Standard HDD (LRS)', value: 'Standard HDD (LRS)' },
                ],
              },
              {
                id: 'osDiskCaching',
                label: 'OS disk caching',
                type: 'select',
                options: [
                  { label: 'Read/write', value: 'Read/write' },
                  { label: 'Read-only', value: 'Read-only' },
                  { label: 'None', value: 'None' },
                ],
              },
              {
                id: 'enableUltraDisk',
                label: 'Enable Ultra Disk compatibility',
                type: 'toggle',
              },
              {
                id: 'osDiskDeleteWithVm',
                label: 'Delete with VM',
                type: 'toggle',
              },
              {
                id: 'osDiskKeyManagement',
                label: 'Key management',
                type: 'select',
                options: [
                  { label: 'Platform-managed key', value: 'Platform-managed key' },
                  { label: 'Customer-managed key', value: 'Customer-managed key' },
                ],
              },
            ],
          },
          {
            id: 'tempDisk',
            title: 'Temporary disk',
            fields: [
              {
                id: 'tempDisk',
                label: 'Temp disk settings',
                type: 'select',
                options: [
                  { label: 'Automatic', value: 'Automatic' },
                  { label: 'Customer-managed', value: 'Customer-managed' },
                ],
              },
            ],
          },
          {
            id: 'dataDisks',
            title: 'Data disks',
            description:
              'You can add and configure additional data disks for your virtual machine or attach existing disks.',
            fields: [
              {
                id: 'dataDisks',
                label: 'Data disks',
                type: 'text',
              },
            ],
          },
        ],
      },
      {
        id: 'admin',
        title: 'Administrator account',
        sections: [
          {
            id: 'credentials',
            title: 'Authentication',
            fields: [
              {
                id: 'authenticationType',
                label: 'Authentication type',
                type: 'radio',
                options: [
                  { label: 'Password', value: 'Password' },
                  { label: 'SSH public key', value: 'SSH public key' },
                ],
              },
              {
                id: 'username',
                label: 'Username',
                type: 'text',
                placeholder: 'cognioradmin',
                required: true,
              },
              {
                id: 'sshKeySource',
                label: 'SSH public key source',
                type: 'select',
                options: [
                  { label: 'Generate new key pair', value: 'Generate new key pair' },
                  { label: 'Use existing public key', value: 'Use existing public key' },
                ],
                validation: [
                  {
                    message: 'Select how you want to provide the SSH public key.',
                    test: (value, form) =>
                      form.authenticationType !== 'SSH public key' || !!value,
                  },
                ],
              },
              {
                id: 'sshKeyType',
                label: 'SSH key type',
                type: 'radio',
                options: [
                  { label: 'RSA', value: 'RSA' },
                  { label: 'Ed25519', value: 'Ed25519' },
                ],
                validation: [
                  {
                    message: 'Select an SSH key type.',
                    test: (value, form) =>
                      form.authenticationType !== 'SSH public key' || !!value,
                  },
                ],
              },
              {
                id: 'password',
                label: 'Password',
                type: 'text',
                placeholder: 'Enter a strong password',
                required: true,
                validation: [
                  {
                    message: 'Password must be at least 12 characters.',
                    test: (value) => typeof value === 'string' && value.length >= 12,
                  },
                ],
              },
              {
                id: 'confirmPassword',
                label: 'Confirm password',
                type: 'text',
                placeholder: 'Re-enter password',
                required: true,
                validation: [
                  {
                    message: 'Passwords must match.',
                    test: (value, form) => value === form.password,
                  },
                ],
              },
              {
                id: 'keyPairName',
                label: 'Key pair name',
                type: 'text',
                placeholder: 'Name the SSH public key',
                validation: [
                  {
                    message: 'Key pair name is required when using SSH public key authentication.',
                    test: (value, form) =>
                      form.authenticationType !== 'SSH public key' || !!value,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'networking',
        title: 'Networking',
        sections: [
          {
            id: 'networkInterfaces',
            title: 'Network interface',
            fields: [
              { id: 'nicName', label: 'NIC name', type: 'text', placeholder: 'cognior-vm-nic' },
              {
                id: 'vnetName',
                label: 'Virtual network',
                type: 'text',
                placeholder: 'default-vnet',
              },
              {
                id: 'subnetName',
                label: 'Subnet',
                type: 'text',
                placeholder: 'default',
              },
              {
                id: 'publicIp',
                label: 'Public IP',
                type: 'select',
                options: [
                  { label: 'Create new', value: 'Create new' },
                  { label: 'None', value: 'None' },
                ],
              },
              {
                id: 'acceleratedNetworking',
                label: 'Accelerated networking',
                type: 'toggle',
              },
            ],
          },
          {
            id: 'ports',
            title: 'Inbound ports',
            fields: [
              {
                id: 'inboundPorts',
                label: 'Select inbound ports',
                type: 'select',
                multiple: true,
                options: [
                  { label: 'RDP (3389)', value: '3389' },
                  { label: 'SSH (22)', value: '22' },
                  { label: 'HTTP (80)', value: '80' },
                  { label: 'HTTPS (443)', value: '443' },
                ],
                helper: 'Hold Ctrl/Cmd to select multiple.',
              },
            ],
          },
          {
            id: 'loadBalancing',
            title: 'Load balancing',
            fields: [
              {
                id: 'loadBalancer',
                label: 'Load balancing options',
                type: 'select',
                options: [
                  { label: 'None', value: 'None' },
                  { label: 'Application Gateway', value: 'Application Gateway' },
                  { label: 'Cognior Load Balancer', value: 'Load Balancer' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'management',
        title: 'Management',
        sections: [
          {
            id: 'diagnostics',
            title: 'Monitoring',
            fields: [
              {
                id: 'enableBootDiagnostics',
                label: 'Enable boot diagnostics',
                type: 'toggle',
              },
              {
                id: 'enableGuestMonitoring',
                label: 'Enable guest-level diagnostics',
                type: 'toggle',
              },
            ],
          },
          {
            id: 'autoShutdown',
            title: 'Auto-shutdown',
            fields: [
              { id: 'autoShutdown', label: 'Enable auto-shutdown', type: 'toggle' },
              { id: 'autoShutdownTime', label: 'Shutdown time (HHMM)', type: 'text', placeholder: '1900' },
            ],
          },
          {
            id: 'updates',
            title: 'Updates',
            fields: [
              {
                id: 'patchMode',
                label: 'Patch orchestration',
                type: 'select',
                options: [
                  { label: 'Image default', value: 'ImageDefault' },
                  { label: 'Automatic by Cognior', value: 'AutomaticByPlatform' },
                  { label: 'Automatic by OS', value: 'AutomaticByOS' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tags',
            description:
              'Tags are name/value pairs that enable you to categorise resources and view consolidated billing by applying the same tag to multiple Cognior resources and resource groups.',
            fields: [
              {
                id: 'vmTagsTable',
                label: 'Tags',
                type: 'text',
              },
            ],
          },
        ],
      },
      {
        id: 'advanced',
        title: 'Advanced',
        sections: [
          {
            id: 'extensions',
            title: 'Extensions',
            description:
              'Add additional configuration, agents, scripts or applications via virtual machine extensions or Cognior cloud-init.',
            fields: [
              {
                id: 'vmExtensions',
                label: 'Extensions',
                type: 'text',
                placeholder: 'Select a Cognior VM extension to install (demo only)',
              },
              {
                id: 'vmApplications',
                label: 'VM applications',
                type: 'text',
                placeholder: 'Select a VM application to install (demo only)',
              },
            ],
          },
          {
            id: 'userData',
            title: 'User data',
            description:
              'Pass a script, configuration file, or other data that will be accessible to your applications throughout the lifetime of the VM.',
            fields: [
              {
                id: 'enableUserData',
                label: 'Enable user data',
                type: 'toggle',
              },
              {
                id: 'customData',
                label: 'Custom data (base64)',
                type: 'textarea',
                placeholder: '#cloud-config...',
              },
            ],
          },
          {
            id: 'performanceNvme',
            title: 'Performance (NVMe)',
            description:
              'Enable capabilities to enhance the performance of your resources for supported VM sizes.',
            fields: [
              {
                id: 'enableNvme',
                label: 'Higher remote disk storage performance with NVMe',
                type: 'toggle',
              },
            ],
          },
          {
            id: 'host',
            title: 'Host',
            description:
              'Choose Cognior Dedicated Hosts to provision and manage a physical server where your VMs run.',
            fields: [
              {
                id: 'hostGroup',
                label: 'Host group',
                type: 'select',
                options: [
                  { label: 'No host groups found', value: 'None' },
                ],
              },
            ],
          },
          {
            id: 'capacityReservations',
            title: 'Capacity reservations',
            description:
              'Reserve capacity for your virtual machine to get the same SLA as normal VMs with capacity guaranteed ahead of time.',
            fields: [
              {
                id: 'capacityReservationGroup',
                label: 'Capacity reservation group',
                type: 'select',
                options: [
                  { label: 'None', value: 'None' },
                ],
              },
            ],
          },
          {
            id: 'proximityPlacement',
            title: 'Proximity placement group',
            description:
              'Group Cognior resources physically closer together in the same region to reduce latency.',
            fields: [
              {
                id: 'proximityPlacementGroup',
                label: 'Proximity placement group',
                type: 'select',
                options: [
                  { label: 'No proximity placement groups found', value: 'None' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'review',
        title: 'Review + create',
        sections: [],
      },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Virtual machine name', field: 'vmName' },
      { label: 'Region', field: 'region' },
      { label: 'Availability options', field: 'availabilityOption' },
      { label: 'Availability zone', field: 'availabilityZone' },
      { label: 'Virtual network', field: 'vnetName' },
      { label: 'Public IP', field: 'publicIp' },
      { label: 'Boot diagnostics', field: 'enableBootDiagnostics' },
      { label: 'Auto-shutdown', field: 'autoShutdown' },
    ],
    action: 'virtualMachine',
    successPath: '/virtual-machines',
    resourceType: 'Virtual machine',
  },
  'web-app': {
    id: 'web-app',
    route: 'web-app',
    icon: 'Globe',
    category: 'Compute',
    title: 'Web App',
    description: 'Modern web hosting with integrated deployment tooling.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      appName: '',
      publish: 'Code',
      runtimeStack: 'Node.js',
      runtimeVersion: '20 LTS',
      operatingSystem: 'Linux',
      plan: 'App Service Plan',
      planSku: 'P1v3',
      region: '(Americas) East US',
      deploymentSource: 'None',
      enableGitHub: false,
      enableAppInsights: true,
      insightsRegion: '(Americas) East US',
      appLogsEnabled: true,
      http2Enabled: true,
      websocketEnabled: false,
      tagsEnvironment: 'production',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              { id: 'subscription', label: 'Subscription', type: 'select', dataSource: 'subscriptions', required: true },
              { id: 'resourceGroup', label: 'Resource group', type: 'select', dataSource: 'resourceGroups', required: true },
              {
                id: 'appName',
                label: 'Name',
                type: 'text',
                placeholder: 'cognior-web',
                helper: 'Name must be unique within Cognior. Valid characters: a-z, 0-9, and -.',
                required: true,
                validation: [
                  {
                    message: 'Name must be 2-60 lowercase characters or numbers.',
                    test: (value) => typeof value === 'string' && /^[a-z0-9-]{2,60}$/.test(value),
                  },
                ],
              },
              {
                id: 'publish',
                label: 'Publish',
                type: 'radio',
                options: [
                  { label: 'Code', value: 'Code' },
                  { label: 'Container', value: 'Container' },
                ],
                required: true,
              },
              {
                id: 'runtimeStack',
                label: 'Runtime stack',
                type: 'select',
                options: [
                  { label: 'Node.js', value: 'Node.js' },
                  { label: '.NET', value: '.NET' },
                  { label: 'Python', value: 'Python' },
                  { label: 'Java', value: 'Java' },
                  { label: 'PHP', value: 'PHP' },
                ],
                required: true,
              },
              {
                id: 'runtimeVersion',
                label: 'Version',
                type: 'select',
                options: [
                  { label: '20 LTS', value: '20 LTS' },
                  { label: '18 LTS', value: '18 LTS' },
                  { label: '16 LTS', value: '16 LTS' },
                ],
              },
              {
                id: 'operatingSystem',
                label: 'Operating system',
                type: 'radio',
                options: [
                  { label: 'Linux', value: 'Linux' },
                  { label: 'Windows', value: 'Windows' },
                ],
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
            ],
          },
          {
            id: 'plan',
            title: 'App Service plan',
            fields: [
              {
                id: 'plan',
                label: 'Plan name',
                type: 'select',
                options: [
                  { label: 'Create new plan', value: 'App Service Plan' },
                  { label: 'Use existing plan', value: 'Existing plan' },
                ],
              },
              {
                id: 'planSku',
                label: 'Pricing tier',
                type: 'select',
                options: [
                  { label: 'Premium v3 P1v3', value: 'P1v3' },
                  { label: 'Standard S1', value: 'S1' },
                  { label: 'Basic B1', value: 'B1' },
                ],
                required: true,
              },
            ],
          },
        ],
      },
      {
        id: 'deployment',
        title: 'Deployment',
        sections: [
          {
            id: 'sourceControl',
            title: 'Source control',
            fields: [
              {
                id: 'deploymentSource',
                label: 'Deployment source',
                type: 'select',
                options: [
                  { label: 'None', value: 'None' },
                  { label: 'GitHub Actions', value: 'GitHub' },
                  { label: 'Azure Repos', value: 'Azure Repos' },
                ],
              },
              {
                id: 'enableGitHub',
                label: 'Configure GitHub Actions',
                type: 'toggle',
              },
            ],
          },
          {
            id: 'continuousDeployment',
            title: 'Continuous deployment',
            fields: [
              {
                id: 'deploymentSource',
                label: 'Deployment source',
                type: 'select',
                options: [
                  { label: 'None', value: 'None' },
                  { label: 'GitHub Actions', value: 'GitHub' },
                  { label: 'Azure DevOps', value: 'Azure Repos' },
                ],
              },
              { id: 'enableGitHub', label: 'Configure GitHub Actions', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'networking',
        title: 'Networking',
        sections: [
          {
            id: 'protocols',
            title: 'Ingress protocols',
            fields: [
              { id: 'http2Enabled', label: 'Enable HTTP/2', type: 'toggle' },
              { id: 'websocketEnabled', label: 'Enable WebSockets', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        sections: [
          {
            id: 'insights',
            title: 'Application Insights',
            fields: [
              { id: 'enableAppInsights', label: 'Enable Application Insights', type: 'toggle' },
              {
                id: 'insightsRegion',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
              },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            fields: [
              {
                id: 'tagsEnvironment',
                label: 'Environment',
                type: 'select',
                options: [
                  { label: 'production', value: 'production' },
                  { label: 'staging', value: 'staging' },
                  { label: 'dev', value: 'dev' },
                ],
              },
            ],
          },
        ],
      },
      { id: 'review', title: 'Review + create', sections: [] },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Web app name', field: 'appName' },
      { label: 'Publish', field: 'publish' },
      { label: 'Plan SKU', field: 'planSku' },
      { label: 'HTTP/2', field: 'http2Enabled' },
      { label: 'WebSockets', field: 'websocketEnabled' },
    ],
    action: 'webApp',
    successPath: '/app-services',
    resourceType: 'Web App',
  },
  'managed-disk': {
    id: 'managed-disk',
    route: 'managed-disk',
    icon: 'HardDrive',
    category: 'Storage',
    title: 'Managed disk',
    description: 'Durable block storage for Cognior virtual machines.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      diskName: '',
      region: '(Americas) East US',
      sizeGiB: 128,
      diskType: 'Premium SSD',
      keyManagement: 'Platform-managed key',
      sourceType: 'None (empty disk)',
      enableSharedDisk: false,
      deleteWithVm: false,
      tagsEnvironment: 'production',
      tagsOwner: 'team-cognior',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              {
                id: 'subscription',
                label: 'Subscription',
                type: 'select',
                dataSource: 'subscriptions',
                required: true,
              },
              {
                id: 'resourceGroup',
                label: 'Resource group',
                type: 'select',
                dataSource: 'resourceGroups',
                required: true,
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
            ],
          },
          {
            id: 'diskDetails',
            title: 'Disk details',
            fields: [
              {
                id: 'diskName',
                label: 'Disk name',
                type: 'text',
                placeholder: 'cognior-data-disk',
                required: true,
                validation: [
                  {
                    message: 'Name must be 1-80 characters and use letters, numbers, and -.',
                    test: (value) =>
                      typeof value === 'string' &&
                      value.length >= 1 &&
                      value.length <= 80,
                  },
                ],
              },
              {
                id: 'sourceType',
                label: 'Source type',
                type: 'select',
                options: [
                  { label: 'None (empty disk)', value: 'None (empty disk)' },
                  { label: 'Snapshot', value: 'Snapshot' },
                  { label: 'Existing disk', value: 'Existing disk' },
                ],
                required: true,
              },
              {
                id: 'sizeGiB',
                label: 'Size',
                type: 'number',
                min: 4,
                max: 32768,
                suffix: 'GiB',
                required: true,
              },
              {
                id: 'diskType',
                label: 'Disk type',
                type: 'select',
                options: [
                  { label: 'Premium SSD', value: 'Premium SSD' },
                  { label: 'Standard SSD', value: 'Standard SSD' },
                  { label: 'Standard HDD', value: 'Standard HDD' },
                ],
                required: true,
              },
              {
                id: 'keyManagement',
                label: 'Key management',
                type: 'select',
                options: [
                  { label: 'Platform-managed key', value: 'Platform-managed key' },
                  { label: 'Customer-managed key', value: 'Customer-managed key' },
                ],
              },
              {
                id: 'enableSharedDisk',
                label: 'Enable shared disk',
                type: 'toggle',
              },
              {
                id: 'deleteWithVm',
                label: 'Delete disk with VM',
                type: 'toggle',
              },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            fields: [
              {
                id: 'tagsEnvironment',
                label: 'Environment',
                type: 'select',
                options: [
                  { label: 'production', value: 'production' },
                  { label: 'staging', value: 'staging' },
                  { label: 'dev', value: 'dev' },
                ],
              },
              {
                id: 'tagsOwner',
                label: 'Owner',
                type: 'text',
                placeholder: 'team-cognior',
              },
            ],
          },
        ],
      },
      {
        id: 'review',
        title: 'Review + create',
        sections: [],
      },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Disk name', field: 'diskName' },
      { label: 'Region', field: 'region' },
      { label: 'Size', field: 'sizeGiB' },
      { label: 'Disk type', field: 'diskType' },
      { label: 'Key management', field: 'keyManagement' },
    ],
    action: 'managedDisk',
    successPath: '/disks',
    resourceType: 'Managed disk',
  },
  'key-vault': {
    id: 'key-vault',
    route: 'key-vault',
    icon: 'Key',
    category: 'Security',
    title: 'Key Vault',
    description: 'Safeguard keys, secrets, and certificates.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      vaultName: '',
      region: '(Americas) East US',
      pricingTier: 'Standard',
      softDelete: true,
      purgeProtection: true,
      accessModel: 'RBAC',
      enableRbacAzureAd: true,
      accessPolicyTenant: 'Default Directory',
      accessPolicyObjectId: '',
      secretPermissions: ['Get'],
      certificatePermissions: [],
      keyPermissions: [],
      publicNetworkAccess: 'Enabled from all networks',
      firewallBypass: 'AzureServices',
      firewallIpRanges: '',
      privateEndpointRequired: false,
      enableManagedHsm: false,
      tagsOwner: 'security-team',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              { id: 'subscription', label: 'Subscription', type: 'select', dataSource: 'subscriptions', required: true },
              { id: 'resourceGroup', label: 'Resource group', type: 'select', dataSource: 'resourceGroups', required: true },
              {
                id: 'vaultName',
                label: 'Key vault name',
                type: 'text',
                placeholder: 'cognior-vault',
                required: true,
                validation: [
                  {
                    message: 'Name must be 3-24 characters, only alphanumeric and -.',
                    test: (value) => typeof value === 'string' && /^[a-zA-Z0-9-]{3,24}$/.test(value),
                  },
                ],
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
            ],
          },
          {
            id: 'pricing',
            title: 'Pricing tier',
            fields: [
              {
                id: 'pricingTier',
                label: 'Tier',
                type: 'radio',
                options: [
                  { label: 'Standard', value: 'Standard', description: 'Best for most production workloads.' },
                  { label: 'Premium', value: 'Premium', description: 'Supports HSM backed keys.' },
                ],
                required: true,
              },
            ],
          },
        ],
      },
      {
        id: 'access',
        title: 'Access configuration',
        sections: [
          {
            id: 'rbac',
            title: 'Authorization',
            fields: [
              {
                id: 'accessModel',
                label: 'Permission model',
                type: 'radio',
                options: [
                  { label: 'Cognior RBAC', value: 'RBAC' },
                  { label: 'Vault access policy', value: 'AccessPolicy' },
                ],
              },
            ],
          },
          {
            id: 'policies',
            title: 'Access policies',
            description: 'Grant permissions to specific principals when not using RBAC.',
            fields: [
              {
                id: 'accessPolicyTenant',
                label: 'Azure AD tenant',
                type: 'text',
                placeholder: 'Default Directory',
              },
              {
                id: 'accessPolicyObjectId',
                label: 'Object ID',
                type: 'text',
                placeholder: '00000000-0000-0000-0000-000000000000',
              },
              {
                id: 'secretPermissions',
                label: 'Secret permissions',
                type: 'select',
                multiple: true,
                options: [
                  { label: 'Get', value: 'Get' },
                  { label: 'List', value: 'List' },
                  { label: 'Set', value: 'Set' },
                  { label: 'Delete', value: 'Delete' },
                ],
              },
              {
                id: 'certificatePermissions',
                label: 'Certificate permissions',
                type: 'select',
                multiple: true,
                options: [
                  { label: 'Get', value: 'Get' },
                  { label: 'List', value: 'List' },
                  { label: 'Create', value: 'Create' },
                ],
              },
              {
                id: 'keyPermissions',
                label: 'Key permissions',
                type: 'select',
                multiple: true,
                options: [
                  { label: 'Get', value: 'Get' },
                  { label: 'List', value: 'List' },
                  { label: 'Create', value: 'Create' },
                  { label: 'Delete', value: 'Delete' },
                ],
              },
            ],
          },
          {
            id: 'networking',
            title: 'Networking',
            fields: [
              {
                id: 'publicNetworkAccess',
                label: 'Public access',
                type: 'select',
                options: [
                  { label: 'Enabled from all networks', value: 'Enabled from all networks' },
                  { label: 'Enabled from selected networks', value: 'Enabled from selected networks' },
                  { label: 'Disabled', value: 'Disabled' },
                ],
              },
              {
                id: 'firewallBypass',
                label: 'Firewall exceptions',
                type: 'select',
                options: [
                  { label: 'Allow trusted Cognior services', value: 'AzureServices' },
                  { label: 'None', value: 'None' },
                ],
              },
              {
                id: 'firewallIpRanges',
                label: 'Firewall IP ranges',
                type: 'text',
                placeholder: '10.0.0.0/24,192.168.0.0/24',
              },
              {
                id: 'privateEndpointRequired',
                label: 'Require private endpoint',
                type: 'toggle',
              },
            ],
          },
        ],
      },
      {
        id: 'advanced',
        title: 'Advanced',
        sections: [
          {
            id: 'protection',
            title: 'Deletion protection',
            fields: [
              { id: 'softDelete', label: 'Enable soft-delete', type: 'toggle' },
              { id: 'purgeProtection', label: 'Enable purge protection', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'managedHsm',
        title: 'Managed HSM',
        sections: [
          {
            id: 'hsm',
            title: 'Hardware security modules',
            fields: [
              { id: 'enableManagedHsm', label: 'Enable managed HSM', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            fields: [
              { id: 'tagsOwner', label: 'Owner', type: 'text', placeholder: 'security-team' },
            ],
          },
        ],
      },
      { id: 'review', title: 'Review + create', sections: [] },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Vault name', field: 'vaultName' },
      { label: 'Tier', field: 'pricingTier' },
      { label: 'Soft delete', field: 'softDelete' },
      { label: 'Permission model', field: 'accessModel' },
      { label: 'Firewall', field: 'publicNetworkAccess' },
    ],
    action: 'keyVault',
    successPath: '/key-vaults',
    resourceType: 'Key Vault',
  },
  'cosmos-db': {
    id: 'cosmos-db',
    route: 'cosmos-db',
    icon: 'Database',
    category: 'Databases',
    title: 'Cosmos DB account',
    description: 'Globally distributed NoSQL with turnkey replication.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      accountName: '',
      api: 'Core (SQL)',
      region: '(Americas) East US',
      capacityMode: 'Provisioned throughput',
      throughput: 400,
      autoScale: false,
      autoScaleMaxThroughput: 4000,
      analyticalStore: true,
      enableFreeTier: false,
      enableMultiRegion: true,
      additionalRegions: ['(Europe) West Europe'],
      writeRegionFailover: false,
      consistency: 'Session',
      backupType: 'Periodic',
      backupInterval: 4,
      backupRetention: 8,
      defaultPriorityRegions: '',
      tagsEnvironment: 'production',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              { id: 'subscription', label: 'Subscription', type: 'select', dataSource: 'subscriptions', required: true },
              { id: 'resourceGroup', label: 'Resource group', type: 'select', dataSource: 'resourceGroups', required: true },
              {
                id: 'accountName',
                label: 'Account name',
                type: 'text',
                placeholder: 'cognior-cosmos',
                required: true,
                validation: [
                  {
                    message: 'Name must be between 3 and 44 lowercase characters.',
                    test: (value) => typeof value === 'string' && /^[a-z0-9-]{3,44}$/.test(value),
                  },
                ],
              },
              {
                id: 'api',
                label: 'API',
                type: 'select',
                options: [
                  { label: 'Core (SQL)', value: 'Core (SQL)' },
                  { label: 'MongoDB', value: 'MongoDB' },
                  { label: 'Cassandra', value: 'Cassandra' },
                  { label: 'Apache Gremlin', value: 'Gremlin' },
                ],
                required: true,
              },
              {
                id: 'region',
                label: 'Primary region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
            ],
          },
        ],
      },
      {
        id: 'globalDistribution',
        title: 'Global distribution',
        sections: [
          {
            id: 'replication',
            title: 'Regions',
            fields: [
              { id: 'enableMultiRegion', label: 'Enable multi-region writes', type: 'toggle' },
              {
                id: 'additionalRegions',
                label: 'Add regions',
                type: 'select',
                multiple: true,
                options: regions.map((region) => ({ label: region, value: region })),
                helper: 'Select additional write/read regions.',
              },
            ],
          },
          {
            id: 'consistency',
            title: 'Consistency',
            fields: [
              {
                id: 'consistency',
                label: 'Consistency level',
                type: 'select',
                options: [
                  { label: 'Strong', value: 'Strong' },
                  { label: 'Bounded staleness', value: 'Bounded staleness' },
                  { label: 'Session', value: 'Session' },
                  { label: 'Consistent prefix', value: 'Consistent prefix' },
                  { label: 'Eventual', value: 'Eventual' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'capacity',
        title: 'Capacity mode',
        sections: [
          {
            id: 'throughput',
            title: 'Throughput',
            fields: [
              {
                id: 'capacityMode',
                label: 'Capacity mode',
                type: 'radio',
                options: [
                  { label: 'Provisioned throughput', value: 'Provisioned throughput' },
                  { label: 'Serverless', value: 'Serverless' },
                ],
              },
              {
                id: 'throughput',
                label: 'Manual throughput (RU/s)',
                type: 'number',
                min: 400,
                max: 100000,
                suffix: 'RU/s',
              },
              {
                id: 'autoScale',
                label: 'Enable autoscale',
                type: 'toggle',
              },
              {
                id: 'autoScaleMaxThroughput',
                label: 'Autoscale max RU/s',
                type: 'number',
                min: 4000,
                max: 1000000,
                suffix: 'RU/s',
              },
              {
                id: 'enableFreeTier',
                label: 'Apply free tier discount',
                type: 'toggle',
              },
            ],
          },
          {
            id: 'analytical',
            title: 'Analytical store',
            fields: [
              { id: 'analyticalStore', label: 'Enable analytical store', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'backup',
        title: 'Backup policy',
        sections: [
          {
            id: 'backupSettings',
            title: 'Retention',
            fields: [
              {
                id: 'backupType',
                label: 'Backup type',
                type: 'radio',
                options: [
                  { label: 'Periodic', value: 'Periodic' },
                  { label: 'Continuous', value: 'Continuous' },
                ],
              },
              {
                id: 'backupInterval',
                label: 'Backup interval (hours)',
                type: 'number',
                min: 1,
                max: 24,
                suffix: 'hours',
              },
              {
                id: 'backupRetention',
                label: 'Backup retention (hours)',
                type: 'number',
                min: 2,
                max: 730,
                suffix: 'hours',
              },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            fields: [
              {
                id: 'tagsEnvironment',
                label: 'Environment',
                type: 'select',
                options: [
                  { label: 'production', value: 'production' },
                  { label: 'staging', value: 'staging' },
                  { label: 'dev', value: 'dev' },
                ],
              },
            ],
          },
        ],
      },
      { id: 'review', title: 'Review + create', sections: [] },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Account name', field: 'accountName' },
      { label: 'API', field: 'api' },
      { label: 'Consistency', field: 'consistency' },
      { label: 'Capacity mode', field: 'capacityMode' },
      { label: 'Throughput', field: 'throughput' },
    ],
    action: 'cosmosDb',
    successPath: '/cosmos-db',
    resourceType: 'Cosmos DB account',
  },
  'virtual-network': {
    id: 'virtual-network',
    route: 'virtual-network',
    icon: 'Network',
    category: 'Networking',
    title: 'Virtual network',
    description: 'Create isolated, secure network topologies.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      vnetName: '',
      region: '(Americas) East US',
      addressSpace: '10.10.0.0/16',
      ipv6AddressSpace: '',
      ddosPlan: 'Basic',
      subnetName: 'default',
      subnetAddress: '10.10.1.0/24',
      serviceEndpoints: [],
      privateEndpointPolicies: false,
      enableBastion: false,
      enableDnsServer: false,
      dnsServerIp: '',
      enableFlowLogs: false,
      logAnalyticsWorkspace: '',
      tagsEnvironment: 'networking',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              { id: 'subscription', label: 'Subscription', type: 'select', dataSource: 'subscriptions', required: true },
              { id: 'resourceGroup', label: 'Resource group', type: 'select', dataSource: 'resourceGroups', required: true },
              {
                id: 'vnetName',
                label: 'Name',
                type: 'text',
                placeholder: 'cognior-vnet',
                required: true,
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
              {
                id: 'addressSpace',
                label: 'IPv4 address space',
                type: 'text',
                helper: 'Use CIDR notation, e.g. 10.0.0.0/16',
                required: true,
              },
            ],
          },
        ],
      },
      {
        id: 'security',
        title: 'Security',
        sections: [
          {
            id: 'ddos',
            title: 'DDoS protection',
            fields: [
              {
                id: 'ddosPlan',
                label: 'DDoS protection plan',
                type: 'select',
                options: [
                  { label: 'Basic', value: 'Basic' },
                  { label: 'Standard plan', value: 'Standard' },
                ],
              },
              { id: 'enableBastion', label: 'Enable Cognior Bastion', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'subnets',
        title: 'Subnets',
        sections: [
          {
            id: 'subnetConfig',
            title: 'Default subnet',
            fields: [
              { id: 'subnetName', label: 'Subnet name', type: 'text', placeholder: 'default' },
              { id: 'subnetAddress', label: 'Subnet address range', type: 'text', helper: 'Example: 10.10.1.0/24' },
              {
                id: 'serviceEndpoints',
                label: 'Service endpoints',
                type: 'select',
                multiple: true,
                options: [
                  { label: 'Storage', value: 'Microsoft.Storage' },
                  { label: 'SQL', value: 'Microsoft.Sql' },
                  { label: 'Cosmos DB', value: 'Microsoft.AzureCosmosDB' },
                ],
              },
              { id: 'privateEndpointPolicies', label: 'Enable private endpoint network policies', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'dns',
        title: 'DNS servers',
        sections: [
          {
            id: 'dnsSettings',
            title: 'Custom DNS',
            fields: [
              { id: 'enableDnsServer', label: 'Use custom DNS server', type: 'toggle' },
              { id: 'dnsServerIp', label: 'DNS server IP address', type: 'text', placeholder: '10.0.0.4' },
            ],
          },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        sections: [
          {
            id: 'flowLogs',
            title: 'Flow logs',
            fields: [
              { id: 'enableFlowLogs', label: 'Enable flow logs', type: 'toggle' },
              { id: 'logAnalyticsWorkspace', label: 'Log Analytics workspace', type: 'text', placeholder: 'DefaultWorkspace' },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            fields: [
              { id: 'tagsEnvironment', label: 'Environment', type: 'text', placeholder: 'networking' },
            ],
          },
        ],
      },
      { id: 'review', title: 'Review + create', sections: [] },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'VNet name', field: 'vnetName' },
      { label: 'Address space', field: 'addressSpace' },
      { label: 'Subnet', field: 'subnetAddress' },
      { label: 'IPv6 space', field: 'ipv6AddressSpace' },
      { label: 'Flow logs', field: 'enableFlowLogs' },
    ],
    action: 'virtualNetwork',
    successPath: '/virtual-networks',
    resourceType: 'Virtual network',
  },
  'data-factory': {
    id: 'data-factory',
    route: 'data-factory',
    icon: 'Factory',
    category: 'Analytics',
    title: 'Data Factory',
    description: 'Serverless data integration at scale.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      factoryName: '',
      region: '(Americas) East US',
      version: 'V2',
      enableGit: false,
      gitRepositoryType: 'GitHub',
      gitRepository: '',
      gitBranch: 'main',
      gitRootFolder: '/',
      gitPublishBranch: 'adf_publish',
      importExistingFromGit: false,
      publicNetworkAccess: true,
      managedVnet: false,
      enablePrivateEndpoints: false,
      enableEventHub: false,
      enableLogAnalytics: true,
      tagsEnvironment: 'data',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              { id: 'subscription', label: 'Subscription', type: 'select', dataSource: 'subscriptions', required: true },
              { id: 'resourceGroup', label: 'Resource group', type: 'select', dataSource: 'resourceGroups', required: true },
              {
                id: 'factoryName',
                label: 'Factory name',
                type: 'text',
                placeholder: 'cognior-adf',
                required: true,
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
              {
                id: 'version',
                label: 'Version',
                type: 'select',
                options: [
                  { label: 'V2', value: 'V2' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'git',
        title: 'Git configuration',
        sections: [
          {
            id: 'repo',
            title: 'Repository settings',
            fields: [
              { id: 'enableGit', label: 'Configure Git repository', type: 'toggle' },
              {
                id: 'gitRepositoryType',
                label: 'Repository type',
                type: 'select',
                options: [
                  { label: 'GitHub', value: 'GitHub' },
                  { label: 'GitHub Enterprise', value: 'GitHubEnterprise' },
                  { label: 'Azure DevOps', value: 'Azure DevOps' },
                ],
              },
              { id: 'gitRepository', label: 'Repository name', type: 'text', placeholder: 'org/repo' },
              { id: 'gitBranch', label: 'Branch', type: 'text', placeholder: 'main' },
              { id: 'gitRootFolder', label: 'Root folder', type: 'text', placeholder: '/' },
              { id: 'gitPublishBranch', label: 'Publish branch', type: 'text', placeholder: 'adf_publish' },
              { id: 'importExistingFromGit', label: 'Import existing resources', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'networking',
        title: 'Networking',
        sections: [
          {
            id: 'publicAccess',
            title: 'Public network access',
            fields: [
              { id: 'publicNetworkAccess', label: 'Allow public network access', type: 'toggle' },
            ],
          },
          {
            id: 'managedVnet',
            title: 'Managed virtual network',
            fields: [
              { id: 'managedVnet', label: 'Enable Managed VNet', type: 'toggle' },
              { id: 'enablePrivateEndpoints', label: 'Allow private endpoints', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        sections: [
          {
            id: 'diagnostics',
            title: 'Diagnostics',
            fields: [
              { id: 'enableEventHub', label: 'Send diagnostics to Event Hub', type: 'toggle' },
              { id: 'enableLogAnalytics', label: 'Send diagnostics to Log Analytics', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            fields: [
              { id: 'tagsEnvironment', label: 'Environment', type: 'text', placeholder: 'data' },
            ],
          },
        ],
      },
      { id: 'review', title: 'Review + create', sections: [] },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Factory name', field: 'factoryName' },
      { label: 'Region', field: 'region' },
      { label: 'Git enabled', field: 'enableGit' },
      { label: 'Managed VNet', field: 'managedVnet' },
    ],
    action: 'dataFactory',
    successPath: '/all-services',
    resourceType: 'Data Factory',
  },
  'logic-app': {
    id: 'logic-app',
    route: 'logic-app',
    icon: 'GitBranch',
    category: 'Integration',
    title: 'Logic App',
    description: 'Automate workflows visually.',
    defaultValues: {
      subscription: mockSubscriptions[0]?.name ?? '',
      resourceGroup: mockResourceGroups[0]?.name ?? '',
      workflowName: '',
      planType: 'Consumption',
      region: '(Americas) East US',
      runtime: 'Single-tenant',
      enableZoneRedundancy: false,
      enableIntegrationServiceEnvironment: false,
      storageAccount: 'Create new',
      containerName: 'logicapps',
      enableManagedIdentity: true,
      identityType: 'System-assigned',
      enableLogAnalytics: true,
      logAnalyticsWorkspace: 'DefaultWorkspace',
      enableDiagEventHub: false,
      enableDiagStorage: false,
      tagsEnvironment: 'integration',
    },
    steps: [
      {
        id: 'basics',
        title: 'Basics',
        sections: [
          {
            id: 'project',
            title: 'Project details',
            fields: [
              { id: 'subscription', label: 'Subscription', type: 'select', dataSource: 'subscriptions', required: true },
              { id: 'resourceGroup', label: 'Resource group', type: 'select', dataSource: 'resourceGroups', required: true },
              {
                id: 'workflowName',
                label: 'Logic app name',
                type: 'text',
                placeholder: 'cognior-workflow',
                required: true,
              },
              {
                id: 'planType',
                label: 'Plan type',
                type: 'radio',
                options: [
                  { label: 'Consumption', value: 'Consumption' },
                  { label: 'Standard', value: 'Standard' },
                ],
              },
              {
                id: 'runtime',
                label: 'Runtime stack',
                type: 'select',
                options: [
                  { label: 'Single-tenant', value: 'Single-tenant' },
                  { label: 'Stateful', value: 'Stateful' },
                ],
              },
              {
                id: 'region',
                label: 'Region',
                type: 'select',
                options: regions.map((region) => ({ label: region, value: region })),
                required: true,
              },
            ],
          },
        ],
      },
      {
        id: 'monitoring',
        title: 'Monitoring',
        sections: [
          {
            id: 'diagnostics',
            title: 'Diagnostics',
            fields: [
              { id: 'enableLogAnalytics', label: 'Enable Log Analytics', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'networking',
        title: 'Networking',
        sections: [
          {
            id: 'ise',
            title: 'Integration service environment',
            fields: [
              { id: 'enableIntegrationServiceEnvironment', label: 'Deploy into Integration Service Environment', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'storageIdentity',
        title: 'Storage & identity',
        sections: [
          {
            id: 'storage',
            title: 'Storage account',
            fields: [
              { id: 'storageAccount', label: 'Storage account', type: 'text', placeholder: 'cogniorstorage' },
              { id: 'containerName', label: 'Container', type: 'text', placeholder: 'logicapps' },
            ],
          },
          {
            id: 'identity',
            title: 'Managed identity',
            fields: [
              { id: 'enableManagedIdentity', label: 'Enable managed identity', type: 'toggle' },
              {
                id: 'identityType',
                label: 'Identity type',
                type: 'select',
                options: [
                  { label: 'System-assigned', value: 'System-assigned' },
                  { label: 'User-assigned', value: 'User-assigned' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'diagnostics',
        title: 'Diagnostics',
        sections: [
          {
            id: 'diagSinks',
            title: 'Diagnostic settings',
            fields: [
              { id: 'enableDiagEventHub', label: 'Send diagnostics to Event Hub', type: 'toggle' },
              { id: 'enableDiagStorage', label: 'Send diagnostics to Storage', type: 'toggle' },
            ],
          },
        ],
      },
      {
        id: 'tags',
        title: 'Tags',
        sections: [
          {
            id: 'tagEditor',
            title: 'Tag editor',
            fields: [
              { id: 'tagsEnvironment', label: 'Environment', type: 'text', placeholder: 'integration' },
            ],
          },
        ],
      },
      { id: 'review', title: 'Review + create', sections: [] },
    ],
    summaryFields: [
      { label: 'Subscription', field: 'subscription' },
      { label: 'Resource group', field: 'resourceGroup' },
      { label: 'Logic app name', field: 'workflowName' },
      { label: 'Plan type', field: 'planType' },
      { label: 'Region', field: 'region' },
      { label: 'Managed identity', field: 'enableManagedIdentity' },
      { label: 'Diagnostics', field: 'enableLogAnalytics' },
    ],
    action: 'logicApp',
    successPath: '/all-services',
    resourceType: 'Logic App',
  },
};

export const getBlueprintByRoute = (route?: string): CreateBlueprint | null => {
  if (!route) return null;
  return Object.values(createBlueprints).find((bp) => bp.route === route) ?? null;
};

