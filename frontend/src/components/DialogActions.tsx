import { ReactNode } from 'react';

type DialogActionsAlign = 'left' | 'center' | 'right' | 'space-between';

interface DialogActionsProps {
  children: ReactNode;
  align?: DialogActionsAlign;
  className?: string;
  style?: React.CSSProperties;
}

export function DialogActions({
  children,
  align = 'right',
  className = '',
  style,
}: DialogActionsProps) {
  const alignClass = align !== 'right' ? `dialog-actions-${align}` : '';

  return (
    <div
      className={`dialog-actions ${alignClass} ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}
