import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Index: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    // Redirect to dashboard as the main landing page
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
};
