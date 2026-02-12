import { useState } from 'react';
import type { Theme } from '@core';
import { THEME_OPTIONS } from '@core';
import { Icon } from './Icon';
import { Drawer } from './Drawer';

export type { Theme };

interface ThemeSelectorProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export function ThemeSelector({ theme, onThemeChange }: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentTheme = THEME_OPTIONS.find((t) => t.value === theme);

  return (
    <>
      <ThemeSelectorToggle
        currentIcon="palette"
        onClick={() => setIsOpen(true)}
      />

      <Drawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Theme"
      >
        <div className="theme-options">
          {THEME_OPTIONS.map(({ value, icon, label, description }) => (
            <button
              key={value}
              className={`theme-option ${theme === value ? 'active' : ''}`}
              onClick={() => onThemeChange(value)}
            >
              <Icon name={icon} size={24} />
              <div className="theme-option-text">
                <span className="theme-option-label">{label}</span>
                <span className="theme-option-description">{description}</span>
              </div>
              {theme === value && <Icon name="check" size={20} className="theme-option-check" />}
            </button>
          ))}
        </div>
      </Drawer>
    </>
  );
}

interface ThemeSelectorToggleProps {
  currentIcon: string;
  onClick: () => void;
}

export function ThemeSelectorToggle({ currentIcon, onClick }: ThemeSelectorToggleProps) {
  return (
    <button
      className="icon-button"
      onClick={onClick}
      title="Change theme"
    >
      <Icon name={currentIcon} size={20} />
    </button>
  );
}
