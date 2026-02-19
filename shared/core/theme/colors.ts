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
  // Backgrounds — primary-pitch
  bgPrimary: '#000808',
  bgSecondary: '#000E10',
  bgCard: '#001418',
  bgHover: '#001C20',

  // Accent Colors — primary-cyan
  accentBlue: '#0CE2F2',
  accentCyan: '#0CE2F2',
  accentTeal: '#00A0B0',
  accentPurple: '#0A52F2',

  // Text Colors — primary-white
  textPrimary: '#E6E6E6',
  textSecondary: '#8AACAC',
  textMuted: '#456060',

  // Border Colors
  border: '#002828',
  borderHover: '#003C3C',

  // Status Colors
  success: '#12F25D',
  successBg: 'rgba(18, 242, 93, 0.15)',
  error: '#F25829',
  errorBg: 'rgba(242, 88, 41, 0.15)',
  warning: '#C0F20A',
  warningBg: 'rgba(192, 242, 10, 0.15)',

  // Overlay colors
  overlayLight: 'rgba(230, 230, 230, 0.15)',
  overlayDark: 'rgba(0, 8, 8, 0.6)',
};

export const lightTheme: ThemeColors = {
  // Backgrounds — primary-white
  bgPrimary: '#E6E6E6',
  bgSecondary: '#EEEEEE',
  bgCard: '#F5F5F5',
  bgHover: '#DADADA',

  // Accent Colors — cyan-300
  accentBlue: '#09C4D4',
  accentCyan: '#09C4D4',
  accentTeal: '#005E70',
  accentPurple: '#0A52F2',

  // Text Colors — primary-pitch
  textPrimary: '#000808',
  textSecondary: '#2A3838',
  textMuted: '#6A7878',

  // Border Colors
  border: '#C4CCCC',
  borderHover: '#A8B4B4',

  // Status Colors
  success: '#0A7A30',
  successBg: 'rgba(10, 122, 48, 0.12)',
  error: '#B83010',
  errorBg: 'rgba(184, 48, 16, 0.12)',
  warning: '#8A6800',
  warningBg: 'rgba(138, 104, 0, 0.12)',

  // Overlay colors
  overlayLight: 'rgba(255, 255, 255, 0.5)',
  overlayDark: 'rgba(0, 8, 8, 0.2)',
};

export const plainTheme: ThemeColors = {
  // Backgrounds — gray-300
  bgPrimary: '#B8C4C4',
  bgSecondary: '#C2CCCC',
  bgCard: '#CCCECE',
  bgHover: '#AABCBC',

  // Accent Colors — cyan-600
  accentBlue: '#005E70',
  accentCyan: '#005E70',
  accentTeal: '#003C4A',
  accentPurple: '#0A52F2',

  // Text Colors — primary-pitch
  textPrimary: '#000808',
  textSecondary: '#1E2A2A',
  textMuted: '#4A5C5C',

  // Border Colors
  border: '#9AACAC',
  borderHover: '#7A9090',

  // Status Colors
  success: '#0A7A30',
  successBg: 'rgba(10, 122, 48, 0.15)',
  error: '#B83010',
  errorBg: 'rgba(184, 48, 16, 0.15)',
  warning: '#8A6800',
  warningBg: 'rgba(138, 104, 0, 0.15)',

  // Overlay colors
  overlayLight: 'rgba(255, 255, 255, 0.4)',
  overlayDark: 'rgba(0, 8, 8, 0.25)',
};

export const solarizedTheme: ThemeColors = {
  // Backgrounds — cyan-900
  bgPrimary: '#001820',
  bgSecondary: '#002028',
  bgCard: '#002830',
  bgHover: '#003038',

  // Accent Colors — primary-cyan + cyan-400
  accentBlue: '#0CE2F2',
  accentCyan: '#0CE2F2',
  accentTeal: '#00C4D6',
  accentPurple: '#0CE2F2',

  // Text — cyan-400 for primary, lighter tones for secondary
  textPrimary: '#E6E6E6',
  textSecondary: '#00C4D6',
  textMuted: '#008898',

  border: '#003040',
  borderHover: '#004858',

  success: '#12F25D',
  successBg: 'rgba(18, 242, 93, 0.15)',
  error: '#F25829',
  errorBg: 'rgba(242, 88, 41, 0.15)',
  warning: '#C0F20A',
  warningBg: 'rgba(192, 242, 10, 0.15)',

  overlayLight: 'rgba(12, 226, 242, 0.1)',
  overlayDark: 'rgba(0, 24, 32, 0.6)',
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
