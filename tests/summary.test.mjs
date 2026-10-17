import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatMmSs, outputValue } from '../modules/format.js';
import { buildSummaryMarkdown } from '../modules/summary.js';

const result = {
  ok: true,
  outputs: [
    { label: 'Voltage drop', value: 7.78, unit: 'V', primary: true },
    { label: 'Estimated runtime', display: '2 h 15 min' },
  ],
  status: { level: 'warn', label: 'Close to the 3% limit.' },
  notes: ['Uses DC resistance at 75 °C.', 'Verify against local code.'],
};

describe('format helpers', () => {
  it('formats seconds as mm:ss', () => {
    assert.equal(formatMmSs(0), '00:00');
    assert.equal(formatMmSs(65), '01:05');
    assert.equal(formatMmSs(1500), '25:00');
    assert.equal(formatMmSs(59.6), '01:00');
    assert.equal(formatMmSs(-1), '—');
    assert.equal(formatMmSs(Number.NaN), '—');
  });

  it('formats values by magnitude without noisy decimals', () => {
    assert.equal(outputValue({ value: 230, unit: 'V' }), '230');
    assert.equal(outputValue({ value: 7.7776, unit: 'V' }), '7.78');
    assert.equal(outputValue({ value: 0.19443, unit: 'Ω' }), '0.194');
    assert.equal(outputValue({ value: 12345 }), '12,345');
    assert.equal(outputValue({ display: '2 h 15 min' }), '2 h 15 min');
    assert.equal(outputValue({}), '—');
  });
});

describe('buildSummaryMarkdown', () => {
  it('builds a report-ready Markdown summary', () => {
    const markdown = buildSummaryMarkdown({
      title: 'Voltage Drop',
      category: 'Electrical',
      inputs: [
        { label: 'System voltage', value: '230', unit: 'V' },
        { label: 'System', value: 'Single-phase AC' },
      ],
      result,
      generatedAt: new Date('2026-10-17T16:42:00Z'),
      appVersion: 'v1.1.0-wastewater',
    });

    assert.match(markdown, /^## Voltage Drop/m);
    assert.match(markdown, /- \*\*App Version:\*\* v1\.1\.0-wastewater/);
    assert.match(markdown, /\*\*Category:\*\* Electrical/);
    assert.match(markdown, /\*\*Generated:\*\* /);
    assert.match(markdown, /### Inputs/);
    assert.match(markdown, /- \*\*System voltage:\*\* 230 V/);
    assert.match(markdown, /- \*\*System:\*\* Single-phase AC/);
    assert.match(markdown, /### Results/);
    assert.match(markdown, /- \*\*Voltage drop:\*\* 7\.78 V/);
    assert.match(markdown, /- \*\*Estimated runtime:\*\* 2 h 15 min/);
    assert.match(markdown, /\*\*Status:\*\* Close to the 3% limit\./);
    assert.match(markdown, /### Assumptions/);
    assert.match(markdown, /- Verify against local code\./);
    assert.match(markdown, /_FieldKit — offline field calculators_/);
  });

  it('omits optional sections cleanly', () => {
    const markdown = buildSummaryMarkdown({
      title: 'Ohm’s Law & Power',
      inputs: [],
      result: { ok: true, outputs: [{ label: 'Power', value: 24, unit: 'W' }] },
      generatedAt: new Date('2026-10-17T16:42:00Z'),
    });
    assert.match(markdown, /### Inputs\n- —/);
    assert.doesNotMatch(markdown, /### Assumptions/);
    assert.doesNotMatch(markdown, /Status/);
    assert.doesNotMatch(markdown, /App Version/);
  });

  it('includes alert details in reports', () => {
    const markdown = buildSummaryMarkdown({
      title: 'Drip & OSCAR — Inspection Log',
      category: 'Drip',
      inputs: [{ label: 'Mode', value: 'OSCAR Sand-Lined' }],
      result: {
        ok: true,
        outputs: [{ label: 'Total OSCAR flow', value: 2.8, unit: 'GPM' }],
        alerts: [
          { level: 'warn', label: 'Dose volume adjusted up to meet manufacturer minimum.' },
          { level: 'bad', label: 'Exceeds standard 50 GPD/coil rating.' },
        ],
      },
      generatedAt: new Date('2026-10-17T16:42:00Z'),
    });

    assert.match(markdown, /### Alerts/);
    assert.match(markdown, /- \*\*WARNING:\*\* Dose volume adjusted/);
    assert.match(markdown, /- \*\*ALERT:\*\* Exceeds standard/);
    assert.match(markdown, /- \*\*Mode:\*\* OSCAR Sand-Lined/);
  });

  it('rejects incomplete results', () => {
    assert.throws(() => buildSummaryMarkdown({ title: 'Test', result: { ok: false } }), TypeError);
    assert.throws(() => buildSummaryMarkdown({ result }), TypeError);
  });
});
