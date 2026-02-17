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
          ForgeConfig is a network device provisioning and infrastructure management tool.
          It automates device discovery, configuration templating, topology building, IPAM, and deployment.
        </p>
        <div className="help-tour-tips">
          <h4>Quick Tips</h4>
          <ul>
            <li>Use the <strong>page selector</strong> in the header to navigate between the 11 sections</li>
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
            <li><strong>Device Status</strong> breaks down online, offline, provisioning, and unknown counts with backup summary</li>
            <li><strong>Recent activity</strong> shows the latest discovery events with vendor identification</li>
            <li><strong>Feature overview</strong> cards link to Configuration and Infrastructure sections with live counts</li>
            <li><strong>Quick actions</strong> bar provides one-click access to common tasks (add device, check discovery, build topology, etc.)</li>
            <li>Data refreshes automatically every 10 seconds</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Devices & Discovery',
    icon: 'devices',
    page: 'resources',
    content: (
      <>
        <p>
          The Devices page combines device management, network discovery, and test containers in a single tabbed view.
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
          <h4>Test Containers</h4>
          <ul>
            <li>Spawn, start, stop, and restart <strong>Docker containers</strong> that simulate network devices for testing</li>
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
          The Configuration page combines templates, roles, groups, variables, the variable inspector,
          and credentials into a single tabbed interface.
        </p>
        <div className="help-tour-tips">
          <h4>Templates</h4>
          <ul>
            <li>Configuration templates use <strong>Tera syntax</strong> (Jinja2-like) — variables like {'{{Hostname}}'} are replaced with device values at deploy time</li>
            <li><strong>Variable chips</strong> insert template syntax at your cursor position</li>
            <li><strong>Preview</strong> renders a template with a real or sample device to verify output</li>
            <li><strong>Templatize Config</strong> takes a raw config and detects variables automatically</li>
          </ul>
          <h4>Roles</h4>
          <ul>
            <li>Define <strong>device roles</strong> (spine, leaf, etc.) with one or more templates per role</li>
            <li>Role templates auto-update on server restart for built-in roles</li>
          </ul>
          <h4>Groups</h4>
          <ul>
            <li>Organize devices into <strong>hierarchical groups</strong> with parent-child relationships</li>
            <li>Assign <strong>group-level variables</strong> that are inherited by member devices</li>
            <li>Control variable <strong>precedence</strong> across the hierarchy</li>
          </ul>
          <h4>Variables & Inspector</h4>
          <ul>
            <li>Manage device-level variables in a <strong>spreadsheet-like</strong> interface with <strong>bulk operations</strong></li>
            <li>The <strong>Inspector</strong> shows all resolved variables for any device with their sources (device, group, "all" group)</li>
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
          Build and manage datacenter network topologies with full IPAM integration, GPU clusters,
          and automated device provisioning.
        </p>
        <div className="help-tour-tips">
          <h4>Architecture</h4>
          <ul>
            <li><strong>CLOS fabric</strong> — spine/leaf with optional super-spine (5-stage) and pod support</li>
            <li><strong>Hierarchical</strong> — core/distribution/access 3-tier architecture</li>
            <li>Configure <strong>management switches</strong> with per-row, per-rack, or per-hall distribution</li>
          </ul>
          <h4>GPU Clusters</h4>
          <ul>
            <li>Attach <strong>GPU compute clusters</strong> to topologies with configurable node count, model, and interconnect</li>
            <li>GPU nodes are <strong>striped across leaf/access racks</strong> with automatic port assignments</li>
            <li>Assign <strong>VRFs</strong> per GPU cluster for network segmentation</li>
          </ul>
          <h4>Topology Builder</h4>
          <ul>
            <li><strong>Preview</strong> the full topology before deploying — device hostnames, IP assignments, rack placement, and cabling</li>
            <li>Select <strong>datacenter, region, halls, rows, and racks</strong> for physical placement</li>
            <li>Hostnames follow the system <strong>hostname pattern</strong> (e.g., <code>$datacenter-$role-#</code>)</li>
          </ul>
          <h4>Management</h4>
          <ul>
            <li>View <strong>visual topology diagrams</strong> and device assignments in the expanded row</li>
            <li>Per-device <strong>config preview, deploy, and diff</strong></li>
            <li>Download <strong>cutsheet</strong> (CSV), <strong>BOM</strong>, <strong>rack sheet</strong> (XLSX), and <strong>SVG export</strong></li>
            <li><strong>Port assignment</strong> management with chassis visualization</li>
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
          IP space with prefixes, addresses, and roles.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li><strong>Prefixes</strong> — manage network prefixes with CIDR notation, nesting, supernet relationships, and next-available allocation</li>
            <li><strong>IP Addresses</strong> — track individual IPs with assignment status, DNS names, and device association</li>
            <li><strong>Roles</strong> — classify resources (e.g., production, management, loopback)</li>
            <li><strong>Tags</strong> — attach arbitrary key-value metadata for filtering and organization</li>
            <li>Prefixes and IPs can be associated with <strong>VRFs</strong> and <strong>datacenters</strong></li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Locations',
    icon: 'account_tree',
    page: 'locations',
    content: (
      <>
        <p>
          The Locations page manages the physical hierarchy of your infrastructure,
          from regions down to individual racks.
        </p>
        <div className="help-tour-tips">
          <h4>Hierarchy</h4>
          <ul>
            <li><strong>Regions</strong> — top-level geographic areas</li>
            <li><strong>Campuses</strong> — physical campus locations within regions</li>
            <li><strong>Datacenters</strong> — datacenter facilities within campuses</li>
            <li><strong>Halls</strong> — datacenter halls or rooms</li>
            <li><strong>Rows</strong> — equipment rows within halls</li>
            <li><strong>Racks</strong> — physical racks with device assignments and rack unit positioning</li>
          </ul>
          <h4>Integration</h4>
          <ul>
            <li>The topology builder auto-creates <strong>halls, rows, and racks</strong> when deploying</li>
            <li>Devices are placed at specific <strong>rack positions</strong> (rack units) within the hierarchy</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Tenants',
    icon: 'group',
    page: 'resources',
    content: (
      <>
        <p>
          The Tenants page manages multi-tenancy, VRFs, and GPU cluster resources.
        </p>
        <div className="help-tour-tips">
          <h4>Tenants</h4>
          <ul>
            <li>Create <strong>tenant organizations</strong> to group network and compute resources</li>
            <li>Track tenant <strong>status</strong> (active/inactive)</li>
          </ul>
          <h4>VRFs</h4>
          <ul>
            <li>Manage <strong>Virtual Routing and Forwarding</strong> instances for network segmentation</li>
            <li>Associate VRFs with <strong>tenants</strong> and <strong>GPU clusters</strong></li>
            <li>VRFs are used in topology builds for per-cluster network isolation</li>
          </ul>
          <h4>GPU Clusters</h4>
          <ul>
            <li>View and manage <strong>GPU compute clusters</strong> created by topology builds</li>
            <li>Track cluster <strong>model, node count, interconnect type</strong>, and provisioning status</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'Jobs & Actions',
    icon: 'schedule',
    page: 'jobs',
    content: (
      <>
        <p>
          The Jobs page combines vendor actions, job history, job templates, credentials,
          and output parsers in a single tabbed interface.
        </p>
        <div className="help-tour-tips">
          <h4>Actions</h4>
          <ul>
            <li>Define <strong>reusable commands</strong> per vendor (e.g., "show version", "show ip bgp summary")</li>
            <li>Execute commands on devices directly from the device table or topology view</li>
            <li>Supports <strong>SSH commands</strong>, <strong>webhooks</strong>, and <strong>API integrations</strong> with variable substitution</li>
          </ul>
          <h4>Job History</h4>
          <ul>
            <li>View jobs with <strong>status indicators</strong> — completed, failed, running, queued</li>
            <li>Click a job to <strong>expand</strong> and see detailed logs, output, and duration</li>
            <li>Jobs update in <strong>real-time</strong> via WebSocket</li>
          </ul>
          <h4>Templates & Parsers</h4>
          <ul>
            <li><strong>Job templates</strong> define reusable job definitions with device/group targeting and cron scheduling</li>
            <li><strong>Output parsers</strong> extract structured data from command output using regex capture groups</li>
          </ul>
        </div>
      </>
    ),
  },
  {
    title: 'System',
    icon: 'settings',
    page: 'system',
    content: (
      <>
        <p>
          The System page manages users, branding, and device naming configuration.
        </p>
        <div className="help-tour-tips">
          <h4>Features</h4>
          <ul>
            <li><strong>Users</strong> — create, edit, enable/disable, and delete user accounts</li>
            <li><strong>Branding</strong> — upload a custom logo and set an application name (shown on the header, login page, and browser tab)</li>
            <li><strong>Device Naming</strong> — configure the hostname auto-generation pattern using <code>$datacenter</code>, <code>$region</code>, <code>$hall</code>, <code>$role</code>, and <code>#</code> (auto-incrementing number)</li>
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
          <h4>Left Side</h4>
          <ul>
            <li><Icon name="qr_code_2" size={16} /> <strong>QR / Barcode Generator</strong> — generate QR codes and barcodes for device serial numbers or URLs</li>
            <li><Icon name="history" size={16} /> <strong>API History</strong> — browse all API calls made by the app, with request/response details</li>
            <li><Icon name="insights" size={16} /> <strong>Telemetry</strong> — view application event tracking and performance metrics</li>
          </ul>
          <h4>Right Side</h4>
          <ul>
            <li><Icon name="settings" size={16} /> <strong>Settings</strong> — configure SSH credentials, DHCP, layout, and other preferences</li>
            <li><Icon name="palette" size={16} /> <strong>Theme</strong> — choose from 14 themes (dark, light, solarized, dracula, nord, and more)</li>
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
          <h4>Header Controls</h4>
          <ul>
            <li>Click the <strong>bell icon</strong> to view notification history with action links</li>
            <li>Click the <strong>sticky note icon</strong> to open the scratch pad for quick notes (persists across sessions)</li>
            <li>The <strong>page selector</strong> is searchable — type to filter pages</li>
          </ul>
          <h4>Layout Settings</h4>
          <ul>
            <li>Open <strong>Settings</strong> to adjust <strong>page width</strong> (narrow, default, wide, full) and <strong>dialog size</strong></li>
            <li>Some pages (like Device Models) automatically use a wider layout for complex content</li>
            <li>Layout preferences persist across sessions</li>
          </ul>
          <h4>Branding</h4>
          <ul>
            <li>Upload a custom <strong>logo</strong> and set a custom <strong>app name</strong> in System &gt; Branding</li>
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
