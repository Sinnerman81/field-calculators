export const meta = {
  id: 'superheat-subcooling',
  name: 'Superheat & Subcooling',
  category: 'HVAC',
  icon: 'thermometer',
  description: 'Work out superheat and subcooling from line and saturation temperatures.',
  keywords: ['hvac', 'superheat', 'subcooling', 'refrigerant', 'saturation', 'charging', 'temperature'],
  hint: 'Use the saturation temperature from your gauge or the manufacturer’s PT chart. No refrigerant table is assumed.',
};

export const fields = [
  {
    id: 'suctionLine',
    label: 'Suction line temperature',
    unit: '°C',
    type: 'number',
    step: 'any',
    placeholder: '12',
  },
  {
    id: 'suctionSat',
    label: 'Suction saturation temperature',
    unit: '°C',
    type: 'number',
    step: 'any',
    placeholder: '5',
  },
  {
    id: 'liquidLine',
    label: 'Liquid line temperature',
    unit: '°C',
    type: 'number',
    step: 'any',
    placeholder: '38',
  },
  {
    id: 'liquidSat',
    label: 'Liquid saturation temperature',
    unit: '°C',
    type: 'number',
    step: 'any',
    placeholder: '45',
  },
];

const SUPERHEAT_RANGE = [5, 10];
const SUBCOOLING_RANGE = [5, 8];

function within(value, [min, max]) {
  return value >= min && value <= max;
}

export function calculate(values = {}) {
  const { suctionLine, suctionSat, liquidLine, liquidSat } = values;
  const hasSuperheatPair = suctionLine != null && suctionSat != null;
  const hasSubcoolingPair = liquidLine != null && liquidSat != null;

  if (!hasSuperheatPair && !hasSubcoolingPair) {
    return {
      ok: false,
      tone: 'info',
      message: 'Enter a line temperature and its matching saturation temperature to calculate superheat or subcooling.',
    };
  }

  const outputs = [];
  const notes = [];
  const warnings = [];

  if (hasSuperheatPair) {
    const superheat = suctionLine - suctionSat;
    const ok = within(superheat, SUPERHEAT_RANGE);
    outputs.push({
      label: 'Superheat',
      value: superheat,
      unit: 'K',
      primary: true,
      tone: ok ? 'ok' : 'warn',
    });
    if (!ok) {
      warnings.push(`Superheat ${superheat.toFixed(1)} K is outside the typical 5–10 K range.`);
    }
  }

  if (hasSubcoolingPair) {
    const subcooling = liquidSat - liquidLine;
    const ok = within(subcooling, SUBCOOLING_RANGE);
    outputs.push({
      label: 'Subcooling',
      value: subcooling,
      unit: 'K',
      primary: true,
      tone: ok ? 'ok' : 'warn',
    });
    if (!ok) {
      warnings.push(`Subcooling ${subcooling.toFixed(1)} K is outside the typical 5–8 K range.`);
    }
  }

  if (!hasSuperheatPair) notes.push('Superheat was not calculated — enter both suction temperatures.');
  if (!hasSubcoolingPair) notes.push('Subcooling was not calculated — enter both liquid temperatures.');

  notes.push(
    'Typical ranges are general air-conditioning guidelines, not a charging specification.',
    'Targets vary with metering device, ambient, load and refrigerant. Confirm against the equipment manufacturer’s data.',
    'A negative value means the line is at or below saturation temperature — stop and investigate.',
  );

  let status;
  if (warnings.length > 0) {
    status = {
      level: 'warn',
      label: warnings.join(' '),
    };
  } else {
    status = { level: 'ok', label: 'Readings are within typical ranges. Always confirm manufacturer targets.' };
  }

  return { ok: true, outputs, status, notes };
}
