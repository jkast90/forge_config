import { ButtonHTMLAttributes, ReactNode } from 'react';

type IconButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: ReactNode;
  isLoading?: boolean;
}

export function IconButton({
  variant = 'secondary',
  size = 'sm',
  children,
  isLoading = false,
  disabled,
  className = '',
  ...props
}: IconButtonProps) {
  const classes = [
    'icon-btn',
    `icon-btn-${variant}`,
    size !== 'sm' ? `icon-btn-${size}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <span className="btn-spinner" /> : children}
    </button>
  );
}
