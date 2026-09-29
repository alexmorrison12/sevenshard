// SEVENSHARD mounts & pets. Defs map + a self-contained registry for the sub-area lab.
//   mounts: horse (brown / white / black / armoured), direwolf (grey / snow / black), sunstag (dawn / moon / ember)
//   pets:   foxling (red / snow / shadow), owlet (tawny / snowy / moonlit), slimelet (mint / rose / azure / gold)
import { makeRegistry } from '../core.js';
import { horse } from './horse.js';

export const MOUNTS = { horse };
export const { createCreature, CREATURES, creatureStats } = makeRegistry(MOUNTS);
