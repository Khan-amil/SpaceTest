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
import { WaveLimits, getEnemyKindForSlot, getWaveDefinition } from './waves.js';
import { selectFormationShooter } from './enemy-fire.js';
import { advanceFormation, constrainFormation, synchronizeFormationMembers } from './formation.js';
import { repairEnemyStates } from './enemy-safety.js';
import {
  EnemyBehavior,
  beginEnemyDive,
  cancelEnemyBehavior,
  getEnemyDefinition,
  isFormationMember,
  updateEnemyBehavior,
} from './enemy-ai.js';

/**
 * Deterministic gameplay model. It owns mutable game state but knows nothing about DOM,
 * rendering, audio, or keyboard events. New systems should subscribe through `events`.
 */
export class Game {
  constructor(random = Math.random, waveDefinitionFactory = getWaveDefinition, waveSeed = 0) {
    this.random = random;
    this.waveDefinitionFactory = waveDefinitionFactory;
    this.waveSeed = waveSeed;
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
    this.enemyDiveTimer = 0;
    this.formation = { x: 0, y: 0, elapsed: 0 };
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
    this.waveDefinition = this.waveDefinitionFactory(this.wave, this.waveSeed);
    const { columns, rows, spacingX, spacingY, startY } = this.waveDefinition.formation;
    const formationLeft = (GAME_WIDTH - (columns - 1) * spacingX) / 2;

    this.enemies = Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = formationLeft + column * spacingX;
      const y = startY + row * spacingY;
      const kind = getEnemyKindForSlot(this.waveDefinition.enemyMix, row, column);

      return createEnemy(x, y, row, kind);
    });

    this.enemyDirection = 1;
    this.enemyFireLane = 'left';
    this.waveDamageTaken = 0;
    this.formation = { x: 0, y: 0, elapsed: 0 };
    this.enemyFireTimer = this.waveDefinition.firing.initialDelay;
    this.enemyDiveTimer = this.waveDefinition.diveCadence ?? 0;
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
    this.emit(GameEvent.WAVE_STARTED, { wave: this.wave, hint: this.waveDefinition.hint });
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
    const previousX = player.x;
    const previousY = player.y;

    player.x = Math.max(
      horizontalMargin,
      Math.min(GAME_WIDTH - horizontalMargin, player.x + horizontalDirection * PlayerDefaults.speed * dt),
    );
    player.y = Math.max(
      topBoundary,
      Math.min(bottomBoundary, player.y + verticalDirection * PlayerDefaults.speed * dt),
    );
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.velocityX = dt > 0 ? (player.x - previousX) / dt : 0;
    player.velocityY = dt > 0 ? (player.y - previousY) / dt : 0;
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    if (input.isDown('fire') && player.cooldown === 0) this.firePlayerProjectile();
  }

  updateEnemies(dt) {
    const livingEnemies = this.enemies.filter((enemy) => enemy.alive);

    if (!livingEnemies.length) return;

    const repairedEnemies = repairEnemyStates(
      this.enemies, this.formation, this.waveDefinition.formation, dt, this.player,
    );
    const repairedFormation = constrainFormation(this.formation, livingEnemies);
    const repairedDirection = this.enemyDirection !== -1 && this.enemyDirection !== 1;

    if (repairedDirection) this.enemyDirection = 1;
    this.enemyDirection = advanceFormation(
      this.formation, livingEnemies, this.enemyDirection,
      this.waveDefinition.movement, dt,
    );

    for (const enemy of livingEnemies) {
      enemy.aimedShotCooldown = Math.max(0, enemy.aimedShotCooldown - dt);
      const action = updateEnemyBehavior(enemy, this.formation, dt, this.player);

      if (action === 'started') this.emit(GameEvent.ENEMY_DIVE_STARTED, { enemy });
      if (action === 'ended') this.emit(GameEvent.ENEMY_DIVE_ENDED, { enemy });
      if (action === 'fire') this.fireAimedEnemyProjectile(enemy);
    }

    // Returning ships join after movement; immediately fit the expanded bounds this tick.
    constrainFormation(this.formation, livingEnemies);
    synchronizeFormationMembers(this.formation, livingEnemies);

    if (repairedFormation || repairedDirection || repairedEnemies.length > 0) {
      this.projectiles = this.projectiles.filter((projectile) => projectile.owner === 'player');
      this.enemyFireTimer = this.waveDefinition.firing.initialDelay;
      this.enemyDiveTimer = this.waveDefinition.diveCadence ?? 0;
      this.emit(GameEvent.ENEMY_STATE_RECOVERED, { enemies: repairedEnemies.length });
    }

    this.updateDiveCadence(dt);

    this.enemyFireTimer -= dt;

    const shooters = livingEnemies.filter(isFormationMember);

    if (this.enemyFireTimer <= 0 && shooters.length > 0) this.fireEnemyProjectile(shooters);
  }

  beginDive(enemy) {
    if (this.state !== GameState.PLAYING || this.player.invulnerable > 0) return false;
    if (!this.enemies.includes(enemy) || !this.waveDefinition.diveCadence) return false;
    if (!enemy.alive || enemy.behavior !== EnemyBehavior.FORMATION) return false;

    const activeDivers = this.enemies.filter((candidate) => (
      candidate.alive && !isFormationMember(candidate)
    )).length;
    const telegraphing = this.enemies.filter((candidate) => (
      candidate.alive && candidate.behavior === EnemyBehavior.TELEGRAPHING_DIVE
    )).length;

    if (activeDivers + telegraphing >= this.waveDefinition.maxDivers) return false;
    if (!beginEnemyDive(enemy, this.random() < 0.5 ? -1 : 1)) return false;

    this.emit(GameEvent.ENEMY_DIVE_TELEGRAPHED, { enemy });
    return true;
  }

  updateDiveCadence(dt) {
    if (!this.waveDefinition.diveCadence) return;

    this.enemyDiveTimer = Math.max(0, this.enemyDiveTimer - dt);

    if (this.enemyDiveTimer > 0 || this.player.invulnerable > 0) return;

    const candidates = this.enemies.filter((enemy) => (
      enemy.alive && enemy.behavior === EnemyBehavior.FORMATION
    ));

    if (candidates.length === 0) return;

    const totalWeight = candidates.reduce((total, enemy) => (
      total + getEnemyDefinition(enemy.kind).dive.cadenceWeight
    ), 0);
    let selection = this.random() * totalWeight;
    const selectedEnemy = candidates.find((enemy) => {
      selection -= getEnemyDefinition(enemy.kind).dive.cadenceWeight;
      return selection < 0;
    }) ?? candidates[candidates.length - 1];

    if (this.beginDive(selectedEnemy)) {
      this.enemyDiveTimer = this.waveDefinition.diveCadence;
    }
  }

  fireAimedEnemyProjectile(enemy) {
    const attack = getEnemyDefinition(enemy.kind).dive;

    if (this.state !== GameState.PLAYING || !enemy.alive || !attack.aimedShot) return false;
    if (enemy.aimedShotCooldown > 0) return false;
    if (!this.canCreateProjectile('enemy')) return false;

    const speed = Math.min(attack.maxShotSpeed, this.waveDefinition.firing.projectileSpeed);
    const horizontalDistance = this.player.x + this.player.velocityX * attack.shotLead - enemy.x;
    const verticalDistance = Math.max(80, this.player.y + this.player.velocityY * attack.shotLead - enemy.y);
    // A bounded downward angle gives the Wasp pressure without a horizontal surprise shot.
    const angle = Math.max(
      -attack.maxShotAngle,
      Math.min(attack.maxShotAngle, Math.atan2(horizontalDistance, verticalDistance)),
    );
    const projectile = createProjectile(enemy.x, enemy.y + 23, Math.cos(angle) * speed, 'enemy');

    projectile.velocityX = Math.sin(angle) * speed;
    this.projectiles.push(projectile);
    enemy.aimedShotCooldown = attack.shotCooldown;
    return true;
  }

  updateProjectiles(dt) {
    this.projectiles.forEach((projectile) => {
      projectile.x += projectile.velocityX * dt;
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
    if (!this.canCreateProjectile('player')) return;

    const player = this.player;

    this.projectiles.push(createProjectile(player.x, player.y - 31, -570, 'player'));
    player.cooldown = PlayerDefaults.fireInterval;
    this.statistics.shotsFired += 1;
    this.emit(GameEvent.PLAYER_FIRED);
  }

  canCreateProjectile(owner) {
    const livingProjectiles = this.projectiles.filter((projectile) => projectile.alive);

    if (livingProjectiles.length >= WaveLimits.totalProjectiles) return false;
    if (owner === 'player') return true;

    const enemyCount = livingProjectiles.filter((projectile) => projectile.owner === 'enemy').length;
    const enemyLimit = Math.min(
      this.waveDefinition.firing.maxProjectiles ?? WaveLimits.enemyProjectiles,
      WaveLimits.enemyProjectiles,
    );

    return enemyCount < enemyLimit;
  }

  fireEnemyProjectile(livingEnemies) {
    const { projectileSpeed, interval } = this.waveDefinition.firing;

    // Saturation skips a firing beat instead of building a burst when room returns.
    this.enemyFireTimer = interval;
    if (this.state !== GameState.PLAYING || !this.canCreateProjectile('enemy')) return false;

    const shooters = livingEnemies.filter((enemy) => enemy.alive && isFormationMember(enemy));
    const shooter = selectFormationShooter(
      shooters, this.waveDefinition.firing.pattern, this.enemyFireLane, this.random,
    );

    if (!shooter) return false;

    this.projectiles.push(createProjectile(shooter.x, shooter.y + 23, projectileSpeed, 'enemy'));
    this.enemyFireLane = this.enemyFireLane === 'left' ? 'right' : 'left';
    return true;
  }

  resolvePlayerProjectileCollision(projectile) {
    if (!projectile.alive) return;

    const hitEnemy = this.enemies.find((enemy) => enemy.alive && overlaps(projectile, enemy));

    if (!hitEnemy) return;

    projectile.alive = false;
    hitEnemy.health -= 1;
    this.statistics.shotsHit += 1;

    if (hitEnemy.health > 0) {
      this.emit(GameEvent.ENEMY_DAMAGED, { enemy: hitEnemy, health: hitEnemy.health });
      return;
    }

    cancelEnemyBehavior(hitEnemy);
    this.score += hitEnemy.value;
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

    cancelEnemyBehavior(contactEnemy);
    this.statistics.enemiesDestroyed += 1;
    this.emit(GameEvent.PLAYER_CONTACTED, { enemy: contactEnemy });
    this.damagePlayer('contact');
  }

  removeExpiredProjectiles() {
    const projectileMargin = 30;

    this.projectiles = this.projectiles.filter((projectile) => (
      projectile.alive
      && projectile.x > -projectileMargin
      && projectile.x < GAME_WIDTH + projectileMargin
      && projectile.y > -projectileMargin
      && projectile.y < GAME_HEIGHT + projectileMargin
    ));
  }

  advanceWaveWhenCleared() {
    const waveIsCleared = !this.enemies.some((enemy) => enemy.alive);

    if (this.state !== GameState.PLAYING || !waveIsCleared || this.waveClearStarted) return;

    this.waveClearStarted = true;
    const clearBonus = this.waveDefinition.clearBonus;
    const noDamageBonus = this.waveDamageTaken === 0 ? this.waveDefinition.noDamageBonus ?? 0 : 0;
    const bonus = clearBonus + noDamageBonus;
    this.score += bonus;
    this.emit(GameEvent.WAVE_CLEARED, {
      wave: this.wave, bonus, clearBonus, noDamageBonus, score: this.score,
    });

    if (!SessionRules.advancesOnWaveClear) return;

    this.pendingWave = this.wave + 1;
    // Old bullets must not carry frozen danger into a newly introduced formation.
    this.projectiles = [];
    this.waveIntro = {
      phase: 'cleared',
      bonus,
      clearBonus,
      noDamageBonus,
      remaining: WaveDefaults.clearDuration,
    };
    this.state = GameState.WAVE_INTRO;
  }

  damagePlayer(source = 'projectile') {
    if (this.state !== GameState.PLAYING || this.player.invulnerable > 0) return;

    this.player.lives -= 1;
    this.waveDamageTaken += 1;
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
