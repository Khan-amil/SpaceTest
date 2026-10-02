import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreferencesStore } from '../src/storage.js';

function createMemoryStorage() {
  const values = new Map();

  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('best score and mute are restored in a fresh store and lower scores cannot replace best', () => {
  const storage = createMemoryStorage();
  const store = createPreferencesStore(() => storage);

  assert.deepEqual(store.load(), { bestScore: 0, muted: false });
  assert.equal(store.saveBestScore(2450), true);
  assert.equal(store.saveMuted(true), true);
  assert.equal(store.saveBestScore(1200), false);
  assert.deepEqual(createPreferencesStore(() => storage).load(), { bestScore: 2450, muted: true });
  assert.deepEqual([...storage.values.keys()], ['space-attack.best-score', 'space-attack.muted']);
});

test('denied storage access, reads, and writes do not prevent in-memory preferences', () => {
  const fail = () => { throw new Error('Storage denied'); };
  const stores = [
    createPreferencesStore(),
    createPreferencesStore(fail),
    createPreferencesStore(() => ({ getItem: fail, setItem: fail })),
  ];

  for (const store of stores) {
    assert.deepEqual(store.load(), { bestScore: 0, muted: false });
    assert.equal(store.saveBestScore(500), false);
    assert.equal(store.saveMuted(true), false);
    assert.deepEqual(store.load(), { bestScore: 500, muted: true });
  }
});

test('malformed saved values and invalid new scores use safe defaults', () => {
  for (const score of ['-1', '123junk', 'Infinity', '2.5', '9007199254740992', '']) {
    const store = createPreferencesStore(() => ({ getItem: () => score }));

    assert.deepEqual(store.load(), { bestScore: 0, muted: false });
    assert.equal(store.saveBestScore(-10), false);
    assert.equal(store.saveBestScore(Number.NaN), false);
    assert.equal(store.saveBestScore(1.5), false);
  }
});
