import { GAME_WIDTH, PlayerDefaults } from './constants.js';

let nextEntityId = 1;
export const createPlayer = () => ({ id: nextEntityId++, type: 'player', x: GAME_WIDTH / 2, y: 570, width: PlayerDefaults.width, height: PlayerDefaults.height, lives: PlayerDefaults.maxLives, cooldown: 0, invulnerable: 0 });
export const createEnemy = (x, y, row) => ({ id: nextEntityId++, type: 'enemy', x, y, width: 38, height: 28, row, alive: true });
export const createProjectile = (x, y, velocityY, owner) => ({ id: nextEntityId++, type: 'projectile', x, y, width: 5, height: 14, velocityY, owner, alive: true });
export function overlaps(a, b) { return Math.abs(a.x - b.x) * 2 < a.width + b.width && Math.abs(a.y - b.y) * 2 < a.height + b.height; }
