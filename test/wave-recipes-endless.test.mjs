import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveDefaults } from '../src/constants.js';
import { ENDLESS_RECIPE_IDS, getEndlessWaveRecipe } from '../src/wave-recipes/endless.js';

function resolvedKind(recipe, row, column) {
  const specificEntry = recipe.enemyMix.find((entry) => (
    entry.columns?.includes(column) && entry.rows.includes(row)
  ));
  const rowEntry = recipe.enemyMix.find((entry) => (
    !entry.columns && entry.rows.includes(row)
  ));

  return specificEntry?.kind ?? rowEntry?.kind ?? 'scout';
}

function countRecipeThreat(recipe) {
  const threatCost = { scout: 1, wasp: 2, sentinel: 4 };
  let threat = recipe.maxDivers * 3;

  for (let row = 0; row < recipe.formation.rows; row += 1) {
    for (let column = 0; column < recipe.formation.columns; column += 1) {
      threat += threatCost[resolvedKind(recipe, row, column)];
    }
  }

  return threat;
}

test('endless recipes provide ten distinct named remix layouts', () => {
  assert.equal(ENDLESS_RECIPE_IDS.length, 10);
  assert.equal(new Set(ENDLESS_RECIPE_IDS).size, 10);

  const firstCycle = Array.from({ length: 10 }, (_, offset) => (
    getEndlessWaveRecipe(10 + offset, 23).id
  ));
  assert.deepEqual(new Set(firstCycle), new Set(ENDLESS_RECIPE_IDS));
});

test('recipe selection is deterministic, rotates each wave, and shifts with its seed', () => {
  assert.deepEqual(getEndlessWaveRecipe(13, 'run-a'), getEndlessWaveRecipe(13, 'run-a'));
  assert.notEqual(getEndlessWaveRecipe(10, 0).id, getEndlessWaveRecipe(10, 1).id);

  const nextWaveIds = Array.from({ length: 10 }, (_, offset) => (
    getEndlessWaveRecipe(10 + offset, 0).id
  ));
  assert.equal(new Set(nextWaveIds).size, 10);
});

test('recipes are fresh plain data and column-specific enemies override row fallbacks', () => {
  const recipe = getEndlessWaveRecipe(10, 0);
  const sentinel = recipe.enemyMix.find((entry) => entry.kind === 'sentinel');
  const originalColumns = recipe.formation.columns;

  assert.equal(resolvedKind(recipe, sentinel.rows[0], sentinel.columns[0]), 'sentinel');
  recipe.formation.columns = 1;
  recipe.enemyMix[0].columns[0] = 99;

  const freshRecipe = getEndlessWaveRecipe(10, 0);
  assert.equal(freshRecipe.formation.columns, originalColumns);
  assert.notEqual(freshRecipe.enemyMix[0].columns[0], 99);
});

test('endless recipes stay within formation, threat, and chaos limits through extreme waves', () => {
  const firstRemix = getEndlessWaveRecipe(10);

  assert.equal(firstRemix.movement.speed, WaveDefaults.baseSpeed * 1.65);
  assert.equal(firstRemix.firing.interval, 0.8);
  assert.equal(firstRemix.firing.projectileSpeed, 330);
  assert.equal(firstRemix.noDamageBonus, 150);

  for (const waveNumber of [10, 11, 20, 100, Number.MAX_SAFE_INTEGER]) {
    const recipe = getEndlessWaveRecipe(waveNumber, 3819);
    const multiplier = recipe.movement.speed / WaveDefaults.baseSpeed;

    assert.ok(recipe.formation.rows <= 3);
    assert.ok(recipe.formation.columns <= 7);
    assert.ok(recipe.formation.rows > 0);
    assert.ok(recipe.formation.columns > 0);
    assert.ok(recipe.movement.speed <= WaveDefaults.baseSpeed * 1.65);
    assert.equal(multiplier, 1.65);
    assert.ok(recipe.firing.projectileSpeed <= 400);
    assert.ok(recipe.firing.interval >= 0.55);
    assert.ok(recipe.firing.maxProjectiles <= 12);
    assert.ok(recipe.diveCadence >= 2.8);
    assert.ok(recipe.maxDivers <= 3);
    assert.ok(recipe.threatBudget >= countRecipeThreat(recipe));
    assert.ok(recipe.clearBonus > 0);
    assert.ok(recipe.noDamageBonus > 0);
    assert.ok(recipe.firing.interval <= 0.8);
  }
});

test('all recipes fit the first remix threat budget including reserved divers', () => {
  for (let seed = 0; seed < ENDLESS_RECIPE_IDS.length; seed += 1) {
    const recipe = getEndlessWaveRecipe(10, seed);

    assert.equal(recipe.band, 'remix');
    assert.ok(recipe.hint.length > 0);
    assert.ok(countRecipeThreat(recipe) <= 50);
  }
});
