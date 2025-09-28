import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, Info, HelpCircle } from 'lucide-react';
import { 
  trackEvent, 
  AnalyticsEvents,
  mockSubscriptions,
  mockResourceGroups 
} from '@/data/mockData';
import { actions } from '@/lib/store';

interface FormData {
  subscription: string;
  resourceGroup: string;
  storageAccountName: string;
  region: string;
  performance: 'Standard' | 'Premium';
  redundancy: string;
  enableReadAccess: boolean;
  accessTier: 'Hot' | 'Cool' | 'Archive';
  connectivity: 'Public endpoint' | 'Private endpoint';
  firewallIp: string;
  usePrivateEndpoint: boolean;
  softDelete: boolean;
  versioning: boolean;
  blobRestore: boolean;
  encryptionKeyType: 'Microsoft-managed' | 'Customer-managed';
  cmkUri: string;
  // Advanced - Security
  requireSecureTransfer: boolean;
  allowAnonymousAccess: boolean;
  enableAccountKeyAccess: boolean;
  defaultToEntraAuthInPortal: boolean;
  minimumTlsVersion: 'Version 1.2' | 'Version 1.1' | 'Version 1.0';
  permittedCopyScope: 'From any storage account' | 'From selected storage accounts';
  // Advanced - Hierarchical namespace / Access protocols / Blob storage / Azure Files
  hierarchicalNamespace: boolean;
  enableSftp: boolean;
  enableNfsV3: boolean;
  crossTenantReplication: boolean;
  enableLargeFileShares: boolean;
  // Networking
  publicNetworkAccess: 'Enable' | 'Disable' | 'Secure by perimeter (Most restricted)';
  publicNetworkAccessScope: 'Enable from all networks' | 'Enable from selected virtual networks and IP addresses';
  // Data protection
  daysToRetainDeletedBlobs: number;
  daysToRetainDeletedContainers: number;
  daysToRetainDeletedFileShares: number;
  enableBlobChangeFeed: boolean;
  enableImmutabilitySupport: boolean;
}

interface ValidationErrors {
  [key: string]: string;
}

const CreateStorageAccount: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    subscription: 'Cognior Enterprise',
    resourceGroup: 'Analytics',
    storageAccountName: '',
    region: '(Asia Pacific) Central India',
    performance: 'Standard',
    redundancy: 'Geo-redundant storage (GRS)',
    enableReadAccess: true,
    accessTier: 'Hot',
    connectivity: 'Public endpoint',
    firewallIp: '',
    usePrivateEndpoint: false,
    softDelete: true,
    versioning: true,
    blobRestore: false,
    encryptionKeyType: 'Microsoft-managed',
    cmkUri: '',
    requireSecureTransfer: true,
    allowAnonymousAccess: false,
    enableAccountKeyAccess: true,
    defaultToEntraAuthInPortal: false,
    minimumTlsVersion: 'Version 1.2',
    permittedCopyScope: 'From any storage account',
    hierarchicalNamespace: false,
    enableSftp: false,
    enableNfsV3: false,
    crossTenantReplication: false,
    enableLargeFileShares: true,
    publicNetworkAccess: 'Enable',
    publicNetworkAccessScope: 'Enable from all networks',
    daysToRetainDeletedBlobs: 7,
    daysToRetainDeletedContainers: 7,
    daysToRetainDeletedFileShares: 7,
    enableBlobChangeFeed: false,
    enableImmutabilitySupport: false
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isValid, setIsValid] = useState(false);

  const steps = [
    'Basics',
    'Advanced', 
    'Networking',
    'Data protection',
    'Encryption',
    'Tags',
    'Review + create'
  ];

  useEffect(() => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      resourceType: 'Storage Account',
      step: steps[currentStep]
    });
  }, []);

  useEffect(() => {
    validateForm();
  }, [formData]);

  const validateForm = () => {
    const newErrors: ValidationErrors = {};

    if (!formData.storageAccountName) {
      newErrors.storageAccountName = 'Storage account name is required';
    } else if (formData.storageAccountName.length < 3 || formData.storageAccountName.length > 24) {
      newErrors.storageAccountName = 'Storage account name must be between 3 and 24 characters';
    } else if (!/^[a-z0-9]+$/.test(formData.storageAccountName)) {
      newErrors.storageAccountName = 'Storage account name can only contain lowercase letters and numbers';
    }

    if (!formData.subscription) {
      newErrors.subscription = 'Subscription is required';
    }

    if (!formData.resourceGroup) {
      newErrors.resourceGroup = 'Resource group is required';
    }

    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0);
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    trackEvent(AnalyticsEvents.FORM_FIELD_FOCUS, {
      field,
      resourceType: 'Storage Account',
      step: steps[currentStep]
    });
  };

  const handleInputBlur = (field: keyof FormData) => {
    trackEvent(AnalyticsEvents.FORM_FIELD_BLUR, {
      field,
      resourceType: 'Storage Account',
      step: steps[currentStep]
    });
  };

  const handleNext = () => {
    if (currentStep === 0 && !isValid) {
      trackEvent(AnalyticsEvents.FORM_VALIDATION_ERROR, {
        errors: Object.keys(errors),
        step: steps[currentStep]
      });
      return;
    }

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_STEP, {
      resourceType: 'Storage Account',
      fromStep: steps[currentStep],
      toStep: steps[nextStep],
      direction: 'next'
    });
  };

  const handlePrevious = () => {
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_STEP, {
      resourceType: 'Storage Account',
      fromStep: steps[currentStep],
      toStep: steps[prevStep],
      direction: 'previous'
    });
  };

  const handleSubmit = () => {
    if (!isValid) {
      trackEvent(AnalyticsEvents.FORM_VALIDATION_ERROR, {
        errors: Object.keys(errors),
        resourceType: 'Storage Account'
      });
      return;
    }

    const created = actions.createStorageAccount({
      name: formData.storageAccountName,
      subscription: formData.subscription,
      resourceGroup: formData.resourceGroup,
      location: formData.region.replace(/^\([^\)]+\)\s*/, ''),
      redundancy: formData.redundancy,
      performance: formData.performance,
    });

    // Persist advanced settings as tags for analytics/management
    actions.updateResource(created.id, {
      tags: {
        ...created.tags,
        accessTier: formData.accessTier,
        connectivity: formData.connectivity,
        firewallIp: formData.firewallIp,
        usePrivateEndpoint: String(formData.usePrivateEndpoint),
        softDelete: String(formData.softDelete),
        versioning: String(formData.versioning),
        blobRestore: String(formData.blobRestore),
        encryptionKeyType: formData.encryptionKeyType,
        cmkUri: formData.cmkUri,
        requireSecureTransfer: String(formData.requireSecureTransfer),
        allowAnonymousAccess: String(formData.allowAnonymousAccess),
        enableAccountKeyAccess: String(formData.enableAccountKeyAccess),
        defaultToEntraAuthInPortal: String(formData.defaultToEntraAuthInPortal),
        minimumTlsVersion: formData.minimumTlsVersion,
        permittedCopyScope: formData.permittedCopyScope,
        hierarchicalNamespace: String(formData.hierarchicalNamespace),
        enableSftp: String(formData.enableSftp),
        enableNfsV3: String(formData.enableNfsV3),
        crossTenantReplication: String(formData.crossTenantReplication),
        enableLargeFileShares: String(formData.enableLargeFileShares),
        publicNetworkAccess: formData.publicNetworkAccess,
        publicNetworkAccessScope: formData.publicNetworkAccessScope,
        daysToRetainDeletedBlobs: String(formData.daysToRetainDeletedBlobs),
        daysToRetainDeletedContainers: String(formData.daysToRetainDeletedContainers),
        daysToRetainDeletedFileShares: String(formData.daysToRetainDeletedFileShares),
        enableBlobChangeFeed: String(formData.enableBlobChangeFeed),
        enableImmutabilitySupport: String(formData.enableImmutabilitySupport),
      },
    });

    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
      resourceType: 'Storage Account',
      resourceName: created.name,
      subscription: created.subscription,
      resourceGroup: created.resourceGroup
    });
    
    navigate('/storage-accounts');
  };

  const handleCancel = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_CANCEL, {
      resourceType: 'Storage Account',
      step: steps[currentStep]
    });
    navigate('/create-resource');
  };

  const handleClose = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_CANCEL, {
      resourceType: 'Storage Account',
      step: steps[currentStep]
    });
    navigate('/');
  };

  return (
    <div className="h-screen bg-background flex flex-col">
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
            <span 
              onClick={() => navigate('/create-resource')}
              className="cursor-pointer hover:text-foreground"
            >
              Create a resource
            </span>
            <ChevronRight size={16} className="inline mx-2" />
            <span className="text-foreground">Create a storage account</span>
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

      <div className="flex-1 flex">
        {/* Main content */}
        <div className="flex-1 p-6">
          <h1 className="text-2xl font-semibold text-foreground mb-6">Create a storage account</h1>

          {/* Tab navigation */}
          <div className="flex space-x-8 mb-6 border-b border-border">
            {steps.map((step, index) => (
              <button
                key={step}
                onClick={() => {
                  if (index <= currentStep || (index === 1 && currentStep >= 0 && isValid)) {
                    setCurrentStep(index);
                    trackEvent(AnalyticsEvents.NAVIGATION_CLICK, {
                      element: 'step_tab',
                      step: step,
                      resourceType: 'Storage Account'
                    });
                  }
                }}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                  currentStep === index
                    ? 'text-primary border-primary'
                    : index < currentStep || (index === 1 && isValid)
                    ? 'text-foreground border-transparent hover:text-primary hover:border-primary'
                    : 'text-foreground-muted border-transparent cursor-default'
                }`}
                disabled={index > currentStep + 1 || (index === 1 && !isValid)}
              >
                {step}
              </button>
            ))}
          </div>

          {/* Form content */}
          <div className="max-w-2xl">
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="bg-accent/50 border border-accent-foreground/20 rounded p-4 text-sm">
                  <p className="text-foreground-secondary mb-2">
                    Azure Storage is a Microsoft-managed service providing cloud storage that is highly available, secure, 
                    durable, scalable, and redundant. Azure Storage includes Azure Blobs (objects), Azure Data Lake Storage Gen2, 
                    Azure Files, Azure Queues, and Azure Tables. The cost of your storage account depends on the usage and the 
                    options you choose below.{' '}
                    <button className="text-primary hover:underline">
                      Learn more about Azure storage accounts
                    </button>
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Project details</h3>
                  <p className="text-sm text-foreground-secondary mb-4">
                    Select the subscription in which to create the new storage account. Choose a new or existing resource group 
                    to organize and manage your storage account together with other resources.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Subscription <span className="text-error">*</span>
                      </label>
                      <select
                        value={formData.subscription}
                        onChange={(e) => handleInputChange('subscription', e.target.value)}
                        onBlur={() => handleInputBlur('subscription')}
                        className="azure-select"
                      >
                        {mockSubscriptions.map((sub) => (
                          <option key={sub.id} value={sub.name}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                      {errors.subscription && (
                        <p className="text-error text-sm mt-1">{errors.subscription}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Resource group <span className="text-error">*</span>
                      </label>
                      <div className="flex space-x-2">
                        <select
                          value={formData.resourceGroup}
                          onChange={(e) => handleInputChange('resourceGroup', e.target.value)}
                          onBlur={() => handleInputBlur('resourceGroup')}
                          className="azure-select flex-1"
                        >
                          {mockResourceGroups.map((rg) => (
                            <option key={rg.id} value={rg.name}>
                              {rg.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="text-primary hover:underline text-sm mt-1">
                        Create new
                      </button>
                      {errors.resourceGroup && (
                        <p className="text-error text-sm mt-1">{errors.resourceGroup}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Instance details</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Storage account name <span className="text-error">*</span>
                        <button className="ml-1 text-foreground-muted hover:text-foreground">
                          <HelpCircle size={14} />
                        </button>
                      </label>
                      <input
                        type="text"
                        value={formData.storageAccountName}
                        onChange={(e) => handleInputChange('storageAccountName', e.target.value)}
                        onBlur={() => handleInputBlur('storageAccountName')}
                        className={`azure-input ${errors.storageAccountName ? 'border-error' : ''}`}
                        placeholder="Enter storage account name"
                      />
                      {errors.storageAccountName && (
                        <p className="text-error text-sm mt-1">{errors.storageAccountName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Region <span className="text-error">*</span>
                        <button className="ml-1 text-foreground-muted hover:text-foreground">
                          <HelpCircle size={14} />
                        </button>
                      </label>
                      <select
                        value={formData.region}
                        onChange={(e) => handleInputChange('region', e.target.value)}
                        onBlur={() => handleInputBlur('region')}
                        className="azure-select"
                      >
                        <option value="(Asia Pacific) Central India">(Asia Pacific) Central India</option>
                        <option value="(US) East US">(US) East US</option>
                        <option value="(US) West US 2">(US) West US 2</option>
                        <option value="(Europe) West Europe">(Europe) West Europe</option>
                      </select>
                      <button className="text-primary hover:underline text-sm mt-1">
                        Deploy to an Azure Extended Zone
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Preferred storage type
                      </label>
                      <select
                        className="azure-select"
                        defaultValue=""
                      >
                        <option value="">Choose preferred storage type</option>
                        <option value="blob">Blob storage</option>
                        <option value="general">General purpose</option>
                      </select>
                      
                      <div className="flex items-start space-x-2 mt-2 p-2 bg-accent/30 rounded">
                        <Info size={16} className="text-info mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-foreground-secondary">
                          This helps us provide relevant guidance. It doesn't restrict your storage to this resource type.{' '}
                          <button className="text-primary hover:underline">Learn more</button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-3">
                        Performance <span className="text-error">*</span>
                        <button className="ml-1 text-foreground-muted hover:text-foreground">
                          <HelpCircle size={14} />
                        </button>
                      </label>
                      
                      <div className="space-y-3">
                        <label className="flex items-start space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name="performance"
                            value="Standard"
                            checked={formData.performance === 'Standard'}
                            onChange={(e) => handleInputChange('performance', e.target.value as 'Standard' | 'Premium')}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-medium text-foreground">
                              Standard: Recommended for most scenarios (general-purpose v2 account)
                            </div>
                          </div>
                        </label>
                        
                        <label className="flex items-start space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name="performance"
                            value="Premium"
                            checked={formData.performance === 'Premium'}
                            onChange={(e) => handleInputChange('performance', e.target.value as 'Standard' | 'Premium')}
                            className="mt-1"
                          />
                          <div>
                            <div className="font-medium text-foreground">
                              Premium: Recommended for scenarios that require low latency.
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Redundancy <span className="text-error">*</span>
                        <button className="ml-1 text-foreground-muted hover:text-foreground">
                          <HelpCircle size={14} />
                        </button>
                      </label>
                      <select
                        value={formData.redundancy}
                        onChange={(e) => handleInputChange('redundancy', e.target.value)}
                        onBlur={() => handleInputBlur('redundancy')}
                        className="azure-select"
                      >
                        <option value="Geo-redundant storage (GRS)">Geo-redundant storage (GRS)</option>
                        <option value="Locally redundant storage (LRS)">Locally redundant storage (LRS)</option>
                        <option value="Zone-redundant storage (ZRS)">Zone-redundant storage (ZRS)</option>
                        <option value="Geo-zone-redundant storage (GZRS)">Geo-zone-redundant storage (GZRS)</option>
                      </select>
                      
                      <label className="flex items-center space-x-2 mt-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.enableReadAccess}
                          onChange={(e) => handleInputChange('enableReadAccess', e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-foreground">
                          Make read access to data available in the event of regional unavailability.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground mb-4">Advanced</h3>
                <div className="space-y-6">
                  {/* Security */}
                  <div>
                    <h4 className="font-medium mb-2">Security</h4>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" checked={formData.requireSecureTransfer} onChange={(e) => handleInputChange('requireSecureTransfer', e.target.checked)} />
                        <span>Require secure transfer for REST API operations</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" checked={formData.allowAnonymousAccess} onChange={(e) => handleInputChange('allowAnonymousAccess', e.target.checked)} />
                        <span>Allow enabling anonymous access on individual containers</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" checked={formData.enableAccountKeyAccess} onChange={(e) => handleInputChange('enableAccountKeyAccess', e.target.checked)} />
                        <span>Enable storage account key access</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" checked={formData.defaultToEntraAuthInPortal} onChange={(e) => handleInputChange('defaultToEntraAuthInPortal', e.target.checked)} />
                        <span>Default to Microsoft Entra authorization in the Azure portal</span>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Minimum TLS version</label>
                        <select className="azure-select" value={formData.minimumTlsVersion} onChange={(e) => handleInputChange('minimumTlsVersion', e.target.value as any)}>
                          <option>Version 1.2</option>
                          <option>Version 1.1</option>
                          <option>Version 1.0</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Permitted scope for copy operations</label>
                        <select className="azure-select" value={formData.permittedCopyScope} onChange={(e) => handleInputChange('permittedCopyScope', e.target.value as any)}>
                          <option>From any storage account</option>
                          <option>From selected storage accounts</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Hierarchical namespace */}
                  <div>
                    <h4 className="font-medium mb-2">Hierarchical Namespace</h4>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" checked={formData.hierarchicalNamespace} onChange={(e) => handleInputChange('hierarchicalNamespace', e.target.checked)} />
                      <span>Enable hierarchical namespace</span>
                    </label>
                  </div>

                  {/* Access protocols */}
                  <div>
                    <h4 className="font-medium mb-2">Access protocols</h4>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" checked={formData.enableSftp} onChange={(e) => handleInputChange('enableSftp', e.target.checked)} />
                      <span>Enable SFTP</span>
                    </label>
                    <label className="flex items-center space-x-2 mt-2">
                      <input type="checkbox" checked={formData.enableNfsV3} onChange={(e) => handleInputChange('enableNfsV3', e.target.checked)} />
                      <span>Enable network file system v3</span>
                    </label>
                  </div>

                  {/* Blob storage */}
                  <div>
                    <h4 className="font-medium mb-2">Blob storage</h4>
                    <label className="flex items-center space-x-2 mb-2">
                      <input type="checkbox" checked={formData.crossTenantReplication} onChange={(e) => handleInputChange('crossTenantReplication', e.target.checked)} />
                      <span>Allow cross-tenant replication</span>
                    </label>
                    <div>
                      <label className="block text-sm font-medium mb-2">Access tier</label>
                      <div className="space-y-2">
                        {(['Hot','Cool','Archive'] as const).map((tier) => (
                          <label key={tier} className="flex items-center space-x-2">
                            <input type="radio" name="accessTier" checked={formData.accessTier === tier} onChange={() => handleInputChange('accessTier', tier)} />
                            <span>{tier}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Azure Files */}
                  <div>
                    <h4 className="font-medium mb-2">Azure Files</h4>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" checked={formData.enableLargeFileShares} onChange={(e) => handleInputChange('enableLargeFileShares', e.target.checked)} />
                      <span>Enable large file shares</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground mb-4">Networking</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Public network access</label>
                    <div className="space-y-2">
                      {(['Enable','Disable','Secure by perimeter (Most restricted)'] as const).map((opt) => (
                        <label key={opt} className="flex items-center space-x-2">
                          <input type="radio" name="pna" checked={formData.publicNetworkAccess === opt} onChange={() => handleInputChange('publicNetworkAccess', opt)} />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {formData.connectivity === 'Public endpoint' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Firewall IP (optional)</label>
                      <input
                        className="azure-input"
                        value={formData.firewallIp}
                        onChange={(e) => handleInputChange('firewallIp', e.target.value)}
                        placeholder="e.g. 52.160.10.1"
                      />
                    </div>
                  )}
                  {formData.connectivity === 'Private endpoint' && (
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.usePrivateEndpoint}
                        onChange={(e) => handleInputChange('usePrivateEndpoint', e.target.checked)}
                      />
                      <span>Enable private endpoint</span>
                    </label>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1">Public network access scope</label>
                    <select className="azure-select" value={formData.publicNetworkAccessScope} onChange={(e) => handleInputChange('publicNetworkAccessScope', e.target.value as any)}>
                      <option>Enable from all networks</option>
                      <option>Enable from selected virtual networks and IP addresses</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground mb-4">Data protection</h3>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={formData.softDelete} onChange={(e) => handleInputChange('softDelete', e.target.checked)} />
                  <span>Enable soft delete for blobs</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Days to retain deleted blobs</label>
                    <input type="number" className="azure-input" value={formData.daysToRetainDeletedBlobs} onChange={(e) => handleInputChange('daysToRetainDeletedBlobs', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Days to retain deleted containers</label>
                    <input type="number" className="azure-input" value={formData.daysToRetainDeletedContainers} onChange={(e) => handleInputChange('daysToRetainDeletedContainers', Number(e.target.value))} />
                  </div>
                </div>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={formData.versioning} onChange={(e) => handleInputChange('versioning', e.target.checked)} />
                  <span>Enable versioning</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={formData.enableBlobChangeFeed} onChange={(e) => handleInputChange('enableBlobChangeFeed', e.target.checked)} />
                  <span>Enable blob change feed</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" checked={formData.enableImmutabilitySupport} onChange={(e) => handleInputChange('enableImmutabilitySupport', e.target.checked)} />
                  <span>Enable version-level immutability support</span>
                </label>
                <div>
                  <label className="block text-sm font-medium mb-1">Days to retain deleted file shares</label>
                  <input type="number" className="azure-input" value={formData.daysToRetainDeletedFileShares} onChange={(e) => handleInputChange('daysToRetainDeletedFileShares', Number(e.target.value))} />
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground mb-4">Encryption</h3>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Key type</label>
                  <select
                    className="azure-select"
                    value={formData.encryptionKeyType}
                    onChange={(e) => handleInputChange('encryptionKeyType', e.target.value as any)}
                  >
                    <option>Microsoft-managed</option>
                    <option>Customer-managed</option>
                  </select>
                </div>
                {formData.encryptionKeyType === 'Customer-managed' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Key URI</label>
                    <input
                      className="azure-input"
                      value={formData.cmkUri}
                      onChange={(e) => handleInputChange('cmkUri', e.target.value)}
                      placeholder="https://myvault.vault.azure.net/keys/keyname/version"
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground mb-4">Tags</h3>
                <p className="text-sm text-foreground-secondary">Add name/value pairs to categorize resources and view consolidated billing.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input className="azure-input" placeholder="e.g. environment" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Value</label>
                    <input className="azure-input" placeholder="e.g. production" />
                  </div>
                </div>
                <div className="text-sm text-foreground-secondary">Tag persistence is simplified in this demo; use the Resource Detail page to edit saved tags.</div>
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground">Review + create</h3>
                <div className="bg-card border border-card-border rounded p-4 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    <div className="font-medium">Subscription</div><div className="text-foreground-secondary">{formData.subscription}</div>
                    <div className="font-medium">Resource group</div><div className="text-foreground-secondary">{formData.resourceGroup}</div>
                    <div className="font-medium">Location</div><div className="text-foreground-secondary">{formData.region.replace(/^\([^\)]+\)\s*/, '')}</div>
                    <div className="font-medium">Storage account name</div><div className="text-foreground-secondary">{formData.storageAccountName || '-'}</div>
                    <div className="font-medium">Performance</div><div className="text-foreground-secondary">{formData.performance}</div>
                    <div className="font-medium">Replication</div><div className="text-foreground-secondary">{formData.redundancy}</div>
                    <div className="font-medium">Access tier</div><div className="text-foreground-secondary">{formData.accessTier}</div>
                    <div className="font-medium">Large file shares</div><div className="text-foreground-secondary">{formData.enableLargeFileShares ? 'Enabled' : 'Disabled'}</div>
                    <div className="col-span-2 pt-2 font-medium">Security</div>
                    <div>Require secure transfer</div><div className="text-foreground-secondary">{formData.requireSecureTransfer ? 'Enabled' : 'Disabled'}</div>
                    <div>Blob anonymous access</div><div className="text-foreground-secondary">{formData.allowAnonymousAccess ? 'Enabled' : 'Disabled'}</div>
                    <div>Storage account key access</div><div className="text-foreground-secondary">{formData.enableAccountKeyAccess ? 'Enabled' : 'Disabled'}</div>
                    <div>Default to Entra auth in portal</div><div className="text-foreground-secondary">{formData.defaultToEntraAuthInPortal ? 'Enabled' : 'Disabled'}</div>
                    <div>Minimum TLS version</div><div className="text-foreground-secondary">{formData.minimumTlsVersion}</div>
                    <div>Permitted scope for copy operations</div><div className="text-foreground-secondary">{formData.permittedCopyScope}</div>
                    <div className="col-span-2 pt-2 font-medium">Networking</div>
                    <div>Public network access</div><div className="text-foreground-secondary">{formData.publicNetworkAccess}</div>
                    <div>Public network access scope</div><div className="text-foreground-secondary">{formData.publicNetworkAccessScope}</div>
                    <div>Private endpoint</div><div className="text-foreground-secondary">{formData.usePrivateEndpoint ? 'Enabled' : 'Disabled'}</div>
                    <div>Firewall IP</div><div className="text-foreground-secondary">{formData.firewallIp || '-'}</div>
                    <div className="col-span-2 pt-2 font-medium">Data protection</div>
                    <div>Soft delete</div><div className="text-foreground-secondary">{formData.softDelete ? 'Enabled' : 'Disabled'}</div>
                    <div>Blob retention (days)</div><div className="text-foreground-secondary">{formData.daysToRetainDeletedBlobs}</div>
                    <div>Container retention (days)</div><div className="text-foreground-secondary">{formData.daysToRetainDeletedContainers}</div>
                    <div>File shares retention (days)</div><div className="text-foreground-secondary">{formData.daysToRetainDeletedFileShares}</div>
                    <div>Versioning</div><div className="text-foreground-secondary">{formData.versioning ? 'Enabled' : 'Disabled'}</div>
                    <div>Change feed</div><div className="text-foreground-secondary">{formData.enableBlobChangeFeed ? 'Enabled' : 'Disabled'}</div>
                    <div>Immutability</div><div className="text-foreground-secondary">{formData.enableImmutabilitySupport ? 'Enabled' : 'Disabled'}</div>
                    <div className="col-span-2 pt-2 font-medium">Encryption</div>
                    <div>Key type</div><div className="text-foreground-secondary">{formData.encryptionKeyType}</div>
                    {formData.encryptionKeyType === 'Customer-managed' && (<>
                      <div>Key URI</div><div className="text-foreground-secondary">{formData.cmkUri || '-'}</div>
                    </>)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="fixed bottom-0 left-0 right-0 bg-background-elevated border-t border-border p-4">
            <div className="flex justify-between items-center max-w-2xl">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="azure-button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleCancel}
                  className="azure-button-secondary"
                >
                  Cancel
                </button>
                
                {currentStep === steps.length - 1 ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!isValid}
                    className="azure-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review + create
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={currentStep === 0 && !isValid}
                    className="azure-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateStorageAccount;