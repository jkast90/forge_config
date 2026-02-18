import { useVendors, useDeviceModels, usePersistedTab } from '@core';
import { Card } from './Card';
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { VendorManagement } from './VendorManagement';
import { DeviceModelManagement } from './DeviceModelManagement';

type Tab = 'vendors' | 'models';

export function VendorsAndModels() {
  const [activeTab, setActiveTab] = usePersistedTab<Tab>('vendors', ['vendors', 'models'], 'tab_vendors-models');
  const { vendors } = useVendors();
  const { deviceModels } = useDeviceModels();

  const tabs: SideTab[] = [
    { id: 'vendors', label: 'Vendors', icon: 'business', count: vendors.length },
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
        {activeTab === 'models' && <DeviceModelManagement />}
      </SideTabs>
    </Card>
  );
}
