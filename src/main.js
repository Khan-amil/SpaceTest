import { GameEvent, GameState } from './constants.js';
import { Game } from './game.js';
import { InputController } from './input.js';
import { Renderer } from './renderer.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const game = new Game();
const input = new InputController();
const canvas = document.querySelector('#game-canvas');
const renderer = new Renderer(canvas, { reducedMotion });

const elements = {
  canvas,
  score: document.querySelector('#score'),
  wave: document.querySelector('#wave'),
  lives: document.querySelector('#lives'),
  startScreen: document.querySelector('#start-screen'),
  pauseScreen: document.querySelector('#pause-screen'),
  gameOverScreen: document.querySelector('#game-over-screen'),
  finalScore: document.querySelector('#final-score'),
  muteButton: document.querySelector('#mute-button'),
  status: document.querySelector('#game-status'),
};

const startButton = document.querySelector('#start-button');
const resumeButton = document.querySelector('#resume-button');
const restartButton = document.querySelector('#restart-button');

let muted = false;

const FIXED_STEP = 1 / 120;
const MAX_FRAME_DURATION = 0.1;

let previousFrameTime = performance.now();
let accumulatedTime = 0;

function announce(message) {
  elements.status.textContent = message;
}

function focusGameField() {
  elements.canvas.focus();
}

function startMission() {
  input.clear();
  game.start();
  focusGameField();
  syncUi();
  announce('Mission launched. Destroy every enemy to advance.');
}

function resumeMission() {
  input.clear();
  game.resume();
  focusGameField();
  syncUi();
  announce('Mission resumed.');
}

function toggleMute() {
  muted = !muted;

  elements.muteButton.setAttribute('aria-pressed', String(muted));
  elements.muteButton.textContent = `Sound: ${muted ? 'off' : 'on'}`;
  announce(`Sound ${muted ? 'muted' : 'enabled'}.`);
}

function handleCommands() {
  if (input.consumePressed('mute')) toggleMute();

  if (input.consumePressed('pause')) {
    game.togglePause();

    if (game.state === GameState.PAUSED) {
      announce('Game paused. Press Escape or Enter to resume.');
    } else if (game.state === GameState.PLAYING) {
      announce('Mission resumed.');
    }
  }

  if (!input.consumePressed('confirm')) return;

  if (game.state === GameState.TITLE || game.state === GameState.GAME_OVER) {
    startMission();
  } else if (game.state === GameState.PAUSED) {
    resumeMission();
  }
}

function consumeGameEvents() {
  for (const event of game.consumeEvents()) {
    if (event.type === GameEvent.WAVE_STARTED) {
      announce(`Wave ${event.wave}. Clear all enemies to advance.`);
    }

    if (event.type === GameEvent.PLAYER_DAMAGED) {
      announce(`Hull hit. ${event.lives} lives remaining.`);
    }

    if (event.type === GameEvent.GAME_OVER) {
      announce(`Game over. Final score ${event.score}. Press Enter to restart.`);
    }
  }
}

function syncUi() {
  elements.score.textContent = String(game.score).padStart(6, '0');
  elements.wave.textContent = String(game.wave).padStart(2, '0');
  elements.lives.textContent = `${game.player.lives} / 3`;

  elements.startScreen.classList.toggle('is-hidden', game.state !== GameState.TITLE);
  elements.pauseScreen.classList.toggle('is-hidden', game.state !== GameState.PAUSED);
  elements.gameOverScreen.classList.toggle('is-hidden', game.state !== GameState.GAME_OVER);

  if (game.state === GameState.GAME_OVER) {
    elements.finalScore.textContent = `Final score: ${game.score}`;
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
  renderer.render(game, currentTime / 1000);

  requestAnimationFrame(frame);
}

startButton.addEventListener('click', startMission);
resumeButton.addEventListener('click', resumeMission);
restartButton.addEventListener('click', startMission);
elements.muteButton.addEventListener('click', toggleMute);

syncUi();
requestAnimationFrame(frame);
