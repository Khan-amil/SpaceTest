import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';
import { enemyVisuals } from './enemy-visuals.js';

/** Canvas-only presentation layer. Game balance and collision data stay in game.js/entities.js. */
export class Renderer {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reducedMotion = reducedMotion;
    this.stars = this.createStars();
  }

  createStars() {
    return Array.from({ length: 110 }, (_, index) => ({
      x: (index * 137) % GAME_WIDTH,
      y: (index * 71) % GAME_HEIGHT,
      size: 1 + (index % 3),
      speed: 8 + (index % 5) * 7,
    }));
  }

  render(game, time) {
    const context = this.ctx;
    const backgroundTime = this.reducedMotion ? 0 : time;

    context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.drawBackground(context, backgroundTime);
    game.projectiles.forEach((projectile) => this.drawProjectile(context, projectile));
    game.enemies.filter((enemy) => enemy.alive).forEach((enemy) => this.drawEnemy(context, enemy));
    this.drawPlayer(context, game.player);
  }

  drawBackground(context, time) {
    context.fillStyle = '#030918';
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const glow = context.createRadialGradient(480, 170, 0, 480, 170, 620);
    glow.addColorStop(0, '#15386799');
    glow.addColorStop(1, '#03091800');
    context.fillStyle = glow;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    context.fillStyle = '#d7f9ff';
    this.stars.forEach((star) => {
      const y = (star.y + time * star.speed) % GAME_HEIGHT;

      context.globalAlpha = 0.25 + star.size * 0.2;
      context.fillRect(star.x, y, star.size, star.size);
    });

    context.globalAlpha = 1;
  }

  drawPlayer(context, player) {
    const isBlinking = !this.reducedMotion
      && player.invulnerable > 0
      && Math.floor(player.invulnerable * 12) % 2;

    context.save();
    context.translate(player.x, player.y);
    context.globalAlpha = isBlinking ? 0.35 : 1;
    context.shadowColor = '#2eeaff';
    context.shadowBlur = 18;
    context.fillStyle = '#66eaff';
    context.beginPath();
    context.moveTo(0, -25);
    context.lineTo(19, 20);
    context.lineTo(0, 13);
    context.lineTo(-19, 20);
    context.closePath();
    context.fill();

    context.shadowBlur = 0;
    context.fillStyle = '#eafcff';
    context.beginPath();
    context.moveTo(0, -15);
    context.lineTo(6, 8);
    context.lineTo(-6, 8);
    context.closePath();
    context.fill();

    context.fillStyle = '#ff926b';
    context.fillRect(-12, 18, 7, 13);
    context.fillRect(5, 18, 7, 13);
    context.restore();
  }

  drawEnemy(context, enemy) {
    context.save();
    context.translate(enemy.x, enemy.y);
    enemyVisuals[enemy.kind](context, enemy);

    if (enemy.behavior === 'telegraphingDive') {
      // A persistent outline retains the warning in reduced-motion mode.
      const pulse = this.reducedMotion ? 0 : Math.sin(enemy.dive.elapsed * 16) * 3;

      context.shadowBlur = 0;
      context.strokeStyle = '#fff4c7';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, enemy.width / 2 + 6 + pulse, 0, Math.PI * 2);
      context.stroke();
    }

    context.restore();
  }

  drawProjectile(context, projectile) {
    const isPlayerProjectile = projectile.owner === 'player';

    context.save();
    context.shadowColor = isPlayerProjectile ? '#55eaff' : '#ff537b';
    context.shadowBlur = 12;
    context.fillStyle = isPlayerProjectile ? '#b9fbff' : '#ff84a2';
    context.fillRect(
      projectile.x - projectile.width / 2,
      projectile.y - projectile.height / 2,
      projectile.width,
      projectile.height,
    );
    context.restore();
  }
}
