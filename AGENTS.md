# Engineering guidelines

## Readability is a delivery requirement

All code must be clear enough for the next engineer to understand without reverse-engineering it.

- Use descriptive names that communicate intent; avoid unexplained abbreviations and clever compressed expressions.
- Keep one logical statement per line. Use whitespace to separate distinct steps and visual groups.
- Group related declarations, functions, and constants together in a predictable order.
- Add short comments for non-obvious decisions, constraints, coordinate systems, algorithms, side effects, and browser workarounds. Do not narrate self-evident syntax.
- Prefer small, focused functions/modules. When a file starts serving more than one responsibility, extract a cohesive module rather than creating a sprawling utility file.
- Preserve the existing boundaries: simulation has no DOM/canvas/audio calls; rendering does not mutate game state; browser wiring stays in `src/main.js`.

## CSS conventions

- Organize stylesheet rules into labelled sections ordered as: tokens/base, layout, HUD, overlays/typography, controls, accessibility, then responsive or motion overrides.
- Write one declaration per line and leave a blank line between selectors and sections.
- Keep selectors narrow and name styles after their UI role. Do not rely on DOM position selectors when a semantic class or direct selector is clearer.
- Add a short comment where a visual rule protects readability, accessibility, or a game-specific behavior.

## Verification

- Add or update deterministic tests whenever gameplay rules, state transitions, collision behavior, or accessible UI contract changes.
- Before handoff, run the relevant tests and syntax/format checks. Report any environment limitation plainly.
