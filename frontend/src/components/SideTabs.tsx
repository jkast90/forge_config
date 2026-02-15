import { ReactNode } from 'react';
import { Icon } from './Icon';

export interface SideTab {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}

interface Props {
  tabs: SideTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode;
}

export function SideTabs({ tabs, activeTab, onTabChange, children }: Props) {
  return (
    <div className="side-tabs">
      <nav className="side-tabs-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`side-tabs-item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon && <Icon name={tab.icon} size={16} />}
            <span className="side-tabs-label">{tab.label}</span>
            {tab.count != null && <span className="side-tabs-count">{tab.count}</span>}
          </button>
        ))}
      </nav>
      <div className="side-tabs-content">
        {children}
      </div>
    </div>
  );
}
