import { useState, useCallback, useEffect } from 'react';
import { Provider } from 'react-redux';
import { store, useAuth, useAuthState, AuthProvider, useDevices, useWebTheme, useWebSocket, useVendors, useInflight, useModalRoute, useNotificationHistory, lookupVendorByMac, setVendorCache, addNotification, DeviceDiscoveredPayload, getServices, initTelemetry, trackEvent } from '@core';
import { DeviceList } from './components/DeviceList';
import { DeviceForm } from './components/DeviceForm';
import { LoginPage } from './components/LoginPage';
import { SettingsDialog } from './components/SettingsDialog';
import {
  ApiHistory,
  Button,
  Dashboard,
  DataExplorer,
  DhcpOptions,
  Discovery,
  DropdownSelect,
  HelpTour,
  Notifications,
  NotificationPopup,
  ScratchPad,
  Telemetry,
  TemplateBuilder,
  ThemeSelector,
  Tooltip,
  Icon,
  PlusIcon,
  RefreshIcon,
  SpinnerIcon,
  Jobs,
  TopologyManagement,
  VendorActions,
  VendorManagement,
} from './components';
import type { DropdownOption } from './components';
import type { Device, DeviceFormData } from '@core';
import { LayoutProvider } from './context';
import logo from './assets/image.png';

const PAGES: DropdownOption[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', description: 'Overview and activity' },
  { id: 'devices', label: 'Devices', icon: 'devices', description: 'Manage network devices' },
  { id: 'discovery', label: 'Discovery', icon: 'search', description: 'Discover new devices' },
  { id: 'templates', label: 'Templates', icon: 'description', description: 'Build config templates' },
  { id: 'vendors', label: 'Vendors', icon: 'business', description: 'Configure vendor settings' },
  { id: 'dhcp', label: 'DHCP Options', icon: 'lan', description: 'Manage DHCP options' },
  { id: 'topologies', label: 'Topologies', icon: 'hub', description: 'CLOS fabric topologies' },
  { id: 'actions', label: 'Actions', icon: 'terminal', description: 'Vendor quick commands' },
  { id: 'jobs', label: 'Jobs', icon: 'schedule', description: 'View job history' },
  { id: 'explorer', label: 'Data Explorer', icon: 'storage', description: 'Inspect Redux store data' },
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

  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AuthenticatedApp username={username} onLogout={logout} />;
}

function AuthenticatedApp({ username, onLogout }: { username: string | null; onLogout: () => void }) {
  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem('ztp_active_page') || 'dashboard';
  });

  // Persist active page to localStorage
  const handlePageChange = (page: string) => {
    setActivePage(page);
    localStorage.setItem('ztp_active_page', page);
    trackEvent('page_nav', page);
  };
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [initialDeviceData, setInitialDeviceData] = useState<Partial<DeviceFormData> | null>(null);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showApiHistory, setShowApiHistory] = useState(false);
  const [apiHistoryHighlight, setApiHistoryHighlight] = useState<number | null>(null);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [spawningTestHost, setSpawningTestHost] = useState(false);
  const [showScratchPad, setShowScratchPad] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const modalRoute = useModalRoute();
  const { unreadCount } = useNotificationHistory();

  // Initialize telemetry on mount
  useEffect(() => {
    initTelemetry();
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
      const mac = modalRoute.getParam('mac');
      if (mac && devices.length > 0) {
        const device = devices.find(d => d.mac === mac);
        if (device) {
          setEditingDevice(device);
          setShowDeviceForm(true);
        }
      } else if (!mac) {
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
      const vendorInfo = vendors.find(v => v.id === vendorId);
      vendorText = vendorInfo ? ` (${vendorInfo.name})` : ` (${vendorId})`;
    }
    addNotification('info', `New device discovered: ${payload.ip}${vendorText}`);
  }, [vendors]);

  // Connect to WebSocket for real-time notifications
  useWebSocket({
    autoConnect: true,
    onDeviceDiscovered: handleDeviceDiscovered,
  });

  // Clear discovery tracking so all devices will be treated as new
  const handleClearDiscovery = useCallback(async () => {
    try {
      const services = getServices();
      await services.discovery.clearTracking();
      addNotification('success', 'Discovery tracking cleared');
    } catch (err) {
      console.error('Clear discovery error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to clear discovery: ${msg}`);
    }
  }, []);

  // Spawn a test host container
  const handleSpawnTestHost = useCallback(async () => {
    setSpawningTestHost(true);
    try {
      const services = getServices();
      const container = await services.testContainers.spawn({});
      addNotification('success', `Test host spawned: ${container.hostname} (${container.ip})`);
    } catch (err) {
      console.error('Spawn test host error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to spawn test host: ${msg}`);
    } finally {
      setSpawningTestHost(false);
    }
  }, []);

  const handleSubmitDevice = async (device: Partial<Device>) => {
    if (editingDevice) {
      await updateDevice(editingDevice.mac, device);
    } else {
      await createDevice(device);
    }
  };

  const handleEdit = (device: Device) => {
    setEditingDevice(device);
    setShowDeviceForm(true);
    modalRoute.openModal('device-form', { mac: device.mac });
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
          <img src={logo} alt="Logo" className="header-logo" />
          <h1>ZTP Manager</h1>
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
            />
          </div>
        </div>
      </header>

      <div className="container">
        {activePage === 'dashboard' && (
          <Dashboard onNavigate={handlePageChange} />
        )}

        {activePage === 'devices' && (
          <>
            <div className="actions-bar">
              <Button
                onClick={() => {
                  setEditingDevice(null);
                  setShowDeviceForm(true);
                  modalRoute.openModal('device-form');
                }}
              >
                <PlusIcon size={16} />
                Add Device
              </Button>
              <Button variant="secondary" onClick={refresh}>
                <RefreshIcon size={16} />
                Refresh
              </Button>
            </div>

            <DeviceList
              onEdit={handleEdit}
              onDelete={deleteDevice}
              onBackup={triggerBackup}
              onRefresh={refresh}
            />
          </>
        )}

        {activePage === 'discovery' && (
          <Discovery
            onAddDevice={(device) => {
              setEditingDevice(null);
              setInitialDeviceData(device);
              setShowDeviceForm(true);
              modalRoute.openModal('device-form');
            }}
          />
        )}

        {activePage === 'templates' && (
          <TemplateBuilder />
        )}

        {activePage === 'vendors' && (
          <VendorManagement />
        )}

        {activePage === 'dhcp' && (
          <DhcpOptions />
        )}

        {activePage === 'topologies' && (
          <TopologyManagement />
        )}

        {activePage === 'actions' && (
          <VendorActions />
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
          {inflightCount > 0 && <InflightIndicator count={inflightCount} />}
          <div className="footer-actions">
            <Tooltip content="Spawn test host">
              <button
                className="icon-button"
                onClick={handleSpawnTestHost}
                disabled={spawningTestHost}
              >
                {spawningTestHost ? <SpinnerIcon size={20} /> : <Icon name="add_circle" size={20} />}
              </button>
            </Tooltip>
            {activePage !== 'discovery' && (
              <Tooltip content="Reset discovery tracking">
                <button
                  className="icon-button"
                  onClick={handleClearDiscovery}
                >
                  <Icon name="restart_alt" size={20} />
                </button>
              </Tooltip>
            )}
            <Tooltip content="Telemetry">
              <button
                className="icon-button"
                onClick={() => { setShowTelemetry(true); modalRoute.openModal('telemetry'); }}
              >
                <Icon name="insights" size={20} />
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
        initialData={initialDeviceData}
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

      <HelpTour
        isOpen={showHelp}
        onClose={() => { setShowHelp(false); modalRoute.closeModal(); }}
        onNavigate={handlePageChange}
      />

      <NotificationPopup />
    </>
  );
}

// Main App component wraps with providers
function App() {
  const auth = useAuthState();
  return (
    <Provider store={store}>
      <AuthProvider value={auth}>
        <LayoutProvider>
          <AppContent />
        </LayoutProvider>
      </AuthProvider>
    </Provider>
  );
}

export default App;
