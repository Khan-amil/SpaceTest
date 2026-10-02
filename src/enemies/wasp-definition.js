export const waspDefinition = Object.freeze({
  kind: 'wasp',
  health: 1,
  value: 200,
  width: 38,
  height: 28,
  bobAmplitude: 6,
  bobFrequency: 2.5,
  dive: Object.freeze({
    duration: 1.9,
    depth: 430,
    lateralWidth: 100,
    cycles: 2,
    aimedShot: true,
    cadenceWeight: 1,
  }),
});
