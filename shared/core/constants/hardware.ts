// Hardware constants for port/connector visualization

/**
 * Connector type widths (px) for chassis port visualization
 */
export const CONNECTOR_WIDTHS: Record<string, number> = {
  rj45: 24,
  sfp: 28,
  'sfp+': 28,
  sfp28: 28,
  'qsfp+': 40,
  qsfp28: 40,
  'qsfp-dd': 48,
};

/**
 * Port speed to semantic color name mapping.
 * Values are semantic tokens - each platform resolves to actual colors.
 */
export const SPEED_COLOR_NAMES: Record<number, string> = {
  1000: 'success',
  2500: 'successLight',
  10000: 'accentBlue',
  25000: 'accentTeal',
  40000: 'warning',
  50000: 'warningDark',
  100000: 'warningDark',
  400000: 'accentPurple',
};

/**
 * Get the width in px for a given connector type.
 * Falls back to 28px for unknown connector types.
 */
export function getConnectorWidth(connector: string): number {
  return CONNECTOR_WIDTHS[connector] || 28;
}

/**
 * Get the semantic color name for a port speed.
 * Falls back to 'textMuted' for unknown speeds.
 */
export function getSpeedColorName(speed: number): string {
  return SPEED_COLOR_NAMES[speed] || 'textMuted';
}
