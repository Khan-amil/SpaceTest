import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveDefaults } from '../src/constants.js';
import { EARLY_WAVE_RECIPES } from '../src/wave-recipes/early.js';

const ENEMY_COSTS = { scout: 1, wasp: 2, sentinel: 4 };

function getRecipeThreatCost(recipe) {
  let enemyCost = 0;

  for (let row = 0; row < recipe.formation.rows; row += 1) {
    for (let column = 0; column < recipe.formation.columns; column += 1) {
      const matchingEntries = recipe.enemyMix.filter((entry) => (
        entry.rows.includes(row)
        && (!entry.columns || entry.columns.includes(column))
      ));
      const selectedEntry = matchingEntries.find((entry) => entry.columns)
        ?? matchingEntries[0];

      assert.ok(selectedEntry, `row ${row}, column ${column} has an enemy kind`);
      enemyCost += ENEMY_COSTS[selectedEntry.kind];
    }
  }

  return enemyCost + recipe.maxDivers * 3;
}

test('early recipes are fixed, complete, and preserve the original first formation', () => {
  assert.equal(EARLY_WAVE_RECIPES.length, 4);
  assert.deepEqual(EARLY_WAVE_RECIPES.map(({ id }) => id), [
    'wave-1',
    'wave-2',
    'wave-3',
    'wave-4',
  ]);
  assert.deepEqual(EARLY_WAVE_RECIPES[0].formation, {
    columns: 7,
    rows: 3,
    spacingX: 75,
    spacingY: 53,
    startY: 105,
  });

  for (const recipe of EARLY_WAVE_RECIPES) {
    assert.equal(typeof recipe.hint, 'string');
    assert.ok(recipe.hint.length > 0);
    assert.equal(recipe.firing.pattern, 'random');
    assert.ok(recipe.firing.maxProjectiles > 0);
    assert.ok(recipe.noDamageBonus > 0);
    assert.ok(recipe.threatBudget >= getRecipeThreatCost(recipe));
  }
});

test('the first two waves train movement before the rear-row Wasp debut', () => {
  const [first, second, third, fourth] = EARLY_WAVE_RECIPES;

  assert.equal(first.band, 'training');
  assert.equal(second.band, 'training');
  assert.equal(first.movement.speed, WaveDefaults.baseSpeed * 0.8);
  assert.equal(second.movement.speed, WaveDefaults.baseSpeed);
  assert.equal(first.diveCadence, null);
  assert.equal(second.diveCadence, null);
  assert.equal(first.maxDivers, 0);
  assert.equal(second.maxDivers, 0);
  assert.deepEqual(first.enemyMix, [{ kind: 'scout', rows: [0, 1, 2] }]);
  assert.deepEqual(second.enemyMix, [{ kind: 'scout', rows: [0, 1, 2] }]);

  for (const recipe of [third, fourth]) {
    assert.equal(recipe.band, 'telegraphs');
    assert.equal(recipe.enemyMix[1].kind, 'wasp');
    assert.deepEqual(recipe.enemyMix[1].rows, [0]);
    assert.deepEqual(recipe.enemyMix[1].columns, [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(recipe.maxDivers, 1);
    assert.ok(recipe.diveCadence > 0);
  }

  assert.equal(third.movement.speed, WaveDefaults.baseSpeed * 1.05);
  assert.equal(fourth.movement.speed, WaveDefaults.baseSpeed * 1.2);
  assert.ok(first.firing.interval > second.firing.interval);
  assert.ok(second.firing.interval > third.firing.interval);
  assert.ok(third.firing.interval > fourth.firing.interval);
  assert.ok(first.threatBudget < second.threatBudget);
  assert.ok(second.threatBudget < third.threatBudget);
  assert.ok(third.threatBudget < fourth.threatBudget);
});

test('recipe content is stable across repeated reads', () => {
  const firstRead = structuredClone(EARLY_WAVE_RECIPES);
  const secondRead = structuredClone(EARLY_WAVE_RECIPES);

  assert.deepEqual(firstRead, secondRead);
});
