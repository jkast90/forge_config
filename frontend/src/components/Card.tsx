import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  /** Rendered inline immediately after the title */
  titleAction?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, titleAction, headerAction, children, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {(title || titleAction || headerAction) && (
        <div className="card-header">
          <div className="card-header-title">
            {title && <h2>{title}</h2>}
            {titleAction}
          </div>
          {headerAction && <div className="card-header-action">{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
