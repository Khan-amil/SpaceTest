import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';
import { enemyVisuals } from './enemy-visuals.js';
import { Effects } from './effects.js';

/** Canvas-only presentation layer. Game balance and collision data stay in game.js/entities.js. */
export class Renderer {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reducedMotion = reducedMotion;
    this.stars = this.createStars();
    this.effects = new Effects({ reducedMotion });
    this.time = 0;
  }

  createStars() {
    // Sample visual positions independently; modular spacing creates visible columns.
    // Generate once so stars remain stable between frames and in reduced-motion mode.
    return Array.from({ length: 110 }, (_, index) => {
      const layer = index % 3;

      return {
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: 0.6 + layer * 0.5 + Math.random() * 0.4,
        speed: [5, 14, 28][layer] + Math.random() * 3,
        opacity: 0.2 + layer * 0.14 + Math.random() * 0.16,
      };
    });
  }

  render(game, time) {
    const context = this.ctx;
    const backgroundTime = this.reducedMotion ? 0 : time;
    this.time = backgroundTime;

    context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.drawBackground(context, backgroundTime);
    context.save();
    const shake = this.effects.shakeRemaining / 0.22 * this.effects.shakeStrength;
    context.translate(Math.sin(time * 79) * shake, Math.cos(time * 67) * shake);
    // Effects sit underneath threats so explosions never obscure hostile projectiles.
    this.effects.draw(context);
    game.enemies.filter((enemy) => enemy.alive).forEach((enemy) => this.drawEnemy(context, enemy));
    this.drawPlayer(context, game.player);
    game.projectiles.forEach((projectile) => this.drawProjectile(context, projectile));
    context.restore();
  }

  drawBackground(context, time) {
    context.fillStyle = '#030918';
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const nebula = context.createRadialGradient(780, 350, 10, 780, 350, 400);
    nebula.addColorStop(0, '#68285d20');
    nebula.addColorStop(1, '#03091800');
    context.fillStyle = nebula;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const glow = context.createRadialGradient(480, 170, 0, 480, 170, 620);
    glow.addColorStop(0, '#15386799');
    glow.addColorStop(1, '#03091800');
    context.fillStyle = glow;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    context.fillStyle = '#d7f9ff';
    this.stars.forEach((star) => {
      const y = (star.y + time * star.speed) % GAME_HEIGHT;

      context.globalAlpha = star.opacity;
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
    context.rotate(Math.max(-0.12, Math.min(0.12, player.velocityX / 2800)));
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
    const flameLength = 11 + Math.sin(this.time * 35) * 4;
    context.fillRect(-12, 18, 7, flameLength);
    context.fillRect(5, 18, 7, flameLength);

    if (player.invulnerable > 0) {
      context.strokeStyle = '#b9fbff';
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(0, 0, 29, 36, 0, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  drawEnemy(context, enemy) {
    context.save();
    context.translate(enemy.x, enemy.y);
    // Banking is purely visual; the simulation's collision shape stays axis-aligned.
    const bank = enemy.behavior === 'diving' ? Math.sin(this.time * 4 + enemy.home.x) * 0.14 : 0;
    context.rotate(this.reducedMotion ? 0 : bank);
    context.fillStyle = '#ff75d8';
    context.globalAlpha = 0.55;
    context.fillRect(-3, -enemy.height / 2 - 5, 6, 5 + Math.sin(this.time * 24) * 2);
    context.globalAlpha = 1;
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
    // A luminous core plus a short trail keeps both projectile owners readable.
    context.fillStyle = isPlayerProjectile ? '#55eaff33' : '#ff537b44';
    const trailY = projectile.y - Math.sign(projectile.velocityY) * 20;
    context.fillRect(projectile.x - 2, trailY - 7, 4, 14);
    context.fillStyle = isPlayerProjectile ? '#b9fbff' : '#ff84a2';
    context.fillRect(
      projectile.x - projectile.width / 2,
      projectile.y - projectile.height / 2,
      projectile.width,
      projectile.height,
    );
    context.fillStyle = '#ffffff';
    context.fillRect(projectile.x - 1, projectile.y - 4, 2, 8);
    context.restore();
  }
}
