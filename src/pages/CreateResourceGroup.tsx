import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, HelpCircle } from 'lucide-react';
import { 
  trackEvent, 
  AnalyticsEvents,
  mockSubscriptions 
} from '@/data/mockData';
import { actions } from '@/lib/store';

interface FormData {
  subscription: string;
  resourceGroupName: string;
  region: string;
  tags: Record<string, string>;
}

interface ValidationErrors {
  [key: string]: string;
}

const CreateResourceGroup: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    subscription: 'Cognior Enterprise',
    resourceGroupName: '',
    region: '(US) East US',
    tags: {}
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      resourceType: 'Resource Group'
    });
  }, []);

  useEffect(() => {
    validateForm();
  }, [formData]);

  const validateForm = () => {
    const newErrors: ValidationErrors = {};

    if (!formData.resourceGroupName) {
      newErrors.resourceGroupName = 'Resource group name is required';
    } else if (formData.resourceGroupName.length < 1 || formData.resourceGroupName.length > 90) {
      newErrors.resourceGroupName = 'Resource group name must be between 1 and 90 characters';
    } else if (!/^[\w\-\.\(\)]+$/.test(formData.resourceGroupName)) {
      newErrors.resourceGroupName = 'Resource group name can only contain alphanumeric characters, periods, underscores, hyphens, and parentheses';
    }

    if (!formData.subscription) {
      newErrors.subscription = 'Subscription is required';
    }

    if (!formData.region) {
      newErrors.region = 'Region is required';
    }

    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0);
  };

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    trackEvent(AnalyticsEvents.FORM_FIELD_FOCUS, {
      field,
      resourceType: 'Resource Group'
    });
  };

  const handleInputBlur = (field: keyof FormData) => {
    trackEvent(AnalyticsEvents.FORM_FIELD_BLUR, {
      field,
      resourceType: 'Resource Group'
    });
  };

  const handleSubmit = () => {
    if (!isValid) {
      trackEvent(AnalyticsEvents.FORM_VALIDATION_ERROR, {
        errors: Object.keys(errors),
        resourceType: 'Resource Group'
      });
      return;
    }

    const created = actions.createResourceGroup({
      name: formData.resourceGroupName,
      subscription: formData.subscription,
      location: formData.region.replace(/^\([^\)]+\)\s*/, ''),
      tags: formData.tags,
    });

    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
      resourceType: 'Resource Group',
      resourceName: created.name,
      subscription: created.subscription,
      region: created.location
    });
    
    navigate('/resource-groups');
  };

  const handleCancel = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_CANCEL, {
      resourceType: 'Resource Group'
    });
    navigate('/resource-groups');
  };

  const handleClose = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_CANCEL, {
      resourceType: 'Resource Group'
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
              onClick={() => navigate('/resource-groups')}
              className="cursor-pointer hover:text-foreground"
            >
              Resource groups
            </span>
            <ChevronRight size={16} className="inline mx-2" />
            <span className="text-foreground">Create resource group</span>
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

      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Create resource group</h1>

        <div className="max-w-2xl space-y-6">
          <div className="bg-accent/50 border border-accent-foreground/20 rounded p-4 text-sm">
            <p className="text-foreground-secondary">
              A resource group is a container that holds related resources for an Azure solution. 
              The resource group can include all the resources for the solution, or only those resources 
              that you want to manage as a group.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Project details</h3>

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
                  <button className="ml-1 text-foreground-muted hover:text-foreground">
                    <HelpCircle size={14} />
                  </button>
                </label>
                <input
                  type="text"
                  value={formData.resourceGroupName}
                  onChange={(e) => handleInputChange('resourceGroupName', e.target.value)}
                  onBlur={() => handleInputBlur('resourceGroupName')}
                  className={`azure-input ${errors.resourceGroupName ? 'border-error' : ''}`}
                  placeholder="Enter resource group name"
                />
                {errors.resourceGroupName && (
                  <p className="text-error text-sm mt-1">{errors.resourceGroupName}</p>
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
                  <option value="(US) East US">(US) East US</option>
                  <option value="(US) West US 2">(US) West US 2</option>
                  <option value="(US) Central US">(US) Central US</option>
                  <option value="(Europe) West Europe">(Europe) West Europe</option>
                  <option value="(Europe) North Europe">(Europe) North Europe</option>
                  <option value="(Asia Pacific) Southeast Asia">(Asia Pacific) Southeast Asia</option>
                  <option value="(Asia Pacific) East Asia">(Asia Pacific) East Asia</option>
                </select>
                {errors.region && (
                  <p className="text-error text-sm mt-1">{errors.region}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4">Tags</h3>
            <p className="text-sm text-foreground-secondary mb-4">
              Tags are name/value pairs that enable you to categorize resources and view consolidated billing 
              by applying the same tag to multiple resources and resource groups.
            </p>
            
            <div className="bg-secondary/50 rounded p-4 text-sm text-foreground-secondary">
              Tag configuration would be implemented here in a full version.
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-background-elevated border-t border-border p-4">
          <div className="flex justify-between items-center max-w-2xl">
            <div></div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                className="azure-button-secondary"
              >
                Cancel
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={!isValid}
                className="azure-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateResourceGroup;