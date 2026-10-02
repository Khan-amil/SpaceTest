import {
  GAME_HEIGHT,
  GAME_WIDTH,
  GameEvent,
  GameState,
  PlayerDefaults,
  SessionRules,
  WaveDefaults,
} from './constants.js';
import { createEnemy, createPlayer, createProjectile, overlaps } from './entities.js';

/**
 * Deterministic gameplay model. It owns mutable game state but knows nothing about DOM,
 * rendering, audio, or keyboard events. New systems should subscribe through `events`.
 */
export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.events = [];
    this.reset();
  }

  reset() {
    this.state = GameState.TITLE;
    this.score = 0;
    this.wave = 1;
    this.player = createPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.enemyDirection = 1;
    this.enemyFireTimer = 0;
    this.spawnWave();
  }

  start() {
    this.reset();
    this.state = GameState.PLAYING;
    this.emit(GameEvent.GAME_STARTED);
  }

  restart() {
    this.start();
  }

  pause() {
    if (this.state !== GameState.PLAYING) return;

    this.state = GameState.PAUSED;
    this.emit(GameEvent.GAME_PAUSED);
  }

  resume() {
    if (this.state !== GameState.PAUSED) return;

    this.state = GameState.PLAYING;
    this.emit(GameEvent.GAME_RESUMED);
  }

  togglePause() {
    if (this.state === GameState.PLAYING) this.pause();
    else if (this.state === GameState.PAUSED) this.resume();
  }

  emit(type, detail = {}) {
    this.events.push({ type, ...detail });
  }

  consumeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  spawnWave() {
    const { columns, rows, spacingX, spacingY } = WaveDefaults;
    const formationLeft = (GAME_WIDTH - (columns - 1) * spacingX) / 2;

    this.enemies = Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = formationLeft + column * spacingX;
      const y = 105 + row * spacingY;

      return createEnemy(x, y, row);
    });

    this.enemyDirection = 1;
    this.enemyFireTimer = 0.65;
    this.emit(GameEvent.WAVE_STARTED, { wave: this.wave });
  }

  update(dt, input) {
    if (this.state !== GameState.PLAYING) return;

    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.resolveCollisions();
    this.removeExpiredProjectiles();
    this.advanceWaveWhenCleared();
  }

  updatePlayer(dt, input) {
    const player = this.player;
    const horizontalDirection = Number(input.isDown('right')) - Number(input.isDown('left'));
    const verticalDirection = Number(input.isDown('down')) - Number(input.isDown('up'));
    const horizontalMargin = player.width / 2;
    const topBoundary = GAME_HEIGHT * 0.55;
    const bottomBoundary = GAME_HEIGHT - player.height / 2 - 14;

    player.x = Math.max(
      horizontalMargin,
      Math.min(GAME_WIDTH - horizontalMargin, player.x + horizontalDirection * PlayerDefaults.speed * dt),
    );
    player.y = Math.max(
      topBoundary,
      Math.min(bottomBoundary, player.y + verticalDirection * PlayerDefaults.speed * dt),
    );
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    if (input.isDown('fire') && player.cooldown === 0) this.firePlayerProjectile();
  }

  updateEnemies(dt) {
    const livingEnemies = this.enemies.filter((enemy) => enemy.alive);

    if (!livingEnemies.length) return;

    const formationSpeed = WaveDefaults.baseSpeed + (this.wave - 1) * 8;
    const formationEdge = 38;
    const reachesScreenEdge = livingEnemies.some((enemy) => {
      const nextX = enemy.x + this.enemyDirection * formationSpeed * dt;
      return nextX > GAME_WIDTH - formationEdge || nextX < formationEdge;
    });

    if (reachesScreenEdge) {
      this.enemyDirection *= -1;
      livingEnemies.forEach((enemy) => {
        enemy.y += WaveDefaults.dropDistance;
      });
    }

    livingEnemies.forEach((enemy) => {
      enemy.x += this.enemyDirection * formationSpeed * dt;
    });

    this.enemyFireTimer -= dt;

    if (this.enemyFireTimer <= 0) this.fireEnemyProjectile(livingEnemies);
  }

  updateProjectiles(dt) {
    this.projectiles.forEach((projectile) => {
      projectile.y += projectile.velocityY * dt;
    });
  }

  resolveCollisions() {
    for (const projectile of this.projectiles) {
      if (!projectile.alive) continue;

      if (projectile.owner === 'player') {
        this.resolvePlayerProjectileCollision(projectile);
      } else {
        this.resolveEnemyProjectileCollision(projectile);
      }
    }

    this.resolveEnemyContactCollision();
  }

  firePlayerProjectile() {
    const player = this.player;

    this.projectiles.push(createProjectile(player.x, player.y - 31, -570, 'player'));
    player.cooldown = PlayerDefaults.fireInterval;
    this.emit(GameEvent.PLAYER_FIRED);
  }

  fireEnemyProjectile(livingEnemies) {
    const randomIndex = Math.floor(this.random() * livingEnemies.length);
    const shooter = livingEnemies[randomIndex];
    const projectileSpeed = 260 + this.wave * 15;
    const nextFireInterval = Math.max(0.35, WaveDefaults.fireInterval - this.wave * 0.07);

    this.projectiles.push(createProjectile(shooter.x, shooter.y + 23, projectileSpeed, 'enemy'));
    this.enemyFireTimer = nextFireInterval;
  }

  resolvePlayerProjectileCollision(projectile) {
    const hitEnemy = this.enemies.find((enemy) => enemy.alive && overlaps(projectile, enemy));

    if (!hitEnemy) return;

    hitEnemy.alive = false;
    projectile.alive = false;
    this.score += 100 + (WaveDefaults.rows - hitEnemy.row) * 25;
    this.emit(GameEvent.ENEMY_DESTROYED, { enemy: hitEnemy, score: this.score });
  }

  resolveEnemyProjectileCollision(projectile) {
    const playerIsVulnerable = this.player.invulnerable === 0;

    if (!playerIsVulnerable || !overlaps(projectile, this.player)) return;

    projectile.alive = false;
    this.damagePlayer();
  }

  resolveEnemyContactCollision() {
    if (this.player.invulnerable > 0) return;

    const contactEnemy = this.enemies.find((enemy) => enemy.alive && overlaps(enemy, this.player));

    if (!contactEnemy) return;

    contactEnemy.alive = false;
    this.emit(GameEvent.PLAYER_CONTACTED, { enemy: contactEnemy });
    this.damagePlayer('contact');
  }

  removeExpiredProjectiles() {
    const projectileMargin = 30;

    this.projectiles = this.projectiles.filter((projectile) => (
      projectile.alive
      && projectile.y > -projectileMargin
      && projectile.y < GAME_HEIGHT + projectileMargin
    ));
  }

  advanceWaveWhenCleared() {
    const waveIsCleared = !this.enemies.some((enemy) => enemy.alive);

    if (this.state !== GameState.PLAYING || !waveIsCleared) return;

    this.emit(GameEvent.WAVE_CLEARED, { wave: this.wave });

    if (!SessionRules.advancesOnWaveClear) return;

    this.wave += 1;
    this.spawnWave();
  }

  damagePlayer(source = 'projectile') {
    this.player.lives -= 1;
    this.player.invulnerable = PlayerDefaults.invulnerability;
    this.emit(GameEvent.PLAYER_DAMAGED, { lives: this.player.lives, source });

    if (this.player.lives <= 0) this.endGame();
  }

  endGame() {
    if (this.state !== GameState.PLAYING) return;

    this.state = GameState.GAME_OVER;
    this.emit(GameEvent.GAME_OVER, { score: this.score });
  }
}
