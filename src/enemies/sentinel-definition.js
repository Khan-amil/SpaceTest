const sentinelDive = Object.freeze({
  duration: 3.3,
  depth: 480,
  lateralWidth: 160,
  segments: 1,
  telegraphDuration: 0.5,
  returnDuration: 1.1,
  aimedShot: false,
  cadenceWeight: 0.25,
});

export const sentinelDefinition = Object.freeze({
  kind: 'sentinel',
  health: 2,
  value: 350,
  width: 44,
  height: 34,
  bobAmplitude: 2,
  bobFrequency: 0.8,
  dive: sentinelDive,
});
