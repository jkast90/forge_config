import { ReactNode, useEffect } from 'react';
import { CloseButton } from './CloseButton';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  side?: 'left' | 'right';
}

export function Drawer({ isOpen, onClose, title, children, wide, side = 'right' }: DrawerProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`drawer-overlay${side === 'left' ? ' drawer-overlay-left' : ''}`} onClick={onClose}>
      <div className={`drawer${wide ? ' drawer-wide' : ''}${side === 'left' ? ' drawer-left' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h3>{title}</h3>
          <CloseButton onClick={onClose} label="Close drawer" className="drawer-close" />
        </div>
        <div className="drawer-content">
          {children}
        </div>
      </div>
    </div>
  );
}
