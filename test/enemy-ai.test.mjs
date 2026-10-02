import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { createEnemy, createProjectile } from '../src/entities.js';
import { GameEvent, GameState, WaveDefaults } from '../src/constants.js';
import { getWaveDefinition } from '../src/waves.js';
import {
  EnemyBehavior,
  beginEnemyDive,
  cancelEnemyBehavior,
  enemyDefinitions,
  getFormationPosition,
  updateEnemyBehavior,
} from '../src/enemy-ai.js';
import { Renderer } from '../src/renderer.js';

const idle = { isDown: () => false };
const STEP = 1 / 120;

function createPlayingGame(wave = 5, random = () => 0.5) {
  const game = new Game(random, () => getWaveDefinition(wave));

  game.start();
  game.update(WaveDefaults.introDuration, idle);
  game.enemyFireTimer = 100;
  game.consumeEvents();
  return game;
}

function advance(game, seconds) {
  for (let step = 0; step < Math.ceil(seconds / STEP); step += 1) {
    game.update(STEP, idle);
  }
}

test('recipes spawn only supported types with stable independent state and type rewards', () => {
  for (const wave of [1, 3, 5, 20]) {
    const game = createPlayingGame(wave);
    const configuredKinds = new Set(game.waveDefinition.enemyMix.map((entry) => entry.kind));

    for (const enemy of game.enemies) {
      assert.ok(configuredKinds.has(enemy.kind));
      assert.ok(Object.hasOwn(enemyDefinitions, enemy.kind));
      assert.equal(enemy.health, enemyDefinitions[enemy.kind].health);
      assert.equal(enemy.value, enemyDefinitions[enemy.kind].value);
      assert.equal(enemy.behavior, EnemyBehavior.FORMATION);
      assert.equal(enemy.dive, null);
      assert.deepEqual(enemy.home, { x: enemy.x, y: enemy.y });
    }

    assert.notEqual(game.enemies[0].home, game.enemies[1].home);
  }

  assert.throws(() => createEnemy(0, 0, 0, 'unknown'), RangeError);
  assert.throws(() => createEnemy(0, 0, 0, 'toString'), RangeError);
});

test('each archetype returns to its moving home without changing the anchor', () => {
  for (const kind of Object.keys(enemyDefinitions)) {
    const enemy = createEnemy(480, 100, 0, kind);
    const home = { ...enemy.home };
    const formation = { x: 0, y: 0, elapsed: 0 };
    const actions = [];

    assert.equal(beginEnemyDive(enemy, 1), true);
    assert.equal(beginEnemyDive(enemy, -1), false);

    for (let step = 0; step < 700; step += 1) {
      formation.x += STEP * 20;
      formation.elapsed += STEP;
      const action = updateEnemyBehavior(enemy, formation, STEP);

      if (action) actions.push(action);
      if (actions.includes('ended')) break;
      assert.equal(beginEnemyDive(enemy, -1), false);
    }

    assert.deepEqual(enemy.home, home);
    assert.equal(enemy.behavior, EnemyBehavior.FORMATION);
    assert.equal(enemy.dive, null);
    assert.equal(actions.filter((action) => action === 'started').length, 1);
    assert.equal(actions.filter((action) => action === 'ended').length, 1);
    assert.equal(actions.filter((action) => action === 'fire').length, kind === 'wasp' ? 1 : 0);
    const target = getFormationPosition(enemy, formation);

    assert.ok(Math.abs(enemy.x - target.x) < 0.000001);
    assert.ok(Math.abs(enemy.y - target.y) < 0.000001);
  }
});

test('death cancels a pending telegraph, dive, or return permanently', () => {
  for (const seconds of [0.1, 0.7, 2.9]) {
    const enemy = createEnemy(480, 100, 0, 'scout');
    const formation = { x: 0, y: 0, elapsed: 0 };

    beginEnemyDive(enemy, 1);

    for (let step = 0; step < Math.ceil(seconds / STEP); step += 1) {
      updateEnemyBehavior(enemy, formation, STEP);
    }

    cancelEnemyBehavior(enemy);
    const frozenEnemy = structuredClone(enemy);

    assert.equal(beginEnemyDive(enemy, 1), false);
    assert.equal(updateEnemyBehavior(enemy, formation, 10), null);
    assert.deepEqual(enemy, frozenEnemy);
    assert.equal(enemy.behavior, EnemyBehavior.EXPLODING);
    assert.equal(enemy.dive, null);
  }
});

test('dive scheduling respects intro, invulnerability, active cap, and pause', () => {
  const game = createPlayingGame();
  // This scenario isolates a single-slot cap; wave 5 now reserves two divers.
  game.waveDefinition.maxDivers = 1;
  const [first, second] = game.enemies;

  game.state = GameState.WAVE_INTRO;
  assert.equal(game.beginDive(first), false);
  game.state = GameState.PLAYING;
  game.player.invulnerable = 1;
  assert.equal(game.beginDive(first), false);
  game.player.invulnerable = 0;
  assert.equal(game.beginDive(first), true);
  assert.equal(game.beginDive(first), false);
  assert.equal(game.beginDive(second), false);
  assert.equal(first.behavior, EnemyBehavior.TELEGRAPHING_DIVE);
  advance(game, enemyDefinitions[first.kind].dive.telegraphDuration - 0.02);
  assert.equal(first.behavior, EnemyBehavior.TELEGRAPHING_DIVE);
  advance(game, 0.03);
  assert.equal(first.behavior, EnemyBehavior.DIVING);

  game.pause();
  const frozen = structuredClone({ enemies: game.enemies, formation: game.formation, timer: game.enemyDiveTimer });
  game.update(10, idle);
  assert.deepEqual({ enemies: game.enemies, formation: game.formation, timer: game.enemyDiveTimer }, frozen);
  game.resume();
  assert.equal(game.beginDive(second), false);
});

test('divers do not drive formation edges and the home anchor survives edge drops', () => {
  const game = createPlayingGame();
  const scout = game.enemies.find((enemy) => enemy.kind === 'scout');
  const home = { ...scout.home };

  game.beginDive(scout);
  advance(game, 0.5);
  scout.x = 2000;
  const previousDirection = game.enemyDirection;
  game.update(STEP, idle);
  assert.equal(game.enemyDirection, previousDirection);

  game.formation.x = 1000;
  game.update(STEP, idle);
  assert.equal(game.enemyDirection, -previousDirection);
  assert.equal(game.formation.y, game.waveDefinition.movement.dropDistance);
  assert.deepEqual(scout.home, home);
});

test('Sentinel consumes two separate hits and awards health, score, and accuracy once', () => {
  const game = createPlayingGame();
  const sentinel = game.enemies.find((enemy) => enemy.kind === 'sentinel');

  game.beginDive(sentinel);
  game.consumeEvents();
  const firstShot = createProjectile(sentinel.x, sentinel.y, 0, 'player');
  game.projectiles = [firstShot];
  game.resolveCollisions();
  game.resolveCollisions();

  assert.equal(firstShot.alive, false);
  assert.equal(sentinel.health, 1);
  assert.equal(sentinel.alive, true);
  assert.equal(game.score, 0);
  assert.equal(game.statistics.shotsHit, 1);
  assert.equal(game.statistics.enemiesDestroyed, 0);
  assert.deepEqual(game.consumeEvents().map((event) => event.type), [GameEvent.ENEMY_DAMAGED]);

  game.projectiles.push(createProjectile(sentinel.x, sentinel.y, 0, 'player'));
  game.resolveCollisions();
  game.resolveCollisions();
  assert.equal(sentinel.health, 0);
  assert.equal(sentinel.alive, false);
  assert.equal(sentinel.dive, null);
  assert.equal(game.score, 350);
  assert.equal(game.statistics.shotsHit, 2);
  assert.equal(game.statistics.enemiesDestroyed, 1);
  assert.deepEqual(game.consumeEvents().map((event) => event.type), [GameEvent.ENEMY_DESTROYED]);
});

test('Wasp dive produces exactly one aimed shot with bounded downward velocity', () => {
  const game = createPlayingGame();
  const wasp = game.enemies.find((enemy) => enemy.kind === 'wasp');

  game.beginDive(wasp);
  const observedShots = new Map();

  for (let step = 0; step < 300; step += 1) {
    game.update(STEP, idle);

    for (const projectile of game.projectiles) {
      observedShots.set(projectile.id, projectile);
    }
  }

  assert.equal(observedShots.size, 1);
  const [shot] = observedShots.values();
  assert.ok(shot.velocityY > 0);
  assert.notEqual(shot.velocityX, 0);
  assert.ok(Math.abs(Math.atan2(shot.velocityX, shot.velocityY)) <= 0.65);
});

test('killing the final diver clears once and cannot produce delayed behavior', () => {
  const game = createPlayingGame();
  const wasp = game.enemies.find((enemy) => enemy.kind === 'wasp');

  game.enemies = [wasp];
  game.beginDive(wasp);
  advance(game, 0.65);
  assert.equal(wasp.behavior, EnemyBehavior.DIVING);
  game.consumeEvents();
  game.projectiles = [createProjectile(wasp.x, wasp.y, 0, 'player')];
  game.resolveCollisions();
  game.advanceWaveWhenCleared();
  assert.equal(game.state, GameState.WAVE_INTRO);
  assert.equal(wasp.dive, null);
  assert.equal(game.projectiles.length, 0);
  const score = game.score;

  advance(game, WaveDefaults.clearDuration + WaveDefaults.introDuration + 0.1);
  assert.equal(game.score, score);
  const events = game.consumeEvents();
  assert.equal(events.filter((event) => event.type === GameEvent.WAVE_CLEARED).length, 1);
  assert.ok(!events.some((event) => event.type === GameEvent.ENEMY_DIVE_ENDED));
  assert.ok(game.enemies.every((enemy) => enemy.dive === null));
});

test('aimed projectiles expire after leaving the horizontal screen boundary', () => {
  const game = createPlayingGame();
  const projectile = createProjectile(985, 200, 0, 'enemy');

  projectile.velocityX = 100;
  game.projectiles = [projectile];
  game.updateProjectiles(0.1);
  game.removeExpiredProjectiles();
  assert.equal(game.projectiles.length, 0);
});

test('seeded scheduling is reproducible and restart discards active behavior', () => {
  function run() {
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const game = createPlayingGame(5, random);

    game.player.y = 620;
    advance(game, 18);
    const events = game.consumeEvents().map((event) => [event.type, event.enemy?.kind]);
    return { game, events };
  }

  const first = run();
  const second = run();
  assert.deepEqual(first.events, second.events);
  assert.deepEqual(first.game.enemies.map(({ x, y, behavior }) => ({ x, y, behavior })),
    second.game.enemies.map(({ x, y, behavior }) => ({ x, y, behavior })));
  assert.ok(first.events.some(([type]) => type === GameEvent.ENEMY_DIVE_STARTED));

  first.game.endGame();
  first.game.restart();
  assert.ok(first.game.enemies.every((enemy) => enemy.dive === null && enemy.behavior === EnemyBehavior.FORMATION));
  assert.deepEqual(first.game.formation, { x: 0, y: 0, elapsed: 0 });
});

test('enemy rendering preserves simulation state including reduced-motion telegraphs', () => {
  const context = new Proxy({}, {
    get: () => () => {},
    set: () => true,
  });
  const renderer = new Renderer({ getContext: () => context }, { reducedMotion: true });

  for (const kind of Object.keys(enemyDefinitions)) {
    const enemy = createEnemy(480, 100, 0, kind);

    beginEnemyDive(enemy, 1);
    const before = structuredClone(enemy);
    renderer.drawEnemy(context, enemy);
    assert.deepEqual(enemy, before);
    enemy.health = 1;
    renderer.drawEnemy(context, enemy);
  }
});
