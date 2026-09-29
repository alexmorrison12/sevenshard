// Story characters: who they are, what they look like, and where they stand (per zone, per chapter).
//   STORY_NPCS[id] = { name, title, npc (hero outfit) | creature (+ variant), sex, portrait (icon id 'npc:<portrait>'), lines }
//   PLACEMENTS: story NPCs the quest system spawns — or moves / hides, when the zone's own mode already spawned them.
//     { id, zone, at: anchor | [anchors…] (first that exists), off: [dx, dz], pos: [x, z] (absolute, when no anchor),
//       face: radians, move: true (reuse an existing unit with that id), hide: true, when: Q => bool }
//   The first matching placement per (id, zone) wins, so list specific beats before general ones.
// Field residents (the people standing at a field's npc:* anchors) live in src/data/field.js.
import { CITY_NPCS } from '../npcs.js';

const P = (name, title, npc, o = {}) => ({ name, title, npc, sex: o.sex || 'm', portrait: o.portrait || null, lines: o.lines || [], ...o });
const PIP = (name, title, variant, o = {}) => ({ name, title, creature: 'pip', variant, portrait: o.portrait || null, lines: o.lines || [], ...o });

export const STORY_NPCS = {
  // ---------------------------------------------------------------- the leads
  brannoc: P('Commander Brannoc Hale', 'Knight of Brighthold', 'knight', { short: 'Brannoc', portrait: 'brannoc', lines: ['Brighthold burned, but it will not stay burned.', 'Keep your guard up and your boots dry. In that order.'] }),
  seraphine: P('Seraphine', 'Oracle of the Shards', 'oracle', { short: 'Seraphine', sex: 'f', portrait: 'seraphine', lines: ['The Shards sing, Shardbearer. Can you hear them too?', 'Seven lights, scattered. One of them is closer than you think.'] }),
  // ---------------------------------------------------------------- prologue
  guard_ren: P('Sergeant Ren Callow', 'Brighthold Watch', 'guard', { short: 'Sergeant Ren', lines: ['Hold the line! Hold the — oh, gods, hold SOMETHING!'] }),
  gunner_bess: P('Master Gunner Bess', 'Rampart Artillery', 'guard', { short: 'Gunner Bess', sex: 'f', lines: ['Aim for the eyes. It has a lot of them.'] }),
  // ---------------------------------------------------------------- the Crown of Valemont
  king: P('King Oswin of Valemont', 'Sovereign of Valemont', 'king', { short: 'King Oswin', lines: ['Solhaven stands because people like you stand in front of it.', 'My father built walls. I am learning they are not enough.'] }),
  chancellor: P('Chancellor Edda Mournvale', 'Keeper of the Royal Seal', 'noble', { short: 'Chancellor Mournvale', sex: 'f', lines: ['Every war is a ledger. I would like ours to balance.', 'Do not bleed on the carpets. They are older than you.'] }),
  magister: P('High Magister Corvin Ashby', 'Royal Arcanist', 'priest', { short: 'Magister Ashby', lines: ['A Shard in a living chest. Fascinating. Please hold still.', 'I have written eleven books on the Sunheart. You may be the twelfth.'] }),
  marshal: P('Lady Marshal Isolde Varne', 'Marshal of the Vanguard', 'knight', { short: 'Marshal Varne', sex: 'f', lines: ['Talk less, march more.', 'The Vanguard needs steel, not speeches.'] }),
  // ---------------------------------------------------------------- Solhaven side stories
  apprentice: P('Tobs Kettle', 'Blacksmith’s Apprentice', 'blacksmith', { lines: ['I didn’t break it. It broke itself. While I was holding it.', 'Hilda says I have “hands like wet bread.” It’s a compliment. I think.'] }),
  refugee_wenna: P('Wenna Coalbrook', 'Refugee from Brighthold', 'villager', { sex: 'f', lines: ['Everything I owned fit in one bag. Now it fits in one pocket.'] }),
  fisher_barty: P('Barty Brine', 'Fisherman (Self-Proclaimed Legend)', 'fisher', { lines: ['Forty years on this pier. The fish know my name. They fear it.'] }),
  fisher_nessa: P('Nessa Gill', 'Fisherwoman (Actual Legend)', 'fisher', { sex: 'f', lines: ['Barty tells stories. I catch fish. We are not the same.'] }),
  // ---------------------------------------------------------------- Goldmeadow
  sprig: PIP('Sprig', 'A Very Lost Pip', 'sprout', { lines: ['Pip! (Sprig bounces on the spot.)', 'Pip pip? (It points at your pockets. Seeds?)'] }),
  rusk: P('Rusk the Gentleman', 'Bandit King of Goldmeadow', 'bandit', { short: 'Rusk', lines: ['Charmed, truly. Now hand over the purse. Politely.'] }),
  // ---------------------------------------------------------------- Pipsprout Hollow
  bramblebeard: PIP('Elder Bramblebeard', 'Elder of Pipsprout Hollow', 'elder', { short: 'Bramblebeard', portrait: 'bramblebeard', lines: ['Mind the dewdrops, big-one. Ah — small-one, now. Mind them anyway.'] }),
  // ---------------------------------------------------------------- Thornwood
  thornking: { name: 'The Thornking', title: 'Oldest Tree of Thornwood', creature: 'treant', scale: 1.25, lines: ['Hrrrmm. Little bright one. You smell of sunlight and trouble.'] },
  // ---------------------------------------------------------------- Ashen Ridge
  tam: P('Corporal Tam Coalbrook', 'Vanguard Pikeman', 'guard', { short: 'Tam', lines: ['If you see my sister, tell her I kept the scarf. Tell her it still smells like bread.'] }),
};

/** display name of any NPC id (story, field resident or Solhaven resident) */
export function npcName(id, fieldNpcs = null) {
  return STORY_NPCS[id]?.name || fieldNpcs?.[id]?.name || CITY_NPCS.find(n => n.id === id)?.name || id;
}
/** Solhaven resident by id */
export const cityNpc = id => CITY_NPCS.find(n => n.id === id) || null;

// ---------------------------------------------------------------- placements
// Solhaven layout (from the zone): plaza (0,0), terrace stairs north at z≈-30, Brannoc (9,-40), keep forecourt (0,-80),
// Rift Nexus (-44,-58), harbour quay x≈48..70, piers along z = -20, 6, 32, 58 (dock:ship at the end of the z=6 pier).
const has = (Q, id) => Q.isActive(id) || Q.isDone(id);

export const PLACEMENTS = [
  // Chapter I — arrival on the pier at dawn; Seraphine waits there until you've found Brannoc
  { id: 'seraphine', zone: 'solhaven', at: 'dock:ship', off: [-7, -2.2], move: true, face: -Math.PI / 2, when: Q => Q.isActive('c1_harbour') },
  // Brannoc walks you up to the council, then goes back to his post
  { id: 'brannoc', zone: 'solhaven', pos: [-7.4, -76.8], move: true, face: Math.PI - 0.8, when: Q => Q.isActive('c1_council') },
  // the epilogue gathers everyone at the keep forecourt
  { id: 'seraphine', zone: 'solhaven', pos: [-2.4, -75.2], move: true, face: Math.PI, when: Q => Q.isActive('e1_homecoming') || Q.isActive('e2_horns') },
  { id: 'brannoc', zone: 'solhaven', pos: [2.6, -75.0], move: true, face: Math.PI, when: Q => Q.isActive('e1_homecoming') || Q.isActive('e2_horns') },
  // Brannoc and Seraphine leave for the front after Thornwood (hidden in Solhaven until the Shard is won)
  { id: 'brannoc', zone: 'solhaven', hide: true, when: Q => has(Q, 't7_road') && !Q.isDone('a6_shard') },
  { id: 'seraphine', zone: 'solhaven', hide: true, when: Q => has(Q, 't7_road') && !Q.isDone('a6_shard') },
  // the King's council on the keep forecourt
  { id: 'king', zone: 'solhaven', pos: [0, -79.6], face: Math.PI, when: Q => has(Q, 'c1_council') },
  { id: 'chancellor', zone: 'solhaven', pos: [-4.4, -78.8], face: Math.PI - 0.5, when: Q => has(Q, 'c1_council') },
  { id: 'magister', zone: 'solhaven', pos: [4.4, -78.8], face: Math.PI + 0.5, when: Q => has(Q, 'c1_council') },
  { id: 'marshal', zone: 'solhaven', pos: [8, -76.6], face: Math.PI + 0.9, when: Q => has(Q, 'c1_council') && !has(Q, 't7_road') },
  // side-quest folk in Solhaven
  { id: 'apprentice', zone: 'solhaven', at: 'npc:blacksmith', off: [3.4, 2.4], face: Math.PI, when: Q => Q.isDone('c1_steel') },
  { id: 'refugee_wenna', zone: 'solhaven', pos: [-9.6, 22], face: 0, when: Q => Q.isDone('c1_harbour') },
  { id: 'fisher_barty', zone: 'solhaven', at: 'fish:1', off: [-2.8, -3.6], face: -Math.PI / 2, when: Q => Q.isDone('c1_harbour') },
  { id: 'fisher_nessa', zone: 'solhaven', at: 'fish:1', off: [-2.8, 3.6], face: -Math.PI / 2, when: Q => Q.isDone('c1_harbour') },
  // Goldmeadow: Sprig and Seraphine follow the story around the farm
  { id: 'sprig', zone: 'goldmeadow', at: ['poi:windmill', 'npc:miller', 'spawn'], off: [2.2, 3], face: Math.PI, when: Q => Q.isActive('g6_pip') && Q.stepOf('g6_pip') >= 1 },
  { id: 'sprig', zone: 'goldmeadow', at: ['npc:farmer_hale', 'poi:farm', 'spawn'], off: [1.4, 3.6], face: Math.PI, when: Q => Q.isActive('g7_seeds') },
  { id: 'sprig', zone: 'goldmeadow', at: ['gate:pipsprout', 'poi:mushroom_ring', 'poi:pip_ring', 'poi:hermit', 'spawn'], off: [1.8, 1.8], face: Math.PI, when: Q => Q.isActive('g8_hollow') },
  { id: 'seraphine', zone: 'goldmeadow', at: ['npc:farmer_hale', 'poi:farm', 'spawn'], off: [3.2, 2.2], face: Math.PI, when: Q => has(Q, 'g7_seeds') && !Q.isDone('g8_hollow') },
  { id: 'rusk', zone: 'goldmeadow', at: ['poi:bandit_camp', 'elite:1', 'spawn'], off: [0, -1.5], face: 0, when: Q => Q.isActive('g4_gentleman') && Q.stepOf('g4_gentleman') >= 2 },
  // Pipsprout: Sprig came home with you
  { id: 'sprig', zone: 'pipsprout', at: ['npc:bramblebeard', 'spawn'], off: [2.2, 1.4], face: Math.PI, when: Q => Q.isDone('g8_hollow') },
  // Thornwood: the Thornking in his grove; Brannoc arrives with the Vanguard at the eastern road
  { id: 'thornking', zone: 'thornwood', at: ['npc:thornking', 'poi:treant_grove', 'poi:hollow_oak', 'spawn'], off: [0, -3.5], face: 0, when: Q => has(Q, 't6_blightroot') || Q.isDone('t5_defector') },
  { id: 'brannoc', zone: 'thornwood', at: ['gate:ashen_ridge', 'poi:gate', 'spawn'], off: [3, 3], face: Math.PI, when: Q => Q.isActive('t7_road') },
  // Ashen Ridge: Brannoc and Seraphine lead the assault from the Vanguard camp, then move up to the gate
  { id: 'brannoc', zone: 'ashen_ridge', at: ['poi:fortress_gate', 'poi:gate', 'duel', 'spawn'], off: [-3, 6], face: 0, when: Q => Q.isDone('a4_gate') && !Q.isDone('a6_shard') },
  { id: 'brannoc', zone: 'ashen_ridge', at: ['npc:captain', 'poi:camp', 'spawn'], off: [3.4, 1.5], face: Math.PI, when: Q => has(Q, 'a1_camp') || Q.isActive('t7_road') },
  { id: 'seraphine', zone: 'ashen_ridge', at: ['poi:fortress_gate', 'poi:gate', 'duel', 'spawn'], off: [3, 6], face: 0, when: Q => Q.isDone('a4_gate') && !Q.isDone('a6_shard') },
  { id: 'seraphine', zone: 'ashen_ridge', at: ['npc:captain', 'poi:camp', 'spawn'], off: [-3.2, 1.8], face: Math.PI, when: Q => has(Q, 'a1_camp') && !Q.isDone('a6_shard') },
  { id: 'tam', zone: 'ashen_ridge', at: ['npc:refugee', 'npc:captain', 'poi:camp', 'spawn'], off: [-5, -2], face: Math.PI, when: Q => has(Q, 'a1_camp') },
];
