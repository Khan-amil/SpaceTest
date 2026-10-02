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
| `src/input.js` | Keyboard-to-action adapter | Player movement logic |
| `src/game.js` | Authoritative simulation, states, waves, events | DOM/canvas/audio |
| `src/renderer.js` | Canvas drawing only | Collision or score rules |
| `src/main.js` | Browser composition, fixed timestep, UI sync | Gameplay rules |

`Game` runs as a deterministic model if supplied a seeded `random` function. Browser code passes `Math.random`; tests pass a constant. It exposes a small event queue (`consumeEvents`) for additions such as audio, screen shake, analytics, or particles without coupling those systems to rules.

## Current vertical slice

- Title, play, and game-over states with a real restart path.
- WASD/arrow movement and held-space firing.
- Enemy grid movement, basic hostile fire, projectile collision, score, lives, and scaled wave speed/fire rate.
- Responsive, canvas-based arcade presentation and semantic HTML controls.

## Recommended next ownership slices

1. **Gameplay/balance:** enrich enemy behavior, wave recipes, pickups, and score tuning in `game.js`/new modules; retain the `Game` UI-free boundary.
2. **Presentation:** particles, animation, sound, sprites, and effects subscribe to `Game.consumeEvents()`; keep `renderer.js` presentation-only.
3. **UI/accessibility:** pause, reduced-motion behavior, touch controls, and high-score persistence belong around `main.js` and `index.html`.
4. **QA:** add focused state-model tests in `test/`. Prefer simulation inputs over canvas assertions.

## Collaboration guardrails

- Coordinate edits to `src/game.js`: it is the main integration point. New self-contained systems should be new modules.
- Preserve the fixed update in `main.js`; frame-rate dependent game rules will introduce inconsistent collision and movement.
- Treat `GAME_WIDTH`/`GAME_HEIGHT` as the design coordinate system. CSS scales the canvas visually.
- Avoid adding dependencies unless a later requirement genuinely needs one; this foundation is deployable to GitHub Pages as-is.
