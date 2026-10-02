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
import { getEnemyKindForRow, getWaveDefinition } from './waves.js';

/**
 * Deterministic gameplay model. It owns mutable game state but knows nothing about DOM,
 * rendering, audio, or keyboard events. New systems should subscribe through `events`.
 */
export class Game {
  constructor(random = Math.random, waveDefinitionFactory = getWaveDefinition) {
    this.random = random;
    this.waveDefinitionFactory = waveDefinitionFactory;
    this.reset();
  }

  reset() {
    this.events = [];
    this.state = GameState.TITLE;
    this.stateBeforePause = null;
    this.score = 0;
    this.wave = 1;
    this.waveDefinition = null;
    this.waveIntro = null;
    this.pendingWave = null;
    this.waveClearStarted = false;
    this.gameOverSummary = null;
    this.statistics = {
      shotsFired: 0,
      shotsHit: 0,
      enemiesDestroyed: 0,
      waveReached: this.wave,
    };
    this.player = createPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.enemyDirection = 1;
    this.enemyFireTimer = 0;
    this.spawnWave();
  }

  start() {
    if (this.state !== GameState.TITLE && this.state !== GameState.GAME_OVER) return;

    this.reset();
    this.emit(GameEvent.GAME_STARTED);
    this.beginWaveIntro();
  }

  restart() {
    this.start();
  }

  pause() {
    if (this.state !== GameState.PLAYING && this.state !== GameState.WAVE_INTRO) return;

    this.stateBeforePause = this.state;
    this.state = GameState.PAUSED;
    this.emit(GameEvent.GAME_PAUSED);
  }

  resume() {
    if (this.state !== GameState.PAUSED) return;

    this.state = this.stateBeforePause;
    this.stateBeforePause = null;
    this.emit(GameEvent.GAME_RESUMED);
  }

  togglePause() {
    if (this.state === GameState.PAUSED) {
      this.resume();
    } else {
      this.pause();
    }
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
    this.waveDefinition = this.waveDefinitionFactory(this.wave);
    const { columns, rows, spacingX, spacingY, startY } = this.waveDefinition.formation;
    const formationLeft = (GAME_WIDTH - (columns - 1) * spacingX) / 2;

    this.enemies = Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = formationLeft + column * spacingX;
      const y = startY + row * spacingY;
      const kind = getEnemyKindForRow(this.waveDefinition.enemyMix, row);

      return createEnemy(x, y, row, kind);
    });

    this.enemyDirection = 1;
    this.enemyFireTimer = this.waveDefinition.firing.initialDelay;
    this.waveClearStarted = false;
    this.statistics.waveReached = Math.max(this.statistics.waveReached, this.wave);
  }

  update(dt, input) {
    if (this.state === GameState.WAVE_INTRO) {
      this.updateWaveIntro(dt);
      return;
    }

    if (this.state !== GameState.PLAYING) return;

    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.resolveCollisions();
    this.removeExpiredProjectiles();
    this.advanceWaveWhenCleared();
  }

  beginWaveIntro() {
    this.state = GameState.WAVE_INTRO;
    this.waveIntro = {
      phase: 'incoming',
      remaining: WaveDefaults.introDuration,
    };
    this.emit(GameEvent.WAVE_STARTED, { wave: this.wave });
  }

  updateWaveIntro(dt) {
    this.waveIntro.remaining = Math.max(0, this.waveIntro.remaining - dt);

    if (this.waveIntro.remaining > 0) return;

    if (this.waveIntro.phase === 'cleared') {
      this.wave = this.pendingWave;
      this.pendingWave = null;
      this.spawnWave();
      this.beginWaveIntro();
      return;
    }

    this.waveIntro = null;
    this.state = GameState.PLAYING;
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

    const formationSpeed = this.waveDefinition.movement.speed;
    const formationEdge = 38;
    const reachesScreenEdge = livingEnemies.some((enemy) => {
      const nextX = enemy.x + this.enemyDirection * formationSpeed * dt;
      return nextX > GAME_WIDTH - formationEdge || nextX < formationEdge;
    });

    if (reachesScreenEdge) {
      this.enemyDirection *= -1;
      livingEnemies.forEach((enemy) => {
        enemy.y += this.waveDefinition.movement.dropDistance;
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
    if (this.state !== GameState.PLAYING) return;

    for (const projectile of this.projectiles) {
      // A fatal hit ends collision processing so the final summary cannot change afterward.
      if (this.state !== GameState.PLAYING) break;
      if (!projectile.alive) continue;

      if (projectile.owner === 'player') {
        this.resolvePlayerProjectileCollision(projectile);
      } else {
        this.resolveEnemyProjectileCollision(projectile);
      }
    }

    if (this.state === GameState.PLAYING) this.resolveEnemyContactCollision();
  }

  firePlayerProjectile() {
    if (this.state !== GameState.PLAYING) return;

    const player = this.player;

    this.projectiles.push(createProjectile(player.x, player.y - 31, -570, 'player'));
    player.cooldown = PlayerDefaults.fireInterval;
    this.statistics.shotsFired += 1;
    this.emit(GameEvent.PLAYER_FIRED);
  }

  fireEnemyProjectile(livingEnemies) {
    const randomIndex = Math.floor(this.random() * livingEnemies.length);
    const shooter = livingEnemies[randomIndex];
    const { projectileSpeed, interval } = this.waveDefinition.firing;

    this.projectiles.push(createProjectile(shooter.x, shooter.y + 23, projectileSpeed, 'enemy'));
    this.enemyFireTimer = interval;
  }

  resolvePlayerProjectileCollision(projectile) {
    if (!projectile.alive) return;

    const hitEnemy = this.enemies.find((enemy) => enemy.alive && overlaps(projectile, enemy));

    if (!hitEnemy) return;

    hitEnemy.alive = false;
    projectile.alive = false;
    this.score += 100 + (this.waveDefinition.formation.rows - hitEnemy.row) * 25;
    this.statistics.shotsHit += 1;
    this.statistics.enemiesDestroyed += 1;
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
    this.statistics.enemiesDestroyed += 1;
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

    if (this.state !== GameState.PLAYING || !waveIsCleared || this.waveClearStarted) return;

    this.waveClearStarted = true;
    const bonus = this.waveDefinition.clearBonus;
    this.score += bonus;
    this.emit(GameEvent.WAVE_CLEARED, { wave: this.wave, bonus, score: this.score });

    if (!SessionRules.advancesOnWaveClear) return;

    this.pendingWave = this.wave + 1;
    // Old bullets must not carry frozen danger into a newly introduced formation.
    this.projectiles = [];
    this.waveIntro = {
      phase: 'cleared',
      bonus,
      remaining: WaveDefaults.clearDuration,
    };
    this.state = GameState.WAVE_INTRO;
  }

  damagePlayer(source = 'projectile') {
    if (this.state !== GameState.PLAYING || this.player.invulnerable > 0) return;

    this.player.lives -= 1;
    this.player.invulnerable = PlayerDefaults.invulnerability;
    this.emit(GameEvent.PLAYER_DAMAGED, { lives: this.player.lives, source });

    if (this.player.lives <= 0) this.endGame();
  }

  endGame() {
    if (this.state !== GameState.PLAYING) return;

    this.state = GameState.GAME_OVER;
    this.gameOverSummary = Object.freeze({
      score: this.score,
      waveReached: this.statistics.waveReached,
      enemiesDestroyed: this.statistics.enemiesDestroyed,
      accuracy: this.statistics.shotsFired === 0
        ? 0
        : Math.round((this.statistics.shotsHit / this.statistics.shotsFired) * 100),
    });
    this.emit(GameEvent.GAME_OVER, { ...this.gameOverSummary });
  }
}
