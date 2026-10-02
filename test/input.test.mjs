import test from 'node:test';
import assert from 'node:assert/strict';
import { InputController } from '../src/input.js';

test('game keys prevent scroll, repeat does not retrigger commands, and native buttons still activate', () => {
  const originalWindow = globalThis.window;
  const target = { addEventListener: () => {} };
  globalThis.window = target;

  try {
    const input = new InputController(target);
    let prevented = 0;
    const escape = { code: 'Escape', preventDefault: () => { prevented += 1; } };

    input.onKeyDown(escape);
    assert.equal(input.consumePressed('pause'), true);
    input.clear();
    input.onKeyDown({ ...escape, repeat: true });
    assert.equal(input.consumePressed('pause'), false);
    assert.equal(prevented, 2);

    for (const code of ['Enter', 'Space']) {
      input.onKeyDown({
        code,
        target: { closest: () => ({ tagName: 'BUTTON' }) },
        preventDefault: () => { throw new Error('Native activation should not be prevented'); },
      });
    }

    assert.equal(input.consumePressed('confirm'), false);
    assert.equal(input.isDown('fire'), false);
    input.onKeyDown({ code: 'Space', preventDefault: () => { prevented += 1; } });
    assert.equal(input.isDown('fire'), true);
    assert.equal(prevented, 3);
  } finally {
    globalThis.window = originalWindow;
  }
});
