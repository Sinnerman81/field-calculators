import { formatMmSs } from './format.js';

export const meta = {
  id: 'hydraulic-load',
  name: 'Hydraulic Load Test',
  category: 'Hydraulics',
  icon: 'flow',
  description: 'Measure actual flow from a timed container fill and size the dose run time.',
  keywords: ['gpm', 'flow', 'hydraulic', 'septic', 'dose', 'pump', 'gallons per minute'],
  hint: 'Run a timed container fill to establish actual flow, then choose the target dose volume.',
};

export const fields = [
  {
    id: 'containerGallons',
    label: 'Test container volume',
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
    label: 'Fill time',
    unit: 's',
    type: 'number',
    min: 0,
    step: 'any',
    stepper: 1,
    placeholder: '60',
    hint: 'Seconds to fill the test container',
  },
  {
    id: 'targetVolume',
    label: 'Target test volume',
    unit: 'gal',
    type: 'number',
    min: 0,
    step: 'any',
    default: '250',
    placeholder: '250',
    span: 2,
    choices: [
      { value: 150, label: '150 gal' },
      { value: 250, label: '250 gal' },
      { value: 300, label: '300 gal' },
      { value: 450, label: '450 gal' },
    ],
    hint: 'Preset dose or enter a custom test volume',
  },
];

export function calculate(values = {}) {
  const { containerGallons, fillSeconds, targetVolume } = values;

  if (!Number.isFinite(containerGallons) || containerGallons <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter the test container volume greater than zero.',
    };
  }
  if (!Number.isFinite(fillSeconds) || fillSeconds <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter the fill time in seconds greater than zero.',
    };
  }
  if (!Number.isFinite(targetVolume) || targetVolume <= 0) {
    return {
      ok: false,
      tone: 'error',
      message: 'Choose or enter a target test volume greater than zero.',
    };
  }

  const flowGpm = (containerGallons / fillSeconds) * 60;
  const runTimeSeconds = (targetVolume / flowGpm) * 60;
  const dosingRate = flowGpm * 1440;

  return {
    ok: true,
    outputs: [
      { label: 'Flow rate', value: flowGpm, unit: 'GPM', primary: true },
      {
        label: 'Total run time',
        display: formatMmSs(runTimeSeconds),
        primary: true,
      },
      { label: 'Dosing rate', value: dosingRate, unit: 'gal/day' },
    ],
    notes: [
      'Flow rate is based on the measured container fill: (gallons ÷ seconds) × 60.',
      'Total run time = target volume ÷ flow rate.',
      'Dosing rate is the continuous 24-hour equivalent of the measured flow; the actual timer setting controls daily delivery.',
    ],
  };
}
