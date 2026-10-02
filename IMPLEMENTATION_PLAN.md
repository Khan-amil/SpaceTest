# Space Attack — full implementation plan

## Product goal

Deliver a fast, readable arcade shooter that feels complete in a short session: the player learns the controls immediately, survives escalating formations, adapts to unpredictable diving enemies, and gets a clear reason to replay after every game over. The game remains a static, dependency-free GitHub Pages site.

The existing foundation already supplies the fixed-timestep loop, game state, input abstraction, canvas renderer, basic projectile collision, score/lives, and a simple advancing formation. This plan deliberately extends those seams instead of replacing them.

## Definition of done

A release is ready when it has:

- A start screen, playable game, transition between waves, game-over summary, and restart without a page refresh.
- Keyboard controls that are discoverable, responsive, and do not scroll the page.
- Multiple enemy archetypes and wave recipes, including formation-breaking dives with curved paths.
- Fair collision rules, clear damage feedback, score/lives, increasing difficulty, and a satisfying high-score/replay loop.
- Polished visual and audio feedback, optional reduced-motion behavior, and usable small-screen controls.
- Passing simulation tests for all game rules and a clean GitHub Pages deployment.

## Guiding implementation rules

1. **Simulation remains authoritative.** `src/game.js` owns state changes; canvas, DOM, audio, and effects react to emitted events. No renderer should mutate game state.
2. **Fixed time stays fixed.** All gameplay updates use the current `1 / 120` simulation step. Rendering may interpolate later, but rules must never depend on browser frame rate.
3. **Design coordinates are stable.** Keep `960 × 640` as the game world. CSS can scale it; systems use `GAME_WIDTH` and `GAME_HEIGHT`.
4. **Data over special cases.** Add enemy and wave definitions as plain data, then make generic systems consume them. This makes balancing safe and keeps wave changes out of collision code.
5. **Keep features vertically complete.** Each phase includes model logic, presentation feedback, tests, and a manual check; avoid large invisible backend-only batches.

## Target module map

| Module | Ownership after the full build |
| --- | --- |
| `constants.js` | Design dimensions, globally shared defaults, event names if they become numerous |
| `entities.js` | Entity factories, type definitions through JSDoc, geometric primitives |
| `input.js` | Keyboard and pointer/touch actions only |
| `game.js` | State machine, update ordering, rule orchestration, event queue |
| `waves.js` | Wave recipes, difficulty curve, spawn plans, formation layouts |
| `enemy-ai.js` | Formation and diving movement state machines; no canvas calls |
| `collision.js` | Collision-pair dispatch and damage outcomes if `game.js` becomes crowded |
| `powerups.js` | Drop rules, pickup updates, temporary player modifiers |
| `renderer.js` | World, entity, particles, transitions, screen shake, HUD-adjacent canvas visuals |
| `audio.js` | Web Audio setup, event-to-sound mapping, mute and volume persistence |
| `main.js` | Composition root, DOM overlay state, storage adapter, fixed update loop |
| `test/*.test.mjs` | Pure, deterministic unit and scenario tests |

Create a module only once its existing owner has two clearly independent responsibilities. Avoid a generic entity-component framework: the game is small enough for explicit objects and functions.

## Phase 0 — agree the playable contract ✅

**Outcome:** The team has a short, testable target before adding content.

- Document input: arrow keys/WASD move; Space fires; Enter starts/restarts; Escape pauses; `M` toggles sound.
- Decide the session shape: three lives, no continues, waves advance automatically, waves clear after all enemies are destroyed.
- Specify collision outcomes: player bullets damage enemies; enemy bullets and direct enemy contact damage the player; player invulnerability is brief and visibly telegraphed.
- Establish an event catalog such as `playerFired`, `enemyDestroyed`, `enemyDiveStarted`, `enemyDiveEnded`, `playerDamaged`, `waveStarted`, `waveCleared`, `powerupCollected`, `gameOver`.
- Define an accessibility baseline: no critical information only in color; focusable start/restart controls; `prefers-reduced-motion` avoids excessive shake/flash; visible instruction copy.

**Acceptance checks:** a newcomer can start, move, fire, see score/lives/wave, die, and replay without guessing controls.

### Implemented contract

- **Controls:** WASD or arrow keys move; Space fires; Enter launches/restarts/resumes; Escape pauses/resumes; M toggles the sound preference. Game control keys never scroll the page.
- **Session rules:** every run starts with three lives; there are no continues; a wave advances only after every living enemy is destroyed.
- **Collision rules:** player bullets destroy one enemy and award score; enemy bullets and enemy hull contact each remove one life. A damaged player receives 1.1 seconds of visible invulnerability, preventing repeated hits from the same overlap.
- **Events:** `GameEvent` in `src/constants.js` is the canonical event catalogue. Existing events are consumed from `Game.consumeEvents()` by the browser composition layer; future effects and audio extend that one dispatcher.
- **Accessibility:** controls are visible on the title screen and described to assistive technology; start/restart/resume/mute are native focusable buttons; score, wave, and numeric hull count are readable without color; game-critical updates use a concise live region; reduced-motion preference stops decorative star motion and the invulnerability flash.

## Phase 1 — complete the state and wave lifecycle

**Outcome:** A predictable game session with clean transitions.

1. Add `WAVE_INTRO` and `PAUSED` states to `GameState`. `WAVE_INTRO` freezes danger briefly while showing `WAVE N`; `PAUSED` freezes simulation and exposes a resume overlay.
2. Replace `spawnWave()`'s fixed 7×3 grid with `getWaveDefinition(waveNumber)` from `waves.js`.
3. Support per-wave formation layout, enemy mix, movement speed, bullet cadence, dive cadence, and clear bonus.
4. Add a short non-blocking clear transition: destroy final target → emit `waveCleared` → award bonus → introduce next wave. Do not respawn in the same simulation tick.
5. Add game-over summary fields: score, wave reached, enemies destroyed, accuracy, and saved best score.
6. Persist only opt-in-safe local data: high score, muted setting, and perhaps control preference through `localStorage`; gracefully handle storage failure.

**Tests:** state transitions cannot skip from title to game over; pause prevents movement/cooldowns; a cleared wave gives one bonus and advances once; restart resets temporary effects but preserves high score.

## Phase 2 — make enemy behavior extensible

**Outcome:** Enemies use explicit behavior states, allowing formation breakers without fragile one-off motion code.

Each enemy gains stable fields:

```js
{
  kind: 'scout',           // controls sprite, health, score, behavior capabilities
  behavior: 'formation',   // formation | telegraphingDive | diving | returning | exploding
  home: { x, y },          // formation slot, not a constantly overwritten position
  formationOffset: { x, y },
  dive: null,              // active path/timing data only while diving
  health: 1,
  value: 125,
}
```

Use `home` as the anchor, then calculate formation position from a shared formation controller. This prevents a returning enemy from snapping, and lets a formation shift without corrupting dive state.

### Enemy archetypes

Start with three readable types, all sharing the same collision shape API:

| Type | Role | Formation behavior | Dive behavior | Reward |
| --- | --- | --- | --- | --- |
| Scout | Basic target | Tracks the group simply | Short wide S-curve | Low score |
| Wasp | Aim disruptor | Slight lateral bob | Faster corkscrew and one aimed shot | Medium score |
| Sentinel | Priority target | Shielded/slow | Rare deep loop, two health | High score |

Archetype configuration belongs in `waves.js`/`enemy-ai.js`, not in renderer conditionals. Initially, sprites can be shape variants; later a sprite atlas can use the same `kind` field.

**Tests:** only configured archetypes appear; an enemy cannot begin a second dive while diving; enemy death cancels future behavior; returning enemies reacquire formation successfully.

## Phase 3 — design the formation-break dive system

**Outcome:** Enemies become harder to hit but remain fair, legible, and deterministic.

### State machine

1. `formation`: enemy follows its home slot plus shared formation motion.
2. `telegraphingDive`: 0.35–0.60 seconds of bright pulse/engine flare; it remains targetable but has not left the group.
3. `diving`: enemy follows a time-parameterized curve, may fire according to its archetype, and is excluded from formation edge calculations.
4. `returning`: enemy takes a safe upward curve toward a computed re-entry point, then transitions to `formation` once close enough.
5. `exploding`: collision-disabled short visual lifetime (or removal managed by effects).

### Curves and aiming fairness

Use cubic Bézier curves rather than per-frame hand-authored `sin` additions. Given a start point `P0`, control points `P1/P2`, and end point `P3`, calculate position at normalized time `t` using De Casteljau or the cubic Bézier equation. This yields smooth, testable movement and predictable durations.

- Select a left/right direction with injected game RNG so tests can reproduce it.
- `Scout`: a broad S-curve that crosses below the player but exits away from the player’s current X position.
- `Wasp`: two joined Béziers, creating a corkscrew-like lateral path. Cap lateral acceleration and use a longer telegraph.
- Choose the dive endpoint at least one ship width away from the player’s current position, unless the archetype has a clearly announced aimed attack.
- An enemy bullet uses a short lead based on player velocity, but clamp its angle/speed and add a cooldown. The goal is pressure, not unavoidable shots.
- Do not permit a new dive during wave intro, player respawn/invulnerability, or when the active-dive cap is reached.

### Formation behavior while enemies dive

- The formation continues using only `formation`/`telegraphingDive` members for its horizontal bounds.
- A returning enemy is not required to reoccupy the exact historical slot while the group has moved. It targets the current position of its `home` slot, then eases back over a short duration.
- If a wave ends during a dive, mark the enemy dead immediately and let effects finish independently; never permit it to trigger a return after wave clear.

**Tests:** curve starts/ends at expected points; active dives never exceed configured cap; a telegraph always precedes a dive; return converges to the moving home slot; seeded RNG produces equal event sequences.

## Phase 4 — turn waves into a deliberate difficulty curve

**Outcome:** Difficulty climbs through one new pressure at a time, rather than merely making every value larger.

`getWaveDefinition(number)` should return a bounded recipe generated from named bands. The following table is a starting balance plan, not hard-coded truth; tune after playtests.

| Waves | New pressure | Formation speed | Enemy shots | Max divers | Suggested composition |
| --- | --- | ---: | ---: | ---: | --- |
| 1–2 | Learn aim and movement | 0.8×–1.0× | Slow, sparse | 0 | Scouts only |
| 3–4 | Read telegraphs | 1.05×–1.2× | Regular | 1 | Scouts plus one Wasp row |
| 5–6 | Track curved targets | 1.25×–1.4× | Faster | 2 | Scouts/Wasps, rare Sentinel |
| 7–9 | Manage crossfire | 1.45×–1.6× | Alternating lanes | 2 | More Wasps, two-health Sentinel |
| 10+ | Remix constraints, cap chaos | 1.65× cap | Faster but capped | 3 max | Recipes rotate with elite sets |

Rules for the curve:

- Add one mechanic, let it breathe for at least one wave, then combine it later.
- Scale values with caps: enemy horizontal speed, bullet speed, fire cadence, active dives, and on-screen projectile count all have limits.
- Use a `threat budget` per wave. Every enemy type and dive consumes budget; wave number raises the budget gradually. This avoids accidental impossible combinations.
- Award a wave-clear bonus plus a small no-damage bonus to reward mastery without requiring perfection.
- Keep the first appearance of every type in a safe location and show a one-line wave-intro hint.
- For waves beyond authored content, rotate a seed-based recipe set rather than endlessly adding rows. This remains challenging while keeping the screen readable.

**Playtest gate:** A new player should normally reach wave 3; a practiced player should reach wave 7 reliably; advanced players should have meaningful score-chasing beyond wave 10. Revise targets after real playtests, not before.

## Phase 5 — player combat, health, and rewards

**Outcome:** The player has just enough options to answer new pressure without losing Space Invaders clarity.

1. Improve firing feedback: brief muzzle flash, projectile trail, firing sound, and a small cooldown indicator only if it helps readability.
2. Add player hit resolution: flash, knockback/brief freeze, ship explosion, respawn at a safe bottom-center point, and invulnerability visible by blinking/thruster shield.
3. Add collision pairs deliberately: player projectile/enemy, enemy projectile/player, enemy/player, player/power-up. Test every pair.
4. Add modest, rare power-ups from configured enemies: rapid fire, spread shot, shield, score multiplier. Use duration and stacking rules declared in data; no random permanent power creep.
5. Add accuracy and destroyed counts to score summary. Count a shot at creation and a hit on collision; do not derive accuracy from particle events.
6. Add an optional mid-wave extra-life threshold only if playtesting shows sessions end too abruptly; cap it to prevent endless runs.

**Tests:** invulnerability blocks repeated hits; modifier expiry restores defaults; pickup only applies once; score is awarded once per enemy; destroyed projectile cannot collide again.

## Phase 6 — presentation and game feel

**Outcome:** The game looks and feels like an arcade title, not an engineering prototype.

### Visual priorities

- Build a coherent palette: deep navy space, cyan player energy, magenta enemy threat, gold score/reward. Maintain enough luminance contrast for bullets and HUD.
- Add parallax star layers and subtle nebula gradients without compromising target readability.
- Animate ships with engine flicker, banking based on velocity, and enemy telegraph pulses.
- Use event-driven particle pools for muzzle flashes, explosions, debris, pickup glints, and wave clear bursts. Reuse particles; do not allocate unbounded effects every frame.
- Add restrained screen shake only for player damage, Sentinel destruction, and wave clear. Respect reduced motion.
- Add short HUD animations for score increment, life loss, wave intro, and new best score.

### Audio priorities

- Use Web Audio API-generated effects first: fire, hit, explosion, enemy dive warning, pickup, wave clear, and game over.
- Lazily initialize audio after the user presses Start to satisfy browser autoplay rules.
- Map sounds from game events in `audio.js`; the model never calls Web Audio directly.
- Include mute button/`M` shortcut and persist the choice locally.

**Manual checks:** critical enemy bullets remain visible during explosions; no sound begins before user input; playing rapidly for several minutes has no growing particle/entity count; reduced-motion mode remains fully playable.

## Phase 7 — UI, responsiveness, and accessibility

**Outcome:** The full game loop is comfortable on desktop and does not exclude basic browser users.

- Keep HTML overlays as real semantic controls; canvas is the game field, not the sole way to start/restart.
- Add pause/resume, mute, and a compact in-game controls reminder.
- On narrow layouts, preserve canvas aspect ratio and scale HUD typography; test at 320px wide and at a wide desktop size.
- Add large optional touch controls only below a breakpoint or when coarse pointer input is detected. They call `InputController` actions rather than duplicating game rules.
- Label canvas and controls; use live-region updates sparingly (wave start, game over), never every frame.
- Honor `prefers-reduced-motion`: no large shake/flash and slower or removed decorative movement, while retaining gameplay telegraphs.

**Manual checks:** all menu controls work with Tab/Enter; keyboard controls do not trigger page scroll; restart focuses the game/start action appropriately; touch buttons cannot become stuck after a cancelled pointer event.

## Phase 8 — quality, performance, and release hardening

**Outcome:** Stable release candidate, not simply a feature-complete build.

1. Expand Node simulation tests using seeded RNG and scripted input. Cover every state, wave transition, enemy behavior transition, collision outcome, modifier lifecycle, and high-score adapter fallback.
2. Add a few long-run simulation tests (for example, 10,000 fixed updates) to catch leaked bullets/particles, invalid coordinates, duplicate score awards, and invalid states.
3. Add debug-only instrumentation behind a query parameter or development flag: active entities, current wave recipe, hit boxes, and event counts. Keep it out of normal presentation.
4. Profile on a low-power device target. Cap particles/projectiles, avoid per-frame DOM changes beyond necessary HUD values, and pre-render/static-cache where justified.
5. Test current Chrome, Firefox, Safari, and mobile Chrome/Safari. Specifically validate audio start, keyboard focus, touch controls, scaling, and local storage failure behavior.
6. Review deployment: `npm test` must pass in GitHub Actions before the Pages artifact deploys; manually open the deployed URL after a release candidate.
7. Add release notes and a short credits/license section for any external art/audio. Prefer original or clearly licensed assets.

## Suggested delivery sequence

Each item should be a small pull request with its tests and a playable browser check.

1. Wave state transitions and data-driven `waves.js`.
2. Enemy behavior state model plus a single Scout dive.
3. Dive telegraph/return behavior and deterministic movement tests.
4. Wasp/Sentinel archetypes and difficulty-band recipes.
5. Player damage/respawn polish and a first power-up.
6. Full event-to-effects/audio layer.
7. Pause, mute, high score, game-over statistics, and responsive/touch UI.
8. Extended balance pass, accessibility review, long-run tests, browser QA, release.

## PR checklist

- [ ] Uses the appropriate system boundary; no UI/audio code in the simulation.
- [ ] Adds or updates deterministic tests for changed rules.
- [ ] Does not make gameplay frame-rate dependent.
- [ ] Emits a semantic game event for a new visible/audio effect.
- [ ] Handles reset/restart, wave clear, game over, and pause where applicable.
- [ ] Has a manual playtest note describing the observed behavior.
- [ ] Keeps the static Pages artifact free of development-only files and dependencies.

