function drawWing(context, points, fillStyle, strokeStyle) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);

  points.slice(1).forEach(([x, y]) => {
    context.lineTo(x, y);
  });

  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
  context.strokeStyle = strokeStyle;
  context.lineWidth = 1.5;
  context.stroke();
}

/** Draw a compact wasp silhouette around the enemy's local origin. */
export function drawWasp(context, enemy) {
  const wingOffset = enemy.wingOffset ?? 0;

  context.save();
  context.lineJoin = 'miter';

  // Broad swept wings make the insect silhouette recognizable without relying on color.
  drawWing(
    context,
    [[-4, -5], [-15, -13 - wingOffset], [-19, -10 - wingOffset], [-11, 1], [-5, 3]],
    '#e8b83f',
    '#fff0a3',
  );
  drawWing(
    context,
    [[4, -5], [15, -13 - wingOffset], [19, -10 - wingOffset], [11, 1], [5, 3]],
    '#e8b83f',
    '#fff0a3',
  );

  // The tapered abdomen points toward the dive direction; magenta bands add contrast.
  context.fillStyle = '#d69b28';
  context.strokeStyle = '#fff0a3';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -10);
  context.lineTo(5, -3);
  context.lineTo(4, 7);
  context.lineTo(0, 14);
  context.lineTo(-4, 7);
  context.lineTo(-5, -3);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = '#c33183';
  context.fillRect(-4, 1, 8, 2);
  context.fillRect(-3, 6, 6, 2);

  // Antennae and a split engine plume keep the small sprite legible at game scale.
  context.strokeStyle = '#f8dc7b';
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(-2, -8);
  context.lineTo(-6, -13);
  context.moveTo(2, -8);
  context.lineTo(6, -13);
  context.stroke();

  context.fillStyle = '#ff70b7';
  context.beginPath();
  context.moveTo(-3, -8);
  context.lineTo(0, -13);
  context.lineTo(3, -8);
  context.closePath();
  context.fill();

  context.restore();
}
