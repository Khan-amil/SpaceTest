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
| `src/enemy-ai.js` | Archetype registry, formation targets, and enemy behavior transitions | DOM/canvas/audio |
| `src/dive-paths.js` | Cubic Bézier evaluation, departure paths, exit clearance, and return geometry | State transitions or rendering |
| `src/enemies/*-definition.js` | Immutable archetype health, rewards, dimensions, and motion data | Runtime state or drawing |
| `src/enemies/scout.js`, `wasp.js`, `sentinel.js` | Original canvas silhouette drawing | Simulation rules |
| `src/enemy-visuals.js` | Kind-to-drawing registry | Archetype balance |
| `src/input.js` | Keyboard-to-action adapter | Player movement logic |
| `src/game.js` | Authoritative simulation, states, waves, events | DOM/canvas/audio |
| `src/renderer.js` | Canvas drawing only | Collision or score rules |
| `src/main.js` | Browser composition, fixed timestep, UI sync | Gameplay rules |
| `src/storage.js` | Failure-safe best-score and mute persistence adapter | Simulation or DOM wiring |

`Game` runs as a deterministic model if supplied a seeded `random` function. Browser code passes `Math.random`; tests pass a constant. It exposes a small event queue (`consumeEvents`) for additions such as audio, screen shake, analytics, or particles without coupling those systems to rules.

## Current vertical slice

- Title, timed wave-intro/clear transitions, play, pause, and game-over states with real restart/resume paths. Pause also freezes transition timers and resumes their previous phase.
- WASD/arrow movement, held-space firing, Enter confirmation, Escape pause, and an M-key sound preference toggle.
- Data-driven Scout/Wasp/Sentinel formations, hostile fire, projectile and direct-contact collision, score, three lives, invulnerability feedback, and scaled wave speed/fire rate. Wave clear awards a bonus once, discards old projectiles, and introduces the next formation on a later simulation tick.
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

`getWaveDefinition(number)` rotates three small layout variants while preserving the first 7×3 grid and the existing speed/fire scaling. Recipes declare a row-based enemy mix. `Game` optionally accepts a wave-definition factory as its second constructor argument for deterministic configuration tests.

The browser merges the immutable game-over summary with the saved best score when displaying the overlay. Storage is optional, stores no run history, and never enters the simulation. The automated suite includes simulation, storage, input, markup, and browser-composition checks. See [PHASE_1_PLAYTEST.md](PHASE_1_PLAYTEST.md) for the pending manual acceptance gate.

## Phase 2 enemy model and validation

Enemies retain immutable-in-practice `home` slots plus individual `formationOffset`s.
`Game.formation` owns shared translation and elapsed time; formation bounds include
only formation and telegraphing enemies, with room reserved for lateral bob. Diving
and returning enemies never overwrite their home anchor or steer formation edges.
When every living enemy is away from formation, shared translation waits for re-entry.

`enemy-ai.js` consumes immutable definitions and owns the explicit formation →
telegraphingDive → diving → returning → formation sequence. Phase 3 replaces the
initial sine paths with cubic Béziers; return curves target the current moving slot.
Dead enemies enter `exploding`,
clear path data, and are collision-disabled immediately; the renderer currently
removes them without an explosion lifetime, leaving particles to Phase 6.

Waves 1–2 retain Scouts only and disable dives. Wave 3 adds a Wasp row; wave 5 adds
a Sentinel row. Starting at wave 3, cadence is five seconds and one active diver
includes telegraphing and returning enemies. Invulnerability blocks new dives.
Sentinel selection has one quarter the per-enemy dive weight of other types.
The whole formation shares its speed; Sentinel's slower movement is its dive duration
and quieter bob. Each Wasp dive creates one shot with a bounded downward aim angle;
projectiles now support horizontal velocity and expire beyond either screen axis.

Scouts and Wasps take one hit; Sentinels take two. Only destruction awards the
archetype's `value` (125 / 200 / 350). Every successful player projectile counts as
one accuracy hit, including the Sentinel shield hit. Contact retains the existing
no-score removal rule and cancels behavior. New `enemyDamaged` and
`enemyDiveTelegraphed` events join dive-start/end and destruction events.

Pure archetype definitions and canvas visuals are separate dependencies; renderer
dispatch uses the `kind` registry and does not mutate enemies. The warning outline
is steady in reduced-motion mode, and Sentinel shield damage changes its silhouette.
Automated tests cover these rules. The final gate is a manual playtest recorded in
[PHASE_2_PLAYTEST.md](PHASE_2_PLAYTEST.md).

## Phase 3 dive geometry and fairness

`dive-paths.js` evaluates cubic Béziers in the 960 × 640 design space. Scouts take
a broad S-curve; Wasps use two equal-duration segments with a shared join tangent;
Sentinels use a slower, deeper curve. Direction comes from the injected game RNG.
Departure captures the player's X once, chooses an exit at least one player width
away, and crosses below the field before returning. Curves never home on later
player movement. Control points stay within the horizontal ship margins.

Warnings last 0.45 / 0.60 / 0.50 seconds for Scout / Wasp / Sentinel. The existing
pulsing outline stays steady with reduced motion. A warning waits through player
invulnerability before departure. Telegraphs, dives, and returns all reserve a slot
in the recipe's active-diver cap. Intro and pause remain frozen; destruction cancels
the path immediately, including when clearing the final enemy.

Wasps cap lateral acceleration at 1600 design pixels per second squared. The path
builder uses the cubic's second-derivative bounds to lengthen its nominal 1.9-second
duration where needed. Returns last 0.9 seconds (Scout/Wasp) or 1.1 seconds (Sentinel),
use an upward control point, and ease into the current home with a zero final curve
tangent. Formation movement and bob remain authoritative during re-entry.

The player exposes actual velocity after movement clamps. A Wasp fires once per
dive with 0.18 seconds of lead, a ±0.65-radian downward angle limit, a 340-pixel-per-
second speed limit, and a one-second per-enemy cooldown. These settings live in
its pure archetype definition. Cooldowns advance only during play and reset with
new entities. Difficulty bands and general projectile budgets remain Phase 4.

Automated coverage includes curve geometry, joined tangents/acceleration, edge exit
clearance, warning protection, capacity across all stages, moving-home convergence,
shot lead/cooldown, seeded events, collision cleanup, pause, and restart. See
[PHASE_3_PLAYTEST.md](PHASE_3_PLAYTEST.md) for the browser smoke check and human gate.
