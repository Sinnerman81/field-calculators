import { formatDuration } from './format.js';

export const meta = {
  id: 'battery-runtime',
  name: 'Battery Runtime',
  category: 'Electrical',
  icon: 'battery',
  description: 'Estimate runtime from battery capacity, depth of discharge and load.',
  keywords: ['battery', 'ah', 'runtime', 'inverter', 'ups', 'solar', 'lithium', 'lead acid'],
  hint: 'Runtime is an estimate at a constant load. Inverter idle draw and ageing are not included.',
};

export const fields = [
  {
    id: 'capacity',
    label: 'Battery capacity',
    unit: 'Ah',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '100',
  },
  {
    id: 'voltage',
    label: 'Nominal voltage',
    unit: 'V',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '12',
  },
  {
    id: 'depth',
    label: 'Depth of discharge',
    unit: '%',
    type: 'number',
    min: 0,
    max: 100,
    step: 'any',
    default: '80',
    hint: 'Usable share of capacity. Lead-acid is often limited to 50%.',
  },
  {
    id: 'load',
    label: 'Load power',
    unit: 'W',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '500',
  },
  {
    id: 'efficiency',
    label: 'Inverter efficiency',
    unit: '%',
    type: 'number',
    min: 0,
    max: 100,
    step: 'any',
    default: '85',
    hint: 'Use 100% for a DC load with no inverter',
  },
];

export function calculate(values = {}) {
  const { capacity, voltage, depth, load, efficiency } = values;

  if (!Number.isFinite(capacity) || capacity <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a battery capacity greater than zero.' };
  }
  if (!Number.isFinite(voltage) || voltage <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a nominal voltage greater than zero.' };
  }
  if (!Number.isFinite(depth) || depth <= 0 || depth > 100) {
    return { ok: false, tone: 'error', message: 'Depth of discharge must be between 0 and 100%.' };
  }
  if (!Number.isFinite(load) || load <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a load greater than zero.' };
  }
  if (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 100) {
    return { ok: false, tone: 'error', message: 'Inverter efficiency must be between 0 and 100%.' };
  }

  const usableWh = capacity * voltage * (depth / 100);
  const runtimeHours = (usableWh * (efficiency / 100)) / load;
  const loadCurrent = load / (voltage * (efficiency / 100));
  const cRate = loadCurrent / capacity;

  const notes = [
    'Runtime assumes a constant load and full inverter efficiency across the discharge.',
    'Peukert effect, inverter idle draw, temperature and battery ageing can reduce real runtime.',
    'Deep discharges shorten lead-acid battery life; size for a shallower depth of discharge when possible.',
  ];

  let status;
  if (runtimeHours < 0.5) {
    status = {
      level: 'warn',
      label: 'Estimated runtime is under 30 minutes — verify the load and battery capacity.',
    };
  } else if (depth > 80) {
    status = {
      level: 'warn',
      label: 'Deep discharge selected — check the battery manufacturer’s limit.',
    };
  }

  return {
    ok: true,
    outputs: [
      {
        label: 'Estimated runtime',
        display: formatDuration(runtimeHours),
        primary: true,
      },
      { label: 'Usable energy', value: usableWh, unit: 'Wh', primary: true },
      { label: 'Battery current', value: loadCurrent, unit: 'A' },
      { label: 'C-rate', value: cRate, unit: 'C' },
    ],
    runtimeHours,
    status,
    notes,
  };
}
