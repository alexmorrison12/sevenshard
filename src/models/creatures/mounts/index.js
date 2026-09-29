// SEVENSHARD mounts & pets. Defs map + a self-contained registry for the sub-area lab.
//   mounts: horse (brown / white / black / armoured), direwolf (grey / snow / black), sunstag (dawn / moon / ember)
//   pets:   foxling (red / snow / shadow), owlet (tawny / snowy / moonlit), slimelet (mint / rose / azure / gold)
import { makeRegistry } from '../core.js';
import { horse } from './horse.js';
import { direwolf } from './direwolf.js';
import { sunstag } from './sunstag.js';
import { foxling } from './foxling.js';
import { owlet } from './owlet.js';
import { slimelet } from './slimelet.js';

export const MOUNTS = { horse, direwolf, sunstag, foxling, owlet, slimelet };
export const { createCreature, CREATURES, creatureStats } = makeRegistry(MOUNTS);
