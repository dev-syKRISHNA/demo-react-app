import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { BladePanel } from '@/components/BladePanel';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

export const VirtualNetworkCreateBlade: React.FC = () => {
  const navigate = useNavigate();
  const { tabId } = useParams<{ tabId: string }>();
  const [values, setValues] = useState({
    name: '',
    region: '(Americas) East US',
    addressSpace: '10.0.0.0/16',
  });

  const handleClose = () => {
    navigate(`/virtual-machines/create/${tabId}`);
  };

  const handleCreate = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      resourceType: 'virtual_network',
      source: 'vm_wizard_child_blade',
    });

    // Simplified - just log for now
    console.log('Creating VNet:', values);

    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
      resourceType: 'virtual_network',
      source: 'vm_wizard_child_blade',
    });

    handleClose();
  };

  return (
    <BladePanel isOpen title="Create virtual network" onClose={handleClose} width="md">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Name *
          </label>
          <input
            type="text"
            className="azure-input w-full"
            placeholder="my-vnet"
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
            Address space *
          </label>
          <input
            type="text"
            className="azure-input w-full"
            placeholder="10.0.0.0/16"
            value={values.addressSpace}
            onChange={(e) => setValues({ ...values, addressSpace: e.target.value })}
          />
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
