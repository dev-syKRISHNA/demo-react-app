import { useNavigate, useParams } from 'react-router-dom';
import { BladePanel } from '@/components/BladePanel';
import { useState } from 'react';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

export const NetworkSecurityGroupCreateBlade: React.FC = () => {
  const navigate = useNavigate();
  const { tabId } = useParams<{ tabId: string }>();
  const [values, setValues] = useState({
    name: '',
    region: '(Americas) East US',
  });

  const handleClose = () => {
    navigate(`/virtual-machines/create/${tabId}`);
  };

  const handleCreate = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      resourceType: 'network_security_group',
      source: 'vm_wizard_child_blade',
    });

    // Create NSG via store action (simplified)
    console.log('Creating NSG:', values);

    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
      resourceType: 'network_security_group',
      source: 'vm_wizard_child_blade',
    });

    handleClose();
  };

  return (
    <BladePanel isOpen title="Create network security group" onClose={handleClose} width="md">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Name *
          </label>
          <input
            type="text"
            className="azure-input w-full"
            placeholder="my-nsg"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Region *
          </label>
          <select
            className="azure-select w-full"
            value={values.region}
            onChange={(e) => setValues({ ...values, region: e.target.value })}
          >
            <option value="(Americas) East US">(Americas) East US</option>
            <option value="(Americas) West US 2">(Americas) West US 2</option>
            <option value="(Europe) West Europe">(Europe) West Europe</option>
            <option value="(Asia Pacific) Central India">(Asia Pacific) Central India</option>
          </select>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-4">
          <h3 className="font-medium text-foreground mb-2">Default rules</h3>
          <p className="text-sm text-foreground-secondary">
            Default security rules will be created to allow inbound traffic from virtual networks 
            and outbound traffic to any destination.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-border">
          <button onClick={handleClose} className="azure-button-secondary">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!values.name}
            className="azure-button-primary disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </BladePanel>
  );
};
