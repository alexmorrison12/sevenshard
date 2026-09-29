// SFX registry: name → recipe { fn(kit, opts) → duration?, bus, max, burst, gap, gain, range, ref, rev, hall, pri,
//                                 clip, clipIn, jitter, duck, loop, labDur }
//   bus     'sfx' (default, spatial) | 'ui' (flat, follows the sfx volume)
//   max     concurrent voices of this name (oldest is stolen)      burst/gap: max starts within `gap` seconds
//   gain    loudness trim (calibrated offline, see levels.js)       range/ref: audible radius / full-volume radius (m)
//   rev     room send (early reflections)  hall  hall-reverb send     pri: 0..3 priority for global voice stealing
//   jitter  random pitch spread (default ±3.5 %)                    duck: [amount 0..1, seconds] ducks the music
//   loop    { dur, xf } → loopable (baked seamless buffer for audio.loop())
import { UI } from './ui.js';
import { COMBAT } from './combat.js';
import { MAGIC } from './magic.js';
import { CREATURES } from './creatures.js';
import { MOVE, LOOT, TRAVEL, CRAFT } from './world.js';
import { LEVELS } from './levels.js';

export const CATEGORIES = {
  ui: Object.keys(UI), combat: Object.keys(COMBAT), skills: Object.keys(MAGIC), creatures: Object.keys(CREATURES),
  movement: Object.keys(MOVE), loot: Object.keys(LOOT), travel: Object.keys(TRAVEL), crafting: Object.keys(CRAFT),
};
export const SFX = { ...UI, ...COMBAT, ...MAGIC, ...CREATURES, ...MOVE, ...LOOT, ...TRAVEL, ...CRAFT };
for (const [name, g] of Object.entries(LEVELS)) if (SFX[name]) SFX[name].gain = g;
export const SFX_NAMES = Object.keys(SFX).filter((k) => !SFX[k].hidden);
export const LOOP_NAMES = Object.keys(SFX).filter((k) => SFX[k].loop);
