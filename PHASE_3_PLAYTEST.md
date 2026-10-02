# Phase 3 dive-system validation

Status: **implemented; browser smoke check passed; human fairness gate pending**.

## Checks performed

On 2026-10-02, the Codex in-app browser served the repository over localhost HTTP.
Launching the production page displayed the wave introduction successfully. A
temporary preview using the production entity factories, behavior updates, and
renderer showed Scout, Wasp, and Sentinel warnings, dive positions, and return
positions against a translated home formation. All ships remained legible and
the reduced-motion warning retained a steady visible outline. No browser warnings
or errors were reported. The temporary preview was removed after checking.

This was a visual smoke check at sampled times, not a full real-time session or
a player assessment of difficulty. Automated fixed-step scenarios verify the full
motion, including endpoint clearance, Wasp acceleration bounds, warning order,
moving-home return, active capacity, death cleanup, pause, and seeded behavior.

The shell has no `npm` executable, so verification uses `node --test`, the exact
command behind `npm test`. JavaScript syntax and Git whitespace checks also run
before handoff. No test dependency or package change is needed.

## Human playtest gate

Serve the root and play through waves 3–5 (waves 1–2 intentionally disable dives).

- [ ] Read each warning before departure: Scout 0.45 seconds, Wasp 0.60 seconds,
  Sentinel 0.50 seconds. Shoot a warning enemy and verify immediate cancellation.
- [ ] Follow a Scout's broad S-curve below the field and its upward return. Confirm
  it rejoins the moving formation without snapping, including near edge reversals.
- [ ] Follow the faster Wasp's two joined lateral turns. Confirm its single led
  downward shot gives sufficient time to dodge when moving and near world edges.
- [ ] Confirm Sentinels retain their slower, deeper attack and two-hit silhouette.
- [ ] Take damage during a warning. New warnings should be blocked during protection,
  and the pending warning should wait until protection expires before departing.
- [ ] Pause in every stage, resume, and verify the path and cooldown continue correctly.
- [ ] Kill the last diver; confirm one clear bonus, no delayed shot or return, and
  clean behavior after restarting the run.
- [ ] Repeat with reduced motion and a narrow viewport. Record whether warnings,
  bullets, and returns remain legible and whether any attack feels unavoidable.

Tester / date / browser:

Observed fairness and readability findings:

Gate decision: pending human playtest.
