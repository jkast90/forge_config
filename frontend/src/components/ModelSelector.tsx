import { useMemo } from 'react';
import type { DeviceModel } from '@core';
import { useDeviceModels, GPU_MODEL_OPTIONS } from '@core';
import { SelectField } from './SelectField';

interface ModelSelectorProps {
  label?: string;
  name: string;
  value: string;
  onChange: (e: { target: { name: string; value: string } }) => void;
  /** Show GPU model options instead of device models */
  variant?: 'device' | 'gpu';
  /** Filter device models by vendor ID */
  vendorId?: number;
  /** Filter device models by minimum rack units */
  minRackUnits?: number;
  /** Filter device models by maximum rack units */
  maxRackUnits?: number;
  /** Custom filter function for device models */
  filter?: (model: DeviceModel) => boolean;
  /** Placeholder shown when nothing is selected */
  placeholder?: string;
  disabled?: boolean;
}

export function ModelSelector({
  label, name, value, onChange, variant = 'device',
  vendorId, minRackUnits, maxRackUnits, filter,
  placeholder, disabled,
}: ModelSelectorProps) {
  const { deviceModels } = useDeviceModels();

  const options = useMemo(() => {
    const none = { value: '', label: placeholder || 'None' };
    if (variant === 'gpu') {
      return [none, ...GPU_MODEL_OPTIONS];
    }
    let models = deviceModels;
    if (vendorId != null) {
      models = models.filter(m => m.vendor_id === vendorId);
    }
    if (minRackUnits != null) {
      models = models.filter(m => m.rack_units >= minRackUnits);
    }
    if (maxRackUnits != null) {
      models = models.filter(m => m.rack_units <= maxRackUnits);
    }
    if (filter) {
      models = models.filter(filter);
    }
    return [
      none,
      ...models.map(m => ({ value: m.model, label: m.display_name || m.model })),
    ];
  }, [deviceModels, variant, vendorId, minRackUnits, maxRackUnits, filter, placeholder]);

  return (
    <SelectField
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
    />
  );
}
