import { useState, useCallback, useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { store, useAuth, useAuthState, AuthProvider, useDevices, useWebTheme, useWebSocket, useVendors, useSettings, useInflight, useModalRoute, useNotificationHistory, lookupVendorByMac, setVendorCache, addNotification, navigateAction, registerNavigator, DeviceDiscoveredPayload, getServices, initTelemetry, trackEvent, getApiHistory, getTelemetryEvents, type WebSocketEvent } from '@core';
import type { Branding } from '@core';
import { DeviceForm } from './components/DeviceForm';
import { LoginPage } from './components/LoginPage';
import { SettingsDialog } from './components/SettingsDialog';
import {
  ApiHistory,
  Button,
  CodeGeneratorDialog,
  Dashboard,
  DataExplorer,
  DropdownSelect,
  ErrorBoundary,
  Resources,
  HelpTour,
  Notifications,
  NotificationPopup,
  ScratchPad,
  Telemetry,
  ConfigManagement,
  ThemeSelector,
  Tooltip,
  Icon,
  PlusIcon,
  RefreshIcon,
  SpinnerIcon,
  Jobs,
  VendorsAndModels,
  IpamManagement,
  Locations,
  TopologyManagement,
  SystemSettings,
} from './components';
import type { DropdownOption } from './components';
import type { Device, DeviceFormData } from '@core';
import { LayoutProvider } from './context';
import defaultLogo from './assets/logo.svg';

// Hook to fetch public branding (works without auth, uses direct fetch)
function useBranding() {
  const [branding, setBranding] = useState<Branding>({ app_name: 'ForgeConfig', logo_url: null });
  useEffect(() => {
    fetch('/api/branding')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setBranding)
      .catch(() => {/* use defaults */});
  }, []);

  // Update document title and favicon when branding changes
  useEffect(() => {
    document.title = branding.app_name || 'ForgeConfig';
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) {
      link.href = branding.logo_url || '/favicon.png';
    }
  }, [branding.app_name, branding.logo_url]);

  return branding;
}

const PAGES: DropdownOption[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', description: 'Overview and activity' },
  { id: 'config', label: 'Configuration', icon: 'description', description: 'Templates, groups, variables' },
  { id: 'resources', label: 'Devices & Tenants', icon: 'devices', description: 'Devices, tenants, VRFs, GPU clusters' },
  { id: 'ipam', label: 'IPAM', icon: 'lan', description: 'IP Address Management' },
  { id: 'jobs', label: 'Jobs', icon: 'schedule', description: 'Actions, job history, templates, credentials' },
  { id: 'locations', label: 'Locations', icon: 'account_tree', description: 'Regions, campuses, datacenters' },
  { id: 'topologies', label: 'Topologies', icon: 'hub', description: 'Network topologies' },
  { id: 'system', label: 'System', icon: 'settings', description: 'Users, branding, device naming' },
  { id: 'vendors-models', label: 'Vendors & Models', icon: 'business', description: 'Vendors, DHCP options, device models' },
];

const LOADING_MESSAGES = [
  'Reticulating splines...',
  'Herding packets...',
  'Convincing electrons to cooperate...',
  'Asking the network nicely...',
  'Feeding the hamsters...',
  'Untangling cables...',
  'Bribing the firewall...',
  'Warming up the flux capacitor...',
  'Negotiating with DHCP...',
  'Teaching switches new tricks...',
  'Polishing the routing tables...',
  'Consulting the RFC oracle...',
  'Defragmenting the internet...',
  'Compiling excuses...',
  'Pinging the mothership...',
];

function InflightIndicator({ count }: { count: number }) {
  const [message] = useState(() =>
    LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
  );

  return (
    <div className="inflight-indicator">
      <SpinnerIcon size={14} />
      <span className="inflight-text">{message}</span>
      {count > 1 && <span className="inflight-count">({count})</span>}
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, username, logout, loading: authLoading } = useAuth();
  const branding = useBranding();

  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <LoginPage branding={branding} />;
  }

  return <AuthenticatedApp username={username} onLogout={logout} />;
}

function AuthenticatedApp({ username, onLogout }: { username: string | null; onLogout: () => void }) {
  const { settings } = useSettings();
  const [activePage, setActivePage] = useState(() => {
    const saved = localStorage.getItem('fc_active_page') || 'dashboard';
    // Migrate old page IDs to combined page
    if (saved === 'vendors' || saved === 'dhcp' || saved === 'device-models') return 'vendors-models';
    if (saved === 'templates' || saved === 'groups' || saved === 'variables' || saved === 'inspector') return 'config';
    if (saved === 'devices' || saved === 'tenants' || saved === 'discovery') return 'resources';
    if (saved === 'actions') return 'jobs';
    if (saved === 'users') return 'system';
    return saved;
  });

  const handleBugReport = useCallback(() => {
    const readStorage = (storage: Storage): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)!;
        const raw = storage.getItem(key);
        try { out[key] = JSON.parse(raw!); } catch { out[key] = raw; }
      }
      return out;
    };
    const report = {
      timestamp: new Date().toISOString(),
      apiHistory: getApiHistory(),
      telemetry: getTelemetryEvents(),
      reduxStore: store.getState(),
      localStorage: readStorage(localStorage),
      sessionStorage: readStorage(sessionStorage),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forgeconfig-bugreport-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Keep document title and favicon in sync with settings changes
  useEffect(() => {
    if (!settings) return;
    document.title = settings.app_name || 'ForgeConfig';
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) {
      link.href = settings.logo_url || '/favicon.png';
    }
  }, [settings?.app_name, settings?.logo_url]);

  // Persist active page to localStorage
  const handlePageChange = useCallback((page: string) => {
    setActivePage(page);
    localStorage.setItem('fc_active_page', page);
    trackEvent('page_nav', page);
  }, []);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [initialDeviceData, setInitialDeviceData] = useState<Partial<DeviceFormData> | null>(null);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiHistory, setShowApiHistory] = useState(false);
  const [apiHistoryHighlight, setApiHistoryHighlight] = useState<number | null>(null);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showScratchPad, setShowScratchPad] = useState(false);
  const [showCodeGenerator, setShowCodeGenerator] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const modalRoute = useModalRoute();
  const { unreadCount } = useNotificationHistory();

  // Use ref-based navigator so the handler always has access to current state/callbacks
  const navigationRef = useRef<(target: { page: string; dialog?: string }) => void>();
  navigationRef.current = ({ page, dialog }) => {
    if (page) handlePageChange(page);
    if (dialog === 'api-history') { setShowApiHistory(true); modalRoute.openModal('api-history'); }
    if (dialog === 'settings') { setShowSettings(true); modalRoute.openModal('settings'); }
    if (dialog === 'notifications') { setShowNotifications(true); modalRoute.openModal('notifications'); }
  };

  // Initialize telemetry on mount and register navigator for deep linking
  useEffect(() => {
    initTelemetry();
    registerNavigator((target) => navigationRef.current?.(target));
  }, []);

  const { theme, setTheme: setThemeRaw } = useWebTheme();
  const setTheme = useCallback((newTheme: string) => {
    setThemeRaw(newTheme as typeof theme);
    trackEvent('theme_change', newTheme);
  }, [setThemeRaw]);
  const inflightCount = useInflight();
  const {
    devices,
    loading,
    refresh,
    createDevice,
    updateDevice,
    deleteDevice,
    triggerBackup,
  } = useDevices();
  const { vendors } = useVendors();

  // Initialize vendor cache for MAC lookups when vendors are loaded
  useEffect(() => {
    if (vendors.length > 0) {
      setVendorCache(vendors);
    }
  }, [vendors]);

  // Restore modal state from URL hash on mount
  useEffect(() => {
    if (modalRoute.isModal('settings')) {
      setShowSettings(true);
    } else if (modalRoute.isModal('api-history')) {
      setShowApiHistory(true);
    } else if (modalRoute.isModal('telemetry')) {
      setShowTelemetry(true);
    } else if (modalRoute.isModal('notifications')) {
      setShowNotifications(true);
    } else if (modalRoute.isModal('help')) {
      setShowHelp(true);
    } else if (modalRoute.isModal('device-form')) {
      const idParam = modalRoute.getParam('id');
      if (idParam && devices.length > 0) {
        const device = devices.find(d => d.id === Number(idParam));
        if (device) {
          setEditingDevice(device);
          setShowDeviceForm(true);
        }
      } else if (!idParam) {
        setShowDeviceForm(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalRoute.modal, devices.length]);

  // WebSocket handler for device discovery notifications
  const handleDeviceDiscovered = useCallback((payload: DeviceDiscoveredPayload) => {
    const vendorId = lookupVendorByMac(payload.mac);
    let vendorText = '';
    if (vendorId && vendorId !== 'local') {
      const vendorInfo = vendors.find(v => String(v.id) === vendorId);
      vendorText = vendorInfo ? ` (${vendorInfo.name})` : ` (${vendorId})`;
    }
    addNotification('info', `New device discovered: ${payload.ip}${vendorText}`);
  }, [vendors]);

  // WebSocket handler for broadcast/message notifications
  const handleBroadcastEvent = useCallback((event: WebSocketEvent) => {
    if (event.type !== 'system_broadcast' && event.type !== 'message') return;
    const p = event.payload as Record<string, unknown> | null;
    let text: string;
    if (p && typeof p.message === 'string') {
      text = p.message;
    } else if (p && Object.keys(p).length > 0) {
      text = JSON.stringify(p);
    } else {
      text = event.type === 'system_broadcast' ? 'System broadcast received' : 'Message received';
    }
    addNotification('info', text);
  }, []);

  // Connect to WebSocket for real-time notifications
  useWebSocket({
    autoConnect: true,
    onDeviceDiscovered: handleDeviceDiscovered,
    onAnyEvent: handleBroadcastEvent,
  });


  const handleSubmitDevice = async (device: Partial<Device>) => {
    if (editingDevice) {
      await updateDevice(editingDevice.id, device);
    } else {
      await createDevice(device);
    }
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setShowDeviceForm(true);
    modalRoute.openModal('device-form', { id: String(device.id) });
  };

  const handleCloseForm = () => {
    setEditingDevice(null);
    setInitialDeviceData(null);
    setShowDeviceForm(false);
    modalRoute.closeModal();
  };

  return (
    <>
      <header>
        <div className="header-content">
          <img src={settings?.logo_url || defaultLogo} alt="Logo" className="header-logo" />
          <h1>{settings?.app_name || 'ForgeConfig'}</h1>
          <div className="header-meta">
            {username && <div className="header-meta-row"><span className="header-meta-label">user:</span> {username}</div>}
            <div className="header-meta-row"><span className="header-meta-label">commit:</span> {__COMMIT_HASH__}</div>
          </div>
          <div className="header-controls">
            <Tooltip content="Notifications" position="bottom">
              <button
                className="header-control"
                onClick={() => { setShowNotifications(true); modalRoute.openModal('notifications'); }}
                style={{ position: 'relative', width: 40 }}
              >
                <Icon name="notifications" size={20} />
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
            </Tooltip>
            <Tooltip content="Notes" position="bottom">
              <button
                className="header-control"
                onClick={() => setShowScratchPad((v) => !v)}
                style={{ width: 40 }}
              >
                <Icon name="sticky_note_2" size={20} />
              </button>
            </Tooltip>
            <Tooltip content={`Logout${username ? ` (${username})` : ''}`} position="bottom">
              <button
                className="header-control"
                onClick={onLogout}
                style={{ width: 40 }}
              >
                <Icon name="logout" size={20} />
              </button>
            </Tooltip>
            <DropdownSelect
              options={PAGES}
              value={activePage}
              onChange={handlePageChange}
              placeholder="Select page..."
              icon="menu"
              className="header-nav"
              triggerClassName="header-control header-control-dropdown"
              columnRows={5}
              searchable
            />
          </div>
        </div>
      </header>

      <div className="container">
        {activePage === 'dashboard' && (
          <Dashboard onNavigate={handlePageChange} />
        )}

        {activePage === 'resources' && (
          <Resources
            onEditDevice={handleEdit}
            onDeleteDevice={deleteDevice}
            onBackupDevice={triggerBackup}
            onRefreshDevices={refresh}
            onAddDevice={() => {
              setEditingDevice(null);
              setInitialDeviceData(null);
              setShowDeviceForm(true);
              modalRoute.openModal('device-form');
            }}
            onAddDiscoveredDevice={(device) => {
              setEditingDevice(null);
              setInitialDeviceData({
                ...device,
                topology_id: device.topology_id != null ? String(device.topology_id) : undefined,
              });
              setShowDeviceForm(true);
              modalRoute.openModal('device-form');
            }}
          />
        )}

        {activePage === 'topologies' && (
          <TopologyManagement />
        )}

        {activePage === 'config' && (
          <ConfigManagement />
        )}

        {activePage === 'system' && (
          <SystemSettings />
        )}

        {activePage === 'vendors-models' && (
          <VendorsAndModels />
        )}

        {activePage === 'ipam' && (
          <IpamManagement />
        )}

        {activePage === 'locations' && (
          <Locations />
        )}

        {activePage === 'jobs' && (
          <Jobs />
        )}

        {activePage === 'explorer' && (
          <DataExplorer />
        )}
      </div>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            {inflightCount > 0 && <InflightIndicator count={inflightCount} />}
            <Tooltip content="QR / Barcode Generator">
              <button
                className="icon-button"
                onClick={() => setShowCodeGenerator(true)}
              >
                <Icon name="qr_code_2" size={20} />
              </button>
            </Tooltip>
            <Tooltip content="API call history">
              <button
                className="icon-button"
                onClick={() => { setShowApiHistory(true); modalRoute.openModal('api-history'); }}
              >
                <Icon name="history" size={20} />
              </button>
            </Tooltip>
            <Tooltip content="Telemetry">
              <button
                className="icon-button"
                onClick={() => { setShowTelemetry(true); modalRoute.openModal('telemetry'); }}
              >
                <Icon name="insights" size={20} />
              </button>
            </Tooltip>
            <Tooltip content="Data Explorer">
              <button
                className="icon-button"
                onClick={() => handlePageChange('explorer')}
              >
                <Icon name="storage" size={20} />
              </button>
            </Tooltip>
            <Tooltip content="Download bug report">
              <button
                className="icon-button"
                onClick={handleBugReport}
              >
                <Icon name="bug_report" size={20} />
              </button>
            </Tooltip>
          </div>
          <div className="footer-actions">
            <Tooltip content="Settings">
              <button
                className="icon-button"
                onClick={() => { setShowSettings(true); modalRoute.openModal('settings'); }}
              >
                <Icon name="settings" size={20} />
              </button>
            </Tooltip>
            <ThemeSelector theme={theme} onThemeChange={setTheme} />
            <Tooltip content="Help & Tour">
              <button
                className="icon-button"
                onClick={() => { setShowHelp(true); modalRoute.openModal('help'); }}
              >
                <Icon name="help" size={20} />
              </button>
            </Tooltip>
          </div>
        </div>
      </footer>

      <DeviceForm
        isOpen={showDeviceForm}
        device={editingDevice}
        initialData={initialDeviceData as Record<string, string> | null}
        onSubmit={handleSubmitDevice}
        onClose={handleCloseForm}
      />

      <SettingsDialog
        isOpen={showSettings}
        onClose={() => { setShowSettings(false); modalRoute.closeModal(); }}
      />

      <ApiHistory
        isOpen={showApiHistory}
        onClose={() => { setShowApiHistory(false); setApiHistoryHighlight(null); modalRoute.closeModal(); }}
        highlightTimestamp={apiHistoryHighlight}
      />

      <Telemetry
        isOpen={showTelemetry}
        onClose={() => { setShowTelemetry(false); modalRoute.closeModal(); }}
      />

      <Notifications
        isOpen={showNotifications}
        onClose={() => { setShowNotifications(false); modalRoute.closeModal(); }}
        onViewApiError={(timestamp) => {
          setShowNotifications(false);
          setApiHistoryHighlight(timestamp);
          setShowApiHistory(true);
          modalRoute.openModal('api-history');
        }}
      />

      <ScratchPad
        isOpen={showScratchPad}
        onClose={() => setShowScratchPad(false)}
      />

      <CodeGeneratorDialog
        isOpen={showCodeGenerator}
        onClose={() => setShowCodeGenerator(false)}
      />

      <HelpTour
        isOpen={showHelp}
        onClose={() => { setShowHelp(false); modalRoute.closeModal(); }}
        onNavigate={handlePageChange}
      />

      <NotificationPopup
        onViewApiError={(timestamp) => {
          setApiHistoryHighlight(timestamp);
          setShowApiHistory(true);
          modalRoute.openModal('api-history');
        }}
      />
    </>
  );
}

// Main App component wraps with providers
function App() {
  const auth = useAuthState();
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <AuthProvider value={auth}>
          <LayoutProvider>
            <AppContent />
          </LayoutProvider>
        </AuthProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
