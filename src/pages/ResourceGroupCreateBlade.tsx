import { useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { BladePanel } from '@/components/BladePanel';
import { actions } from '@/lib/store';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

export const ResourceGroupCreateBlade: React.FC = () => {
  const navigate = useNavigate();
  const { tabId } = useParams<{ tabId: string }>();
  const [values, setValues] = useState({
    name: '',
    region: '(Americas) East US',
    environment: 'production',
    owner: 'team-cognior',
    lockType: 'Not locked',
    inheritTags: false,
  });
  const [currentStep, setCurrentStep] = useState<'basics' | 'tags' | 'advanced' | 'review'>('basics');

  const handleClose = () => {
    navigate(`/virtual-machines/create/${tabId}`);
  };

  const handleCreate = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      resourceType: 'resource_group',
      source: 'vm_wizard_child_blade',
    });

    actions.createResourceGroup({
      name: values.name,
      subscription: 'VS Enterprise-Rakesh',
      location: values.region.replace(/^\([^)]+\)\s*/, ''),
      tags: {
        environment: values.environment,
        owner: values.owner,
      },
    });

    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, {
      resourceType: 'resource_group',
      source: 'vm_wizard_child_blade',
    });

    handleClose();
  };

  return (
    <BladePanel isOpen title="Create resource group" onClose={handleClose} width="lg">
      <div className="flex h-full">
        <aside className="w-56 border-r border-border pr-4 mr-4">
          <nav className="space-y-2 mt-2">
            {[
              { id: 'basics', label: 'Basics' },
              { id: 'tags', label: 'Tags' },
              { id: 'advanced', label: 'Advanced' },
              { id: 'review', label: 'Review + create' },
            ].map((step) => (
              <button
                key={step.id}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  currentStep === step.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-secondary text-foreground'
                }`}
                onClick={() => setCurrentStep(step.id as typeof currentStep)}
              >
                {step.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 space-y-6">
          {currentStep === 'basics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Basics</h2>
                <p className="text-sm text-foreground-secondary">
                  Choose a name and region for the new resource group.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  className="azure-input w-full"
                  placeholder="my-resource-group"
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
            </div>
          )}

          {currentStep === 'tags' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Tags</h2>
                <p className="text-sm text-foreground-secondary">
                  Apply metadata tags to help organize and track your resources.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Environment
                </label>
                <select
                  className="azure-select w-full"
                  value={values.environment}
                  onChange={(e) => setValues({ ...values, environment: e.target.value })}
                >
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                  <option value="dev">dev</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Owner
                </label>
                <input
                  type="text"
                  className="azure-input w-full"
                  placeholder="team-cognior"
                  value={values.owner}
                  onChange={(e) => setValues({ ...values, owner: e.target.value })}
                />
              </div>
            </div>
          )}

          {currentStep === 'advanced' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Advanced</h2>
                <p className="text-sm text-foreground-secondary">
                  Configure locks and tag inheritance for this resource group.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Lock type
                </label>
                <select
                  className="azure-select w-full"
                  value={values.lockType}
                  onChange={(e) => setValues({ ...values, lockType: e.target.value })}
                >
                  <option value="Not locked">Not locked</option>
                  <option value="ReadOnly">Read-only</option>
                  <option value="CanNotDelete">Delete</option>
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  id="inheritTags"
                  type="checkbox"
                  className="azure-checkbox"
                  checked={values.inheritTags}
                  onChange={(e) => setValues({ ...values, inheritTags: e.target.checked })}
                />
                <label htmlFor="inheritTags" className="text-sm text-foreground">
                  Inherit tags from subscription
                </label>
              </div>
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Review + create</h2>
                <p className="text-sm text-foreground-secondary">
                  Review the configuration before creating the resource group.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-border rounded p-3 text-sm">
                  <div className="font-medium mb-1">Summary</div>
                  <dl className="space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-foreground-secondary">Name</dt>
                      <dd className="text-foreground font-medium">{values.name || '--'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-foreground-secondary">Region</dt>
                      <dd className="text-foreground font-medium">{values.region}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-foreground-secondary">Environment</dt>
                      <dd className="text-foreground font-medium">{values.environment}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-foreground-secondary">Owner</dt>
                      <dd className="text-foreground font-medium">{values.owner}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-foreground-secondary">Lock</dt>
                      <dd className="text-foreground font-medium">{values.lockType}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-6 border-t border-border mt-4">
            <div className="text-sm text-foreground-secondary">
              {currentStep === 'basics' && 'Step 1 of 4'}
              {currentStep === 'tags' && 'Step 2 of 4'}
              {currentStep === 'advanced' && 'Step 3 of 4'}
              {currentStep === 'review' && 'Step 4 of 4'}
            </div>
            <div className="flex gap-3">
              <button onClick={handleClose} className="azure-button-secondary">
                Cancel
              </button>
              {currentStep !== 'basics' && (
                <button
                  type="button"
                  className="azure-button-secondary"
                  onClick={() => {
                    if (currentStep === 'tags') setCurrentStep('basics');
                    else if (currentStep === 'advanced') setCurrentStep('tags');
                    else if (currentStep === 'review') setCurrentStep('advanced');
                  }}
                >
                  Previous
                </button>
              )}
              {currentStep !== 'review' && (
                <button
                  type="button"
                  className="azure-button-primary"
                  disabled={currentStep === 'basics' && !values.name}
                  onClick={() => {
                    if (currentStep === 'basics') setCurrentStep('tags');
                    else if (currentStep === 'tags') setCurrentStep('advanced');
                    else if (currentStep === 'advanced') setCurrentStep('review');
                  }}
                >
                  Next
                </button>
              )}
              {currentStep === 'review' && (
                <button
                  onClick={handleCreate}
                  disabled={!values.name}
                  className="azure-button-primary disabled:opacity-50"
                >
                  Create
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </BladePanel>
  );
};
