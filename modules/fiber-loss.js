export const meta = {
  id: 'fiber-loss',
  name: 'Fiber Loss Budget',
  category: 'Network',
  icon: 'fiber',
  description: 'Sum fiber, connector and splice loss, then compare against the link budget.',
  keywords: ['fiber', 'optic', 'dbm', 'splice', 'connector', 'loss', 'budget', 'single-mode'],
  hint: 'Leave transmitter and receiver fields blank to calculate total optical loss only.',
};

export const fields = [
  {
    id: 'length',
    label: 'Fiber length',
    unit: 'km',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '2.5',
  },
  {
    id: 'attenuation',
    label: 'Fiber attenuation',
    type: 'select',
    placeholder: 'Choose wavelength…',
    options: [
      { value: '3', label: '850 nm MM · 3.0 dB/km' },
      { value: '1', label: '1300 nm MM · 1.0 dB/km' },
      { value: '0.35', label: '1310 nm SM · 0.35 dB/km' },
      { value: '0.2', label: '1550 nm SM · 0.20 dB/km' },
    ],
  },
  {
    id: 'connectors',
    label: 'Connector pairs',
    type: 'number',
    min: 0,
    step: 1,
    default: '2',
    hint: 'Each mated pair adds loss',
  },
  {
    id: 'connectorLoss',
    label: 'Loss per connector',
    unit: 'dB',
    type: 'number',
    min: 0,
    step: 'any',
    default: '0.5',
  },
  {
    id: 'splices',
    label: 'Splices',
    type: 'number',
    min: 0,
    step: 1,
    default: '0',
  },
  {
    id: 'spliceLoss',
    label: 'Loss per splice',
    unit: 'dB',
    type: 'number',
    min: 0,
    step: 'any',
    default: '0.1',
  },
  {
    id: 'tx',
    label: 'TX power',
    unit: 'dBm',
    type: 'number',
    step: 'any',
    placeholder: '-3',
    hint: 'Optional',
  },
  {
    id: 'sensitivity',
    label: 'RX sensitivity',
    unit: 'dBm',
    type: 'number',
    step: 'any',
    placeholder: '-24',
    hint: 'Optional',
  },
  {
    id: 'safety',
    label: 'Safety margin',
    unit: 'dB',
    type: 'number',
    min: 0,
    step: 'any',
    default: '3',
    hint: 'Reserve required for ageing and repairs',
  },
];

export function calculate(values = {}) {
  const {
    length,
    attenuation,
    connectors,
    connectorLoss,
    splices,
    spliceLoss,
    tx,
    sensitivity,
    safety,
  } = values;

  const att = Number(attenuation);

  if (!Number.isFinite(length) || length <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a fiber length greater than zero.' };
  }
  if (!Number.isFinite(att) || att <= 0) {
    return { ok: false, tone: 'error', message: 'Choose the fiber attenuation for the wavelength in use.' };
  }
  for (const [label, value] of [
    ['connector pairs', connectors],
    ['splices', splices],
  ]) {
    if (!Number.isInteger(value) || value < 0) {
      return { ok: false, tone: 'error', message: `Enter ${label} as a whole number (0 or more).` };
    }
  }
  if (!Number.isFinite(connectorLoss) || connectorLoss < 0) {
    return { ok: false, tone: 'error', message: 'Connector loss must be zero or greater.' };
  }
  if (!Number.isFinite(spliceLoss) || spliceLoss < 0) {
    return { ok: false, tone: 'error', message: 'Splice loss must be zero or greater.' };
  }
  if (!Number.isFinite(safety) || safety < 0) {
    return { ok: false, tone: 'error', message: 'Safety margin must be zero or greater.' };
  }

  const hasTx = tx != null;
  const hasSensitivity = sensitivity != null;
  if (hasTx !== hasSensitivity) {
    return {
      ok: false,
      tone: 'error',
      message: 'Enter both TX power and RX sensitivity, or leave both blank.',
    };
  }
  if (hasTx && (!Number.isFinite(tx) || !Number.isFinite(sensitivity))) {
    return { ok: false, tone: 'error', message: 'TX power and RX sensitivity must be valid numbers.' };
  }

  const fiberLoss = length * att;
  const connectorTotal = connectors * connectorLoss;
  const spliceTotal = splices * spliceLoss;
  const totalLoss = fiberLoss + connectorTotal + spliceTotal;

  const outputs = [
    { label: 'Total optical loss', value: totalLoss, unit: 'dB', primary: true },
    { label: 'Fiber attenuation', value: fiberLoss, unit: 'dB' },
    { label: 'Connectors', value: connectorTotal, unit: 'dB' },
    { label: 'Splices', value: spliceTotal, unit: 'dB' },
  ];

  let status;
  if (hasTx) {
    const budget = tx - sensitivity;
    const remaining = budget - totalLoss;
    const rxLevel = tx - totalLoss;
    outputs.unshift({ label: 'Remaining margin', value: remaining, unit: 'dB', primary: true });
    outputs.push({ label: 'Link budget', value: budget, unit: 'dB' });
    outputs.push({ label: 'Estimated RX power', value: rxLevel, unit: 'dBm' });

    if (remaining < safety) {
      status = {
        level: 'bad',
        label: `Link is short by ${(safety - remaining).toFixed(1)} dB against the ${safety} dB safety margin.`,
      };
    } else {
      status = {
        level: 'ok',
        label: `Passes with ${remaining.toFixed(1)} dB spare (${safety} dB safety margin).`,
      };
    }
  } else {
    outputs.push({ label: 'Safety margin', value: safety, unit: 'dB' });
  }

  return {
    ok: true,
    outputs,
    status,
    notes: [
      'Total optical loss excludes the safety margin; the margin is compared separately.',
      'Connector and splice values are allowances — use measured or vendor specifications for a final design.',
      'WDM components, patch-panel ageing and bending loss are not included.',
    ],
  };
}
