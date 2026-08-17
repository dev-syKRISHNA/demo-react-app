import React from 'react';
import { Header } from '../components/Sidebar';
import {
  Plus,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Pause,
  MoreHorizontal,
} from 'lucide-react';

const projects = [
  {
    id: 1,
    name: 'Project Phoenix',
    description:
      'Complete platform migration to microservices architecture with improved CI/CD pipeline.',
    status: 'Active',
    progress: 72,
    members: 6,
    dueDate: 'Sep 15, 2026',
    badge: 'green',
  },
  {
    id: 2,
    name: 'Atlas Dashboard',
    description:
      'Real-time analytics dashboard with custom widgets, drag-and-drop layout, and data export.',
    status: 'Active',
    progress: 45,
    members: 4,
    dueDate: 'Oct 1, 2026',
    badge: 'green',
  },
  {
    id: 3,
    name: 'Mobile App v3',
    description:
      'Next-generation mobile application with offline support, push notifications, and biometric auth.',
    status: 'On Hold',
    progress: 30,
    members: 3,
    dueDate: 'Nov 20, 2026',
    badge: 'amber',
  },
  {
    id: 4,
    name: 'API Gateway v2',
    description:
      'Redesigned API gateway with rate limiting, caching layer, and comprehensive documentation.',
    status: 'Completed',
    progress: 100,
    members: 5,
    dueDate: 'Aug 1, 2026',
    badge: 'blue',
  },
  {
    id: 5,
    name: 'Design System',
    description:
      'Unified component library with tokens, accessibility standards, and Storybook integration.',
    status: 'Active',
    progress: 88,
    members: 3,
    dueDate: 'Aug 30, 2026',
    badge: 'green',
  },
  {
    id: 6,
    name: 'Customer Portal',
    description:
      'Self-service portal for customers to manage subscriptions, view invoices, and get support.',
    status: 'Active',
    progress: 55,
    members: 4,
    dueDate: 'Oct 15, 2026',
    badge: 'green',
  },
];

function StatusIcon({ status }) {
  switch (status) {
    case 'Active':
      return <CheckCircle2 size={14} />;
    case 'On Hold':
      return <Pause size={14} />;
    case 'Completed':
      return <CheckCircle2 size={14} />;
    default:
      return <Clock size={14} />;
  }
}

export default function ProjectsPage() {
  return (
    <>
      <Header title="Projects" />
      <div className="page-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="page-title">Projects</h2>
            <p className="page-subtitle">
              Manage and track all your team projects in one place.
            </p>
          </div>
          <button className="btn btn-primary">
            <Plus size={16} /> New Project
          </button>
        </div>

        {/* Project Grid */}
        <div className="grid-2">
          {projects.map((project, i) => (
            <div
              key={project.id}
              className="project-card"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="project-card-header">
                <h3 className="project-card-title">{project.name}</h3>
                <span className={`badge badge-${project.badge}`}>
                  <StatusIcon status={project.status} />
                  &nbsp;{project.status}
                </span>
              </div>

              <p className="project-card-desc">{project.description}</p>

              {/* Progress */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: 'var(--space-2)' }}
                >
                  <span className="text-sm text-muted">Progress</span>
                  <span className="text-sm font-semibold">{project.progress}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="project-card-footer">
                <div className="project-card-meta">
                  <span>
                    <Users size={14} /> {project.members}
                  </span>
                  <span>
                    <Calendar size={14} /> {project.dueDate}
                  </span>
                </div>
                <button
                  className="btn btn-icon btn-secondary"
                  style={{ width: 32, height: 32 }}
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
