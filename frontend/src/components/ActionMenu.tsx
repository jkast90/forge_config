import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './IconButton';
import { Tooltip } from './Tooltip';

export interface ActionMenuItem {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'secondary' | 'danger';
}

interface ActionMenuProps {
  icon: ReactNode;
  items: ActionMenuItem[];
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  tooltip?: string;
  disabled?: boolean;
}

export function ActionMenu({ icon, items, variant = 'secondary', tooltip, disabled }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.right,
    });
  }, []);

  useEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleItemClick = (item: ActionMenuItem) => {
    if (item.disabled) return;
    setIsOpen(false);
    item.onClick();
  };

  const menu = isOpen && menuPos && createPortal(
    <div
      className="action-menu-dropdown"
      ref={menuRef}
      style={{
        position: 'fixed',
        top: menuPos.top,
        right: window.innerWidth - menuPos.left,
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`action-menu-item${item.disabled ? ' disabled' : ''}${item.variant === 'danger' ? ' danger' : ''}`}
          onClick={() => handleItemClick(item)}
          disabled={item.disabled}
          type="button"
        >
          {item.icon && <span className="action-menu-item-icon">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body
  );

  const button = (
    <IconButton
      ref={triggerRef}
      variant={variant}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) setIsOpen(!isOpen);
      }}
      disabled={disabled}
    >
      {icon}
    </IconButton>
  );

  return (
    <>
      {tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button}
      {menu}
    </>
  );
}
