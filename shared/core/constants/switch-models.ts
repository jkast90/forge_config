import type { ChassisLayout } from '../types';

// ---------------------------------------------------------------------------
// Arista 7050CX3-32S
// 32x QSFP28 100G + 2x SFP+ 10G + 1x RJ45 Management
// Top row: odd-numbered QSFP ports (1,3,5…31)
// Bottom row: even-numbered QSFP ports (2,4,6…32) + 2 SFP+ + Management
// ---------------------------------------------------------------------------
const ARISTA_7050CX3_32S: ChassisLayout = {
  vendor_id: 'arista',
  model: '7050CX3-32S',
  display_name: 'Arista 7050CX3-32S',
  rack_units: 1,
  rows: [
    {
      row: 1,
      sections: [
        {
          label: 'QSFP28 100G',
          ports: Array.from({ length: 16 }, (_, i) => ({
            col: i + 1,
            vendor_port_name: `Ethernet${i * 2 + 1}`,
            connector: 'qsfp28' as const,
            speed: 100000 as const,
          })),
        },
      ],
    },
    {
      row: 2,
      sections: [
        {
          label: 'QSFP28 100G',
          ports: Array.from({ length: 16 }, (_, i) => ({
            col: i + 1,
            vendor_port_name: `Ethernet${i * 2 + 2}`,
            connector: 'qsfp28' as const,
            speed: 100000 as const,
          })),
        },
        {
          label: 'SFP+ 10G',
          ports: [
            { col: 18, vendor_port_name: 'Ethernet33', connector: 'sfp+' as const, speed: 10000 as const },
            { col: 19, vendor_port_name: 'Ethernet34', connector: 'sfp+' as const, speed: 10000 as const },
          ],
        },
        {
          label: 'Management',
          ports: [
            { col: 21, vendor_port_name: 'Management1', connector: 'rj45' as const, speed: 1000 as const, role: 'mgmt' as const },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Arista 7050SX3-48YC8
// 48x SFP28 25G + 8x QSFP28 100G + 1x RJ45 Management
// Top row: odd SFP28 (1,3…47) + odd QSFP28 (49,51,53,55)
// Bottom row: even SFP28 (2,4…48) + even QSFP28 (50,52,54,56) + Management
// ---------------------------------------------------------------------------
const ARISTA_7050SX3_48YC8: ChassisLayout = {
  vendor_id: 'arista',
  model: '7050SX3-48YC8',
  display_name: 'Arista 7050SX3-48YC8',
  rack_units: 1,
  rows: [
    {
      row: 1,
      sections: [
        {
          label: 'SFP28 25G',
          ports: Array.from({ length: 24 }, (_, i) => ({
            col: i + 1,
            vendor_port_name: `Ethernet${i * 2 + 1}`,
            connector: 'sfp28' as const,
            speed: 25000 as const,
          })),
        },
        {
          label: 'QSFP28 100G',
          ports: Array.from({ length: 4 }, (_, i) => ({
            col: 26 + i,
            vendor_port_name: `Ethernet${49 + i * 2}`,
            connector: 'qsfp28' as const,
            speed: 100000 as const,
          })),
        },
      ],
    },
    {
      row: 2,
      sections: [
        {
          label: 'SFP28 25G',
          ports: Array.from({ length: 24 }, (_, i) => ({
            col: i + 1,
            vendor_port_name: `Ethernet${i * 2 + 2}`,
            connector: 'sfp28' as const,
            speed: 25000 as const,
          })),
        },
        {
          label: 'QSFP28 100G',
          ports: Array.from({ length: 4 }, (_, i) => ({
            col: 26 + i,
            vendor_port_name: `Ethernet${50 + i * 2}`,
            connector: 'qsfp28' as const,
            speed: 100000 as const,
          })),
        },
        {
          label: 'Management',
          ports: [
            { col: 31, vendor_port_name: 'Management1', connector: 'rj45' as const, speed: 1000 as const, role: 'mgmt' as const },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Arista 7280SR3-48YC8
// Same front-panel layout as 7050SX3-48YC8 (different platform/ASIC)
// 48x SFP28 25G + 8x QSFP28 100G + 1x RJ45 Management
// ---------------------------------------------------------------------------
const ARISTA_7280SR3_48YC8: ChassisLayout = {
  ...ARISTA_7050SX3_48YC8,
  model: '7280SR3-48YC8',
  display_name: 'Arista 7280SR3-48YC8',
};

// ---------------------------------------------------------------------------
// Arista 7020TR-48
// 48x RJ45 1G + 6x SFP+ 10G + 1x RJ45 Management
// Top row: odd RJ45 (1,3…47) + odd SFP+ (49,51,53)
// Bottom row: even RJ45 (2,4…48) + even SFP+ (50,52,54) + Management
// ---------------------------------------------------------------------------
const ARISTA_7020TR_48: ChassisLayout = {
  vendor_id: 'arista',
  model: '7020TR-48',
  display_name: 'Arista 7020TR-48',
  rack_units: 1,
  rows: [
    {
      row: 1,
      sections: [
        {
          label: 'RJ45 1G',
          ports: Array.from({ length: 24 }, (_, i) => ({
            col: i + 1,
            vendor_port_name: `Ethernet${i * 2 + 1}`,
            connector: 'rj45' as const,
            speed: 1000 as const,
          })),
        },
        {
          label: 'SFP+ 10G',
          ports: Array.from({ length: 3 }, (_, i) => ({
            col: 26 + i,
            vendor_port_name: `Ethernet${49 + i * 2}`,
            connector: 'sfp+' as const,
            speed: 10000 as const,
          })),
        },
      ],
    },
    {
      row: 2,
      sections: [
        {
          label: 'RJ45 1G',
          ports: Array.from({ length: 24 }, (_, i) => ({
            col: i + 1,
            vendor_port_name: `Ethernet${i * 2 + 2}`,
            connector: 'rj45' as const,
            speed: 1000 as const,
          })),
        },
        {
          label: 'SFP+ 10G',
          ports: Array.from({ length: 3 }, (_, i) => ({
            col: 26 + i,
            vendor_port_name: `Ethernet${50 + i * 2}`,
            connector: 'sfp+' as const,
            speed: 10000 as const,
          })),
        },
        {
          label: 'Management',
          ports: [
            { col: 30, vendor_port_name: 'Management1', connector: 'rj45' as const, speed: 1000 as const, role: 'mgmt' as const },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry & lookup helpers
// ---------------------------------------------------------------------------

export const SWITCH_MODELS: Record<string, ChassisLayout> = {
  'arista:7050CX3-32S': ARISTA_7050CX3_32S,
  'arista:7050SX3-48YC8': ARISTA_7050SX3_48YC8,
  'arista:7280SR3-48YC8': ARISTA_7280SR3_48YC8,
  'arista:7020TR-48': ARISTA_7020TR_48,
};

export function getChassisLayout(vendorId: string, model: string): ChassisLayout | undefined {
  return SWITCH_MODELS[`${vendorId}:${model}`];
}

export function getVendorModels(vendorId: string): ChassisLayout[] {
  return Object.values(SWITCH_MODELS).filter(l => l.vendor_id === vendorId);
}

export function getAllChassisLayouts(): ChassisLayout[] {
  return Object.values(SWITCH_MODELS);
}
