import { WaveDefaults } from './constants.js';
import { EARLY_WAVE_RECIPES } from './wave-recipes/early.js';
import { MIDDLE_WAVE_RECIPES } from './wave-recipes/middle.js';
import { getEndlessWaveRecipe } from './wave-recipes/endless.js';

export const WaveLimits = Object.freeze({
  formationSpeed: WaveDefaults.baseSpeed * 1.65,
  projectileSpeed: 400,
  minimumFireInterval: 0.55,
  minimumDiveCadence: 2.8,
  maxDivers: 3,
  enemyProjectiles: 12,
  totalProjectiles: 40,
});

export const ThreatCosts = Object.freeze({ scout: 1, wasp: 2, sentinel: 4, diver: 3 });

/** Specific cells override row defaults, keeping elite debuts sparse and deliberate. */
export function getEnemyKindForSlot(enemyMix, row, column) {
  const cellEntry = enemyMix.find((entry) => (
    entry.rows.includes(row) && entry.columns?.includes(column)
  ));
  const rowEntry = enemyMix.find((entry) => entry.rows.includes(row) && !entry.columns);

  return cellEntry?.kind ?? rowEntry?.kind ?? 'scout';
}

export function getEnemyKindForRow(enemyMix, row) {
  return getEnemyKindForSlot(enemyMix, row, undefined);
}

export function calculateWaveThreat(recipe) {
  let threat = recipe.maxDivers * ThreatCosts.diver;

  for (let row = 0; row < recipe.formation.rows; row += 1) {
    for (let column = 0; column < recipe.formation.columns; column += 1) {
      const kind = getEnemyKindForSlot(recipe.enemyMix, row, column);
      threat += ThreatCosts[kind];
    }
  }

  return threat;
}

/** A stable seed rotates late recipes independently of combat RNG consumption. */
export function getWaveDefinition(waveNumber, seed = 0) {
  const number = Number.isSafeInteger(waveNumber) && waveNumber > 0 ? waveNumber : 1;
  const authoredRecipes = [...EARLY_WAVE_RECIPES, ...MIDDLE_WAVE_RECIPES];
  const source = number <= authoredRecipes.length
    ? authoredRecipes[number - 1]
    : getEndlessWaveRecipe(number, seed);
  const recipe = structuredClone(source);

  recipe.number = number;
  recipe.movement.speed = Math.min(recipe.movement.speed, WaveLimits.formationSpeed);
  recipe.firing.projectileSpeed = Math.min(recipe.firing.projectileSpeed, WaveLimits.projectileSpeed);
  recipe.firing.interval = Math.max(recipe.firing.interval, WaveLimits.minimumFireInterval);
  recipe.firing.maxProjectiles = Math.min(recipe.firing.maxProjectiles, WaveLimits.enemyProjectiles);
  recipe.maxDivers = Math.min(recipe.maxDivers, WaveLimits.maxDivers);

  if (recipe.diveCadence !== null) {
    recipe.diveCadence = Math.max(recipe.diveCadence, WaveLimits.minimumDiveCadence);
  }

  recipe.threatCost = calculateWaveThreat(recipe);

  // Fail authored over-budget combinations instead of silently changing their composition.
  if (!Number.isFinite(recipe.threatCost) || recipe.threatCost > recipe.threatBudget) {
    throw new RangeError(`Wave ${number} exceeds its threat budget.`);
  }

  return recipe;
}
