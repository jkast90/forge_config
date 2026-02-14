// Validation utilities - platform agnostic

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/** A validator returns an error message string, or null/undefined if valid. */
export type Validator = (value: string) => string | null | undefined;

export function validateMacAddress(mac: string): boolean {
  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return macRegex.test(mac);
}

export function validateIpv4(ip: string): boolean {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

export function validateIpv6(ip: string): boolean {
  // Full, compressed, and mixed (::ffff:1.2.3.4) forms
  const parts = ip.split(':');
  if (parts.length < 2 || parts.length > 8) return false;

  // Check for :: (at most one)
  const doubleColon = ip.indexOf('::');
  if (doubleColon !== -1 && ip.indexOf('::', doubleColon + 1) !== -1) return false;

  // Handle mixed IPv4-mapped (e.g. ::ffff:192.168.1.1)
  const lastPart = parts[parts.length - 1];
  if (lastPart.includes('.')) {
    if (!validateIpv4(lastPart)) return false;
    // Replace the IPv4 part conceptually — the rest must be valid hex groups
    const hexParts = parts.slice(0, -1);
    const filled = doubleColon !== -1
      ? hexParts.length + 2 <= 7 // :: can expand, plus 2 groups for IPv4
      : hexParts.length === 6;
    if (!filled && doubleColon === -1) return false;
    return hexParts.every(p => p === '' || /^[0-9A-Fa-f]{1,4}$/.test(p));
  }

  // Pure IPv6
  if (doubleColon !== -1) {
    // With ::, the total groups (non-empty) must be <= 7
    const nonEmpty = parts.filter(p => p !== '').length;
    if (nonEmpty > 7) return false;
  } else {
    if (parts.length !== 8) return false;
  }

  return parts.every(p => p === '' || /^[0-9A-Fa-f]{1,4}$/.test(p));
}

/** Validates an IP address (IPv4 or IPv6). */
export function validateIpAddress(ip: string): boolean {
  return validateIpv4(ip) || validateIpv6(ip);
}

/** Validates a CIDR prefix (e.g. 10.0.0.0/8 or 2001:db8::/32). */
export function validatePrefix(prefix: string): boolean {
  const slash = prefix.lastIndexOf('/');
  if (slash === -1) return false;

  const addr = prefix.substring(0, slash);
  const lenStr = prefix.substring(slash + 1);
  if (!/^\d{1,3}$/.test(lenStr)) return false;

  const len = parseInt(lenStr, 10);

  if (validateIpv4(addr)) {
    return len >= 0 && len <= 32;
  }
  if (validateIpv6(addr)) {
    return len >= 0 && len <= 128;
  }
  return false;
}

export function validateHostname(hostname: string): boolean {
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
  return hostname.length <= 63 && hostnameRegex.test(hostname);
}

// ---- Pre-built validators for use with ValidatedInput ----

export const validators = {
  mac: ((value: string) =>
    !value || validateMacAddress(value) ? null : 'Invalid MAC (use aa:bb:cc:dd:ee:ff)'
  ) as Validator,

  ip: ((value: string) =>
    !value || validateIpAddress(value) ? null : 'Invalid IP address'
  ) as Validator,

  ipv4: ((value: string) =>
    !value || validateIpv4(value) ? null : 'Invalid IPv4 address'
  ) as Validator,

  ipv6: ((value: string) =>
    !value || validateIpv6(value) ? null : 'Invalid IPv6 address'
  ) as Validator,

  prefix: ((value: string) =>
    !value || validatePrefix(value) ? null : 'Invalid CIDR prefix (e.g. 10.0.0.0/24)'
  ) as Validator,

  hostname: ((value: string) =>
    !value || validateHostname(value) ? null : 'Invalid hostname'
  ) as Validator,
};

export function validateDeviceForm(data: {
  mac: string;
  ip: string;
  hostname: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.mac) {
    errors.mac = 'MAC address is required';
  } else if (!validateMacAddress(data.mac)) {
    errors.mac = 'Invalid MAC address format (use aa:bb:cc:dd:ee:ff)';
  }

  if (!data.ip) {
    errors.ip = 'IP address is required';
  } else if (!validateIpAddress(data.ip)) {
    errors.ip = 'Invalid IP address format';
  }

  if (!data.hostname) {
    errors.hostname = 'Hostname is required';
  } else if (!validateHostname(data.hostname)) {
    errors.hostname = 'Invalid hostname (alphanumeric and hyphens only, max 63 chars)';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateSettingsForm(data: {
  dhcp_range_start: string;
  dhcp_range_end: string;
  dhcp_subnet: string;
  dhcp_gateway: string;
  tftp_server_ip: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!validateIpAddress(data.dhcp_range_start)) {
    errors.dhcp_range_start = 'Invalid IP address';
  }
  if (!validateIpAddress(data.dhcp_range_end)) {
    errors.dhcp_range_end = 'Invalid IP address';
  }
  if (!validateIpAddress(data.dhcp_subnet)) {
    errors.dhcp_subnet = 'Invalid subnet mask';
  }
  if (!validateIpAddress(data.dhcp_gateway)) {
    errors.dhcp_gateway = 'Invalid IP address';
  }
  if (!validateIpAddress(data.tftp_server_ip)) {
    errors.tftp_server_ip = 'Invalid IP address';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
