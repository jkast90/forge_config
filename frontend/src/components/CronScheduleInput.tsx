interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

function parseCron(cron: string): CronParts {
  const parts = cron.trim().split(/\s+/);
  return {
    minute: parts[0] || '*',
    hour: parts[1] || '*',
    dayOfMonth: parts[2] || '*',
    month: parts[3] || '*',
    dayOfWeek: parts[4] || '*',
  };
}

function buildCron(parts: CronParts): string {
  return `${parts.minute} ${parts.hour} ${parts.dayOfMonth} ${parts.month} ${parts.dayOfWeek}`;
}

function describeCron(value: string, parts: CronParts): string {
  if (!value) {
    return 'No schedule (manual only)';
  }
  const { minute, hour, dayOfMonth, month, dayOfWeek } = parts;
  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every minute';
  }

  const segments: string[] = [];

  if (minute.startsWith('*/')) {
    segments.push(`Every ${minute.slice(2)} minute(s)`);
  } else if (hour.startsWith('*/')) {
    segments.push(`Every ${hour.slice(2)} hour(s)`);
    if (minute !== '*') segments.push(`at minute ${minute}`);
  } else {
    if (hour !== '*' && minute !== '*') segments.push(`At ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
    else if (hour !== '*') segments.push(`At hour ${hour}`);
    else if (minute !== '*') segments.push(`At minute ${minute}`);
  }

  if (dayOfWeek !== '*') {
    const dayNames: Record<string, string> = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun' };
    const days = dayOfWeek.split(',').map((d) => dayNames[d] || d).join(', ');
    segments.push(`on ${days}`);
  }
  if (dayOfMonth !== '*') segments.push(`on day ${dayOfMonth}`);
  if (month !== '*') segments.push(`in month ${month}`);

  return segments.join(' ') || 'Custom schedule';
}

interface CronScheduleInputProps {
  value: string;
  onChange: (cron: string) => void;
}

export function CronScheduleInput({ value, onChange }: CronScheduleInputProps) {
  const hasSchedule = !!value;
  const parts = parseCron(value || '* * * * *');

  const updatePart = (key: keyof CronParts, val: string) => {
    const cleaned = val.trim() || '*';
    const next = { ...parts, [key]: cleaned };
    onChange(buildCron(next));
  };

  const fields: { key: keyof CronParts; label: string; placeholder: string }[] = [
    { key: 'minute', label: 'Minute', placeholder: '* or 0,30 or */5' },
    { key: 'hour', label: 'Hour', placeholder: '* or 0 or */6' },
    { key: 'dayOfMonth', label: 'Day', placeholder: '* or 1,15' },
    { key: 'month', label: 'Month', placeholder: '* or 1-6' },
    { key: 'dayOfWeek', label: 'Weekday', placeholder: '* or 1-5' },
  ];

  return (
    <div className="form-group">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <label className="form-label" style={{ margin: 0 }}>Schedule</label>
        {hasSchedule ? (
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => onChange('')}>
            Clear Schedule
          </button>
        ) : (
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => onChange('* * * * *')}>
            Set Schedule
          </button>
        )}
      </div>
      {hasSchedule ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
            {fields.map((f) => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                  {f.label}
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={parts[f.key]}
                  onChange={(e) => updatePart(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  style={{ fontSize: '13px', textAlign: 'center', padding: '4px 6px' }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {describeCron(value, parts)}
            <span style={{ marginLeft: '8px', fontFamily: 'monospace' }}>({value})</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
            <strong>*</strong> = every &nbsp; <strong>*/N</strong> = every N (e.g. */6 = every 6th) &nbsp; <strong>1,3,5</strong> = specific values &nbsp; <strong>1-5</strong> = range
          </div>
        </>
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '8px 0' }}>
          No schedule — template will only run manually.
        </div>
      )}
    </div>
  );
}
