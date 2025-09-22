import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-primary/20">404</h1>
          <h2 className="text-2xl font-semibold text-foreground mt-4">Page Not Found</h2>
          <p className="text-foreground-secondary mt-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/"
            className="btn-primary flex items-center gap-2"
          >
            <Home size={16} />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};
