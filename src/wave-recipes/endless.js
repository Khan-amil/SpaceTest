import { WaveDefaults } from '../constants.js';

const ENDLESS_RECIPES = Object.freeze([
  {
    id: 'crossfire',
    hint: 'Watch the crossing fire lanes.',
    formation: { columns: 7, rows: 3, spacingX: 72, spacingY: 49, startY: 106 },
    waspRows: [1],
    sentinelSlots: [[0, 2], [0, 4]],
    pattern: 'alternating-lanes',
  },
  {
    id: 'wide-sweep',
    hint: 'A wide formation leaves room to move.',
    formation: { columns: 6, rows: 3, spacingX: 86, spacingY: 51, startY: 105 },
    waspRows: [0, 2],
    sentinelSlots: [[0, 2]],
    pattern: 'random',
  },
  {
    id: 'center-guard',
    hint: 'Break through the guarded center.',
    formation: { columns: 7, rows: 3, spacingX: 70, spacingY: 50, startY: 108 },
    waspRows: [1],
    sentinelSlots: [[0, 3], [0, 4]],
    pattern: 'alternating-lanes',
  },
  {
    id: 'staggered-wings',
    hint: 'Watch the Wasps for dive warnings.',
    formation: { columns: 7, rows: 3, spacingX: 73, spacingY: 48, startY: 111 },
    waspRows: [0, 2],
    sentinelSlots: [[0, 3], [0, 4]],
    pattern: 'random',
  },
  {
    id: 'narrow-gate',
    hint: 'Use the gaps in the narrow gate.',
    formation: { columns: 5, rows: 3, spacingX: 96, spacingY: 52, startY: 104 },
    waspRows: [1],
    sentinelSlots: [[0, 1]],
    pattern: 'alternating-lanes',
  },
  {
    id: 'double-flank',
    hint: 'Clear the flanks before they close in.',
    formation: { columns: 7, rows: 3, spacingX: 71, spacingY: 52, startY: 103 },
    waspRows: [0, 2],
    sentinelSlots: [[0, 1], [0, 5]],
    pattern: 'alternating-lanes',
  },
  {
    id: 'deep-formation',
    hint: 'Leave space below the diving formation.',
    formation: { columns: 6, rows: 3, spacingX: 84, spacingY: 50, startY: 115 },
    waspRows: [1],
    sentinelSlots: [[0, 2], [0, 3]],
    pattern: 'random',
  },
  {
    id: 'lane-switch',
    hint: 'Enemy fire switches lanes.',
    formation: { columns: 7, rows: 3, spacingX: 74, spacingY: 51, startY: 105 },
    waspRows: [1, 2],
    sentinelSlots: [[0, 3]],
    pattern: 'alternating-lanes',
  },
  {
    id: 'sentinel-pair',
    hint: 'Focus the armored rear pair.',
    formation: { columns: 6, rows: 3, spacingX: 83, spacingY: 53, startY: 102 },
    waspRows: [1],
    sentinelSlots: [[0, 1], [0, 4]],
    pattern: 'random',
  },
  {
    id: 'last-opening',
    hint: 'Keep moving through the changing lanes.',
    formation: { columns: 7, rows: 3, spacingX: 69, spacingY: 49, startY: 109 },
    waspRows: [1, 2],
    sentinelSlots: [[0, 2], [0, 5]],
    pattern: 'alternating-lanes',
  },
]);

const THREAT_COST = Object.freeze({ scout: 1, wasp: 2, sentinel: 4 });
const MAX_CHAOS_MULTIPLIER = 1.65;
const MAX_BULLET_SPEED = 400;
const MIN_FIRE_INTERVAL = 0.55;
const MIN_DIVE_CADENCE = 2.8;
const MAX_ENEMY_PROJECTILES = 12;

function normalizeWaveNumber(waveNumber) {
  return Number.isSafeInteger(waveNumber) && waveNumber >= 10 ? waveNumber : 10;
}

function hashSeed(seed) {
  const text = String(seed);
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildEnemyMix(recipe) {
  const enemyMix = [];

  // Column-specific elite slots are checked before row-wide fallbacks by the wave resolver.
  for (const [row, column] of recipe.sentinelSlots) {
    enemyMix.push({ kind: 'sentinel', rows: [row], columns: [column] });
  }

  for (const row of recipe.waspRows) {
    enemyMix.push({ kind: 'wasp', rows: [row] });
  }

  enemyMix.push({ kind: 'scout', rows: [0, 1, 2] });
  return enemyMix;
}

function countThreat(recipe, enemyMix) {
  const { columns, rows } = recipe.formation;
  let threat = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const specificEntry = enemyMix.find((entry) => (
        entry.columns?.includes(column) && entry.rows.includes(row)
      ));
      const rowEntry = enemyMix.find((entry) => (
        !entry.columns && entry.rows.includes(row)
      ));
      threat += THREAT_COST[specificEntry?.kind ?? rowEntry?.kind ?? 'scout'];
    }
  }

  return threat;
}

/** Return a fresh bounded remix recipe for an endless wave (wave 10 and later). */
export function getEndlessWaveRecipe(waveNumber, seed = 0) {
  const number = normalizeWaveNumber(waveNumber);
  const recipeOffset = hashSeed(seed) % ENDLESS_RECIPES.length;
  const waveOffset = (number - 10) % ENDLESS_RECIPES.length;
  const sourceRecipe = ENDLESS_RECIPES[(recipeOffset + waveOffset) % ENDLESS_RECIPES.length];
  const formation = { ...sourceRecipe.formation };
  const enemyMix = buildEnemyMix(sourceRecipe);
  const maxDivers = 3;
  const threatBudget = 50 + Math.min(number - 10, 10) * 2;
  const chaosMultiplier = MAX_CHAOS_MULTIPLIER;
  const firingInterval = Math.max(
    MIN_FIRE_INTERVAL,
    0.8 - 0.025 * (number - 10),
  );
  const projectileSpeed = Math.min(330 + (number - 10) * 8, MAX_BULLET_SPEED);
  const diveCadence = Math.max(MIN_DIVE_CADENCE, 4.4 - (number - 10) * 0.12);
  const clearBonus = 700 + Math.min(number - 10, 20) * 25;
  const noDamageBonus = 150 + Math.min(number - 10, 20) * 5;
  const recipeThreat = countThreat(sourceRecipe, enemyMix) + maxDivers * 3;

  // Keep authored formations under the wave's budget, even at the first remix.
  if (recipeThreat > threatBudget) {
    throw new Error(`Endless recipe ${sourceRecipe.id} exceeds threat budget`);
  }

  return {
    id: sourceRecipe.id,
    band: 'remix',
    hint: sourceRecipe.hint,
    formation,
    enemyMix,
    movement: {
      speed: WaveDefaults.baseSpeed * chaosMultiplier,
      dropDistance: WaveDefaults.dropDistance,
    },
    firing: {
      initialDelay: 0.8,
      interval: firingInterval,
      projectileSpeed,
      pattern: sourceRecipe.pattern,
      maxProjectiles: Math.min(8 + Math.floor((number - 10) / 3), MAX_ENEMY_PROJECTILES),
    },
    diveCadence,
    maxDivers,
    clearBonus,
    noDamageBonus,
    threatBudget,
  };
}

export const ENDLESS_RECIPE_IDS = Object.freeze(ENDLESS_RECIPES.map((recipe) => recipe.id));
