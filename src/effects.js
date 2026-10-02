import { GAME_HEIGHT, GAME_WIDTH, GameEvent } from './constants.js';

export const PARTICLE_CAPACITY = 240;

/** Fixed storage keeps rapid-fire effects bounded, including during long sessions. */
export class Effects {
  constructor({ reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
    this.particles = Array.from({ length: PARTICLE_CAPACITY }, () => ({ remaining: 0 }));
    this.cursor = 0;
    this.shakeRemaining = 0;
    this.shakeStrength = 0;
  }

  reset() {
    for (const particle of this.particles) particle.remaining = 0;
    this.shakeRemaining = 0;
  }

  burst(x, y, color, count, speed = 100, duration = 0.55) {
    if (this.reducedMotion) count = Math.min(count, 4);

    for (let index = 0; index < count; index += 1) {
      const particle = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % this.particles.length;
      const angle = index * 2.39996;
      const velocity = this.reducedMotion ? 0 : speed * (0.4 + (index % 5) / 8);

      Object.assign(particle, {
        x, y, color,
        velocityX: Math.cos(angle) * velocity,
        velocityY: Math.sin(angle) * velocity,
        duration,
        remaining: duration,
        size: index % 3 === 0 ? 3 : 1.5,
      });
    }
  }

  shake(strength) {
    if (this.reducedMotion) return;
    this.shakeRemaining = 0.22;
    this.shakeStrength = strength;
  }

  handleEvent(event, player) {
    const enemy = event.enemy;

    switch (event.type) {
      case GameEvent.GAME_STARTED:
        this.reset();
        break;
      case GameEvent.PLAYER_FIRED:
        this.burst(event.x ?? player.x, event.y ?? player.y - 31, '#b9fbff', 6, 45, 0.12);
        break;
      case GameEvent.ENEMY_DAMAGED:
        this.burst(enemy.x, enemy.y, '#fff4c7', 8, 65, 0.2);
        break;
      case GameEvent.ENEMY_DESTROYED:
      case GameEvent.PLAYER_CONTACTED:
        this.burst(enemy.x, enemy.y, '#ff75d8', 24, 130);
        this.burst(enemy.x, enemy.y, '#ffd479', 8, 65);
        if (enemy.kind === 'sentinel') this.shake(2.5);
        break;
      case GameEvent.PLAYER_DAMAGED:
        this.burst(player.x, player.y, '#8cf4ff', 28, 140);
        this.shake(4);
        break;
      case GameEvent.POWERUP_COLLECTED:
        this.burst(player.x, player.y, '#ffd479', 16, 90);
        break;
      case GameEvent.WAVE_CLEARED:
        for (const x of [GAME_WIDTH * 0.25, GAME_WIDTH * 0.5, GAME_WIDTH * 0.75]) {
          this.burst(x, GAME_HEIGHT * 0.38, '#ffd479', 24, 110, 0.9);
        }
        this.shake(2);
        break;
      default:
        break;
    }
  }

  update(dt) {
    this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);

    for (const particle of this.particles) {
      if (particle.remaining <= 0) continue;
      particle.remaining = Math.max(0, particle.remaining - dt);
      particle.x += particle.velocityX * dt;
      particle.y += particle.velocityY * dt;
    }
  }

  draw(context) {
    context.save();

    for (const particle of this.particles) {
      if (particle.remaining <= 0) continue;
      context.globalAlpha = 0.65 * particle.remaining / particle.duration;
      context.fillStyle = particle.color;
      context.fillRect(particle.x, particle.y, particle.size, particle.size);
    }

    context.restore();
  }
}
