import React from 'react';
import { CheckCircle2, Info, ShieldAlert, Zap } from 'lucide-react';

const recommendations = [
  {
    id: 'rec-1',
    category: 'Cost',
    impact: 'High',
    recommendation: 'Right-size virtual machines in Analytics resource group',
    resources: 4,
  },
  {
    id: 'rec-2',
    category: 'Security',
    impact: 'Medium',
    recommendation: 'Enable MFA for privileged accounts',
    resources: 2,
  },
  {
    id: 'rec-3',
    category: 'Reliability',
    impact: 'Low',
    recommendation: 'Configure availability zones for production CKS cluster',
    resources: 1,
  },
];

const Advisor: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Cognior Advisor</h1>
            <p className="text-sm text-foreground-secondary mt-1">
              Personalized best practices to optimize cost, security, reliability, and performance.
            </p>
          </div>
          <button className="azure-button-secondary">Export report</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">High impact</p>
            <p className="text-3xl font-semibold text-error mt-2">3</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Medium impact</p>
            <p className="text-3xl font-semibold text-warning mt-2">6</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Low impact</p>
            <p className="text-3xl font-semibold text-foreground mt-2">11</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Resolved this month</p>
            <p className="text-3xl font-semibold text-success mt-2">9</p>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg">
          <table className="azure-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Impact</th>
                <th>Recommendation</th>
                <th>Resources</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((recommendation) => (
                <tr key={recommendation.id}>
                  <td className="text-foreground-secondary flex items-center gap-2">
                    {recommendation.category === 'Security' ? (
                      <ShieldAlert size={16} />
                    ) : recommendation.category === 'Cost' ? (
                      <Zap size={16} />
                    ) : (
                      <Info size={16} />
                    )}
                    {recommendation.category}
                  </td>
                  <td className="text-foreground-secondary">{recommendation.impact}</td>
                  <td className="text-primary font-medium">{recommendation.recommendation}</td>
                  <td className="text-foreground-secondary">{recommendation.resources}</td>
                  <td className="text-success flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    Ready to apply
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Advisor;

