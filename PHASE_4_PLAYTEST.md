# Phase 4 difficulty-curve validation

Status: **implemented; final approval pending manual playtests**.

Three Luna sub-agents authored and tuned waves 1–4, 5–9, and the seeded endless
remix set. These are initial balance settings, not observed player performance.
Automated checks exercise recipes, safe type debuts, threat budgets, seeded
rotation, firing lanes, shared projectile limits, dive capacity, reward resets,
browser hints/rewards, and 10,000 fixed updates in a late-wave scenario.

On 2026-10-02, all 61 tests passed with `node --test`, the command behind
`npm test`; this shell has Node but no npm executable. All source/test JavaScript
passed `node --check`, and `git diff --check` passed. A production-page browser
smoke check verified launch, the visible/live wave-1 hint, drawing, and Escape
pause with no captured warnings or errors. The old preview server did not serve
the new recipe directory; a fresh static server at `http://127.0.0.1:4174`
resolved that preview issue. The game is left paused for manual testing.

## Manual acceptance gate

Serve the repository root with a static server. Play normal runs with WASD/arrows
and Space; Enter starts/restarts, Escape pauses/resumes. Each introduction gives
one hint. Record several runs per experience group, including failed runs.

| Waves | What to check |
| --- | --- |
| 1–2 | Scouts only, no dives, slow sparse shots; enough room to learn movement and aim. |
| 3–4 | Rear-row Wasps and one warning/dive at a time; warnings readable under quicker fire. |
| 5–6 | One rear Sentinel takes two hits; up to two reserved divers; curved targets remain trackable. |
| 7–9 | Formation shots alternate between formation halves; Wasp mix grows and two rear Sentinels appear by wave 9. |
| 10+ | Layouts and elite combinations rotate across ten recipes; no growing rows or unlimited speed/fire/divers. |

- [ ] A newcomer normally reaches wave 3. Record wave reached and the cause of each loss.
- [ ] A practiced player reaches wave 7 reliably. Record repeated runs, not a single best run.
- [ ] An advanced player finds meaningful score chasing beyond wave 10. Record recipe-specific spikes.
- [ ] Each type debut and hint give enough time to react; no combination feels unavoidable at an edge.
- [ ] A damage-free clear shows a small separate mastery bonus; taking damage removes only that bonus.
- [ ] Pause during warning/crossfire, resume, clear a wave, and restart; no delayed burst or stale mastery state.
- [ ] Reduced motion and a narrow viewport preserve warning, bullet, hint, and reward readability.

The wave-3/wave-7/wave-10 targets remain provisional until these playtests supply
evidence. Revise recipes in their band modules based on recorded observations.
Do not mark this gate passed based on the simulation suite or a browser smoke check.

Tester / date / browser / viewport / experience:

Runs (wave reached, score, damage cause, recipe or hint, fairness/readability):

Balance changes requested:

Gate decision: **pending**.

## Reported formation-return bug

Manual feedback: a purple enemy returned from a dive during a row descent; the
formation rapidly escaped toward the bottom-right while movement and shooting
continued without reachable enemies. This is a failing manual observation, not
approval of the phase.

The deterministic reproduction showed the old code dropping 2,640 pixels in one
second. A returning outer slot widened the surviving formation bounds; an
either-edge test reversed repeatedly even when movement pointed inward.

The fix makes edge turns directional and fits returned slots in the same tick.
Formation hulls stop descending at y = 320, keeping targets above the player's
upward firing origin. Corrupted shared coordinates and invalid/stalled behavior
recover automatically without losing health, score or lives. Recovery clears
hostile bullets, restores attack delays, and announces continuation. Pause and
legitimate invulnerability warnings retain their existing behavior.

After this fix, all 71 automated tests passed using `node --test`, including both
edge reproductions, simultaneous return/drop, five minutes of formation sweeps,
invalid-state and watchdog recovery, scoring/lifecycle rules, and browser recovery
announcements. JavaScript syntax and Git whitespace checks passed as well.

- [ ] Reload the page to load the fix; destroy the other outer-column enemies,
  watch an outer Scout return near each side, and confirm there is no rapid descent.
- [ ] Watch a return finish during a normal row drop: only one drop should occur.
- [ ] During a long wave, confirm the formation remains shootable at its descent
  limit while moving, firing and diving continue.
- [ ] Pause/resume during a return and verify that it rejoins normally.

Retest findings / browser / run:

Retest decision: **pending human playtest**.
