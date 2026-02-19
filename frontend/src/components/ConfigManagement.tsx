import { useState, useCallback } from 'react';
import { useTemplates, useGroups, useDeviceVariables, useCredentials, useDeviceRoles, usePersistedTab } from '@core';
import { Card } from './Card';
import { RefreshButton } from './Button';
import { InfoSection } from './InfoSection';
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { TemplateBuilder } from './TemplateBuilder';
import { GroupManagement } from './GroupManagement';
import { VariableManager } from './VariableManager';
import { ResolvedVariablesInspector } from './ResolvedVariablesInspector';
import { CredentialsPanel } from './CredentialsPanel';
import { DeviceRolesPanel } from './DeviceRolesPanel';

type Tab = 'templates' | 'roles' | 'groups' | 'variables' | 'inspector' | 'credentials';

export function ConfigManagement() {
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = usePersistedTab<Tab>('templates', ['templates', 'roles', 'groups', 'variables', 'inspector', 'credentials'], 'tab_config');
  const { templates } = useTemplates();
  const { groups, refresh: refreshGroups } = useGroups();
  const { keys: variableKeys, refresh: refreshVariables } = useDeviceVariables();
  const { credentials, loading: credentialsLoading, refresh: refreshCredentials, createCredential, updateCredential, deleteCredential } = useCredentials();
  const { deviceRoles, loading: rolesLoading, refresh: refreshRoles, createDeviceRole, updateDeviceRole, deleteDeviceRole } = useDeviceRoles();

  const handleRefresh = useCallback(() => {
    refreshGroups();
    refreshVariables();
    refreshCredentials();
    refreshRoles();
  }, [refreshGroups, refreshVariables, refreshCredentials, refreshRoles]);

  const tabs: SideTab[] = [
    { id: 'templates', label: 'Templates', icon: 'description', count: templates.length },
    { id: 'roles', label: 'Roles', icon: 'badge', count: deviceRoles.length },
    { id: 'groups', label: 'Groups', icon: 'account_tree', count: groups.length },
    { id: 'variables', label: 'Variables', icon: 'tune', count: variableKeys.length },
    { id: 'inspector', label: 'Inspector', icon: 'search' },
    { id: 'credentials', label: 'Credentials', icon: 'key', count: credentials.length },
  ];

  return (
    <Card title="Configuration" titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />} headerAction={<RefreshButton onClick={handleRefresh} />}>
      <InfoSection open={showInfo}>
        <div>
          <p>
            Central configuration management for templates, device roles, groups, variables, and credentials.
            Each tab manages a different aspect of device provisioning and automation.
          </p>
          <ul>
            <li>Templates define configuration files rendered per device</li>
            <li>Roles assign one or more templates to devices based on their network function</li>
            <li>Groups organize devices for bulk operations and targeting</li>
            <li>Variables provide per-device values substituted into templates</li>
            <li>Inspector previews fully resolved variables for any device</li>
            <li>Credentials store SSH and API key authentication details</li>
          </ul>
        </div>
      </InfoSection>
      <SideTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
      >
        {activeTab === 'templates' && <TemplateBuilder />}
        {activeTab === 'roles' && (
          <DeviceRolesPanel
            deviceRoles={deviceRoles}
            templates={templates}
            groups={groups}
            loading={rolesLoading}
            onCreate={createDeviceRole}
            onUpdate={updateDeviceRole}
            onDelete={deleteDeviceRole}
          />
        )}
        {activeTab === 'groups' && <GroupManagement />}
        {activeTab === 'variables' && <VariableManager />}
        {activeTab === 'inspector' && <ResolvedVariablesInspector />}
        {activeTab === 'credentials' && (
          <CredentialsPanel
            credentials={credentials}
            loading={credentialsLoading}
            onCreate={createCredential}
            onUpdate={updateCredential}
            onDelete={deleteCredential}
          />
        )}
      </SideTabs>
    </Card>
  );
}
