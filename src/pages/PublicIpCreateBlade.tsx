import { useNavigate, useParams } from 'react-router-dom';
import { BladePanel } from '@/components/BladePanel';
import { useState } from 'react';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

export const PublicIpCreateBlade: React.FC = () => {
  const navigate = useNavigate();
  const { tabId } = useParams<{ tabId: string }>();
  const [values, setValues] = useState({
    name: '',
    region: '(Americas) East US',
    sku: 'Basic',
    allocationMethod: 'Static',
  });

  const handleClose = () => {
    navigate(`/virtual-machines/create/${tabId}`);
  };

  const handleCreate = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      resourceType: 'public_ip',
      source: 'vm_wizard_child_blade',
    });

    // Create Public IP via store action (simplified)
    console.log('Creating Public IP:', values);

    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
      resourceType: 'public_ip',
      source: 'vm_wizard_child_blade',
    });

    handleClose();
  };

  return (
    <BladePanel isOpen title="Create public IP address" onClose={handleClose} width="md">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Name *
          </label>
          <input
            type="text"
            className="azure-input w-full"
            placeholder="my-public-ip"
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

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            SKU *
          </label>
          <select
            className="azure-select w-full"
            value={values.sku}
            onChange={(e) => setValues({ ...values, sku: e.target.value })}
          >
            <option value="Basic">Basic</option>
            <option value="Standard">Standard</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Assignment *
          </label>
          <select
            className="azure-select w-full"
            value={values.allocationMethod}
            onChange={(e) => setValues({ ...values, allocationMethod: e.target.value })}
          >
            <option value="Static">Static</option>
            <option value="Dynamic">Dynamic</option>
          </select>
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
