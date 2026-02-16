import { useState, useEffect, useCallback } from 'react';
import { useAuth, checkApiHealth, getLocalApiUrl, setLocalApiUrl, configureServices } from '@core';
import type { Branding } from '@core';
import { Button } from './Button';
import defaultLogo from '../assets/logo.svg';

interface Props {
  branding?: Branding;
}

export function LoginPage({ branding }: Props) {
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState(getLocalApiUrl());
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const testConnection = useCallback(async (url: string) => {
    setChecking(true);
    const reachable = await checkApiHealth(url);
    setApiReachable(reachable);
    setChecking(false);
  }, []);

  useEffect(() => {
    testConnection(getLocalApiUrl());
  }, [testConnection]);

  const handleSaveUrl = async () => {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    setLocalApiUrl(cleanUrl);
    configureServices({ baseUrl: cleanUrl });
    await testConnection(cleanUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
    } catch {
      // Error is handled by useAuth
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src={branding?.logo_url || defaultLogo} alt="Logo" className="login-logo" />
          <h2>{branding?.app_name || 'ForgeConfig'}</h2>
        </div>

        {apiReachable === false && (
          <div className="login-api-config">
            <div className="login-api-warning">
              Unable to reach the API server. Please check the URL below.
            </div>
            <div className="login-field">
              <label htmlFor="apiUrl">API Server URL</label>
              <input
                id="apiUrl"
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8088"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl()}
              />
            </div>
            <Button onClick={handleSaveUrl} disabled={checking || !apiUrl}>
              {checking ? 'Checking...' : 'Test Connection'}
            </Button>
          </div>
        )}

        {apiReachable === true && (
          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="username">Username</label>
              Default: admin/admin
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>
            {error && <div className="login-error">{error}</div>}
            <Button type="submit" disabled={loading || !username || !password}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
            <button
              type="button"
              className="login-change-url"
              onClick={() => setApiReachable(false)}
            >
              Change API URL
            </button>
          </form>
        )}

        {checking && apiReachable === null && (
          <div className="login-api-checking">
            Connecting to API server...
          </div>
        )}
      </div>
    </div>
  );
}
