import * as hydraulicLoad from './hydraulic-load.js';
import * as tankVolumes from './tank-volumes.js';
import * as pressureDistribution from './pressure-distribution.js';
import * as dripOscar from './drip-oscar.js';

/** Dashboard order: measured flow, tank volume, distribution, then drip design. */
export const modules = [hydraulicLoad, tankVolumes, pressureDistribution, dripOscar];

const byId = new Map(modules.map((module) => [module.meta.id, module]));

export function getModule(id) {
  return byId.get(id);
}

export const categories = ['All', ...new Set(modules.map((module) => module.meta.category))];
