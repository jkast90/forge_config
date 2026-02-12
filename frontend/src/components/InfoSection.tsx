import { useState, ReactNode } from 'react';
import { IconButton } from './IconButton';
import { Icon } from './Icon';

interface InfoSectionProps {
  children: ReactNode;
}

/**
 * Collapsible info section for cards.
 *
 * Use `InfoSection.Toggle` in a card's `headerAction` to render the info icon button,
 * and `InfoSection` as a child to render the collapsible content.
 *
 * @example
 * const [showInfo, setShowInfo] = useState(false);
 * <Card
 *   title="My Section"
 *   headerAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
 * >
 *   <InfoSection open={showInfo}>
 *     <p>About this section...</p>
 *   </InfoSection>
 *   {/* rest of card content *\/}
 * </Card>
 */
export function InfoSection({ children, open }: InfoSectionProps & { open: boolean }) {
  if (!open) return null;

  return (
    <div className="info-section">
      <Icon name="info" size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-accent-blue)' }} />
      <div className="info-section-content">
        {children}
      </div>
    </div>
  );
}

interface ToggleProps {
  open: boolean;
  onToggle: (open: boolean) => void;
}

InfoSection.Toggle = function InfoSectionToggle({ open, onToggle }: ToggleProps) {
  return (
    <IconButton
      variant="ghost"
      onClick={() => onToggle(!open)}
      title={open ? 'Hide info' : 'Show info'}
    >
      <Icon name="info" size={18} style={{ color: open ? 'var(--color-accent-blue)' : undefined }} />
    </IconButton>
  );
};
