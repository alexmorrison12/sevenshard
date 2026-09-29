// SEVENSHARD field beasts: wolf, boar (Goldmeadow), spider, treant (Thornwood), crab (beaches).
// Def map for the creatures registry; the sub-registry below powers the beasts lab (src/lab/creatures_beasts.js).
import { makeRegistry } from '../core.js';
import { wolf } from './wolf.js';
import { boar } from './boar.js';
import { spider } from './spider.js';
import { crab } from './crab.js';

export const BEASTS = { wolf, boar, spider, crab };
export const { createCreature, CREATURES, creatureStats } = makeRegistry(BEASTS);
