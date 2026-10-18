export const meta = {
  id: 'tank-volumes',
  name: 'Tank Volume & GPI',
  category: 'Tanks',
  icon: 'tank',
  description: 'Find liquid gallons, gallons-per-inch and sand filter drawdown.',
  keywords: ['tank', 'gallons', 'gpi', 'septic', 'sand filter', 'drawdown', 'rectangular', 'cylindrical'],
  hint: 'Measure inside dimensions. Gallons-per-inch shows how much a one-inch depth change holds.',
  inspectionLog: true,
};

export const modes = [
  { id: 'rectangular', label: 'Rectangular' },
  { id: 'cylindrical', label: 'Cylindrical' },
  { id: 'sandfilter', label: 'Sand Filter' },
];

export const fields = [
  {
    id: 'rectLength',
    label: 'Inside length',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'rectangular',
    placeholder: '4',
  },
  {
    id: 'rectWidth',
    label: 'Inside width',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'rectangular',
    placeholder: '4',
  },
  {
    id: 'rectDepth',
    label: 'Liquid depth',
    unit: 'in',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'rectangular',
    placeholder: '12',
  },
  {
    id: 'cylDiameter',
    label: 'Inside diameter',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'cylindrical',
    placeholder: '4',
  },
  {
    id: 'cylDepth',
    label: 'Liquid depth',
    unit: 'in',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'cylindrical',
    placeholder: '12',
  },
  {
    id: 'sandWidth',
    label: 'Width',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'sandfilter',
    placeholder: '8',
  },
  {
    id: 'sandLength',
    label: 'Length',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'sandfilter',
    placeholder: '16',
  },
  {
    id: 'sandDepth',
    label: 'Media depth',
    unit: 'ft',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'sandfilter',
    placeholder: '2',
  },
  {
    id: 'sandDose',
    label: 'Gallons per dose',
    unit: 'gal',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'sandfilter',
    placeholder: '60',
  },
];

function rectangular(values) {
  const { rectLength, rectWidth, rectDepth } = values;

  if (
    !Number.isFinite(rectLength) ||
    rectLength <= 0 ||
    !Number.isFinite(rectWidth) ||
    rectWidth <= 0
  ) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter the inside length and width in feet, both greater than zero.',
    };
  }
  if (!Number.isFinite(rectDepth) || rectDepth < 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter a liquid depth of zero or greater.',
    };
  }

  const gallonsPerInch = rectLength * rectWidth * (1 / 12) * 7.48;
  const totalGallons = rectLength * rectWidth * (rectDepth / 12) * 7.48;

  return {
    ok: true,
    outputs: [
      { label: 'Total gallons', value: totalGallons, unit: 'gal', primary: true },
      { label: 'Gallons per inch', value: gallonsPerInch, unit: 'gal/in', primary: true },
    ],
    notes: [
      'Gallons per inch = length (ft) × width (ft) × (1 ÷ 12) × 7.48.',
      'Total gallons = length (ft) × width (ft) × (depth in ÷ 12) × 7.48.',
      'Use inside dimensions and measure to the actual liquid surface.',
    ],
  };
}

function cylindrical(values) {
  const { cylDiameter, cylDepth } = values;

  if (!Number.isFinite(cylDiameter) || cylDiameter <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter an inside diameter in feet greater than zero.',
    };
  }
  if (!Number.isFinite(cylDepth) || cylDepth < 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter a liquid depth of zero or greater.',
    };
  }

  const areaSqFt = Math.PI * Math.pow(cylDiameter / 2, 2);
  const gallonsPerInch = (areaSqFt * 7.48) / 12;
  const totalGallons = areaSqFt * (cylDepth / 12) * 7.48;

  return {
    ok: true,
    outputs: [
      { label: 'Total gallons', value: totalGallons, unit: 'gal', primary: true },
      { label: 'Gallons per inch', value: gallonsPerInch, unit: 'gal/in', primary: true },
    ],
    notes: [
      'Gallons per inch = (π × (diameter ÷ 2)² × 7.48) ÷ 12.',
      'Total gallons = π × (diameter ÷ 2)² × (depth in ÷ 12) × 7.48.',
      'Diameter is measured in feet; depth is measured in inches.',
    ],
  };
}

function sandFilter(values) {
  const { sandWidth, sandLength, sandDepth, sandDose } = values;

  if (
    !Number.isFinite(sandWidth) ||
    sandWidth <= 0 ||
    !Number.isFinite(sandLength) ||
    sandLength <= 0
  ) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter sand filter width and length in feet, both greater than zero.',
    };
  }
  if (!Number.isFinite(sandDepth) || sandDepth <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter a media depth in feet greater than zero.',
    };
  }
  if (!Number.isFinite(sandDose) || sandDose <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter gallons per dose greater than zero.',
    };
  }

  const totalGallons = sandWidth * sandLength * sandDepth * 7.48;
  const voidGallonsPerInch = (totalGallons / (sandDepth * 12)) * 0.3;
  const inchesPerDose = sandDose / voidGallonsPerInch;

  return {
    ok: true,
    outputs: [
      { label: 'Total gallons', value: totalGallons, unit: 'gal', primary: true },
      { label: 'Void gallons per inch', value: voidGallonsPerInch, unit: 'gal/in', primary: true },
      { label: 'Inches per dose', value: inchesPerDose, unit: 'in/dose' },
    ],
    notes: [
      'Total gallons = width (ft) × length (ft) × depth (ft) × 7.48.',
      'Void gallons per inch = (total gallons ÷ (depth × 12)) × 0.3.',
      'Inches per dose = gallons per dose ÷ void gallons per inch.',
    ],
  };
}

export function calculate(values = {}) {
  if (values.mode === 'rectangular') return rectangular(values);
  if (values.mode === 'cylindrical') return cylindrical(values);
  if (values.mode === 'sandfilter') return sandFilter(values);
  return {
    ok: false,
    tone: 'info',
    message: 'Choose rectangular, cylindrical or sand filter mode.',
  };
}
