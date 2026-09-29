// fx.play(name, params) library: every class skill family, awakening, boss attack, zone and ambient effect.
// Each entry is either a function (fx, params) for one-shots (play returns an inert handle), or a task recipe
// { init, tick, stop, end } for timed / looping effects (play returns a live handle: .stop(), .alive, .pos).
// Common params: pos (caster feet / effect centre), dir (facing), target (aim point), attach|follow|unit (Object3D),
// color, scale, big, radius|r, len|length, width, dur. See fx/README.md for every name.
import { WARRIOR } from './warrior.js';
import { FIGHTER } from './fighter.js';
import { GUNNER } from './gunner.js';
import { MYSTIC } from './mystic.js';
import { SHADE } from './shade.js';
import { AWAKEN } from './awaken.js';
import { BOSS } from './boss.js';
import { AMBIENT } from './ambient.js';
import { GAME } from './game.js';

export const PRESETS = { ...AMBIENT, ...BOSS, ...WARRIOR, ...FIGHTER, ...GUNNER, ...MYSTIC, ...SHADE, ...AWAKEN, ...GAME };
