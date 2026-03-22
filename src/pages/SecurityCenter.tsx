import React from 'react';
import { ShieldCheck, ShieldOff, AlertCircle } from 'lucide-react';

const assessments = [
  { id: 'sec-1', category: 'Identity', status: 'Healthy', recommendation: 'MFA enforced for admins' },
  { id: 'sec-2', category: 'Data', status: 'Unhealthy', recommendation: 'Enable soft delete on vaults' },
  { id: 'sec-3', category: 'Compute', status: 'Healthy', recommendation: 'Just-in-time access configured' },
];

const SecurityCenter: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Cognior Defender for Cloud</h1>
            <p className="text-sm text-foreground-secondary mt-1">
              Surface secure score, regulatory compliance, and prioritized hardening guidance.
            </p>
          </div>
          <button className="azure-button-secondary">Open secure score</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Secure score</p>
            <p className="text-3xl font-semibold text-success mt-2">78%</p>
            <p className="text-xs text-foreground-secondary mt-1">+4% in last 7 days</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Recommendations</p>
            <p className="text-3xl font-semibold text-warning mt-2">12</p>
            <p className="text-xs text-foreground-secondary mt-1">3 high | 9 medium</p>
          </div>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <p className="text-sm text-foreground-secondary">Regulatory compliance</p>
            <p className="text-3xl font-semibold text-foreground mt-2">5/7</p>
            <p className="text-xs text-foreground-secondary mt-1">Standards passing</p>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <table className="azure-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Status</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((assessment) => (
                <tr key={assessment.id}>
                  <td className="text-foreground-secondary">{assessment.category}</td>
                  <td className="text-foreground-secondary flex items-center gap-2">
                    {assessment.status === 'Healthy' ? (
                      <ShieldCheck size={16} className="text-success" />
                    ) : (
                      <ShieldOff size={16} className="text-error" />
                    )}
                    {assessment.status}
                  </td>
                  <td className="text-primary font-medium">{assessment.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-warning" />
            <h2 className="font-semibold text-foreground">Pending actions</h2>
          </div>
          <ul className="list-disc pl-6 text-sm text-foreground-secondary space-y-2">
            <li>Enable Defender for Cosmos DB workload protection.</li>
            <li>Apply adaptive application control to Analytics resource group.</li>
            <li>Configure continuous export of security alerts to Monitor.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SecurityCenter;

