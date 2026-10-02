# Phase 2 manual playtest gate

Status: **pending manual playtest**. Automated tests do not close this gate.

Serve the repository root over HTTP and open `index.html`. Play through wave 5 to see
all archetypes. Waves 1–2 contain Scouts only; wave 3 adds Wasps and enables one diver
at a time; wave 5 adds the Sentinel top row. Enemy rewards are 125 / 200 / 350 points.

## Acceptance checks

- [ ] Start, move, fire, and clear the first two waves. Scouts have a compact angular
  magenta silhouette and take one shot; the score increases by 125 per kill.
- [ ] At wave 3, distinguish the narrow gold Wasps from Scouts by shape. Wasps bob
  sideways in formation, dive faster with two lateral turns, and fire one aimed shot.
- [ ] Before each dive, see the bright warning outline for roughly 0.45 seconds.
  The enemy remains targetable during the warning. Destroy one before departure;
  it must never dive, return, or fire later.
- [ ] Follow a surviving Scout through its wide S-shaped path. The formation keeps
  moving, and the enemy rejoins its current slot smoothly without a visible snap.
- [ ] At wave 5, recognize the wide armored Sentinel. The first shot opens the shield
  and exposes a core without awarding points; the second destroys it for 350 points.
  Sentinels dive less often and take a slower, deeper path.
- [ ] Pause during a warning, dive, and return. Enemies and bullets freeze; resume
  continues the same motion. After a hull hit, no new dive begins during invulnerability.
- [ ] Destroy the final enemy during a dive. Receive one wave-clear bonus and no
  delayed dive shot or returning enemy in the next wave.
- [ ] Lose the run and restart. No previous dive, health damage, or warning carries
  into the new formation; summary hit accuracy still counts each projectile hit.
- [ ] Enable OS/browser reduced motion and repeat a dive. Its warning remains readable
  as a steady outline; Sentinel shield damage remains clear by shape.
- [ ] Confirm enemy silhouettes, hostile bullets, and shield damage remain readable
  at desktop and narrow viewport sizes. Record any unfair contacts or aimed shots.

## Scope and results

Phase 2 uses basic time-parameterized paths to exercise the extensible state model.
Phase 3 owns authored Bézier paths, stronger aiming/endpoint fairness, and return-path
tuning. Phase 4 owns difficulty bands and threat budgets. This playtest should record
readability and basic behavior findings without treating those later phases as complete.

Tester / date / browser:

Observed results and issues:

Gate decision: pending.
