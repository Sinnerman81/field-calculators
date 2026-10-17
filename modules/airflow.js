export const meta = {
  id: 'airflow',
  name: 'Airflow & CFM',
  category: 'HVAC',
  icon: 'fan',
  description: 'Convert sensible load and temperature difference into airflow.',
  keywords: ['hvac', 'cfm', 'airflow', 'duct', 'sensible', 'kw', 'temperature rise', 'm3/h'],
  hint: 'Sensible capacity only. Use the temperature difference across the coil or heater.',
};

export const fields = [
  {
    id: 'capacity',
    label: 'Sensible capacity',
    unit: 'kW',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '10',
    hint: 'Cooling or heating capacity delivered to the air',
  },
  {
    id: 'deltaT',
    label: 'Air temperature difference',
    unit: 'K',
    type: 'number',
    min: 0,
    step: 'any',
    placeholder: '10',
    hint: 'Return minus supply for cooling (absolute difference)',
  },
];

export function calculate(values = {}) {
  const { capacity, deltaT } = values;

  if (!Number.isFinite(capacity) || capacity <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a sensible capacity greater than zero.' };
  }
  if (!Number.isFinite(deltaT) || deltaT <= 0) {
    return { ok: false, tone: 'error', message: 'Enter a temperature difference greater than zero.' };
  }

  // q = m_dot * cp * ΔT, with air density 1.2 kg/m³ and cp 1.005 kJ/(kg·K).
  const m3s = capacity / (1.2 * 1.005 * deltaT);
  const m3h = m3s * 3600;
  const cfm = m3h * 0.588578;
  const lps = m3s * 1000;
  const btu = capacity * 3412.142;

  return {
    ok: true,
    outputs: [
      { label: 'Airflow', value: m3h, unit: 'm³/h', primary: true },
      { label: 'Airflow (CFM)', value: cfm, unit: 'CFM', primary: true },
      { label: 'Airflow (m³/s)', value: m3s, unit: 'm³/s' },
      { label: 'Airflow (L/s)', value: lps, unit: 'L/s' },
      { label: 'Sensible load', value: btu, unit: 'BTU/h' },
    ],
    notes: [
      'Assumes dry air at 1.2 kg/m³ and cp = 1.005 kJ/(kg·K), roughly sea level at 20 °C.',
      'Equivalent to the imperial CFM = BTU/h ÷ (1.08 × ΔT°F) approximation.',
      'Sensible only: latent load, duct leakage and fan heat are not included.',
    ],
  };
}
