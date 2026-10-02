import test from 'node:test';
import assert from 'node:assert/strict';
import { getWaveDefinition } from '../src/waves.js';

test('wave recipes retain the first formation and vary later formations deterministically', () => {
  const first = getWaveDefinition(1);
  const second = getWaveDefinition(2);

  assert.deepEqual(first.formation, { columns: 7, rows: 3, spacingX: 75, spacingY: 53, startY: 105 });
  assert.notDeepEqual(second.formation, first.formation);
  assert.deepEqual(getWaveDefinition(4).formation, first.formation);
  assert.ok(second.movement.speed > first.movement.speed);
  assert.ok(second.firing.interval < first.firing.interval);
  assert.ok(second.clearBonus > first.clearBonus);
  assert.equal(first.diveCadence, null);

  first.formation.columns = 100;
  assert.equal(getWaveDefinition(1).formation.columns, 7);
});
