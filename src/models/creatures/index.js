// SEVENSHARD creatures — procedural monsters, mounts, pets, critters and ships. Contract: ARCHITECTURE.md "Creatures";
// full API (types, variants, actions with durations, sockets) in ./README.md.
//
//   import { createCreature, CREATURES, createShip } from './models/creatures/index.js';
//   const c = createCreature('imp', { variant: 'red', scale: 1, tint: 0xffffff, elite: false, seed: 7 });
//   scene.add(c.root);                        // game drives c.root.position / c.root.rotation.y (model faces −Z)
//   c.update(dt, { speed, turn, combat, dead, down, stunned, fly });
//   const { dur, hit } = c.play('attack');    // hit = seconds until the blow lands
//   c.setTint(0xffffff, 0.6);  c.dispose();
import { register, DEFS, createFromDef, preload, stats, disposeCache, getEntry, describe } from './core.js';
import { placeholderDef } from './placeholder.js';
import { imp } from './demons/imp.js';
import { hellhound } from './demons/hellhound.js';
import { legionnaire } from './demons/legionnaire.js';
import { brute } from './demons/brute.js';
import { abyss_caster } from './demons/caster.js';
import { gargoyle } from './demons/gargoyle.js';
import { rift_crystal } from './demons/crystal.js';
import { pip, pip_seed, pip_pet } from './pips.js';
import { BEASTS } from './beasts/index.js';     // wolf, boar, spider, crab, treant
import { SPIRITS } from './spirits/index.js';   // skeleton, wraith, wisp, crystal_golem
import { MOUNTS } from './mounts/index.js';     // horse, direwolf, sunstag + pets
import { WILD } from './wild/index.js';         // sea_serpent, kraken_tentacle + critters
export { createShip, SHIPS } from './ships.js';

// ---- registry: every contract type exists from day one (placeholder blob until its real model lands) ----
const PH = {
  imp: [1, 0.35, 0xa8262c], hellhound: [1.3, 0.55, 0x2a2226], legionnaire: [2.2, 0.55, 0x5a3a3a], brute: [3, 1.0, 0x7a3030],
  abyss_caster: [2.0, 0.5, 0x4a2a6a, true], gargoyle: [1.9, 0.7, 0x7a7a80], skeleton: [1.8, 0.4, 0xd8d0b8], wraith: [2.1, 0.5, 0x40506a, true],
  wolf: [1.25, 0.5, 0x6a6a70], boar: [1.0, 0.55, 0x7a4a30], spider: [0.95, 0.8, 0x2e2a22], crab: [0.8, 0.6, 0xc0502a], treant: [4.2, 1.2, 0x5a4a30],
  crystal_golem: [2.8, 1.0, 0x6a8ab0], wisp: [0.8, 0.3, 0x9ae8ff, true], pip: [0.6, 0.25, 0x9ad06a], pip_seed: [0.35, 0.15, 0xc8f080],
  sea_serpent: [4, 2.0, 0x2a6a7a], kraken_tentacle: [7, 1.2, 0x7a3a5a], horse: [2.1, 0.7, 0x7a5030], direwolf: [1.9, 0.8, 0x5a5a60],
  sunstag: [2.6, 0.8, 0xe0c080], foxling: [0.5, 0.25, 0xe07a30], owlet: [0.45, 0.2, 0xa08060, true], slimelet: [0.45, 0.3, 0x60d0a0],
  pip_pet: [0.45, 0.2, 0x9ad06a], butterfly: [0.2, 0.1, 0xffa0d0, true], bird: [0.25, 0.1, 0x8a6a4a, true], seagull: [0.35, 0.2, 0xf0f0f0, true],
  rabbit: [0.32, 0.12, 0x8a7458], cat: [0.42, 0.15, 0xd8843a], chicken: [0.46, 0.12, 0xf0ece0], fish: [0.2, 0.3, 0x6a9ab0],
};
for (const [t, [h, r, c, fly]] of Object.entries(PH)) if (!DEFS[t]) register(t, placeholderDef(t, { height: h, radius: r, color: c, flying: fly }));
const OWN = { imp, hellhound, legionnaire, brute, abyss_caster, gargoyle, rift_crystal, pip, pip_seed, pip_pet };
for (const defs of [OWN, BEASTS, SPIRITS, MOUNTS, WILD]) for (const [t, d] of Object.entries(defs)) register(t, d);
// super-armoured heavies shrug off hit flashes (no auto-flinch) unless their def says otherwise
for (const t of ['brute', 'crystal_golem', 'treant', 'sea_serpent', 'kraken_tentacle']) if (DEFS[t] && DEFS[t].autoFlinch === undefined) DEFS[t].autoFlinch = false;

const NAMES = {
  imp: 'Imp', hellhound: 'Hellhound', legionnaire: 'Legionnaire', brute: 'Abyssal Brute', abyss_caster: 'Abyss Caster', gargoyle: 'Gargoyle',
  rift_crystal: 'Rift Crystal', skeleton: 'Skeleton', wraith: 'Wraith', wolf: 'Wolf', boar: 'Boar', spider: 'Spider', crab: 'Crab', treant: 'Treant',
  crystal_golem: 'Crystal Golem', wisp: 'Wisp', pip: 'Pip', pip_seed: 'Pip Seed', sea_serpent: 'Sea Serpent', kraken_tentacle: 'Kraken Tentacle',
  horse: 'Horse', direwolf: 'Direwolf', sunstag: 'Sunstag', foxling: 'Foxling', owlet: 'Owlet', slimelet: 'Slimelet', pip_pet: 'Pipling',
  butterfly: 'Butterfly', bird: 'Songbird', seagull: 'Seagull', rabbit: 'Rabbit', cat: 'Cat', chicken: 'Chicken', fish: 'Fish',
};
// catalogue order: demons → field monsters → Pips → mounts & pets → sea → critters (anything else after)
const ORDER = ['imp', 'hellhound', 'legionnaire', 'brute', 'abyss_caster', 'gargoyle', 'rift_crystal', 'skeleton', 'wraith', 'wisp', 'crystal_golem',
  'wolf', 'boar', 'spider', 'crab', 'treant', 'pip', 'pip_seed', 'horse', 'direwolf', 'sunstag', 'foxling', 'owlet', 'slimelet', 'pip_pet',
  'sea_serpent', 'kraken_tentacle', 'butterfly', 'bird', 'seagull', 'rabbit', 'cat', 'chicken', 'fish'];

/** { [type]: { name, height, radius, flying?, variants: [...], actions: [...] } } (height/radius at scale 1, default variant) */
export const CREATURES = {};
for (const t of [...ORDER.filter(t => DEFS[t]), ...Object.keys(DEFS).filter(t => !ORDER.includes(t))]) CREATURES[t] = describe(t, NAMES);

/** createCreature(type, { variant, scale, tint, elite, seed }) → creature (see README.md) */
export function createCreature(type, opts = {}) {
  if (!DEFS[type]) { console.warn('createCreature: unknown type', type); type = 'imp'; }
  return createFromDef(type, opts);
}
/** Build (and cache) geometry ahead of time, e.g. during a loading screen. list: [type | [type, variant]] → build stats */
export function preloadCreatures(list) { return preload(list); }
export { stats as creatureStats, disposeCache as disposeCreatureCache, getEntry as _entry };
