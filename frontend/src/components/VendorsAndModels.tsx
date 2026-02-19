import { useState, useCallback } from 'react';
import { useVendors, useDeviceModels, useDhcpOptions, usePersistedTab } from '@core';
import { Card } from './Card';
import { RefreshButton } from './Button';
import { InfoSection } from './InfoSection';
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { VendorManagement } from './VendorManagement';
import { DeviceModelManagement } from './DeviceModelManagement';
import { DhcpOptions } from './DhcpOptions';

type Tab = 'vendors' | 'models' | 'dhcp';

export function VendorsAndModels() {
  const [activeTab, setActiveTab] = usePersistedTab<Tab>('vendors', ['vendors', 'models', 'dhcp'], 'tab_vendors-models');
  const [showInfo, setShowInfo] = useState(false);
  const { vendors, refresh: refreshVendors } = useVendors();
  const { deviceModels, refresh: refreshModels } = useDeviceModels();
  const { options, refresh: refreshDhcp } = useDhcpOptions();

  const tabs: SideTab[] = [
    { id: 'vendors', label: 'Vendors', icon: 'business', count: vendors.length },
    { id: 'models', label: 'Device Models', icon: 'memory', count: deviceModels.length },
    { id: 'dhcp', label: 'DHCP Options', icon: 'lan', count: options.length },
  ];

  const handleRefresh = useCallback(() => {
    refreshVendors();
    refreshModels();
    refreshDhcp();
  }, [refreshVendors, refreshModels, refreshDhcp]);

  return (
    <Card
      title="Vendors & Models"
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
      headerAction={<RefreshButton onClick={handleRefresh} />}
    >
      <InfoSection open={showInfo}>
        <p>Manage the vendors, device models, and DHCP options used across your network infrastructure.</p>
        <ul>
          <li><strong>Vendors</strong> — network equipment manufacturers with SSH and backup settings</li>
          <li><strong>Device Models</strong> — physical port layouts organized by vendor</li>
          <li><strong>DHCP Options</strong> — vendor-class DHCP options for ZTP provisioning</li>
        </ul>
      </InfoSection>
      <SideTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
      >
        {activeTab === 'vendors' && <VendorManagement />}
        {activeTab === 'models' && <DeviceModelManagement />}
        {activeTab === 'dhcp' && <DhcpOptions />}
      </SideTabs>
    </Card>
  );
}
