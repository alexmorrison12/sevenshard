// Wild creatures registry (sea monsters + critters). See the header of each file for looks, variants and actions.
import { makeRegistry } from '../core.js';
import { placeholderDef } from '../placeholder.js';
import { sea_serpent } from './sea_serpent.js';

const ph = (t, h, r, c, fly) => placeholderDef(t, { height: h, radius: r, color: c, flying: fly });
export const WILD = {
  sea_serpent, kraken_tentacle: ph('kraken_tentacle', 7, 1.2, 0x7a3a5a),
  butterfly: ph('butterfly', 0.2, 0.1, 0xffa0d0, true), bird: ph('bird', 0.25, 0.1, 0x8a6a4a, true), seagull: ph('seagull', 0.35, 0.2, 0xf0f0f0, true),
  rabbit: ph('rabbit', 0.32, 0.12, 0x8a7458), cat: ph('cat', 0.42, 0.15, 0xd8843a), chicken: ph('chicken', 0.46, 0.12, 0xf0ece0), fish: ph('fish', 0.2, 0.3, 0x6a9ab0),
};
export const { createCreature, CREATURES, creatureStats } = makeRegistry(WILD);
