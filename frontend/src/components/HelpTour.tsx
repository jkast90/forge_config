import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Icon } from './Icon';

interface Slide {
  title: string;
  icon: string;
  /** Page ID to navigate to when this slide is shown (undefined = don't navigate) */
  page?: string;
  content: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: 'Welcome to ZTP Manager',
    icon: 'waving_hand',
    content: (
      <>
        <p>
          ZTP Manager is a Zero Touch Provisioning tool for network devices.
          It automates device discovery, configuration templating, and deployment.
        </p>
        <div className="help-tour-tips">
          <h4>Quick Tips</h4>
          <ul>
            <li>Use the <strong>page selector</strong> in the header to navigate between sections</li>
            <li>The <strong>footer toolbar</strong> provides quick access to settings, API history, telemetry, and this help guide</li>
            <li>Press <kbd>Escape</kbd> to close any dialog</li>
            <li>Most tables support <strong>search</strong>, <strong>sorting</strong>, and <strong>click-to-expand</strong> for details</li>
            <li>Your theme, layout, and page preferences are saved automatically</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Dashboard',
    icon: 'dashboard',
    page: 'dashboard',
    content: (
      <>
        <p>
          The Dashboard gives you an at-a-glance overview of your ZTP environment.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li><strong>Metric cards</strong> show device counts, status breakdown, templates, and vendors</li>
            <li>Click any metric card to <strong>navigate</strong> to that section</li>
            <li><strong>Recent activity</strong> shows the latest discovery events</li>
            <li>Data refreshes automatically every 10 seconds</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Devices',
    icon: 'devices',
    page: 'devices',
    content: (
      <>
        <p>
          The Devices page is where you manage your network inventory.
          Each device is identified by its MAC address.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li><strong>Add Device</strong> to manually register a device with MAC, IP, hostname, and vendor</li>
            <li>Click a row to <strong>expand</strong> and see full device details</li>
            <li>Use the action buttons to <strong>connect test</strong> (ping + SSH), <strong>deploy config</strong>, <strong>sync to NetBox</strong>, or <strong>backup</strong></li>
            <li><strong>Search</strong> across all fields using the search bar</li>
            <li>Status badges show <strong>online</strong>, <strong>offline</strong>, or <strong>pending</strong> state</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Discovery',
    icon: 'search',
    page: 'discovery',
    content: (
      <>
        <p>
          Discovery scans your network for devices via DHCP leases and ARP tables.
          New devices appear automatically and can be added to your inventory.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li><strong>Scan</strong> triggers a network discovery sweep</li>
            <li>Discovered devices show MAC, IP, hostname, and detected vendor</li>
            <li>Click <strong>Add</strong> on any discovered device to register it</li>
            <li>The <strong>DHCP Leases</strong> tab shows all current leases from dnsmasq</li>
            <li>WebSocket notifications alert you in real-time when new devices appear</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Templates',
    icon: 'description',
    page: 'templates',
    content: (
      <>
        <p>
          Configuration templates use Go template syntax to generate
          device-specific configs. Variables like {'{{.Hostname}}'} and {'{{.IP}}'} are
          replaced with actual device values at deploy time.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li><strong>Template Variables</strong> reference table shows all available variables with examples</li>
            <li>The <strong>variable chips</strong> in the editor insert template syntax at your cursor position</li>
            <li><strong>Preview</strong> renders a template with a real or sample device to verify output</li>
            <li><strong>Templatize Config</strong> takes a raw config and detects variables automatically</li>
            <li>Templates can be scoped to a specific <strong>vendor</strong> or left as global</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Vendors',
    icon: 'business',
    page: 'vendors',
    content: (
      <>
        <p>
          Vendors represent network equipment manufacturers. Each vendor has
          MAC prefix (OUI) patterns used for automatic device identification.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li><strong>MAC prefixes</strong> are matched against discovered devices to auto-detect vendor</li>
            <li>Each vendor has <strong>SSH credentials</strong> and connection settings</li>
            <li>The <strong>default template</strong> is used when deploying config to devices of that vendor</li>
            <li>Vendor-specific <strong>commands</strong> customize how configs are pushed (e.g., Cisco IOS vs Arista EOS)</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'DHCP Options',
    icon: 'lan',
    page: 'dhcp',
    content: (
      <>
        <p>
          DHCP Options configure the dnsmasq DHCP server options that are sent
          to devices during the provisioning process.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li>Add standard DHCP options by <strong>number</strong> (e.g., option 66 for TFTP server)</li>
            <li>Options are written to the <strong>dnsmasq configuration</strong> and take effect on restart</li>
            <li>Common options include boot server, boot file, domain name, and NTP server</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Data Explorer',
    icon: 'storage',
    page: 'explorer',
    content: (
      <>
        <p>
          The Data Explorer is a developer tool that lets you inspect the
          Redux store contents in real-time.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li>The <strong>sidebar</strong> lists all store slices with live item counts</li>
            <li>Click any item row to <strong>expand</strong> and see the full JSON</li>
            <li>Use the <strong>copy button</strong> on each row to copy its JSON to clipboard</li>
            <li>Useful for <strong>debugging</strong> data flow and verifying API responses</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Footer Toolbar',
    icon: 'toolbar',
    content: (
      <>
        <p>
          The footer toolbar provides quick access to utility features
          available from any page.
        </p>
        <div className="help-tour-tips">
          <h4>Buttons (left to right)</h4>
          <ul>
            <li><Icon name="add_circle" size={16} /> <strong>Spawn Test Host</strong> — creates a Docker container that simulates a network device for testing</li>
            <li><Icon name="restart_alt" size={16} /> <strong>Reset Discovery</strong> — clears the discovery tracking so all devices are treated as new</li>
            <li><Icon name="insights" size={16} /> <strong>Telemetry</strong> — view application event tracking and performance metrics</li>
            <li><Icon name="history" size={16} /> <strong>API History</strong> — browse all API calls made by the app, with request/response details</li>
            <li><Icon name="settings" size={16} /> <strong>Settings</strong> — configure server URL, SSH credentials, layout, and other preferences</li>
            <li><Icon name="palette" size={16} /> <strong>Theme</strong> — switch between light, dark, and system color themes</li>
            <li><Icon name="help" size={16} /> <strong>Help</strong> — open this guide</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Keyboard & UI Tips',
    icon: 'keyboard',
    content: (
      <>
        <div className="help-tour-tips">
          <h4>Keyboard Shortcuts</h4>
          <ul>
            <li><kbd>Escape</kbd> — close any open dialog or modal</li>
          </ul>
          <h4>Layout Settings</h4>
          <ul>
            <li>Open <strong>Settings</strong> to adjust <strong>page width</strong> (narrow, default, wide, full) and <strong>dialog size</strong></li>
            <li>Layout preferences persist across sessions</li>
          </ul>
          <h4>Notifications</h4>
          <ul>
            <li>Click the <strong>bell icon</strong> in the header to view notification history</li>
            <li>Toast notifications appear briefly for actions like deploy, backup, and errors</li>
            <li>WebSocket events push real-time alerts when new devices are discovered</li>
          </ul>
          <h4>Scratch Pad</h4>
          <ul>
            <li>Click the <strong>sticky note icon</strong> in the header to open a quick notes panel</li>
            <li>Notes are saved in your browser and persist across sessions</li>
          </ul>
        </div>
      </>
    ),
  },
];

interface HelpTourProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when a slide has an associated page — navigates the app in the background */
  onNavigate?: (page: string) => void;
}

export function HelpTour({ isOpen, onClose, onNavigate }: HelpTourProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slide = SLIDES[currentSlide];
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === SLIDES.length - 1;

  // Navigate to the associated page when the slide changes
  useEffect(() => {
    if (isOpen && slide.page && onNavigate) {
      onNavigate(slide.page);
    }
  }, [currentSlide, isOpen]);

  const goNext = () => {
    if (!isLast) setCurrentSlide(currentSlide + 1);
  };

  const goPrev = () => {
    if (!isFirst) setCurrentSlide(currentSlide - 1);
  };

  const goTo = (index: number) => {
    setCurrentSlide(index);
  };

  const handleClose = () => {
    setCurrentSlide(0);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={slide.title}
      variant="wide"
      footer={
        <div className="help-tour-footer">
          <div className="help-tour-dots">
            {SLIDES.map((s, i) => (
              <button
                key={i}
                className={`help-tour-dot${i === currentSlide ? ' active' : ''}`}
                onClick={() => goTo(i)}
                title={s.title}
              >
                <Icon name={s.icon} size={14} />
              </button>
            ))}
          </div>
          <div className="help-tour-nav">
            <Button variant="secondary" onClick={goPrev} disabled={isFirst}>
              <Icon name="chevron_left" size={16} />
              Previous
            </Button>
            {isLast ? (
              <Button onClick={handleClose}>
                Done
              </Button>
            ) : (
              <Button onClick={goNext}>
                Next
                <Icon name="chevron_right" size={16} />
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="help-tour-slide">
        <div className="help-tour-slide-icon">
          <Icon name={slide.icon} size={36} />
        </div>
        <div className="help-tour-slide-content">
          {slide.content}
        </div>
      </div>
    </Modal>
  );
}
