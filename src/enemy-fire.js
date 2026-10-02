/** Select alternating formation halves; a depleted lane falls back to survivors. */
export function selectFormationShooter(enemies, pattern, lane, random) {
  if (enemies.length === 0) return null;

  let candidates = enemies;

  if (pattern === 'alternating-lanes') {
    const positions = enemies.map((enemy) => enemy.x);
    const middleX = (Math.min(...positions) + Math.max(...positions)) / 2;
    const laneEnemies = enemies.filter((enemy) => (
      lane === 'left' ? enemy.x <= middleX : enemy.x > middleX
    ));

    if (laneEnemies.length > 0) candidates = laneEnemies;
  }

  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index];
}
