import { WaveDefaults } from './constants.js';

// Layout variation stays small; authored difficulty bands belong to Phase 4.
const FORMATION_RECIPES = Object.freeze([
  { columns: 7, rows: 3, spacingX: 75, spacingY: 53, startY: 105 },
  { columns: 6, rows: 3, spacingX: 85, spacingY: 53, startY: 105 },
  { columns: 7, rows: 3, spacingX: 70, spacingY: 48, startY: 110 },
]);

/**
 * Introduce silhouettes gradually: Scouts first, Wasps at wave 3, Sentinels at wave 5.
 */
export function getWaveDefinition(waveNumber) {
  const number = Number.isSafeInteger(waveNumber) && waveNumber > 0 ? waveNumber : 1;
  const difficultyOffset = number - 1;
  const formation = FORMATION_RECIPES[difficultyOffset % FORMATION_RECIPES.length];

  return {
    number,
    formation: { ...formation },
    enemyMix: number < 3
      ? [{ kind: 'scout', rows: [0, 1, 2] }]
      : [
        { kind: number >= 5 ? 'sentinel' : 'scout', rows: [0] },
        { kind: 'wasp', rows: [1] },
        { kind: 'scout', rows: [2] },
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
    diveCadence: number < 3 ? null : 5,
    maxDivers: number < 3 ? 0 : 1,
    clearBonus: 250 + difficultyOffset * 50,
  };
}

export function getEnemyKindForRow(enemyMix, row) {
  const entry = enemyMix.find((candidate) => candidate.rows.includes(row));

  return entry?.kind ?? 'scout';
}
