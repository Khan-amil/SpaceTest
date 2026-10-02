import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { GameEvent, GameState, SessionRules, WaveDefaults } from '../src/constants.js';
import { createProjectile } from '../src/entities.js';
import { getWaveDefinition } from '../src/waves.js';

const idle = { isDown: () => false };
const FIXED_STEP = 1 / 120;

function advanceFor(game, seconds, input = idle) {
  const stepCount = Math.ceil(seconds / FIXED_STEP) + 1;

  for (let step = 0; step < stepCount; step += 1) {
    game.update(FIXED_STEP, input);
  }
}

function createPlayingGame() {
  const game = new Game(() => 0.5);

  game.start();
  advanceFor(game, WaveDefaults.introDuration);

  return game;
}

test('a game starts in title state and can start cleanly', () => {
  const game = new Game(() => 0.5);

  assert.equal(game.state, GameState.TITLE);

  game.start();

  assert.equal(game.state, GameState.WAVE_INTRO);
  assert.equal(game.score, 0);
  assert.equal(game.player.lives, 3);
  assert.equal(game.enemies.length, 21);

  advanceFor(game, WaveDefaults.introDuration);
  assert.equal(game.state, GameState.PLAYING);
});

test('clearing a wave awards one bonus and introduces the next wave on a later tick', () => {
  const game = createPlayingGame();

  game.consumeEvents();
  game.enemies.forEach((enemy) => {
    enemy.alive = false;
  });
  game.projectiles.push(createProjectile(game.player.x, game.player.y - 50, 0, 'enemy'));
  const previousEnemies = game.enemies;
  const clearBonus = game.waveDefinition.clearBonus;
  game.update(FIXED_STEP, idle);

  assert.equal(game.wave, 1);
  assert.equal(game.state, GameState.WAVE_INTRO);
  assert.equal(game.waveIntro.phase, 'cleared');
  assert.equal(game.score, clearBonus);
  assert.equal(game.enemies, previousEnemies);
  assert.equal(game.projectiles.length, 0);

  for (let step = 0; step < 5; step += 1) {
    game.advanceWaveWhenCleared();
    game.update(FIXED_STEP, idle);
  }

  assert.equal(game.wave, 1);
  assert.equal(game.score, clearBonus);

  advanceFor(game, WaveDefaults.clearDuration);

  assert.equal(game.wave, 2);
  assert.equal(game.state, GameState.WAVE_INTRO);
  assert.equal(game.waveIntro.phase, 'incoming');
  const nextFormation = getWaveDefinition(2).formation;
  assert.equal(game.enemies.length, nextFormation.columns * nextFormation.rows);
  assert.ok(game.waveDefinition.movement.speed > getWaveDefinition(1).movement.speed);
  assert.equal(game.score, clearBonus);

  const events = game.consumeEvents();
  assert.deepEqual(events.map((event) => event.type), [GameEvent.WAVE_CLEARED, GameEvent.WAVE_STARTED]);
  assert.deepEqual(events[0], { type: GameEvent.WAVE_CLEARED, wave: 1, bonus: clearBonus, score: clearBonus });

  advanceFor(game, WaveDefaults.introDuration);
  assert.equal(game.state, GameState.PLAYING);
  assert.equal(game.wave, 2);
});

test('projectile collisions damage their intended target exactly once', () => {
  const game = createPlayingGame();

  const enemy = game.enemies[0];
  game.projectiles.push(createProjectile(enemy.x, enemy.y, 0, 'player'));
  game.resolveCollisions();

  assert.equal(enemy.alive, false);
  assert.equal(game.score, 125);
  game.resolveCollisions();
  assert.equal(game.score, 125);
  assert.equal(game.statistics.enemiesDestroyed, 1);
  assert.equal(game.statistics.shotsHit, 1);

  const enemyBullet = createProjectile(game.player.x, game.player.y, 0, 'enemy');
  game.projectiles = [enemyBullet];
  game.resolveCollisions();

  assert.equal(game.player.lives, 2);
  assert.equal(enemyBullet.alive, false);
});

test('destroying the final target emits destruction before one clear bonus', () => {
  const game = createPlayingGame();
  const enemy = game.enemies[0];

  game.enemies = [enemy];
  game.consumeEvents();
  game.firePlayerProjectile();
  const projectile = game.projectiles[0];
  projectile.x = enemy.x;
  projectile.y = enemy.y;
  projectile.velocityY = 0;
  game.update(FIXED_STEP, idle);

  assert.equal(game.state, GameState.WAVE_INTRO);
  assert.equal(game.wave, 1);
  assert.equal(game.score, 125 + game.waveDefinition.clearBonus);
  assert.equal(game.statistics.enemiesDestroyed, 1);
  assert.equal(game.statistics.shotsHit, 1);
  assert.deepEqual(game.consumeEvents().map((event) => event.type), [
    GameEvent.PLAYER_FIRED,
    GameEvent.ENEMY_DESTROYED,
    GameEvent.WAVE_CLEARED,
  ]);
});

test('enemy projectile damage ends a three-life game with no continue state', () => {
  const game = createPlayingGame();

  game.damagePlayer();
  game.player.invulnerable = 0;
  game.damagePlayer();
  game.player.invulnerable = 0;
  game.damagePlayer();

  assert.equal(game.state, GameState.GAME_OVER);
  assert.equal(SessionRules.continues, false);
});

test('pause freezes movement, bullets, cooldowns, invulnerability, and enemy fire', () => {
  const game = createPlayingGame();
  const moveRight = { isDown: (action) => action === 'right' };

  game.firePlayerProjectile();
  game.player.invulnerable = 0.5;
  const initialX = game.player.x;
  const frozenPlayer = { ...game.player };
  const frozenEnemies = structuredClone(game.enemies);
  const frozenProjectiles = structuredClone(game.projectiles);
  const frozenFireTimer = game.enemyFireTimer;
  game.pause();
  game.update(1, moveRight);

  assert.equal(game.state, GameState.PAUSED);
  assert.deepEqual(game.player, frozenPlayer);
  assert.deepEqual(game.enemies, frozenEnemies);
  assert.deepEqual(game.projectiles, frozenProjectiles);
  assert.equal(game.enemyFireTimer, frozenFireTimer);

  game.resume();
  game.update(1 / 60, moveRight);

  assert.ok(game.player.x > initialX);
});

test('direct enemy contact removes one life and grants visible invulnerability', () => {
  const game = createPlayingGame();

  const enemy = game.enemies[0];
  enemy.home.x = game.player.x;
  enemy.x = game.player.x;
  enemy.home.y = game.player.y;
  enemy.y = game.player.y;
  game.resolveCollisions();

  assert.equal(game.player.lives, SessionRules.maxLives - 1);
  assert.equal(enemy.alive, false);
  assert.ok(game.player.invulnerable > 0);
  assert.ok(game.consumeEvents().some((event) => event.type === GameEvent.PLAYER_CONTACTED));
  assert.equal(game.statistics.enemiesDestroyed, 1);
  assert.equal(game.statistics.shotsHit, 0);
});

test('title, wave intro, pause, and game over cannot be ended or damaged out of order', () => {
  const game = new Game(() => 0.5);
  const movingAndFiring = { isDown: () => true };

  assert.deepEqual(game.consumeEvents(), []);
  game.endGame();
  game.damagePlayer();
  game.resume();
  game.pause();
  game.update(10, movingAndFiring);
  assert.equal(game.state, GameState.TITLE);
  assert.equal(game.player.lives, 3);

  game.start();
  const frozenEnemies = structuredClone(game.enemies);
  const frozenPlayer = { ...game.player };
  const fireTimer = game.enemyFireTimer;
  game.damagePlayer();
  game.endGame();
  game.firePlayerProjectile();
  advanceFor(game, WaveDefaults.introDuration / 2, movingAndFiring);
  assert.equal(game.state, GameState.WAVE_INTRO);
  assert.deepEqual(game.enemies, frozenEnemies);
  assert.deepEqual(game.player, frozenPlayer);
  assert.equal(game.enemyFireTimer, fireTimer);
  assert.equal(game.projectiles.length, 0);

  advanceFor(game, WaveDefaults.introDuration);
  game.pause();
  game.endGame();
  game.damagePlayer();
  assert.equal(game.state, GameState.PAUSED);
  game.resume();
  game.endGame();
  const summary = game.gameOverSummary;
  game.damagePlayer();
  game.pause();
  game.resume();
  game.update(10, movingAndFiring);
  assert.equal(game.state, GameState.GAME_OVER);
  assert.equal(game.gameOverSummary, summary);
});

test('wave introduction and clear timers are paused and resume their original phase', () => {
  const game = new Game(() => 0.5);

  game.start();
  game.update(FIXED_STEP, idle);
  const incomingTime = game.waveIntro.remaining;
  game.pause();
  game.update(5, idle);
  assert.equal(game.waveIntro.remaining, incomingTime);
  game.resume();
  assert.equal(game.state, GameState.WAVE_INTRO);
  advanceFor(game, WaveDefaults.introDuration);

  game.enemies.forEach((enemy) => { enemy.alive = false; });
  game.update(FIXED_STEP, idle);
  const clearTime = game.waveIntro.remaining;
  game.pause();
  game.update(5, idle);
  assert.equal(game.waveIntro.remaining, clearTime);
  assert.equal(game.wave, 1);
  game.resume();
  advanceFor(game, WaveDefaults.clearDuration);
  assert.equal(game.wave, 2);
  assert.equal(game.waveIntro.phase, 'incoming');
});

test('restart clears temporary state, statistics, and stale events', () => {
  const game = createPlayingGame();

  game.firePlayerProjectile();
  game.damagePlayer();
  game.score = 500;
  game.endGame();
  game.restart();

  assert.equal(game.state, GameState.WAVE_INTRO);
  assert.equal(game.wave, 1);
  assert.equal(game.score, 0);
  assert.equal(game.player.lives, 3);
  assert.equal(game.player.cooldown, 0);
  assert.equal(game.player.invulnerable, 0);
  assert.equal(game.projectiles.length, 0);
  assert.equal(game.pendingWave, null);
  assert.equal(game.gameOverSummary, null);
  assert.deepEqual(game.statistics, { shotsFired: 0, shotsHit: 0, enemiesDestroyed: 0, waveReached: 1 });
  assert.deepEqual(game.consumeEvents().map((event) => event.type), [GameEvent.GAME_STARTED, GameEvent.WAVE_STARTED]);
});

test('game over reports a stable summary with zero-shot and partial-hit accuracy', () => {
  const game = createPlayingGame();

  game.endGame();
  assert.deepEqual(game.gameOverSummary, { score: 0, waveReached: 1, enemiesDestroyed: 0, accuracy: 0 });
  game.restart();
  advanceFor(game, WaveDefaults.introDuration);

  const enemy = game.enemies[0];
  game.firePlayerProjectile();
  game.projectiles[0].x = enemy.x;
  game.projectiles[0].y = enemy.y;
  game.resolveCollisions();
  game.firePlayerProjectile();
  game.endGame();

  assert.deepEqual(game.gameOverSummary, { score: 125, waveReached: 1, enemiesDestroyed: 1, accuracy: 50 });
  assert.ok(Object.isFrozen(game.gameOverSummary));
  const gameOverEvents = game.consumeEvents().filter((event) => event.type === GameEvent.GAME_OVER);
  assert.deepEqual(gameOverEvents, [{ type: GameEvent.GAME_OVER, ...game.gameOverSummary }]);
});

test('a fatal hit stops later collisions and does not start a wave-clear transition', () => {
  const game = createPlayingGame();

  game.consumeEvents();
  game.player.lives = 1;
  const enemy = game.enemies[0];
  game.projectiles = [
    createProjectile(game.player.x, game.player.y, 0, 'enemy'),
    createProjectile(enemy.x, enemy.y, 0, 'player'),
  ];
  game.resolveCollisions();
  assert.equal(game.state, GameState.GAME_OVER);
  assert.equal(enemy.alive, true);
  assert.equal(game.score, 0);

  game.enemies.forEach((target) => { target.alive = false; });
  game.advanceWaveWhenCleared();
  assert.equal(game.pendingWave, null);
  assert.equal(game.score, 0);
  assert.equal(game.consumeEvents().filter((event) => event.type === GameEvent.GAME_OVER).length, 1);
});

test('fatal contact with the final enemy ends the run before any clear bonus', () => {
  const game = createPlayingGame();
  const enemy = game.enemies[0];

  game.enemies = [enemy];
  enemy.home.x = game.player.x;
  enemy.x = game.player.x;
  enemy.home.y = game.player.y;
  enemy.y = game.player.y;
  game.player.lives = 1;
  game.consumeEvents();
  game.update(FIXED_STEP, idle);

  assert.equal(game.state, GameState.GAME_OVER);
  assert.equal(game.pendingWave, null);
  assert.equal(game.score, 0);
  assert.equal(game.gameOverSummary.enemiesDestroyed, 1);
  assert.equal(game.gameOverSummary.accuracy, 0);
  assert.deepEqual(game.consumeEvents().map((event) => event.type), [
    GameEvent.PLAYER_CONTACTED,
    GameEvent.PLAYER_DAMAGED,
    GameEvent.GAME_OVER,
  ]);
});

test('configured layouts, enemy mix, movement, and bullet cadence drive the simulation', () => {
  const customDefinition = {
    ...getWaveDefinition(1),
    formation: { columns: 2, rows: 2, spacingX: 60, spacingY: 45, startY: 90 },
    enemyMix: [{ kind: 'scout', rows: [0] }, { kind: 'sentinel', rows: [1] }],
    movement: { speed: 64, dropDistance: 15 },
    firing: { initialDelay: 0.1, interval: 0.5, projectileSpeed: 320 },
  };
  const game = new Game(() => 0, () => customDefinition);

  game.start();
  game.update(WaveDefaults.introDuration, idle);
  assert.deepEqual(game.enemies.map((enemy) => [enemy.x, enemy.y, enemy.kind]), [
    [450, 90, 'scout'], [510, 90, 'scout'], [450, 135, 'sentinel'], [510, 135, 'sentinel'],
  ]);

  const initialX = game.enemies[0].x;
  game.update(0.1, idle);
  assert.equal(game.enemies[0].x, initialX + 64 * 0.1);
  assert.equal(game.projectiles.length, 1);
  assert.equal(game.projectiles[0].velocityY, 320);
  assert.equal(game.enemyFireTimer, 0.5);
  game.update(0.25, idle);
  assert.equal(game.projectiles.length, 1);
  game.update(0.25, idle);
  assert.equal(game.projectiles.length, 2);
});

test('the event catalogue gives stable names to presentation systems', () => {
  assert.equal(GameEvent.PLAYER_FIRED, 'playerFired');
  assert.equal(GameEvent.ENEMY_DIVE_STARTED, 'enemyDiveStarted');
  assert.equal(GameEvent.POWERUP_COLLECTED, 'powerupCollected');
});
