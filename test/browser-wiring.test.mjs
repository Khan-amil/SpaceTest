import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Renderer } from '../src/renderer.js';
import { GameState, WaveDefaults } from '../src/constants.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
let bootNumber = 0;

/** A minimal browser shell drives the real main.js loop without adding a DOM dependency. */
async function bootBrowser(storageFactory) {
  const elements = new Map();
  const windowListeners = new Map();
  const originalGlobals = new Map();
  const originalRender = Renderer.prototype.render;
  let focusedElement = null;
  let nextFrame = null;
  let currentTime = 0;
  let renderedGame = null;

  for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const id = match[1];
    const classes = new Set(match[0].match(/class="([^"]+)"/)?.[1].split(' ') ?? []);
    const listeners = new Map();

    elements.set(id, {
      textContent: '',
      attributes: new Map(),
      classList: {
        toggle(name, enabled) {
          if (enabled) classes.add(name);
          else classes.delete(name);
        },
        contains: (name) => classes.has(name),
      },
      setAttribute(name, value) { this.attributes.set(name, value); },
      addEventListener: (name, listener) => listeners.set(name, listener),
      click: () => listeners.get('click')?.(),
      focus() { focusedElement = id; },
      closest: (selector) => selector === 'button' && match[0].startsWith('<button') ? {} : null,
      getContext: () => ({}),
    });
  }

  function replaceGlobal(name, value) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }

  const fakeWindow = {
    matchMedia: () => ({ matches: false }),
    addEventListener: (name, listener) => windowListeners.set(name, listener),
  };
  Object.defineProperty(fakeWindow, 'localStorage', { get: storageFactory });
  replaceGlobal('window', fakeWindow);
  replaceGlobal('document', { querySelector: (selector) => elements.get(selector.slice(1)) });
  replaceGlobal('performance', { now: () => 0 });
  replaceGlobal('requestAnimationFrame', (callback) => { nextFrame = callback; });
  Renderer.prototype.render = (game) => { renderedGame = game; };

  function restore() {
    Renderer.prototype.render = originalRender;

    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }

  try {
    bootNumber += 1;
    await import(`../src/main.js?browser-test=${bootNumber}`);
  } catch (error) {
    restore();
    throw error;
  }

  function frame() {
    currentTime += 1000 / 60;
    nextFrame(currentTime);
  }

  function advance(seconds) {
    for (let step = 0; step < Math.ceil(seconds * 60) + 1; step += 1) frame();
  }

  function pressKey(code) {
    const event = {
      code,
      repeat: false,
      target: elements.get(focusedElement),
      preventDefault: () => {},
    };
    windowListeners.get('keydown')(event);
    frame();
    windowListeners.get('keyup')(event);
  }

  frame();

  return {
    elements,
    get game() { return renderedGame; },
    get focusedElement() { return focusedElement; },
    frame,
    advance,
    pressKey,
    restore,
  };
}

test('browser lifecycle displays introductions, clear bonus, full summary, and restart with best score', async () => {
  const savedValues = new Map([
    ['space-attack.best-score', '100'],
    ['space-attack.muted', 'true'],
  ]);
  const storage = {
    getItem: (key) => savedValues.get(key) ?? null,
    setItem: (key, value) => savedValues.set(key, value),
  };
  const browser = await bootBrowser(() => storage);

  try {
    const { elements } = browser;
    assert.equal(elements.get('mute-button').attributes.get('aria-pressed'), 'true');
    assert.equal(elements.get('pause-button').disabled, true);
    elements.get('start-button').click();
    assert.equal(browser.game.state, GameState.WAVE_INTRO);
    assert.equal(elements.get('wave-intro-title').textContent, 'WAVE 1');
    assert.equal(elements.get('wave-intro-description').textContent, browser.game.waveDefinition.hint);
    assert.equal(elements.get('wave-intro-screen').classList.contains('is-hidden'), false);
    assert.equal(elements.get('pause-button').disabled, false);

    elements.get('pause-button').click();
    assert.equal(browser.game.state, GameState.PAUSED);
    assert.equal(elements.get('pause-screen').classList.contains('is-hidden'), false);
    assert.equal(elements.get('pause-button').textContent, 'Resume');
    assert.equal(browser.focusedElement, 'resume-button');
    elements.get('resume-button').click();
    assert.equal(browser.focusedElement, 'game-canvas');
    browser.advance(WaveDefaults.introDuration);

    // Create two real shots; the first hits and the second remains a miss at game over.
    browser.game.firePlayerProjectile();
    browser.game.projectiles[0].x = browser.game.enemies[0].x;
    browser.game.projectiles[0].y = browser.game.enemies[0].y;
    browser.game.resolveCollisions();
    browser.game.firePlayerProjectile();
    browser.game.enemies.forEach((enemy) => { enemy.alive = false; });
    browser.frame();
    assert.equal(elements.get('wave-intro-title').textContent, 'SECTOR CLEAR');
    assert.match(elements.get('wave-intro-description').textContent, /Clear bonus: \+250/);
    assert.match(elements.get('wave-intro-description').textContent, /No-damage bonus:/);
    const expectedScore = String(browser.game.score).padStart(6, '0');
    browser.advance(WaveDefaults.clearDuration);
    assert.equal(elements.get('wave-intro-title').textContent, 'WAVE 2');
    browser.advance(WaveDefaults.introDuration);
    browser.game.endGame();
    browser.frame();

    assert.equal(elements.get('game-over-screen').classList.contains('is-hidden'), false);
    assert.equal(elements.get('final-score').textContent, expectedScore);
    assert.equal(elements.get('final-wave').textContent, '2');
    assert.equal(elements.get('final-destroyed').textContent, '1');
    assert.equal(elements.get('final-accuracy').textContent, '50%');
    assert.equal(elements.get('best-score').textContent, expectedScore);
    assert.equal(savedValues.get('space-attack.best-score'), String(Number(expectedScore)));
    assert.equal(browser.focusedElement, 'restart-button');

    elements.get('restart-button').click();
    browser.advance(WaveDefaults.introDuration);
    browser.game.endGame();
    browser.frame();
    assert.equal(elements.get('final-score').textContent, '000000');
    assert.equal(elements.get('best-score').textContent, expectedScore);
    elements.get('mute-button').click();
    assert.equal(savedValues.get('space-attack.muted'), 'false');
  } finally {
    browser.restore();
  }
});

test('browser startup and replay work with denied localStorage access', async () => {
  const browser = await bootBrowser(() => { throw new Error('Storage denied'); });

  try {
    browser.elements.get('start-button').click();
    browser.advance(WaveDefaults.introDuration);
    browser.game.score = 600;
    browser.game.endGame();
    browser.frame();
    assert.equal(browser.elements.get('best-score').textContent, '000600');
    browser.elements.get('restart-button').click();
    browser.advance(WaveDefaults.introDuration);
    browser.game.endGame();
    browser.frame();
    assert.equal(browser.elements.get('best-score').textContent, '000600');
    browser.elements.get('mute-button').click();
    assert.equal(browser.elements.get('mute-button').attributes.get('aria-pressed'), 'true');
  } finally {
    browser.restore();
  }
});

test('formation recovery announces playable continuation without changing score or lives', async () => {
  const browser = await bootBrowser(() => { throw new Error('Storage denied'); });

  try {
    browser.elements.get('start-button').click();
    browser.advance(WaveDefaults.introDuration);
    browser.game.formation.x = NaN;
    browser.game.formation.y = 5000;
    browser.frame();
    assert.match(browser.elements.get('game-status').textContent, /formation restored/);
    assert.equal(browser.game.state, GameState.PLAYING);
    assert.equal(browser.game.player.lives, 3);
    assert.equal(browser.game.score, 0);
    assert.ok(Number.isFinite(browser.game.formation.x));
    assert.ok(browser.game.enemies.every((enemy) => enemy.y < 320));
    assert.equal(browser.elements.get('pause-screen').classList.contains('is-hidden'), true);
    assert.equal(browser.elements.get('game-over-screen').classList.contains('is-hidden'), true);
  } finally {
    browser.restore();
  }
});
