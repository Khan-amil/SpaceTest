import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';
import { getEnemyDefinition, getFormationPosition, isFormationMember } from './enemy-ai.js';

const SIDE_MARGIN = 38;
// Formation targets stay above the player's movement zone and upward muzzle position.
export const FORMATION_BOTTOM = GAME_HEIGHT / 2;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function horizontalBounds(enemies) {
  let minimum = -Infinity;
  let maximum = Infinity;

  for (const enemy of enemies.filter(isFormationMember)) {
    const slotX = enemy.home.x + enemy.formationOffset.x;
    const bob = getEnemyDefinition(enemy.kind).bobAmplitude;
    const margin = Math.max(SIDE_MARGIN, enemy.width / 2);

    minimum = Math.max(minimum, margin + bob - slotX);
    maximum = Math.min(maximum, GAME_WIDTH - margin - bob - slotX);
  }

  return { minimum, maximum };
}

/** Repair shared translation before movement, without treating repair as an edge turn. */
export function constrainFormation(formation, livingEnemies) {
  const { minimum, maximum } = horizontalBounds(livingEnemies);
  let minimumY = -Infinity;
  let maximumY = Infinity;

  // Absent divers reserve vertical room for their return, but do not steer horizontal edges.
  for (const enemy of livingEnemies) {
    const slotY = enemy.home.y + enemy.formationOffset.y;
    minimumY = Math.max(minimumY, enemy.height / 2 - slotY);
    maximumY = Math.min(maximumY, FORMATION_BOTTOM - enemy.height / 2 - slotY);
  }

  const previousX = formation.x;
  const previousY = formation.y;
  const previousElapsed = formation.elapsed;
  formation.x = clamp(Number.isFinite(previousX) ? previousX : 0, minimum, maximum);
  formation.y = clamp(Number.isFinite(previousY) ? previousY : 0, minimumY, maximumY);
  formation.elapsed = Number.isFinite(previousElapsed) && previousElapsed >= 0 ? previousElapsed : 0;

  return formation.x !== previousX || formation.y !== previousY || formation.elapsed !== previousElapsed;
}

export function advanceFormation(formation, livingEnemies, direction, movement, dt) {
  constrainFormation(formation, livingEnemies);
  const members = livingEnemies.filter(isFormationMember);

  if (members.length === 0) {
    formation.elapsed += dt;
    return direction;
  }

  const { minimum, maximum } = horizontalBounds(members);
  const nextX = formation.x + direction * movement.speed * dt;
  const crossesEdge = direction > 0 ? nextX > maximum : nextX < minimum;

  if (crossesEdge) {
    // Only an outward crossing turns and descends; an outlying re-entry never does.
    formation.x = direction > 0 ? maximum : minimum;
    formation.y += movement.dropDistance;
    direction *= -1;
  } else {
    formation.x = nextX;
  }

  formation.elapsed += dt;
  constrainFormation(formation, livingEnemies);
  return direction;
}

export function synchronizeFormationMembers(formation, livingEnemies) {
  for (const enemy of livingEnemies.filter(isFormationMember)) {
    const position = getFormationPosition(enemy, formation);
    enemy.x = position.x;
    enemy.y = position.y;
  }
}
