import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { getServices } from '../services';
import { getTokenStorage } from '../services/tokenStorage';
import type { LoginRequest } from '../services/auth';

export interface UseAuthReturn {
  isAuthenticated: boolean;
  username: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<UseAuthReturn | null>(null);

export const AuthProvider = AuthContext.Provider;

export function useAuthState(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const tokenStorage = getTokenStorage();
      const token = await tokenStorage.getToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp * 1000 > Date.now()) {
            setIsAuthenticated(true);
            setUsername(payload.username);
          } else {
            tokenStorage.clearToken();
          }
        } catch {
          tokenStorage.clearToken();
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // Listen for 401 events from BaseService
  useEffect(() => {
    const handler = () => {
      setIsAuthenticated(false);
      setUsername(null);
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('auth:unauthorized', handler);
      return () => window.removeEventListener('auth:unauthorized', handler);
    }
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    setLoading(true);
    setError(null);
    try {
      const services = getServices();
      const response = await services.auth.login(credentials);
      const tokenStorage = getTokenStorage();
      await tokenStorage.setToken(response.token);
      setIsAuthenticated(true);
      setUsername(response.username);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    const tokenStorage = getTokenStorage();
    tokenStorage.clearToken();
    setIsAuthenticated(false);
    setUsername(null);
  }, []);

  return { isAuthenticated, username, login, logout, loading, error };
}

export function useAuth(): UseAuthReturn {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
