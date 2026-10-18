export const meta = {
  id: 'drip-oscar',
  name: 'Drip & OSCAR',
  category: 'Drip',
  icon: 'drip',
  description: 'Size subsurface drip lines and OSCAR coil dosing from linear feet and on-time.',
  keywords: ['drip', 'oscar', 'netafim', 'geo-flow', 'lowridge', 'effluent', 'dose', 'coil'],
  hint: 'Brand and model rates are fixed manufacturer values. Verify the design against the current datasheet.',
  inspectionLog: true,
};

export const modes = [
  { id: 'drip', label: 'Drip System' },
  { id: 'oscar', label: 'Oscar Unit' },
];

const BRAND_RATES = {
  netafim: 0.007,
  geoflow: 0.01,
};

const MODEL_RATES = {
  os50: 0.35,
  os100: 0.7,
};

export const fields = [
  {
    id: 'dripBrand',
    label: 'Brand',
    type: 'select',
    default: 'netafim',
    options: [
      { value: 'netafim', label: 'Netafim (0.007)' },
      { value: 'geoflow', label: 'Geo-Flow (0.01)' },
    ],
    mode: 'drip',
  },
  {
    id: 'linearFeet',
    label: 'Linear feet',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    default: '721',
    placeholder: '721',
    mode: 'drip',
  },
  {
    id: 'dripOnTime',
    label: 'On-time',
    unit: 'min',
    type: 'number',
    min: 0,
    step: 'any',
    default: '8.6',
    placeholder: '8.6',
    mode: 'drip',
  },
  {
    id: 'dripDoses',
    label: 'Doses per day',
    type: 'number',
    min: 1,
    step: '1',
    default: '12',
    placeholder: '12',
    mode: 'drip',
  },
  {
    id: 'oscarModel',
    label: 'Model',
    type: 'select',
    default: 'os50',
    options: [
      { value: 'os50', label: 'OS-50 (0.35)' },
      { value: 'os100', label: 'OS-100 (0.70)' },
    ],
    mode: 'oscar',
  },
  {
    id: 'coilCount',
    label: 'Coil count',
    unit: 'coils',
    type: 'number',
    min: 1,
    step: '1',
    default: '5',
    stepper: 1,
    placeholder: '5',
    mode: 'oscar',
  },
  {
    id: 'oscarOnTime',
    label: 'On-time',
    unit: 'min',
    type: 'number',
    min: 0,
    step: 'any',
    default: '0.37',
    placeholder: '0.37',
    mode: 'oscar',
  },
];

function calculateDrip(values) {
  const rate = BRAND_RATES[values.dripBrand];
  const linearFeet = values.linearFeet;
  const onTime = values.dripOnTime;
  const doses = values.dripDoses;

  if (!rate) {
    return { ok: false, tone: 'error', message: 'Choose a valid drip brand.' };
  }
  if (!Number.isFinite(linearFeet) || linearFeet <= 0) {
    return { ok: false, tone: 'error', message: 'Enter linear feet greater than zero.' };
  }
  if (!Number.isFinite(onTime) || onTime <= 0) {
    return { ok: false, tone: 'error', message: 'Enter an on-time greater than zero.' };
  }
  if (!Number.isFinite(doses) || !Number.isInteger(doses) || doses <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter a whole number of doses per day greater than zero.',
    };
  }

  const flowGpm = linearFeet * rate;
  const gallonsPerDose = flowGpm * onTime;
  const dailyUsage = gallonsPerDose * doses;

  return {
    ok: true,
    outputs: [
      { label: 'Flow rate', value: flowGpm, unit: 'GPM', primary: true },
      { label: 'Gallons per dose', value: gallonsPerDose, unit: 'gal', primary: true },
      { label: 'Total daily usage', value: dailyUsage, unit: 'gal/day' },
    ],
    notes: [
      `Flow rate = linear feet × ${rate} GPM per foot.`,
      'Gallons per dose = flow rate × on-time.',
      'Total daily usage = gallons per dose × doses per day.',
    ],
  };
}

function calculateOscar(values) {
  const rate = MODEL_RATES[values.oscarModel];
  const coilCount = values.coilCount;
  const onTime = values.oscarOnTime;

  if (!rate) {
    return { ok: false, tone: 'error', message: 'Choose a valid OSCAR model.' };
  }
  if (!Number.isFinite(coilCount) || !Number.isInteger(coilCount) || coilCount <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter a whole number of coils greater than zero.',
    };
  }
  if (!Number.isFinite(onTime) || onTime <= 0) {
    return { ok: false, tone: 'error', message: 'Enter an on-time greater than zero.' };
  }

  const flowGpm = rate * coilCount;
  const doseVolume = flowGpm * onTime;
  const dailyTotal = doseVolume * 360;

  return {
    ok: true,
    outputs: [
      { label: 'Flow rate', value: flowGpm, unit: 'GPM', primary: true },
      { label: 'Dose volume', value: doseVolume, unit: 'gal', primary: true },
      { label: 'Daily total', value: dailyTotal, unit: 'gal/day' },
    ],
    notes: [
      `Flow rate = ${rate} GPM per coil × coil count.`,
      'Dose volume = flow rate × on-time.',
      'Daily total = dose volume × 360.',
    ],
  };
}

export function calculate(values = {}) {
  if (values.mode === 'drip') return calculateDrip(values);
  if (values.mode === 'oscar') return calculateOscar(values);
  return {
    ok: false,
    tone: 'info',
    message: 'Choose drip system or OSCAR unit mode.',
  };
}
