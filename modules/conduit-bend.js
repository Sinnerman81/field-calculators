export const meta = {
  id: 'conduit-bend',
  name: 'Offset Bend',
  category: 'Electrical',
  icon: 'bend',
  description: 'Mark spacing, shrink and first-mark distance for a conduit offset.',
  keywords: ['conduit', 'bend', 'offset', 'shrink', 'multiplier', 'emt', 'rigid'],
  hint: 'Geometry is calculated on the conduit centreline. Check your bender’s take-up before cutting.',
};

const ANGLES = [10, 22.5, 30, 45, 60];

export const fields = [
  {
    id: 'offset',
    label: 'Offset height',
    unit: 'mm',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '100',
    hint: 'Perpendicular distance to clear the obstruction',
  },
  {
    id: 'angle',
    label: 'Bend angle',
    type: 'select',
    default: '30',
    options: ANGLES.map((angle) => ({ value: String(angle), label: `${angle}°` })),
  },
  {
    id: 'run',
    label: 'Run to obstruction',
    unit: 'mm',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '1000',
    hint: 'Optional: horizontal distance from the start of the run',
  },
];

export function calculate(values = {}) {
  const { offset, run } = values;
  const angle = Number(values.angle);

  if (!Number.isFinite(offset) || offset <= 0) {
    return { ok: false, tone: 'error', message: 'Enter an offset height greater than zero.' };
  }
  if (!Number.isFinite(angle) || angle <= 0 || angle >= 90) {
    return { ok: false, tone: 'error', message: 'Choose a bend angle between 0° and 90°.' };
  }
  if (run != null && (!Number.isFinite(run) || run < 0)) {
    return { ok: false, tone: 'error', message: 'Run distance must be zero or greater.' };
  }

  const radians = (angle * Math.PI) / 180;
  const markSpacing = offset / Math.sin(radians);
  const shrink = offset * Math.tan(radians / 2);
  const advance = offset / Math.tan(radians);

  const outputs = [
    { label: 'Mark spacing', value: markSpacing, unit: 'mm', primary: true },
    { label: 'Shrink', value: shrink, unit: 'mm', primary: true },
    { label: 'Offset advance', value: advance, unit: 'mm' },
  ];

  if (Number.isFinite(run) && run > 0) {
    const firstMark = run - advance;
    if (firstMark <= 0) {
      return {
        ok: false,
        tone: 'error',
        message: `Run is too short for this angle. It must exceed the ${advance.toFixed(1)} mm offset advance.`,
      };
    }
    outputs.push({
      label: 'First mark from start',
      value: firstMark,
      unit: 'mm',
      primary: true,
    });
  }

  return {
    ok: true,
    outputs,
    notes: [
      'Mark spacing is measured centre-to-centre along the conduit between bends.',
      'Offset advance is the horizontal distance consumed by the two bends. First mark is measured from the start of the run.',
      'Values are theoretical centreline geometry; bender take-up, bend radius and conduit size can shift the marks.',
    ],
  };
}
