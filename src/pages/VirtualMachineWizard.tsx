import { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';
import { WizardEngine, WizardStepSchema } from '@/components/WizardEngine';
import { vmCreateSteps } from '@/data/vmCreateBlueprint';
import { useAppStore, actions } from '@/lib/store';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

type Props = {
  initialTab: string;
  onTabChange: (tabId: string) => void;
};

export const VirtualMachineWizard: React.FC<Props> = ({ initialTab, onTabChange }) => {
  const navigate = useNavigate();
  const resourceGroups = useAppStore(state => state.resourceGroups);
  const storageAccounts = useAppStore(state => state.resources.filter(r => r.type === 'Storage Account'));
  const [values, setValues] = useState(vmCreateSteps.defaultValues);
  const [currentStep, setCurrentStep] = useState(
    vmCreateSteps.steps.findIndex(s => s.id === initialTab)
  );

  useEffect(() => {
    try {
      const lastRg = window.localStorage.getItem('lastCreatedResourceGroup');
      if (lastRg) {
        setValues(prev => ({ ...prev, resourceGroup: lastRg }));
        window.localStorage.removeItem('lastCreatedResourceGroup');
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleTabChange = (tabIndex: number) => {
    const newTab = vmCreateSteps.steps[tabIndex].id;
    onTabChange(newTab);
    setCurrentStep(tabIndex);
  };

  const handleFieldChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleCreateNew = (type: string) => {
    const currentTab = vmCreateSteps.steps[currentStep].id;
    navigate(`/virtual-machines/create/${currentTab}/${type}/new`);
  };

  const handleSubmit = async (finalValues: any) => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      resourceType: 'virtual_machine',
      blueprint: 'virtual-machine',
    });

    // Create VM via store action
    actions.createVirtualMachine({
      name: finalValues.vmName,
      subscription: finalValues.subscription,
      resourceGroup: finalValues.resourceGroup,
      location: finalValues.region.replace(/^\([^)]+\)\s*/, ''),
      image: finalValues.image,
      size: finalValues.size,
      authenticationType: finalValues.image.includes('Windows') ? 'password' : 'ssh',
      username: finalValues.adminUsername,
      tags: {
        environment: finalValues.tagEnvironment,
        owner: finalValues.tagOwner,
        costCenter: finalValues.tagCostCenter,
        project: finalValues.tagProject,
      },
    });

    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
      resourceType: 'virtual_machine',
      blueprint: 'virtual-machine',
    });

    // Navigate to VM list after creation
    setTimeout(() => {
      navigate('/virtual-machines');
    }, 1500);
  };

  // Custom field renderer for "Create new" links and special fields
  const renderCustomField = (field: any, value: any, onChange: (key: string, value: any) => void) => {
    // Only handle custom type fields
    if (field.type !== 'custom') {
      return null;
    }

    // Handle VM size picker
    if (field.key === 'size') {
      return (
        <button
          onClick={() => handleCreateNew('vm-sizes')}
          className="w-full text-left p-3 border border-border rounded-md bg-background hover:bg-secondary transition-colors flex items-center justify-between"
        >
          <span>{value || 'Select size'}</span>
          <span className="text-foreground-secondary text-sm">Choose size</span>
        </button>
      );
    }

    // Map field keys to their respective create routes
    const createRouteMap: Record<string, string> = {
      resourceGroup: 'resource-groups',
      vnet: 'vnets',
      subnet: 'subnets',
      publicIp: 'public-ips',
      nsg: 'nsgs',
      bootDiagnosticsStorageAccount: 'storage-accounts',
      diagnosticsStorageAccount: 'storage-accounts',
      diskEncryptionSet: 'disk-encryption-sets',
      userAssignedIdentity: 'managed-identities',
      backupVault: 'backup-vaults',
      backupPolicy: 'backup-policies',
      logAnalyticsWorkspace: 'log-analytics-workspaces',
      applicationInsights: 'application-insights',
      dataCollectionRule: 'data-collection-rules',
      proximityPlacementGroup: 'proximity-placement-groups',
      availabilitySet: 'availability-sets',
      hostGroup: 'host-groups',
      capacityReservationGroup: 'capacity-reservation-groups',
      loadBalancer: 'load-balancers',
    };

    // Handle all custom fields with dropdown + "Create new" pattern
    if (createRouteMap[field.key]) {
      const getOptions = () => {
        switch (field.key) {
          case 'resourceGroup':
            return resourceGroups;
          case 'bootDiagnosticsStorageAccount':
          case 'diagnosticsStorageAccount':
            return storageAccounts;
          default:
            return []; // Mock empty for now
        }
      };

      const options = getOptions();
      const displayName = field.key === 'resourceGroup' ? 'name' : 'name';

      return (
        <div className="space-y-1">
          <select
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="azure-select w-full"
          >
            <option value="">(New) {field.label}</option>
            {options.map((item: any) => (
              <option key={item[displayName]} value={item[displayName]}>
                {item[displayName]}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              handleCreateNew(createRouteMap[field.key]);
            }}
            className="text-primary text-sm hover:underline"
          >
            Create new
          </button>
        </div>
      );
    }

    // Fallback for any other custom fields
    return (
      <div className="text-foreground-secondary text-sm">
        Custom field: {field.label}
      </div>
    );
  };

  return (
    <div className="h-screen overflow-auto bg-background">
      <WizardEngine
        steps={vmCreateSteps.steps}
        initialValues={values}
        onSubmit={handleSubmit}
        onTabChange={handleTabChange}
        initialTabIndex={currentStep}
        customFieldRenderer={renderCustomField}
        onFieldChange={handleFieldChange}
      />
    </div>
  );
};