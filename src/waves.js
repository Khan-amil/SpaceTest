import { WaveDefaults } from './constants.js';

const SCOUT_ROWS = Object.freeze([0, 1, 2]);

// Small formation variations exercise the recipe seam without introducing Phase 2 enemies.
const FORMATION_RECIPES = Object.freeze([
  { columns: 7, rows: 3, spacingX: 75, spacingY: 53, startY: 105 },
  { columns: 6, rows: 3, spacingX: 85, spacingY: 53, startY: 105 },
  { columns: 7, rows: 3, spacingX: 70, spacingY: 48, startY: 110 },
]);

/**
 * Returns the complete recipe for a wave. The current game only has Scouts, but the
 * row-based mix allows later archetypes to be introduced without changing spawning.
 */
export function getWaveDefinition(waveNumber) {
  const number = Number.isSafeInteger(waveNumber) && waveNumber > 0 ? waveNumber : 1;
  const difficultyOffset = number - 1;
  const formation = FORMATION_RECIPES[difficultyOffset % FORMATION_RECIPES.length];

  return {
    number,
    formation: { ...formation },
    enemyMix: [
      {
        kind: 'scout',
        rows: SCOUT_ROWS,
      },
    ],
    movement: {
      speed: WaveDefaults.baseSpeed + difficultyOffset * 8,
      dropDistance: WaveDefaults.dropDistance,
    },
    firing: {
      initialDelay: 0.65,
      interval: Math.max(0.35, WaveDefaults.fireInterval - number * 0.07),
      projectileSpeed: 260 + number * 15,
    },
    // Phase 2 consumes this field when formation-breaking behavior is introduced.
    diveCadence: null,
    clearBonus: 250 + difficultyOffset * 50,
  };
}

export function getEnemyKindForRow(enemyMix, row) {
  const entry = enemyMix.find((candidate) => candidate.rows.includes(row));

  return entry?.kind ?? 'scout';
}
