/**
 * Shared display helpers. Kept free of DOM access so every calculator and the
 * test suite can use them in Node.
 */

/**
 * Format a number for display. With no `digits`, precision scales with the
 * magnitude so field readings stay readable (7.2 mm, 0.1875 Ω, 4,120 m³/h).
 */
export function formatNumber(value, digits) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';

  if (Number.isInteger(digits)) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  const abs = Math.abs(value);
  let maxFractionDigits = 2;
  if (abs === 0) maxFractionDigits = 0;
  else if (abs >= 10000) maxFractionDigits = 0;
  else if (abs >= 100) maxFractionDigits = 1;
  else if (abs < 0.01) maxFractionDigits = 4;
  else if (abs < 1) maxFractionDigits = 3;

  return value.toLocaleString('en-US', {
    maximumFractionDigits: maxFractionDigits,
  });
}

/** Render a result value, preferring a calculator-provided display string. */
export function outputValue(output) {
  if (output.display != null) return String(output.display);
  if (typeof output.value === 'number') {
    return formatNumber(output.value, output.digits);
  }
  return output.value == null ? '—' : String(output.value);
}

/** Convert decimal hours into a compact "2 h 15 min" string. */
export function formatDuration(hours) {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0) {
    return '—';
  }
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** True for a real, finite number — null/undefined/NaN all fail. */
export function isNum(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
