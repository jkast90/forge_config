import { useState } from 'react';
import type { Device, DeviceFormData } from '@core';
import { useDevices, useDiscovery, useTestContainers } from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { DeviceList } from './DeviceList';
import { Discovery } from './Discovery';
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { TestContainers } from './TestContainers';
import { RefreshIcon } from './Icon';

interface DevicesPageProps {
  onEdit: (device: Device) => void;
  onDelete: (id: number) => Promise<boolean>;
  onBackup: (id: number) => Promise<boolean>;
  onRefresh: () => void;
  onAddDiscoveredDevice: (device: Partial<DeviceFormData>) => void;
}

type Tab = 'devices' | 'discovery' | 'containers';

export function DevicesPage({ onEdit, onDelete, onBackup, onRefresh, onAddDiscoveredDevice }: DevicesPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('devices');
  const { devices } = useDevices();
  const { discovered } = useDiscovery();
  const { containers } = useTestContainers();

  const tabs: SideTab[] = [
    { id: 'devices', label: 'Devices', icon: 'devices', count: devices.length },
    { id: 'discovery', label: 'Discovery', icon: 'radar', count: discovered.length },
    { id: 'containers', label: 'Test Containers', icon: 'science', count: containers.length },
  ];

  return (
    <Card title="Devices">
      <SideTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
      >
        {activeTab === 'devices' && (
          <>
            <div className="actions-bar">
              <Button onClick={onRefresh}>
                <RefreshIcon size={16} />
                Refresh
              </Button>
            </div>
            <DeviceList
              onEdit={onEdit}
              onDelete={onDelete}
              onBackup={onBackup}
              onRefresh={onRefresh}
            />
          </>
        )}
        {activeTab === 'discovery' && <Discovery onAddDevice={onAddDiscoveredDevice} />}
        {activeTab === 'containers' && <TestContainers />}
      </SideTabs>
    </Card>
  );
}
