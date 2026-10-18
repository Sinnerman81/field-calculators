export const meta = {
  id: 'field-utilities',
  name: 'Field Utilities',
  category: 'Utilities',
  icon: 'wrench',
  description: 'Compare field flow to plan flow, convert time and tape readings, and resolve inch fractions.',
  keywords: ['utility', 'accuracy', 'conversion', 'time', 'tape', 'fraction', 'gpm', 'field'],
  hint: 'Use the double check to document field flow against the design flow before dosing calculations.',
  inspectionLog: true,
};

export const modes = [
  { id: 'double-check', label: 'Double Check' },
  { id: 'time', label: 'Time' },
  { id: 'tape', label: 'Tape' },
  { id: 'fraction', label: 'Fractions' },
];

const FRACTIONS = [
  { value: '0.125', label: '1/8 (0.125)' },
  { value: '0.25', label: '1/4 (0.25)' },
  { value: '0.375', label: '3/8 (0.375)' },
  { value: '0.5', label: '1/2 (0.5)' },
  { value: '0.625', label: '5/8 (0.625)' },
  { value: '0.75', label: '3/4 (0.75)' },
  { value: '0.875', label: '7/8 (0.875)' },
];

export const fields = [
  {
    id: 'fieldGpm',
    label: 'Calculated GPM (field)',
    unit: 'GPM',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '4.5',
    mode: 'double-check',
  },
  {
    id: 'designGpm',
    label: 'Design GPM (plans)',
    unit: 'GPM',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '4.5',
    mode: 'double-check',
  },
  {
    id: 'minutes',
    label: 'Minutes',
    unit: 'min',
    type: 'number',
    min: 0,
    step: 'any',
    default: '0',
    placeholder: '0',
    mode: 'time',
  },
  {
    id: 'seconds',
    label: 'Seconds',
    unit: 's',
    type: 'number',
    min: 0,
    step: 'any',
    default: '0',
    placeholder: '0',
    mode: 'time',
  },
  {
    id: 'feet',
    label: 'Feet',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '12',
    mode: 'tape',
  },
  {
    id: 'fraction',
    label: 'Fraction of an inch',
    type: 'select',
    default: '0.125',
    options: FRACTIONS,
    mode: 'fraction',
  },
];

function doubleCheck(values) {
  const { fieldGpm, designGpm } = values;

  if (!Number.isFinite(fieldGpm) || fieldGpm < 0) {
    return { ok: false, tone: 'error', message: 'Enter the calculated field GPM.' };
  }
  if (!Number.isFinite(designGpm) || designGpm <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a design GPM greater than zero.' };
  }

  const difference = fieldGpm - designGpm;
  const accuracy = (fieldGpm / designGpm) * 100;

  return {
    ok: true,
    outputs: [
      { label: 'GPM difference', value: difference, unit: 'GPM', primary: true },
      { label: 'Accuracy', value: accuracy, unit: '%', primary: true },
    ],
    notes: [
      'GPM difference = calculated field GPM − design GPM.',
      'Accuracy = (field GPM ÷ design GPM) × 100.',
    ],
  };
}

function timeConversion(values) {
  const { minutes, seconds } = values;

  if (!Number.isFinite(minutes) || minutes < 0) {
    return { ok: false, tone: 'error', message: 'Enter minutes of zero or greater.' };
  }
  if (!Number.isFinite(seconds) || seconds < 0) {
    return { ok: false, tone: 'error', message: 'Enter seconds of zero or greater.' };
  }

  const decimalMinutes = minutes + seconds / 60;

  return {
    ok: true,
    outputs: [{ label: 'Decimal minutes', value: decimalMinutes, unit: 'min', primary: true }],
    notes: ['Decimal minutes = minutes + (seconds ÷ 60).'],
  };
}

function tapeConversion(values) {
  const { feet } = values;

  if (!Number.isFinite(feet) || feet < 0) {
    return { ok: false, tone: 'error', message: 'Enter feet of zero or greater.' };
  }

  return {
    ok: true,
    outputs: [{ label: 'Inches', value: feet * 12, unit: 'in', primary: true }],
    notes: ['Inches = feet × 12.'],
  };
}

function fractionConversion(values) {
  const fraction = Number(values.fraction);
  const match = FRACTIONS.find((item) => item.value === String(values.fraction));

  if (!match || !Number.isFinite(fraction)) {
    return { ok: false, tone: 'error', message: 'Choose a valid inch fraction.' };
  }

  return {
    ok: true,
    outputs: [
      { label: 'Decimal inches', value: fraction, unit: 'in', primary: true },
      { label: 'Fraction', display: match.label.split(' ')[0] },
    ],
    notes: ['The selected tape fraction is shown as its decimal-inch equivalent.'],
  };
}

export function calculate(values = {}) {
  if (values.mode === 'double-check') return doubleCheck(values);
  if (values.mode === 'time') return timeConversion(values);
  if (values.mode === 'tape') return tapeConversion(values);
  if (values.mode === 'fraction') return fractionConversion(values);
  return {
    ok: false,
    tone: 'info',
    message: 'Choose a field utility.',
  };
}
