import { getTokenStorage } from './tokenStorage';

// Base service infrastructure

export interface ServiceConfig {
  baseUrl?: string;
  getBaseUrl?: () => string | Promise<string>;
  fetch?: typeof fetch;
  maxRetries?: number;
  baseRetryDelay?: number; // ms
}

// Global configuration - can be set once at app startup
let globalConfig: ServiceConfig = {
  baseUrl: '/api',
  maxRetries: 3,
  baseRetryDelay: 1000,
};

export function configureServices(config: ServiceConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

export function getServiceConfig(): ServiceConfig {
  return globalConfig;
}

// Global inflight mutation tracking
let inflightCount = 0;
const inflightListeners = new Set<(count: number) => void>();

export function getInflightCount(): number {
  return inflightCount;
}

export function onInflightChange(listener: (count: number) => void): () => void {
  inflightListeners.add(listener);
  return () => inflightListeners.delete(listener);
}

function changeInflight(delta: number) {
  inflightCount = Math.max(0, inflightCount + delta);
  inflightListeners.forEach(fn => fn(inflightCount));
}

// API call history tracking
export interface ApiHistoryEntry {
  id: number;
  method: string;
  url: string;
  path: string;
  queryParams: Record<string, string>;
  status: number | null;
  error: string | null;
  durationMs: number;
  timestamp: number;
  requestBody: unknown | null;
  responseBody: unknown | null;
}

const MAX_HISTORY = 100;
let historyIdCounter = 0;
const apiHistory: ApiHistoryEntry[] = [];
const historyListeners = new Set<(entries: ApiHistoryEntry[]) => void>();

function addHistoryEntry(entry: ApiHistoryEntry) {
  apiHistory.unshift(entry);
  if (apiHistory.length > MAX_HISTORY) {
    apiHistory.length = MAX_HISTORY;
  }
  historyListeners.forEach(fn => fn([...apiHistory]));
}

export function getApiHistory(): ApiHistoryEntry[] {
  return [...apiHistory];
}

export function clearApiHistory(): void {
  apiHistory.length = 0;
  historyListeners.forEach(fn => fn([]));
}

export function onApiHistoryChange(listener: (entries: ApiHistoryEntry[]) => void): () => void {
  historyListeners.add(listener);
  return () => historyListeners.delete(listener);
}

// Request deduplication cache for GET requests
interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest<unknown>>();
const REQUEST_DEDUP_WINDOW = 100; // ms - dedupe requests within this window

// Clean up old pending requests periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingRequests.entries()) {
    if (now - value.timestamp > 5000) {
      pendingRequests.delete(key);
    }
  }
}, 10000);

// Check if the API is reachable at the given URL.
// Accepts either a base URL (e.g., "http://host:8088") or an API URL (e.g., "/api" or "http://host:8088/api").
// Hits the /api/health endpoint.
export async function checkApiHealth(baseUrl: string): Promise<boolean> {
  try {
    const clean = baseUrl.replace(/\/+$/, '');
    const url = clean.endsWith('/api') ? `${clean}/health` : `${clean}/api/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export class BaseService {
  protected config: ServiceConfig;
  protected fetchFn: typeof fetch;

  constructor(config?: ServiceConfig) {
    this.config = config || globalConfig;
    this.fetchFn = this.config.fetch || ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  }

  protected async getBaseUrl(): Promise<string> {
    if (this.config.getBaseUrl) {
      return this.config.getBaseUrl();
    }
    return this.config.baseUrl || '/api';
  }

  private async executeRequest<T>(url: string, options?: RequestInit, historyEntry?: ApiHistoryEntry): Promise<T> {
    // Attach auth token if available
    const tokenStorage = getTokenStorage();
    const token = await tokenStorage.getToken();
    const authHeaders: Record<string, string> = token
      ? { 'Authorization': `Bearer ${token}` }
      : {};

    const response = await this.fetchFn(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options?.headers,
      },
    });

    if (historyEntry) {
      historyEntry.status = response.status;
    }

    if (!response.ok) {
      // Handle 401: clear token and notify UI
      if (response.status === 401) {
        tokenStorage.clearToken();
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
      }

      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      const message = error.error || `HTTP ${response.status}`;
      if (historyEntry) {
        historyEntry.error = message;
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json();
    if (historyEntry) {
      historyEntry.responseBody = data;
    }
    return data;
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return true; // Network error
    }
    if (error instanceof Error) {
      const message = error.message;
      // Retry on server errors (5xx) and some specific 4xx
      if (message.includes('HTTP 5') || message.includes('HTTP 429')) {
        return true;
      }
    }
    return false;
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = this.config.maxRetries || 3,
    baseDelay: number = this.config.baseRetryDelay || 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry if it's not a retryable error or we're out of retries
        if (!this.isRetryableError(error) || attempt === retries) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private parseQueryParams(path: string): Record<string, string> {
    const qIdx = path.indexOf('?');
    if (qIdx === -1) return {};
    const params: Record<string, string> = {};
    const search = path.slice(qIdx + 1);
    for (const pair of search.split('&')) {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
    }
    return params;
  }

  private createHistoryEntry(method: string, url: string, path: string, body?: unknown): ApiHistoryEntry {
    return {
      id: ++historyIdCounter,
      method,
      url,
      path,
      queryParams: this.parseQueryParams(path),
      status: null,
      error: null,
      durationMs: 0,
      timestamp: Date.now(),
      requestBody: body ?? null,
      responseBody: null,
    };
  }

  protected async request<T>(path: string, options?: RequestInit): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}${path}`;
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.parse(options.body as string) : undefined;
    const entry = this.createHistoryEntry(method, url, path, body);
    const start = Date.now();

    // Only deduplicate GET requests
    if (method === 'GET') {
      const cacheKey = url;
      const now = Date.now();
      const pending = pendingRequests.get(cacheKey);

      // Return existing promise if request is already in flight (within dedup window)
      if (pending && now - pending.timestamp < REQUEST_DEDUP_WINDOW) {
        return pending.promise as Promise<T>;
      }

      // Create new request with retry logic
      const promise = this.retryWithBackoff(() => this.executeRequest<T>(url, options, entry));

      pendingRequests.set(cacheKey, { promise, timestamp: now });

      // Clean up after request completes
      promise
        .then(() => {
          entry.durationMs = Date.now() - start;
          addHistoryEntry(entry);
        })
        .catch((err) => {
          entry.durationMs = Date.now() - start;
          if (!entry.error) entry.error = err instanceof Error ? err.message : String(err);
          addHistoryEntry(entry);
        })
        .finally(() => {
          const current = pendingRequests.get(cacheKey);
          if (current && current.promise === promise) {
            pendingRequests.delete(cacheKey);
          }
        });

      return promise;
    }

    // Non-GET requests: track inflight, retry, no deduplication
    changeInflight(1);
    try {
      const result = await this.retryWithBackoff(() => this.executeRequest<T>(url, options, entry));
      entry.durationMs = Date.now() - start;
      addHistoryEntry(entry);
      return result;
    } catch (err) {
      entry.durationMs = Date.now() - start;
      if (!entry.error) entry.error = err instanceof Error ? err.message : String(err);
      addHistoryEntry(entry);
      throw err;
    } finally {
      changeInflight(-1);
    }
  }

  protected get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  protected post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  protected delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}
