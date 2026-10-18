import { formatMmSs } from './format.js';

export const meta = {
  id: 'hydraulic-load',
  name: 'Hydraulic Load Test',
  category: 'Hydraulics',
  icon: 'flow',
  description: 'Measure actual flow from a timed bucket fill and size the dose run time.',
  keywords: ['gpm', 'flow', 'hydraulic', 'septic', 'dose', 'pump', 'gallons per minute'],
  hint: 'Run a timed bucket fill to establish actual flow, then choose the target dose volume.',
  inspectionLog: true,
};

export const fields = [
  {
    id: 'bucketGallons',
    label: 'Bucket size',
    unit: 'gal',
    type: 'number',
    min: 0,
    step: 'any',
    default: '5',
    stepper: 1,
    placeholder: '5',
    hint: 'Container used for the timed fill',
  },
  {
    id: 'fillSeconds',
    label: 'Seconds to fill',
    unit: 's',
    type: 'number',
    min: 0,
    step: 'any',
    default: '50',
    stepper: 1,
    placeholder: '50',
    hint: 'Seconds to fill the test container',
  },
  {
    id: 'targetTotal',
    label: 'Target total',
    unit: 'gal',
    type: 'number',
    min: 0,
    step: 'any',
    default: '450',
    placeholder: '450',
    span: 2,
    choices: [
      { value: 150, label: '150 gal' },
      { value: 250, label: '250 gal' },
      { value: 300, label: '300 gal' },
      { value: 450, label: '450 gal' },
    ],
    hint: 'Preset dose or enter a custom target volume',
  },
];

export function calculate(values = {}) {
  const { bucketGallons, fillSeconds, targetTotal } = values;

  if (!Number.isFinite(bucketGallons) || bucketGallons <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter a bucket size greater than zero.',
    };
  }
  if (!Number.isFinite(fillSeconds) || fillSeconds <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter a fill time in seconds greater than zero.',
    };
  }
  if (!Number.isFinite(targetTotal) || targetTotal <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Choose or enter a target total greater than zero.',
    };
  }

  const flowGpm = bucketGallons / (fillSeconds / 60);
  const runtimeMinutes = targetTotal / flowGpm;

  return {
    ok: true,
    outputs: [
      { label: 'Flow rate', value: flowGpm, unit: 'GPM', primary: true },
      { label: 'Run time', value: runtimeMinutes, unit: 'min', primary: true },
      {
        label: 'Run time (mm:ss)',
        display: formatMmSs(runtimeMinutes * 60),
        primary: true,
      },
    ],
    notes: [
      'Flow rate = bucket gallons ÷ (fill seconds ÷ 60).',
      'Run time in minutes = target total ÷ flow rate.',
      'Run time in mm:ss is converted from the decimal-minute result.',
    ],
  };
}
