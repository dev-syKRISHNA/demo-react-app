import React, { useMemo, useState } from 'react';
import { Search, Filter, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { Resource } from '@/data/mockData';

const AllResources: React.FC = () => {
  const navigate = useNavigate();
  const resources = useAppStore((s) => s.resources);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!query) return resources;
    const lower = query.toLowerCase();
    return resources.filter(
      (resource) =>
        resource.name.toLowerCase().includes(lower) ||
        resource.type.toLowerCase().includes(lower) ||
        resource.resourceGroup.toLowerCase().includes(lower),
    );
  }, [resources, query]);

  const toggleSelection = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
  };

  const selectAll = (checked: boolean) => {
    setSelected(checked ? filtered.map((resource) => resource.id) : []);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">All resources</h1>
            <p className="text-sm text-foreground-secondary mt-1">
              Unified inventory of every Cognior resource in the selected directory.
            </p>
          </div>
          <button
            className="azure-button-primary"
            onClick={() => navigate('/create-resource')}
          >
            Create
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, type, or resource group"
              className="azure-input pl-10"
            />
          </div>
          <button className="azure-button-secondary flex items-center gap-2">
            <Filter size={16} />
            <span>Add filter</span>
          </button>
        </div>

        {selected.length > 0 && (
          <div className="bg-accent border border-accent-foreground/30 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {selected.length} resource{selected.length === 1 ? '' : 's'} selected
            </span>
            <div className="flex items-center gap-2">
              <button className="azure-button-secondary text-sm">Start</button>
              <button className="azure-button-secondary text-sm">Stop</button>
              <button className="azure-button-secondary text-sm">Delete</button>
            </div>
          </div>
        )}

        <div className="bg-card rounded-lg border border-card-border overflow-hidden">
          <table className="azure-table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={filtered.length > 0 && filtered.length === selected.length}
                    onChange={(event) => selectAll(event.target.checked)}
                  />
                </th>
                <th>Name</th>
                <th>Type</th>
                <th>Resource group</th>
                <th>Location</th>
                <th>Status</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((resource: Resource) => (
                <tr
                  key={resource.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/resources/${resource.id}`)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selected.includes(resource.id)}
                      onChange={(event) => toggleSelection(resource.id, event.target.checked)}
                    />
                  </td>
                  <td className="text-primary font-medium">{resource.name}</td>
                  <td className="text-foreground-secondary">{resource.type}</td>
                  <td className="text-foreground-secondary">{resource.resourceGroup || '—'}</td>
                  <td className="text-foreground-secondary">{resource.location}</td>
                  <td className="text-foreground-secondary">{resource.status}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <button className="p-1 hover:bg-secondary rounded transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-foreground-secondary">
              No resources found with the selected filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllResources;

