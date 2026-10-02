const KEY_ACTIONS = Object.freeze({
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'fire',
});

/** Keeps browser events out of the simulation; tests and touch controls can drive this API too. */
export class InputController {
  constructor(target = window) {
    this.down = new Set();
    this.onKeyDown = (event) => { const action = KEY_ACTIONS[event.code]; if (action) { this.down.add(action); event.preventDefault(); } };
    this.onKeyUp = (event) => { const action = KEY_ACTIONS[event.code]; if (action) { this.down.delete(action); event.preventDefault(); } };
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.clear());
  }
  isDown(action) { return this.down.has(action); }
  clear() { this.down.clear(); }
}
