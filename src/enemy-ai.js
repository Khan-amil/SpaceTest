import { scoutDefinition } from './enemies/scout-definition.js';
import { waspDefinition } from './enemies/wasp-definition.js';
import { sentinelDefinition } from './enemies/sentinel-definition.js';
import { createDivePath, evaluateDivePath, evaluateReturnPath } from './dive-paths.js';

export const EnemyBehavior = Object.freeze({
  FORMATION: 'formation',
  TELEGRAPHING_DIVE: 'telegraphingDive',
  DIVING: 'diving',
  RETURNING: 'returning',
  EXPLODING: 'exploding',
});

export const enemyDefinitions = Object.freeze({
  scout: scoutDefinition,
  wasp: waspDefinition,
  sentinel: sentinelDefinition,
});

export function getEnemyDefinition(kind) {
  if (!Object.hasOwn(enemyDefinitions, kind)) {
    throw new RangeError(`Unknown enemy kind: ${kind}`);
  }

  return enemyDefinitions[kind];
}

export function isFormationMember(enemy) {
  return enemy.alive && (
    enemy.behavior === EnemyBehavior.FORMATION
    || enemy.behavior === EnemyBehavior.TELEGRAPHING_DIVE
  );
}

export function getFormationPosition(enemy, formation) {
  const definition = getEnemyDefinition(enemy.kind);
  const lateralBob = Math.sin(formation.elapsed * definition.bobFrequency + enemy.home.y)
    * definition.bobAmplitude;

  return {
    x: enemy.home.x + formation.x + enemy.formationOffset.x + lateralBob,
    y: enemy.home.y + formation.y + enemy.formationOffset.y,
  };
}

export function beginEnemyDive(enemy, direction) {
  if (!enemy.alive || enemy.behavior !== EnemyBehavior.FORMATION) return false;

  enemy.behavior = EnemyBehavior.TELEGRAPHING_DIVE;
  enemy.dive = {
    elapsed: 0,
    direction,
    start: null,
    path: null,
    returnStart: null,
    shotFired: false,
  };

  return true;
}

export function updateEnemyBehavior(enemy, formation, dt, player = null) {
  if (!enemy.alive || enemy.behavior === EnemyBehavior.EXPLODING) return null;

  const homePosition = getFormationPosition(enemy, formation);
  const definition = getEnemyDefinition(enemy.kind);

  if (isFormationMember(enemy)) {
    enemy.x = homePosition.x;
    enemy.y = homePosition.y;

    if (enemy.behavior === EnemyBehavior.FORMATION) return null;

    enemy.dive.elapsed += dt;

    if (enemy.dive.elapsed < definition.dive.telegraphDuration) return null;
    // A warning already underway waits through respawn protection before departing.
    if (player?.invulnerable > 0) return null;

    enemy.behavior = EnemyBehavior.DIVING;
    enemy.dive.elapsed = 0;
    enemy.dive.start = { x: enemy.x, y: enemy.y };
    enemy.dive.path = createDivePath(enemy, definition.dive, enemy.dive.direction, player);
    return 'started';
  }

  enemy.dive.elapsed += dt;

  if (enemy.behavior === EnemyBehavior.DIVING) {
    const progress = Math.min(1, enemy.dive.elapsed / enemy.dive.path.duration);
    const position = evaluateDivePath(enemy.dive.path, progress);

    enemy.x = position.x;
    enemy.y = position.y;

    if (progress === 1) {
      enemy.behavior = EnemyBehavior.RETURNING;
      enemy.dive.elapsed = 0;
      enemy.dive.returnStart = { x: enemy.x, y: enemy.y };
      return null;
    }

    if (definition.dive.aimedShot && progress >= 0.2 && !enemy.dive.shotFired) {
      enemy.dive.shotFired = true;
      return 'fire';
    }

    return null;
  }

  if (enemy.behavior === EnemyBehavior.RETURNING) {
    // Interpolate toward the current slot, never the historical position at dive start.
    const progress = Math.min(1, enemy.dive.elapsed / definition.dive.returnDuration);
    const start = enemy.dive.returnStart;
    const position = evaluateReturnPath(start, homePosition, progress);

    enemy.x = position.x;
    enemy.y = position.y;

    if (progress === 1) {
      enemy.behavior = EnemyBehavior.FORMATION;
      enemy.dive = null;
      return 'ended';
    }
  }

  return null;
}

export function cancelEnemyBehavior(enemy) {
  enemy.alive = false;
  enemy.health = 0;
  enemy.behavior = EnemyBehavior.EXPLODING;
  enemy.dive = null;
}
