// Shared particle types (appearance + physics of one particle kind), grouped by family. Recipes combine these with
// positions & velocities. Families expose the same keys so generic effects (hit, burst) can swap elements:
//   flash (big short flash) · glow (soft orb) · spark (velocity streak) · star (glint) · mote (floating dot)
//   chunk (heavier bits: embers / shards / drops) · smoke (alpha puff) · ring (flat shock ring sprite)
import { S, R } from './textures.js';
import { P, V } from './particles.js';
import { lin } from './util.js';

// ------------------------------------------------------------------ generic
export const GEN = {
  flash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.16, size: 2.0, end: 1.4, ease: 2, i: 2.2, noGround: true }),
  bigFlash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.28, size: 6, end: 1.5, ease: 2, i: 1.6, noGround: true }),
  starFlash: P({ sprite: S.star, ramp: R.wFlash, life: 0.22, size: 1.6, end: 1.8, ease: 2, spin: 2, i: 3, noGround: true }),
  flare: P({ sprite: S.flare, ramp: R.wFlash, life: 0.18, size: 3.2, end: 1.3, ease: 2, rot: 0, i: 2.6, noGround: true }),
  glow: P({ sprite: S.glow, ramp: R.wInOut, life: 0.5, size: 1.2, end: 1.2, i: 1.5 }),
  glowFade: P({ sprite: S.glow, ramp: R.wFade, life: 0.4, size: 1.2, end: 1.4, i: 1.6, noGround: true }),
  spark: P({ sprite: S.spark, ramp: R.wHot, life: [0.25, 0.45], size: [0.05, 0.08], orient: 'stretch', stretch: 1.2, drag: 3, accY: -8, i: [4, 7] }),
  sparkLong: P({ sprite: S.spark, ramp: R.wHot, life: [0.35, 0.6], size: [0.06, 0.1], orient: 'stretch', stretch: 1.6, drag: 2.2, accY: -4, i: [4, 7] }),
  star: P({ sprite: S.twinkle, ramp: R.wInOut, life: [0.4, 0.8], size: [0.14, 0.26], end: 0.3, spin: [-2, 2], drag: 2, i: [3, 5] }),
  mote: P({ sprite: S.dot, ramp: R.wInOut, life: [0.8, 1.4], size: [0.05, 0.1], end: 0.4, drag: 0.8, accY: 1.4, turb: 0.3, i: [3, 6] }),
  ring: P({ sprite: S.shock, ramp: R.wFade, life: 0.4, size: 0.5, end: 9, ease: 3, orient: 'flat', i: 1.8 }),
  ringThin: P({ sprite: S.ring, ramp: R.wFade, life: 0.5, size: 0.8, end: 8, ease: 2.2, orient: 'flat', i: 2.2 }),
  flatGlow: P({ sprite: S.glow, ramp: R.wInOut, life: 0.8, size: 4, end: 1.2, orient: 'flat', i: 1.4 }),
  flatFlash: P({ sprite: S.glow, ramp: R.wFlash, life: 0.35, size: 6, end: 1.6, ease: 2, orient: 'flat', i: 2 }),
  pillar: P({ sprite: S.beam, ramp: R.wInOut, life: 0.7, size: 1.4, end: 0.8, orient: 'axisY', stretch: 6, i: 3 }),
  column: P({ sprite: S.column, ramp: R.wInOut, life: 0.9, size: 1.6, end: 1.1, orient: 'axisY', stretch: 5, i: 2.5 }),
  swirl: P({ sprite: S.swirl, ramp: R.wInOut, life: 0.5, size: 2.2, end: 0.3, spin: 9, i: 2.2 }),
  rune: P({ sprite: S.rune, ramp: R.wInOut, life: 0.8, size: 2, end: 1.3, ease: 2, orient: 'flat', spin: 1.5, i: 2.4 }),
  rays: P({ sprite: S.rays, ramp: R.wFlash, life: 0.5, size: 5, end: 1.4, ease: 2, spin: 0.6, i: 2, noGround: true }),
  streak: P({ sprite: S.spark, ramp: R.wInOut, life: [0.25, 0.4], size: [0.06, 0.1], orient: 'stretch', stretch: 0.3, i: 1.8, alpha: 0.8 }),
  orbitMote: P({ sprite: S.dot, ramp: R.wInOut, life: [0.8, 1.2], size: [0.06, 0.1], end: 0.5, motion: 'orbit', rise: 1.6, rgrow: 0.05, i: [4, 7] }),
  orbitStar: P({ sprite: S.twinkle, ramp: R.wInOut, life: [0.8, 1.2], size: [0.18, 0.28], end: 0.3, motion: 'orbit', rise: 1.8, rgrow: 0.12, spin: [-3, 3], i: [3, 5] }),
  converge: P({ sprite: S.twinkle, ramp: R.wInOut, life: [0.35, 0.45], size: [0.2, 0.3], end: 0.3, motion: 'orbit', rise: 0, rgrow: -4.5, spin: 3, i: [3, 5] }),
};

// ------------------------------------------------------------------ physical
export const PHYS = {
  spark: P({ sprite: S.spark, ramp: R.ember, life: [0.2, 0.4], size: [0.04, 0.07], orient: 'stretch', stretch: 1.3, drag: 3, accY: -9, color: [1, 0.9, 0.6], i: [5, 8] }),
  hitFlash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.12, size: 1.3, end: 1.3, ease: 2, color: [1, 0.85, 0.55], i: 2.8, noGround: true }),
  hitStar: P({ sprite: S.star, ramp: R.wFlash, life: 0.12, size: 0.8, end: 1.5, color: [1, 0.9, 0.7], i: 3, noGround: true }),
  dust: P({ pool: 'alpha', sprite: [S.dust, S.smoke2, S.smoke3], ramp: R.dust, life: [0.8, 1.3], size: [0.5, 0.8], end: [2.2, 3], ease: 2.5, spin: [-0.6, 0.6], drag: 3, accY: 0.3, turb: 0.1 }),
  dustBig: P({ pool: 'alpha', sprite: [S.dust, S.smoke2, S.smoke1], ramp: R.dust, life: [1.1, 1.7], size: [1.0, 1.4], end: [2.2, 3], ease: 2, spin: [-0.5, 0.5], drag: 3.2, accY: 0.4 }),
  hitDust: P({ pool: 'alpha', sprite: [S.dust, S.smoke2], ramp: R.dust, life: [0.35, 0.5], size: [0.25, 0.35], end: 2.2, ease: 2.5, drag: 4, alpha: 0.5 }),
  pebble: P({ pool: 'alpha', sprite: S.rock, ramp: R.wSolid, life: [0.5, 0.8], size: [0.06, 0.12], spin: [-8, 8], drag: 0.5, accY: -14, color: [0.35, 0.3, 0.25] }),
  rockBit: P({ pool: 'alpha', sprite: S.rock, ramp: R.wSolid, life: [0.7, 1.1], size: [0.12, 0.26], spin: [-6, 6], drag: 0.3, accY: -16, color: [0.3, 0.26, 0.22] }),
  blood: P({ pool: 'alpha', sprite: S.drop, ramp: R.blood, life: [0.35, 0.6], size: [0.09, 0.14], orient: 'stretch', stretch: 0.45, drag: 1.5, accY: -11 }),
  bloodMist: P({ pool: 'alpha', sprite: S.smoke2, ramp: R.blood, life: 0.35, size: 0.35, end: 2.2, ease: 2, alpha: 0.5 }),
  drop: P({ pool: 'alpha', sprite: S.drop, ramp: R.water, life: [0.5, 0.9], size: [0.08, 0.14], orient: 'stretch', stretch: 0.35, drag: 0.6, accY: -12, color: [0.85, 0.95, 1.05] }),
  mist: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke3], ramp: R.smokeLight, life: [0.7, 1.2], size: [0.4, 0.7], end: [2, 3], ease: 2, drag: 2.5, accY: 0.2, color: [1, 1.05, 1.1] }),
  ring: P({ sprite: S.shock, ramp: R.wFade, life: 0.35, size: 0.4, end: 9, ease: 3, orient: 'flat', color: [1, 0.9, 0.7], i: 1.6 }),
  dustRing: P({ pool: 'alpha', sprite: [S.dust, S.smoke2, S.smoke1], ramp: R.dust, life: [0.9, 1.4], size: [0.8, 1.1], end: [2.2, 3], ease: 2, spin: [-0.5, 0.5], drag: 3.2, accY: 0.4 }),
  smoke: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.smoke, life: [1.0, 1.6], size: [0.5, 0.8], end: [2.2, 3.2], ease: 2, spin: [-0.5, 0.5], drag: 1.2, accY: 1.2, turb: 0.25 }),
  sand: P({ pool: 'alpha', sprite: [S.dust, S.smoke2, S.smoke3], ramp: R.sand, life: [1.0, 1.6], size: [0.7, 1.0], end: [2.4, 3.2], ease: 2, spin: [-0.6, 0.6], drag: 2.4, accY: 0.2, turb: 0.2 }),
  sandGrain: P({ pool: 'alpha', sprite: S.dot, ramp: R.wSolid, life: [0.6, 1.1], size: [0.04, 0.08], drag: 0.6, accY: -10, color: [0.8, 0.62, 0.36] }),
  wind: P({ sprite: S.spark, ramp: R.wInOut, life: [0.3, 0.5], size: [0.05, 0.09], orient: 'stretch', stretch: 0.35, drag: 1, color: [0.9, 0.95, 1], i: 1.4, alpha: 0.7 }),
  shell: P({ sprite: S.spark, ramp: R.wSolid, life: [0.4, 0.6], size: [0.035, 0.05], orient: 'stretch', stretch: 0.05, drag: 0.4, accY: -14, color: [1.2, 0.85, 0.35], i: 1.2 }),
};

// ------------------------------------------------------------------ fire
export const FIRE = {
  flame: P({ sprite: [S.flame1, S.flame2], ramp: R.fire, life: [0.45, 0.75], size: [0.5, 0.75], end: [0.25, 0.45], ease: 1.2, rot: [-0.25, 0.25], spin: [-0.6, 0.6], drag: 1.5, accY: 3.2, turb: 0.12, i: [1.6, 2.3] }),
  lick: P({ sprite: [S.flame1, S.flame2], ramp: R.fire, life: [0.3, 0.5], size: [0.28, 0.42], end: [0.3, 0.5], rot: [-0.2, 0.2], drag: 2, accY: 3, i: [1.8, 2.5] }),
  blob: P({ sprite: [S.blob, S.flame1, S.flame2], ramp: R.fire, life: [0.35, 0.6], size: [0.6, 0.9], end: [1.6, 2.2], ease: 2, rot: [-0.35, 0.35], spin: [-0.8, 0.8], drag: 4, accY: 2, turb: 0.15, i: [1.7, 2.4] }),
  burst: P({ sprite: [S.blob, S.blob, S.flame1], ramp: R.blast, life: [0.45, 0.7], size: [0.5, 0.7], end: [2, 2.6], ease: 2.5, rot: [-0.35, 0.35], spin: [-1, 1], drag: 4.5, accY: 2.5, turb: 0.1, i: [1.6, 2.2] }),
  core: P({ sprite: [S.blob], ramp: R.fireCore, life: [0.3, 0.42], size: [0.7, 0.9], end: [2, 2.5], ease: 2.5, spin: [-3, 3], drag: 3, accY: 2, i: [1.7, 2.2] }),
  column: P({ sprite: [S.blob, S.flame1, S.flame2], ramp: R.blast, life: [0.6, 1.0], size: [0.9, 1.4], end: [1.5, 2.2], ease: 2, rot: [-0.35, 0.35], spin: [-0.8, 0.8], drag: 1.6, accY: 4, turb: 0.3, i: [1.5, 2.1] }),
  ember: P({ sprite: S.spark, ramp: R.ember, life: [0.5, 1.1], size: [0.05, 0.09], orient: 'stretch', stretch: 0.9, drag: 1.2, accY: -4, turb: 0.2, i: [5, 8] }),
  emberFloat: P({ sprite: S.ember, ramp: R.ember, life: [0.9, 1.8], size: [0.05, 0.09], end: 0.5, drag: 0.8, accY: 1.5, turb: 0.5, i: [4, 7] }),
  smoke: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.smoke, life: [1.0, 1.6], size: [0.5, 0.8], end: [2.2, 3.2], ease: 2, spin: [-0.5, 0.5], drag: 1.2, accY: 1.2, turb: 0.25 }),
  smokeWarm: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.fireSmokeWarm, life: [0.9, 1.4], size: [0.6, 0.9], end: [2.2, 3.0], ease: 2, spin: [-0.6, 0.6], drag: 1.5, accY: 1.5, turb: 0.2 }),
  bigSmoke: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.plume], ramp: R.fireSmokeWarm, life: [2.2, 3.2], size: [1.6, 2.4], end: [2.6, 3.4], ease: 2, spin: [-0.3, 0.3], drag: 1.2, accY: 1.8, turb: 0.5, alpha: 1.2 }),
  flash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.16, size: 2.0, end: 1.4, ease: 2, color: [1, 0.55, 0.2], i: 2.1, noGround: true }),
  groundGlow: P({ sprite: S.glow, ramp: R.wInOut, life: 0.5, size: 3, end: 1.2, orient: 'flat', color: [1, 0.4, 0.08], i: 1.4 }),
  lava: P({ sprite: [S.ember, S.dot], ramp: R.lava, life: [0.8, 1.2], size: [0.14, 0.24], end: 0.6, drag: 0.3, accY: -14, i: [3, 5] }),
  lavaBlob: P({ sprite: [S.blob, S.ember], ramp: R.lava, life: [0.9, 1.4], size: [0.3, 0.55], end: 0.5, spin: [-4, 4], drag: 0.2, accY: -13, i: [2, 3] }),
  lavaJet: P({ sprite: S.spark, ramp: R.lava, life: [1.0, 1.5], size: [0.16, 0.26], orient: 'stretch', stretch: 0.08, drag: 0.15, accY: -14, i: [2.5, 3.5] }),
  ring: P({ sprite: S.shock, ramp: R.fire, life: 0.4, size: 0.5, end: 8, ease: 3, orient: 'flat', i: 2.2 }),
};

// ------------------------------------------------------------------ frost
export const FROST = {
  mist: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.frostMist, life: [0.8, 1.3], size: [0.4, 0.6], end: [2, 3], ease: 2, spin: [-0.4, 0.4], drag: 2.5, accY: -0.3, turb: 0.2 }),
  glow: P({ sprite: S.glow, ramp: R.frost, life: [0.3, 0.5], size: [0.5, 0.8], end: 0.4, i: 2.2 }),
  flake: P({ sprite: S.snow, ramp: R.frostCore, life: [0.6, 1.1], size: [0.1, 0.18], end: 0.6, spin: [-3, 3], drag: 2, accY: -0.6, turb: 0.25, i: [1.6, 2.6] }),
  sparkle: P({ sprite: S.twinkle, ramp: R.frostCore, life: [0.25, 0.5], size: [0.14, 0.24], end: 0.2, spin: [-2, 2], i: [2.5, 4] }),
  shard: P({ sprite: S.shard, ramp: R.frostCore, life: [0.5, 0.9], size: [0.18, 0.34], end: 0.7, spin: [-9, 9], drag: 0.8, accY: -12, i: [1.6, 2.4], randSpin: true }),
  spark: P({ sprite: S.spark, ramp: R.frostCore, life: [0.3, 0.55], size: [0.05, 0.08], orient: 'stretch', stretch: 1.1, drag: 2.5, accY: -3, i: [4, 6] }),
  flash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.16, size: 1.9, end: 1.4, ease: 2, color: [0.45, 0.8, 1.0], i: 2.1, noGround: true }),
  bloom: P({ sprite: [S.blob, S.smoke1], ramp: R.frost, life: 0.35, size: 0.8, end: 2.4, ease: 3, spin: 2, i: 1.0 }),
  ring: P({ sprite: S.shock, ramp: R.frost, life: 0.45, size: 0.5, end: 10, ease: 3, orient: 'flat', i: 2 }),
};

// ------------------------------------------------------------------ holy / light
export const HOLY = {
  glow: P({ sprite: S.glow, ramp: R.holy, life: [0.3, 0.5], size: [0.5, 0.8], end: 0.4, i: 2.4 }),
  star: P({ sprite: S.twinkle, ramp: R.holy, life: [0.5, 1.0], size: [0.14, 0.26], end: 0.3, spin: [-2, 2], drag: 1.5, turb: 0.15, i: [3, 5] }),
  cross: P({ sprite: S.holy, ramp: R.holy, life: [0.5, 0.8], size: [0.9, 1.3], end: 1.3, spin: [-0.5, 0.5], i: 3 }),
  mote: P({ sprite: S.dot, ramp: R.holyWarm, life: [0.8, 1.4], size: [0.05, 0.1], end: 0.4, drag: 0.8, accY: 1.6, turb: 0.3, i: [4, 7] }),
  spark: P({ sprite: S.spark, ramp: R.holyWarm, life: [0.35, 0.6], size: [0.05, 0.08], orient: 'stretch', stretch: 1, drag: 2.5, accY: 1, i: [4, 6] }),
  riseSpark: P({ sprite: S.spark, ramp: R.holyWarm, life: [0.8, 1.4], size: [0.06, 0.1], orient: 'stretch', stretch: 0.35, drag: 0.4, accY: 1.5, turb: 0.2, i: [5, 8] }),
  flash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.2, size: 2.0, end: 1.5, ease: 2, color: [1, 0.85, 0.45], i: 1.5, noGround: true }),
  pillar: P({ sprite: S.beam, ramp: R.wInOut, life: 0.7, size: 1.4, end: 0.8, orient: 'axisY', stretch: 6, color: [1, 0.82, 0.4], i: 3 }),
  ring: P({ sprite: S.shock, ramp: R.holy, life: 0.55, size: 0.5, end: 10, ease: 2.5, orient: 'flat', i: 2.4 }),
  ringThin: P({ sprite: S.ring, ramp: R.holy, life: 0.7, size: 0.8, end: 8, ease: 2.2, orient: 'flat', i: 2.6 }),
  feather: P({ sprite: S.feather, ramp: R.wSolid, life: [1.6, 2.4], size: [0.22, 0.32], spin: [-1.5, 1.5], randSpin: true, drag: 1.8, accY: -0.9, turb: 0.6, color: [1.4, 1.3, 1.1], i: 1.2 }),
};

// ------------------------------------------------------------------ lightning / chi
export const STORM = {
  bolt: P({ sprite: S.bolt, ramp: R.wFlash, life: [0.08, 0.16], size: [0.9, 1.5], end: 1.1, color: [0.55, 0.75, 1], i: [4, 6] }),
  spark: P({ sprite: S.spark, ramp: R.stormCore, life: [0.2, 0.4], size: [0.04, 0.07], orient: 'stretch', stretch: 1.2, drag: 3, accY: -2, i: [5, 8] }),
  glow: P({ sprite: S.glow, ramp: R.storm, life: [0.2, 0.4], size: [0.6, 0.9], end: 0.5, i: 2.4 }),
  flash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.14, size: 2.2, end: 1.4, ease: 2, color: [0.6, 0.75, 1.0], i: 2.6, noGround: true }),
  ring: P({ sprite: S.shock, ramp: R.storm, life: 0.4, size: 0.5, end: 12, ease: 3, orient: 'flat', i: 2.2 }),
  ring2: P({ sprite: S.ring, ramp: R.storm, life: 0.55, size: 1, end: 10, ease: 2, orient: 'flat', i: 2.2 }),
};
export const CHI = {
  glow: P({ sprite: S.glow, ramp: R.chi, life: [0.25, 0.45], size: [0.6, 0.9], end: 0.6, i: 2.4 }),
  spark: P({ sprite: S.spark, ramp: R.chi, life: [0.25, 0.45], size: [0.05, 0.08], orient: 'stretch', stretch: 1.3, drag: 3, accY: -1, i: [5, 8] }),
  wisp: P({ sprite: [S.wisp, S.swirl], ramp: R.chi, life: [0.35, 0.6], size: [0.5, 0.8], end: 1.4, spin: [-5, 5], randSpin: true, drag: 3, i: [2, 3] }),
  palm: P({ sprite: S.flash, ramp: R.wFlash, life: 0.2, size: 2.4, end: 1.8, ease: 2, color: [0.5, 0.9, 1], i: 2.6, noGround: true }),
  ring: P({ sprite: S.shock, ramp: R.chi, life: 0.35, size: 0.4, end: 7, ease: 3, i: 2.4 }),
};

// ------------------------------------------------------------------ dark / arcane / demon
export const DARK = {
  glow: P({ sprite: S.glow, ramp: R.shadow, life: [0.3, 0.5], size: [0.6, 0.9], end: 0.4, i: 2.2 }),
  smoke: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.void, life: [0.6, 1.0], size: [0.4, 0.6], end: [1.8, 2.6], ease: 2, spin: [-1, 1], drag: 2, accY: 0.6, turb: 0.2 }),
  wisp: P({ sprite: [S.wisp, S.swirl], ramp: R.shadow, life: [0.4, 0.7], size: [0.4, 0.6], end: 1.4, spin: [-4, 4], drag: 2, accY: 0.5, turb: 0.2, i: [2, 3], randSpin: true }),
  spark: P({ sprite: S.spark, ramp: R.shadowCore, life: [0.3, 0.55], size: [0.05, 0.08], orient: 'stretch', stretch: 1.0, drag: 2.5, accY: 1, i: [3.5, 5.5] }),
  flash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.2, size: 2.3, end: 1.4, ease: 2, color: [0.6, 0.2, 1.0], i: 2.5, noGround: true }),
  burst: P({ sprite: [S.blob, S.flame1, S.flame2], ramp: R.shadow, life: [0.35, 0.55], size: [0.5, 0.7], end: [1.6, 2.2], ease: 2.5, rot: [-0.35, 0.35], spin: [-1, 1], drag: 4, accY: 1.5, i: [1.8, 2.5] }),
  orb: P({ pool: 'alpha', sprite: S.soft, ramp: R.void, life: 0.4, size: 1.2, end: 2.2, ease: 2 }),
  flame: P({ sprite: [S.flame1, S.flame2, S.wisp], ramp: R.demon, life: [0.45, 0.75], size: [0.4, 0.7], end: 0.5, rot: [-0.25, 0.25], drag: 2, accY: 3, turb: 0.15, i: [1.8, 2.6] }),
  ember: P({ sprite: S.ember, ramp: R.demon, life: [0.8, 1.4], size: [0.05, 0.09], end: 0.5, drag: 0.8, accY: 1.6, turb: 0.5, i: [4, 7] }),
  skull: P({ sprite: S.skull, ramp: R.wInOut, life: [0.7, 1.0], size: [0.6, 0.9], end: 1.6, ease: 2, rot: [-0.2, 0.2], drag: 2.5, color: [0.7, 0.3, 1], i: 1.6 }),
  ring: P({ sprite: S.shock, ramp: R.shadow, life: 0.45, size: 0.5, end: 9, ease: 3, orient: 'flat', i: 2.2 }),
};
export const ARC = {
  glow: P({ sprite: S.glow, ramp: R.arcane, life: [0.3, 0.5], size: [0.5, 0.8], end: 0.3, i: 2.6 }),
  star: P({ sprite: S.twinkle, ramp: R.arcane, life: [0.35, 0.7], size: [0.16, 0.28], end: 0.2, spin: [-3, 3], drag: 2, turb: 0.15, i: [3, 5] }),
  spark: P({ sprite: S.spark, ramp: R.arcane, life: [0.3, 0.6], size: [0.05, 0.08], orient: 'stretch', stretch: 1.0, drag: 3, i: [4, 6] }),
  glyph: P({ sprite: [S.glyph1, S.glyph2, S.hex], ramp: R.arcane, life: [0.5, 0.8], size: [0.22, 0.34], end: 0.6, spin: [-1.5, 1.5], drag: 2, accY: 0.8, i: [2, 3] }),
  flash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.16, size: 1.9, end: 1.4, ease: 2, color: [0.8, 0.35, 1.0], i: 2.2, noGround: true }),
  glyphOut: P({ sprite: [S.glyph1, S.glyph2, S.hex], ramp: R.arcane, life: 0.55, size: 0.36, end: 0.8, motion: 'orbit', rise: 0.8, rgrow: 3.2, spin: 1, i: 2.6 }),
};

// ------------------------------------------------------------------ nature / heal / music / water / poison / blood
export const HEAL = {
  mote: P({ sprite: S.dot, ramp: R.heal, life: [1.0, 1.6], size: [0.06, 0.1], end: 0.4, drag: 0.8, accY: 1.4, turb: 0.3, i: [3, 5] }),
  plus: P({ sprite: S.plus, ramp: R.wInOut, life: [0.8, 1.2], size: [0.18, 0.28], end: 0.6, drag: 1.2, accY: 1.2, turb: 0.1, color: [0.45, 1, 0.5], i: 2.2 }),
  leaf: P({ pool: 'alpha', sprite: S.leaf, ramp: R.wSolid, life: [1.4, 2.2], size: [0.14, 0.22], spin: [-2, 2], randSpin: true, drag: 1.4, accY: 0.6, turb: 0.5, color: [0.5, 0.95, 0.35], color2: [0.8, 1, 0.4] }),
  petal: P({ sprite: S.petal, ramp: R.wSolid, life: [1.4, 2.2], size: [0.12, 0.18], spin: [-2, 2], randSpin: true, drag: 1.6, accY: -0.4, turb: 0.5, color: [1.2, 0.6, 0.85], color2: [1.3, 1.1, 0.7], i: 1.0 }),
  glow: P({ sprite: S.glow, ramp: R.heal, life: [0.4, 0.7], size: [0.8, 1.2], end: 0.6, i: 1.8 }),
};
export const MUSIC = {
  note: P({ sprite: [S.note1, S.note2], ramp: R.music, life: [1.0, 1.5], size: [0.28, 0.4], end: 0.8, rot: [-0.3, 0.3], spin: [-0.8, 0.8], drag: 1.5, accY: 1.0, turb: 0.25, i: [2, 3] }),
  noteGold: P({ sprite: [S.note1, S.note2], ramp: R.holyWarm, life: [1.0, 1.5], size: [0.28, 0.4], end: 0.8, rot: [-0.3, 0.3], spin: [-0.8, 0.8], drag: 1.5, accY: 1.0, turb: 0.25, i: [2, 3] }),
  sparkle: P({ sprite: S.twinkle, ramp: R.music, life: [0.4, 0.8], size: [0.12, 0.22], end: 0.3, spin: [-2, 2], drag: 2, i: [3, 5] }),
  ring: P({ sprite: S.ring, ramp: R.music, life: 0.6, size: 0.8, end: 8, ease: 2.2, orient: 'flat', i: 2.2 }),
  orbitNote: P({ sprite: [S.note1, S.note2], ramp: R.wInOut, life: [1.4, 1.8], size: [0.3, 0.42], end: 0.9, motion: 'orbit', rise: 0.3, rgrow: 0, rot: [-0.3, 0.3], color: [1, 0.55, 0.9], i: 2.2 }),
};
export const WATER = {
  drop: PHYS.drop,
  spray: P({ pool: 'alpha', sprite: S.drop, ramp: R.water, life: [0.5, 0.9], size: [0.05, 0.09], orient: 'stretch', stretch: 0.3, drag: 0.8, accY: -9, color: [0.95, 1, 1.05] }),
  mist: PHYS.mist,
  foam: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke3, S.dust], ramp: R.smokeLight, life: [0.6, 1.0], size: [0.5, 0.8], end: [1.8, 2.4], ease: 2, drag: 3, accY: -1, color: [1.05, 1.1, 1.15], alpha: 1.1 }),
  ring: P({ pool: 'alpha', sprite: S.ring, ramp: R.water, life: 0.8, size: 0.4, end: 7, ease: 2.5, orient: 'flat', color: [1, 1, 1] }),
  glow: P({ sprite: S.glow, ramp: R.wInOut, life: 0.5, size: 1.2, end: 1.3, color: [0.3, 0.7, 1], i: 1.6 }),
  bubble: P({ sprite: S.bubble, ramp: R.wInOut, life: [0.6, 1.0], size: [0.1, 0.2], end: 1.3, drag: 1, accY: 1.2, turb: 0.15, color: [0.6, 0.85, 1], i: 1.6 }),
};
export const POI = {
  bubble: P({ sprite: S.bubble, ramp: R.poison, life: [0.6, 1.1], size: [0.08, 0.16], end: 1.3, drag: 1, accY: 1.2, turb: 0.15, i: [1.5, 2.5] }),
  mist: P({ pool: 'alpha', sprite: [S.smoke1, S.smoke2, S.smoke3], ramp: R.poisonMist, life: [0.9, 1.4], size: [0.4, 0.6], end: [1.8, 2.6], ease: 2, spin: [-0.4, 0.4], drag: 1.5, accY: 0.4, turb: 0.2 }),
  drip: P({ sprite: S.drop, ramp: R.venomGoo, life: [0.5, 0.8], size: [0.07, 0.11], orient: 'stretch', stretch: 0.3, accY: -9, i: [1.4, 2] }),
  glow: P({ sprite: S.glow, ramp: R.poison, life: [0.3, 0.5], size: [0.5, 0.8], end: 0.4, i: 2 }),
};
export const CRIM = {
  glow: P({ sprite: S.glow, ramp: R.crimson, life: [0.3, 0.5], size: [0.6, 0.9], end: 0.6, i: 2.2 }),
  spark: P({ sprite: S.spark, ramp: R.crimson, life: [0.3, 0.55], size: [0.05, 0.09], orient: 'stretch', stretch: 1.3, drag: 2.5, accY: -3, i: [5, 8] }),
  flame: P({ sprite: [S.flame1, S.flame2, S.wisp], ramp: R.crimson, life: [0.45, 0.7], size: [0.35, 0.6], end: 0.5, rot: [-0.25, 0.25], drag: 2, accY: 3, turb: 0.15, i: [1.8, 2.6] }),
  ember: P({ sprite: S.ember, ramp: R.crimson, life: [0.7, 1.3], size: [0.05, 0.09], end: 0.5, drag: 0.8, accY: 1.5, turb: 0.5, i: [5, 8] }),
  burst: P({ sprite: [S.blob, S.flame1, S.flame2], ramp: R.crimson, life: [0.35, 0.55], size: [0.5, 0.7], end: [1.6, 2.2], ease: 2.5, rot: [-0.35, 0.35], spin: [-1, 1], drag: 4, accY: 1.5, i: [1.8, 2.5] }),
  flash: P({ sprite: S.flash, ramp: R.wFlash, life: 0.18, size: 2.2, end: 1.4, ease: 2, color: [1, 0.2, 0.18], i: 2.5, noGround: true }),
};

// ------------------------------------------------------------------ ambience
export const AMB = {
  firefly: P({ sprite: S.glow, ramp: R.wBlink, life: [2.5, 4.5], size: [0.16, 0.24], turb: 1.4, drag: 1, color: [0.75, 1, 0.3], i: [3, 5] }),
  leaf: P({ pool: 'alpha', sprite: S.leaf, ramp: R.wSolid, life: [5, 8], size: [0.16, 0.24], spin: [-2, 2], randSpin: true, drag: 1.4, accY: -1.1, turb: 1.1, color: [0.85, 0.5, 0.12], color2: [0.55, 0.62, 0.12] }),
  mote: P({ sprite: S.dot, ramp: R.wInOut, life: [4, 7], size: [0.025, 0.045], turb: 0.6, drag: 1, color: [1, 0.95, 0.8], i: [1.5, 2.5], alpha: 0.8 }),
  wisp: P({ sprite: S.wisp, ramp: R.spirit, life: [1.4, 2.0], size: [0.5, 0.8], end: 1.3, spin: [-0.6, 0.6], drag: 0.5, accY: 1.4, turb: 0.35, i: [1.6, 2.4], randSpin: true }),
  spiritGlow: P({ sprite: S.glow, ramp: R.spirit, life: [1.2, 1.8], size: [0.8, 1.1], end: 0.6, drag: 0.5, accY: 1.6, i: 2 }),
};

// ------------------------------------------------------------------ element families (generic hit / burst / trails)
export const FAM = {
  spark: { flash: PHYS.hitFlash, glow: GEN.glowFade, spark: PHYS.spark, star: PHYS.hitStar, mote: GEN.mote, chunk: PHYS.pebble, smoke: PHYS.hitDust, ring: PHYS.ring },
  fire: { flash: FIRE.flash, glow: FIRE.core, spark: FIRE.ember, star: GEN.starFlash, mote: FIRE.emberFloat, chunk: FIRE.burst, smoke: FIRE.smokeWarm, ring: FIRE.ring },
  frost: { flash: FROST.flash, glow: FROST.bloom, spark: FROST.spark, star: FROST.sparkle, mote: FROST.flake, chunk: FROST.shard, smoke: FROST.mist, ring: FROST.ring },
  lightning: { flash: STORM.flash, glow: STORM.glow, spark: STORM.spark, star: STORM.bolt, mote: STORM.spark, chunk: STORM.bolt, smoke: null, ring: STORM.ring },
  holy: { flash: HOLY.flash, glow: HOLY.glow, spark: HOLY.spark, star: HOLY.star, mote: HOLY.mote, chunk: HOLY.cross, smoke: null, ring: HOLY.ring },
  dark: { flash: DARK.flash, glow: DARK.glow, spark: DARK.spark, star: DARK.wisp, mote: DARK.ember, chunk: DARK.burst, smoke: DARK.smoke, ring: DARK.ring },
  arcane: { flash: ARC.flash, glow: ARC.glow, spark: ARC.spark, star: ARC.star, mote: ARC.star, chunk: ARC.glyph, smoke: null, ring: GEN.ring },
  blood: { flash: CRIM.flash, glow: CRIM.glow, spark: PHYS.blood, star: PHYS.hitStar, mote: CRIM.ember, chunk: PHYS.blood, smoke: PHYS.bloodMist, ring: GEN.ring },
  water: { flash: GEN.flash, glow: WATER.glow, spark: WATER.spray, star: GEN.star, mote: WATER.bubble, chunk: WATER.drop, smoke: WATER.mist, ring: WATER.ring },
  poison: { flash: GEN.flash, glow: POI.glow, spark: POI.drip, star: GEN.star, mote: POI.bubble, chunk: POI.drip, smoke: POI.mist, ring: GEN.ring },
};

export const COL = {
  gold: lin(0xffc84a), white: [1, 1, 1], crimson: lin(0xff2a3a), fire: lin(0xff7a1e), frost: lin(0x8fd8ff), holy: lin(0xffd97a),
  storm: lin(0x9ab8ff), chi: lin(0x7fe0ff), arcane: lin(0xc070ff), dark: lin(0x8a3cff), demon: lin(0xd0204a), heal: lin(0x6aff8a),
  music: lin(0xff8ad8), water: lin(0x4ab8ff), sand: lin(0xd8b070), poison: lin(0x8ae83a), foxfire: lin(0x6a8aff), rift: lin(0xa040ff),
};
export { V };
