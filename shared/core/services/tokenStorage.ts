// Platform-agnostic token storage interface

export interface TokenStorage {
  getToken(): string | null | Promise<string | null>;
  setToken(token: string): void | Promise<void>;
  clearToken(): void | Promise<void>;
}

// Default implementation for web (localStorage)
class WebTokenStorage implements TokenStorage {
  private static readonly KEY = 'ztp_auth_token';

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(WebTokenStorage.KEY);
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WebTokenStorage.KEY, token);
  }

  clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(WebTokenStorage.KEY);
  }
}

// Singleton with swappable implementation (for mobile/native)
let storage: TokenStorage = new WebTokenStorage();

export function setTokenStorage(impl: TokenStorage): void {
  storage = impl;
}

export function getTokenStorage(): TokenStorage {
  return storage;
}
