import React, { useState } from 'react';
import { Header } from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { Save, AlertTriangle, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saved, setSaved] = useState(false);

  const [notifications, setNotifications] = useState({
    emailUpdates: true,
    projectAlerts: true,
    weeklyDigest: false,
    marketingEmails: false,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleNotification = (key) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <Header title="Settings" />
      <div className="page-container" style={{ maxWidth: 800 }}>
        <div className="page-header">
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">
            Manage your account settings and preferences.
          </p>
        </div>

        {/* Profile Section */}
        <div className="settings-section">
          <h3 className="settings-section-title">Profile</h3>
          <div className="card">
            <div className="form-group">
              <label className="form-label" htmlFor="settings-name">
                Full Name
              </label>
              <input
                id="settings-name"
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="settings-email">
                Email Address
              </label>
              <input
                id="settings-email"
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={16} />
                {saved ? 'Saved!' : 'Save Changes'}
              </button>
              {saved && (
                <span
                  style={{
                    color: 'var(--accent-green)',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 500,
                    animation: 'fadeIn 0.3s ease-out',
                  }}
                >
                  ✓ Changes saved successfully
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-section">
          <h3 className="settings-section-title">Notifications</h3>
          <div className="card">
            {[
              {
                key: 'emailUpdates',
                label: 'Email Updates',
                desc: 'Receive notifications about account activity via email',
              },
              {
                key: 'projectAlerts',
                label: 'Project Alerts',
                desc: 'Get alerted when project status changes or deadlines approach',
              },
              {
                key: 'weeklyDigest',
                label: 'Weekly Digest',
                desc: 'Receive a weekly summary of your team activity',
              },
              {
                key: 'marketingEmails',
                label: 'Marketing Emails',
                desc: 'Receive product updates and promotional offers',
              },
            ].map((item) => (
              <div key={item.key} className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">{item.label}</div>
                  <div className="settings-row-desc">{item.desc}</div>
                </div>
                <div
                  className={`toggle ${notifications[item.key] ? 'active' : ''}`}
                  onClick={() => toggleNotification(item.key)}
                >
                  <div className="toggle-knob" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-section">
          <div className="danger-zone">
            <div className="danger-zone-title">
              <AlertTriangle
                size={18}
                style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }}
              />
              Danger Zone
            </div>
            <p className="danger-zone-desc">
              Once you delete your account, there is no going back. Please be
              certain.
            </p>
            <button className="btn btn-danger" onClick={logout}>
              <Trash2 size={16} />
              Delete Account & Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
