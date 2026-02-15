import { useState, useEffect, useCallback, useMemo } from 'react';

interface ModalRoute {
  modal: string | null;
  params: Record<string, string>;
}

function parseHash(): ModalRoute {
  const hash = typeof window !== 'undefined' && window.location ? window.location.hash.slice(1) : '';
  if (!hash) return { modal: null, params: {} };

  const parts = hash.split('&');
  const params: Record<string, string> = {};

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = decodeURIComponent(part.slice(0, eqIdx));
    const value = decodeURIComponent(part.slice(eqIdx + 1));
    params[key] = value;
  }

  const modal = params.modal || null;
  delete params.modal;

  return { modal, params };
}

function buildHash(modal: string, params?: Record<string, string>): string {
  const parts = [`modal=${encodeURIComponent(modal)}`];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') {
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
      }
    }
  }
  return '#' + parts.join('&');
}

export interface UseModalRouteReturn {
  /** Currently open modal name, or null */
  modal: string | null;
  /** Params associated with the current modal */
  params: Record<string, string>;
  /** Open a modal and update the URL hash */
  openModal: (name: string, params?: Record<string, string>) => void;
  /** Close the current modal and clear the URL hash */
  closeModal: () => void;
  /** Check if a specific modal is currently open */
  isModal: (name: string) => boolean;
  /** Get a specific param value */
  getParam: (key: string) => string | undefined;
}

export function useModalRoute(): UseModalRouteReturn {
  const [route, setRoute] = useState<ModalRoute>(parseHash);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const handleHashChange = () => {
      setRoute(parseHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openModal = useCallback((name: string, params?: Record<string, string>) => {
    if (typeof window !== 'undefined' && window.location) {
      window.location.hash = buildHash(name, params);
    }
  }, []);

  const closeModal = useCallback(() => {
    if (typeof window !== 'undefined' && window.location && typeof history !== 'undefined' && history.replaceState) {
      // Use replaceState to avoid polluting history with empty hash entries
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setRoute({ modal: null, params: {} });
  }, []);

  const isModal = useCallback((name: string) => route.modal === name, [route.modal]);

  const getParam = useCallback((key: string) => route.params[key], [route.params]);

  return useMemo(() => ({
    modal: route.modal,
    params: route.params,
    openModal,
    closeModal,
    isModal,
    getParam,
  }), [route, openModal, closeModal, isModal, getParam]);
}
