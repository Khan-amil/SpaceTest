import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveDefaults } from '../src/constants.js';
import { MIDDLE_WAVE_RECIPES } from '../src/wave-recipes/middle.js';

const ENEMY_COST = Object.freeze({ scout: 1, wasp: 2, sentinel: 4 });
const DIVE_RESERVATION = 3;

function countKinds(recipe) {
  const counts = { scout: 0, wasp: 0, sentinel: 0 };

  for (let row = 0; row < recipe.formation.rows; row += 1) {
    for (let column = 0; column < recipe.formation.columns; column += 1) {
      const entry = recipe.enemyMix.find((candidate) => (
        candidate.rows.includes(row)
        && (!candidate.columns || candidate.columns.includes(column))
      ));
      counts[entry?.kind ?? 'scout'] += 1;
    }
  }

  return counts;
}

test('middle wave recipes cover waves 5 through 9 in two deliberate pressure bands', () => {
  assert.equal(MIDDLE_WAVE_RECIPES.length, 5);
  assert.deepEqual(MIDDLE_WAVE_RECIPES.map((recipe) => recipe.id), [
    'wave-5', 'wave-6', 'wave-7', 'wave-8', 'wave-9',
  ]);
  assert.deepEqual(MIDDLE_WAVE_RECIPES.map((recipe) => recipe.band), [
    'curves', 'curves', 'crossfire', 'crossfire', 'crossfire',
  ]);
  assert.ok(MIDDLE_WAVE_RECIPES.every((recipe) => recipe.hint.length > 0));
});

test('speed uses the shared baseline and stays within each planned difficulty band', () => {
  const expectedMultipliers = [1.25, 1.4, 1.45, 1.5, 1.6];

  MIDDLE_WAVE_RECIPES.forEach((recipe, index) => {
    assert.equal(recipe.movement.speed, WaveDefaults.baseSpeed * expectedMultipliers[index]);
    assert.equal(recipe.movement.dropDistance, WaveDefaults.dropDistance);
    assert.equal(recipe.diveCadence > 0, true);
    assert.equal(recipe.maxDivers, 2);
  });
});

test('Sentinels appear only in a small number of safe rear-row slots', () => {
  const firstRecipe = MIDDLE_WAVE_RECIPES[0];
  const firstSentinelEntry = firstRecipe.enemyMix.find((entry) => entry.kind === 'sentinel');

  assert.deepEqual(firstSentinelEntry.rows, [0]);
  assert.deepEqual(firstSentinelEntry.columns, [3]);

  for (const recipe of MIDDLE_WAVE_RECIPES) {
    const counts = countKinds(recipe);

    assert.ok(counts.sentinel <= 2, `${recipe.id} has too many Sentinels`);
  }

  assert.equal(countKinds(firstRecipe).sentinel, 1);
  assert.equal(countKinds(MIDDLE_WAVE_RECIPES[4]).sentinel, 2);
});

test('threat budgets cover enemy and reserved dive costs and rise across the band', () => {
  let previousBudget = 0;

  for (const recipe of MIDDLE_WAVE_RECIPES) {
    const counts = countKinds(recipe);
    const enemyThreat = Object.entries(counts).reduce((total, [kind, count]) => (
      total + ENEMY_COST[kind] * count
    ), 0);
    const totalThreat = enemyThreat + DIVE_RESERVATION * recipe.maxDivers;

    assert.ok(recipe.threatBudget >= totalThreat, `${recipe.id} budget is too small`);
    assert.ok(recipe.threatBudget > previousBudget, `${recipe.id} budget should rise`);
    previousBudget = recipe.threatBudget;
  }
});

test('firing pressure is bounded and introduces alternating lanes at wave 7', () => {
  const expectedIntervals = [1.4, 1.2, 1.05, 0.95, 0.85];
  const expectedProjectileSpeeds = [230, 250, 270, 290, 310];
  const expectedProjectileCaps = [7, 8, 9, 10, 10];

  MIDDLE_WAVE_RECIPES.forEach((recipe, index) => {
    assert.ok(recipe.firing.interval >= 0.35);
    assert.ok(recipe.firing.projectileSpeed <= 420);
    assert.ok(recipe.firing.maxProjectiles <= 12);
    assert.ok(recipe.firing.maxProjectiles > 0);
    assert.equal(recipe.firing.interval, expectedIntervals[index]);
    assert.equal(recipe.firing.projectileSpeed, expectedProjectileSpeeds[index]);
    assert.equal(recipe.firing.maxProjectiles, expectedProjectileCaps[index]);
    assert.ok(recipe.noDamageBonus >= 90 && recipe.noDamageBonus <= 130);
    assert.equal(
      recipe.firing.pattern,
      recipe.id === 'wave-5' || recipe.id === 'wave-6' ? 'random' : 'alternating-lanes',
    );
  });
});
