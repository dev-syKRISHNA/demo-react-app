import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { Resource } from '@/data/mockData';

const StorageAccounts: React.FC = () => {
  const navigate = useNavigate();
  const resources = useAppStore((s) => s.resources);
  const [query, setQuery] = useState('');
  const storageAccounts = useMemo(
    () =>
      resources
        .filter((r: Resource) => r.type === 'Storage account')
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
            <h1 className="text-2xl font-semibold text-foreground">Storage accounts</h1>
            <p className="text-sm text-foreground-secondary mt-1">Manage your Azure Storage accounts.</p>
          </div>
          <button onClick={() => navigate('/create/storage-account')} className="azure-button-primary">
            Create
          </button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
            <input
              className="azure-input pl-10"
              placeholder="Search storage accounts"
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
              {storageAccounts.map((sa) => (
                <tr key={sa.id} onClick={() => navigate(`/resources/${sa.id}`)} className="cursor-pointer">
                  <td className="text-primary font-medium">{sa.name}</td>
                  <td className="text-foreground-secondary">{sa.resourceGroup}</td>
                  <td className="text-foreground-secondary">{sa.subscription}</td>
                  <td className="text-foreground-secondary">{sa.location}</td>
                  <td className="text-foreground-secondary">{sa.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {storageAccounts.length === 0 && (
            <div className="text-center py-8 text-foreground-secondary">No storage accounts found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorageAccounts;


