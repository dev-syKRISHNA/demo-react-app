import React, { useState } from 'react';
import { Header } from '../components/Sidebar';
import {
  Plus,
  Search,
  Mail,
  MoreHorizontal,
} from 'lucide-react';

const teamMembers = [
  {
    id: 1,
    name: 'Sarah Chen',
    role: 'Lead Engineer',
    email: 'sarah@nova.io',
    status: 'online',
    avatar: 'purple',
    projects: 5,
  },
  {
    id: 2,
    name: 'Mike Rodriguez',
    role: 'Product Designer',
    email: 'mike@nova.io',
    status: 'online',
    avatar: 'blue',
    projects: 3,
  },
  {
    id: 3,
    name: 'Emily Park',
    role: 'Frontend Developer',
    email: 'emily@nova.io',
    status: 'offline',
    avatar: 'cyan',
    projects: 4,
  },
  {
    id: 4,
    name: 'Alex Thompson',
    role: 'Backend Developer',
    email: 'alex@nova.io',
    status: 'online',
    avatar: 'pink',
    projects: 6,
  },
  {
    id: 5,
    name: 'Jordan Lee',
    role: 'DevOps Engineer',
    email: 'jordan@nova.io',
    status: 'online',
    avatar: 'green',
    projects: 4,
  },
  {
    id: 6,
    name: 'Priya Sharma',
    role: 'Data Scientist',
    email: 'priya@nova.io',
    status: 'offline',
    avatar: 'amber',
    projects: 2,
  },
  {
    id: 7,
    name: 'Chris Baker',
    role: 'QA Engineer',
    email: 'chris@nova.io',
    status: 'online',
    avatar: 'purple',
    projects: 5,
  },
  {
    id: 8,
    name: 'Lisa Nguyen',
    role: 'Product Manager',
    email: 'lisa@nova.io',
    status: 'online',
    avatar: 'blue',
    projects: 7,
  },
];

export default function TeamPage() {
  const [search, setSearch] = useState('');

  const filtered = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header title="Team" />
      <div className="page-container">
        <div
          className="page-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h2 className="page-title">Team Members</h2>
            <p className="page-subtitle">
              Manage your team and collaborate across projects.
            </p>
          </div>
          <button className="btn btn-primary">
            <Plus size={16} /> Invite Member
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 'var(--space-6)', maxWidth: 400 }}>
          <div className="header-search" style={{ width: '100%' }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Team Grid */}
        <div className="grid-4">
          {filtered.map((member) => {
            const initials = member.name
              .split(' ')
              .map((n) => n[0])
              .join('');
            return (
              <div key={member.id} className="member-card">
                <div className={`member-avatar ${member.avatar}`}>
                  {initials}
                  <span
                    className={`member-status-dot ${member.status}`}
                  />
                </div>
                <div className="member-name">{member.name}</div>
                <div className="member-role">{member.role}</div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 'var(--space-2)',
                    marginTop: 'var(--space-2)',
                  }}
                >
                  <span className="badge badge-purple">
                    {member.projects} projects
                  </span>
                  <span
                    className={`badge ${
                      member.status === 'online' ? 'badge-green' : 'badge-red'
                    }`}
                  >
                    {member.status}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 'var(--space-2)',
                    marginTop: 'var(--space-4)',
                  }}
                >
                  <button className="btn btn-sm btn-secondary">
                    <Mail size={14} /> Email
                  </button>
                  <button
                    className="btn btn-sm btn-secondary btn-icon"
                    style={{ width: 32, height: 32 }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Search size={28} />
            </div>
            <div className="empty-state-title">No members found</div>
            <div className="empty-state-desc">
              Try adjusting your search query.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
