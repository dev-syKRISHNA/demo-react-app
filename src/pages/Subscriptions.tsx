import React, { useMemo, useState } from 'react';
import { Plus, Search, Filter, RefreshCcw } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const Subscriptions: React.FC = () => {
  const subscriptions = useAppStore((s) => s.subscriptions);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return subscriptions;
    const lower = query.toLowerCase();
    return subscriptions.filter(
      (subscription) =>
        subscription.name.toLowerCase().includes(lower) ||
        subscription.subscriptionId.toLowerCase().includes(lower),
    );
  }, [subscriptions, query]);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Subscriptions</h1>
            <p className="text-sm text-foreground-secondary mt-1">
              Manage Cognior billing scopes, policies, and RBAC assignments.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="azure-button-secondary flex items-center gap-2">
              <RefreshCcw size={14} />
              <span>Refresh</span>
            </button>
            <button className="azure-button-primary flex items-center gap-2">
              <Plus size={16} />
              <span>Add</span>
            </button>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-foreground-secondary">Active subscriptions</p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              {subscriptions.filter((subscription) => subscription.status === 'Active').length}
            </p>
          </div>
          <div>
            <p className="text-sm text-foreground-secondary">Disabled</p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              {subscriptions.filter((subscription) => subscription.status === 'Disabled').length}
            </p>
          </div>
          <div>
            <p className="text-sm text-foreground-secondary">Directory</p>
            <p className="text-lg font-semibold text-foreground mt-1">
              {subscriptions[0]?.directory ?? 'Default directory'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by subscription name or ID"
              className="azure-input pl-10"
            />
          </div>
          <button className="azure-button-secondary flex items-center gap-2">
            <Filter size={16} />
            <span>Add filter</span>
          </button>
        </div>

        <div className="bg-card rounded-lg border border-card-border overflow-hidden">
          <table className="azure-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subscription ID</th>
                <th>Status</th>
                <th>Directory</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="text-primary font-medium">{subscription.name}</td>
                  <td className="text-foreground-secondary font-mono">{subscription.subscriptionId}</td>
                  <td className="text-foreground-secondary">{subscription.status}</td>
                  <td className="text-foreground-secondary">{subscription.directory}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-foreground-secondary">
              No subscriptions match the current filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Subscriptions;

