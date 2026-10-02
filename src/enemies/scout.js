/** Draw the scout around the origin; the renderer owns positioning. */
export function drawScout(context, enemy) {
  context.save();
  context.shadowColor = '#ff35d3';
  context.shadowBlur = 10;
  context.fillStyle = '#ed36c8';
  context.beginPath();
  context.moveTo(0, -14);
  context.lineTo(10, -7);
  context.lineTo(19, 1);
  context.lineTo(12, 5);
  context.lineTo(8, 12);
  context.lineTo(0, 8);
  context.lineTo(-8, 12);
  context.lineTo(-12, 5);
  context.lineTo(-19, 1);
  context.lineTo(-10, -7);
  context.closePath();
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = '#ffb2f0';
  context.beginPath();
  context.moveTo(0, -9);
  context.lineTo(5, -2);
  context.lineTo(0, 4);
  context.lineTo(-5, -2);
  context.closePath();
  context.fill();

  context.fillStyle = '#7b1c91';
  context.beginPath();
  context.moveTo(-13, 2);
  context.lineTo(-7, 0);
  context.lineTo(-9, 6);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(13, 2);
  context.lineTo(7, 0);
  context.lineTo(9, 6);
  context.closePath();
  context.fill();
  context.restore();
}
