# Phase 1 manual playtest gate

Implementation is ready for manual validation. **Gate status: pending user playtest.** Passing automated checks does not approve this gate.

Use a static server to open `index.html`. Record the browser, date, observed failures, and final pass/fail verdict below. Sound is currently a persisted preference; audio effects remain a later phase.

## Acceptance checklist

- [ ] Start with Launch mission or Enter. Wave 1 appears for about 1.25 seconds with no movement, firing, or damage, then gameplay starts automatically.
- [ ] Move with WASD/arrows and hold Space. Game keys do not scroll the page.
- [ ] Pause with Escape while moving/firing. Leave it paused for several seconds; enemies, bullets, cooldowns, and invulnerability remain frozen. Resume with Escape, Enter, or the button; controls do not remain stuck.
- [ ] Pause during the Wave N introduction and during the sector-clear notice. Resume returns to the same transition and completes only its remaining time.
- [ ] Destroy every enemy. The score receives one displayed clear bonus (Wave 1: 250), the sector-clear notice lasts about 0.7 seconds, and the next formation appears afterward. Old bullets do not carry into the next wave. No click is required to advance.
- [ ] Reach Wave 2 and verify its six-column formation, greater movement speed, and faster firing cadence. There are only Scout enemies; diving is disabled in Phase 1.
- [ ] Lose all three lives. The summary displays score, wave reached, enemies destroyed, accuracy, and best score. A run with no shots displays 0% accuracy. Contact removes an enemy without awarding hit accuracy or kill points.
- [ ] Restart without refreshing. Score, lives, wave, projectiles, cooldowns, invulnerability, and statistics reset; the best score and mute preference remain.
- [ ] Set mute, finish a run with a new best score, then refresh. Both preferences restore. A subsequent lower score does not overwrite the best.
- [ ] Navigate controls with Tab and activate each focused button with Enter/Space. Pause moves focus to Resume mission; game over moves focus to Fly again; starting/resuming returns focus to the game field.
- [ ] Check at desktop and 320px width. Every summary field and the restart button fit in the game field. Reduced-motion mode keeps intro/clear information readable.
- [ ] In a separate test profile with local storage unavailable, start, finish, mute, and restart. The game remains usable, with best score retained for that page session even though it cannot survive a refresh.

## Automated verification and smoke checks

- `node --test`: deterministic simulation, recipe, storage, input, presentation-contract, and real `main.js` composition checks. This is the command behind `npm test` (npm is not available in the current shell).
- `node --check` on all source/test modules and `git diff --check`.
- Browser smoke check: start, pause/resume, native Enter activation, zero-shot summary, and summary layout at 320px width. This is supplementary evidence, not the acceptance verdict.

## Playtest record

- Browser/device:
- Date:
- Observations/issues:
- Verdict: pending
