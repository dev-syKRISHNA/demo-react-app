import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, HelpCircle } from 'lucide-react';
import { AnalyticsEvents, mockResourceGroups, mockSubscriptions, trackEvent } from '@/data/mockData';
import { actions } from '@/lib/store';

type OS = 'Linux' | 'Windows';

const runtimes: Record<OS, { name: string; versions: string[] }[]> = {
  Linux: [
    { name: '.NET', versions: ['8', '7'] },
    { name: 'Node.js', versions: ['22 LTS', '20 LTS', '18 LTS'] },
    { name: 'Python', versions: ['3.12', '3.11', '3.10'] },
    { name: 'Java', versions: ['21', '17', '11'] },
  ],
  Windows: [
    { name: '.NET', versions: ['8', '7'] },
    { name: 'Node.js', versions: ['20 LTS', '18 LTS'] },
    { name: 'Python', versions: ['3.11', '3.10'] },
    { name: 'Java', versions: ['21', '17', '11'] },
  ],
};

interface FormData {
  subscription: string;
  resourceGroup: string;
  name: string;
  runtimeStack: string;
  runtimeVersion: string;
  region: string;
  os: OS;
  hostingPlan: 'Consumption' | 'App Service Plan' | 'Dedicated';
  zoneRedundant: boolean;
  storageAccount?: string;
  appInsights: boolean;
  tags: Record<string, string>;
}

const CreateFunctionApp: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    subscription: mockSubscriptions[0]?.name || 'Cognior Enterprise',
    resourceGroup: mockResourceGroups[0]?.name || 'Analytics',
    name: '',
    runtimeStack: '.NET',
    runtimeVersion: '8',
    region: '(US) East US',
    os: 'Linux',
    hostingPlan: 'Consumption',
    zoneRedundant: false,
    appInsights: true,
    tags: {},
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const steps = ['Hosting', 'Basics', 'Storage', 'Azure OpenAI', 'Networking', 'Monitoring', 'Deployment', 'Authentication', 'Tags', 'Review + create'];

  useEffect(() => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, { resourceType: 'Function App' });
  }, []);

  useEffect(() => {
    validate();
  }, [form]);

  const availableRuntimes = useMemo(() => runtimes[form.os], [form.os]);
  const availableVersions = useMemo(
    () => availableRuntimes.find((r) => r.name === form.runtimeStack)?.versions || [],
    [availableRuntimes, form.runtimeStack]
  );

  const set = (key: keyof FormData, value: any) => setForm((p) => ({ ...p, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name) e.name = 'Function app name is required';
    else if (!/^[a-z0-9-]{2,60}$/.test(form.name)) e.name = 'Use 2-60 lowercase letters, numbers, and hyphens';
    if (!form.subscription) e.subscription = 'Subscription is required';
    if (!form.resourceGroup) e.resourceGroup = 'Resource group is required';
    if (!form.runtimeStack) e.runtimeStack = 'Runtime stack is required';
    if (!form.runtimeVersion) e.runtimeVersion = 'Runtime version is required';
    if (!form.region) e.region = 'Region is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (currentStep === 1 && !validate()) return;
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_STEP, { resourceType: 'Function App', toStep: steps[currentStep + 1] });
  };

  const prev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const submit = () => {
    if (!validate()) return;
    const created = actions.createFunctionApp({
      name: form.name,
      subscription: form.subscription,
      resourceGroup: form.resourceGroup,
      location: form.region.replace(/^\([^\)]+\)\s*/, ''),
      runtimeStack: form.runtimeStack,
      runtimeVersion: form.runtimeVersion,
      os: form.os,
      hostingPlan: form.hostingPlan,
      zoneRedundant: form.zoneRedundant,
      appInsights: form.appInsights,
      tags: form.tags,
    });
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, { resourceType: 'Function App', resourceName: created.name });
    navigate('/function-apps');
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center space-x-4">
          <nav className="text-sm text-foreground-secondary">
            <span onClick={() => navigate('/')} className="cursor-pointer hover:text-foreground">Home</span>
            <ChevronRight size={16} className="inline mx-2" />
            <span className="cursor-pointer hover:text-foreground" onClick={() => navigate('/create-resource')}>Create a resource</span>
            <ChevronRight size={16} className="inline mx-2" />
            <span className="text-foreground">Create Function App</span>
          </nav>
        </div>
      </div>

      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Create Function App</h1>

        <div className="flex space-x-8 mb-6 border-b border-border">
          {steps.map((s, i) => (
            <button key={s} className={`pb-2 text-sm font-medium border-b-2 ${i === currentStep ? 'text-primary border-primary' : 'text-foreground-secondary border-transparent'}`} onClick={() => setCurrentStep(i)}>
              {s}
            </button>
          ))}
        </div>

        <div className="max-w-4xl space-y-6">
          {currentStep === 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground">Select a hosting option</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[{
                  key: 'Flex Consumption', desc: 'High scalability with compute choices, virtual networking, and pay-as-you-go.'
                },{
                  key: 'Consumption', desc: 'Pay for compute resources when your functions are running (pay-as-you-go).'
                },{
                  key: 'Functions Premium', desc: 'Deploy multiple function apps on the same plan with event-driven scaling.'
                },{
                  key: 'App Service Plan', desc: 'Run web apps and function apps on the same plan with more compute choices.'
                },{
                  key: 'Container Apps', desc: 'Host function apps with other containerized microservices and pay for compute capacity.'
                }].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => set('hostingPlan', opt.key === 'App Service Plan' ? 'App Service Plan' : opt.key as any)}
                    className={`text-left border rounded p-4 hover:bg-secondary transition-colors ${form.hostingPlan === (opt.key as any) ? 'border-primary' : 'border-card-border'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="font-medium text-foreground">{opt.key}</div>
                      <input type="radio" checked={form.hostingPlan === (opt.key as any)} readOnly />
                    </div>
                    <div className="text-sm text-foreground-secondary mt-2">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Project details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Subscription *</label>
                    <select className="azure-select" value={form.subscription} onChange={(e) => set('subscription', e.target.value)}>
                      {mockSubscriptions.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                    {errors.subscription && <p className="text-error text-sm mt-1">{errors.subscription}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Resource group *</label>
                    <select className="azure-select" value={form.resourceGroup} onChange={(e) => set('resourceGroup', e.target.value)}>
                      {mockResourceGroups.map((g) => (
                        <option key={g.id} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Instance details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Function app name *</label>
                    <input className={`azure-input ${errors.name ? 'border-error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Enter name" />
                    {errors.name && <p className="text-error text-sm mt-1">{errors.name}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Runtime stack *</label>
                      <select className="azure-select" value={form.runtimeStack} onChange={(e) => set('runtimeStack', e.target.value)}>
                        {availableRuntimes.map((r) => (
                          <option key={r.name} value={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Version *</label>
                      <select className="azure-select" value={form.runtimeVersion} onChange={(e) => set('runtimeVersion', e.target.value)}>
                        {availableVersions.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Region *</label>
                      <select className="azure-select" value={form.region} onChange={(e) => set('region', e.target.value)}>
                        <option value="(US) East US">(US) East US</option>
                        <option value="(US) West US 2">(US) West US 2</option>
                        <option value="(Europe) West Europe">(Europe) West Europe</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Operating system *</label>
                      <select className="azure-select" value={form.os} onChange={(e) => set('os', e.target.value as OS)}>
                        <option value="Linux">Linux</option>
                        <option value="Windows">Windows</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Storage</h3>
              <p className="text-sm text-foreground-secondary">Link or create a storage account for the function app in a full version.</p>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Azure OpenAI</h3>
              <p className="text-sm text-foreground-secondary">Configure Azure OpenAI integration in a full version.</p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Hosting</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Hosting plan *</label>
                  <select className="azure-select" value={form.hostingPlan} onChange={(e) => set('hostingPlan', e.target.value as any)}>
                    <option>Flex Consumption</option>
                    <option>Consumption</option>
                    <option>Functions Premium</option>
                    <option>App Service Plan</option>
                    <option>Container Apps</option>
                  </select>
                </div>
                <label className="flex items-center space-x-2"><input type="checkbox" checked={form.zoneRedundant} onChange={(e) => set('zoneRedundant', e.target.checked)} /><span>Zone redundancy</span></label>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Monitoring</h3>
              <label className="flex items-center space-x-2"><input type="checkbox" checked={form.appInsights} onChange={(e) => set('appInsights', e.target.checked)} /><span>Enable Application Insights</span></label>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Deployment</h3>
              <p className="text-sm text-foreground-secondary">Configure source control integration, deployment slots, and app configuration in a full version.</p>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Authentication</h3>
              <p className="text-sm text-foreground-secondary">Configure Microsoft Entra ID authentication in a full version.</p>
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-foreground mb-4">Tags</h3>
              <p className="text-sm text-foreground-secondary">Tags editor would be implemented here.</p>
            </div>
          )}

          {currentStep === 9 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Review + create</h3>
              <div className="bg-card border border-card-border rounded p-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>Subscription</div><div className="text-foreground-secondary">{form.subscription}</div>
                  <div>Resource group</div><div className="text-foreground-secondary">{form.resourceGroup}</div>
                  <div>Name</div><div className="text-foreground-secondary">{form.name || '-'}</div>
                  <div>Runtime</div><div className="text-foreground-secondary">{form.runtimeStack} {form.runtimeVersion}</div>
                  <div>Region</div><div className="text-foreground-secondary">{form.region}</div>
                  <div>OS</div><div className="text-foreground-secondary">{form.os}</div>
                  <div>Plan</div><div className="text-foreground-secondary">{form.hostingPlan}</div>
                  <div>Zone redundancy</div><div className="text-foreground-secondary">{form.zoneRedundant ? 'Enabled' : 'Disabled'}</div>
                  <div>App Insights</div><div className="text-foreground-secondary">{form.appInsights ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-background-elevated border-t border-border p-4">
          <div className="flex justify-between items-center max-w-2xl">
            <button onClick={prev} disabled={currentStep === 0} className="azure-button-secondary disabled:opacity-50">Previous</button>
            <div className="flex space-x-3">
              {currentStep === steps.length - 1 ? (
                <button onClick={submit} disabled={Object.keys(errors).length > 0 || !form.name} className="azure-button-primary disabled:opacity-50">Create</button>
              ) : (
                <button onClick={next} className="azure-button-primary">Next</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateFunctionApp;


