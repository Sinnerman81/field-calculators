export const meta = {
  id: 'voltage-drop',
  name: 'Voltage Drop',
  category: 'Electrical',
  icon: 'drop',
  description: 'Check conductor voltage drop against a percentage limit for the load.',
  keywords: ['cable', 'wire', 'awg', 'conductor', 'drop', 'volts', 'amps', 'nec'],
  hint: 'Enter the one-way circuit length. The return path is included automatically.',
};

const MATERIALS = {
  copper: 'Copper',
  aluminum: 'Aluminum',
};

// NEC-style conductor sizes, circular mils. 18–16 AWG included for low-voltage work.
const SIZES = [
  { value: '18', label: '18 AWG', cmil: 1620 },
  { value: '16', label: '16 AWG', cmil: 2580 },
  { value: '14', label: '14 AWG', cmil: 4110 },
  { value: '12', label: '12 AWG', cmil: 6530 },
  { value: '10', label: '10 AWG', cmil: 10380 },
  { value: '8', label: '8 AWG', cmil: 16510 },
  { value: '6', label: '6 AWG', cmil: 26240 },
  { value: '4', label: '4 AWG', cmil: 41740 },
  { value: '3', label: '3 AWG', cmil: 52620 },
  { value: '2', label: '2 AWG', cmil: 66360 },
  { value: '1', label: '1 AWG', cmil: 83690 },
  { value: '1/0', label: '1/0 AWG', cmil: 105600 },
  { value: '2/0', label: '2/0 AWG', cmil: 133100 },
  { value: '3/0', label: '3/0 AWG', cmil: 167800 },
  { value: '4/0', label: '4/0 AWG', cmil: 211600 },
  { value: '250', label: '250 kcmil', cmil: 250000 },
  { value: '300', label: '300 kcmil', cmil: 300000 },
  { value: '350', label: '350 kcmil', cmil: 350000 },
  { value: '400', label: '400 kcmil', cmil: 400000 },
  { value: '500', label: '500 kcmil', cmil: 500000 },
  { value: '600', label: '600 kcmil', cmil: 600000 },
];

// Ω·cmil/ft at 75 °C, uncoated conductor.
const RESISTIVITY = { copper: 12.9, aluminum: 21.2 };
const FEET_PER_METER = 3.280839895;

export const fields = [
  {
    id: 'system',
    label: 'System',
    type: 'select',
    default: 'single',
    options: [
      { value: 'single', label: 'Single-phase AC' },
      { value: 'three', label: 'Three-phase AC' },
      { value: 'dc', label: 'DC' },
    ],
  },
  {
    id: 'voltage',
    label: 'System voltage',
    unit: 'V',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '230',
    hint: 'Line-to-line for three-phase',
  },
  {
    id: 'current',
    label: 'Load current',
    unit: 'A',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '20',
  },
  {
    id: 'length',
    label: 'One-way run',
    unit: 'm',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '30',
  },
  {
    id: 'material',
    label: 'Conductor',
    type: 'select',
    default: 'copper',
    options: Object.entries(MATERIALS).map(([value, label]) => ({ value, label })),
  },
  {
    id: 'size',
    label: 'Conductor size',
    type: 'select',
    placeholder: 'Choose size…',
    options: SIZES.map(({ value, label }) => ({ value, label })),
  },
  {
    id: 'limit',
    label: 'Allowed drop',
    unit: '%',
    type: 'number',
    min: 0,
    max: 100,
    step: 'any',
    default: '3',
    hint: '3% is a common branch-circuit guideline',
  },
];

export function calculate(values = {}) {
  const { system, voltage, current, length, material, size, limit } = values;
  const selectedSize = SIZES.find((item) => item.value === size);

  if (!Number.isFinite(voltage) || voltage <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a system voltage greater than zero.' };
  }
  if (!Number.isFinite(current) || current <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a load current greater than zero.' };
  }
  if (!Number.isFinite(length) || length <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a one-way circuit length greater than zero.' };
  }
  if (!selectedSize) {
    return { ok: false, tone: 'error', message: 'Choose a conductor size.' };
  }
  if (!Object.hasOwn(RESISTIVITY, material)) {
    return { ok: false, tone: 'error', message: 'Choose copper or aluminum.' };
  }
  if (!Number.isFinite(limit) || limit <= 0 || limit > 100) {
    return { ok: false, tone: 'error', message: 'Enter an allowed drop between 0 and 100%.' };
  }

  const rho = RESISTIVITY[material];
  const oneWayResistance = (rho * FEET_PER_METER * length) / selectedSize.cmil;
  const isThreePhase = system === 'three';
  const pathFactor = isThreePhase ? Math.sqrt(3) : 2;
  const lossFactor = isThreePhase ? 3 : 2;

  const dropVolts = pathFactor * current * oneWayResistance;
  const dropPercent = (dropVolts / voltage) * 100;
  const conductorLoss = lossFactor * current * current * oneWayResistance;
  const loadVoltage = voltage - dropVolts;

  let status;
  if (dropPercent > limit) {
    status = {
      level: 'bad',
      label: `Exceeds the ${limit}% drop limit. Use a larger conductor or shorter run.`,
    };
  } else if (dropPercent > limit * 0.8) {
    status = {
      level: 'warn',
      label: `Within the ${limit}% limit, but close to it (${dropPercent.toFixed(1)}%).`,
    };
  } else {
    status = { level: 'ok', label: `Within the ${limit}% drop limit.` };
  }

  return {
    ok: true,
    outputs: [
      { label: 'Voltage drop', value: dropVolts, unit: 'V', primary: true },
      { label: 'Drop at load', value: dropPercent, unit: '%', primary: true },
      { label: 'Voltage at load', value: loadVoltage, unit: 'V' },
      { label: 'Conductor loss', value: conductorLoss, unit: 'W' },
      { label: 'One-way conductor R', value: oneWayResistance, unit: 'Ω' },
    ],
    status,
    notes: [
      `Uses DC resistance at 75 °C (${MATERIALS[material].toLowerCase()}, ${selectedSize.label}).`,
      isThreePhase
        ? 'Three-phase result assumes a balanced load and a line-to-line voltage.'
        : 'The run length is one-way; the return conductor is included in the drop.',
      'Reactance, terminals, splices, conduit fill and ambient derating are not included. Verify against the local electrical code.',
    ],
  };
}
