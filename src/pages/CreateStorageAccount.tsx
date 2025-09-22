import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, Info, HelpCircle } from 'lucide-react';
import { 
  trackEvent, 
  AnalyticsEvents,
  mockSubscriptions,
  mockResourceGroups 
} from '@/data/mockData';

interface FormData {
  subscription: string;
  resourceGroup: string;
  storageAccountName: string;
  region: string;
  performance: 'Standard' | 'Premium';
  redundancy: string;
  enableReadAccess: boolean;
}

interface ValidationErrors {
  [key: string]: string;
}

const CreateStorageAccount: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    subscription: 'VS Enterprise-Rakesh',
    resourceGroup: 'Analytics',
    storageAccountName: '',
    region: '(Asia Pacific) Central India',
    performance: 'Standard',
    redundancy: 'Geo-redundant storage (GRS)',
    enableReadAccess: true
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
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
      resourceType: 'Storage Account',
      resourceName: formData.storageAccountName,
      subscription: formData.subscription,
      resourceGroup: formData.resourceGroup
    });
    
    // Simulate creation success
    navigate('/', { 
      state: { 
        message: `Storage account "${formData.storageAccountName}" created successfully` 
      }
    });
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

            {currentStep > 0 && (
              <div className="text-center py-12">
                <p className="text-foreground-secondary">
                  {steps[currentStep]} configuration would be implemented here in a full version.
                </p>
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