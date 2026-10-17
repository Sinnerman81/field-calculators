import { round } from './format.js';

export const meta = {
  id: 'ohms-law',
  name: "Ohm's Law & Power",
  category: 'Electrical',
  icon: 'bolt',
  description: 'Solve voltage, current, resistance and power from any two known values.',
  keywords: ['volts', 'amps', 'watts', 'ohms', 'resistance', 'v', 'i', 'r', 'p'],
  hint: 'Fill in any two values and leave the rest blank. FieldKit solves the other two.',
};

export const fields = [
  {
    id: 'voltage',
    label: 'Voltage',
    unit: 'V',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '12',
    hint: 'Known voltage (V)',
  },
  {
    id: 'current',
    label: 'Current',
    unit: 'A',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '2',
    hint: 'Known current (I)',
  },
  {
    id: 'resistance',
    label: 'Resistance',
    unit: 'Ω',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '6',
    hint: 'Known resistance (R)',
  },
  {
    id: 'power',
    label: 'Power',
    unit: 'W',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '24',
    hint: 'Known power (P)',
  },
];

const LABELS = {
  voltage: 'Voltage',
  current: 'Current',
  resistance: 'Resistance',
  power: 'Power',
};

const UNITS = {
  voltage: 'V',
  current: 'A',
  resistance: 'Ω',
  power: 'W',
};

export function calculate(values = {}) {
  const known = {};
  for (const key of Object.keys(LABELS)) {
    const value = values[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      known[key] = value;
    }
  }

  const given = Object.keys(LABELS).filter((key) => key in known);
  if (given.length < 2) {
    return {
      ok: false,
      tone: 'info',
      message: 'Enter any two values. Leave the values you want solved blank.',
    };
  }

  let solved;
  let pair;

  if (known.voltage != null && known.current != null) {
    const { voltage: v, current: i } = known;
    pair = ['voltage', 'current'];
    solved = { voltage: v, current: i, resistance: v / i, power: v * i };
  } else if (known.voltage != null && known.resistance != null) {
    const { voltage: v, resistance: r } = known;
    pair = ['voltage', 'resistance'];
    solved = { voltage: v, current: v / r, resistance: r, power: (v * v) / r };
  } else if (known.voltage != null && known.power != null) {
    const { voltage: v, power: p } = known;
    pair = ['voltage', 'power'];
    solved = { voltage: v, current: p / v, resistance: (v * v) / p, power: p };
  } else if (known.current != null && known.resistance != null) {
    const { current: i, resistance: r } = known;
    pair = ['current', 'resistance'];
    solved = { voltage: i * r, current: i, resistance: r, power: i * i * r };
  } else if (known.current != null && known.power != null) {
    const { current: i, power: p } = known;
    pair = ['current', 'power'];
    solved = { voltage: p / i, current: i, resistance: p / (i * i), power: p };
  } else {
    const { resistance: r, power: p } = known;
    pair = ['resistance', 'power'];
    solved = {
      voltage: Math.sqrt(p * r),
      current: Math.sqrt(p / r),
      resistance: r,
      power: p,
    };
  }

  const notes = [
    'Assumes a purely resistive DC or unity-power-factor AC load.',
    'Motors, transformers and long cables need impedance and power-factor correction.',
  ];

  for (const key of given) {
    if (pair.includes(key)) continue;
    const computed = solved[key];
    if (computed > 0 && Math.abs(known[key] - computed) / computed > 0.01) {
      notes.unshift(
        `The entered ${LABELS[key].toLowerCase()} (${known[key]}) is inconsistent with the solved value (${round(computed, 2)}). The first two filled fields were used.`,
      );
    }
  }

  const outputs = Object.keys(LABELS).map((key) => ({
    label: LABELS[key],
    value: solved[key],
    unit: UNITS[key],
    primary: !pair.includes(key),
  }));

  return { ok: true, outputs, notes };
}
