import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, AlertCircle, Sparkles, Mail, Lock, User } from 'lucide-react';

export default function LoginPage() {
  const { login, signup, quickLogin, isAuthenticated, demoCredentials } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp) {
      if (!name.trim() || !email.trim() || !password.trim()) {
        setError('All fields are required');
        return;
      }
      if (password.length < 4) {
        setError('Password must be at least 4 characters');
        return;
      }
      const result = signup(name.trim(), email.trim(), password);
      if (!result.success) {
        setError(result.error);
      } else {
        navigate('/');
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError('Email and password are required');
        return;
      }
      const result = login(email.trim(), password);
      if (!result.success) {
        setError(result.error);
      } else {
        navigate('/');
      }
    }
  };

  const handleQuickLogin = () => {
    setError('');
    const result = quickLogin();
    if (result.success) {
      navigate('/');
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="login-page">
      {/* Background gradients */}
      <div className="login-bg-gradient login-bg-gradient-1" />
      <div className="login-bg-gradient login-bg-gradient-2" />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Zap size={26} color="white" />
          </div>
          <span className="login-logo-text">NovaSaaS</span>
        </div>

        <h1 className="login-title">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="login-subtitle">
          {isSignUp
            ? 'Start your journey with NovaSaaS'
            : 'Sign in to continue to your dashboard'}
        </p>

        {/* Quick Login */}
        {!isSignUp && (
          <>
            <button className="login-quick-btn" onClick={handleQuickLogin}>
              <Sparkles size={16} />
              Quick Login as Demo User
            </button>
            <div className="login-divider">
              <span>or sign in with email</span>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-name"
                  className="form-input"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ paddingLeft: 40 }}
                />
                <User
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                className="form-input"
                type="email"
                placeholder={demoCredentials.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="form-input"
                type="password"
                placeholder={isSignUp ? 'Min 4 characters' : demoCredentials.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full" style={{ marginTop: 8 }}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="login-toggle">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
