// Undead & elemental field monsters: skeleton, wraith, wisp, crystal_golem (see ../README.md for the creature API).
import { makeRegistry } from '../core.js';
import { skeleton } from './skeleton.js';
import { wraith } from './wraith.js';
import { wisp } from './wisp.js';
import { crystal_golem } from './crystal_golem.js';

export const SPIRITS = { skeleton, wraith, wisp, crystal_golem };
export const { createCreature, CREATURES, creatureStats } = makeRegistry(SPIRITS);
