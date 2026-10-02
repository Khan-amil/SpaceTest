import { GameState } from './constants.js';
import { Game } from './game.js';
import { InputController } from './input.js';
import { Renderer } from './renderer.js';

const game = new Game(); const input = new InputController(); const renderer = new Renderer(document.querySelector('#game-canvas'));
const elements = { score: document.querySelector('#score'), wave: document.querySelector('#wave'), lives: document.querySelector('#lives'), start: document.querySelector('#start-screen'), over: document.querySelector('#game-over-screen'), final: document.querySelector('#final-score') };
function begin() { input.clear(); game.start(); syncUi(); }
document.querySelector('#start-button').addEventListener('click', begin); document.querySelector('#restart-button').addEventListener('click', begin);
window.addEventListener('keydown', (event) => { if (event.code === 'Enter' && game.state === GameState.GAME_OVER) begin(); });
function syncUi() { elements.score.textContent = String(game.score).padStart(6, '0'); elements.wave.textContent = String(game.wave).padStart(2, '0'); elements.lives.textContent = '♥ '.repeat(game.player.lives).trim() || '—'; elements.start.classList.toggle('is-hidden', game.state !== GameState.TITLE); elements.over.classList.toggle('is-hidden', game.state !== GameState.GAME_OVER); if (game.state === GameState.GAME_OVER) elements.final.textContent = `Final score: ${game.score}`; }
let previous = performance.now(); let accumulator = 0; const step = 1 / 120;
function frame(now) { accumulator += Math.min(.1, (now - previous) / 1000); previous = now; while (accumulator >= step) { game.update(step, input); accumulator -= step; } syncUi(); renderer.render(game, now / 1000); requestAnimationFrame(frame); }
syncUi(); requestAnimationFrame(frame);
