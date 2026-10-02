import test from 'node:test';
import assert from 'node:assert/strict';
import { Effects, PARTICLE_CAPACITY } from '../src/effects.js';
import { GameAudio } from '../src/audio.js';
import { GameEvent, GameState, WaveDefaults } from '../src/constants.js';
import { Game } from '../src/game.js';
import { Renderer } from '../src/renderer.js';

const player = { x: 480, y: 570 };

test('long-running presentation reuses fixed particles, expires effects, and resets on restart', () => {
  const effects = new Effects();
  const originalParticles = [...effects.particles];

  for (let index = 0; index < 10000; index += 1) {
    effects.handleEvent({ type: GameEvent.ENEMY_DESTROYED, enemy: { x: 300, y: 200, kind: 'sentinel' } }, player);
    effects.update(1 / 120);
  }

  assert.equal(effects.particles.length, PARTICLE_CAPACITY);
  effects.particles.forEach((particle, index) => {
    assert.equal(particle, originalParticles[index]);
    assert.ok(Number.isFinite(particle.x) && Number.isFinite(particle.y));
  });
  effects.update(1);
  assert.ok(effects.particles.every((particle) => particle.remaining === 0));
  assert.equal(effects.shakeRemaining, 0);
  effects.handleEvent({ type: GameEvent.PLAYER_DAMAGED }, player);
  effects.handleEvent({ type: GameEvent.GAME_STARTED }, player);
  assert.ok(effects.particles.every((particle) => particle.remaining === 0));
  assert.equal(effects.shakeRemaining, 0);
});

test('reduced-motion bursts stay static and never shake, including pickup and wave-clear effects', () => {
  const effects = new Effects({ reducedMotion: true });
  for (const type of [GameEvent.PLAYER_DAMAGED, GameEvent.POWERUP_COLLECTED, GameEvent.WAVE_CLEARED]) {
    effects.handleEvent({ type }, player);
  }
  const active = effects.particles.filter((particle) => particle.remaining > 0);
  assert.equal(active.length, 20);
  assert.ok(active.every((particle) => particle.velocityX === 0 && particle.velocityY === 0));
  assert.equal(effects.shakeRemaining, 0);
});

function createAudioHarness() {
  const oscillators = [];
  const gains = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: () => Promise.resolve(),
    createGain() {
      const gain = { gain: parameter(), connect() {}, disconnect() { this.disconnected = true; } };
      gains.push(gain);
      return gain;
    },
    createOscillator() {
      const oscillator = {
        frequency: parameter(),
        connect() {},
        start() { this.started = true; },
        stop() { this.stopped = true; },
        disconnect() { this.disconnected = true; },
      };
      oscillators.push(oscillator);
      return oscillator;
    },
  };
  let creations = 0;
  const audio = new GameAudio(() => {
    creations += 1;
    return context;
  });
  return { audio, context, oscillators, gains, get creations() { return creations; } };
}

test('audio stays silent until unlocked, caps voices, cleans nodes, and applies mute immediately', () => {
  const harness = createAudioHarness();
  const { audio, oscillators, gains } = harness;
  audio.handleEvent({ type: GameEvent.PLAYER_FIRED });
  assert.equal(harness.creations, 0);
  audio.unlock();
  audio.unlock();
  assert.equal(harness.creations, 1);

  for (let index = 0; index < 100; index += 1) audio.handleEvent({ type: GameEvent.ENEMY_DESTROYED });
  assert.equal(oscillators.length, 12);
  oscillators[0].onended();
  assert.equal(audio.voices.size, 11);
  assert.equal(oscillators[0].disconnected, true);
  assert.equal(gains[1].disconnected, true);
  audio.setMuted(true);
  assert.equal(gains[0].gain.value, 0);
  assert.equal(audio.voices.size, 0);
  audio.handleEvent({ type: GameEvent.WAVE_CLEARED });
  assert.equal(oscillators.length, 12);
  audio.setMuted(false);
  audio.handleEvent({ type: GameEvent.WAVE_CLEARED });
  assert.equal(audio.voices.size, 1);
  audio.handleEvent({ type: GameEvent.GAME_PAUSED });
  assert.equal(audio.voices.size, 0);
});

test('missing or denied audio never prevents gameplay and saved mute survives unlock', () => {
  for (const factory of [() => null, () => { throw new Error('Denied'); }]) {
    const audio = new GameAudio(factory);
    assert.doesNotThrow(() => audio.unlock());
    assert.doesNotThrow(() => audio.handleEvent({ type: GameEvent.GAME_OVER }));
  }
  const { audio, gains } = createAudioHarness();
  audio.setMuted(true);
  audio.unlock();
  assert.equal(gains[0].gain.value, 0);
});

test('wave hints and clear bonuses retain a comfortable reading interval with danger frozen', () => {
  const game = new Game(() => 0.5);
  const idle = { isDown: () => false };
  game.start();
  const positions = game.enemies.map(({ x, y }) => [x, y]);
  game.update(3, idle);
  assert.equal(game.state, GameState.WAVE_INTRO);
  assert.deepEqual(game.enemies.map(({ x, y }) => [x, y]), positions);
  assert.equal(game.projectiles.length, 0);
  game.update(WaveDefaults.introDuration - 3, idle);
  game.enemies.forEach((enemy) => { enemy.alive = false; });
  game.advanceWaveWhenCleared();
  game.update(3, idle);
  assert.equal(game.waveIntro.phase, 'cleared');
  assert.equal(game.wave, 1);
  game.update(WaveDefaults.clearDuration - 3, idle);
  assert.equal(game.wave, 2);
});

test('rendering keeps the model intact and draws hostile projectiles above particle effects', () => {
  const context = new Proxy({}, { get: () => () => {} });
  const renderer = new Renderer({ getContext: () => context });
  const game = new Game(() => 0.5);
  game.start();
  game.projectiles.push({ owner: 'enemy', x: 480, y: 400 });
  const before = JSON.stringify(game);
  const layers = [];
  renderer.drawBackground = () => layers.push('background');
  renderer.effects.draw = () => layers.push('particles');
  renderer.drawEnemy = () => layers.push('enemy');
  renderer.drawPlayer = () => layers.push('player');
  renderer.drawProjectile = () => layers.push('projectile');
  renderer.render(game, 1);
  assert.equal(JSON.stringify(game), before);
  assert.equal(layers.at(-1), 'projectile');
  assert.ok(layers.indexOf('particles') < layers.indexOf('enemy'));
});
