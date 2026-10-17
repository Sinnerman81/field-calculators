export const meta = {
  id: 'rf-link',
  name: 'RF Link Budget',
  category: 'RF',
  icon: 'antenna',
  description: 'Free-space path loss, received power and link margin for a radio hop.',
  keywords: ['rf', 'radio', 'dbm', 'antenna', 'fspl', 'wifi', 'link', 'signal', 'fresnel'],
  hint: 'Free-space model: line of sight and clear Fresnel zone are assumed. Obstructions and multipath are not included.',
};

export const fields = [
  {
    id: 'frequency',
    label: 'Frequency',
    unit: 'MHz',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '2400',
  },
  {
    id: 'distance',
    label: 'Distance',
    unit: 'km',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '5',
  },
  {
    id: 'txPower',
    label: 'Transmitter power',
    unit: 'dBm',
    type: 'number',
    step: 'any',
    placeholder: '20',
  },
  {
    id: 'txGain',
    label: 'TX antenna gain',
    unit: 'dBi',
    type: 'number',
    step: 'any',
    default: '0',
  },
  {
    id: 'rxGain',
    label: 'RX antenna gain',
    unit: 'dBi',
    type: 'number',
    step: 'any',
    default: '0',
  },
  {
    id: 'otherLoss',
    label: 'Cable & other losses',
    unit: 'dB',
    type: 'number',
    min: 0,
    step: 'any',
    default: '0',
  },
  {
    id: 'sensitivity',
    label: 'Receiver sensitivity',
    unit: 'dBm',
    type: 'number',
    step: 'any',
    placeholder: '-100',
  },
  {
    id: 'fadeMargin',
    label: 'Required fade margin',
    unit: 'dB',
    type: 'number',
    min: 0,
    step: 'any',
    default: '10',
  },
];

export function calculate(values = {}) {
  const { frequency, distance, txPower, txGain, rxGain, otherLoss, sensitivity, fadeMargin } = values;

  if (!Number.isFinite(frequency) || frequency <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a frequency greater than zero.' };
  }
  if (!Number.isFinite(distance) || distance <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a distance greater than zero.' };
  }
  if (!Number.isFinite(txPower)) {
    return { ok: false, tone: 'error', message: 'Enter the transmitter power in dBm.' };
  }
  if (!Number.isFinite(sensitivity)) {
    return { ok: false, tone: 'error', message: 'Enter the receiver sensitivity in dBm.' };
  }
  if (!Number.isFinite(txGain) || !Number.isFinite(rxGain)) {
    return { ok: false, tone: 'error', message: 'Antenna gains must be valid numbers.' };
  }
  if (!Number.isFinite(otherLoss) || otherLoss < 0) {
    return { ok: false, tone: 'error', message: 'Cable and other losses must be zero or greater.' };
  }
  if (!Number.isFinite(fadeMargin) || fadeMargin < 0) {
    return { ok: false, tone: 'error', message: 'Fade margin must be zero or greater.' };
  }

  const pathLoss = 32.44 + 20 * Math.log10(frequency) + 20 * Math.log10(distance);
  const rxPower = txPower + txGain - otherLoss + rxGain - pathLoss;
  const margin = rxPower - sensitivity;

  const maxPathLoss = txPower + txGain - otherLoss + rxGain - sensitivity - fadeMargin;
  const maxDistance = 10 ** ((maxPathLoss - 32.44 - 20 * Math.log10(frequency)) / 20);

  let status;
  if (margin >= fadeMargin) {
    status = {
      level: 'ok',
      label: `Link closes with ${margin.toFixed(1)} dB margin (${fadeMargin} dB required).`,
    };
  } else {
    status = {
      level: 'bad',
      label: `Link is short by ${(fadeMargin - margin).toFixed(1)} dB. Improve gain, shorten the path or reduce losses.`,
    };
  }

  return {
    ok: true,
    outputs: [
      { label: 'Received power', value: rxPower, unit: 'dBm', primary: true },
      { label: 'Link margin', value: margin, unit: 'dB', primary: true },
      { label: 'Free-space path loss', value: pathLoss, unit: 'dB' },
      { label: 'Max distance at margin', value: maxDistance, unit: 'km' },
    ],
    status,
    notes: [
      'Free-space path loss: 32.44 + 20log₁₀(f MHz) + 20log₁₀(d km).',
      'Requires a clear line of sight; at least 60% of the first Fresnel zone should be unobstructed.',
      'Antenna gains are relative to an isotropic radiator (dBi); cable, connector and alignment losses are yours to enter.',
    ],
  };
}
