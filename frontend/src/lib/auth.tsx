import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'solicitante' | 'aprovador' | 'comprador' | 'gestor' | 'admin';
  organizationId: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (...roles: User['role'][]) => boolean;
}

const Ctx = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<User & { full_name?: string }>('/auth/me')
      .then((u) => setUser({ ...u, name: u.name ?? u.full_name ?? u.email }))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      can: (...roles) => !!user && roles.includes(user.role),
      async login(email, password) {
        const res = await api<{ token: string; user: User }>('/auth/login', {
          method: 'POST',
          json: { email, password },
        });
        setToken(res.token);
        setUser(res.user);
      },
      logout() {
        setToken(null);
        setUser(null);
        location.href = '/login';
      },
    }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
