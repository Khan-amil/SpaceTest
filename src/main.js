import { GameEvent, GameState } from './constants.js';
import { Game } from './game.js';
import { InputController } from './input.js';
import { Renderer } from './renderer.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const game = new Game(); const input = new InputController(); const renderer = new Renderer(document.querySelector('#game-canvas'), { reducedMotion });
const elements = { score: document.querySelector('#score'), wave: document.querySelector('#wave'), lives: document.querySelector('#lives'), start: document.querySelector('#start-screen'), pause: document.querySelector('#pause-screen'), over: document.querySelector('#game-over-screen'), final: document.querySelector('#final-score'), mute: document.querySelector('#mute-button'), status: document.querySelector('#game-status'), canvas: document.querySelector('#game-canvas') };
let muted = false;
function announce(message) { elements.status.textContent = message; }
function begin() { input.clear(); game.start(); elements.canvas.focus(); syncUi(); announce('Mission launched. Destroy every enemy to advance.'); }
function resume() { input.clear(); game.resume(); elements.canvas.focus(); syncUi(); announce('Mission resumed.'); }
function toggleMute() { muted = !muted; elements.mute.setAttribute('aria-pressed', String(muted)); elements.mute.textContent = `Sound: ${muted ? 'off' : 'on'}`; announce(`Sound ${muted ? 'muted' : 'enabled'}.`); }
document.querySelector('#start-button').addEventListener('click', begin); document.querySelector('#restart-button').addEventListener('click', begin); document.querySelector('#resume-button').addEventListener('click', resume); elements.mute.addEventListener('click', toggleMute);
function handleCommands() { if (input.consumePressed('mute')) toggleMute(); if (input.consumePressed('pause')) { game.togglePause(); if (game.state === GameState.PAUSED) announce('Game paused. Press Escape or Enter to resume.'); else if (game.state === GameState.PLAYING) announce('Mission resumed.'); } if (input.consumePressed('confirm')) { if (game.state === GameState.TITLE || game.state === GameState.GAME_OVER) begin(); else if (game.state === GameState.PAUSED) resume(); } }
function consumeGameEvents() { for (const event of game.consumeEvents()) { if (event.type === GameEvent.WAVE_STARTED) announce(`Wave ${event.wave}. Clear all enemies to advance.`); if (event.type === GameEvent.PLAYER_DAMAGED) announce(`Hull hit. ${event.lives} lives remaining.`); if (event.type === GameEvent.GAME_OVER) announce(`Game over. Final score ${event.score}. Press Enter to restart.`); } }
function syncUi() { elements.score.textContent = String(game.score).padStart(6, '0'); elements.wave.textContent = String(game.wave).padStart(2, '0'); elements.lives.textContent = `${game.player.lives} / 3`; elements.start.classList.toggle('is-hidden', game.state !== GameState.TITLE); elements.pause.classList.toggle('is-hidden', game.state !== GameState.PAUSED); elements.over.classList.toggle('is-hidden', game.state !== GameState.GAME_OVER); if (game.state === GameState.GAME_OVER) elements.final.textContent = `Final score: ${game.score}`; }
let previous = performance.now(); let accumulator = 0; const step = 1 / 120;
function frame(now) { handleCommands(); accumulator += Math.min(.1, (now - previous) / 1000); previous = now; while (accumulator >= step) { game.update(step, input); accumulator -= step; } consumeGameEvents(); syncUi(); renderer.render(game, now / 1000); requestAnimationFrame(frame); }
syncUi(); requestAnimationFrame(frame);
