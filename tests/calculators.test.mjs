import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as hydraulic from '../modules/hydraulic-load.js';
import * as tanks from '../modules/tank-volumes.js';
import * as distribution from '../modules/pressure-distribution.js';
import * as drip from '../modules/drip-oscar.js';

function output(result, label) {
  const match = result.outputs.find((item) => item.label === label);
  assert.ok(match, `missing output "${label}"`);
  return match;
}

function close(actual, expected, tolerance = 1e-3) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

describe('Hydraulic Load Test', () => {
  it('converts a timed fill into flow, run time and dosing rate', () => {
    const result = hydraulic.calculate({
      containerGallons: 5,
      fillSeconds: 30,
      targetVolume: 250,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Flow rate').value, 10);
    assert.equal(output(result, 'Total run time').display, '25:00');
    close(output(result, 'Dosing rate').value, 14400);
  });

  it('handles non-integer fill times', () => {
    const result = hydraulic.calculate({
      containerGallons: 5,
      fillSeconds: 45,
      targetVolume: 150,
    });
    close(output(result, 'Flow rate').value, 6.6667, 1e-3);
    assert.equal(output(result, 'Total run time').display, '22:30');
    close(output(result, 'Dosing rate').value, 9600);
  });

  it('requires container, fill time and target values', () => {
    assert.equal(hydraulic.calculate({ containerGallons: 0, fillSeconds: 30, targetVolume: 250 }).ok, false);
    assert.equal(hydraulic.calculate({ containerGallons: 5, fillSeconds: 0, targetVolume: 250 }).ok, false);
    assert.equal(hydraulic.calculate({ containerGallons: 5, fillSeconds: 30, targetVolume: 0 }).ok, false);
  });
});

describe('Tank Volume & GPI', () => {
  it('calculates rectangular tank volume and gallons per inch', () => {
    const result = tanks.calculate({
      mode: 'rectangular',
      rectLength: 48,
      rectWidth: 24,
      rectDepth: 12,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Total liquid gallons').value, 59.8442, 1e-3);
    close(output(result, 'Gallons per inch').value, 4.987, 1e-3);
  });

  it('calculates cylindrical tank volume and gallons per inch', () => {
    const result = tanks.calculate({
      mode: 'cylindrical',
      cylDiameter: 48,
      cylDepth: 12,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Total liquid gallons').value, 94.003, 1e-2);
    close(output(result, 'Gallons per inch').value, 7.8336, 1e-3);
  });

  it('supports an empty tank depth', () => {
    const result = tanks.calculate({
      mode: 'rectangular',
      rectLength: 48,
      rectWidth: 24,
      rectDepth: 0,
    });
    close(output(result, 'Total liquid gallons').value, 0);
    close(output(result, 'Gallons per inch').value, 4.987, 1e-3);
  });

  it('validates the selected mode and dimensions', () => {
    assert.equal(tanks.calculate({ mode: 'rectangular', rectLength: 0, rectWidth: 24, rectDepth: 12 }).ok, false);
    assert.equal(tanks.calculate({ mode: 'cylindrical', cylDiameter: 0, cylDepth: 12 }).ok, false);
    assert.equal(tanks.calculate({ mode: 'oval', rectLength: 48, rectWidth: 24 }).ok, false);
  });
});

describe('Pressure Distribution', () => {
  const base = {
    pipeDiameter: '1.25',
    lateralLength: 100,
    orificeSize: '0.125',
    orificeCount: 10,
    residualHead: 2,
    targetDose: 60,
  };

  it('calculates orifice discharge, lateral volume and pump run time', () => {
    const result = distribution.calculate(base);
    assert.equal(result.ok, true);
    close(output(result, 'Orifice discharge').value, 0.2605, 1e-4);
    close(output(result, 'Total system flow').value, 2.6053, 1e-4);
    close(output(result, 'Lateral pipe volume').value, 7.8);
    close(output(result, 'Recommended minimum dose').value, 39);
    assert.equal(output(result, 'Pump run time').display, '23:02');
    close(output(result, 'Pipe volume factor').value, 0.078);
    assert.deepEqual(result.alerts, []);
  });

  it('uses the correct pipe lookup factor and orifice diameter', () => {
    const result = distribution.calculate({
      ...base,
      pipeDiameter: '2',
      lateralLength: 200,
      orificeSize: '0.1875',
      orificeCount: 20,
      residualHead: 3,
    });
    close(output(result, 'Lateral pipe volume').value, 34.8);
    close(output(result, 'Recommended minimum dose').value, 174);
    close(output(result, 'Orifice discharge').value, 0.7179, 1e-3);
  });

  it('warns when the target dose is below the recommended minimum', () => {
    const result = distribution.calculate({ ...base, targetDose: 20 });
    assert.equal(result.alerts.length, 1);
    assert.match(result.alerts[0].label, /5× lateral/i);
  });

  it('requires positive head, orifice count and dose', () => {
    assert.equal(distribution.calculate({ ...base, residualHead: 0 }).ok, false);
    assert.equal(distribution.calculate({ ...base, orificeCount: 0 }).ok, false);
    assert.equal(distribution.calculate({ ...base, orificeCount: 2.5 }).ok, false);
    assert.equal(distribution.calculate({ ...base, targetDose: 0 }).ok, false);
    assert.equal(distribution.calculate({ ...base, orificeSize: '0.5' }).ok, false);
  });
});

describe('Drip & OSCAR — subsurface mode', () => {
  const base = {
    mode: 'subsurface',
    zoneArea: 1000,
    emitterSpacing: '24',
    rowSpacing: '24',
    emitterFlow: '0.6',
    dailyFlow: 360,
    dosesPerDay: 6,
  };

  it('calculates emitter count, zone flow, loading and run time', () => {
    const result = drip.calculate(base);
    assert.equal(result.ok, true);
    assert.equal(output(result, 'Total emitter count').value, 250);
    close(output(result, 'Total zone flow').value, 2.5);
    close(output(result, 'Dose volume per cycle').value, 60);
    close(output(result, 'Daily areal loading').value, 0.36);
    close(output(result, 'Area per emitter').value, 4);
    assert.equal(output(result, 'Pump run time').display, '24:00');
    assert.deepEqual(result.alerts, []);
  });

  it('warns for high loading and low zone flow', () => {
    const result = drip.calculate({ ...base, zoneArea: 500 });
    assert.equal(output(result, 'Total emitter count').value, 125);
    close(output(result, 'Total zone flow').value, 1.25);
    assert.equal(result.alerts.length, 2);
    assert.ok(result.alerts.some((alert) => /High areal loading/.test(alert.label)));
    assert.ok(result.alerts.some((alert) => /line scouring/.test(alert.label)));
  });

  it('supports 12-inch emitter and row spacing', () => {
    const result = drip.calculate({
      ...base,
      emitterSpacing: '12',
      rowSpacing: '12',
      emitterFlow: '1.0',
    });
    assert.equal(output(result, 'Total emitter count').value, 1000);
    close(output(result, 'Total zone flow').value, 16.6667, 1e-3);
    close(output(result, 'Area per emitter').value, 1);
    assert.equal(output(result, 'Pump run time').display, '03:36');
  });

  it('rejects a zone that cannot hold one emitter', () => {
    const result = drip.calculate({ ...base, zoneArea: 2, emitterSpacing: '24', rowSpacing: '24' });
    assert.equal(result.ok, false);
    assert.match(result.message, /too small/i);
  });
});

describe('Drip & OSCAR — OSCAR package mode', () => {
  const base = {
    mode: 'oscar',
    coilModel: 'os50',
    coilCount: 8,
    oscarDailyFlow: 360,
    oscarDoses: 6,
  };

  it('calculates OS-50 flow, dose and run time', () => {
    const result = drip.calculate(base);
    assert.equal(result.ok, true);
    close(output(result, 'Total OSCAR flow').value, 2.8);
    close(output(result, 'Scheduled dose volume').value, 60);
    close(output(result, 'Manufacturer minimum dose').value, 28);
    close(output(result, 'Active dose volume').value, 60);
    close(output(result, 'Daily flow per coil').value, 45);
    assert.equal(output(result, 'Pump run time').display, '21:26');
    assert.deepEqual(result.alerts, []);
  });

  it('raises the dose to the manufacturer minimum when scheduled volume is low', () => {
    const result = drip.calculate({ ...base, oscarDailyFlow: 240, oscarDoses: 12 });
    close(output(result, 'Scheduled dose volume').value, 20);
    close(output(result, 'Active dose volume').value, 28);
    assert.equal(output(result, 'Pump run time').display, '10:00');
    assert.equal(result.alerts.length, 1);
    assert.match(result.alerts[0].label, /minimum coil flush/i);
  });

  it('alerts when daily flow exceeds the per-coil sand bed capacity', () => {
    const result = drip.calculate({ ...base, oscarDailyFlow: 480, oscarDoses: 6 });
    close(output(result, 'Daily flow per coil').value, 60);
    assert.equal(result.alerts.length, 1);
    assert.equal(result.alerts[0].level, 'bad');
    assert.match(result.alerts[0].label, /50 GPD\/coil/);
  });

  it('uses OS-100 constants and capacity', () => {
    const result = drip.calculate({
      mode: 'oscar',
      coilModel: 'os100',
      coilCount: 4,
      oscarDailyFlow: 360,
      oscarDoses: 6,
    });
    close(output(result, 'Total OSCAR flow').value, 2.8);
    close(output(result, 'Manufacturer minimum dose').value, 28);
    close(output(result, 'Daily flow per coil').value, 90);
    assert.equal(output(result, 'Pump run time').display, '21:26');
    assert.deepEqual(result.alerts, []);
  });

  it('rejects invalid coil counts and modes', () => {
    assert.equal(drip.calculate({ ...base, coilCount: 0 }).ok, false);
    assert.equal(drip.calculate({ ...base, coilCount: 2.5 }).ok, false);
    assert.equal(drip.calculate({ ...base, oscarDailyFlow: 0 }).ok, false);
    assert.equal(drip.calculate({ mode: 'unknown' }).ok, false);
  });
});

describe('report shape', () => {
  it('returns formatted outputs and no undefined values', () => {
    const results = [
      hydraulic.calculate({ containerGallons: 5, fillSeconds: 30, targetVolume: 250 }),
      tanks.calculate({ mode: 'rectangular', rectLength: 48, rectWidth: 24, rectDepth: 12 }),
      distribution.calculate({
        pipeDiameter: '1.25',
        lateralLength: 100,
        orificeSize: '0.125',
        orificeCount: 10,
        residualHead: 2,
        targetDose: 60,
      }),
      drip.calculate({
        mode: 'subsurface',
        zoneArea: 1000,
        emitterSpacing: '24',
        rowSpacing: '24',
        emitterFlow: '0.6',
        dailyFlow: 360,
        dosesPerDay: 6,
      }),
    ];

    for (const result of results) {
      assert.equal(result.ok, true);
      assert.ok(result.outputs.length > 0);
      assert.ok(result.notes.length > 0);
      for (const item of result.outputs) {
        assert.ok(item.label);
        assert.ok(item.value != null || item.display != null, `${item.label} must have a value`);
      }
    }
  });
});
