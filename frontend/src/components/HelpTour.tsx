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
    title: 'Welcome to ForgeConfig',
    icon: 'waving_hand',
    content: (
      <>
        <p>
          ForgeConfig is a network device provisioning tool.
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
          The Dashboard gives you an at-a-glance overview of your environment.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li><strong>Metric cards</strong> show device counts, discovery status, topologies, and IPAM data</li>
            <li>Click any metric card to <strong>navigate</strong> to that section</li>
            <li><strong>Device Status</strong> breaks down online, offline, provisioning, and unknown counts</li>
            <li><strong>Recent activity</strong> shows the latest discovery events</li>
            <li><strong>Feature links</strong> provide a quick overview of all configuration and infrastructure sections with live counts</li>
            <li>Data refreshes automatically every 10 seconds</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Devices & Discovery',
    icon: 'devices',
    page: 'devices',
    content: (
      <>
        <p>
          The Devices page combines device management and network discovery in a single view.
        </p>
        <div className="help-tour-tips">
          <h4>Devices</h4>
          <ul>
            <li><strong>Add Device</strong> to manually register a device with MAC, IP, hostname, and vendor</li>
            <li>Click a row to <strong>expand</strong> and see full device details including topology placement</li>
            <li>Use action buttons to <strong>connect test</strong> (ping + SSH), <strong>deploy config</strong>, <strong>sync to NetBox</strong>, or <strong>backup</strong></li>
            <li><strong>Search</strong> across all fields using the search bar</li>
          </ul>
          <h4>Discovery</h4>
          <ul>
            <li>Discovery scans your network for devices via <strong>DHCP leases</strong> and <strong>ARP tables</strong></li>
            <li>New devices appear automatically and can be added to your inventory</li>
            <li><strong>WebSocket</strong> notifications alert you in real-time when new devices appear</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Configuration',
    icon: 'description',
    page: 'config',
    content: (
      <>
        <p>
          The Configuration page combines templates, groups, variables, and the variable inspector
          into a single tabbed interface.
        </p>
        <div className="help-tour-tips">
          <h4>Templates</h4>
          <ul>
            <li>Configuration templates use <strong>Go template syntax</strong> — variables like {'{{.Hostname}}'} are replaced with device values at deploy time</li>
            <li><strong>Variable chips</strong> insert template syntax at your cursor position</li>
            <li><strong>Preview</strong> renders a template with a real or sample device to verify output</li>
            <li><strong>Templatize Config</strong> takes a raw config and detects variables automatically</li>
          </ul>
          <h4>Groups</h4>
          <ul>
            <li>Organize devices into <strong>hierarchical groups</strong> with parent-child relationships</li>
            <li>Assign <strong>group-level variables</strong> that are inherited by member devices</li>
            <li>Control variable <strong>precedence</strong> across the hierarchy</li>
          </ul>
          <h4>Variables</h4>
          <ul>
            <li>Manage device-level variables in a <strong>spreadsheet-like</strong> interface</li>
            <li><strong>Bulk operations</strong> let you set all devices to the same value at once</li>
          </ul>
          <h4>Inspector</h4>
          <ul>
            <li>Select any device to see all <strong>resolved variables</strong> and their sources (global, group, host)</li>
            <li>Understand how variable <strong>precedence and inheritance</strong> works for each device</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Vendors & Models',
    icon: 'business',
    page: 'vendors-models',
    content: (
      <>
        <p>
          The Vendors & Models page manages equipment manufacturers, DHCP options,
          and device model chassis layouts.
        </p>
        <div className="help-tour-tips">
          <h4>Vendors</h4>
          <ul>
            <li><strong>MAC prefixes (OUI)</strong> are matched against discovered devices to auto-detect vendor</li>
            <li>Each vendor has <strong>SSH credentials</strong>, connection settings, and a default template</li>
            <li>Vendor-specific <strong>commands</strong> customize how configs are pushed (e.g., Cisco IOS vs Arista EOS)</li>
          </ul>
          <h4>DHCP Options</h4>
          <ul>
            <li>Configure <strong>dnsmasq DHCP server</strong> options sent to devices during provisioning</li>
            <li>Supports variables like <code>{'${tftp_server_ip}'}</code> that resolve at config generation time</li>
            <li>Quick-add buttons for <strong>common options</strong> (boot server, boot file, NTP, etc.)</li>
          </ul>
          <h4>Device Models</h4>
          <ul>
            <li>Define <strong>chassis port layouts</strong> with rows, sections, and individual ports</li>
            <li>Specify <strong>connector type</strong> (RJ45, SFP+, QSFP28, etc.) and <strong>speed</strong> per port</li>
            <li>Live <strong>visual chassis preview</strong> updates as you build the layout</li>
            <li><strong>Bulk add</strong> ports with auto-incrementing names and column numbers</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Topologies',
    icon: 'hub',
    page: 'topologies',
    content: (
      <>
        <p>
          Build and manage CLOS fabric network topologies with spine, leaf,
          and superspine roles.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li>Create topologies with <strong>named roles</strong> (spine, leaf, border-leaf, etc.) and define the number of nodes per role</li>
            <li><strong>Connect devices</strong> to topology roles — assign real devices from your inventory to each position</li>
            <li>View a <strong>visual topology diagram</strong> showing the fabric layout in the expanded row</li>
            <li><strong>Deploy configurations</strong> to all devices in a topology at once</li>
            <li>Send <strong>commands</strong> to topology members (show interfaces, show BGP, etc.)</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'IPAM',
    icon: 'lan',
    page: 'ipam',
    content: (
      <>
        <p>
          IP Address Management provides hierarchical organization of your network's
          IP space with prefixes, addresses, VRFs, and roles.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li><strong>Org Hierarchy</strong> — organize by Region, Location, and Datacenter</li>
            <li><strong>Prefixes</strong> — manage network prefixes with CIDR notation, nesting, and supernet relationships</li>
            <li><strong>IP Addresses</strong> — track individual IPs with assignment status and DNS names</li>
            <li><strong>VRFs</strong> — Virtual Routing and Forwarding instances for network segmentation</li>
            <li><strong>Roles</strong> — classify resources (e.g., production, management, loopback)</li>
            <li><strong>Tags</strong> — attach arbitrary key-value metadata for filtering and organization</li>
            <li>Use left-side tabs to navigate between IPAM sections</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Actions',
    icon: 'terminal',
    page: 'jobs',
    content: (
      <>
        <p>
          Actions let you define and execute vendor-specific SSH commands
          on your devices as quick one-click operations.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li>Define <strong>reusable commands</strong> per vendor (e.g., "show version", "show ip bgp summary")</li>
            <li>Organize commands with <strong>sort order</strong> and descriptions</li>
            <li>Filter commands by <strong>vendor</strong></li>
            <li>Execute commands on devices directly from the device table actions</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Jobs',
    icon: 'schedule',
    page: 'jobs',
    content: (
      <>
        <p>
          The Jobs page shows a history of all background operations — config deployments,
          backups, discovery scans, and more.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li>View jobs with <strong>status indicators</strong> — completed, failed, running, queued</li>
            <li>Click a job to <strong>expand</strong> and see detailed logs and output</li>
            <li><strong>Duration</strong> tracking shows how long each job took</li>
            <li>Jobs update in <strong>real-time</strong> via WebSocket</li>
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
            <li><Icon name="settings" size={16} /> <strong>Settings</strong> — configure server URL, SSH credentials, branding, layout, and other preferences</li>
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
            <li>Some pages (like Device Models) automatically use a wider layout for complex content</li>
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
          <h4>Branding</h4>
          <ul>
            <li>Upload a custom <strong>logo</strong> and set a custom <strong>app name</strong> in Settings</li>
            <li>The logo and title update on the browser tab, header, and login page</li>
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
