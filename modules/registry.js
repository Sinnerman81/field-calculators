import * as ohmsLaw from './ohms-law.js';
import * as voltageDrop from './voltage-drop.js';
import * as conduitBend from './conduit-bend.js';
import * as batteryRuntime from './battery-runtime.js';
import * as subnet from './subnet.js';
import * as fiberLoss from './fiber-loss.js';
import * as poeBudget from './poe-budget.js';
import * as airflow from './airflow.js';
import * as superheatSubcooling from './superheat-subcooling.js';
import * as rfLink from './rf-link.js';
import * as torque from './torque.js';

/**
 * Dashboard order is intentional: high-frequency field jobs first, then
 * networking, HVAC and general tools.
 */
export const modules = [
  ohmsLaw,
  voltageDrop,
  conduitBend,
  batteryRuntime,
  subnet,
  fiberLoss,
  poeBudget,
  airflow,
  superheatSubcooling,
  rfLink,
  torque,
];

const byId = new Map(modules.map((module) => [module.meta.id, module]));

export function getModule(id) {
  return byId.get(id);
}

export const categories = ['All', ...new Set(modules.map((module) => module.meta.category))];
