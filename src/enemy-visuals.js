import { drawScout } from './enemies/scout.js';
import { drawWasp } from './enemies/wasp.js';
import { drawSentinel } from './enemies/sentinel.js';

// Visual dispatch stays separate from the pure archetype data used by the simulation.
export const enemyVisuals = Object.freeze({
  scout: drawScout,
  wasp: drawWasp,
  sentinel: drawSentinel,
});
