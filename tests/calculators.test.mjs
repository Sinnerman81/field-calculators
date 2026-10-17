import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as ohms from '../modules/ohms-law.js';
import * as voltageDrop from '../modules/voltage-drop.js';
import * as conduit from '../modules/conduit-bend.js';
import * as battery from '../modules/battery-runtime.js';
import * as subnet from '../modules/subnet.js';
import * as fiber from '../modules/fiber-loss.js';
import * as poe from '../modules/poe-budget.js';
import * as airflow from '../modules/airflow.js';
import * as superheat from '../modules/superheat-subcooling.js';
import * as rf from '../modules/rf-link.js';
import * as torque from '../modules/torque.js';

function output(result, label) {
  const match = result.outputs.find((item) => item.label === label);
  assert.ok(match, `missing output "${label}"`);
  return match;
}

function hasOutput(result, label) {
  return result.outputs.some((item) => item.label === label);
}

function close(actual, expected, tolerance = 1e-3) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

describe("Ohm's Law & Power", () => {
  it('solves resistance and power from voltage and current', () => {
    const result = ohms.calculate({ voltage: 12, current: 2 });
    assert.equal(result.ok, true);
    close(output(result, 'Resistance').value, 6);
    close(output(result, 'Power').value, 24);
    assert.equal(output(result, 'Voltage').primary, false);
    assert.equal(output(result, 'Resistance').primary, true);
  });

  it('solves current and power from voltage and resistance', () => {
    const result = ohms.calculate({ voltage: 230, resistance: 10 });
    close(output(result, 'Current').value, 23);
    close(output(result, 'Power').value, 5290);
  });

  it('solves from current and resistance', () => {
    const result = ohms.calculate({ current: 3, resistance: 4 });
    close(output(result, 'Voltage').value, 12);
    close(output(result, 'Power').value, 36);
  });

  it('solves from resistance and power', () => {
    const result = ohms.calculate({ resistance: 8, power: 32 });
    close(output(result, 'Voltage').value, 16);
    close(output(result, 'Current').value, 2);
  });

  it('needs two values and rejects zero-filled pairs', () => {
    const result = ohms.calculate({ voltage: 12 });
    assert.equal(result.ok, false);
    assert.equal(result.tone, 'info');
    assert.match(result.message, /two values/i);

    const zero = ohms.calculate({ voltage: 12, current: 0 });
    assert.equal(zero.ok, false);
  });

  it('warns when a third value is inconsistent', () => {
    const result = ohms.calculate({ voltage: 12, current: 2, resistance: 100 });
    assert.equal(result.ok, true);
    assert.match(result.notes[0], /inconsistent/i);
  });
});

describe('Voltage Drop', () => {
  const base = {
    system: 'single',
    voltage: 230,
    current: 20,
    length: 30,
    material: 'copper',
    size: '12',
    limit: 3,
  };

  it('calculates single-phase drop, loss and load voltage', () => {
    const result = voltageDrop.calculate(base);
    assert.equal(result.ok, true);
    close(output(result, 'Voltage drop').value, 7.7776, 0.001);
    close(output(result, 'Drop at load').value, 3.3815, 0.001);
    close(output(result, 'Voltage at load').value, 222.2224, 0.001);
    close(output(result, 'Conductor loss').value, 155.551, 0.01);
    assert.equal(result.status.level, 'bad');
  });

  it('uses the three-phase path factor', () => {
    const result = voltageDrop.calculate({ ...base, system: 'three', voltage: 400 });
    close(output(result, 'Voltage drop').value, 6.7357, 0.001);
    close(output(result, 'Drop at load').value, 1.6839, 0.001);
    assert.equal(result.status.level, 'ok');
  });

  it('treats zero drop as a pass and widens for aluminium', () => {
    const copper = voltageDrop.calculate({ ...base, current: 1 });
    const aluminium = voltageDrop.calculate({ ...base, current: 1, material: 'aluminum' });
    assert.ok(
      output(aluminium, 'Voltage drop').value > output(copper, 'Voltage drop').value,
      'aluminium should drop more than copper',
    );
  });

  it('validates required entries', () => {
    assert.equal(voltageDrop.calculate({ ...base, size: '' }).ok, false);
    assert.equal(voltageDrop.calculate({ ...base, voltage: 0 }).ok, false);
    assert.equal(voltageDrop.calculate({ ...base, limit: 0 }).ok, false);
  });
});

describe('Conduit Offset Bend', () => {
  it('calculates marks, shrink and first mark for a 30 degree offset', () => {
    const result = conduit.calculate({ offset: 100, angle: '30', run: 1000 });
    assert.equal(result.ok, true);
    close(output(result, 'Mark spacing').value, 200, 1e-6);
    close(output(result, 'Shrink').value, 26.7949, 1e-3);
    close(output(result, 'Offset advance').value, 173.2051, 1e-3);
    close(output(result, 'First mark from start').value, 826.7949, 1e-3);
  });

  it('handles 45 degree bends', () => {
    const result = conduit.calculate({ offset: 50, angle: '45' });
    close(output(result, 'Mark spacing').value, 70.7107, 1e-3);
    close(output(result, 'Shrink').value, 20.7107, 1e-3);
  });

  it('rejects a run shorter than the offset advance', () => {
    const result = conduit.calculate({ offset: 100, angle: '30', run: 100 });
    assert.equal(result.ok, false);
    assert.match(result.message, /too short/i);
  });
});

describe('Battery Runtime', () => {
  it('calculates runtime, usable energy and current', () => {
    const result = battery.calculate({
      capacity: 100,
      voltage: 12,
      depth: 80,
      load: 500,
      efficiency: 85,
    });
    assert.equal(result.ok, true);
    close(result.runtimeHours, 1.632, 1e-3);
    close(output(result, 'Usable energy').value, 960);
    close(output(result, 'Battery current').value, 49.0196, 1e-3);
    close(output(result, 'C-rate').value, 0.4902, 1e-3);
    assert.equal(output(result, 'Estimated runtime').display, '1 h 38 min');
  });

  it('is 100% efficient for a DC load', () => {
    const result = battery.calculate({
      capacity: 50,
      voltage: 24,
      depth: 100,
      load: 240,
      efficiency: 100,
    });
    close(result.runtimeHours, 5);
  });

  it('validates depth and efficiency limits', () => {
    assert.equal(
      battery.calculate({ capacity: 100, voltage: 12, depth: 101, load: 10, efficiency: 90 }).ok,
      false,
    );
    assert.equal(
      battery.calculate({ capacity: 100, voltage: 12, depth: 80, load: 10, efficiency: 0 }).ok,
      false,
    );
  });
});

describe('IPv4 Subnet', () => {
  it('calculates a /26 network', () => {
    const result = subnet.calculate({ address: '192.168.1.130', prefix: 26 });
    assert.equal(result.ok, true);
    assert.equal(output(result, 'Network').value, '192.168.1.128');
    assert.equal(output(result, 'Broadcast').value, '192.168.1.191');
    assert.equal(output(result, 'Host range').value, '192.168.1.129 – 192.168.1.190');
    assert.equal(output(result, 'Usable hosts').display, '62');
    assert.equal(output(result, 'CIDR').value, '192.168.1.128/26');
    assert.equal(output(result, 'Subnet mask').value, '255.255.255.192');
    assert.equal(output(result, 'Wildcard mask').value, '0.0.0.63');
    assert.equal(output(result, 'Total addresses').display, '64');
  });

  it('handles /0 and /32 edge cases', () => {
    const all = subnet.calculate({ address: '10.20.30.40', prefix: 0 });
    assert.equal(output(all, 'Subnet mask').value, '0.0.0.0');
    assert.equal(output(all, 'Broadcast').value, '255.255.255.255');
    assert.equal(output(all, 'Usable hosts').display, '4,294,967,294');

    const single = subnet.calculate({ address: '10.20.30.40', prefix: 32 });
    assert.equal(output(single, 'Network').value, '10.20.30.40');
    assert.equal(output(single, 'Usable hosts').display, '1');
    assert.equal(output(single, 'Host range').value, '10.20.30.40 – 10.20.30.40');
  });

  it('handles RFC 3021 /31 links', () => {
    const result = subnet.calculate({ address: '10.0.0.1', prefix: 31 });
    assert.equal(output(result, 'Usable hosts').display, '2');
    assert.equal(output(result, 'Host range').value, '10.0.0.0 – 10.0.0.1');
  });

  it('rejects invalid addresses and prefixes', () => {
    assert.equal(subnet.calculate({ address: '192.168.1.256', prefix: 24 }).ok, false);
    assert.equal(subnet.calculate({ address: '192.168.1', prefix: 24 }).ok, false);
    assert.equal(subnet.calculate({ address: '192.168.1.1', prefix: 33 }).ok, false);
    assert.equal(subnet.calculate({ address: '192.168.1.1', prefix: 24.5 }).ok, false);
  });
});

describe('Fiber Loss Budget', () => {
  const base = {
    length: 2,
    attenuation: '0.35',
    connectors: 2,
    connectorLoss: 0.5,
    splices: 1,
    spliceLoss: 0.1,
    tx: 0,
    sensitivity: -20,
    safety: 3,
  };

  it('sums optical losses and reports remaining margin', () => {
    const result = fiber.calculate(base);
    assert.equal(result.ok, true);
    close(output(result, 'Fiber attenuation').value, 0.7);
    close(output(result, 'Connectors').value, 1);
    close(output(result, 'Splices').value, 0.1);
    close(output(result, 'Total optical loss').value, 1.8);
    close(output(result, 'Link budget').value, 20);
    close(output(result, 'Remaining margin').value, 18.2);
    close(output(result, 'Estimated RX power').value, -1.8);
    assert.equal(result.status.level, 'ok');
  });

  it('fails a link below the safety margin', () => {
    const result = fiber.calculate({
      ...base,
      length: 60,
      connectors: 6,
      splices: 8,
      tx: 0,
      sensitivity: -24,
      safety: 3,
    });
    assert.equal(result.status.level, 'bad');
  });

  it('supports loss-only mode', () => {
    const result = fiber.calculate({
      ...base,
      tx: null,
      sensitivity: null,
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, undefined);
    assert.equal(hasOutput(result, 'Remaining margin'), false);
  });

  it('requires TX and sensitivity together', () => {
    const result = fiber.calculate({ ...base, sensitivity: null });
    assert.equal(result.ok, false);
    assert.match(result.message, /both/i);
  });
});

describe('PoE Budget', () => {
  it('calculates demand, headroom and devices supported', () => {
    const result = poe.calculate({ budget: 370, draw: 12.9, count: 20, reserve: 20 });
    assert.equal(result.ok, true);
    close(output(result, 'Total demand').value, 258);
    close(output(result, 'Capacity after reserve').value, 296);
    close(output(result, 'Planned headroom').value, 38);
    close(output(result, 'Budget utilization').value, 69.7297, 1e-3);
    assert.equal(output(result, 'Devices supported').value, 22);
    assert.equal(result.status.level, 'ok');
  });

  it('warns when the plan eats the reserve', () => {
    const result = poe.calculate({ budget: 370, draw: 12.9, count: 24, reserve: 20 });
    assert.equal(result.status.level, 'warn');
  });

  it('fails when demand exceeds the switch budget', () => {
    const result = poe.calculate({ budget: 100, draw: 15, count: 10, reserve: 10 });
    assert.equal(result.status.level, 'bad');
  });

  it('validates whole device counts', () => {
    assert.equal(poe.calculate({ budget: 300, draw: 10, count: 2.5, reserve: 20 }).ok, false);
  });
});

describe('Airflow & CFM', () => {
  it('converts sensible kW and delta T to airflow', () => {
    const result = airflow.calculate({ capacity: 10, deltaT: 10 });
    assert.equal(result.ok, true);
    const [m3h, cfm, m3s, lps, btu] = result.outputs;
    close(m3h.value, 2985.07, 0.05);
    close(cfm.value, 1757.02, 0.1);
    close(m3s.value, 0.82919, 1e-4);
    close(lps.value, 829.19, 0.05);
    close(btu.value, 34121.42, 0.05);
  });

  it('requires positive values', () => {
    assert.equal(airflow.calculate({ capacity: 10, deltaT: 0 }).ok, false);
    assert.equal(airflow.calculate({ capacity: -1, deltaT: 10 }).ok, false);
  });
});

describe('Superheat & Subcooling', () => {
  it('calculates both readings and marks them in range', () => {
    const result = superheat.calculate({
      suctionLine: 12,
      suctionSat: 5,
      liquidLine: 38,
      liquidSat: 45,
    });
    assert.equal(result.ok, true);
    close(output(result, 'Superheat').value, 7);
    close(output(result, 'Subcooling').value, 7);
    assert.equal(output(result, 'Superheat').tone, 'ok');
    assert.equal(result.status.level, 'ok');
  });

  it('warns on out-of-range and negative readings', () => {
    const result = superheat.calculate({
      suctionLine: 2,
      suctionSat: 6,
      liquidLine: 44,
      liquidSat: 45,
    });
    assert.equal(output(result, 'Superheat').tone, 'warn');
    assert.equal(output(result, 'Subcooling').tone, 'warn');
    assert.equal(result.status.level, 'warn');
  });

  it('works with a single complete pair', () => {
    const result = superheat.calculate({ suctionLine: 12, suctionSat: 5 });
    assert.equal(hasOutput(result, 'Subcooling'), false);
    assert.equal(result.ok, true);
    assert.ok(result.notes.some((note) => /Subcooling was not calculated/.test(note)));
  });

  it('asks for a complete pair', () => {
    const result = superheat.calculate({ suctionLine: 12 });
    assert.equal(result.ok, false);
    assert.equal(result.tone, 'info');
  });
});

describe('RF Link Budget', () => {
  const base = {
    frequency: 2400,
    distance: 5,
    txPower: 20,
    txGain: 0,
    rxGain: 0,
    otherLoss: 0,
    sensitivity: -100,
    fadeMargin: 10,
  };

  it('calculates path loss, RX power and margin', () => {
    const result = rf.calculate(base);
    assert.equal(result.ok, true);
    close(output(result, 'Free-space path loss').value, 114.023, 0.001);
    close(output(result, 'Received power').value, -94.023, 0.001);
    close(output(result, 'Link margin').value, 5.977, 0.001);
    close(output(result, 'Max distance at margin').value, 3.146, 0.01);
    assert.equal(result.status.level, 'bad');
  });

  it('passes with extra antenna gain', () => {
    const result = rf.calculate({ ...base, txGain: 6, rxGain: 6 });
    assert.equal(result.status.level, 'ok');
  });

  it('validates negative losses', () => {
    assert.equal(rf.calculate({ ...base, otherLoss: -1 }).ok, false);
    assert.equal(rf.calculate({ ...base, frequency: 0 }).ok, false);
  });
});

describe('Torque Converter', () => {
  it('converts 100 N·m into every supported unit', () => {
    const result = torque.calculate({ value: 100, unit: 'nm' });
    assert.equal(result.ok, true);
    close(output(result, 'Foot-pound').value, 73.7562, 1e-3);
    close(output(result, 'Inch-pound').value, 885.0746, 1e-3);
    close(output(result, 'Kilogram-force metre').value, 10.1972, 1e-3);
    close(output(result, 'Kilogram-force centimetre').value, 1019.7162, 1e-3);
  });

  it('converts back from foot-pounds', () => {
    const result = torque.calculate({ value: 73.7562, unit: 'ftlb' });
    close(output(result, 'Newton-metre').value, 100, 1e-3);
  });

  it('accepts zero and rejects negatives', () => {
    assert.equal(torque.calculate({ value: 0, unit: 'nm' }).ok, true);
    assert.equal(torque.calculate({ value: -5, unit: 'nm' }).ok, false);
  });
});
