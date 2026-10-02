import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { GAME_HEIGHT, GAME_WIDTH, GameEvent, GameState, WaveDefaults } from '../src/constants.js';
import { createProjectile } from '../src/entities.js';
import { EnemyBehavior, getFormationPosition, updateEnemyBehavior } from '../src/enemy-ai.js';
import { getWaveDefinition } from '../src/waves.js';

const STEP = 1 / 120;
const idle = { isDown: () => false };

function playingGame() {
  const game = new Game(() => 0.5, () => getWaveDefinition(3));
  game.start();
  game.update(WaveDefaults.introDuration, idle);
  game.enemyDiveTimer = 1000;
  game.enemyFireTimer = 1000;
  game.consumeEvents();
  return game;
}

function assertFormationVisible(game) {
  for (const enemy of game.enemies.filter((candidate) => candidate.alive
    && candidate.behavior === EnemyBehavior.FORMATION)) {
    assert.ok(enemy.x >= enemy.width / 2 && enemy.x <= GAME_WIDTH - enemy.width / 2);
    assert.ok(enemy.y >= enemy.height / 2 && enemy.y + enemy.height / 2 <= GAME_HEIGHT / 2);
  }
}

test('an outer Scout returning outside shrunken bounds cannot bounce and drop every tick', () => {
  for (const direction of [-1, 1]) {
    const game = playingGame();
    const scout = game.enemies.find((enemy) => enemy.kind === 'scout'
      && enemy.home.x === (direction === -1 ? 255 : 705));
    assert.equal(game.beginDive(scout), true);

    // Killing the other outer-column ships lets the remaining formation travel farther.
    for (const enemy of game.enemies) {
      if (enemy !== scout && enemy.home.x === scout.home.x) enemy.alive = false;
    }

    while (scout.behavior !== EnemyBehavior.RETURNING) {
      updateEnemyBehavior(scout, game.formation, STEP, game.player);
    }

    scout.dive.elapsed = 0.9 - STEP / 2;
    game.formation.x = direction * 255;
    game.formation.y = 22;
    game.enemyDirection = -direction;
    const beforeScore = game.score;
    game.updateEnemies(STEP);
    assert.equal(scout.behavior, EnemyBehavior.FORMATION);

    for (let step = 0; step < 120; step += 1) game.updateEnemies(STEP);

    assert.equal(game.formation.y, 22, 're-entry correction must not create repeated row drops');
    assert.equal(game.enemyDirection, -direction, 'movement should continue toward the field');
    assert.equal(game.score, beforeScore);
    assertFormationVisible(game);
    assert.deepEqual({ x: scout.x, y: scout.y }, getFormationPosition(scout, game.formation));
  }
});

test('ordinary edge turns remain bounded after many complete formation sweeps', () => {
  const game = playingGame();
  game.waveDefinition.diveCadence = null;

  for (let step = 0; step < 120 * 300; step += 1) {
    game.updateEnemies(STEP);
    assertFormationVisible(game);
  }
});

test('an already offscreen formation is brought back into playable space without losing rewards', () => {
  const game = playingGame();
  game.formation.x = 1500;
  game.formation.y = 1500;
  game.score = 1234;
  const health = game.enemies.map((enemy) => enemy.health);
  game.updateEnemies(STEP);

  assertFormationVisible(game);
  assert.equal(game.score, 1234);
  assert.deepEqual(game.enemies.map((enemy) => enemy.health), health);
});

test('real edge crossings drop once, while inward motion and row drops during returns remain safe', () => {
  for (const direction of [-1, 1]) {
    const game = playingGame();
    game.enemyDirection = direction;
    // The outer Wasp bob envelope sets the bound of this seven-column recipe.
    game.formation.x = direction * 211;
    game.updateEnemies(STEP);
    assert.equal(game.enemyDirection, -direction);
    assert.equal(game.formation.y, 22);
    game.updateEnemies(STEP);
    assert.equal(game.formation.y, 22);
    assertFormationVisible(game);
  }
});

test('a return completing on the same tick as an edge drop cannot trigger a second descent', () => {
  for (const direction of [-1, 1]) {
    const game = playingGame();
    const scout = game.enemies.find((enemy) => enemy.kind === 'scout'
      && enemy.home.x === (direction === -1 ? 255 : 705));
    game.beginDive(scout);

    for (const enemy of game.enemies) {
      if (enemy !== scout && enemy.home.x === scout.home.x) enemy.alive = false;
    }

    while (scout.behavior !== EnemyBehavior.RETURNING) {
      updateEnemyBehavior(scout, game.formation, STEP, game.player);
    }

    scout.dive.elapsed = 0.9 - STEP / 2;
    game.formation.x = direction * 286;
    game.enemyDirection = direction;
    game.updateEnemies(STEP);
    assert.equal(scout.behavior, EnemyBehavior.FORMATION);
    assert.equal(game.formation.y, 22);
    assert.equal(game.enemyDirection, -direction);
    assertFormationVisible(game);

    for (let step = 0; step < 120; step += 1) game.updateEnemies(STEP);
    assert.equal(game.formation.y, 22);
    assertFormationVisible(game);
    assert.equal(game.consumeEvents().some((event) => event.type === GameEvent.ENEMY_STATE_RECOVERED), false);
  }
});

test('invalid shared coordinates, anchors and paths recover with a single semantic notice', () => {
  const corruptions = [
    (game) => { game.formation.x = NaN; game.formation.y = Infinity; game.formation.elapsed = NaN; },
    (game) => { game.enemyDirection = NaN; },
    (game) => { game.enemies[0].home = { x: NaN, y: Infinity }; },
    (game) => { game.enemies[0].formationOffset = { x: 9999, y: 9999 }; },
    (game) => { game.enemies[0].x = NaN; },
    (game) => { game.enemies[0].behavior = 'unknown'; game.enemies[0].dive = null; },
    (game) => { game.enemies[0].behavior = EnemyBehavior.DIVING; game.enemies[0].dive = { elapsed: 0, path: null }; },
    (game) => { game.enemies[0].behavior = EnemyBehavior.RETURNING; game.enemies[0].dive = { elapsed: 0, returnStart: { x: NaN, y: 700 } }; },
  ];

  for (const corrupt of corruptions) {
    const game = playingGame();
    game.score = 1234;
    const health = game.enemies.map((enemy) => enemy.health);
    game.projectiles = [
      createProjectile(game.player.x, 450, 0, 'player'),
      createProjectile(game.player.x, game.player.y, 0, 'enemy'),
    ];
    corrupt(game);
    game.update(STEP, idle);
    assertFormationVisible(game);
    assert.equal(game.state, GameState.PLAYING);
    assert.equal(game.player.lives, 3);
    assert.equal(game.score, 1234);
    assert.deepEqual(game.enemies.map((enemy) => enemy.health), health);
    assert.equal(game.projectiles.length, 1, 'recovery clears stale danger but keeps player shots');
    assert.equal(game.consumeEvents().filter((event) => event.type === GameEvent.ENEMY_STATE_RECOVERED).length, 1);
    game.update(STEP, idle);
    assert.equal(game.consumeEvents().filter((event) => event.type === GameEvent.ENEMY_STATE_RECOVERED).length, 0);
  }
});

test('a stuck dive clock times out independently and restores a shootable enemy', () => {
  const game = playingGame();
  const scout = game.enemies.find((enemy) => enemy.kind === 'scout');
  game.beginDive(scout);

  while (scout.behavior !== EnemyBehavior.DIVING) game.updateEnemies(STEP);
  const deadline = scout.dive.path.duration + 1;

  for (let step = 0; step < Math.ceil((deadline + 0.1) / STEP); step += 1) {
    if (scout.behavior === EnemyBehavior.DIVING) scout.dive.elapsed = 0;
    game.updateEnemies(STEP);
  }

  assert.equal(scout.behavior, EnemyBehavior.FORMATION);
  assert.equal(scout.dive, null);
  assertFormationVisible(game);
  game.projectiles = [createProjectile(scout.x, scout.y, 0, 'player')];
  game.resolveCollisions();
  assert.equal(scout.alive, false);
  assert.equal(game.score, scout.value);
});

test('recovery and its watchdog freeze in pause and never cancel protected warnings', () => {
  const game = playingGame();
  const scout = game.enemies.find((enemy) => enemy.kind === 'scout');
  game.beginDive(scout);
  game.player.invulnerable = 20;

  for (let step = 0; step < 120 * 5; step += 1) game.update(STEP, idle);
  assert.equal(scout.behavior, EnemyBehavior.TELEGRAPHING_DIVE);
  assert.equal(game.consumeEvents().some((event) => event.type === GameEvent.ENEMY_STATE_RECOVERED), false);
  game.pause();
  game.formation.x = NaN;
  const frozenEnemies = structuredClone(game.enemies);
  game.update(20, idle);
  assert.ok(Number.isNaN(game.formation.x));
  assert.deepEqual(game.enemies, frozenEnemies);
  game.resume();
  game.update(STEP, idle);
  assert.ok(Number.isFinite(game.formation.x));
  assert.equal(scout.behavior, EnemyBehavior.TELEGRAPHING_DIVE);
});

test('a repaired final enemy still clears exactly once and restart discards watchdog state', () => {
  const game = playingGame();
  const enemy = game.enemies.find((candidate) => candidate.kind === 'scout');
  game.enemies = [enemy];
  enemy.behavior = EnemyBehavior.RETURNING;
  enemy.dive = { elapsed: Infinity, returnStart: null };
  game.update(STEP, idle);
  assert.equal(enemy.behavior, EnemyBehavior.FORMATION);
  game.consumeEvents();
  game.projectiles = [createProjectile(enemy.x, enemy.y, 0, 'player')];
  game.update(STEP, idle);
  const score = game.score;
  game.advanceWaveWhenCleared();
  assert.equal(game.score, score);
  assert.equal(game.state, GameState.WAVE_INTRO);
  assert.equal(game.consumeEvents().filter((event) => event.type === GameEvent.WAVE_CLEARED).length, 1);
  game.update(WaveDefaults.clearDuration, idle);
  game.update(WaveDefaults.introDuration, idle);
  game.endGame();
  game.restart();
  assert.ok(game.enemies.every((candidate) => !candidate.behaviorWatchdog));
});
