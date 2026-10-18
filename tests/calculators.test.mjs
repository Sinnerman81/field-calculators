import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as hydraulic from '../modules/hydraulic-load.js';
import * as tanks from '../modules/tank-volumes.js';
import * as distribution from '../modules/pressure-distribution.js';
import * as drip from '../modules/drip-oscar.js';
import * as utilities from '../modules/field-utilities.js';

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
  it('converts the default bucket fill into flow and both run-time formats', () => {
    const result = hydraulic.calculate({
      bucketGallons: 5,
      fillSeconds: 50,
      targetTotal: 450,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Flow rate').value, 6);
    close(output(result, 'Run time').value, 75);
    assert.equal(output(result, 'Run time (mm:ss)').display, '75:00');
  });

  it('handles non-integer fill times and custom targets', () => {
    const result = hydraulic.calculate({
      bucketGallons: 5,
      fillSeconds: 45,
      targetTotal: 150,
    });
    close(output(result, 'Flow rate').value, 6.6667);
    close(output(result, 'Run time').value, 22.5);
    assert.equal(output(result, 'Run time (mm:ss)').display, '22:30');
  });

  it('requires bucket, fill time and target values', () => {
    assert.equal(hydraulic.calculate({ bucketGallons: 0, fillSeconds: 50, targetTotal: 450 }).ok, false);
    assert.equal(hydraulic.calculate({ bucketGallons: 5, fillSeconds: 0, targetTotal: 450 }).ok, false);
    assert.equal(hydraulic.calculate({ bucketGallons: 5, fillSeconds: 50, targetTotal: 0 }).ok, false);
  });
});

describe('Tank Volume & GPI', () => {
  it('calculates rectangular tank volume and gallons per inch from feet and inches', () => {
    const result = tanks.calculate({
      mode: 'rectangular',
      rectLength: 4,
      rectWidth: 4,
      rectDepth: 12,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Gallons per inch').value, 9.9733);
    close(output(result, 'Total gallons').value, 119.68);
  });

  it('calculates vertical cylindrical tank volume and gallons per inch', () => {
    const result = tanks.calculate({
      mode: 'cylindrical',
      cylDiameter: 4,
      cylDepth: 12,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Gallons per inch').value, 7.833);
    close(output(result, 'Total gallons').value, 93.9965);
  });

  it('calculates sand filter drawdown with the 0.3 void factor', () => {
    const result = tanks.calculate({
      mode: 'sandfilter',
      sandWidth: 8,
      sandLength: 16,
      sandDepth: 2,
      sandDose: 60,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Total gallons').value, 1914.88);
    close(output(result, 'Void gallons per inch').value, 23.936);
    close(output(result, 'Inches per dose').value, 2.5067);
  });

  it('supports an empty tank depth', () => {
    const result = tanks.calculate({
      mode: 'rectangular',
      rectLength: 4,
      rectWidth: 4,
      rectDepth: 0,
    });
    close(output(result, 'Total gallons').value, 0);
    close(output(result, 'Gallons per inch').value, 9.9733);
  });

  it('validates the selected mode and dimensions', () => {
    assert.equal(tanks.calculate({ mode: 'rectangular', rectLength: 0, rectWidth: 4, rectDepth: 12 }).ok, false);
    assert.equal(tanks.calculate({ mode: 'cylindrical', cylDiameter: 0, cylDepth: 12 }).ok, false);
    assert.equal(
      tanks.calculate({ mode: 'sandfilter', sandWidth: 8, sandLength: 16, sandDepth: 0, sandDose: 60 }).ok,
      false,
    );
    assert.equal(tanks.calculate({ mode: 'oval', rectLength: 4, rectWidth: 4 }).ok, false);
  });
});

describe('Pressure Distribution', () => {
  it('calculates orifice squirt flow with the 0.433 head conversion', () => {
    const result = distribution.calculate({
      mode: 'squirt',
      orificeSize: '0.187',
      squirtHeight: 2,
      orificeCount: 90,
    });
    assert.equal(result.ok, true);
    close(output(result, 'GPM per orifice').value, 0.3834, 1e-3);
    close(output(result, 'Total system GPM').value, 34.503, 1e-2);
  });

  it('supports the 1/4-inch orifice and validates sizes', () => {
    const result = distribution.calculate({
      mode: 'squirt',
      orificeSize: '0.25',
      squirtHeight: 2,
      orificeCount: 10,
    });
    close(output(result, 'GPM per orifice').value, 0.6855, 1e-3);
    close(output(result, 'Total system GPM').value, 6.855, 1e-2);
    assert.equal(
      distribution.calculate({ mode: 'squirt', orificeSize: '0.5', squirtHeight: 2, orificeCount: 10 }).ok,
      false,
    );
  });

  it('calculates gallons per dose and gallons per day', () => {
    const result = distribution.calculate({
      mode: 'runtime',
      runtimeGpm: 4.5,
      runtimeOnTime: 8,
      runtimeDoses: 12,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Gallons per dose').value, 36);
    close(output(result, 'Gallons per day').value, 432);
  });

  it('calculates pump dosing to one decimal and builds the inspection rows', () => {
    const result = distribution.calculate({
      mode: 'pump',
      pumpGpm: 4.5,
      pumpOnTime: 8,
      pumpDoses: 12,
    });
    assert.equal(result.ok, true);
    assert.equal(output(result, 'Gallons per dose').display, '36.0');
    assert.equal(output(result, 'Gallons per day').display, '432.0');
    assert.equal(result.inspection.heading, 'Pump Dosing / Pressure Rate Check');
    assert.deepEqual(
      result.inspection.rows.map((row) => [row.label, row.value, row.unit ?? '']),
      [
        ['Flow Rate', '4.5', 'GPM'],
        ['On-Time', '8', 'min'],
        ['Doses/Day', '12', ''],
        ['Gallons per Dose', '36.0', 'gal'],
        ['Gallons per Day', '432.0', 'GPD'],
      ],
    );
  });

  it('exposes the pump dosing defaults, steps and dose presets', () => {
    const byId = Object.fromEntries(distribution.fields.map((field) => [field.id, field]));
    assert.equal(byId.pumpGpm.default, '4.5');
    assert.equal(byId.pumpGpm.step, 'any');
    assert.equal(byId.pumpGpm.stepper, 0.5);
    assert.equal(byId.pumpOnTime.default, '8.0');
    assert.equal(byId.pumpOnTime.step, 'any');
    assert.equal(byId.pumpOnTime.stepper, 0.5);
    assert.equal(byId.pumpDoses.default, '12');
    assert.equal(byId.pumpDoses.step, '1');
    assert.deepEqual(
      byId.pumpDoses.choices.map((choice) => choice.value),
      [4, 6, 8, 12, 18, 24],
    );
  });

  it('requires positive squirt, flow and dose values', () => {
    assert.equal(
      distribution.calculate({ mode: 'squirt', orificeSize: '0.187', squirtHeight: 0, orificeCount: 90 }).ok,
      false,
    );
    assert.equal(
      distribution.calculate({ mode: 'squirt', orificeSize: '0.187', squirtHeight: 2, orificeCount: 2.5 }).ok,
      false,
    );
    assert.equal(
      distribution.calculate({ mode: 'runtime', runtimeGpm: 0, runtimeOnTime: 8, runtimeDoses: 12 }).ok,
      false,
    );
    assert.equal(
      distribution.calculate({ mode: 'runtime', runtimeGpm: 4.5, runtimeOnTime: 0, runtimeDoses: 12 }).ok,
      false,
    );
    assert.equal(
      distribution.calculate({ mode: 'pump', pumpGpm: 0, pumpOnTime: 8, pumpDoses: 12 }).ok,
      false,
    );
    assert.equal(
      distribution.calculate({ mode: 'pump', pumpGpm: 4.5, pumpOnTime: 8, pumpDoses: 2.5 }).ok,
      false,
    );
  });
});

describe('Drip & OSCAR', () => {
  it('calculates Netafim drip flow, dose and daily usage', () => {
    const result = drip.calculate({
      mode: 'drip',
      dripBrand: 'netafim',
      linearFeet: 721,
      dripOnTime: 8.6,
      dripDoses: 12,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Flow rate').value, 5.047);
    close(output(result, 'Gallons per dose').value, 43.4042);
    close(output(result, 'Total daily usage').value, 520.8504);
  });

  it('uses the Geo-Flow rate', () => {
    const result = drip.calculate({
      mode: 'drip',
      dripBrand: 'geoflow',
      linearFeet: 721,
      dripOnTime: 8.6,
      dripDoses: 12,
    });
    close(output(result, 'Flow rate').value, 7.21);
    close(output(result, 'Gallons per dose').value, 62.006);
  });

  it('calculates OS-50 dose and the 360-based daily total', () => {
    const result = drip.calculate({
      mode: 'oscar',
      oscarModel: 'os50',
      coilCount: 5,
      oscarOnTime: 0.37,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Flow rate').value, 1.75);
    close(output(result, 'Dose volume').value, 0.6475);
    close(output(result, 'Daily total').value, 233.1);
  });

  it('uses OS-100 rate and validates models and coils', () => {
    const result = drip.calculate({
      mode: 'oscar',
      oscarModel: 'os100',
      coilCount: 5,
      oscarOnTime: 0.37,
    });
    close(output(result, 'Flow rate').value, 3.5);
    close(output(result, 'Daily total').value, 466.2);
    assert.equal(
      drip.calculate({ mode: 'oscar', oscarModel: 'os50', coilCount: 0, oscarOnTime: 0.37 }).ok,
      false,
    );
    assert.equal(
      drip.calculate({ mode: 'oscar', oscarModel: 'unknown', coilCount: 5, oscarOnTime: 0.37 }).ok,
      false,
    );
  });
});

describe('Field Utilities', () => {
  it('compares field and design flow', () => {
    const result = utilities.calculate({
      mode: 'double-check',
      fieldGpm: 5,
      designGpm: 4,
    });
    assert.equal(result.ok, true);
    close(output(result, 'GPM difference').value, 1);
    close(output(result, 'Accuracy').value, 125);
  });

  it('converts minutes and seconds to decimal minutes', () => {
    const result = utilities.calculate({ mode: 'time', minutes: 8, seconds: 30 });
    close(output(result, 'Decimal minutes').value, 8.5);
  });

  it('converts feet to inches', () => {
    const result = utilities.calculate({ mode: 'tape', feet: 12 });
    close(output(result, 'Inches').value, 144);
  });

  it('resolves every tape fraction to decimal inches', () => {
    const fractions = ['0.125', '0.25', '0.375', '0.5', '0.625', '0.75', '0.875'];
    for (const fraction of fractions) {
      const result = utilities.calculate({ mode: 'fraction', fraction });
      assert.equal(result.ok, true);
      close(output(result, 'Decimal inches').value, Number(fraction));
    }
  });

  it('rejects invalid inputs', () => {
    assert.equal(utilities.calculate({ mode: 'double-check', fieldGpm: 5, designGpm: 0 }).ok, false);
    assert.equal(utilities.calculate({ mode: 'time', minutes: -1, seconds: 0 }).ok, false);
    assert.equal(utilities.calculate({ mode: 'tape', feet: -1 }).ok, false);
    assert.equal(utilities.calculate({ mode: 'fraction', fraction: '0.3' }).ok, false);
  });
});

describe('report shape', () => {
  it('returns formatted outputs and notes for every calculator', () => {
    const results = [
      hydraulic.calculate({ bucketGallons: 5, fillSeconds: 50, targetTotal: 450 }),
      tanks.calculate({ mode: 'sandfilter', sandWidth: 8, sandLength: 16, sandDepth: 2, sandDose: 60 }),
      distribution.calculate({ mode: 'squirt', orificeSize: '0.187', squirtHeight: 2, orificeCount: 90 }),
      drip.calculate({ mode: 'oscar', oscarModel: 'os50', coilCount: 5, oscarOnTime: 0.37 }),
      utilities.calculate({ mode: 'time', minutes: 8, seconds: 30 }),
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
