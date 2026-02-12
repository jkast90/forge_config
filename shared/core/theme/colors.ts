// Theme color definitions - platform agnostic
// These can be used by both React Web (as CSS custom properties) and React Native (directly)

import type { Theme } from '../types';

export interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  bgHover: string;

  // Accent Colors
  accentBlue: string;
  accentCyan: string;
  accentTeal: string;
  accentPurple: string;

  // Text Colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Border Colors
  border: string;
  borderHover: string;

  // Status Colors
  success: string;
  successBg: string;
  error: string;
  errorBg: string;
  warning: string;
  warningBg: string;

  // Overlay colors
  overlayLight: string;
  overlayDark: string;
}

export const darkTheme: ThemeColors = {
  // Backgrounds
  bgPrimary: '#0a0a0f',
  bgSecondary: '#12121a',
  bgCard: '#1a1a24',
  bgHover: '#22222e',

  // Accent Colors
  accentBlue: '#3b82f6',
  accentCyan: '#22d3ee',
  accentTeal: '#14b8a6',
  accentPurple: '#a855f7',

  // Text Colors
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  // Border Colors
  border: '#2d2d3a',
  borderHover: '#3d3d4a',

  // Status Colors
  success: '#22c55e',
  successBg: 'rgba(34, 197, 94, 0.15)',
  error: '#ef4444',
  errorBg: 'rgba(239, 68, 68, 0.15)',
  warning: '#f59e0b',
  warningBg: 'rgba(245, 158, 11, 0.15)',

  // Overlay colors
  overlayLight: 'rgba(255, 255, 255, 0.2)',
  overlayDark: 'rgba(0, 0, 0, 0.5)',
};

export const lightTheme: ThemeColors = {
  // Backgrounds
  bgPrimary: '#f8fafc',
  bgSecondary: '#ffffff',
  bgCard: '#ffffff',
  bgHover: '#f1f5f9',

  // Accent Colors
  accentBlue: '#2563eb',
  accentCyan: '#0891b2',
  accentTeal: '#0d9488',
  accentPurple: '#9333ea',

  // Text Colors
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',

  // Border Colors
  border: '#e2e8f0',
  borderHover: '#cbd5e1',

  // Status Colors
  success: '#16a34a',
  successBg: 'rgba(22, 163, 74, 0.1)',
  error: '#dc2626',
  errorBg: 'rgba(220, 38, 38, 0.1)',
  warning: '#d97706',
  warningBg: 'rgba(217, 119, 6, 0.1)',

  // Overlay colors
  overlayLight: 'rgba(255, 255, 255, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.3)',
};

export const plainTheme: ThemeColors = {
  // Backgrounds
  bgPrimary: '#ffffff',
  bgSecondary: '#fafafa',
  bgCard: '#ffffff',
  bgHover: '#f5f5f5',

  // Accent Colors (all use same blue for minimal styling)
  accentBlue: '#2563eb',
  accentCyan: '#2563eb',
  accentTeal: '#2563eb',
  accentPurple: '#2563eb',

  // Text Colors
  textPrimary: '#171717',
  textSecondary: '#525252',
  textMuted: '#a3a3a3',

  // Border Colors
  border: '#e5e5e5',
  borderHover: '#d4d4d4',

  // Status Colors
  success: '#16a34a',
  successBg: '#f0fdf4',
  error: '#dc2626',
  errorBg: '#fef2f2',
  warning: '#d97706',
  warningBg: '#fffbeb',

  // Overlay colors
  overlayLight: 'rgba(255, 255, 255, 0.7)',
  overlayDark: 'rgba(0, 0, 0, 0.2)',
};

export const solarizedTheme: ThemeColors = {
  bgPrimary: '#002b36',
  bgSecondary: '#073642',
  bgCard: '#073642',
  bgHover: '#0a4050',

  accentBlue: '#268bd2',
  accentCyan: '#2aa198',
  accentTeal: '#2aa198',
  accentPurple: '#6c71c4',

  textPrimary: '#fdf6e3',
  textSecondary: '#93a1a1',
  textMuted: '#657b83',

  border: '#0a4050',
  borderHover: '#2aa198',

  success: '#859900',
  successBg: 'rgba(133, 153, 0, 0.15)',
  error: '#dc322f',
  errorBg: 'rgba(220, 50, 47, 0.15)',
  warning: '#b58900',
  warningBg: 'rgba(181, 137, 0, 0.15)',

  overlayLight: 'rgba(253, 246, 227, 0.1)',
  overlayDark: 'rgba(0, 43, 54, 0.6)',
};

export const draculaTheme: ThemeColors = {
  bgPrimary: '#282a36',
  bgSecondary: '#21222c',
  bgCard: '#2d2f3d',
  bgHover: '#363848',

  accentBlue: '#8be9fd',
  accentCyan: '#8be9fd',
  accentTeal: '#50fa7b',
  accentPurple: '#bd93f9',

  textPrimary: '#f8f8f2',
  textSecondary: '#bfbfbf',
  textMuted: '#6272a4',

  border: '#44475a',
  borderHover: '#6272a4',

  success: '#50fa7b',
  successBg: 'rgba(80, 250, 123, 0.15)',
  error: '#ff5555',
  errorBg: 'rgba(255, 85, 85, 0.15)',
  warning: '#f1fa8c',
  warningBg: 'rgba(241, 250, 140, 0.15)',

  overlayLight: 'rgba(248, 248, 242, 0.1)',
  overlayDark: 'rgba(40, 42, 54, 0.6)',
};

export const nordTheme: ThemeColors = {
  bgPrimary: '#2e3440',
  bgSecondary: '#3b4252',
  bgCard: '#3b4252',
  bgHover: '#434c5e',

  accentBlue: '#88c0d0',
  accentCyan: '#8fbcbb',
  accentTeal: '#8fbcbb',
  accentPurple: '#b48ead',

  textPrimary: '#eceff4',
  textSecondary: '#d8dee9',
  textMuted: '#7b88a1',

  border: '#434c5e',
  borderHover: '#4c566a',

  success: '#a3be8c',
  successBg: 'rgba(163, 190, 140, 0.15)',
  error: '#bf616a',
  errorBg: 'rgba(191, 97, 106, 0.15)',
  warning: '#ebcb8b',
  warningBg: 'rgba(235, 203, 139, 0.15)',

  overlayLight: 'rgba(236, 239, 244, 0.1)',
  overlayDark: 'rgba(46, 52, 64, 0.6)',
};

export const evergreenDarkTheme: ThemeColors = {
  bgPrimary: '#0d1a0d',
  bgSecondary: '#142214',
  bgCard: '#1a2e1a',
  bgHover: '#243624',

  accentBlue: '#4caf50',
  accentCyan: '#66bb6a',
  accentTeal: '#26a69a',
  accentPurple: '#81c784',

  textPrimary: '#e8f5e9',
  textSecondary: '#a5d6a7',
  textMuted: '#6b9b6e',

  border: '#2d4a2d',
  borderHover: '#3d5a3d',

  success: '#4caf50',
  successBg: 'rgba(76, 175, 80, 0.15)',
  error: '#ef5350',
  errorBg: 'rgba(239, 83, 80, 0.15)',
  warning: '#ffb74d',
  warningBg: 'rgba(255, 183, 77, 0.15)',

  overlayLight: 'rgba(232, 245, 233, 0.1)',
  overlayDark: 'rgba(13, 26, 13, 0.6)',
};

export const evergreenLightTheme: ThemeColors = {
  bgPrimary: '#f1f8e9',
  bgSecondary: '#ffffff',
  bgCard: '#ffffff',
  bgHover: '#e8f5e9',

  accentBlue: '#2e7d32',
  accentCyan: '#388e3c',
  accentTeal: '#00897b',
  accentPurple: '#43a047',

  textPrimary: '#1b5e20',
  textSecondary: '#4a7c4e',
  textMuted: '#81a784',

  border: '#c8e6c9',
  borderHover: '#a5d6a7',

  success: '#2e7d32',
  successBg: 'rgba(46, 125, 50, 0.1)',
  error: '#c62828',
  errorBg: 'rgba(198, 40, 40, 0.1)',
  warning: '#f57f17',
  warningBg: 'rgba(245, 127, 23, 0.1)',

  overlayLight: 'rgba(255, 255, 255, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.2)',
};

export const oceanDarkTheme: ThemeColors = {
  bgPrimary: '#0a1628',
  bgSecondary: '#0f1e36',
  bgCard: '#152642',
  bgHover: '#1c3050',

  accentBlue: '#42a5f5',
  accentCyan: '#26c6da',
  accentTeal: '#29b6f6',
  accentPurple: '#7e57c2',

  textPrimary: '#e3f2fd',
  textSecondary: '#90caf9',
  textMuted: '#5c84a8',

  border: '#1e3a5f',
  borderHover: '#2a4a72',

  success: '#26a69a',
  successBg: 'rgba(38, 166, 154, 0.15)',
  error: '#ef5350',
  errorBg: 'rgba(239, 83, 80, 0.15)',
  warning: '#ffa726',
  warningBg: 'rgba(255, 167, 38, 0.15)',

  overlayLight: 'rgba(227, 242, 253, 0.1)',
  overlayDark: 'rgba(10, 22, 40, 0.6)',
};

export const oceanLightTheme: ThemeColors = {
  bgPrimary: '#e8f4fd',
  bgSecondary: '#ffffff',
  bgCard: '#ffffff',
  bgHover: '#e1f0fa',

  accentBlue: '#1565c0',
  accentCyan: '#0097a7',
  accentTeal: '#0288d1',
  accentPurple: '#5e35b1',

  textPrimary: '#0d47a1',
  textSecondary: '#3a6ea5',
  textMuted: '#7eaac4',

  border: '#bbdefb',
  borderHover: '#90caf9',

  success: '#00897b',
  successBg: 'rgba(0, 137, 123, 0.1)',
  error: '#c62828',
  errorBg: 'rgba(198, 40, 40, 0.1)',
  warning: '#ef6c00',
  warningBg: 'rgba(239, 108, 0, 0.1)',

  overlayLight: 'rgba(255, 255, 255, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.2)',
};

export const nauticalDarkTheme: ThemeColors = {
  bgPrimary: '#0b1622',
  bgSecondary: '#101e2e',
  bgCard: '#162a3e',
  bgHover: '#1d3550',

  accentBlue: '#4a90d9',
  accentCyan: '#45b8ac',
  accentTeal: '#c9a84c',
  accentPurple: '#7b68ae',

  textPrimary: '#e8edf2',
  textSecondary: '#8fa4b8',
  textMuted: '#5a7389',

  border: '#1e3a54',
  borderHover: '#2b4d6a',

  success: '#3daa73',
  successBg: 'rgba(61, 170, 115, 0.15)',
  error: '#d14545',
  errorBg: 'rgba(209, 69, 69, 0.15)',
  warning: '#d4a03c',
  warningBg: 'rgba(212, 160, 60, 0.15)',

  overlayLight: 'rgba(232, 237, 242, 0.1)',
  overlayDark: 'rgba(11, 22, 34, 0.6)',
};

export const nauticalLightTheme: ThemeColors = {
  bgPrimary: '#f0ebe3',
  bgSecondary: '#faf8f5',
  bgCard: '#faf8f5',
  bgHover: '#e8e2d8',

  accentBlue: '#2a6496',
  accentCyan: '#1a8a7e',
  accentTeal: '#8b6f2e',
  accentPurple: '#5c4a8a',

  textPrimary: '#1a2a3a',
  textSecondary: '#4a6275',
  textMuted: '#8a9baa',

  border: '#d4cdc2',
  borderHover: '#b8b0a3',

  success: '#2d8a5e',
  successBg: 'rgba(45, 138, 94, 0.1)',
  error: '#b53030',
  errorBg: 'rgba(181, 48, 48, 0.1)',
  warning: '#b88a2a',
  warningBg: 'rgba(184, 138, 42, 0.1)',

  overlayLight: 'rgba(255, 255, 255, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.2)',
};

export const contrastDarkTheme: ThemeColors = {
  bgPrimary: '#000000',
  bgSecondary: '#0a0a0a',
  bgCard: '#111111',
  bgHover: '#1a1a1a',

  accentBlue: '#5cb8ff',
  accentCyan: '#00e5cc',
  accentTeal: '#00e5cc',
  accentPurple: '#c4a5ff',

  textPrimary: '#ffffff',
  textSecondary: '#d4d4d4',
  textMuted: '#a0a0a0',

  border: '#444444',
  borderHover: '#888888',

  success: '#00e676',
  successBg: 'rgba(0, 230, 118, 0.2)',
  error: '#ff5252',
  errorBg: 'rgba(255, 82, 82, 0.2)',
  warning: '#ffea00',
  warningBg: 'rgba(255, 234, 0, 0.2)',

  overlayLight: 'rgba(255, 255, 255, 0.3)',
  overlayDark: 'rgba(0, 0, 0, 0.7)',
};

export const contrastLightTheme: ThemeColors = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f5f5f5',
  bgCard: '#ffffff',
  bgHover: '#e8e8e8',

  accentBlue: '#0050a0',
  accentCyan: '#006b5e',
  accentTeal: '#006b5e',
  accentPurple: '#5a2d9e',

  textPrimary: '#000000',
  textSecondary: '#2a2a2a',
  textMuted: '#555555',

  border: '#333333',
  borderHover: '#000000',

  success: '#006b2d',
  successBg: 'rgba(0, 107, 45, 0.1)',
  error: '#b30000',
  errorBg: 'rgba(179, 0, 0, 0.1)',
  warning: '#7a5c00',
  warningBg: 'rgba(122, 92, 0, 0.1)',

  overlayLight: 'rgba(255, 255, 255, 0.7)',
  overlayDark: 'rgba(0, 0, 0, 0.4)',
};

export const themes: Record<Theme, ThemeColors> = {
  dark: darkTheme,
  light: lightTheme,
  plain: plainTheme,
  solarized: solarizedTheme,
  dracula: draculaTheme,
  nord: nordTheme,
  'evergreen-dark': evergreenDarkTheme,
  'evergreen-light': evergreenLightTheme,
  'ocean-dark': oceanDarkTheme,
  'ocean-light': oceanLightTheme,
  'nautical-dark': nauticalDarkTheme,
  'nautical-light': nauticalLightTheme,
  'contrast-dark': contrastDarkTheme,
  'contrast-light': contrastLightTheme,
};

export function getThemeColors(theme: Theme): ThemeColors {
  return themes[theme];
}
