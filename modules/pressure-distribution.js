export const meta = {
  id: 'pressure-distribution',
  name: 'Pressure Distribution',
  category: 'Distribution',
  icon: 'grid',
  description: 'Check orifice squirt height and convert pump flow into daily dose volumes.',
  keywords: ['orifice', 'squirt', 'distribution', 'dose', 'pump', 'gpm', 'septic'],
  hint: 'Squirt height is measured at the orifice. Match the orifice size to the drilled distribution hole.',
  inspectionLog: true,
};

export const modes = [
  { id: 'squirt', label: 'Squirt Height' },
  { id: 'runtime', label: 'Run Time & Daily Dose' },
];

const ORIFICE_SIZES = [0.125, 0.156, 0.187, 0.25];

export const fields = [
  {
    id: 'orificeSize',
    label: 'Orifice size',
    type: 'select',
    default: '0.187',
    options: [
      { value: '0.125', label: '1/8" (0.125)' },
      { value: '0.156', label: '5/32" (0.156)' },
      { value: '0.187', label: '3/16" (0.187)' },
      { value: '0.25', label: '1/4" (0.25)' },
    ],
    mode: 'squirt',
  },
  {
    id: 'squirtHeight',
    label: 'Squirt height',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    default: '2',
    stepper: 0.5,
    placeholder: '2',
    mode: 'squirt',
  },
  {
    id: 'orificeCount',
    label: 'Number of orifices',
    type: 'number',
    min: 1,
    step: '1',
    default: '90',
    stepper: 1,
    placeholder: '90',
    mode: 'squirt',
  },
  {
    id: 'runtimeGpm',
    label: 'Flow rate',
    unit: 'GPM',
    type: 'number',
    min: 0,
    step: 'any',
    default: '4.5',
    stepper: 0.5,
    placeholder: '4.5',
    mode: 'runtime',
  },
  {
    id: 'runtimeOnTime',
    label: 'On-time',
    unit: 'min',
    type: 'number',
    min: 0,
    step: 'any',
    default: '8',
    stepper: 0.5,
    placeholder: '8',
    mode: 'runtime',
  },
  {
    id: 'runtimeDoses',
    label: 'Doses per day',
    type: 'number',
    min: 1,
    step: '1',
    default: '12',
    stepper: 1,
    placeholder: '12',
    mode: 'runtime',
  },
];

function calculateSquirt(values) {
  const diameter = Number(values.orificeSize);
  const squirt = values.squirtHeight;
  const count = values.orificeCount;

  if (!ORIFICE_SIZES.includes(diameter)) {
    return { ok: false, tone: 'error', message: 'Choose a valid orifice size.' };
  }
  if (!Number.isFinite(squirt) || squirt <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a squirt height greater than zero.' };
  }
  if (!Number.isFinite(count) || !Number.isInteger(count) || count <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter a whole number of orifices greater than zero.',
    };
  }

  const gpmPerOrifice = 11.78 * Math.pow(diameter, 2) * Math.sqrt(squirt * 0.433);
  const totalGpm = gpmPerOrifice * count;

  return {
    ok: true,
    outputs: [
      { label: 'GPM per orifice', value: gpmPerOrifice, unit: 'GPM', primary: true },
      { label: 'Total system GPM', value: totalGpm, unit: 'GPM', primary: true },
    ],
    notes: [
      'GPM per orifice = 11.78 × orifice diameter² × √(squirt height × 0.433).',
      'Total system GPM = GPM per orifice × number of orifices.',
      'Squirt height is entered in feet and converted to pressure head in psi.',
    ],
  };
}

function calculateRuntime(values) {
  const { runtimeGpm, runtimeOnTime, runtimeDoses } = values;

  if (!Number.isFinite(runtimeGpm) || runtimeGpm <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a flow rate greater than zero.' };
  }
  if (!Number.isFinite(runtimeOnTime) || runtimeOnTime <= 0) {
    return { ok: false, tone: 'error', message: 'Enter an on-time greater than zero.' };
  }
  if (!Number.isFinite(runtimeDoses) || runtimeDoses <= 0) {
    return { ok: false, tone: 'error', message: 'Enter doses per day greater than zero.' };
  }

  const gallonsPerDose = runtimeGpm * runtimeOnTime;
  const gallonsPerDay = gallonsPerDose * runtimeDoses;

  return {
    ok: true,
    outputs: [
      { label: 'Gallons per dose', value: gallonsPerDose, unit: 'gal', primary: true },
      { label: 'Gallons per day', value: gallonsPerDay, unit: 'GPD', primary: true },
    ],
    notes: [
      'Gallons per dose = flow rate × on-time.',
      'Gallons per day = gallons per dose × doses per day.',
    ],
  };
}

export function calculate(values = {}) {
  if (values.mode === 'squirt') return calculateSquirt(values);
  if (values.mode === 'runtime') return calculateRuntime(values);
  return {
    ok: false,
    tone: 'info',
    message: 'Choose squirt height or run time and daily dose mode.',
  };
}
