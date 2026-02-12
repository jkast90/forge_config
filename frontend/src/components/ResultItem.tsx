import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface ResultItemProps {
  icon: string;
  title: string;
  children: ReactNode;
}

export function ResultItem({ icon, title, children }: ResultItemProps) {
  return (
    <div className="connect-result-item">
      <div className="connect-result-header">
        <Icon name={icon} size={20} />
        <strong>{title}</strong>
      </div>
      <div className="connect-result-body">
        {children}
      </div>
    </div>
  );
}
