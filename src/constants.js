export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;

export const GameState = Object.freeze({
  TITLE: 'title',
  WAVE_INTRO: 'waveIntro',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameOver',
});

export const PlayerDefaults = Object.freeze({
  width: 38,
  height: 45,
  speed: 340,
  maxLives: 3,
  fireInterval: 0.22,
  invulnerability: 1.1,
});

export const WaveDefaults = Object.freeze({
  columns: 7,
  rows: 3,
  enemyWidth: 38,
  enemyHeight: 28,
  spacingX: 75,
  spacingY: 53,
  baseSpeed: 32,
  dropDistance: 22,
  fireInterval: 1.15,
  // Hints and two reward lines need several seconds of safe reading time.
  introDuration: 4,
  clearDuration: 3.5,
});

/** The game-session contract. A future continue system must explicitly revise this rule. */
export const SessionRules = Object.freeze({
  maxLives: PlayerDefaults.maxLives,
  continues: false,
  advancesOnWaveClear: true,
});

/**
 * Public simulation events. Presentation systems consume these; they never infer game
 * state from canvas pixels or mutate the model in response to a draw call.
 */
export const GameEvent = Object.freeze({
  GAME_STARTED: 'gameStarted',
  GAME_PAUSED: 'gamePaused',
  GAME_RESUMED: 'gameResumed',
  PLAYER_FIRED: 'playerFired',
  PLAYER_DAMAGED: 'playerDamaged',
  PLAYER_CONTACTED: 'playerContacted',
  ENEMY_DESTROYED: 'enemyDestroyed',
  ENEMY_DAMAGED: 'enemyDamaged',
  ENEMY_DIVE_TELEGRAPHED: 'enemyDiveTelegraphed',
  ENEMY_DIVE_STARTED: 'enemyDiveStarted',
  ENEMY_DIVE_ENDED: 'enemyDiveEnded',
  ENEMY_STATE_RECOVERED: 'enemyStateRecovered',
  WAVE_STARTED: 'waveStarted',
  WAVE_CLEARED: 'waveCleared',
  POWERUP_COLLECTED: 'powerupCollected',
  GAME_OVER: 'gameOver',
});
