import { formatMmSs } from './format.js';

export const meta = {
  id: 'pressure-distribution',
  name: 'Pressure Distribution',
  category: 'Distribution',
  icon: 'grid',
  description: 'Size orifice discharge, lateral volume, minimum dose and pump run time.',
  keywords: ['orifice', 'lateral', 'distribution', 'dose', 'pump', 'gpm', 'septic'],
  hint: 'Orifice discharge uses residual head at the orifice. Verify the design against the manufacturer’s lateral and pump limits.',
};

const PIPE_FACTORS = {
  '1': 0.045,
  '1.25': 0.078,
  '1.5': 0.106,
  '2': 0.174,
};

const ORIFICE_DIAMETERS = [0.125, 0.15625, 0.1875];

export const fields = [
  {
    id: 'pipeDiameter',
    label: 'Lateral pipe diameter',
    type: 'select',
    default: '1.25',
    options: [
      { value: '1', label: '1" — 0.045 gal/ft' },
      { value: '1.25', label: '1.25" — 0.078 gal/ft' },
      { value: '1.5', label: '1.5" — 0.106 gal/ft' },
      { value: '2', label: '2" — 0.174 gal/ft' },
    ],
  },
  {
    id: 'lateralLength',
    label: 'Total lateral length',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '100',
  },
  {
    id: 'orificeSize',
    label: 'Orifice size',
    type: 'select',
    default: '0.125',
    options: [
      { value: '0.125', label: '1/8" (0.125)' },
      { value: '0.15625', label: '5/32" (0.15625)' },
      { value: '0.1875', label: '3/16" (0.1875)' },
    ],
  },
  {
    id: 'orificeCount',
    label: 'Number of orifices',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '20',
  },
  {
    id: 'residualHead',
    label: 'Residual head',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    default: '2',
    placeholder: '2',
    hint: 'Squirt height or residual pressure head',
  },
  {
    id: 'targetDose',
    label: 'Target dose volume',
    unit: 'gal',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '60',
  },
];

export function calculate(values = {}) {
  const {
    pipeDiameter,
    lateralLength,
    orificeSize,
    orificeCount,
    residualHead,
    targetDose,
  } = values;

  const pipeFactor = PIPE_FACTORS[String(pipeDiameter)];
  const diameter = Number(orificeSize);

  if (!pipeFactor) {
    return { ok: false, tone: 'error', message: 'Choose a valid lateral pipe diameter.' };
  }
  if (!Number.isFinite(lateralLength) || lateralLength < 0) {
    return { ok: false, tone: 'error', message: 'Enter a total lateral length of zero or greater.' };
  }
  if (!ORIFICE_DIAMETERS.includes(diameter)) {
    return { ok: false, tone: 'error', message: 'Choose a valid orifice size.' };
  }
  if (!Number.isFinite(orificeCount) || !Number.isInteger(orificeCount) || orificeCount <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a whole number of orifices greater than zero.' };
  }
  if (!Number.isFinite(residualHead) || residualHead <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a residual head greater than zero.' };
  }
  if (!Number.isFinite(targetDose) || targetDose <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a target dose volume greater than zero.' };
  }

  const orificeGpm = 11.79 * diameter ** 2 * Math.sqrt(residualHead);
  const totalFlowGpm = orificeGpm * orificeCount;
  const lateralVolume = pipeFactor * lateralLength;
  const minimumDose = lateralVolume * 5;
  const runTimeSeconds = (targetDose / totalFlowGpm) * 60;

  const alerts = [];
  if (targetDose < minimumDose) {
    alerts.push({
      level: 'warn',
      label: 'Target dose is below the recommended 5× lateral pipe volume.',
    });
  }

  return {
    ok: true,
    outputs: [
      { label: 'Orifice discharge', value: orificeGpm, unit: 'GPM/orifice', primary: true },
      { label: 'Total system flow', value: totalFlowGpm, unit: 'GPM', primary: true },
      { label: 'Lateral pipe volume', value: lateralVolume, unit: 'gal' },
      { label: 'Recommended minimum dose', value: minimumDose, unit: 'gal' },
      {
        label: 'Pump run time',
        display: formatMmSs(runTimeSeconds),
      },
      { label: 'Pipe volume factor', value: pipeFactor, unit: 'gal/ft' },
    ],
    alerts,
    notes: [
      'Orifice discharge: Q = 11.79 × d² × √h, with d in inches and h in feet of residual head.',
      'Total system flow = orifice discharge × number of orifices.',
      'Pump run time = target dose ÷ total system flow.',
      'Recommended minimum dose is 5× the total lateral pipe volume.',
    ],
  };
}
