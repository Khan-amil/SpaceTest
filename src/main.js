import { GameEvent, GameState } from './constants.js';
import { Game } from './game.js';
import { InputController } from './input.js';
import { Renderer } from './renderer.js';
import { createPreferencesStore } from './storage.js';
import { GameAudio } from './audio.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const game = new Game();
const input = new InputController();
const canvas = document.querySelector('#game-canvas');
const renderer = new Renderer(canvas, { reducedMotion });
const audio = new GameAudio();

const elements = {
  canvas,
  score: document.querySelector('#score'),
  wave: document.querySelector('#wave'),
  lives: document.querySelector('#lives'),
  startScreen: document.querySelector('#start-screen'),
  pauseScreen: document.querySelector('#pause-screen'),
  waveIntroScreen: document.querySelector('#wave-intro-screen'),
  waveIntroTitle: document.querySelector('#wave-intro-title'),
  waveIntroDescription: document.querySelector('#wave-intro-description'),
  gameOverScreen: document.querySelector('#game-over-screen'),
  finalScore: document.querySelector('#final-score'),
  finalWave: document.querySelector('#final-wave'),
  finalDestroyed: document.querySelector('#final-destroyed'),
  finalAccuracy: document.querySelector('#final-accuracy'),
  bestScore: document.querySelector('#best-score'),
  muteButton: document.querySelector('#mute-button'),
  pauseButton: document.querySelector('#pause-button'),
  bestBadge: document.querySelector('#best-badge'),
  status: document.querySelector('#game-status'),
};

const startButton = document.querySelector('#start-button');
const resumeButton = document.querySelector('#resume-button');
const restartButton = document.querySelector('#restart-button');

const preferencesStore = createPreferencesStore(() => window.localStorage);
const savedPreferences = preferencesStore.load();

let muted = savedPreferences.muted;
let bestScore = savedPreferences.bestScore;
let bestCelebrated = false;
let lastUiSignature = '';
audio.setMuted(muted);

const FIXED_STEP = 1 / 120;
const MAX_FRAME_DURATION = 0.1;

let previousFrameTime = performance.now();
let accumulatedTime = 0;
let presentationTime = 0;

function announce(message) {
  elements.status.textContent = message;
}

function focusGameField() {
  elements.canvas.focus();
}

function startMission() {
  audio.unlock();
  bestCelebrated = false;
  input.clear();
  game.start();
  focusGameField();
  syncUi();
  announce('Mission launched. Destroy every enemy to advance.');
}

function resumeMission() {
  audio.unlock();
  input.clear();
  game.resume();
  focusGameField();
  syncUi();
  announce('Mission resumed.');
}

function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);

  syncMuteButton();
  preferencesStore.saveMuted(muted);
  announce(`Sound ${muted ? 'muted' : 'enabled'}.`);
}

function syncMuteButton() {
  elements.muteButton.setAttribute('aria-pressed', String(muted));
  elements.muteButton.textContent = `Sound: ${muted ? 'off' : 'on'}`;
}

function togglePause() {
  const previousState = game.state;
  game.togglePause();
  input.clear();
  syncUi();

  if (game.state === GameState.PAUSED) {
    resumeButton.focus();
    announce('Game paused. Press Escape or Enter to resume.');
  } else if (previousState === GameState.PAUSED) {
    audio.unlock();
    focusGameField();
    announce('Mission resumed.');
  }
}

function pulse(element) {
  if (reducedMotion) return;
  // Web Animations replaces an earlier pulse rather than accumulating animations.
  element.getAnimations?.().forEach((animation) => animation.cancel());
  element.animate?.([
    { opacity: 0.6, transform: 'translateY(2px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ], { duration: 350 });
}

function handleCommands() {
  if (input.consumePressed('mute')) toggleMute();

  if (input.consumePressed('pause')) togglePause();

  if (!input.consumePressed('confirm')) return;

  if (game.state === GameState.TITLE || game.state === GameState.GAME_OVER) {
    startMission();
  } else if (game.state === GameState.PAUSED) {
    resumeMission();
  }
}

function consumeGameEvents() {
  for (const event of game.consumeEvents()) {
    renderer.effects.handleEvent(event, game.player);
    audio.handleEvent(event);
    if (event.type === GameEvent.ENEMY_DESTROYED || event.type === GameEvent.WAVE_CLEARED) {
      pulse(elements.score);
      if (game.score > bestScore && !bestCelebrated) {
        bestCelebrated = true;
        pulse(elements.bestBadge);
      }
    }
    if (event.type === GameEvent.WAVE_STARTED) {
      pulse(elements.waveIntroTitle);
      announce(`Wave ${event.wave}. ${event.hint ?? 'Clear all enemies to advance.'}`);
    }

    if (event.type === GameEvent.WAVE_CLEARED) {
      const masteryMessage = event.noDamageBonus > 0 ? ` No-damage bonus ${event.noDamageBonus}.` : '';
      announce(`Wave ${event.wave} cleared. Bonus ${event.bonus} points.${masteryMessage}`);
    }

    if (event.type === GameEvent.PLAYER_DAMAGED) {
      pulse(elements.lives);
      announce(`Hull hit. ${event.lives} lives remaining.`);
    }

    if (event.type === GameEvent.ENEMY_STATE_RECOVERED) {
      announce('Enemy formation restored. Continue the mission.');
    }

    if (event.type === GameEvent.GAME_OVER) {
      preferencesStore.saveBestScore(event.score);
      bestScore = preferencesStore.load().bestScore;
      announce(`Game over. Score ${event.score}. Wave ${event.waveReached}. Press Enter to restart.`);
      syncUi();
      restartButton.focus();
    }
  }
}

function syncUi() {
  const signature = [
    game.state, game.score, game.wave, game.player.lives,
    game.waveIntro?.phase, bestScore, bestCelebrated,
  ].join('|');

  // Timers and particles change every frame; DOM labels only change with the visible state.
  if (signature === lastUiSignature) return;
  lastUiSignature = signature;

  elements.score.textContent = String(game.score).padStart(6, '0');
  elements.wave.textContent = String(game.wave).padStart(2, '0');
  elements.lives.textContent = `${game.player.lives} / 3`;
  elements.bestBadge.classList.toggle('is-hidden', !bestCelebrated);
  elements.pauseButton.disabled = game.state === GameState.TITLE || game.state === GameState.GAME_OVER;
  elements.pauseButton.textContent = game.state === GameState.PAUSED ? 'Resume' : 'Pause';

  elements.startScreen.classList.toggle('is-hidden', game.state !== GameState.TITLE);
  elements.pauseScreen.classList.toggle('is-hidden', game.state !== GameState.PAUSED);
  elements.waveIntroScreen.classList.toggle('is-hidden', game.state !== GameState.WAVE_INTRO);
  elements.gameOverScreen.classList.toggle('is-hidden', game.state !== GameState.GAME_OVER);

  if (game.state === GameState.WAVE_INTRO) {
    const isClearTransition = game.waveIntro?.phase === 'cleared';

    elements.waveIntroTitle.textContent = isClearTransition ? 'SECTOR CLEAR' : `WAVE ${game.wave}`;
    elements.waveIntroDescription.textContent = isClearTransition
      ? `Clear bonus: +${game.waveIntro.clearBonus}. ${game.waveIntro.noDamageBonus > 0
        ? `No-damage bonus: +${game.waveIntro.noDamageBonus}. ` : ''}Preparing wave ${game.pendingWave}.`
      : game.waveDefinition.hint;
  }

  if (game.state === GameState.GAME_OVER) {
    const summary = game.gameOverSummary;

    elements.finalScore.textContent = String(summary.score).padStart(6, '0');
    elements.finalWave.textContent = String(summary.waveReached);
    elements.finalDestroyed.textContent = String(summary.enemiesDestroyed);
    elements.finalAccuracy.textContent = `${summary.accuracy}%`;
    elements.bestScore.textContent = String(bestScore).padStart(6, '0');
  }
}

function updateGame() {
  while (accumulatedTime >= FIXED_STEP) {
    game.update(FIXED_STEP, input);
    accumulatedTime -= FIXED_STEP;
  }
}

function frame(currentTime) {
  handleCommands();

  const elapsedSeconds = (currentTime - previousFrameTime) / 1000;
  accumulatedTime += Math.min(MAX_FRAME_DURATION, elapsedSeconds);
  previousFrameTime = currentTime;

  updateGame();
  consumeGameEvents();
  syncUi();
  if (game.state !== GameState.PAUSED) {
    const presentationStep = Math.min(MAX_FRAME_DURATION, elapsedSeconds);
    presentationTime += presentationStep;
    renderer.effects.update(presentationStep);
  }
  renderer.render(game, presentationTime);

  requestAnimationFrame(frame);
}

startButton.addEventListener('click', startMission);
resumeButton.addEventListener('click', resumeMission);
restartButton.addEventListener('click', startMission);
elements.muteButton.addEventListener('click', toggleMute);
elements.pauseButton.addEventListener('click', togglePause);

syncMuteButton();
syncUi();
requestAnimationFrame(frame);
