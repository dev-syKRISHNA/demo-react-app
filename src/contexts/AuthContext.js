import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const DEMO_USER = {
  id: 'demo-001',
  name: 'Demo User',
  email: 'demo@example.com',
  password: 'demo123',
  createdAt: new Date().toISOString(),
};

const USERS_KEY = 'demo_users';
const SESSION_KEY = 'demo_current_user';

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(user) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function notifySDKUser(user) {
  if (window.DAP && window.DAP.setUser) {
    window.DAP.setUser({
      id: user.id,
      name: user.name,
      email: user.email
    });
  }
}

function clearSDKUser() {
  if (window.DAP && window.DAP.clearUser) {
    window.DAP.clearUser();
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const users = getStoredUsers();
    const hasDemoUser = users.some((u) => u.email === DEMO_USER.email);
    if (!hasDemoUser) {
      users.push(DEMO_USER);
      saveUsers(users);
    }

    const session = getStoredSession();
    if (session) {
      setUser(session);
      notifySDKUser(session);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((email, password) => {
    const users = getStoredUsers();
    const found = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) {
      return { success: false, error: 'Invalid email or password' };
    }
    const sessionUser = { id: found.id, name: found.name, email: found.email };
    setUser(sessionUser);
    saveSession(sessionUser);
    notifySDKUser(sessionUser);
    return { success: true };
  }, []);

  const signup = useCallback((name, email, password) => {
    const users = getStoredUsers();
    const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return { success: false, error: 'An account with this email already exists' };
    }
    const newUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      password,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveUsers(users);

    const sessionUser = { id: newUser.id, name: newUser.name, email: newUser.email };
    setUser(sessionUser);
    saveSession(sessionUser);
    notifySDKUser(sessionUser);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    saveSession(null);
    clearSDKUser();
  }, []);

  const quickLogin = useCallback(() => {
    return login(DEMO_USER.email, DEMO_USER.password);
  }, [login]);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
    quickLogin,
    demoCredentials: { email: DEMO_USER.email, password: DEMO_USER.password },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
