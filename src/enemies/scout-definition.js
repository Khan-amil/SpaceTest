export const scoutDefinition = Object.freeze({
  kind: 'scout',
  health: 1,
  value: 125,
  width: 38,
  height: 28,
  bobAmplitude: 0,
  bobFrequency: 0,
  dive: Object.freeze({
    duration: 2.4,
    depth: 450,
    lateralWidth: 140,
    segments: 1,
    telegraphDuration: 0.45,
    returnDuration: 0.9,
    aimedShot: false,
    cadenceWeight: 1,
  }),
});
