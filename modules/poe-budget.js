export const meta = {
  id: 'poe-budget',
  name: 'PoE Budget',
  category: 'Network',
  icon: 'plug',
  description: 'Check switch PoE demand, reserved headroom and devices supported.',
  keywords: ['poe', 'power', 'switch', 'watts', 'access point', 'camera', '802.3af', '802.3at'],
  hint: 'Use the nameplate or class maximum draw. Inrush and cable heating are not included.',
};

export const fields = [
  {
    id: 'budget',
    label: 'Switch PoE budget',
    unit: 'W',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '370',
  },
  {
    id: 'draw',
    label: 'Draw per device',
    unit: 'W',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '12.9',
  },
  {
    id: 'count',
    label: 'Device count',
    type: 'number',
    min: 0,
    step: 1,
    placeholder: '20',
  },
  {
    id: 'reserve',
    label: 'Planned reserve',
    unit: '%',
    type: 'number',
    min: 0,
    max: 100,
    step: 'any',
    default: '20',
    hint: 'Headroom kept free for future devices',
  },
];

export function calculate(values = {}) {
  const { budget, draw, count, reserve } = values;

  if (!Number.isFinite(budget) || budget <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a switch PoE budget greater than zero.' };
  }
  if (!Number.isFinite(draw) || draw <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a per-device draw greater than zero.' };
  }
  if (!Number.isInteger(count) || count < 0) {
    return { ok: false, tone: 'error', message: 'Device count must be a whole number (0 or more).' };
  }
  if (!Number.isFinite(reserve) || reserve < 0 || reserve >= 100) {
    return { ok: false, tone: 'error', message: 'Reserve must be between 0 and 100% (exclusive).' };
  }

  const demand = draw * count;
  const plannedCapacity = budget * (1 - reserve / 100);
  const headroom = plannedCapacity - demand;
  const utilization = (demand / budget) * 100;
  const maxDevices = Math.floor(plannedCapacity / draw);

  let status;
  if (demand > budget) {
    status = {
      level: 'bad',
      label: `Exceeds the switch budget by ${(demand - budget).toFixed(1)} W.`,
    };
  } else if (demand > plannedCapacity) {
    status = {
      level: 'warn',
      label: `Fits the switch, but uses ${(demand - plannedCapacity).toFixed(1)} W of the reserved headroom.`,
    };
  } else {
    status = { level: 'ok', label: `Fits within the budget with ${headroom.toFixed(1)} W of planned headroom.` };
  }

  return {
    ok: true,
    outputs: [
      { label: 'Total demand', value: demand, unit: 'W', primary: true },
      { label: 'Planned headroom', value: headroom, unit: 'W', primary: true },
      { label: 'Budget utilization', value: utilization, unit: '%' },
      { label: 'Devices supported', value: maxDevices, unit: 'devices' },
      { label: 'Capacity after reserve', value: plannedCapacity, unit: 'W' },
    ],
    status,
    notes: [
      'Devices supported is based on the per-device draw entered, not the PoE class ceiling.',
      'Per-port limits, cable resistance and switch uplink power are not modelled.',
      'Allow extra headroom for inrush current and future access points or cameras.',
    ],
  };
}
