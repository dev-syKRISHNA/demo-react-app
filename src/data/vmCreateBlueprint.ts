import { WizardStepSchema } from '@/components/WizardEngine';

const regions = [
  '(Asia Pacific) Central India',
  '(Asia Pacific) Southeast Asia',
  '(Europe) West Europe',
  '(Europe) North Europe',
  '(Americas) East US',
  '(Americas) West US 2',
];

const vmImages = [
  { label: 'Windows Server 2022 Datacenter - x64 Gen2', value: 'Windows Server 2022 Datacenter - x64 Gen2' },
  { label: 'Windows Server 2019 Datacenter - x64 Gen2', value: 'Windows Server 2019 Datacenter - x64 Gen2' },
  { label: 'Windows 11 Pro - x64 Gen2', value: 'Windows 11 Pro - x64 Gen2' },
  { label: 'Ubuntu Server 20.04 LTS - x64 Gen2', value: 'Ubuntu Server 20.04 LTS - x64 Gen2' },
  { label: 'Ubuntu Server 22.04 LTS - x64 Gen2', value: 'Ubuntu Server 22.04 LTS - x64 Gen2' },
  { label: 'CentOS 8.2 - x64 Gen2', value: 'CentOS 8.2 - x64 Gen2' },
];

const availabilityOptions = [
  { label: 'No infrastructure redundancy required', value: 'No infrastructure redundancy required' },
  { label: 'Availability zone', value: 'Availability zone' },
  { label: 'Availability set', value: 'Availability set' },
];

const inboundPortOptions = [
  { label: 'RDP (3389)', value: 'RDP' },
  { label: 'HTTP (80)', value: 'HTTP' },
  { label: 'HTTPS (443)', value: 'HTTPS' },
  { label: 'SSH (22)', value: 'SSH' },
];

export const vmCreateSteps = {
  defaultValues: {
    subscription: 'VS Enterprise-Rakesh',
    resourceGroup: '(New) my-vm-rg',
    vmName: '',
    region: '(Asia Pacific) Central India',
    availabilityOptions: 'No infrastructure redundancy required',
    image: 'Windows Server 2022 Datacenter - x64 Gen2',
    size: '',
    adminUsername: '',
    adminPassword: '',
    sshPublicKey: '',
    inboundPorts: [] as string[],
    vmTags: [
      {
        name: '',
        value: '',
        scope: 'vm-and-resources',
      },
    ],
  },
  steps: [
    {
      id: 'basics',
      title: 'Basics',
      description: 'Complete the Basics tab then Review + create to provision a virtual machine with default parameters or review each tab for full customization.',
      fields: [
        // Project details
        { key: 'subscription', label: 'Subscription', type: 'select', required: true, dataSource: 'subscriptions' },
        { key: 'resourceGroup', label: 'Resource group', type: 'custom', required: true, dataSource: 'resourceGroups' },
        // Instance details
        { key: 'vmName', label: 'Virtual machine name', type: 'text', required: true, placeholder: 'my-vm' },
        { key: 'region', label: 'Region', type: 'select', required: true, options: regions.map(r => ({ label: r, value: r })) },
        { key: 'availabilityOptions', label: 'Availability options', type: 'select', options: availabilityOptions },
        { key: 'image', label: 'Image', type: 'select', required: true, options: vmImages },
        { key: 'size', label: 'Size', type: 'custom', required: true, placeholder: 'Select size' },
        // Administrator account
        { key: 'adminUsername', label: 'Username', type: 'text', required: true, placeholder: 'azureuser' },
        { key: 'adminPassword', label: 'Password', type: 'password', required: true, visible: (values: any) => values.image?.includes('Windows'), validation: [
          {
            message: 'Password must be at least 8 characters.',
            test: (value: any) => typeof value === 'string' && value.length >= 8,
          },
        ] },
        { key: 'sshPublicKey', label: 'SSH public key', type: 'textarea', visible: (values: any) => !values.image?.includes('Windows'), placeholder: 'ssh-rsa AAAAB3NzaC1yc2E...' },
        // Inbound port rules
        { key: 'inboundPorts', label: 'Inbound port rules', type: 'checkbox', options: inboundPortOptions },
      ],
    },
    {
      id: 'disks',
      title: 'Disks',
      description: 'Configure disk settings for the virtual machine.',
      fields: [
        { key: 'osDiskType', label: 'OS disk type', type: 'select', required: true, options: [
          { label: 'Standard HDD', value: 'Standard HDD' },
          { label: 'Standard SSD', value: 'Standard SSD' },
          { label: 'Premium SSD', value: 'Premium SSD' },
          { label: 'Ultra Disk', value: 'Ultra Disk' },
        ]},
        { key: 'osDiskSize', label: 'OS disk size (GiB)', type: 'number', min: 30, max: 4096, suffix: 'GiB' },
        { key: 'dataDiskCount', label: 'Data disks', type: 'number', min: 0, max: 64, suffix: 'disks' },
        { key: 'dataDiskType', label: 'Data disk type', type: 'select', options: [
          { label: 'Standard HDD', value: 'Standard HDD' },
          { label: 'Standard SSD', value: 'Standard SSD' },
          { label: 'Premium SSD', value: 'Premium SSD' },
        ]},
        { key: 'encryptionAtRest', label: 'Encryption at rest', type: 'toggle' },
        { key: 'encryptionWithCmk', label: 'Encrypt with customer-managed keys', type: 'toggle', visible: (values: any) => values.encryptionAtRest },
        { key: 'diskEncryptionSet', label: 'Disk encryption set', type: 'custom', dataSource: 'diskEncryptionSets', visible: (values: any) => values.encryptionWithCmk },
      ],
    },
    {
      id: 'networking',
      title: 'Networking',
      description: 'Configure network settings for the virtual machine.',
      fields: [
        { key: 'networkInterfaceNewOrExisting', label: 'Network interface', type: 'radio', options: [
          { label: 'New', value: 'New' },
          { label: 'Existing', value: 'Existing' },
        ]},
        { key: 'vnet', label: 'Virtual network', type: 'custom', dataSource: 'virtualNetworks', visible: (values: any) => values.networkInterfaceNewOrExisting === 'New' },
        { key: 'subnet', label: 'Subnet', type: 'custom', dataSource: 'subnets', visible: (values: any) => values.networkInterfaceNewOrExisting === 'New' },
        { key: 'publicIp', label: 'Public IP', type: 'custom', dataSource: 'publicIps', visible: (values: any) => values.networkInterfaceNewOrExisting === 'New' },
        { key: 'nsg', label: 'Network security group', type: 'custom', dataSource: 'networkSecurityGroups', visible: (values: any) => values.networkInterfaceNewOrExisting === 'New' },
        { key: 'acceleratedNetworking', label: 'Accelerated networking', type: 'toggle' },
        { key: 'ipForwarding', label: 'IP forwarding', type: 'toggle' },
        { key: 'loadBalancer', label: 'Load balancer', type: 'custom', dataSource: 'loadBalancers' },
      ],
    },
    {
      id: 'management',
      title: 'Management',
      description: 'Configure management, monitoring, and backup settings.',
      fields: [
        { key: 'identity', label: 'Identity', type: 'select', options: [
          { label: 'None', value: 'None' },
          { label: 'System-assigned', value: 'System-assigned' },
          { label: 'User-assigned', value: 'User-assigned' },
        ]},
        { key: 'userAssignedIdentity', label: 'User-assigned managed identity', type: 'custom', dataSource: 'managedIdentities', visible: (values: any) => values.identity === 'User-assigned' },
        { key: 'managedIdentity', label: 'Enable system-assigned managed identity', type: 'toggle', visible: (values: any) => values.identity === 'System-assigned' },
        { key: 'bootDiagnostics', label: 'Boot diagnostics', type: 'toggle' },
        { key: 'bootDiagnosticsStorageAccount', label: 'Storage account', type: 'custom', dataSource: 'storageAccounts', visible: (values: any) => values.bootDiagnostics },
        { key: 'autoShutdown', label: 'Auto-shutdown', type: 'toggle' },
        { key: 'autoShutdownTime', label: 'Shutdown time', type: 'time', visible: (values: any) => values.autoShutdown },
        { key: 'autoShutdownTimeZone', label: 'Time zone', type: 'select', visible: (values: any) => values.autoShutdown, options: [
          { label: 'UTC', value: 'UTC' },
          { label: 'Eastern Time', value: 'Eastern Time' },
          { label: 'Pacific Time', value: 'Pacific Time' },
        ]},
        { key: 'autoShutdownNotification', label: 'Send notification before auto-shutdown', type: 'toggle', visible: (values: any) => values.autoShutdown },
        { key: 'backup', label: 'Backup', type: 'toggle' },
        { key: 'backupVault', label: 'Recovery Services vault', type: 'custom', dataSource: 'backupVaults', visible: (values: any) => values.backup },
        { key: 'backupPolicy', label: 'Backup policy', type: 'custom', dataSource: 'backupPolicies', visible: (values: any) => values.backup },
        { key: 'patchOrchestrationMode', label: 'Patch orchestration mode', type: 'select', options: [
          { label: 'Azure-orchestrated', value: 'Azure-orchestrated' },
          { label: 'Manual', value: 'Manual' },
          { label: 'AutomaticByPlatform', value: 'AutomaticByPlatform' },
        ]},
      ],
    },
    {
      id: 'monitoring',
      title: 'Monitoring',
      description: 'Configure monitoring and diagnostics.',
      fields: [
        { key: 'diagnostics', label: 'Enable boot diagnostics', type: 'toggle' },
        { key: 'diagnosticsStorageAccount', label: 'Storage account', type: 'custom', dataSource: 'storageAccounts', visible: (values: any) => values.diagnostics },
        { key: 'guestLevelMonitoring', label: 'Enable guest-level monitoring', type: 'toggle' },
        { key: 'logAnalyticsWorkspace', label: 'Log Analytics workspace', type: 'custom', dataSource: 'logAnalyticsWorkspaces', visible: (values: any) => values.guestLevelMonitoring },
        { key: 'applicationInsights', label: 'Application Insights', type: 'custom', dataSource: 'applicationInsights', visible: (values: any) => values.guestLevelMonitoring },
        { key: 'azureMonitorAgent', label: 'Enable Azure Monitor Agent', type: 'toggle' },
        { key: 'dataCollectionRule', label: 'Data collection rule', type: 'custom', dataSource: 'dataCollectionRules', visible: (values: any) => values.azureMonitorAgent },
      ],
    },
    {
      id: 'advanced',
      title: 'Advanced',
      description: 'Configure advanced settings.',
      fields: [
        { key: 'proximityPlacementGroup', label: 'Proximity placement group', type: 'custom', dataSource: 'proximityPlacementGroups' },
        { key: 'availabilitySet', label: 'Availability set', type: 'custom', dataSource: 'availabilitySets', visible: (values: any) => values.availabilityOptions === 'Availability set' },
        { key: 'hostGroup', label: 'Host group', type: 'custom', dataSource: 'hostGroups' },
        { key: 'capacityReservationGroup', label: 'Capacity reservation group', type: 'custom', dataSource: 'capacityReservationGroups' },
        { key: 'extensions', label: 'Extensions', type: 'multiSelect', dataSource: 'vmExtensions' },
        { key: 'customData', label: 'Custom data (cloud-init)', type: 'textarea', placeholder: '#!/bin/bash\necho "Hello World"' },
        { key: 'userData', label: 'User data', type: 'textarea', placeholder: 'Base64 encoded user data' },
        { key: 'licenseType', label: 'License type', type: 'select', options: [
          { label: 'None', value: 'None' },
          { label: 'Windows_Client', value: 'Windows_Client' },
          { label: 'Windows_Server', value: 'Windows_Server' },
        ]},
        { key: 'priority', label: 'Priority', type: 'select', options: [
          { label: 'Regular', value: 'Regular' },
          { label: 'Spot', value: 'Spot' },
          { label: 'Low', value: 'Low' },
        ]},
        { key: 'evictionPolicy', label: 'Eviction policy', type: 'select', visible: (values: any) => values.priority === 'Spot', options: [
          { label: 'Deallocate', value: 'Deallocate' },
          { label: 'Delete', value: 'Delete' },
        ]},
        { key: 'maxPrice', label: 'Max price ($/hour)', type: 'number', visible: (values: any) => values.priority === 'Spot', placeholder: '-1 for pay up to on-demand price' },
        { key: 'enableHibernation', label: 'Enable hibernation', type: 'toggle' },
        { key: 'enableHotpatching', label: 'Enable hotpatching', type: 'toggle', visible: (values: any) => values.image?.includes('Windows') },
      ],
    },
    {
      id: 'tags',
      title: 'Tags',
      description: 'Apply metadata to help organize your resources.',
      fields: [
        { key: 'tagEnvironment', label: 'Environment', type: 'select', options: [
          { label: 'production', value: 'production' },
          { label: 'staging', value: 'staging' },
          { label: 'dev', value: 'dev' },
        ]},
        { key: 'tagOwner', label: 'Owner', type: 'text', placeholder: 'team-cognior' },
        { key: 'tagCostCenter', label: 'Cost center', type: 'text' },
        { key: 'tagProject', label: 'Project', type: 'text' },
        { key: 'vmTagsTable', label: 'Tags', type: 'text' },
      ],
    },
    {
      id: 'review',
      title: 'Review + create',
      description: 'Review your settings and create the virtual machine.',
      fields: [],
    },
  ] as WizardStepSchema[],
};
