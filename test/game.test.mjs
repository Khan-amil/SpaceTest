import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { GameEvent, GameState, SessionRules } from '../src/constants.js';
import { createProjectile } from '../src/entities.js';

const idle = { isDown: () => false };

test('a game starts in title state and can start cleanly', () => {
  const game = new Game(() => 0.5);

  assert.equal(game.state, GameState.TITLE);

  game.start();

  assert.equal(game.state, GameState.PLAYING);
  assert.equal(game.score, 0);
  assert.equal(game.player.lives, 3);
  assert.equal(game.enemies.length, 21);
});

test('clearing a wave advances difficulty and emits a clear event', () => {
  const game = new Game(() => 0.5);

  game.start();
  game.consumeEvents();
  game.enemies.forEach((enemy) => {
    enemy.alive = false;
  });
  game.update(1 / 60, idle);

  assert.equal(game.wave, 2);
  assert.equal(game.enemies.filter((enemy) => enemy.alive).length, 21);
  assert.ok(game.consumeEvents().some((event) => event.type === GameEvent.WAVE_CLEARED));
});

test('projectile collisions damage their intended target exactly once', () => {
  const game = new Game(() => 0.5);
  game.start();

  const enemy = game.enemies[0];
  game.projectiles.push(createProjectile(enemy.x, enemy.y, 0, 'player'));
  game.resolveCollisions();

  assert.equal(enemy.alive, false);
  assert.equal(game.score, 175);

  const enemyBullet = createProjectile(game.player.x, game.player.y, 0, 'enemy');
  game.projectiles = [enemyBullet];
  game.resolveCollisions();

  assert.equal(game.player.lives, 2);
  assert.equal(enemyBullet.alive, false);
});

test('enemy projectile damage ends a three-life game with no continue state', () => {
  const game = new Game(() => 0.5);
  game.start();

  game.damagePlayer();
  game.player.invulnerable = 0;
  game.damagePlayer();
  game.player.invulnerable = 0;
  game.damagePlayer();

  assert.equal(game.state, GameState.GAME_OVER);
  assert.equal(SessionRules.continues, false);
});

test('pause freezes the simulation until it is resumed', () => {
  const game = new Game(() => 0.5);
  const moveRight = { isDown: (action) => action === 'right' };

  game.start();
  const initialX = game.player.x;
  game.pause();
  game.update(1, moveRight);

  assert.equal(game.state, GameState.PAUSED);
  assert.equal(game.player.x, initialX);

  game.resume();
  game.update(1 / 60, moveRight);

  assert.ok(game.player.x > initialX);
});

test('direct enemy contact removes one life and grants visible invulnerability', () => {
  const game = new Game(() => 0.5);
  game.start();

  const enemy = game.enemies[0];
  enemy.x = game.player.x;
  enemy.y = game.player.y;
  game.resolveCollisions();

  assert.equal(game.player.lives, SessionRules.maxLives - 1);
  assert.equal(enemy.alive, false);
  assert.ok(game.player.invulnerable > 0);
  assert.ok(game.consumeEvents().some((event) => event.type === GameEvent.PLAYER_CONTACTED));
});

test('the event catalogue gives stable names to presentation systems', () => {
  assert.equal(GameEvent.PLAYER_FIRED, 'playerFired');
  assert.equal(GameEvent.ENEMY_DIVE_STARTED, 'enemyDiveStarted');
  assert.equal(GameEvent.POWERUP_COLLECTED, 'powerupCollected');
});
