# Space Attack architecture and handoff

Space Attack is a zero-dependency static site. Open `index.html` through any static web server, or publish the repository root with GitHub Pages. There is no bundler, asset pipeline, or framework to configure.

## Run and verify

Use any static server (for example VS Code Live Server) and open the repository root. Automated simulation checks run with:

```sh
npm test
```

The game is intentionally arranged as ES modules with one responsibility each:

| Module | Responsibility | Do not put here |
| --- | --- | --- |
| `src/constants.js` | Shared dimensions and balance defaults | Runtime state |
| `src/entities.js` | Entity factories and collision primitive | Game rules or rendering |
| `src/waves.js` | Wave recipes, formation layouts, cadence, and clear rewards | Runtime state or enemy behavior |
| `src/input.js` | Keyboard-to-action adapter | Player movement logic |
| `src/game.js` | Authoritative simulation, states, waves, events | DOM/canvas/audio |
| `src/renderer.js` | Canvas drawing only | Collision or score rules |
| `src/main.js` | Browser composition, fixed timestep, UI sync | Gameplay rules |
| `src/storage.js` | Failure-safe best-score and mute persistence adapter | Simulation or DOM wiring |

`Game` runs as a deterministic model if supplied a seeded `random` function. Browser code passes `Math.random`; tests pass a constant. It exposes a small event queue (`consumeEvents`) for additions such as audio, screen shake, analytics, or particles without coupling those systems to rules.

## Current vertical slice

- Title, timed wave-intro/clear transitions, play, pause, and game-over states with real restart/resume paths. Pause also freezes transition timers and resumes their previous phase.
- WASD/arrow movement, held-space firing, Enter confirmation, Escape pause, and an M-key sound preference toggle.
- Data-driven Scout formations, hostile fire, projectile and direct-contact collision, score, three lives, invulnerability feedback, and scaled wave speed/fire rate. Wave clear awards a bonus once, discards old projectiles, and introduces the next formation on a later simulation tick.
- Game-over summaries report score, wave reached, enemies destroyed (including contact removals), hit percentage, and best score. Only best score and mute preference are saved locally; failures retain those values in memory for the current page session.
- Responsive, canvas-based arcade presentation with semantic controls, live status announcements, and a reduced-motion mode.

## Recommended next ownership slices

1. **Gameplay/balance:** enrich enemy behavior, wave recipes, pickups, and score tuning in `game.js`/new modules; retain the `Game` UI-free boundary.
2. **Presentation:** particles, animation, sound, sprites, and effects subscribe to `Game.consumeEvents()`; keep `renderer.js` presentation-only.
3. **UI/accessibility:** touch controls belong around `main.js` and `index.html`; retain the existing pause, persistence fallback, live-region, and reduced-motion behavior.
4. **QA:** add focused state-model tests in `test/`. Prefer simulation inputs over canvas assertions.

## Collaboration guardrails

- Coordinate edits to `src/game.js`: it is the main integration point. New self-contained systems should be new modules.
- Preserve the fixed update in `main.js`; frame-rate dependent game rules will introduce inconsistent collision and movement.
- Treat `GAME_WIDTH`/`GAME_HEIGHT` as the design coordinate system. CSS scales the canvas visually.
- Avoid adding dependencies unless a later requirement genuinely needs one; this foundation is deployable to GitHub Pages as-is.

## Phase 1 lifecycle and validation

`Game.start()` introduces Wave 1 for 1.25 simulation seconds before enabling play. When the last living enemy is removed, a 0.7-second clear notice awards the recipe's bonus, followed by the next wave's introduction. These timers advance through the fixed update loop without blocking browser rendering. Only the intro/clear timer advances during `WAVE_INTRO`; `PAUSED` advances nothing. A fatal hit takes precedence over advancing the wave.

`getWaveDefinition(number)` rotates three small layout variants while preserving the first 7×3 grid and the existing speed/fire scaling. Recipes declare a row-based enemy mix and `diveCadence: null`: diving is disabled until the Phase 2/3 behavior systems consume that configuration. `Game` optionally accepts a wave-definition factory as its second constructor argument for deterministic configuration tests.

The browser merges the immutable game-over summary with the saved best score when displaying the overlay. Storage is optional, stores no run history, and never enters the simulation. The automated suite includes simulation, storage, input, markup, and browser-composition checks. See [PHASE_1_PLAYTEST.md](PHASE_1_PLAYTEST.md) for the pending manual acceptance gate.
