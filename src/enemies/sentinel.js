/** Draws a shielded sentinel at the caller's translated canvas origin. */
export function drawSentinel(context, enemy) {
  context.save();
  context.shadowColor = '#48d9ff';
  context.shadowBlur = 12;

  context.fillStyle = '#215b83';
  context.beginPath();
  context.moveTo(-19, -10);
  context.lineTo(-12, -15);
  context.lineTo(12, -15);
  context.lineTo(19, -10);
  context.lineTo(16, 11);
  context.lineTo(0, 17);
  context.lineTo(-16, 11);
  context.closePath();
  context.fill();

  context.shadowBlur = 0;

  if (enemy.health > 1) {
    drawArmorShield(context);
  } else {
    drawExposedCore(context);
  }

  context.restore();
}

function drawArmorShield(context) {
  context.fillStyle = '#91efff';
  context.beginPath();
  context.moveTo(-22, -8);
  context.lineTo(-14, -13);
  context.lineTo(0, -9);
  context.lineTo(14, -13);
  context.lineTo(22, -8);
  context.lineTo(18, 7);
  context.lineTo(9, 12);
  context.lineTo(0, 8);
  context.lineTo(-9, 12);
  context.lineTo(-18, 7);
  context.closePath();
  context.fill();

  context.fillStyle = '#163e64';
  context.beginPath();
  context.moveTo(-12, -5);
  context.lineTo(0, -9);
  context.lineTo(12, -5);
  context.lineTo(9, 4);
  context.lineTo(0, 8);
  context.lineTo(-9, 4);
  context.closePath();
  context.fill();

  context.fillStyle = '#d9fbff';
  context.fillRect(-15, -3, 5, 3);
  context.fillRect(10, -3, 5, 3);
}

function drawExposedCore(context) {
  // The open center and separated armor plates show the damaged state by shape.
  context.fillStyle = '#91efff';
  context.beginPath();
  context.moveTo(-19, -10);
  context.lineTo(-13, -14);
  context.lineTo(-8, -9);
  context.lineTo(-11, -3);
  context.lineTo(-18, 1);
  context.closePath();
  context.fill();

  context.beginPath();
  context.moveTo(19, -10);
  context.lineTo(13, -14);
  context.lineTo(8, -9);
  context.lineTo(11, -3);
  context.lineTo(18, 1);
  context.closePath();
  context.fill();

  context.fillStyle = '#ffcb68';
  context.beginPath();
  context.moveTo(0, -10);
  context.lineTo(8, -2);
  context.lineTo(6, 8);
  context.lineTo(0, 12);
  context.lineTo(-6, 8);
  context.lineTo(-8, -2);
  context.closePath();
  context.fill();

  context.fillStyle = '#fff5cf';
  context.fillRect(-2, -3, 4, 7);
}
