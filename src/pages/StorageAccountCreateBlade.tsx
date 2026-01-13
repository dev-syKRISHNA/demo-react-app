import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { BladePanel } from '@/components/BladePanel';
import { actions } from '@/lib/store';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

export const StorageAccountCreateBlade: React.FC = () => {
  const navigate = useNavigate();
  const { tabId } = useParams<{ tabId: string }>();
  const [values, setValues] = useState({
    name: '',
    region: '(Americas) East US',
    performance: 'Standard' as 'Standard' | 'Premium',
    redundancy: 'LRS',
  });

  const handleClose = () => {
    navigate(`/virtual-machines/create/${tabId}`);
  };

  const handleCreate = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      resourceType: 'storage_account',
      source: 'vm_wizard_child_blade',
    });

    actions.createStorageAccount({
      name: values.name,
      subscription: 'VS Enterprise-Rakesh',
      resourceGroup: 'Production-RG',
      location: values.region.replace(/^\([^)]+\)\s*/, ''),
      redundancy: values.redundancy,
      performance: values.performance,
      tags: {},
    });

    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
      resourceType: 'storage_account',
      source: 'vm_wizard_child_blade',
    });

    handleClose();
  };

  return (
    <BladePanel isOpen title="Create storage account" onClose={handleClose} width="md">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Name *
          </label>
          <input
            type="text"
            className="azure-input w-full"
            placeholder="mystorageaccount"
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
            Performance *
          </label>
          <select
            className="azure-select w-full"
            value={values.performance}
            onChange={(e) => setValues({ ...values, performance: e.target.value as 'Standard' | 'Premium' })}
          >
            <option value="Standard">Standard</option>
            <option value="Premium">Premium</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Redundancy *
          </label>
          <select
            className="azure-select w-full"
            value={values.redundancy}
            onChange={(e) => setValues({ ...values, redundancy: e.target.value })}
          >
            <option value="LRS">Locally-redundant storage (LRS)</option>
            <option value="GRS">Geo-redundant storage (GRS)</option>
            <option value="ZRS">Zone-redundant storage (ZRS)</option>
            <option value="GZRS">Geo-zone-redundant storage (GZRS)</option>
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
