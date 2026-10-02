import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_HEIGHT, GAME_WIDTH, GameEvent, WaveDefaults } from '../src/constants.js';
import { createEnemy, createPlayer } from '../src/entities.js';
import { Game } from '../src/game.js';
import { getWaveDefinition } from '../src/waves.js';
import { beginEnemyDive, enemyDefinitions, updateEnemyBehavior } from '../src/enemy-ai.js';
import { createDivePath, evaluateBezier, evaluateDivePath } from '../src/dive-paths.js';

const STEP = 1 / 120;
const idle = { isDown: () => false };

function playingGame() {
  const game = new Game(() => 0.25, () => getWaveDefinition(5));
  game.start();
  game.update(WaveDefaults.introDuration, idle);
  game.enemyFireTimer = 100;
  game.consumeEvents();
  return game;
}

test('cubic evaluation has exact endpoints, midpoint, and bounded time', () => {
  const points = [{ x: 0, y: 0 }, { x: 0, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 0 }];
  assert.deepEqual(evaluateBezier(points, 0), points[0]);
  assert.deepEqual(evaluateBezier(points, 1), points[3]);
  assert.deepEqual(evaluateBezier(points, 0.5), { x: 4, y: 6 });
  assert.deepEqual(evaluateBezier(points, -1), points[0]);
  assert.deepEqual(evaluateBezier(points, 2), points[3]);
});

test('every archetype exits below the field away from sampled player X, even at edges', () => {
  const player = createPlayer();
  for (const kind of Object.keys(enemyDefinitions)) {
    for (const x of [22, 480, 938]) {
      for (const playerX of [19, 480, 941]) {
        for (const direction of [-1, 1]) {
          const enemy = createEnemy(x, 100, 0, kind);
          player.x = playerX;
          const path = createDivePath(enemy, enemyDefinitions[kind].dive, direction, player);
          const end = evaluateDivePath(path, 1);
          assert.deepEqual(evaluateDivePath(path, 0), { x, y: 100 });
          assert.ok(end.y > GAME_HEIGHT);
          assert.ok(Math.abs(end.x - player.x) >= player.width);
          for (let sample = 0; sample <= 100; sample += 1) {
            const position = evaluateDivePath(path, sample / 100);
            assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y));
            assert.ok(position.x >= enemy.width / 2 && position.x <= GAME_WIDTH - enemy.width / 2);
          }
        }
      }
    }
  }
});

test('Wasp joined curves keep velocity continuous and bound lateral acceleration', () => {
  const definition = enemyDefinitions.wasp.dive;
  for (const x of [19, 480, 941]) {
    for (const direction of [-1, 1]) {
      const path = createDivePath(createEnemy(x, 100, 0, 'wasp'), definition, direction, createPlayer());
      assert.equal(path.segments.length, 2);
      const [first, second] = path.segments;
      assert.deepEqual(first[3], second[0]);
      assert.equal(first[3].x - first[2].x, second[1].x - second[0].x);
      assert.equal(first[3].y - first[2].y, second[1].y - second[0].y);
      const segmentDuration = path.duration / 2;
      for (const points of path.segments) {
        for (const index of [0, 1]) {
          const acceleration = 6 * Math.abs(points[index + 2].x - 2 * points[index + 1].x
            + points[index].x) / segmentDuration ** 2;
          assert.ok(acceleration <= definition.maxLateralAcceleration + 1e-9);
        }
      }
    }
  }
});

test('warnings remain targetable and wait through invulnerability; aim is fixed on departure', () => {
  const formation = { x: 0, y: 0, elapsed: 0 };
  for (const kind of Object.keys(enemyDefinitions)) {
    const enemy = createEnemy(480, 100, 0, kind);
    const player = createPlayer();
    const duration = enemyDefinitions[kind].dive.telegraphDuration;
    assert.ok(duration >= 0.35 && duration <= 0.6);
    beginEnemyDive(enemy, -1);
    updateEnemyBehavior(enemy, formation, duration - STEP, player);
    assert.equal(enemy.behavior, 'telegraphingDive');
    assert.equal(enemy.alive, true);
    player.invulnerable = 1;
    assert.equal(updateEnemyBehavior(enemy, formation, 1, player), null);
    assert.equal(enemy.behavior, 'telegraphingDive');
    player.invulnerable = 0;
    assert.equal(updateEnemyBehavior(enemy, formation, STEP, player), 'started');
    const path = structuredClone(enemy.dive.path);
    player.x = 941;
    updateEnemyBehavior(enemy, formation, STEP, player);
    assert.deepEqual(enemy.dive.path, path);
  }
});

test('multiple divers reserve capacity through warning, dive, and return', () => {
  const game = playingGame();
  game.waveDefinition.maxDivers = 3;
  for (const enemy of game.enemies.slice(0, 3)) assert.equal(game.beginDive(enemy), true);
  assert.equal(game.beginDive(game.enemies[3]), false);
  game.enemyDiveTimer = 100;
  const stages = new Set();
  for (let step = 0; step < 700; step += 1) {
    game.updateEnemies(STEP);
    const reserved = game.enemies.filter((enemy) => enemy.alive && enemy.behavior !== 'formation');
    assert.ok(reserved.length <= 3);
    for (const enemy of reserved) stages.add(enemy.behavior);
    if (reserved.length > 0) assert.equal(game.beginDive(game.enemies[3]), false);
  }
  assert.deepEqual([...stages].sort(), ['diving', 'returning', 'telegraphingDive']);
  assert.equal(game.beginDive(game.enemies[3]), true);
  const events = game.consumeEvents();
  for (const enemy of game.enemies.slice(0, 3)) {
    assert.deepEqual(events.filter((event) => event.enemy === enemy).map((event) => event.type),
      [GameEvent.ENEMY_DIVE_TELEGRAPHED, GameEvent.ENEMY_DIVE_STARTED, GameEvent.ENEMY_DIVE_ENDED]);
  }
});

test('player velocity measures actual clamped displacement and bounded shots lead it with cooldown', () => {
  const game = playingGame();
  const wasp = game.enemies.find((enemy) => enemy.kind === 'wasp');
  game.updatePlayer(STEP, { isDown: (action) => action === 'right' });
  assert.ok(Math.abs(game.player.velocityX - 340) < 1e-8);
  game.player.x = GAME_WIDTH - game.player.width / 2;
  game.updatePlayer(STEP, { isDown: (action) => action === 'right' });
  assert.equal(game.player.velocityX, 0);
  game.player.x = wasp.x;
  game.player.velocityX = 100;
  game.player.velocityY = -100;
  game.waveDefinition.firing.projectileSpeed = 1000;
  assert.equal(game.fireAimedEnemyProjectile(wasp), true);
  const shot = game.projectiles[0];
  const attack = enemyDefinitions.wasp.dive;
  const expectedAngle = Math.atan2(100 * attack.shotLead, game.player.y - 100 * attack.shotLead - wasp.y);
  assert.ok(Math.abs(Math.atan2(shot.velocityX, shot.velocityY) - expectedAngle) < 1e-9);
  assert.ok(Math.abs(Math.hypot(shot.velocityX, shot.velocityY) - attack.maxShotSpeed) < 1e-9);
  assert.equal(game.fireAimedEnemyProjectile(wasp), false);
  game.updateEnemies(attack.shotCooldown);
  assert.equal(game.fireAimedEnemyProjectile(wasp), true);
  game.pause();
  wasp.aimedShotCooldown = 0;
  assert.equal(game.fireAimedEnemyProjectile(wasp), false);
});
