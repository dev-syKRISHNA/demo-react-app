import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore, actions } from '@/lib/store';
import { Resource } from '@/data/mockData';

const ResourceDetail: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const resources = useAppStore((s) => s.resources);
  const resource = useMemo(() => resources.find((r) => r.id === id), [resources, id]);
  const [name, setName] = useState(resource?.name || '');
  const [tags, setTags] = useState<Record<string, string>>(resource?.tags || {});
  const [redundancy, setRedundancy] = useState(resource?.tags?.redundancy || '');
  const [runtimeStack, setRuntimeStack] = useState(resource?.tags?.runtimeStack || '');
  const [runtimeVersion, setRuntimeVersion] = useState(resource?.tags?.runtimeVersion || '');

  if (!resource) {
    return (
      <div className="p-6">
        <div className="text-foreground-secondary">Resource not found.</div>
      </div>
    );
  }

  const isStorage = resource.type === 'Storage account';
  const isFunctionApp = resource.type === 'Function App';

  const save = () => {
    const patch: Partial<Resource> = { name, tags: { ...resource.tags } };
    if (isStorage && redundancy) patch.tags = { ...patch.tags, redundancy } as any;
    if (isFunctionApp) patch.tags = { ...patch.tags, runtimeStack, runtimeVersion } as any;
    actions.updateResource(resource.id, patch);
  };

  const remove = () => {
    actions.deleteResource(resource.id);
    navigate('/');
  };

  const toggleState = () => {
    actions.setResourceStatus(resource.id, resource.status === 'Running' ? 'Stopped' : 'Running');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-foreground">{resource.type}: {resource.name}</h1>
          <div className="flex gap-2">
            <button className="azure-button-secondary" onClick={toggleState}>{resource.status === 'Running' ? 'Stop' : 'Start'}</button>
            <button className="azure-button-secondary" onClick={save}>Save</button>
            <button className="azure-button-secondary" onClick={remove}>Delete</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card rounded border border-card-border p-4">
            <h2 className="font-medium mb-3">Overview</h2>
            <div className="text-sm text-foreground-secondary space-y-1">
              <div><span className="text-foreground">Subscription:</span> {resource.subscription}</div>
              <div><span className="text-foreground">Resource group:</span> {resource.resourceGroup}</div>
              <div><span className="text-foreground">Location:</span> {resource.location}</div>
              <div><span className="text-foreground">Status:</span> {resource.status}</div>
            </div>
          </div>

          <div className="bg-card rounded border border-card-border p-4">
            <h2 className="font-medium mb-3">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input className="azure-input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              {isStorage && (
                <div>
                  <label className="block text-sm font-medium mb-1">Redundancy</label>
                  <select className="azure-select" value={redundancy} onChange={(e) => setRedundancy(e.target.value)}>
                    <option value="Geo-redundant storage (GRS)">Geo-redundant storage (GRS)</option>
                    <option value="Locally redundant storage (LRS)">Locally redundant storage (LRS)</option>
                    <option value="Zone-redundant storage (ZRS)">Zone-redundant storage (ZRS)</option>
                    <option value="Geo-zone-redundant storage (GZRS)">Geo-zone-redundant storage (GZRS)</option>
                  </select>
                </div>
              )}

              {isFunctionApp && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Runtime stack</label>
                    <input className="azure-input" value={runtimeStack} onChange={(e) => setRuntimeStack(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Version</label>
                    <input className="azure-input" value={runtimeVersion} onChange={(e) => setRuntimeVersion(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceDetail;


