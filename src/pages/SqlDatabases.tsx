import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { Resource } from '@/data/mockData';

const SqlDatabases: React.FC = () => {
  const navigate = useNavigate();
  const resources = useAppStore((s) => s.resources);
  const [query, setQuery] = useState('');
  const dbs = useMemo(
    () =>
      resources
        .filter((r: Resource) => r.type === 'SQL database')
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
            <h1 className="text-2xl font-semibold text-foreground">SQL databases</h1>
            <p className="text-sm text-foreground-secondary mt-1">Manage Cognior SQL databases.</p>
          </div>
          <button onClick={() => navigate('/create/sql-database')} className="azure-button-primary">Create</button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
            <input className="azure-input pl-10" placeholder="Search databases" value={query} onChange={(e) => setQuery(e.target.value)} />
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
              {dbs.map((db) => (
                <tr key={db.id} onClick={() => navigate(`/resources/${db.id}`)} className="cursor-pointer">
                  <td className="text-primary font-medium">{db.name}</td>
                  <td className="text-foreground-secondary">{db.resourceGroup}</td>
                  <td className="text-foreground-secondary">{db.subscription}</td>
                  <td className="text-foreground-secondary">{db.location}</td>
                  <td className="text-foreground-secondary">{db.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dbs.length === 0 && (
            <div className="text-center py-8 text-foreground-secondary">No SQL databases found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlDatabases;


