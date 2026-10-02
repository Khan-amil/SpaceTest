import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('styles.css', root), 'utf8');

test('the playable contract is visible and keyboard-accessible in the HTML shell', () => {
  assert.match(html, /id="start-button"[^>]*type="button"/);
  assert.match(html, /id="restart-button"[^>]*type="button"/);
  assert.match(html, /id="resume-button"[^>]*type="button"/);
  assert.match(html, /id="mute-button"[^>]*aria-pressed="false"/);
  assert.match(html, /id="game-status"[^>]*aria-live="polite"/);
  assert.match(html, /WASD[\s\S]*ARROWS[\s\S]*SPACE[\s\S]*ESC[\s\S]*M[\s\S]*ENTER/);
  assert.match(html, /id="lives">3 \/ 3</);
});

test('reduced motion has an explicit CSS fallback', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
