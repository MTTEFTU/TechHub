'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { apiRequest, ApiUser } from '@/lib/api';

type AuthValue = {
  user: ApiUser | null;
  token: string | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (values: { name: string; email: string; phone: string; password: string }) => Promise<void>;
  updateUser: (user: ApiUser) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);
const TOKEN_KEY = 'tech-hub-token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setReady(true); return; }
    setToken(saved);
    apiRequest<{ user: ApiUser }>('/auth/profile', {}, saved)
      .then(({ user: current }) => setUser(current))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true));
  }, []);

  async function authenticate(path: string, values: Record<string, string>) {
    const result = await apiRequest<{ token: string; user: ApiUser }>(path, { method: 'POST', body: JSON.stringify(values) });
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, token, ready, signIn: (email, password) => authenticate('/auth/login', { email, password }), register: (values) => authenticate('/auth/register', values), updateUser: setUser, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}