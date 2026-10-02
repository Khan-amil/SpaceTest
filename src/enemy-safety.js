import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';
import { EnemyBehavior, getEnemyDefinition, getFormationPosition } from './enemy-ai.js';
import { FORMATION_BOTTOM } from './formation.js';

const MAX_PATH_DURATION = 10;
const STAGE_TIMEOUT_MARGIN = 1;

function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function validPath(path) {
  return path && Number.isFinite(path.duration) && path.duration > 0
    && path.duration <= MAX_PATH_DURATION && Array.isArray(path.segments)
    && path.segments.length >= 1 && path.segments.length <= 2
    && path.segments.every((points) => Array.isArray(points)
      && points.length === 4 && points.every(finitePoint));
}

function stageDuration(enemy, player) {
  const definition = getEnemyDefinition(enemy.kind).dive;

  if (enemy.behavior === EnemyBehavior.FORMATION) return Infinity;
  if (!enemy.dive || !Number.isFinite(enemy.dive.elapsed) || enemy.dive.elapsed < 0) return null;

  if (enemy.behavior === EnemyBehavior.TELEGRAPHING_DIVE) {
    if (enemy.dive.direction !== -1 && enemy.dive.direction !== 1) return null;
    // A legitimate warning can wait as long as respawn protection lasts.
    return player.invulnerable > 0 ? Infinity : definition.telegraphDuration;
  }

  if (enemy.behavior === EnemyBehavior.DIVING) {
    return validPath(enemy.dive.path) ? enemy.dive.path.duration : null;
  }

  if (enemy.behavior === EnemyBehavior.RETURNING) {
    return finitePoint(enemy.dive.returnStart) ? definition.returnDuration : null;
  }

  return null;
}

/** Independent stage time catches a stuck/reset animation clock as well as bad path data. */
export function repairEnemyStates(enemies, formation, layout, dt, player) {
  const repaired = [];
  const formationLeft = (GAME_WIDTH - (layout.columns - 1) * layout.spacingX) / 2;

  for (const [index, enemy] of enemies.entries()) {
    if (!enemy.alive) continue;

    let invalidAnchor = !finitePoint(enemy.home) || !finitePoint(enemy.formationOffset);

    if (!invalidAnchor) {
      const slotX = enemy.home.x + enemy.formationOffset.x;
      const slotY = enemy.home.y + enemy.formationOffset.y;
      const bob = getEnemyDefinition(enemy.kind).bobAmplitude;
      // Every repaired layout can fit at translation zero, so its bounds cannot invert.
      invalidAnchor = slotX < 38 + bob || slotX > GAME_WIDTH - 38 - bob
        || slotY < enemy.height / 2 || slotY > FORMATION_BOTTOM - enemy.height / 2;
    }

    if (invalidAnchor) {
      const row = Math.floor(index / layout.columns);
      const column = index % layout.columns;
      enemy.home = { x: formationLeft + column * layout.spacingX, y: layout.startY + row * layout.spacingY };
      enemy.formationOffset = { x: 0, y: 0 };
    }

    const duration = stageDuration(enemy, player);
    const invalidWatchdog = enemy.behaviorWatchdog && (
      !Number.isFinite(enemy.behaviorWatchdog.elapsed) || enemy.behaviorWatchdog.elapsed < 0
    );

    if (!enemy.behaviorWatchdog || enemy.behaviorWatchdog.behavior !== enemy.behavior) {
      enemy.behaviorWatchdog = { behavior: enemy.behavior, elapsed: 0 };
    }

    if (Number.isFinite(duration)) enemy.behaviorWatchdog.elapsed += dt;
    const timedOut = duration !== null && (
      enemy.behaviorWatchdog.elapsed > duration + STAGE_TIMEOUT_MARGIN
      || (enemy.dive?.elapsed ?? 0) > duration + STAGE_TIMEOUT_MARGIN
    );
    const invalidPosition = !finitePoint(enemy) || Math.abs(enemy.x) > GAME_WIDTH * 2
      || Math.abs(enemy.y) > GAME_HEIGHT * 2;

    if (!invalidAnchor && !invalidPosition && !invalidWatchdog && duration !== null && !timedOut) continue;

    // Restore only movement state: health, score, lives and clear eligibility remain intact.
    enemy.behavior = EnemyBehavior.FORMATION;
    enemy.dive = null;
    enemy.behaviorWatchdog = { behavior: EnemyBehavior.FORMATION, elapsed: 0 };
    enemy.aimedShotCooldown = getEnemyDefinition(enemy.kind).dive.shotCooldown ?? 0;
    const position = getFormationPosition(enemy, formation);
    enemy.x = position.x;
    enemy.y = position.y;
    repaired.push(enemy);
  }

  return repaired;
}
