import React from 'react';
import { Activity, AlertTriangle, Bell, Gauge } from 'lucide-react';

const alerts = [
  { id: 'alert-1', name: 'High CPU on contoso-vm', severity: 'Sev 2', resource: 'contoso-vm', state: 'Fired' },
  { id: 'alert-2', name: 'Storage latency > 30ms', severity: 'Sev 3', resource: 'cogniorstorage001', state: 'Resolved' },
];

const Monitor: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Monitor</h1>
            <p className="text-sm text-foreground-secondary mt-1">
              Unified observability for metrics, logs, and alerts across Cognior resources.
            </p>
          </div>
          <button className="azure-button-secondary">Open workbook</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Active alerts</p>
            <p className="text-3xl font-semibold text-error mt-2">7</p>
            <p className="text-xs text-foreground-secondary mt-1">Across 3 subscriptions</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Metric charts</p>
            <p className="text-3xl font-semibold text-foreground mt-2">21</p>
            <p className="text-xs text-foreground-secondary mt-1">Pinned to dashboards</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Workbooks</p>
            <p className="text-3xl font-semibold text-foreground mt-2">5</p>
            <p className="text-xs text-foreground-secondary mt-1">Shared with team</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Application Insights</p>
            <p className="text-3xl font-semibold text-success mt-2">99.8%</p>
            <p className="text-xs text-foreground-secondary mt-1">Availability</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Activity size={18} />
                Metrics
              </h2>
              <button className="azure-button-secondary text-xs">View metrics</button>
            </div>
            <div className="h-40 bg-secondary rounded-md flex items-center justify-center text-foreground-secondary text-sm">
              Metrics preview placeholder
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Gauge size={18} />
                Insight score
              </h2>
              <button className="azure-button-secondary text-xs">Open Insights</button>
            </div>
            <div className="h-40 bg-secondary rounded-md flex items-center justify-center text-foreground-secondary text-sm">
              Application performance trends placeholder
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Bell size={18} />
              Alerts
            </h2>
            <button className="azure-button-secondary text-xs">Create alert rule</button>
          </div>
          <div className="overflow-x-auto">
            <table className="azure-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Name</th>
                  <th>Resource</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td className="text-foreground-secondary flex items-center gap-2">
                      <AlertTriangle size={14} className="text-warning" />
                      {alert.severity}
                    </td>
                    <td className="text-primary font-medium">{alert.name}</td>
                    <td className="text-foreground-secondary">{alert.resource}</td>
                    <td className={alert.state === 'Fired' ? 'text-error' : 'text-success'}>
                      {alert.state}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitor;

