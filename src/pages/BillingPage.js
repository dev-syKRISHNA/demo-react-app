import React from 'react';
import { Header } from '../components/Sidebar';
import {
  Check,
  ArrowUpRight,
  Download,
  CreditCard,
  Receipt,
} from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$0',
    period: '/month',
    features: [
      '3 Projects',
      '5 Team Members',
      '10 GB Storage',
      'Basic Analytics',
      'Email Support',
    ],
    featured: false,
    cta: 'Downgrade',
  },
  {
    name: 'Professional',
    price: '$29',
    period: '/month',
    features: [
      'Unlimited Projects',
      '25 Team Members',
      '100 GB Storage',
      'Advanced Analytics',
      'Priority Support',
      'Custom Integrations',
    ],
    featured: true,
    cta: 'Current Plan',
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/month',
    features: [
      'Unlimited Everything',
      'Unlimited Team Members',
      '1 TB Storage',
      'Real-time Analytics',
      '24/7 Dedicated Support',
      'Custom SLA',
      'SSO & SAML',
    ],
    featured: false,
    cta: 'Upgrade',
  },
];

const usageMeters = [
  { label: 'Storage', used: '42 GB', total: '100 GB', pct: 42 },
  { label: 'API Calls', used: '18,420', total: '50,000', pct: 36.8 },
  { label: 'Bandwidth', used: '120 GB', total: '500 GB', pct: 24 },
  { label: 'Team Seats', used: '18', total: '25', pct: 72 },
];

const invoices = [
  { id: 'INV-1042', date: 'Aug 1, 2026', amount: '$29.00', status: 'Paid' },
  { id: 'INV-1031', date: 'Jul 1, 2026', amount: '$29.00', status: 'Paid' },
  { id: 'INV-1020', date: 'Jun 1, 2026', amount: '$29.00', status: 'Paid' },
  { id: 'INV-1009', date: 'May 1, 2026', amount: '$29.00', status: 'Paid' },
  { id: 'INV-0998', date: 'Apr 1, 2026', amount: '$29.00', status: 'Paid' },
];

export default function BillingPage() {
  return (
    <>
      <Header title="Billing" />
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">Billing & Plans</h2>
          <p className="page-subtitle">
            Manage your subscription, view usage, and download invoices.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid-3" style={{ marginBottom: 'var(--space-8)' }}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`pricing-card ${plan.featured ? 'featured' : ''}`}
            >
              <div className="pricing-name">{plan.name}</div>
              <div className="pricing-price">
                {plan.price}
                <span>{plan.period}</span>
              </div>
              <ul className="pricing-features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check
                      size={16}
                      style={{ color: 'var(--accent-green)', flexShrink: 0 }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`btn ${
                  plan.featured ? 'btn-primary' : 'btn-secondary'
                } w-full`}
                disabled={plan.featured}
                style={plan.featured ? { opacity: 0.7, cursor: 'default' } : {}}
              >
                {plan.cta}
                {!plan.featured && <ArrowUpRight size={14} />}
              </button>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Usage */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
                Current Usage
              </h3>
              <CreditCard size={18} style={{ color: 'var(--text-muted)' }} />
            </div>
            {usageMeters.map((u) => (
              <div key={u.label} className="usage-meter">
                <div className="usage-meter-header">
                  <span className="usage-meter-label">{u.label}</span>
                  <span className="usage-meter-value">
                    {u.used} / {u.total}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${u.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Invoices */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
                Recent Invoices
              </h3>
              <Receipt size={18} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td
                        style={{
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                        }}
                      >
                        {inv.id}
                      </td>
                      <td>{inv.date}</td>
                      <td>{inv.amount}</td>
                      <td>
                        <span className="badge badge-green">{inv.status}</span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-secondary">
                          <Download size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
