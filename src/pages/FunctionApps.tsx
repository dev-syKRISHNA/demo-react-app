import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { Resource } from '@/data/mockData';

const FunctionApps: React.FC = () => {
  const navigate = useNavigate();
  const resources = useAppStore((s) => s.resources);
  const [query, setQuery] = useState('');
  const apps = useMemo(
    () =>
      resources
        .filter((r: Resource) => r.type === 'Function App')
        .filter(
          (r) =>
            r.name.toLowerCase().includes(query.toLowerCase()) ||
            r.resourceGroup.toLowerCase().includes(query.toLowerCase())
        ),
    [resources, query]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Function Apps</h1>
            <p className="text-sm text-foreground-secondary mt-1">Manage your Cognior Function Apps.</p>
          </div>
          <button onClick={() => navigate('/create/function-app')} className="azure-button-primary">
            Create
          </button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
            <input
              className="azure-input pl-10"
              placeholder="Search function apps"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-card rounded border border-card-border overflow-hidden">
          <table className="azure-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Resource group</th>
                <th>Subscription</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} onClick={() => navigate(`/resources/${app.id}`)} className="cursor-pointer">
                  <td className="text-primary font-medium">{app.name}</td>
                  <td className="text-foreground-secondary">{app.resourceGroup}</td>
                  <td className="text-foreground-secondary">{app.subscription}</td>
                  <td className="text-foreground-secondary">{app.location}</td>
                  <td className="text-foreground-secondary">{app.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {apps.length === 0 && (
            <div className="text-center py-8 text-foreground-secondary">No function apps found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FunctionApps;


