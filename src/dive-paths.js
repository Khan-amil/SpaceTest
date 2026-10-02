import { GAME_HEIGHT, GAME_WIDTH, PlayerDefaults } from './constants.js';

/** Cubic Bézier in design coordinates; time is normalized within each segment. */
export function evaluateBezier(points, progress) {
  const time = Math.max(0, Math.min(1, progress));
  const remaining = 1 - time;
  const weights = [remaining ** 3, 3 * remaining ** 2 * time, 3 * remaining * time ** 2, time ** 3];

  return {
    x: points.reduce((total, point, index) => total + point.x * weights[index], 0),
    y: points.reduce((total, point, index) => total + point.y * weights[index], 0),
  };
}

function constrainX(x, width) {
  return Math.max(width / 2, Math.min(GAME_WIDTH - width / 2, x));
}

export function createDivePath(enemy, definition, direction, player) {
  const start = { x: enemy.x, y: enemy.y };
  const width = definition.lateralWidth;
  const playerX = player?.x ?? GAME_WIDTH / 2;
  const clearance = player?.width ?? PlayerDefaults.width;
  let exitX = constrainX(start.x + direction * width, enemy.width);

  // Sample aim once at departure: movement afterward must not turn into homing.
  if (Math.abs(exitX - playerX) < clearance) {
    exitX = constrainX(playerX + direction * (clearance + enemy.width), enemy.width);
  }

  if (Math.abs(exitX - playerX) < clearance) {
    exitX = constrainX(playerX - direction * (clearance + enemy.width), enemy.width);
  }

  const end = { x: exitX, y: Math.max(GAME_HEIGHT + enemy.height, start.y + definition.depth) };
  const verticalTravel = end.y - start.y;
  const controlX = (offset) => constrainX(start.x + direction * offset, enemy.width);
  let segments;

  if (definition.segments === 2) {
    const join = { x: start.x, y: start.y + verticalTravel / 2 };
    const tangentX = direction * Math.min(
      width / 2,
      start.x - enemy.width / 2,
      GAME_WIDTH - enemy.width / 2 - start.x,
    );
    const tangentY = verticalTravel / 6;

    // Equal-duration segments share a tangent so the corkscrew has no velocity jump.
    segments = [
      [
        start,
        { x: controlX(width), y: start.y + tangentY },
        { x: join.x + tangentX, y: join.y - tangentY },
        join,
      ],
      [
        join,
        { x: join.x - tangentX, y: join.y + tangentY },
        { x: controlX(-width), y: end.y - tangentY },
        end,
      ],
    ];
  } else {
    segments = [[
      start,
      { x: controlX(width * 2), y: start.y + verticalTravel / 3 },
      { x: controlX(-width * 2), y: end.y - verticalTravel / 3 },
      end,
    ]];
  }

  let duration = definition.duration;

  if (definition.maxLateralAcceleration) {
    // A cubic's second derivative is linear. Bounding both ends bounds the whole segment.
    const secondDifference = Math.max(...segments.flatMap((points) => [
      Math.abs(points[2].x - 2 * points[1].x + points[0].x),
      Math.abs(points[3].x - 2 * points[2].x + points[1].x),
    ]));
    const minimumSegmentDuration = Math.sqrt(6 * secondDifference / definition.maxLateralAcceleration);
    duration = Math.max(duration, minimumSegmentDuration * segments.length);
  }

  return { segments, duration };
}

export function evaluateDivePath(path, progress) {
  const segmentTime = Math.max(0, Math.min(1, progress)) * path.segments.length;
  const index = Math.min(path.segments.length - 1, Math.floor(segmentTime));

  return evaluateBezier(path.segments[index], segmentTime - index);
}

export function evaluateReturnPath(start, target, progress) {
  // Upward departure and a zero final tangent soften re-entry into the moving slot.
  const upwardControl = { x: start.x, y: Math.min(start.y, target.y) - 60 };
  return evaluateBezier([start, upwardControl, target, target], progress);
}
