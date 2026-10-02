export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;
export const GameState = Object.freeze({ TITLE: 'title', PLAYING: 'playing', GAME_OVER: 'gameOver' });
export const PlayerDefaults = Object.freeze({ width: 38, height: 45, speed: 340, maxLives: 3, fireInterval: 0.22, invulnerability: 1.1 });
export const WaveDefaults = Object.freeze({ columns: 7, rows: 3, enemyWidth: 38, enemyHeight: 28, spacingX: 75, spacingY: 53, baseSpeed: 32, dropDistance: 22, fireInterval: 1.15 });
