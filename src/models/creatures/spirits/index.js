// Undead & elemental field monsters: skeleton, wraith, wisp, crystal_golem (see ../README.md for the creature API).
import { makeRegistry } from '../core.js';
import { skeleton } from './skeleton.js';

export const SPIRITS = { skeleton };
export const { createCreature, CREATURES, creatureStats } = makeRegistry(SPIRITS);
