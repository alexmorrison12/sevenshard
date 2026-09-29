// Icon coverage check (Node): every icon id the game data / UI can request must have dedicated art.
//   node src/lab/icons_check.js        → prints OK/MISSING counts and each missing id with where it came from
// Sources: class kits (skills, awakenings, identity skills, demon skills, tripods), combat statuses, ITEMS (+ iconFor),
// cards, city NPCs, engravings (+ books), the UI's own class/skill tables. Exit code 1 when something is missing.
const U = p => new URL(p, import.meta.url).href;
const icons = await import(U('../ui/icons/index.js'));
const miss = new Map(); let ok = 0;
const chk = (id, why) => { if (icons.hasIcon(id)) ok++; else miss.set(id, why); };
const tryImport = async (label, fn) => { try { await fn(); } catch (e) { console.log(`(skipped ${label}: ${e.message})`); } };

await tryImport('ui data', async () => {
  const ui = await import(U('../ui/core/data.js'));
  for (const [cid, c] of Object.entries(ui.CLASSES)) { for (const s of c.skills || []) chk(ui.skillIconId(cid, s.name), 'ui data skill'); chk(`skill:${cid}:awakening`, 'ui awakening'); chk(`class:${cid}`, 'ui class'); }
});
await tryImport('class kits', async () => {
  const { CLASS_LIST } = await import(U('../data/classes/index.js'));
  const { tripod } = await import(U('../game/skills/tripods.js'));
  for (const k of CLASS_LIST) {
    for (const s of k.skills) { chk(`skill:${k.id}:${s.id}`, 'kit skill'); for (const tier of s.tripods || []) for (const t of tier) chk(tripod(t).icon, `tripod of ${k.id}:${s.id}`); }
    if (k.awakening) chk(`skill:${k.id}:${k.awakening.id}`, 'kit awakening');
    const I = k.identity || {};
    for (const z of ['z', 'x']) if (I[z]?.id) chk(`skill:${k.id}:${I[z].id}`, `kit identity ${z}`);
    for (const s of I.demonSkills || []) chk(`skill:${k.id}:${s.id}`, 'demon skill');
    chk(`class:${k.id}`, 'class crest');
  }
});
await tryImport('statuses', async () => { const { STATUS } = await import(U('../game/combat.js')); for (const id in STATUS) chk(`status:${id}`, 'combat status'); });
await tryImport('items', async () => {
  const { ITEMS } = await import(U('../data/items.js'));
  const c = await import(U('../game/systems/common.js'));
  for (const id in ITEMS) { chk(c.iconFor(id), `iconFor(${id})`); chk(`item:${id}`, 'item:<id> (loot rows, battle-item slots)'); }
  for (const id of Object.keys(c.CURRENCIES || {})) chk(c.CURRENCIES[id].icon, 'currency');
});
await tryImport('cards', async () => { const { CARD_LIST } = await import(U('../data/cards.js')); for (const c of CARD_LIST) chk(`card:${c.id}`, 'card'); });
await tryImport('npcs', async () => { const { CITY_NPCS } = await import(U('../data/npcs.js')); for (const n of CITY_NPCS) chk(`npc:${n.id}`, 'city npc dialog portrait'); });
await tryImport('engravings', async () => { const E = await import(U('../data/engravings.js')); const T = E.ENGRAVINGS || E.default || {}; for (const id in T) { chk(`engr:${id}`, 'engraving'); chk(`item:book:${id}`, 'engraving book'); } });

console.log(`icons: ${icons.ICON_IDS.length} canonical ids + ${Object.keys(icons.ICON_ALIASES).length} aliases · checked OK ${ok} · MISSING ${miss.size}`);
for (const [id, why] of [...miss].sort()) console.log(`  ${id.padEnd(40)} ← ${why}`);
if (miss.size) process.exitCode = 1;
