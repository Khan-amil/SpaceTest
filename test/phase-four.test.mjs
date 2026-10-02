import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { GameEvent, GameState, WaveDefaults } from '../src/constants.js';
import { createProjectile } from '../src/entities.js';
import { selectFormationShooter } from '../src/enemy-fire.js';
import { WaveLimits, calculateWaveThreat, getWaveDefinition } from '../src/waves.js';

const idle = { isDown: () => false };
const STEP = 1 / 120;

function playingWave(number = 1, seed = 0) {
  const game = new Game(() => 0.5, getWaveDefinition, seed);
  game.start();
  game.wave = number;
  game.spawnWave();
  game.beginWaveIntro();
  game.update(WaveDefaults.introDuration, idle);
  game.consumeEvents();
  return game;
}

test('authored bands introduce and combine pressures with safe type debuts', () => {
  const expectedBands = ['training', 'training', 'telegraphs', 'telegraphs',
    'curves', 'curves', 'crossfire', 'crossfire', 'crossfire', 'remix'];

  for (let number = 1; number <= 10; number += 1) {
    const game = playingWave(number);
    assert.equal(game.waveDefinition.band, expectedBands[number - 1]);
    assert.ok(game.waveDefinition.hint.length > 0);

    if (number <= 2) {
      assert.ok(game.enemies.every((enemy) => enemy.kind === 'scout'));
      assert.equal(game.waveDefinition.maxDivers, 0);
      assert.equal(game.beginDive(game.enemies[0]), false);
    }
  }

  for (let number = 2; number <= 10; number += 1) {
    assert.ok(getWaveDefinition(number).movement.speed >= getWaveDefinition(number - 1).movement.speed);
    assert.ok(getWaveDefinition(number).firing.projectileSpeed >= getWaveDefinition(number - 1).firing.projectileSpeed);
    assert.ok(getWaveDefinition(number).firing.interval <= getWaveDefinition(number - 1).firing.interval);
  }

  const waspDebut = playingWave(3).enemies.filter((enemy) => enemy.kind === 'wasp');
  assert.equal(waspDebut.length, getWaveDefinition(3).formation.columns);
  assert.ok(waspDebut.every((enemy) => enemy.home.y === getWaveDefinition(3).formation.startY));
  const sentinelDebut = playingWave(5).enemies.filter((enemy) => enemy.kind === 'sentinel');
  assert.ok(sentinelDebut.length >= 1 && sentinelDebut.length <= 2);
  assert.ok(sentinelDebut.every((enemy) => enemy.home.y === getWaveDefinition(5).formation.startY));
});

test('recipes stay within threat and chaos limits through very late waves', () => {
  let previousBudget = 0;

  for (const number of [...Array.from({ length: 100 }, (_, index) => index + 1), Number.MAX_SAFE_INTEGER]) {
    const recipe = getWaveDefinition(number, 42);
    assert.equal(recipe.threatCost, calculateWaveThreat(recipe));
    assert.ok(recipe.threatCost <= recipe.threatBudget);
    assert.ok(recipe.threatBudget >= previousBudget);
    previousBudget = recipe.threatBudget;
    assert.ok(recipe.movement.speed <= WaveLimits.formationSpeed);
    assert.ok(recipe.firing.projectileSpeed <= WaveLimits.projectileSpeed);
    assert.ok(recipe.firing.interval >= WaveLimits.minimumFireInterval);
    assert.ok(recipe.firing.maxProjectiles <= WaveLimits.enemyProjectiles);
    assert.ok(recipe.maxDivers <= WaveLimits.maxDivers);
    assert.ok(recipe.diveCadence === null || recipe.diveCadence >= WaveLimits.minimumDiveCadence);
    assert.ok(recipe.formation.rows <= 3 && recipe.formation.columns <= 7);
  }
});

test('seeded remix rotation is repeatable and recipes are isolated copies', () => {
  const recipes = [10, 11, 12].map((number) => getWaveDefinition(number, 42));
  assert.equal(new Set(recipes.map((recipe) => recipe.id)).size, 3);
  assert.deepEqual(getWaveDefinition(10, 42), recipes[0]);
  assert.notEqual(getWaveDefinition(10, 43).id, recipes[0].id);
  recipes[0].formation.columns = 99;
  recipes[0].enemyMix[0].rows.push(99);
  assert.ok(getWaveDefinition(10, 42).formation.columns <= 7);
  assert.ok(!getWaveDefinition(10, 42).enemyMix[0].rows.includes(99));
  for (const invalid of [0, -1, NaN, Infinity, 1.5]) {
    assert.deepEqual(getWaveDefinition(invalid), getWaveDefinition(1));
  }
});

test('crossfire alternates formation halves and handles the last surviving ship', () => {
  const game = playingWave(7);
  const leftX = Math.min(...game.enemies.map((enemy) => enemy.x));
  const rightX = Math.max(...game.enemies.map((enemy) => enemy.x));
  const midpoint = (leftX + rightX) / 2;
  game.fireEnemyProjectile(game.enemies);
  game.fireEnemyProjectile(game.enemies);
  assert.ok(game.projectiles[0].x <= midpoint);
  assert.ok(game.projectiles[1].x > midpoint);
  const survivor = game.enemies[0];
  assert.equal(selectFormationShooter([survivor], 'alternating-lanes', 'right', () => 0), survivor);
  assert.equal(selectFormationShooter([], 'alternating-lanes', 'left', () => 0), null);
});

test('formation and aimed shots share a cap and resume without a backlog', () => {
  const game = playingWave(10);
  const cap = game.waveDefinition.firing.maxProjectiles;
  for (let index = 0; index < cap; index += 1) {
    game.projectiles.push(createProjectile(100, 100, 0, 'enemy'));
  }
  const wasp = game.enemies.find((enemy) => enemy.kind === 'wasp');
  assert.equal(game.fireEnemyProjectile(game.enemies), false);
  assert.equal(game.enemyFireTimer, game.waveDefinition.firing.interval);
  assert.equal(game.fireAimedEnemyProjectile(wasp), false);
  assert.equal(game.projectiles.length, cap);
  game.projectiles[0].alive = false;
  assert.equal(game.fireAimedEnemyProjectile(wasp), true);
  assert.equal(game.canCreateProjectile('enemy'), false);
  game.projectiles = Array.from({ length: WaveLimits.totalProjectiles }, () => (
    createProjectile(100, 100, 0, 'player')
  ));
  game.firePlayerProjectile();
  assert.equal(game.projectiles.length, WaveLimits.totalProjectiles);
  assert.equal(game.statistics.shotsFired, 0);
});

test('no-damage mastery reward is once-only and resets at wave and run boundaries', () => {
  const game = playingWave();
  game.enemies.forEach((enemy) => { enemy.alive = false; });
  game.update(STEP, idle);
  const event = game.consumeEvents().find((entry) => entry.type === GameEvent.WAVE_CLEARED);
  assert.equal(event.noDamageBonus, game.waveDefinition.noDamageBonus);
  assert.equal(event.bonus, event.clearBonus + event.noDamageBonus);
  const score = game.score;
  game.advanceWaveWhenCleared();
  assert.equal(game.score, score);
  game.update(WaveDefaults.clearDuration, idle);
  game.update(WaveDefaults.introDuration, idle);
  game.damagePlayer('contact');
  assert.equal(game.waveDamageTaken, 1);
  game.damagePlayer();
  assert.equal(game.waveDamageTaken, 1);
  game.enemies.forEach((enemy) => { enemy.alive = false; });
  game.update(STEP, idle);
  const damagedClear = game.consumeEvents().find((entry) => entry.type === GameEvent.WAVE_CLEARED);
  assert.equal(damagedClear.noDamageBonus, 0);
  game.update(WaveDefaults.clearDuration, idle);
  assert.equal(game.waveDamageTaken, 0);
  game.update(WaveDefaults.introDuration, idle);
  game.endGame();
  game.restart();
  assert.equal(game.waveDamageTaken, 0);
  assert.equal(game.enemyFireLane, 'left');
});

test('late-wave fixed-step simulation respects projectile and diver bounds', () => {
  const game = playingWave(10000, 7);
  const firing = { isDown: (action) => action === 'fire' };

  for (let step = 0; step < 10000; step += 1) {
    // Keep this capacity scenario running; human survival is a separate playtest gate.
    game.player.lives = 3;
    game.update(STEP, firing);
    assert.equal(game.state === GameState.GAME_OVER, false);
    assert.ok(game.projectiles.length <= WaveLimits.totalProjectiles);
    assert.ok(game.projectiles.filter((projectile) => projectile.owner === 'enemy').length <= WaveLimits.enemyProjectiles);
    const reserved = game.enemies.filter((enemy) => enemy.alive && enemy.behavior !== 'formation');
    assert.ok(reserved.length <= game.waveDefinition.maxDivers);
    assert.ok(game.enemies.every((enemy) => Number.isFinite(enemy.x) && Number.isFinite(enemy.y)));
    game.consumeEvents();
  }
});

test('each difficulty band fills its configured dive capacity and refuses one more', () => {
  for (const number of [3, 5, 7, 10]) {
    const game = playingWave(number);
    const cap = game.waveDefinition.maxDivers;

    for (let index = 0; index < cap; index += 1) {
      assert.equal(game.beginDive(game.enemies[index]), true);
    }

    assert.equal(game.beginDive(game.enemies[cap]), false);
  }
});
