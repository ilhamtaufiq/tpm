import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../api/services';
import { clearToken, getToken, setToken } from '../api/client';

export interface DashboardUser {
  id: number;
  username: string;
  role: string;
  full_name?: string;
}

interface AuthState {
  user: DashboardUser | null;
  token: string | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const ALLOWED_ROLES = new Set(['ADMIN', 'MANAGER', 'OWNER']);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [ready, setReady] = useState(false);

  // Token survive refresh (localStorage), user tidak — restore via /auth/me.
  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }
    authService
      .me()
      .then((me) => {
        const role = String(me.role ?? '').toUpperCase();
        if (!ALLOWED_ROLES.has(role)) {
          clearToken();
          setTokenState(null);
          return;
        }
        setUser({ id: me.id, username: me.username, role, full_name: me.full_name });
      })
      .catch(() => {
        clearToken();
        setTokenState(null);
      })
      .finally(() => setReady(true));
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authService.login(username, password);
    if (res.otp_required || !res.access_token || !res.user) {
      throw new Error('Akun ini membutuhkan OTP — gunakan aplikasi mobile.');
    }
    const role = String(res.user.role ?? '').toUpperCase();
    if (!ALLOWED_ROLES.has(role)) {
      throw new Error('Role tidak diizinkan mengakses dashboard monitoring.');
    }
    setToken(res.access_token);
    setTokenState(res.access_token);
    setUser({
      id: res.user.id,
      username: res.user.username,
      role,
      full_name: res.user.full_name,
    });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, token, ready, login, logout }), [user, token, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
