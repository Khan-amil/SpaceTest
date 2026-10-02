const KEY_ACTIONS = Object.freeze({
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'fire',
  Escape: 'pause', KeyM: 'mute', Enter: 'confirm',
});

/** Keeps browser events out of the simulation; tests and touch controls can drive this API too. */
export class InputController {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();
    this.onKeyDown = (event) => { const action = KEY_ACTIONS[event.code]; if (action) { if (!this.down.has(action)) this.pressed.add(action); this.down.add(action); event.preventDefault(); } };
    this.onKeyUp = (event) => { const action = KEY_ACTIONS[event.code]; if (action) { this.down.delete(action); event.preventDefault(); } };
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.clear());
  }
  isDown(action) { return this.down.has(action); }
  consumePressed(action) { const wasPressed = this.pressed.has(action); this.pressed.delete(action); return wasPressed; }
  clear() { this.down.clear(); this.pressed.clear(); }
}
