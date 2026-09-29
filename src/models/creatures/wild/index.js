// Wild creatures — sea monsters and critters for SEVENSHARD (owner: creatures/wild). Same def format and runtime as the
// main creature registry (../core.js); register WILD into the main index or use this mini-registry directly.
//
//   import { createCreature, CREATURES, WILD } from './models/creatures/wild/index.js';
//   const s = createCreature('sea_serpent', { variant: 'coral' });   // root on the waterline, faces −Z
//   s.update(dt, { speed, turn, combat, dead, down, stunned });       s.play('attack_big') → { dur, hit }
//
// Types (variants; elite last):
//   sea_serpent      abyssal · coral · leviathan(elite)      ~24 m, head ~4.5 m above y = 0, arches behind
//   kraken_tentacle  crimson · violet · lumen · elder(elite) ~7.3 m arm above y = 0
//   butterfly        monarch · azure · sulphur · rose · glow  always flying (~0.9 m above the root), `perch` lands
//   bird             bluebird · robin · sparrow · goldfinch · cardinal   canFly (state.fly), hops on the ground
//   seagull          herring · blackback · hooded             canFly, glides; waddles on the ground
//   rabbit           brown · grey · white · snow
//   cat              ginger · grey · black · calico · siamese
//   chicken          white · brown · black · rooster
//   fish             trout · koi · reef · salmon              root on the water surface, swims ~0.35 m below
import { makeRegistry } from '../core.js';
import { sea_serpent } from './sea_serpent.js';
import { kraken_tentacle } from './kraken_tentacle.js';
import { bird, seagull, chicken } from './birds.js';
import { butterfly } from './butterfly.js';
import { rabbit, cat } from './mammals.js';
import { fish } from './fish.js';

export const WILD = { sea_serpent, kraken_tentacle, butterfly, bird, seagull, rabbit, cat, chicken, fish };
export const { createCreature, CREATURES, creatureStats } = makeRegistry(WILD);
