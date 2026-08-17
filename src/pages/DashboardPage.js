import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Header } from '../components/Sidebar';
import {
  FolderKanban,
  Users,
  Activity,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  BarChart3,
  Clock,
} from 'lucide-react';

const stats = [
  {
    label: 'Total Projects',
    value: '24',
    trend: '+12%',
    trendDir: 'up',
    icon: FolderKanban,
    color: 'purple',
  },
  {
    label: 'Active Tasks',
    value: '142',
    trend: '+8%',
    trendDir: 'up',
    icon: Activity,
    color: 'blue',
  },
  {
    label: 'Team Members',
    value: '18',
    trend: '+3',
    trendDir: 'up',
    icon: Users,
    color: 'cyan',
  },
  {
    label: 'Revenue',
    value: '$48.2K',
    trend: '-2%',
    trendDir: 'down',
    icon: DollarSign,
    color: 'green',
  },
];

const activities = [
  { text: 'Sarah deployed v2.4.1 to production', time: '2 min ago', color: 'green' },
  { text: 'New project "Atlas" was created by Mike', time: '15 min ago', color: 'purple' },
  { text: 'Build pipeline failed for Project Phoenix', time: '32 min ago', color: 'amber' },
  { text: 'Team standup meeting completed', time: '1 hour ago', color: 'blue' },
  { text: 'Invoice #1042 was paid by ClientCo', time: '2 hours ago', color: 'green' },
  { text: 'Alex submitted 3 code reviews', time: '3 hours ago', color: 'purple' },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <Header title="Dashboard" />
      <div className="page-container">
        {/* Welcome */}
        <div className="page-header">
          <h2 className="page-title">
            Welcome back, {user?.name?.split(' ')[0] || 'there'} 👋
          </h2>
          <p className="page-subtitle">
            Here's what's happening across your projects today.
          </p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="stat-card">
                <div className="stat-card-header">
                  <div className={`stat-card-icon ${stat.color}`}>
                    <Icon size={22} />
                  </div>
                  <div className={`stat-card-trend ${stat.trendDir}`}>
                    {stat.trendDir === 'up' ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    {stat.trend}
                  </div>
                </div>
                <div className="stat-card-value">{stat.value}</div>
                <div className="stat-card-label">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Two-column: Activity + Quick Actions */}
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Activity Feed */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>
                Recent Activity
              </h3>
              <Clock size={18} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="activity-list">
              {activities.map((act, i) => (
                <div key={i} className="activity-item">
                  <div className={`activity-dot ${act.color}`} />
                  <span className="activity-text">{act.text}</span>
                  <span className="activity-time">{act.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions + Mini Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="card">
              <h3
                style={{
                  fontSize: 'var(--font-lg)',
                  fontWeight: 700,
                  marginBottom: 'var(--space-5)',
                }}
              >
                Quick Actions
              </h3>
              <div className="quick-actions">
                <button className="btn btn-primary">
                  <Plus size={16} /> New Project
                </button>
                <button className="btn btn-secondary">
                  <Users size={16} /> Invite Member
                </button>
                <button className="btn btn-secondary">
                  <BarChart3 size={16} /> View Reports
                </button>
              </div>
            </div>

            <div className="card">
              <h3
                style={{
                  fontSize: 'var(--font-lg)',
                  fontWeight: 700,
                  marginBottom: 'var(--space-5)',
                }}
              >
                Weekly Overview
              </h3>
              <div className="chart-bars">
                {[65, 45, 80, 55, 90, 70, 50].map((h, i) => (
                  <div key={i} className="chart-bar-wrapper">
                    <div className="chart-bar" style={{ height: `${h}%` }} />
                    <span className="chart-bar-label">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
