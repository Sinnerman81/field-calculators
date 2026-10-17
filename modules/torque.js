export const meta = {
  id: 'torque',
  name: 'Torque Converter',
  category: 'Tools',
  icon: 'wrench',
  description: 'Convert between N·m, ft·lb, in·lb and kgf·m for fastener work.',
  keywords: ['torque', 'nm', 'ft lb', 'inch pound', 'wrench', 'conversion', 'fastener'],
  hint: 'Enter a torque in any unit; every equivalent updates live.',
};

const UNITS = [
  { id: 'nm', label: 'Newton-metre', symbol: 'N·m', toNm: 1 },
  { id: 'ftlb', label: 'Foot-pound', symbol: 'ft·lb', toNm: 1.3558179483 },
  { id: 'inlb', label: 'Inch-pound', symbol: 'in·lb', toNm: 0.1129848290 },
  { id: 'kgfm', label: 'Kilogram-force metre', symbol: 'kgf·m', toNm: 9.80665 },
  { id: 'kgfcm', label: 'Kilogram-force centimetre', symbol: 'kgf·cm', toNm: 0.0980665 },
];

export const fields = [
  {
    id: 'value',
    label: 'Torque',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '100',
    span: 1,
  },
  {
    id: 'unit',
    label: 'Input unit',
    type: 'select',
    default: 'nm',
    options: UNITS.map((unit) => ({ value: unit.id, label: unit.symbol })),
  },
];

export function calculate(values = {}) {
  const { value, unit } = values;
  const source = UNITS.find((item) => item.id === unit);

  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, tone: 'error', message: 'Enter a torque of zero or greater.' };
  }
  if (!source) {
    return { ok: false, tone: 'error', message: 'Choose an input unit.' };
  }

  const inNm = value * source.toNm;

  return {
    ok: true,
    outputs: UNITS.map((target) => ({
      label: target.label,
      value: inNm / target.toNm,
      unit: target.symbol,
      primary: target.id === 'nm' || target.id === 'ftlb',
    })),
    notes: [
      'Conversions use 1 ft·lb = 1.3558179483 N·m and 1 kgf = 9.80665 N.',
      'Follow the fastener or equipment manufacturer’s torque specification and wrench calibration requirements.',
    ],
  };
}
