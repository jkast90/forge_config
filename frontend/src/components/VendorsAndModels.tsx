import { useState } from 'react';
import { useVendors, useDhcpOptions, useDeviceModels } from '@core';
import { Card } from './Card';
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { VendorManagement } from './VendorManagement';
import { DhcpOptions } from './DhcpOptions';
import { DeviceModelManagement } from './DeviceModelManagement';

type Tab = 'vendors' | 'dhcp' | 'models';

export function VendorsAndModels() {
  const [activeTab, setActiveTab] = useState<Tab>('vendors');
  const { vendors } = useVendors();
  const { options } = useDhcpOptions();
  const { deviceModels } = useDeviceModels();

  const tabs: SideTab[] = [
    { id: 'vendors', label: 'Vendors', icon: 'business', count: vendors.length },
    { id: 'dhcp', label: 'DHCP Options', icon: 'settings_ethernet', count: options.length },
    { id: 'models', label: 'Device Models', icon: 'memory', count: deviceModels.length },
  ];

  return (
    <Card title="Vendors & Models">
      <SideTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
      >
        {activeTab === 'vendors' && <VendorManagement />}
        {activeTab === 'dhcp' && <DhcpOptions />}
        {activeTab === 'models' && <DeviceModelManagement />}
      </SideTabs>
    </Card>
  );
}
