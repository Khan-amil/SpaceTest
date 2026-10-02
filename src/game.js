import { GAME_HEIGHT, GAME_WIDTH, GameEvent, GameState, PlayerDefaults, SessionRules, WaveDefaults } from './constants.js';
import { createEnemy, createPlayer, createProjectile, overlaps } from './entities.js';

/**
 * Deterministic gameplay model. It owns mutable game state but knows nothing about DOM,
 * rendering, audio, or keyboard events. New systems should subscribe through `events`.
 */
export class Game {
  constructor(random = Math.random) { this.random = random; this.events = []; this.reset(); }
  reset() { this.state = GameState.TITLE; this.score = 0; this.wave = 1; this.player = createPlayer(); this.enemies = []; this.projectiles = []; this.enemyDirection = 1; this.enemyFireTimer = 0; this.spawnWave(); }
  start() { this.reset(); this.state = GameState.PLAYING; this.emit(GameEvent.GAME_STARTED); }
  restart() { this.start(); }
  pause() { if (this.state === GameState.PLAYING) { this.state = GameState.PAUSED; this.emit(GameEvent.GAME_PAUSED); } }
  resume() { if (this.state === GameState.PAUSED) { this.state = GameState.PLAYING; this.emit(GameEvent.GAME_RESUMED); } }
  togglePause() { if (this.state === GameState.PLAYING) this.pause(); else if (this.state === GameState.PAUSED) this.resume(); }
  emit(type, detail = {}) { this.events.push({ type, ...detail }); }
  consumeEvents() { const events = this.events; this.events = []; return events; }
  spawnWave() {
    const { columns, rows, spacingX, spacingY } = WaveDefaults;
    const left = (GAME_WIDTH - (columns - 1) * spacingX) / 2;
    this.enemies = Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns); return createEnemy(left + (index % columns) * spacingX, 105 + row * spacingY, row);
    });
    this.enemyDirection = 1; this.enemyFireTimer = 0.65; this.emit(GameEvent.WAVE_STARTED, { wave: this.wave });
  }
  update(dt, input) {
    if (this.state !== GameState.PLAYING) return;
    this.updatePlayer(dt, input); this.updateEnemies(dt); this.updateProjectiles(dt); this.resolveCollisions();
    this.projectiles = this.projectiles.filter((bullet) => bullet.alive && bullet.y > -30 && bullet.y < GAME_HEIGHT + 30);
    if (this.state === GameState.PLAYING && !this.enemies.some((enemy) => enemy.alive)) { this.emit(GameEvent.WAVE_CLEARED, { wave: this.wave }); if (SessionRules.advancesOnWaveClear) { this.wave += 1; this.spawnWave(); } }
  }
  updatePlayer(dt, input) {
    const p = this.player; const horizontal = Number(input.isDown('right')) - Number(input.isDown('left')); const vertical = Number(input.isDown('down')) - Number(input.isDown('up'));
    p.x = Math.max(p.width / 2, Math.min(GAME_WIDTH - p.width / 2, p.x + horizontal * PlayerDefaults.speed * dt));
    p.y = Math.max(GAME_HEIGHT * .55, Math.min(GAME_HEIGHT - p.height / 2 - 14, p.y + vertical * PlayerDefaults.speed * dt));
    p.cooldown = Math.max(0, p.cooldown - dt); p.invulnerable = Math.max(0, p.invulnerable - dt);
    if (input.isDown('fire') && p.cooldown === 0) { this.projectiles.push(createProjectile(p.x, p.y - 31, -570, 'player')); p.cooldown = PlayerDefaults.fireInterval; this.emit(GameEvent.PLAYER_FIRED); }
  }
  updateEnemies(dt) {
    const living = this.enemies.filter((enemy) => enemy.alive); if (!living.length) return;
    const speed = WaveDefaults.baseSpeed + (this.wave - 1) * 8; const edge = 38;
    const mustDrop = living.some((enemy) => enemy.x + this.enemyDirection * speed * dt > GAME_WIDTH - edge || enemy.x + this.enemyDirection * speed * dt < edge);
    if (mustDrop) { this.enemyDirection *= -1; living.forEach((enemy) => { enemy.y += WaveDefaults.dropDistance; }); }
    living.forEach((enemy) => { enemy.x += this.enemyDirection * speed * dt; });
    this.enemyFireTimer -= dt;
    if (this.enemyFireTimer <= 0) { const shooter = living[Math.floor(this.random() * living.length)]; this.projectiles.push(createProjectile(shooter.x, shooter.y + 23, 260 + this.wave * 15, 'enemy')); this.enemyFireTimer = Math.max(.35, WaveDefaults.fireInterval - this.wave * .07); }
  }
  updateProjectiles(dt) { this.projectiles.forEach((bullet) => { bullet.y += bullet.velocityY * dt; }); }
  resolveCollisions() {
    for (const bullet of this.projectiles) {
      if (!bullet.alive) continue;
      if (bullet.owner === 'player') {
        const hit = this.enemies.find((enemy) => enemy.alive && overlaps(bullet, enemy));
        if (hit) { hit.alive = false; bullet.alive = false; this.score += 100 + (WaveDefaults.rows - hit.row) * 25; this.emit(GameEvent.ENEMY_DESTROYED, { enemy: hit, score: this.score }); }
      } else if (this.player.invulnerable === 0 && overlaps(bullet, this.player)) { bullet.alive = false; this.damagePlayer(); }
    }
    if (this.player.invulnerable === 0) {
      const contact = this.enemies.find((enemy) => enemy.alive && overlaps(enemy, this.player));
      if (contact) { contact.alive = false; this.emit(GameEvent.PLAYER_CONTACTED, { enemy: contact }); this.damagePlayer('contact'); }
    }
  }
  damagePlayer(source = 'projectile') { this.player.lives -= 1; this.player.invulnerable = PlayerDefaults.invulnerability; this.emit(GameEvent.PLAYER_DAMAGED, { lives: this.player.lives, source }); if (this.player.lives <= 0) this.endGame(); }
  endGame() { if (this.state === GameState.PLAYING) { this.state = GameState.GAME_OVER; this.emit(GameEvent.GAME_OVER, { score: this.score }); } }
}
