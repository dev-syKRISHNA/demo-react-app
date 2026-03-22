import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, MoreHorizontal, Plus } from 'lucide-react';
import { trackEvent, AnalyticsEvents } from '@/data/mockData';

export interface ServiceExplorerRow {
  id: string;
  name: string;
  status?: string;
  location?: string;
  resourceGroup?: string;
  owner?: string;
  tier?: string;
  type?: string;
  lastUpdated?: string;
  href?: string;
  [key: string]: any;
}

export interface ServiceExplorerColumn {
  key: string;
  label: string;
  render?: (row: ServiceExplorerRow) => React.ReactNode;
  width?: string;
}

export interface ServiceExplorerConfig {
  title: string;
  description: string;
  entityName: string;
  createPath: string;
  rows: ServiceExplorerRow[];
  columns: ServiceExplorerColumn[];
  metrics?: { label: string; value: string; helper?: string }[];
}

export const ServiceExplorer: React.FC<ServiceExplorerConfig> = ({
  title,
  description,
  entityName,
  createPath,
  rows,
  columns,
  metrics = [],
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const filteredRows = useMemo(() => {
    if (!query) return rows;
    const lower = query.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((value) =>
        typeof value === 'string' && value.toLowerCase().includes(lower),
      ),
    );
  }, [rows, query]);

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedRows((prev) =>
      checked ? [...prev, id] : prev.filter((rowId) => rowId !== id),
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedRows(checked ? filteredRows.map((row) => row.id) : []);
  };

  const handleCreate = () => {
    trackEvent(AnalyticsEvents.RESOURCE_CREATE_START, {
      context: 'service_explorer',
      entity: entityName,
    });
    navigate(createPath);
  };

  const handleRowClick = (row: ServiceExplorerRow) => {
    if (!row.href) {
      return;
    }
    trackEvent(AnalyticsEvents.RESOURCE_VIEW, {
      resourceId: row.id,
      entity: entityName,
    });
    navigate(row.href);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-foreground-secondary mt-1">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="azure-button-secondary">Manage view</button>
            <button className="azure-button-primary flex items-center gap-2" onClick={handleCreate}>
              <Plus size={16} />
              <span>Create</span>
            </button>
          </div>
        </div>

        {metrics.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-card border border-card-border rounded-lg p-4">
                <p className="text-sm text-foreground-secondary">{metric.label}</p>
                <p className="text-2xl font-semibold text-foreground mt-2">{metric.value}</p>
                {metric.helper && <p className="text-xs text-foreground-secondary mt-1">{metric.helper}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
              size={16}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${entityName}`}
              className="azure-input pl-10"
            />
          </div>
          <button className="azure-button-secondary flex items-center gap-2">
            <Filter size={16} />
            <span>Add filter</span>
          </button>
        </div>

        {selectedRows.length > 0 && (
          <div className="bg-accent border border-accent-foreground/30 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm text-foreground font-medium">
              {selectedRows.length} {entityName}
              {selectedRows.length === 1 ? '' : 's'} selected
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
                    checked={
                      filteredRows.length > 0 &&
                      selectedRows.length === filteredRows.length
                    }
                    onChange={(event) => handleSelectAll(event.target.checked)}
                  />
                </th>
                {columns.map((column) => (
                  <th key={column.key} style={column.width ? { width: column.width } : undefined}>
                    {column.label}
                  </th>
                ))}
                <th className="w-12" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="cursor-pointer" onClick={() => handleRowClick(row)}>
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedRows.includes(row.id)}
                      onChange={(event) => toggleRow(row.id, event.target.checked)}
                    />
                  </td>
                  {columns.map((column) => {
                    const content = column.render
                      ? column.render(row)
                      : column.key === 'name'
                      ? <span className="text-primary font-medium">{row.name}</span>
                      : row[column.key] ?? '—';
                    return (
                      <td key={`${row.id}-${column.key}`} className="text-foreground-secondary">
                        {content}
                      </td>
                    );
                  })}
                  <td onClick={(event) => event.stopPropagation()}>
                    <button className="p-1 hover:bg-secondary rounded transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRows.length === 0 && (
            <div className="text-center py-12">
              <p className="text-foreground-secondary mb-3">
                No {entityName} match the current filters.
              </p>
              <button className="azure-button-secondary" onClick={() => setQuery('')}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceExplorer;

