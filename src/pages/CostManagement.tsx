import React from 'react';
import { Calendar, Download, TrendingUp } from 'lucide-react';

const budgets = [
  { name: 'Enterprise shared', amount: '$25,000', spend: '$21,400', status: 'On track', reset: 'Monthly' },
  { name: 'Analytics initiative', amount: '$12,000', spend: '$13,050', status: 'Exceeded', reset: 'Quarterly' },
];

const CostManagement: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Cost Management + Billing</h1>
            <p className="text-sm text-foreground-secondary mt-1">
              Track Cognior cloud spend, forecasts, and budget status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="azure-button-secondary flex items-center gap-2">
              <Calendar size={16} />
              <span>Last 30 days</span>
            </button>
            <button className="azure-button-secondary flex items-center gap-2">
              <Download size={16} />
              <span>Export</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Actual cost</p>
            <p className="text-3xl font-semibold text-foreground mt-2">$36,420</p>
            <p className="text-xs text-foreground-secondary mt-1">Month-to-date</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Forecast</p>
            <p className="text-3xl font-semibold text-foreground mt-2">$48,700</p>
            <p className="text-xs text-foreground-secondary mt-1">vs. budget $50,000</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground-secondary">Cost trend</p>
              <TrendingUp className="text-success" size={20} />
            </div>
            <p className="text-3xl font-semibold text-success mt-2">-6%</p>
            <p className="text-xs text-foreground-secondary mt-1">vs. previous period</p>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Budgets</h2>
              <p className="text-sm text-foreground-secondary">Track commitments and alerts.</p>
            </div>
            <button className="azure-button-secondary">New budget</button>
          </div>

          <div className="overflow-x-auto">
            <table className="azure-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Amount</th>
                  <th>Spend</th>
                  <th>Status</th>
                  <th>Reset</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => (
                  <tr key={budget.name}>
                    <td className="text-primary font-medium">{budget.name}</td>
                    <td className="text-foreground-secondary">{budget.amount}</td>
                    <td className="text-foreground-secondary">{budget.spend}</td>
                    <td className={budget.status === 'Exceeded' ? 'text-error' : 'text-success'}>
                      {budget.status}
                    </td>
                    <td className="text-foreground-secondary">{budget.reset}</td>
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

export default CostManagement;

