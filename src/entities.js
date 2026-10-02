import { GAME_WIDTH, PlayerDefaults } from './constants.js';
import { EnemyBehavior, getEnemyDefinition } from './enemy-ai.js';

let nextEntityId = 1;

export const createPlayer = () => ({
  id: nextEntityId++,
  type: 'player',
  x: GAME_WIDTH / 2,
  y: 570,
  width: PlayerDefaults.width,
  height: PlayerDefaults.height,
  lives: PlayerDefaults.maxLives,
  cooldown: 0,
  invulnerable: 0,
});

export function createEnemy(x, y, row, kind = 'scout') {
  const definition = getEnemyDefinition(kind);

  return {
    id: nextEntityId++,
    type: 'enemy',
    x,
    y,
    width: definition.width,
    height: definition.height,
    row,
    kind,
    behavior: EnemyBehavior.FORMATION,
    home: { x, y },
    formationOffset: { x: 0, y: 0 },
    dive: null,
    health: definition.health,
    value: definition.value,
    alive: true,
  };
}

export const createProjectile = (x, y, velocityY, owner) => ({
  id: nextEntityId++,
  type: 'projectile',
  x,
  y,
  width: 5,
  height: 14,
  velocityY,
  velocityX: 0,
  owner,
  alive: true,
});

export function overlaps(first, second) {
  const horizontalDistance = Math.abs(first.x - second.x) * 2;
  const horizontalLimit = first.width + second.width;
  const verticalDistance = Math.abs(first.y - second.y) * 2;
  const verticalLimit = first.height + second.height;

  return horizontalDistance < horizontalLimit && verticalDistance < verticalLimit;
}
