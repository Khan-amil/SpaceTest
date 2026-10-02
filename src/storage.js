const STORAGE_KEYS = Object.freeze({
  bestScore: 'space-attack.best-score',
  muted: 'space-attack.muted',
});

const DEFAULT_PREFERENCES = Object.freeze({
  bestScore: 0,
  muted: false,
});

function getStoredValue(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function saveStoredValue(storage, key, value) {
  try {
    if (!storage) return false;

    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function parseBestScore(value) {
  const parsedScore = Number(value);

  return /^\d+$/.test(value ?? '') && Number.isSafeInteger(parsedScore) && parsedScore >= 0
    ? parsedScore
    : DEFAULT_PREFERENCES.bestScore;
}

function resolveStorage(getStorage) {
  try {
    return getStorage();
  } catch {
    return null;
  }
}

/**
 * Keeps optional browser persistence behind a failure-safe adapter. Gameplay must not
 * depend on storage, because private browsing and restrictive browser settings can deny it.
 */
export function createPreferencesStore(getStorage = () => null) {
  // Access to the localStorage property itself can throw, before getItem is even called.
  const storage = resolveStorage(getStorage);
  const preferences = {
    bestScore: parseBestScore(getStoredValue(storage, STORAGE_KEYS.bestScore)),
    muted: getStoredValue(storage, STORAGE_KEYS.muted) === 'true',
  };

  return {
    load() {
      return { ...preferences };
    },

    saveBestScore(score) {
      if (!Number.isSafeInteger(score) || score <= preferences.bestScore) return false;

      preferences.bestScore = score;

      return saveStoredValue(storage, STORAGE_KEYS.bestScore, String(score));
    },

    saveMuted(muted) {
      preferences.muted = Boolean(muted);

      return saveStoredValue(storage, STORAGE_KEYS.muted, String(preferences.muted));
    },
  };
}
