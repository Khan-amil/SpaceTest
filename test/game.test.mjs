import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { GameState } from '../src/constants.js';

const idle = { isDown: () => false };
test('a game starts in title state and can start cleanly', () => { const game = new Game(() => .5); assert.equal(game.state, GameState.TITLE); game.start(); assert.equal(game.state, GameState.PLAYING); assert.equal(game.score, 0); assert.equal(game.player.lives, 3); assert.equal(game.enemies.length, 21); });
test('clearing a wave advances difficulty', () => { const game = new Game(() => .5); game.start(); game.enemies.forEach((enemy) => { enemy.alive = false; }); game.update(1 / 60, idle); assert.equal(game.wave, 2); assert.equal(game.enemies.filter((enemy) => enemy.alive).length, 21); });
test('enemy projectile damage ends a three-life game', () => { const game = new Game(() => .5); game.start(); game.damagePlayer(); game.player.invulnerable = 0; game.damagePlayer(); game.player.invulnerable = 0; game.damagePlayer(); assert.equal(game.state, GameState.GAME_OVER); });
