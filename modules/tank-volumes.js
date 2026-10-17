export const meta = {
  id: 'tank-volumes',
  name: 'Tank Volume & GPI',
  category: 'Tanks',
  icon: 'tank',
  description: 'Find liquid gallons and gallons-per-inch for rectangular or cylindrical tanks.',
  keywords: ['tank', 'gallons', 'gpi', 'septic', 'rectangular', 'cylindrical', 'volume'],
  hint: 'Measure inside dimensions in inches. Gallons-per-inch shows how much a one-inch depth change holds.',
};

export const modes = [
  { id: 'rectangular', label: 'Rectangular' },
  { id: 'cylindrical', label: 'Cylindrical' },
];

export const fields = [
  {
    id: 'rectLength',
    label: 'Inside length',
    unit: 'in',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'rectangular',
    placeholder: '48',
  },
  {
    id: 'rectWidth',
    label: 'Inside width',
    unit: 'in',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'rectangular',
    placeholder: '24',
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
    unit: 'in',
    type: 'number',
    min: 0,
    step: 'any',
    mode: 'cylindrical',
    placeholder: '48',
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
];

export function calculate(values = {}) {
  const mode = values.mode;

  if (mode === 'rectangular') {
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
        message: 'Enter the inside length and width in inches, both greater than zero.',
      };
    }
    if (!Number.isFinite(rectDepth) || rectDepth < 0) {
      return {
        ok: false,
        tone: 'error',
        message: 'Enter a liquid depth of zero or greater.',
      };
    }

    const areaSqIn = rectLength * rectWidth;
    const gallonsPerInch = areaSqIn / 231;
    const totalGallons = gallonsPerInch * rectDepth;

    return {
      ok: true,
      outputs: [
        { label: 'Total liquid gallons', value: totalGallons, unit: 'gal', primary: true },
        { label: 'Gallons per inch', value: gallonsPerInch, unit: 'gal/in', primary: true },
      ],
      notes: [
        'Rectangular volume: (length × width × depth) ÷ 231 cubic inches per gallon.',
        'Gallons per inch = (length × width) ÷ 231.',
        'Use inside dimensions and measure to the actual liquid surface for depth.',
      ],
    };
  }

  if (mode === 'cylindrical') {
    const { cylDiameter, cylDepth } = values;

    if (!Number.isFinite(cylDiameter) || cylDiameter <= 0) {
      return {
        ok: false,
        tone: 'error',
        message: 'Enter an inside diameter greater than zero.',
      };
    }
    if (!Number.isFinite(cylDepth) || cylDepth < 0) {
      return {
        ok: false,
        tone: 'error',
        message: 'Enter a liquid depth of zero or greater.',
      };
    }

    const areaSqIn = Math.PI * (cylDiameter / 2) ** 2;
    const gallonsPerInch = areaSqIn / 231;
    const totalGallons = gallonsPerInch * cylDepth;

    return {
      ok: true,
      outputs: [
        { label: 'Total liquid gallons', value: totalGallons, unit: 'gal', primary: true },
        { label: 'Gallons per inch', value: gallonsPerInch, unit: 'gal/in', primary: true },
      ],
      notes: [
        'Cylindrical volume: (π × radius² × depth) ÷ 231 cubic inches per gallon.',
        'Gallons per inch = (π × radius²) ÷ 231.',
        'Use the inside diameter and measure to the actual liquid surface for depth.',
      ],
    };
  }

  return {
    ok: false,
    tone: 'info',
    message: 'Choose rectangular or cylindrical tank mode.',
  };
}
