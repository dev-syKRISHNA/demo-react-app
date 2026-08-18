import React from 'react';
import { Header } from '../components/Sidebar';
import {
  TrendingDown,
  Eye,
  MousePointerClick,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';

const metrics = [
  {
    label: 'Total Visitors',
    value: '24,892',
    trend: '+18.2%',
    trendDir: 'up',
    icon: Eye,
    color: 'purple',
  },
  {
    label: 'Conversion Rate',
    value: '3.24%',
    trend: '+0.8%',
    trendDir: 'up',
    icon: MousePointerClick,
    color: 'green',
  },
  {
    label: 'Avg. Session',
    value: '4m 32s',
    trend: '-12s',
    trendDir: 'down',
    icon: Clock,
    color: 'blue',
  },
  {
    label: 'Bounce Rate',
    value: '32.1%',
    trend: '-2.4%',
    trendDir: 'up',
    icon: TrendingDown,
    color: 'amber',
  },
];

const monthlyData = [
  { month: 'Jan', value: 42 },
  { month: 'Feb', value: 58 },
  { month: 'Mar', value: 45 },
  { month: 'Apr', value: 72 },
  { month: 'May', value: 65 },
  { month: 'Jun', value: 88 },
  { month: 'Jul', value: 78 },
  { month: 'Aug', value: 95 },
  { month: 'Sep', value: 82 },
  { month: 'Oct', value: 70 },
  { month: 'Nov', value: 60 },
  { month: 'Dec', value: 85 },
];

const channelData = [
  { channel: 'Organic Search', visitors: 12420, pct: 49.9 },
  { channel: 'Direct', visitors: 6240, pct: 25.1 },
  { channel: 'Social Media', visitors: 3680, pct: 14.8 },
  { channel: 'Referral', visitors: 1590, pct: 6.4 },
  { channel: 'Email', visitors: 962, pct: 3.8 },
];

const topPages = [
  { page: '/dashboard', views: 8420, avgTime: '3m 12s' },
  { page: '/projects', views: 5210, avgTime: '4m 45s' },
  { page: '/analytics', views: 3890, avgTime: '5m 22s' },
  { page: '/team', views: 2150, avgTime: '2m 58s' },
  { page: '/billing', views: 1830, avgTime: '1m 45s' },
];

export default function AnalyticsPage() {
  return (
    <>
      <Header title="Analytics" />
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">Analytics Overview</h2>
          <p className="page-subtitle">
            Track your platform performance and user engagement metrics.
          </p>
        </div>

        {/* Metric Cards */}
        <div className="stats-grid">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="stat-card">
                <div className="stat-card-header">
                  <div className={`stat-card-icon ${m.color}`}>
                    <Icon size={22} />
                  </div>
                  <div className={`stat-card-trend ${m.trendDir}`}>
                    {m.trendDir === 'up' ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    {m.trend}
                  </div>
                </div>
                <div className="stat-card-value">{m.value}</div>
                <div className="stat-card-label">{m.label}</div>
              </div>
            );
          })}
        </div>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Monthly Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
                Monthly Traffic
              </h3>
              <BarChart3 size={18} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="chart-bars">
              {monthlyData.map((d) => (
                <div key={d.month} className="chart-bar-wrapper">
                  <div className="chart-bar" style={{ height: `${d.value}%` }} />
                  <span className="chart-bar-label">{d.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Sources */}
          <div className="card">
            <h3
              style={{
                fontSize: 'var(--font-lg)',
                fontWeight: 700,
                marginBottom: 'var(--space-6)',
              }}
            >
              Traffic Sources
            </h3>
            {channelData.map((c) => (
              <div key={c.channel} className="usage-meter">
                <div className="usage-meter-header">
                  <span className="usage-meter-label">{c.channel}</span>
                  <span className="usage-meter-value">
                    {c.visitors.toLocaleString()} ({c.pct}%)
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Pages Table */}
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <h3
            style={{
              fontSize: 'var(--font-lg)',
              fontWeight: 700,
              marginBottom: 'var(--space-6)',
            }}
          >
            Top Pages
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Views</th>
                  <th>Avg. Time</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((p) => (
                  <tr key={p.page}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {p.page}
                    </td>
                    <td>{p.views.toLocaleString()}</td>
                    <td>{p.avgTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
