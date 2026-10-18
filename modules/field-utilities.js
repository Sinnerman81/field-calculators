export const meta = {
  id: 'field-utilities',
  name: 'Field Utilities',
  category: 'Utilities',
  icon: 'wrench',
  description: 'Verify field flow and daily dosing, convert time and tape readings, and resolve inch fractions.',
  keywords: ['utility', 'accuracy', 'conversion', 'time', 'tape', 'fraction', 'gpm', 'field', 'dosing'],
  hint: 'Use the double check to verify the field dose and daily total against the design flow.',
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
    label: 'Field pump flow rate',
    unit: 'GPM',
    type: 'number',
    min: 0,
    step: 'any',
    default: '4.5',
    stepper: 0.5,
    placeholder: '4.5',
    mode: 'double-check',
  },
  {
    id: 'designGpm',
    label: 'Design GPM (plans, optional)',
    unit: 'GPM',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '4.5',
    hint: 'Optional flow check against the plan GPM',
    mode: 'double-check',
  },
  {
    id: 'dosingOnTime',
    label: 'On-time',
    unit: 'min',
    type: 'number',
    min: 0,
    step: 'any',
    default: '8.0',
    stepper: 0.5,
    placeholder: '8.0',
    mode: 'double-check',
  },
  {
    id: 'dosingDoses',
    label: 'Doses per day',
    type: 'number',
    min: 1,
    step: '1',
    default: '12',
    stepper: 1,
    placeholder: '12',
    choices: [
      { value: 4, label: '4' },
      { value: 6, label: '6' },
      { value: 8, label: '8' },
      { value: 12, label: '12' },
      { value: 18, label: '18' },
      { value: 24, label: '24' },
    ],
    mode: 'double-check',
  },
  {
    id: 'designGpd',
    label: 'Design / target daily GPD',
    unit: 'GPD',
    type: 'number',
    min: 0,
    step: 'any',
    default: '432.0',
    stepper: 10,
    placeholder: '432.0',
    hint: 'Optional comparison for variance and accuracy',
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
  const { fieldGpm, designGpm, dosingOnTime, dosingDoses, designGpd } = values;

  if (!Number.isFinite(fieldGpm) || fieldGpm <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a field pump flow rate greater than zero.' };
  }
  if (!Number.isFinite(dosingOnTime) || dosingOnTime <= 0) {
    return { ok: false, tone: 'error', message: 'Enter an on-time greater than zero.' };
  }
  if (!Number.isFinite(dosingDoses) || !Number.isInteger(dosingDoses) || dosingDoses <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter a whole number of doses per day greater than zero.',
    };
  }
  if (designGpm != null && (!Number.isFinite(designGpm) || designGpm <= 0)) {
    return { ok: false, tone: 'error', message: 'Enter a design GPM greater than zero.' };
  }
  if (designGpd != null && (!Number.isFinite(designGpd) || designGpd <= 0)) {
    return { ok: false, tone: 'error', message: 'Enter a design daily GPD greater than zero.' };
  }

  const gallonsPerDose = fieldGpm * dosingOnTime;
  const gallonsPerDay = gallonsPerDose * dosingDoses;
  const outputs = [
    { label: 'Gallons per dose', display: gallonsPerDose.toFixed(1), unit: 'gal', primary: true },
    { label: 'Total daily flow', display: gallonsPerDay.toFixed(1), unit: 'GPD', primary: true },
  ];
  const notes = [
    'Gallons per dose = field GPM × on-time.',
    'Total daily flow = gallons per dose × doses per day.',
  ];

  if (designGpd != null) {
    const variance = gallonsPerDay - designGpd;
    const accuracy = (gallonsPerDay / designGpd) * 100;
    outputs.push(
      { label: 'Variance', display: variance.toFixed(1), unit: 'GPD' },
      { label: 'Accuracy', display: accuracy.toFixed(1), unit: '%' },
    );
    notes.push(
      'Variance = calculated daily GPD − design daily GPD.',
      'Accuracy = (calculated daily GPD ÷ design daily GPD) × 100.',
    );
  }

  if (designGpm != null) {
    outputs.push(
      { label: 'GPM difference', value: fieldGpm - designGpm, unit: 'GPM' },
      { label: 'Flow accuracy', value: (fieldGpm / designGpm) * 100, unit: '%' },
    );
    notes.push('GPM difference = field GPM − design GPM; flow accuracy compares field flow to plan flow.');
  }

  const onTimeLabel = Number.isInteger(dosingOnTime)
    ? dosingOnTime.toFixed(1)
    : String(dosingOnTime);

  return {
    ok: true,
    outputs,
    inspection: {
      heading: 'Dosing Double Check Verification',
      rows: [
        { label: 'Field Flow Rate', value: String(fieldGpm), unit: 'GPM' },
        { label: 'On-Time', value: onTimeLabel, unit: 'min' },
        { label: 'Doses/Day', value: String(dosingDoses) },
        { label: 'Calculated Dose Volume', value: gallonsPerDose.toFixed(1), unit: 'gal' },
        { label: 'Calculated Daily Total', value: gallonsPerDay.toFixed(1), unit: 'GPD' },
      ],
    },
    notes,
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
