import { formatMmSs } from './format.js';

export const meta = {
  id: 'drip-oscar',
  name: 'Drip & OSCAR',
  category: 'Drip',
  icon: 'drip',
  description: 'Subsurface drip loading and OSCAR sand-lined package dosing checks.',
  keywords: ['drip', 'oscar', 'netafim', 'geoflow', 'lowridge', 'effluent', 'dose', 'orifice'],
  hint: 'Results follow the selected mode. Manufacturer minimums override scheduled dose volumes when required.',
  inspectionLog: true,
};

export const modes = [
  { id: 'subsurface', label: 'Subsurface Septic Drip' },
  { id: 'oscar', label: 'OSCAR Sand-Lined' },
];

export const fields = [
  {
    id: 'zoneArea',
    label: 'Zone basal area',
    unit: 'sq ft',
    type: 'number',
    min: 0,
    step: 'any',
    default: '1000',
    stepper: 50,
    placeholder: '1000',
    mode: 'subsurface',
  },
  {
    id: 'emitterSpacing',
    label: 'Emitter spacing',
    type: 'select',
    default: '24',
    options: [
      { value: '12', label: '12 in' },
      { value: '24', label: '24 in' },
    ],
    mode: 'subsurface',
  },
  {
    id: 'rowSpacing',
    label: 'Lateral row spacing',
    type: 'select',
    default: '24',
    options: [
      { value: '12', label: '12 in' },
      { value: '18', label: '18 in' },
      { value: '24', label: '24 in' },
    ],
    mode: 'subsurface',
  },
  {
    id: 'emitterFlow',
    label: 'Nominal emitter flow',
    type: 'select',
    default: '0.6',
    options: [
      { value: '0.4', label: '0.4 GPH' },
      { value: '0.6', label: '0.6 GPH' },
      { value: '1.0', label: '1.0 GPH' },
    ],
    mode: 'subsurface',
  },
  {
    id: 'dailyFlow',
    label: 'Daily design flow',
    unit: 'gal/day',
    type: 'number',
    min: 0,
    step: 'any',
    default: '360',
    stepper: 30,
    span: 2,
    choices: [
      { value: 240, label: '240' },
      { value: 300, label: '300' },
      { value: 360, label: '360' },
      { value: 480, label: '480' },
    ],
    mode: 'subsurface',
  },
  {
    id: 'dosesPerDay',
    label: 'Doses per day',
    unit: 'doses',
    type: 'number',
    min: 1,
    step: 'any',
    default: '6',
    stepper: 1,
    choices: [
      { value: 4, label: '4' },
      { value: 6, label: '6' },
      { value: 8, label: '8' },
      { value: 12, label: '12' },
    ],
    mode: 'subsurface',
  },
  {
    id: 'coilModel',
    label: 'OSCAR coil model',
    type: 'segmented',
    default: 'os50',
    options: [
      { value: 'os50', label: 'OS-50' },
      { value: 'os100', label: 'OS-100' },
    ],
    mode: 'oscar',
  },
  {
    id: 'coilCount',
    label: 'Number of coils',
    unit: 'coils',
    type: 'number',
    min: 1,
    step: 'any',
    default: '8',
    stepper: 1,
    placeholder: '8',
    mode: 'oscar',
  },
  {
    id: 'oscarDailyFlow',
    label: 'Daily design flow',
    unit: 'gal/day',
    type: 'number',
    min: 0,
    step: 'any',
    default: '360',
    stepper: 30,
    span: 2,
    choices: [
      { value: 240, label: '240' },
      { value: 300, label: '300' },
      { value: 360, label: '360' },
      { value: 480, label: '480' },
    ],
    mode: 'oscar',
  },
  {
    id: 'oscarDoses',
    label: 'Target doses per day',
    unit: 'doses',
    type: 'number',
    min: 1,
    step: 'any',
    default: '6',
    stepper: 1,
    mode: 'oscar',
  },
];

const COIL_MODELS = {
  os50: {
    label: 'OS-50',
    flowGpm: 0.35,
    minimumDoseGal: 3.5,
    maxGalPerDayPerCoil: 50,
  },
  os100: {
    label: 'OS-100',
    flowGpm: 0.7,
    minimumDoseGal: 7,
    maxGalPerDayPerCoil: 100,
  },
};

function calculateSubsurface(values) {
  const zoneArea = values.zoneArea;
  const emitterSpacing = Number(values.emitterSpacing);
  const rowSpacing = Number(values.rowSpacing);
  const emitterGph = Number(values.emitterFlow);
  const dailyFlow = values.dailyFlow;
  const doses = values.dosesPerDay;

  if (!Number.isFinite(zoneArea) || zoneArea <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a zone basal area greater than zero.' };
  }
  if (![12, 24].includes(emitterSpacing)) {
    return { ok: false, tone: 'error', message: 'Choose an emitter spacing of 12 or 24 inches.' };
  }
  if (![12, 18, 24].includes(rowSpacing)) {
    return { ok: false, tone: 'error', message: 'Choose a lateral row spacing of 12, 18 or 24 inches.' };
  }
  if (![0.4, 0.6, 1.0].includes(emitterGph)) {
    return { ok: false, tone: 'error', message: 'Choose an emitter flow rating of 0.4, 0.6 or 1.0 GPH.' };
  }
  if (!Number.isFinite(dailyFlow) || dailyFlow <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a daily design flow greater than zero.' };
  }
  if (!Number.isFinite(doses) || doses <= 0) {
    return { ok: false, tone: 'error', message: 'Enter doses per day greater than zero.' };
  }

  const emitterSpacingFt = emitterSpacing / 12;
  const rowSpacingFt = rowSpacing / 12;
  const areaPerEmitter = emitterSpacingFt * rowSpacingFt;
  const emitterCount = Math.floor(zoneArea / areaPerEmitter);

  if (emitterCount < 1) {
    return {
      ok: false,
      tone: 'error',
      message: 'Zone area is too small for the selected emitter and row spacing.',
    };
  }

  const totalFlowGpm = (emitterCount * emitterGph) / 60;
  const doseVolume = dailyFlow / doses;
  const loadingRate = dailyFlow / zoneArea;
  const runTimeSeconds = (doseVolume / totalFlowGpm) * 60;

  const alerts = [];
  if (loadingRate > 0.6) {
    alerts.push({
      level: 'warn',
      label: 'Warning: High areal loading rate for standard soil types.',
    });
  }
  if (totalFlowGpm < 2.0) {
    alerts.push({
      level: 'warn',
      label: 'Verify pump minimum flow rate and velocity for line scouring.',
    });
  }

  return {
    ok: true,
    outputs: [
      { label: 'Total zone flow', value: totalFlowGpm, unit: 'GPM', primary: true },
      {
        label: 'Pump run time',
        display: formatMmSs(runTimeSeconds),
        primary: true,
      },
      { label: 'Total emitter count', value: emitterCount, unit: 'emitters' },
      { label: 'Dose volume per cycle', value: doseVolume, unit: 'gal' },
      { label: 'Daily areal loading', value: loadingRate, unit: 'gal/sq ft/day' },
      { label: 'Area per emitter', value: areaPerEmitter, unit: 'sq ft' },
    ],
    alerts,
    notes: [
      'Emitter grid area = (emitter spacing ÷ 12) × (row spacing ÷ 12).',
      'Total emitters = zone basal area ÷ grid area, rounded down to whole emitters.',
      'Pump run time is based on one dose: daily design flow ÷ doses per day.',
      'Warning threshold: areal loading above 0.60 gal/sq ft/day. Verify low-flow designs with the pump curve and manufacturer guidance.',
    ],
  };
}

function calculateOscar(values) {
  const model = COIL_MODELS[values.coilModel];
  const coilCount = values.coilCount;
  const dailyFlow = values.oscarDailyFlow;
  const doses = values.oscarDoses;

  if (!model) {
    return { ok: false, tone: 'error', message: 'Choose an OSCAR coil model.' };
  }
  if (!Number.isFinite(coilCount) || !Number.isInteger(coilCount) || coilCount <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a whole number of coils greater than zero.' };
  }
  if (!Number.isFinite(dailyFlow) || dailyFlow <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a daily design flow greater than zero.' };
  }
  if (!Number.isFinite(doses) || doses <= 0) {
    return { ok: false, tone: 'error', message: 'Enter target doses per day greater than zero.' };
  }

  const totalFlowGpm = coilCount * model.flowGpm;
  const scheduledDose = dailyFlow / doses;
  const minimumSystemDose = coilCount * model.minimumDoseGal;
  const activeDose = Math.max(scheduledDose, minimumSystemDose);
  const runTimeSeconds = (activeDose / totalFlowGpm) * 60;
  const dailyFlowPerCoil = dailyFlow / coilCount;

  const alerts = [];
  if (scheduledDose < minimumSystemDose) {
    alerts.push({
      level: 'warn',
      label: 'Dose volume adjusted up to meet manufacturer minimum coil flush standard.',
    });
  }
  if (dailyFlowPerCoil > model.maxGalPerDayPerCoil) {
    alerts.push({
      level: 'bad',
      label: `Exceeds standard ${model.maxGalPerDayPerCoil} GPD/coil rating. Additional coils required for this design flow.`,
    });
  }

  return {
    ok: true,
    outputs: [
      { label: 'Total OSCAR flow', value: totalFlowGpm, unit: 'GPM', primary: true },
      {
        label: 'Pump run time',
        display: formatMmSs(runTimeSeconds),
        primary: true,
      },
      { label: 'Scheduled dose volume', value: scheduledDose, unit: 'gal' },
      { label: 'Manufacturer minimum dose', value: minimumSystemDose, unit: 'gal' },
      { label: 'Active dose volume', value: activeDose, unit: 'gal' },
      { label: 'Daily flow per coil', value: dailyFlowPerCoil, unit: 'gal/day/coil' },
    ],
    alerts,
    notes: [
      `${model.label} design flow: ${model.flowGpm} GPM per coil; minimum dose: ${model.minimumDoseGal} gal per coil.`,
      'Scheduled dose = daily design flow ÷ target doses per day.',
      'The active dose is the larger of the scheduled dose and the manufacturer’s minimum system dose.',
      `Sand bed capacity check: ${model.maxGalPerDayPerCoil} GPD per ${model.label} coil.`,
    ],
  };
}

export function calculate(values = {}) {
  if (values.mode === 'subsurface') return calculateSubsurface(values);
  if (values.mode === 'oscar') return calculateOscar(values);
  return { ok: false, tone: 'info', message: 'Choose a drip or OSCAR calculation mode.' };
}
