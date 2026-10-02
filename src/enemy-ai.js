import { scoutDefinition } from './enemies/scout-definition.js';
import { waspDefinition } from './enemies/wasp-definition.js';
import { sentinelDefinition } from './enemies/sentinel-definition.js';

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
    returnStart: null,
    shotFired: false,
  };

  return true;
}

/** Basic time-parameterized paths; Phase 3 replaces these with authored Bézier segments. */
export function updateEnemyBehavior(enemy, formation, dt) {
  if (!enemy.alive || enemy.behavior === EnemyBehavior.EXPLODING) return null;

  const homePosition = getFormationPosition(enemy, formation);
  const definition = getEnemyDefinition(enemy.kind);

  if (isFormationMember(enemy)) {
    enemy.x = homePosition.x;
    enemy.y = homePosition.y;

    if (enemy.behavior === EnemyBehavior.FORMATION) return null;

    enemy.dive.elapsed += dt;

    if (enemy.dive.elapsed < 0.45) return null;

    enemy.behavior = EnemyBehavior.DIVING;
    enemy.dive.elapsed = 0;
    enemy.dive.start = { x: enemy.x, y: enemy.y };
    return 'started';
  }

  enemy.dive.elapsed += dt;

  if (enemy.behavior === EnemyBehavior.DIVING) {
    const progress = Math.min(1, enemy.dive.elapsed / definition.dive.duration);
    const lateralTravel = Math.sin(progress * Math.PI * 2 * definition.dive.cycles)
      * definition.dive.lateralWidth * enemy.dive.direction;

    enemy.x = enemy.dive.start.x + lateralTravel;
    enemy.y = enemy.dive.start.y + Math.sin(progress * Math.PI) * definition.dive.depth;

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
    const progress = Math.min(1, enemy.dive.elapsed / 0.7);
    const easedProgress = progress * progress * (3 - 2 * progress);
    const start = enemy.dive.returnStart;

    enemy.x = start.x + (homePosition.x - start.x) * easedProgress;
    enemy.y = start.y + (homePosition.y - start.y) * easedProgress;

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
