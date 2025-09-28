import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { AnalyticsEvents, mockResourceGroups, mockSubscriptions, trackEvent } from '@/data/mockData';
import { actions } from '@/lib/store';

interface FormData {
  subscription: string;
  resourceGroup: string;
  name: string;
  server: string;
  region: string;
  computeTier: string;
  slo: string;
  connectivity: 'Public endpoint' | 'Private endpoint';
  firewallIp?: string;
  vnetRule?: string;
  defender: boolean;
  tde: boolean;
  source: 'Blank' | 'Sample' | 'Backup';
  collation: string;
  backupPolicy: 'Periodic' | 'Continuous';
  retention: string;
}

const CreateSqlDatabase: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    subscription: mockSubscriptions[0]?.name || 'Cognior Enterprise',
    resourceGroup: mockResourceGroups[0]?.name || 'Analytics',
    name: '',
    server: 'sql-server-001',
    region: '(US) East US',
    computeTier: 'vCore',
    slo: 'General Purpose',
    connectivity: 'Public endpoint',
    defender: true,
    tde: true,
    source: 'Blank',
    collation: 'SQL_Latin1_General_CP1_CI_AS',
    backupPolicy: 'Periodic',
    retention: '7 days',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const steps = ['Basics', 'Networking', 'Security', 'Additional settings', 'Backup policy', 'Tags', 'Review + create'];

  useEffect(() => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, { resourceType: 'SQL Database' });
  }, []);

  useEffect(() => {
    const e: Record<string, string> = {};
    if (!form.name) e.name = 'Database name is required';
    if (!form.subscription) e.subscription = 'Subscription is required';
    if (!form.resourceGroup) e.resourceGroup = 'Resource group is required';
    setErrors(e);
  }, [form]);

  const set = (k: keyof FormData, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const next = () => {
    if (step === 0 && (errors.name || errors.subscription || errors.resourceGroup)) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = () => {
    const created = actions.createSqlDatabase({
      name: form.name,
      subscription: form.subscription,
      resourceGroup: form.resourceGroup,
      server: form.server,
      location: form.region.replace(/^\([^\)]+\)\s*/, ''),
      computeTier: form.computeTier,
      slo: form.slo,
      networking: form.connectivity,
      backupPolicy: `${form.backupPolicy} (${form.retention})`,
    });
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_COMPLETE, { resourceType: 'SQL Database', resourceName: created.name });
    navigate('/sql-databases');
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
            <span className="text-foreground">Create SQL database</span>
          </nav>
        </div>
      </div>

      <div className="flex-1 p-6">
        <h1 className="text-2xl font-semibold text-foreground mb-6">Create SQL database</h1>

        <div className="flex space-x-8 mb-6 border-b border-border">
          {steps.map((s, i) => (
            <button key={s} className={`pb-2 text-sm font-medium border-b-2 ${i === step ? 'text-primary border-primary' : 'text-foreground-secondary border-transparent'}`} onClick={() => setStep(i)}>
              {s}
            </button>
          ))}
        </div>

        <div className="max-w-2xl space-y-6">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Project details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Subscription *</label>
                    <select className="azure-select" value={form.subscription} onChange={(e) => set('subscription', e.target.value)}>
                      {mockSubscriptions.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Resource group *</label>
                    <select className="azure-select" value={form.resourceGroup} onChange={(e) => set('resourceGroup', e.target.value)}>
                      {mockResourceGroups.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Database details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Database name *</label>
                    <input className={`azure-input ${errors.name ? 'border-error' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Server</label>
                      <input className="azure-input" value={form.server} onChange={(e) => set('server', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Region *</label>
                      <select className="azure-select" value={form.region} onChange={(e) => set('region', e.target.value)}>
                        <option value="(US) East US">(US) East US</option>
                        <option value="(US) West US 2">(US) West US 2</option>
                        <option value="(Europe) West Europe">(Europe) West Europe</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Compute tier</label>
                      <select className="azure-select" value={form.computeTier} onChange={(e) => set('computeTier', e.target.value)}>
                        <option>vCore</option>
                        <option>DTU</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Service level objective</label>
                      <select className="azure-select" value={form.slo} onChange={(e) => set('slo', e.target.value)}>
                        <option>General Purpose</option>
                        <option>Business Critical</option>
                        <option>Hyperscale</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Networking</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Connectivity</label>
                  <select className="azure-select" value={form.connectivity} onChange={(e) => set('connectivity', e.target.value as any)}>
                    <option>Public endpoint</option>
                    <option>Private endpoint</option>
                  </select>
                </div>
                {form.connectivity === 'Public endpoint' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Firewall IP (optional)</label>
                    <input className="azure-input" value={form.firewallIp || ''} onChange={(e) => set('firewallIp', e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Security</h3>
              <label className="flex items-center space-x-2"><input type="checkbox" checked={form.defender} onChange={(e) => set('defender', e.target.checked)} /><span>Microsoft Defender for SQL</span></label>
              <label className="flex items-center space-x-2"><input type="checkbox" checked={form.tde} onChange={(e) => set('tde', e.target.checked)} /><span>Transparent data encryption (TDE)</span></label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Additional settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Use existing data</label>
                  <select className="azure-select" value={form.source} onChange={(e) => set('source', e.target.value as any)}>
                    <option>Blank</option>
                    <option>Sample</option>
                    <option>Backup</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Collation</label>
                  <input className="azure-input" value={form.collation} onChange={(e) => set('collation', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Backup policy</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Policy</label>
                  <select className="azure-select" value={form.backupPolicy} onChange={(e) => set('backupPolicy', e.target.value as any)}>
                    <option>Periodic</option>
                    <option>Continuous</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Retention</label>
                  <input className="azure-input" value={form.retention} onChange={(e) => set('retention', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Tags</h3>
              <p className="text-sm text-foreground-secondary">Tags editor would be implemented here.</p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Review + create</h3>
              <div className="bg-card border border-card-border rounded p-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>Name</div><div className="text-foreground-secondary">{form.name || '-'}</div>
                  <div>Server</div><div className="text-foreground-secondary">{form.server}</div>
                  <div>Compute</div><div className="text-foreground-secondary">{form.computeTier} / {form.slo}</div>
                  <div>Region</div><div className="text-foreground-secondary">{form.region}</div>
                  <div>Networking</div><div className="text-foreground-secondary">{form.connectivity}</div>
                  <div>Backup</div><div className="text-foreground-secondary">{form.backupPolicy} ({form.retention})</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-background-elevated border-t border-border p-4">
          <div className="flex justify-between items-center max-w-2xl">
            <button onClick={prev} disabled={step === 0} className="azure-button-secondary disabled:opacity-50">Previous</button>
            <div className="flex space-x-3">
              {step === steps.length - 1 ? (
                <button onClick={submit} disabled={!!errors.name} className="azure-button-primary disabled:opacity-50">Create</button>
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

export default CreateSqlDatabase;


