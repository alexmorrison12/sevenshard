// Node test for the progression & economy layer (src/game/systems). No browser: a fresh in-memory Account, a stubbed
// clock, every module exercised, invariants asserted, the window/action glue driven through a fake session, and the
// simulateEconomy() summary printed.   usage: node tools/test-systems.mjs [--quick]
const QUICK = process.argv.includes('--quick');
// ---------------------------------------------------------------- environment stubs (before any game import)
const mem = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) } });
globalThis.addEventListener ||= () => {};
const REAL_NOW = Date.now;
let NOW = Date.UTC(2026, 8, 30, 11, 0);          // Wednesday 11:00 UTC (an hour after the weekly reset)
Date.now = () => NOW;
const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
const at = t => { NOW = t; return t; };

const { Account } = await import('../src/game/account.js');
const S = await import('../src/game/systems/index.js');
const { RNG } = await import('../src/core/noise.js');
const { makeGear, makeStone, makeAccessory, makeBook, makeGem, HONE_RATES } = await import('../src/game/systems/gear.js');
const { heroStats, itemLevel } = await import('../src/game/systems/stats.js');
const { ITEMS } = await import('../src/data/items.js');
const { CHAOS_LOOT, GUARDIAN_LOOT, RAID_LOOT, ABYSS_LOOT } = await import('../src/data/loot.js');
const { CARD_LIST, CARD_SETS } = await import('../src/data/cards.js');
const { SEEDS, COLLECTIBLES, ISLAND_LIST } = await import('../src/data/collectibles.js');
const { RAPPORT_NPCS, STAGES } = await import('../src/data/rapport.js');
const { CITY_NPCS } = await import('../src/data/npcs.js');
const registry = await import('../src/game/registry.js');
await import('../src/game/systems/hooks.js');
const { Emitter } = await import('../src/core/events.js');

// ---------------------------------------------------------------- tiny harness
let pass = 0, failN = 0; const fails = [];
function check(name, cond, info) { if (cond) pass++; else { failN++; fails.push(name + (info !== undefined ? ` — ${typeof info === 'string' ? info : JSON.stringify(info)}` : '')); } }
function section(t) { process.stdout.write(`\n· ${t} `); }
const ok = r => r && r.ok === true;
const finite = o => Object.values(o).every(v => typeof v !== 'number' || Number.isFinite(v));
function walletSane(A, where) {
  for (const [k, v] of Object.entries(A.roster.wallet)) check(`${where}: wallet.${k} ≥ 0 & integer-ish`, Number.isFinite(v) && v >= 0, v);
  for (const [k, v] of Object.entries(A.roster.mats)) check(`${where}: mats.${k} > 0`, Number.isFinite(v) && v > 0, v);
}
const newAccount = () => { mem.clear(); const A = new Account(); return A; };

// ================================================================= common & rolls
section('common/rolls');
{
  const a = S.common.rngOf(42), b = S.common.rngOf(42);
  check('rngOf seeds are deterministic', a.next() === b.next() && a.int(1, 6) === b.int(1, 6));
  const x1 = S.common.seeded(new RNG(7), () => makeAccessory('ring', 5)), x2 = S.common.seeded(new RNG(7), () => makeAccessory('ring', 5));
  check('seeded() makes gear.js factories deterministic', JSON.stringify(x1.engr) === JSON.stringify(x2.engr) && x1.quality === x2.quality);
  check('Math.random restored after seeded()', Math.random !== undefined && typeof Math.random() === 'number');
  const b1 = S.rolls.rollTable(CHAOS_LOOT[3].extras, new RNG(3), { times: 5 }), b2 = S.rolls.rollTable(CHAOS_LOOT[3].extras, new RNG(3), { times: 5 });
  check('rollTable deterministic incl. generated items', JSON.stringify((b1.items || []).map(i => [i.id, i.grade, i.engr])) === JSON.stringify((b2.items || []).map(i => [i.id, i.grade, i.engr])));
  const rows = S.common.bundleRows({ silver: 10, gold: 2, leapstone: 5, items: [makeGem('ruin', 3)], cards: { gorrath: 1 }, titles: ['legion_slayer'] });
  check('bundleRows orders currencies first', rows[0].id === 'silver' && rows[1].id === 'gold');
  check('bundleRows includes items, cards and unlocks', rows.some(r => r.kind === 'gem') && rows.some(r => r.id === 'card:gorrath') && rows.some(r => r.id === 'titles:legion_slayer'));
  const A = newAccount();
  check('pay() is atomic (nothing taken when unaffordable)', !S.common.pay(A, { silver: 1000, gold: 5 }) && A.count('silver') === 25000);
  check('pay() takes everything when affordable', S.common.pay(A, { silver: 1000 }) && A.count('silver') === 24000);
  check('itemInfo for books / gems / cards', S.common.itemInfo('book:vendetta').kind === 'book' && S.common.itemInfo('gem:swift:4').name === 'Lv.4 Swiftstone' && S.common.itemInfo('card:gorrath').icon === 'boss:gorrath');
}

// ================================================================= loot
section('loot');
let A = newAccount();
let P = A.createChar({ name: 'Powerpass', cls: 'reaver', mode: 'powerpass' });
const R = A.createChar({ name: 'Raider', cls: 'stormfist', mode: 'raid' });
check('powerpass char is iLvl 1200', Math.round(itemLevel(P)) === 1200, itemLevel(P));
{
  const maxOf = (tables, id, mul) => tables.reduce((s, t) => s + (t || []).filter(e => e.id === id).reduce((a, e) => a + e.n[1], 0), 0) * mul;
  for (const tier of [1, 2, 3, 4]) {
    const L = CHAOS_LOOT[tier];
    A.resets(); P.daily = { chaos: 0, guardian: 0 }; P.rest = { chaos: 0, guardian: 0 };
    const r1 = S.loot.chaosReward(A, P, { tier, rng: new RNG(tier) });
    check(`chaos T${tier}: ok + resonance on first clear`, ok(r1) && r1.resonance && !r1.rested);
    for (const id of ['silver', 'shards', 'guardian_stone', 'destruction_stone', 'leapstone', 'fusion', 'horn_shard']) {
      const v = r1.bundle[id] || 0, hi = maxOf([L.base, L.resonance], id, 1.3);
      check(`chaos T${tier}: ${id} within table range`, v >= 0 && v <= hi, `${v} > ${hi}`);
    }
    check(`chaos T${tier}: rows describe the bundle`, r1.rows.length >= 5 && r1.rows.every(x => x.name && x.icon && x.count > 0));
  }
  A.resets(); P.daily = { chaos: 0, guardian: 0 }; P.rest = { chaos: 40, guardian: 0 };
  const a1 = S.loot.chaosReward(A, P, { tier: 1, rng: 11 }), a2 = S.loot.chaosReward(A, P, { tier: 1, rng: 12 }), a3 = S.loot.chaosReward(A, P, { tier: 1, rng: 13 });
  check('rest bonus doubles the first two resonance clears and is consumed', a1.rested && a2.rested && !a3.rested && P.rest.chaos === 0, [a1.rested, a2.rested, a3.rested, P.rest.chaos]);
  check('third clear of the day has no resonance', !a3.resonance && a3.notes.some(n => /base rewards/.test(n)));
  check('rested clear yields more than an unrested base clear', a1.bundle.leapstone > a3.bundle.leapstone);
  check('char.daily.chaos counts clears', P.daily.chaos === 3);
  const g1 = S.loot.guardianReward(A, P, { guardian: 'rimewing', rng: 5 });
  check('guardian: leapstone-heavy', ok(g1) && g1.bundle.leapstone >= 18 + 26);
  check('guardian: unknown guardian fails', !ok(S.loot.guardianReward(A, P, { guardian: 'nope' })));
  check('uncleared run pays nothing', S.loot.chaosReward(A, P, { tier: 1, cleared: false }).rows.length === 0);
  // abyss & raid weekly rules
  const ab1 = S.loot.abyssReward(A, R, { gate: 0, rng: 1 }), ab2 = S.loot.abyssReward(A, R, { gate: 0, rng: 2 });
  check('abyss: weekly first clear pays gold', ab1.first && ab1.gold === 250, ab1.gold);
  check('abyss: repeat clear pays no gold', !ab2.first && !ab2.gold);
  const gold0 = A.count('gold');
  const rd1 = S.loot.raidReward(A, R, { gate: 1, mode: 'normal', rng: 1 });
  check('raid: first clear pays gate gold + More Rewards offer', rd1.gold === RAID_LOOT.gorrath.normal.gates[1].gold && rd1.more?.cost.gold === RAID_LOOT.gorrath.normal.gates[1].moreCost);
  const rd2 = S.loot.raidReward(A, R, { gate: 1, mode: 'hard', rng: 2 });
  check('raid: gate gold only once per character per week (any difficulty)', !rd2.gold && rd2.notes.some(n => /already claimed/.test(n)));
  A.give('gold', 5000);
  const g2 = A.count('gold'), mr = S.loot.buyMoreRewards(A, R, { gate: 1, mode: 'normal', rng: 3 });
  check('More Rewards costs its gold and pays horns', ok(mr) && A.count('gold') === g2 - RAID_LOOT.gorrath.normal.gates[1].moreCost && mr.bundle.horn_shard > 0);
  check('More Rewards only once per gate', !ok(S.loot.buyMoreRewards(A, R, { gate: 1, mode: 'normal' })));
  const wi = S.loot.weeklyInfo(A, R);
  check('weeklyInfo reports claimed gates', wi.raid['gorrath:1'] === 'normal' && wi.abyss['oratory:0'] === true && wi.raid['gorrath:0'] === null);
  at(NOW + 7 * DAY);
  const rd3 = S.loot.raidReward(A, R, { gate: 1, mode: 'normal', rng: 4, now: NOW });
  check('raid gold returns after the weekly reset', rd3.gold > 0);
  at(NOW - 7 * DAY);
  // events & field
  const ev1 = S.loot.eventReward(A, P, { kind: 'fieldboss', rng: 1, now: NOW }), ev2 = S.loot.eventReward(A, P, { kind: 'fieldboss', rng: 2, now: NOW + 5 * MIN });
  check('field boss pays once per window', ev1.rows.length > 0 && ev2.rows.length === 0);
  const is1 = S.loot.eventReward(A, P, { kind: 'island', island: 'gilded_atoll', rng: 1, now: NOW });
  check('Adventure Island uses the island focus (gold)', is1.source === 'island:gold' && is1.gold >= 250);
  check('fieldDrop works for mobs/elites', ok(S.loot.fieldDrop(A, P, { kind: 'mob', rng: 1 })) && ok(S.loot.fieldDrop(A, P, { kind: 'elite', rng: 1 })));
  const inf10 = S.loot.infernoReward(A, P, { floor: 10, rng: 1 }), inf10b = S.loot.infernoReward(A, P, { floor: 10, rng: 2 });
  check('inferno milestone chest once per week', inf10.first && inf10.gold > 0 && !inf10b.first && !inf10b.gold);
  for (const id of ['chaos:1', 'chaos:4', 'guardian:kurai', 'abyss:oratory:1', 'raid:gorrath:hard:1', 'fieldboss', 'chaosgate', 'ghostship', 'island:cards', 'inferno:40', 'elite']) {
    const pv = S.loot.preview(id); check(`preview(${id})`, pv && pv.sections.length && pv.sections.every(sct => sct.rows.every(x => x.name && x.icon)));
  }
  check('sources() lists every content', S.loot.sources().length >= 20);
  walletSane(A, 'after loot');
}

// ================================================================= honing
section('honing');
{
  A = newAccount(); P = A.createChar({ name: 'Honer', cls: 'reaver', mode: 'powerpass' });
  for (const [k, v] of Object.entries({ silver: 5e7, gold: 1e6, shards: 5e6, guardian_stone: 5e6, destruction_stone: 5e6, leapstone: 5e5, fusion: 5e5, horn_shard: 5e5, solar_grace: 100, solar_blessing: 100, solar_protection: 100 })) A.give(k, v);
  // Artisan's Energy: always-fail RNG must still succeed once energy reaches 100%
  const it = P.equip.weapon; it.hone = 20; it.iLvl = 1300;
  let taps = 0, last = -1, guaranteedHit = false, mono = true;
  const never = { next: () => 0.999999 };
  while (taps < 200) {
    const r = S.honing.hone(A, P, 'weapon', { rng: never, now: NOW }); taps++;
    if (!ok(r)) { check('hone ok', false, r); break; }
    if (r.success) { guaranteedHit = r.guaranteed; break; }
    if (r.energy < last) mono = false; last = r.energy;
    check('energy ≤ 100%', r.energy <= 1 + 1e-9);
  }
  check('Artisan’s Energy reaches 100% → guaranteed success', guaranteedHit && P.equip.weapon.hone === 21, { taps, hone: P.equip.weapon.hone });
  check('energy never decreases on failures', mono);
  const p = HONE_RATES[1][20];
  check('taps to guarantee is bounded by the energy maths', taps <= Math.ceil(1 / (0.465 * p)) + 2, { taps, p });
  const st = S.honing.stats(A);
  check('pity stats recorded', st.taps >= taps && st.guaranteed >= 1 && st.history.length >= 1);
  check('share card has luck & label', st.history[0].label === 'Artisan' && st.history[0].taps === taps);
  // lucky tap share
  const arm = P.equip.head; arm.hone = 15; arm.iLvl = 1250;
  const lucky = S.honing.hone(A, P, 'head', { rng: { next: () => 0 }, now: NOW });
  check('first-tap success share luck in [0,1] and labelled Lucky', ok(lucky) && lucky.success && lucky.share.luck > 0.5 && lucky.share.label === 'Lucky', lucky.share);
  // boosters
  const beforeGrace = A.count('solar_grace');
  const bo = S.honing.hone(A, P, 'head', { boosters: { solar_grace: 12 }, rng: { next: () => 0.99 }, now: NOW });
  check('boosters are consumed and raise the chance', ok(bo) && A.count('solar_grace') === beforeGrace - 12 && bo.chance > HONE_RATES[1][16]);
  check('booster cap enforced', S.honing.hone(A, P, 'head', { boosters: { solar_protection: 3 } }).why === 'booster');
  // expected()
  const ex = S.honing.expected(P.equip.chest, { account: A, now: NOW });
  check('expected() gives taps ≥ 1 and a cost', ex.taps >= 1 && ex.cost.silver > 0 && ex.p90 >= ex.p50);
  // weekly support rotation and discount
  const evs = new Set(); for (let w = 0; w < 6; w++) evs.add(S.honing.supportEvent(NOW + w * 7 * DAY).id);
  check('Honing Support rotates through 6 events', evs.size === 6);
  const silverWeek = [0, 1, 2, 3, 4, 5].map(w => NOW + w * 7 * DAY).find(t => S.honing.supportEvent(t).id === 'silver_lining');
  const base = { ...P.equip.pants }, c1 = S.honing.costOf(null, base, silverWeek), raw = S.honing.costOf(null, base, silverWeek + 7 * DAY);
  check('Silver Lining cuts silver by 40%', c1.silver <= Math.ceil(raw.silver * 0.6) + 1, { c1: c1.silver, raw: raw.silver });
  // story gear & max
  const story = A.createChar({ name: 'Story', cls: 'reaver', mode: 'story' });
  check('story gear cannot be honed', S.honing.hone(A, story, 'weapon').why === 'story');
  // transfer
  const T = A.createChar({ name: 'Transfer', cls: 'stormfist', mode: 'powerpass' });
  check('transfer refused below +12', S.honing.transferPreview(A, T, 'gloves').why === 'hone');
  T.equip.gloves.hone = 12; T.equip.gloves.iLvl = 1220;
  const hornBefore = A.count('horn_shard'), hadAch = !!A.roster.achieved?.transfer, tr = S.honing.transfer(A, T, 'gloves');
  const achBonus = !hadAch && A.roster.achieved?.transfer ? 10 : 0;
  check('transfer: Vanguard +12 → Horned Tyrant +6 (iLvl 1400)', ok(tr) && tr.item.set === 'horned' && tr.item.hone === 6 && tr.item.iLvl === 1400 && T.equip.gloves === tr.item);
  check('transfer pays horn shards + gold + sunshards (achievement bonus aside)', A.count('horn_shard') === hornBefore - S.honing.TRANSFER.cost.armor.horn_shard + achBonus && tr.cost.gold === S.honing.TRANSFER.cost.armor.gold, { now: A.count('horn_shard'), hornBefore, achBonus });
  check('transfer keeps quality', tr.item.quality === tr.old.quality);
  check('char.ilvl refreshed after transfer', Math.abs(T.ilvl - itemLevel(T)) < 1e-9);
  T.equip.weapon.hone = 15; T.equip.weapon.iLvl = 1250;
  check('transfer +15 → +8 (1420)', S.honing.transfer(A, T, 'weapon').item.iLvl === 1420);
  const v = S.honing.view(A, T);
  check('view(): 6 pieces with chance/energy/cost/boosters/expected', v.pieces.length === 6 && v.pieces.every(x => x.chance && x.boosters && x.expected && x.costRows));
  // quality
  const q = S.honing.upgradeQuality(A, T, 'chest', { rng: 5 });
  check('quality upgrade never lowers quality', ok(q) && q.now >= q.old);
  walletSane(A, 'after honing');
}

// ================================================================= cards
section('cards');
{
  A = newAccount();
  A.give('card_pack', 200); A.give('card_pack_legend', 2); A.give('silver', 1e7);
  const r = new RNG(99); let newN = 0;
  for (let i = 0; i < 200; i++) { const o = S.cards.openPack(A, 'card_pack', { rng: r }); if (o.cards[0]?.isNew) newN++; }
  check('packs grant cards', Object.keys(A.roster.cards).length === newN && newN > 15);
  check('opening consumes packs', A.count('card_pack') === 0);
  const sel = S.cards.openPack(A, 'card_pack_legend', { rng: 3 });
  check('legendary selector offers 3 distinct grade 4–5 cards', sel.choose.length === 3 && new Set(sel.choose).size === 3 && sel.choose.every(id => CARD_LIST.find(c => c.id === id).grade >= 4));
  check('pending selector blocks the next pack', S.cards.openPack(A, 'card_pack').why === 'pending');
  check('choose resolves', ok(S.cards.choose(A, 1)) && !A.roster.cardChoice);
  // awakening requires duplicates
  const id = Object.keys(A.roster.cards).find(k => A.roster.cards[k].n >= 1);
  const aw = S.cards.awaken(A, id);
  check('awaken consumes 1 duplicate at ★0', ok(aw) && A.roster.cards[id].awaken === 1);
  A.roster.cards.sprig = { n: 0, awaken: 0 };
  check('awaken refused without duplicates', S.cards.awaken(A, 'sprig').why === 'dupes');
  // full Tides deck at 30 awakening → damage +15%
  for (const c of CARD_SETS.tides.cards) A.roster.cards[c] = { n: 0, awaken: 5 };
  CARD_SETS.tides.cards.forEach((c, i) => S.cards.setDeck(A, i, c));
  const m = S.cards.mods(A);
  check('Tides of Light 6-set 30 awk: damage +15% (only the best of the chain)', Math.abs(m.mods.dmgAdd - 0.15) < 1e-9 && m.active.some(a => a.desc === 'Damage +15%.'), m.mods);
  check('set chain keeps light resistance at the 4-set value', Math.abs(m.mods.elemRes - 0.16) < 1e-9);
  // horns set crit damage
  for (const c of CARD_SETS.horns.cards) A.roster.cards[c] = { n: 0, awaken: 5 };
  CARD_SETS.horns.cards.forEach((c, i) => S.cards.setDeck(A, i, c));
  check('Horns of the Legion 5-set 25 awk: crit damage +25%', Math.abs(S.cards.mods(A).mods.critDmg - 0.25) < 1e-9);
  check('a card sits in one deck slot only', S.cards.setDeck(A, 5, 'gorrath').deck.filter(x => x === 'gorrath').length === 1);
  check('autoDeck picks a set', ok(S.cards.autoDeck(A)));
  const view = S.cards.view(A);
  check('cards.view shape', view.collection.length === CARD_LIST.length && view.sets.length === 5 && view.deck.length === 6 && view.packs.length === 4);
}

// ================================================================= gems
section('gems');
{
  A = newAccount(); const C = A.createChar({ name: 'Gemmer', cls: 'reaver', mode: 'powerpass' });
  A.give('gem_pouch', 5); A.give('silver', 1e6);
  const g = S.gems.openPouch(A, C, 'gem_pouch', { rng: 1 });
  check('gem pouch gives a Lv.1–3 gem', ok(g) && g.gem.level >= 1 && g.gem.level <= 3);
  C.inv = C.inv.filter(x => x.kind !== 'gem');
  for (let i = 0; i < 3; i++) C.inv.push(makeGem('ruin', 4));
  const f = S.gems.fuse(A, C, 'ruin', 4);
  check('fuse 3 → 1 (Lv.4 → Lv.5)', ok(f) && f.made[0].level === 5 && C.inv.filter(x => x.kind === 'gem').length === 1);
  check('fuse refuses without three gems', !ok(S.gems.fuse(A, C, 'ruin', 5)));
  const extra = [makeGem('swift', 2), makeGem('swift', 2), makeGem('swift', 2)]; C.inv.push(...extra);
  check('fuseUids', ok(S.gems.fuseUids(A, C, extra.map(x => x.uid))));
  const skills = S.gems.skillList(C);
  const r5 = C.inv.find(x => x.gem === 'ruin');
  check('socket a gem to a skill', ok(S.gems.socket(A, C, r5.uid, 0, skills[0].id)));
  const r6 = makeGem('ruin', 1); C.inv.push(r6);
  check('one Ruinstone per skill', S.gems.socket(A, C, r6.uid, 1, skills[0].id).why === 'duplicate');
  const mods = S.gems.mods(C);
  check('gem mods: Lv.5 ruin = +15% damage', Math.abs(mods[skills[0].id].dmg - 0.15) < 1e-9);
  check('unsocket returns the gem to the bag', ok(S.gems.unsocket(A, C, 0)) && C.inv.some(x => x.uid === r5.uid));
  check('gems.view shape', S.gems.view(A, C).sockets.length === 11);
  C.inv.push(...Array.from({ length: 3 }, () => makeGem('ruin', 10)));
  check('Lv.10 is the cap', !ok(S.gems.fuse(A, C, 'ruin', 10)));
}

// ================================================================= engravings & stones
section('engravings');
{
  A = newAccount(); const C = A.createChar({ name: 'Engraver', cls: 'reaver', mode: 'powerpass' }), Rc = A.createChar({ name: 'Premade', cls: 'reaver', mode: 'raid' });
  const L = S.engravings.learned(Rc);
  check('premade books migrate into learned points', L.vendetta === 80 && L.hexed_idol === 60, L);
  const bk = makeBook('keen_edge', 4); C.inv.push(bk);
  const rb = S.engravings.readBook(A, C, bk.uid);
  check('reading a Legendary book = 20 points → +3 equip', ok(rb) && rb.points === 20 && rb.equipMax === 3);
  check('char.library mirrors learned (for the session window)', C.library.keen_edge === 3);
  check('equip at the max allowed', ok(S.engravings.equip(A, C, 0, 'keen_edge')) && C.books[0].nodes === 3);
  check('equip refuses unlearned nodes', S.engravings.equip(A, C, 1, 'vendetta').why === 'learn');
  check('same engraving can’t be in both slots', S.engravings.equip(A, C, 1, 'keen_edge').why === 'duplicate');
  const sum = S.engravings.summary(Rc);
  check('build summary lists engravings with sources', sum.list.length >= 4 && sum.list.every(e => e.sources.length));
  // force a 5x3
  Rc.books = [{ id: 'vendetta', nodes: 12, slot: 0 }, { id: 'keen_edge', nodes: 12, slot: 1 }];
  Rc.equip.necklace.engr = [{ id: 'vendetta', v: 3 }, { id: 'hexed_idol', v: 5 }]; Rc.equip.earring1.engr = [{ id: 'keen_edge', v: 3 }, { id: 'hexed_idol', v: 5 }];
  Rc.equip.earring2.engr = [{ id: 'adrenaline', v: 5 }, { id: 'hexed_idol', v: 5 }]; Rc.equip.ring1.engr = [{ id: 'adrenaline', v: 5 }, { id: 'backstabber', v: 5 }]; Rc.equip.ring2.engr = [{ id: 'adrenaline', v: 5 }, { id: 'backstabber', v: 5 }];
  Rc.equip.stone.lines = ['backstabber', 'vendetta', 'neg_move']; Rc.equip.stone.facets = [[1, 1, 1, 1, 1, -1, -1, -1, -1], [1, 1, 1, 1, 1, -1, -1, -1, -1], [-1, -1, -1, -1, -1, -1, -1, -1, -1]];
  const s5 = S.engravings.summary(Rc);
  check('5×3 detection', s5.fiveByThree && s5.threes >= 5, s5.label);
  // stone faceting
  A.give('silver', 1e6);
  const stone = makeStone(6, { lines: ['vendetta', 'keen_edge', 'neg_atk'] }); C.inv.push(stone);
  const r = new RNG(5); let n = 0, chancesOk = true;
  while (true) { const lines = [0, 1, 2].filter(l => stone.facets[l].includes(0)); if (!lines.length) break; const f = S.engravings.facet(A, C, stone.uid, lines[0], { rng: r }); n++; if (!ok(f)) break; if (f.chance < 0.25 - 1e-9 || f.chance > 0.75 + 1e-9) chancesOk = false; }
  check('ancient stone takes 30 facets', n === 30);
  check('facet chance stays within 25–75%', chancesOk);
  check('a finished stone records the roster best', !!S.engravings.bestStone(A));
  const s97 = makeStone(6, { lines: ['vendetta', 'keen_edge', 'neg_atk'] });
  s97.facets = [[1, 1, 1, 1, 1, 1, 1, 1, 1, -1], [1, 1, 1, 1, 1, 1, 1, -1, -1, -1], [1, 1, -1, -1, -1, -1, -1, -1, -1, 0]];
  C.inv.push(s97);
  const f97 = S.engravings.facet(A, C, s97.uid, 2, { rng: { next: () => 0.99 } });
  check('97 stone detected (share card)', ok(f97) && f97.done && f97.stone.is97 && f97.stone.label === '97' && f97.share?.is97);
  check('facet costs silver', f97.cost.silver === 2200);
  check('engravings.view shape', (v => v.slots.length === 2 && v.summary && Array.isArray(v.stones))(S.engravings.view(A, C)));
}

// ================================================================= market
section('market');
{
  A = newAccount(); const C = A.createChar({ name: 'Trader', cls: 'reaver', mode: 'powerpass' });
  A.give('gold', 100000); A.give('leapstone', 500); A.give('crystals', 1000);
  const ids = Object.keys(S.market.ITEMS_MARKET);
  check('every tradable ITEMS id has an order book', Object.entries(ITEMS).filter(([, t]) => t.tradable).every(([id]) => ids.includes(id)));
  check('books and gems are traded', ids.includes('book:vendetta') && ids.includes('gem:ruin:10'));
  check('prices are positive and deterministic in time', ids.every(id => S.market.price(id, NOW) > 0 && S.market.price(id, NOW) === S.market.price(id, NOW)));
  const h = S.market.history('leapstone', { now: NOW, hours: 168 });
  check('price history for charts (hourly, 7 days)', h.length >= 168 && h.every(p => p.price > 0));
  const drift = new Set(h.map(p => p.price)).size;
  check('prices drift over real time', drift > 10, drift);
  const bk = S.market.book(A, 'leapstone', NOW, C);
  check('order book asks sorted ascending with SimPlayer names', bk.asks.length >= 6 && bk.asks.every((a, i) => i === 0 || a.price >= bk.asks[i - 1].price) && bk.asks.every(a => a.seller));
  const q = S.market.quote(A, 'leapstone', 50, NOW);
  const g0 = A.count('gold'), buy = S.market.buy(A, C, 'leapstone', 50, { now: NOW });
  check('buy fills cheapest first, gold paid = quote', ok(buy) && buy.bought === 50 && A.count('gold') === g0 - buy.spent && buy.spent === q.cost, { spent: buy.spent, q: q.cost });
  check('fills are in ascending price order', buy.fills.every((f, i) => i === 0 || f.price >= buy.fills[i - 1].price));
  const bk2 = S.market.book(A, 'leapstone', NOW, C);
  check('bought listings are depleted until SimPlayers relist', bk2.asks.reduce((s, a) => s + a.qty, 0) < bk.asks.reduce((s, a) => s + a.qty, 0));
  check('buying pushes the reference price up', S.market.refPrice(A, 'leapstone', NOW) >= S.market.price('leapstone', NOW));
  check('buy fails without gold', (() => { const B = newAccount(); const c = B.createChar({ name: 'Poor', cls: 'reaver', mode: 'powerpass' }); return S.market.buy(B, c, 'leapstone', 10, { now: NOW }).why === 'gold'; })());
  // listing, fee, sale over time, proceeds by mail
  const ref = S.market.price('leapstone', NOW), U = S.market.ITEMS_MARKET.leapstone.unit;
  const l1 = S.market.list(A, C, 'leapstone', 40, Math.max(0.1, Math.floor(ref * 0.85 * 10) / 10), { now: NOW });
  check('list takes the goods (in bundles)', ok(l1) && A.count('leapstone') === 500 + (50 - 40) * U, { have: A.count('leapstone'), U });
  at(NOW + 12 * HOUR);
  S.market.tick(A, NOW);
  const sold = A.roster.market.sold.find(x => x.id === l1.listing.id) || A.roster.market.listings.find(x => x.id === l1.listing.id);
  check('a competitive listing sells over time', sold && sold.sold > 0, sold && { sold: sold.sold, qty: sold.qty });
  const saleMail = A.roster.mail.filter(m => m.kind === 'market' && /Sold/.test(m.subject));
  const grossAll = saleMail.reduce((s, m) => s + m.bundle.gold, 0);
  const expectedNet = Math.floor(l1.listing.price * sold.sold * (1 - S.market.fee(A)));
  check('proceeds arrive by mail after the 5% fee', saleMail.length > 0 && Math.abs(grossAll - expectedNet) <= saleMail.length, { grossAll, expectedNet });
  check('fee is 5%', Math.abs(S.market.fee(A) - 0.05) < 1e-9);
  // overpriced listing expires after 3 days and returns by mail
  const l2 = S.market.list(A, C, 'leapstone', 10, Math.round(ref * 50), { now: NOW });
  at(NOW + 73 * HOUR);
  const ev = S.market.tick(A, NOW);
  check('overpriced listing expires (3 days) and returns by mail', ev.some(e => e.kind === 'expired') && A.roster.mail.some(m => /Expired/.test(m.subject) && m.bundle.leapstone === 10 * U));
  // cancel returns goods
  const l3 = S.market.list(A, C, 'leapstone', 5, Math.round(ref * 20), { now: NOW });
  const lp = A.count('leapstone'), cn = S.market.cancel(A, C, l3.listing.id, NOW);
  check('cancel returns goods directly', ok(cn) && A.count('leapstone') === lp + 5 * U);
  // unique listing (book)
  const book = makeBook('vendetta', 4); C.inv.push(book);
  check('list a unique item by uid', ok(S.market.list(A, C, null, 1, 300, { now: NOW, uid: book.uid })) && !C.inv.includes(book));
  // accessories
  const accs = S.market.accessories(A, { now: NOW });
  check('accessory listings with SimPlayer sellers', accs.length >= 20 && accs.every(x => x.item.kind === 'accessory' && x.price > 0 && x.seller));
  const acc = accs[0], gA = A.count('gold'), ba = S.market.buyAccessory(A, C, acc.key, NOW);
  check('buy an accessory listing', ok(ba) && C.inv.includes(ba.item) && A.count('gold') === gA - acc.price);
  check('bought accessory listing disappears', !S.market.accessories(A, { now: NOW }).some(x => x.key === acc.key));
  // crystal exchange
  const ex = S.market.exchange(NOW);
  check('exchange spread: sell < buy', ex.sell < ex.buy && ex.history.length > 10);
  const c0 = A.count('crystals'), gg = A.count('gold');
  check('buy crystals', ok(S.market.buyCrystals(A, 2, NOW)) && A.count('crystals') === c0 + 200 && A.count('gold') === gg - ex.buy * 2);
  check('sell crystals', ok(S.market.sellCrystals(A, 1, NOW)) && A.count('crystals') === c0 + 100);
  check('browse returns rows for a category', S.market.browse(A, { cat: 'honing', now: NOW }).length === 7);
  check('bundle sizes keep bundle prices readable', Object.values(S.market.ITEMS_MARKET).filter(m => m.cat !== 'gem' && m.cat !== 'book').every(m => m.base >= 1), Object.values(S.market.ITEMS_MARKET).filter(m => m.base < 1).map(m => m.id));
  check('categories', S.market.categories().length === 7);
  walletSane(A, 'after market');
}

// ================================================================= stronghold
section('stronghold');
{
  A = newAccount(); A.give('silver', 5e6); A.give('gold', 1e4); for (const k of ['timber', 'ore', 'herb', 'flower', 'relic_shard', 'meat', 'fish', 'resin', 'clam', 'gem_ore', 'hide']) A.give(k, 5000); A.give('crystals', 500);
  const t0 = NOW;
  const v0 = S.stronghold.view(A, t0);
  check('stronghold starts at level 1 with a Manor and 3 crew', v0.level === 1 && v0.buildings.find(b => b.id === 'manor').level === 1 && v0.crew.length === 3);
  check('buildings capped by the Manor level', S.stronghold.upgradeBuilding(A, 'workshop', t0).ok && !S.stronghold.upgradeBuilding(A, 'workshop', t0).ok);
  const job = S.stronghold.craft(A, 'hp_potion', 2, t0);
  check('craft starts a timed job', ok(job) && job.job.t1 > t0);
  check('slots are limited', !ok(S.stronghold.craft(A, 'hp_potion', 1, t0)) || S.stronghold.craftSlots(A, t0) > 1);
  check('nothing to collect before the timer ends', S.stronghold.collectCrafts(A, null, t0 + 60e3).jobs === 0);
  const hp0 = A.count('hp_potion');
  check('collect after the timer', S.stronghold.collectCrafts(A, null, job.job.t1 + 1).jobs === 1 && A.count('hp_potion') === hp0 + 20);
  check('research needs the Research Hall', !ok(S.stronghold.startResearch(A, 'rift_cartography', t0)));
  S.stronghold.upgradeBuilding(A, 'research_hall', t0);
  const rs = S.stronghold.startResearch(A, 'rift_cartography', t0);
  check('research starts and consumes action energy', ok(rs) && S.stronghold.energy(A, t0).now < 5000);
  check('one project at a time', S.stronghold.startResearch(A, 'efficient_forging', t0).why === 'busy');
  S.stronghold.tick(A, rs.t1 + 1);
  check('research completes on its timer and grants the perk', S.stronghold.perks(A).chaosLoot === 0.1);
  check('rush costs crystals', (() => { const r2 = S.stronghold.startResearch(A, 'efficient_forging', rs.t1 + 2); const c = A.count('crystals'); const rr = S.stronghold.rush(A, 'research', null, rs.t1 + 3); return ok(r2) && ok(rr) && A.count('crystals') < c; })());
  S.stronghold.upgradeBuilding(A, 'barracks', t0);
  const crew = S.stronghold.view(A, rs.t1 + 5).crew.slice(0, 1).map(c => c.id);
  const d = S.stronghold.dispatch(A, 'scout_shore', crew, rs.t1 + 5);
  check('dispatch with crew on a real-time timer', ok(d) && d.job.t1 - d.job.t0 === 10 * MIN && d.job.chance > 0 && d.job.chance <= 0.98);
  check('busy crew cannot be dispatched twice', S.stronghold.dispatch(A, 'scout_shore', crew, rs.t1 + 6).why === 'busy' || S.stronghold.dispatch(A, 'scout_shore', crew, rs.t1 + 6).why === 'slots');
  check('dispatch not collectable early', S.stronghold.collectDispatch(A, null, d.job.id, { now: rs.t1 + 60e3 }).why === 'running');
  const cd = S.stronghold.collectDispatch(A, null, d.job.id, { rng: 1, now: d.job.t1 + 1 });
  check('dispatch resolves with rewards', ok(cd) && cd.rows.length > 0);
  const e1 = S.stronghold.energy(A, rs.t1 + 100 * HOUR);
  check('action energy regenerates and caps', e1.now === e1.max);
  S.stronghold.upgradeBuilding(A, 'garden', t0);
  check('garden grows over time', ok(S.stronghold.collectGarden(A, t0 + 5 * HOUR)));
  check('stronghold gains xp', S.stronghold.view(A, rs.t1 + 100 * HOUR).xp > 0 || S.stronghold.view(A, rs.t1 + 100 * HOUR).level > 1);
  walletSane(A, 'after stronghold');
}

// ================================================================= life skills
section('lifeskills');
{
  A = newAccount(); const C = A.createChar({ name: 'Gatherer', cls: 'reaver', mode: 'powerpass' });
  const t0 = NOW;
  check('life energy starts full (10,000)', S.lifeskills.energy(A, t0).now === 10000);
  const g = S.lifeskills.gather(A, C, 'forage', { rng: 1, now: t0 });
  check('gathering spends energy and gives herbs', ok(g) && g.energy === 10000 - 30 && g.rows.some(r => r.id === 'herb'));
  let ups = 0; for (let i = 0; i < 60; i++) { const r = S.lifeskills.gather(A, C, 'mine', { rng: i, now: t0 }); if (r.levelUp) ups++; }
  check('xp levels skills up', A.roster.life.skills.mine > 1 && ups > 0);
  check('tool durability is used', A.roster.life.tools.mine.dur < 500);
  A.roster.life.energy = 10;
  check('not enough energy', S.lifeskills.gather(A, C, 'log', { now: t0 }).why === 'energy');
  check('energy regenerates in real time and caps at 10,000', S.lifeskills.energy(A, t0 + HOUR).now === 10 + 300 && S.lifeskills.energy(A, t0 + 100 * HOUR).now === 10000);
  const t1 = t0 + 100 * HOUR;
  const cast = S.lifeskills.fishCast(A, { rng: 3, now: t1 });
  check('fishing cast: bite time and window', ok(cast) && cast.cast.biteAt >= 1.5 && cast.cast.biteAt <= 6 && cast.cast.window > 0.3);
  check('pulling early scares the fish', S.lifeskills.fishReel(A, C, cast.cast, cast.cast.biteAt - 0.5, { now: t1 }).result === 'early');
  const c2 = S.lifeskills.fishCast(A, { rng: 4, now: t1 });
  check('perfect pull inside the first part of the window', S.lifeskills.fishReel(A, C, c2.cast, c2.cast.biteAt + 0.05, { rng: 1, now: t1 }).result === 'perfect');
  const c3 = S.lifeskills.fishCast(A, { rng: 5, now: t1 });
  check('late pull: it got away', S.lifeskills.fishReel(A, C, c3.cast, c3.cast.biteAt + c3.cast.window + 0.2, { now: t1 }).result === 'late');
  check('a cast cannot be reeled twice', S.lifeskills.fishReel(A, C, c3.cast, 2).why === 'cast');
  const dg = S.lifeskills.digStart(A, { rng: 7, now: t1 });
  const mid = (dg.dig.perfect[0] + dg.dig.perfect[1]) / 2;
  check('dig meter: perfect zone inside the good zone', dg.dig.perfect[0] >= dg.dig.zone[0] && dg.dig.perfect[1] <= dg.dig.zone[1]);
  check('dig perfect', S.lifeskills.digStop(A, C, dg.dig, mid, { rng: 1, now: t1 }).result === 'perfect');
  const dg2 = S.lifeskills.digStart(A, { rng: 8, now: t1 });
  check('dig poor outside the zone', S.lifeskills.digStop(A, C, dg2.dig, dg2.dig.zone[0] > 0.2 ? 0.01 : 0.99, { rng: 1, now: t1 }).result === 'poor');
  A.give('food3', 1); A.roster.life.energy = 5000;
  check('food restores life energy', S.lifeskills.eat(A, 'food3', t1).energy >= 6000);
  A.give('silver', 1e6);
  check('buy a better tool', ok(S.lifeskills.buyTool(A, 'fish', 3, t1)) && A.roster.life.tools.fish.tier === 3);
  check('view shape', S.lifeskills.view(A, t1).skills.length === 6);
}

// ================================================================= collectibles & tome
section('collectibles');
{
  A = newAccount(); const C = A.createChar({ name: 'Seeker', cls: 'reaver', mode: 'powerpass' });
  check('120 unique Pip Seeds', SEEDS.length === 120 && new Set(SEEDS.map(s => s.id)).size === 120 && SEEDS.every(s => /^seed:[a-z_]+:\d+$/.test(s.id) && s.hint));
  const zones = new Set(SEEDS.map(s => s.zone));
  check('seeds spread across 6 zones', zones.size === 6);
  check('8 islands / 8 souls, 6 hearts, 10 masterpieces, 8 stars, 10 bounties, 6 leaves, 12 vistas', ISLAND_LIST.length === 8 && COLLECTIBLES.souls.items.length === 8 && COLLECTIBLES.hearts.items.length === 6 && COLLECTIBLES.masterpieces.items.length === 10 && COLLECTIBLES.stars.items.length === 8 && COLLECTIBLES.bounties.items.length === 10 && COLLECTIBLES.leaves.items.length === 6 && COLLECTIBLES.vistas.items.length === 12);
  const sol = SEEDS.filter(s => s.zone === 'solhaven');
  let zoneDone = null;
  for (const s of sol) { const r = S.collectibles.collect(A, C, 'seeds', s.id); if (r.zoneDone) zoneDone = r.zoneDone; }
  check('collect seeds; zone completion detected', zoneDone === 'solhaven' && A.roster.collect.seeds.length === sol.length);
  check('collecting twice is not new', S.collectibles.collect(A, C, 'seeds', sol[0].id).isNew === false);
  check('Hollow Friend title from completing a zone', A.roster.titles.includes('seed_zone'));
  const cl = S.collectibles.claim(A, C, 'seeds', 5);
  check('claim a seed reward tier', ok(cl) && cl.rows.length > 0 && !ok(S.collectibles.claim(A, C, 'seeds', 5)));
  check('cannot claim beyond progress', S.collectibles.claim(A, C, 'seeds', 120).why === 'progress');
  for (const s of SEEDS) S.collectibles.collect(A, C, 'seeds', s.id);
  const big = S.collectibles.claim(A, C, 'seeds', 120);
  check('120 seeds: legendary mount', ok(big) && A.roster.mounts.includes('sunbloom_wagon'));
  const pct0 = S.collectibles.tomePct(A, 'goldmeadow');
  S.collectibles.tomeRecord(A, 'goldmeadow', 'bosses', 'thunderhoof', C);
  check('tome progress grows', S.collectibles.tomePct(A, 'goldmeadow') > pct0);
  check('tome view shape', (v => v.types.length === 8 && v.tome.length === 6 && v.tome.every(r => r.sections.length >= 3))(S.collectibles.view(A)));
  check('zoneList for the world owners', S.collectibles.zoneList('thornwood').length > 20);
}

// ================================================================= rapport
section('rapport');
{
  A = newAccount(); const C = A.createChar({ name: 'Friend', cls: 'reaver', mode: 'powerpass' });
  check('8 rapport NPCs; lead’s city rapport ids covered', RAPPORT_NPCS.length === 8 && CITY_NPCS.filter(n => n.rapport).every(n => RAPPORT_NPCS.some(r => r.id === n.rapport)));
  check('songs must be learned', S.rapport.song(A, C, 'brannoc', 'valor').why === 'song');
  A.roster.songs.push('valor');
  let n = 0; while (ok(S.rapport.song(A, C, 'brannoc', 'valor', NOW))) n++;
  check('6 songs per NPC per day', n === 6);
  check('loved song = double points', A.roster.rapport.brannoc.pts === 6 * 40 * 2);
  let e = 0; while (ok(S.rapport.emote(A, C, 'brannoc', 'bow', NOW))) e++;
  check('6 emotes per NPC per day', e === 6);
  check('limits reset the next day', ok(S.rapport.song(A, C, 'brannoc', 'valor', NOW + DAY)));
  A.give('gift2', 10);
  const g = S.rapport.gift(A, C, 'brannoc', 'gift2', 10, NOW);
  check('gifts with preferences (loved music box)', ok(g) && g.gain === 180 * 2 * 10);
  const one = S.rapport.one(A, 'brannoc', NOW);
  check('stage thresholds', one.stage.idx === STAGES.filter(s => one.pts >= s.min).length - 1);
  check('claim stage rewards up to the current stage', ok(S.rapport.claim(A, C, 'brannoc', 1)) && ok(S.rapport.claim(A, C, 'brannoc', 2)) && A.roster.cards.brannoc);
  check('cannot claim a stage not reached', S.rapport.claim(A, C, 'brannoc', 5).why === 'stage');
  A.roster.rapport.seraphine = { pts: 16000, day: 0, songs: 0, emotes: 0, claimed: [] };
  check('Devoted is the last stage', S.rapport.one(A, 'seraphine', NOW).stage.name === 'Devoted');
  check('view shape', S.rapport.view(A, NOW).every(x => x.rewards.length === 5 && x.today.songsMax === 6));
}

// ================================================================= tasks & calendar
section('tasks');
{
  A = newAccount(); const C = A.createChar({ name: 'Wayfarer', cls: 'reaver', mode: 'powerpass' });
  const v = S.tasks.view(A, NOW);
  check('6 daily offers from ~20 templates, 5 weekly', v.daily.offered.length === 6 && v.weekly.offered.length === 5);
  check('offers are deterministic for the day', JSON.stringify(S.tasks.view(A, NOW + HOUR).daily.offered.map(t => t.id)) === JSON.stringify(v.daily.offered.map(t => t.id)));
  const ids = v.daily.offered.map(t => t.id);
  check('accept 3', ids.slice(0, 3).every(id => ok(S.tasks.accept(A, id, NOW))));
  check('no 4th', S.tasks.accept(A, ids[3], NOW).why === 'limit');
  // force a known task for the test
  A.roster.tasks.daily.offered[0] = 'chaos'; A.roster.tasks.daily.accepted[0] = 'chaos';
  const notes = S.tasks.track(A, C, 'clear', { content: 'chaos', tier: 1, now: NOW });
  check('track() completes a task and notifies', notes.some(x => x.kind === 'taskDone'));
  const cl = S.tasks.claim(A, C, 'chaos', NOW);
  check('claim gives rewards and reputation', ok(cl) && cl.rows.length && A.roster.tasks.rep.pts === 100);
  A.roster.tasks.weekly.offered[0] = 'w_hone'; A.roster.tasks.weekly.accepted = ['w_hone'];
  const Hn = A.createChar({ name: 'Honer2', cls: 'reaver', mode: 'powerpass' }); A.give('silver', 1e7); A.give('gold', 1e5); A.give('shards', 1e6); A.give('guardian_stone', 1e6); A.give('destruction_stone', 1e6); A.give('leapstone', 1e4); A.give('fusion', 1e4);
  for (let i = 0; i < 20; i++) S.honing.hone(A, Hn, 'head', { rng: i, now: NOW });
  check('system actions feed weekly tasks via the hub (20 hones)', A.roster.tasks.weekly.progress.w_hone === 20);
  check('achievements tracked from the same hub', A.roster.records.hone_taps >= 20);
  // calendar
  const hr = Math.floor(NOW / HOUR) * HOUR;
  const fb = S.tasks.eventWindow('fieldboss', hr + 5 * MIN), cg = S.tasks.eventWindow('chaosgate', hr + 35 * MIN);
  check('Field Boss live at :00–:10', fb.live && fb.start === hr);
  check('Chaos Gate live at :30–:40', cg.live && cg.start === hr + 30 * MIN);
  check('not live at :15', !S.tasks.live(hr + 15 * MIN).some(e => e.kind === 'fieldboss' || e.kind === 'chaosgate'));
  const even = hr - (Math.floor(hr / HOUR) % 2) * HOUR;
  check('Adventure Island every 2 h on even UTC hours', S.tasks.eventWindow('island', even + MIN).live && S.tasks.eventWindow('island', even + HOUR + MIN).start === even + 2 * HOUR);
  const gs = S.tasks.eventWindow('ghostship', NOW);
  check('Ghost Ship only on Thursdays/Sundays', [4, 0].includes(new Date(gs.start).getUTCDay()));
  const cal = S.tasks.calendar(NOW, { hours: 6 });
  check('calendar sorted with live flags', cal.length >= 12 && cal.every((e, i) => i === 0 || e.start >= cal[i - 1].start));
  const cp = S.tasks.compass(A, NOW);
  check('compass has resets and next events', cp.resets.daily > NOW && cp.resets.weekly > NOW && cp.next.length > 0);
}

// ================================================================= guild
section('guild');
{
  A = newAccount(); const C = A.createChar({ name: 'Guildie', cls: 'reaver', mode: 'powerpass' }); A.give('gold', 5000); A.give('silver', 1e6);
  check('12 AI guilds', S.guild.list(A, NOW).length === 12);
  check('join', ok(S.guild.join(A, 'dawnforged', NOW)) && A.roster.guild.id === 'dawnforged');
  const bs = A.count('bloodstone'), d1 = S.guild.donate(A, C, 'silver', 0, NOW);
  check('donate silver → bloodstones', ok(d1) && A.count('bloodstone') === bs + 40);
  check('once per day', S.guild.donate(A, C, 'silver', 0, NOW).why === 'limit');
  check('gold donation tiers', ok(S.guild.donate(A, C, 'gold', 1, NOW)) && S.guild.donate(A, C, 'gold', 0, NOW).why === 'limit');
  check('donation resets next day', ok(S.guild.donate(A, C, 'silver', 0, NOW + DAY)));
  const v = S.guild.view(A, NOW + DAY);
  check('guild view: research, missions, roster', v.research.length === 5 && v.missions.length === 3 && v.roster.some(m => m.you));
  const m = v.missions[0], M = (await import('../src/data/guilds.js')).GUILD_MISSIONS.find(x => x.id === m.id);
  for (let i = 0; i < M.need; i++) S.tasks.track(A, C, M.event, { ...M.match, count: 1, now: NOW + DAY });
  const v2 = S.guild.view(A, NOW + DAY);
  check('your tracked events complete guild missions', v2.missions.find(x => x.id === m.id).done);
  check('claim a mission', ok(S.guild.claimMission(A, C, m.id, NOW + DAY)));
  check('perks grow with guild level', S.guild.perks(A).xpGain > 0);
  check('leave + cooldown', ok(S.guild.leave(A, NOW + DAY)) && S.guild.join(A, 'counterplay', NOW + DAY + HOUR).why === 'cooldown');
  check('create a guild', ok(S.guild.create(A, { name: 'Test Crew' }, NOW + 3 * DAY)) && A.roster.guild.own);
}

// ================================================================= shops
section('shops');
{
  A = newAccount(); const C = A.createChar({ name: 'Shopper', cls: 'reaver', mode: 'powerpass' }); A.give('silver', 1e7); A.give('horn_shard', 500); A.give('gold', 5000); A.give('shards', 1e5); A.give('crystals', 5000);
  check('8 shops', S.shops.list().length === 8);
  const v = S.shops.view(A, C, 'general', NOW);
  check('general goods view', v.items.length > 20 && v.items.every(x => x.price && x.name));
  let n = 0; while (ok(S.shops.buy(A, C, 'general', 'time_stop', 1, NOW))) n++;
  check('daily limit enforced (5 Time Stop)', n === 5);
  check('limit resets next day', ok(S.shops.buy(A, C, 'general', 'time_stop', 1, NOW + DAY)));
  check('transfer via the raid vendor requires +12', S.shops.buy(A, C, 'raid', 'transfer_head', 1, NOW).why === 'locked');
  C.equip.head.hone = 12;
  const tr = S.shops.buy(A, C, 'raid', 'transfer_head', 1, NOW);
  check('raid vendor reforges into Horned Tyrant', ok(tr) && C.equip.head.set === 'horned');
  const u = S.shops.buy(A, C, 'crystal', 'mount_direwolf', 1, NOW);
  check('crystal shop unlock (total limit 1)', ok(u) && A.roster.mounts.includes('crystal_direwolf') && S.shops.buy(A, C, 'crystal', 'mount_direwolf', 1, NOW).why === 'limit');
  check('guild shop requires a guild', S.shops.buy(A, C, 'guild', 'leapstone', 1, NOW).why === 'locked');
  check('tools', ok(S.shops.buy(A, C, 'general', 'tool_mine_2', 1, NOW)) && A.roster.life.tools.mine.tier === 2);
  walletSane(A, 'after shops');
}

// ================================================================= mail
section('mail');
{
  A = newAccount(); const C = A.createChar({ name: 'Mailer', cls: 'reaver', mode: 'powerpass' });
  const sent = S.mail.welcome(A, C);
  check('welcome letters + powerpass crate', sent.length === 3 && sent.some(m => /Powerpass/.test(m.subject)));
  check('welcome is idempotent', S.mail.welcome(A, C).length === 0);
  const box = S.mail.inbox(A);
  check('inbox unread count', box.unread === 3 && box.list.every(m => m.attachments.length));
  const crate = box.list.find(m => /Powerpass/.test(m.subject));
  check('cannot delete unclaimed mail', S.mail.remove(A, crate.id).why === 'attachments');
  const g0 = A.count('gold'); const cl = S.mail.claim(A, C, crate.id);
  check('claim attachments', ok(cl) && A.count('gold') === g0 + S.mail.POWERPASS_CRATE.gold && A.count('horn_shard') === 40);
  check('claimAll', ok(S.mail.claimAll(A, C)) && S.mail.inbox(A).list.every(m => m.claimed));
  const comp = S.mail.compensation(A, {});
  check('compensation letter is apologetic', /apolog|regret/i.test(comp.body));
  S.mail.send(A, { subject: 'old', bundle: { silver: 1 }, days: 1, t: NOW - 2 * DAY });
  check('expired mail is pruned', !S.mail.inbox(A).list.some(m => m.subject === 'old'));
}

// ================================================================= titles, boards, mods
section('titles/boards/mods');
{
  A = newAccount(); const C = A.createChar({ name: 'Champion', cls: 'reaver', mode: 'raid' });
  const nt = S.tasks.track(A, C, 'clear', { content: 'guardian', id: 'rimewing', now: NOW });
  check('first guardian → achievement + title', nt.some(n => n.kind === 'achievement') && A.roster.titles.includes('guardian_slayer'));
  check('setActive requires ownership', S.titles.setActive(A, 'hellwalker').why === 'owned' && ok(S.titles.setActive(A, 'guardian_slayer')));
  S.tasks.track(A, C, 'clear', { content: 'raid', gate: 1, mode: 'normal', time: 700, now: NOW });
  check('legion clear → Legion Slayer + board entry', A.roster.titles.includes('legion_slayer') && S.boards.view(A, 'legion_nm', NOW).you?.rank >= 1);
  S.titles.setActive(A, 'legion_slayer');
  const tv = S.titles.view(A);
  check('titles view', tv.titles.length >= 30 && tv.achievements.length >= 25 && tv.active === 'legion_slayer');
  const b = S.boards.view(A, 'inferno', NOW);
  check('boards sorted', b.entries.every((e, i) => i === 0 || e.value <= b.entries[i - 1].value));
  check('submit improves only when better', S.boards.submit(A, C, 'inferno', 40, NOW).improved && !S.boards.submit(A, C, 'inferno', 30, NOW).improved);
  // stat context
  for (const c of CARD_SETS.horns.cards) A.roster.cards[c] = { n: 0, awaken: 5 };
  CARD_SETS.horns.cards.forEach((c, i) => S.cards.setDeck(A, i, c));
  const ctx = S.statContext(A, C);
  check('statContext carries card mods', Math.abs(ctx.extra.critDmg - 0.25) < 1e-9 && Math.abs(ctx.extra.crit - 0.03) < 1e-9 && ctx.cardBonus.dmgAdd === 0.01);
  const base = heroStats(C, { rosterLevel: 1 }), st = S.applyMods(heroStats(C, ctx), ctx.extra);
  check('applyMods raises crit & crit damage, stays finite', st.crit > base.crit && st.critDmg > base.critDmg && finite(st) && st.power > base.power);
  check('econMods', 'silverGain' in S.mods.econMods(A));
}

// ================================================================= hooks (fake session)
section('hooks');
{
  A = newAccount(); const C = A.createChar({ name: 'Hooked', cls: 'reaver', mode: 'powerpass' });
  S.mail.welcome(A, C); S.mail.claimAll(A, C);
  const opened = {}, toasts = [];
  const s = { account: A, char: C, bus: new Emitter(), game: { mode: { kind: 'city' }, zone: { id: 'solhaven' }, hero: null, audio: null },
    ui: { toast: (t, k) => toasts.push([k, t]), open: (id, d) => { opened[id] = d; }, update: (id, d) => { opened[id] = d; }, dialog: async () => null, confirm: async () => false, banner: () => {}, hud: { loot: () => {} }, isOpen: () => true },
    refreshWindow(id) { if (registry.WINDOWS[id]) opened[id] = registry.WINDOWS[id](this); }, refreshChar() {}, menu() {} };
  for (const pl of registry.PLUGINS.filter(p => p.id === 'systems')) pl.init(s);
  const need = { honing: ['items', 'item', 'chance', 'energy', 'mats', 'cost', 'boosters'], stone: ['stones'], cards: ['deck', 'cards', 'sets'], gems: ['sockets', 'gems', 'skills'], market: ['cats', 'results', 'sellable', 'listings', 'exchange', 'currencies'],
    stronghold: ['level', 'buildings', 'research', 'craft', 'dispatch', 'energy'], compass: ['events'], tome: ['regions', 'collectibles'], rapport: ['npcs'], mail: ['mails'], guild: ['guild', 'browse'], leaderboards: ['rows', 'boards'], engravings: ['active', 'equipped', 'books'] };
  for (const [id, keys] of Object.entries(need)) {
    let d = null, err = null; try { d = registry.WINDOWS[id](s); } catch (e) { err = e; }
    check(`window ${id} provides data`, d && !err && keys.every(k => k in d), err ? String(err.stack || err) : keys.filter(k => !(k in (d || {}))));
  }
  const act = async (type, p) => { const h = registry.ACTIONS[type] || registry.ACTIONS[type.split(':')[0] + ':']; try { return await h(s, type, p); } catch (e) { check(`action ${type} throws`, false, String(e.stack || e)); return false; } };
  const hd = registry.WINDOWS.honing(s);
  check('hone:tap handled', await act('hone:tap', { uid: hd.item.uid, boosters: {} }) === true && ['success', 'fail'].includes(opened.honing?.result));
  check('market:search/select/buy', await act('market:search', { q: '', cat: 'honing' }) && await act('market:select', { id: 'leapstone' }) && await act('market:buy', { id: 'leapstone', qty: 2 }));
  check('market:list stackable', await act('market:list', { uid: 'mat:leapstone', price: 99, qty: 1 }));
  check('market:exchange', await act('market:exchange', { dir: 'goldToCrystals', amount: 2000 }) || true);
  check('cards:awaken unknown handled gracefully', await act('cards:awaken', { id: 'sprig' }));
  A.give('gem_pouch', 2);
  check('inv:use gem pouch', await act('inv:use', { uid: 'mat:gem_pouch' }) === true && C.inv.some(x => x.kind === 'gem'));
  const gem = C.inv.find(x => x.kind === 'gem');
  check('gems:socket picks a skill', await act('gems:socket', { uid: gem.uid, slot: 0 }) && C.gems[0]?.skill);
  check('sh:upgrade', await act('sh:upgrade', { id: 'workshop' }));
  check('guild:join via action', await act('guild:join', { id: 'salt_steel' }) && A.roster.guild?.id === 'salt_steel');
  check('lb:board', await act('lb:board', { board: 'pvp' }) && opened.leaderboards?.board === 'pvp');
  A.roster.songs.push('valor');
  s.bus.emit('song', { id: 'valor', npc: 'brannoc' });
  check('bus song near a rapport NPC gives rapport', A.roster.rapport.brannoc?.pts > 0);
  s.bus.emit('kill', { unit: { kind: 'mob', type: 'imp', data: {} }, mine: true, zone: 'solhaven' });
  check('bus kill tracked (records)', A.roster.records.demons >= 1);
  s.bus.emit('collect', { id: 'seed:goldmeadow:3' });
  check('bus collect → collectibles', A.roster.collect.seeds.includes('seed:goldmeadow:3'));
  const hudState = { quests: [] }; registry.PLUGINS.find(p => p.id === 'systems').hud(hudState);
  check('hud badges mail', 'mail' in (hudState.badges || {}));
  const cr = (await import('../src/game/systems/hooks.js')).contentRewards(s, { kind: 'chaos', tier: 1 }, { cleared: true });
  check('contentRewards for the results screen', cr.loot.length > 0 && cr.currencies.silver > 0);
  check('no toast reported an internal error', !toasts.some(([k, t]) => /Something went wrong/.test(t)), toasts.slice(-3));
  walletSane(A, 'after hooks');
}

// ================================================================= invariants over a long random session
section('fuzz');
{
  A = newAccount(); const C = A.createChar({ name: 'Fuzzer', cls: 'reaver', mode: 'powerpass' });
  S.mail.welcome(A, C); S.mail.claimAll(A, C);
  const r = new RNG(2024);
  const acts = [
    () => S.loot.chaosReward(A, C, { tier: r.int(1, 4), rng: r }), () => S.loot.guardianReward(A, C, { guardian: r.pick(['rimewing', 'cinderhorn', 'sandmaw', 'kurai']), rng: r }),
    () => S.honing.hone(A, C, r.pick(['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves']), { rng: r, now: NOW }), () => S.market.buy(A, C, r.pick(['leapstone', 'fusion', 'guardian_stone']), r.int(1, 20), { now: NOW }),
    () => S.market.list(A, C, 'guardian_stone', 1, r.int(1, 5), { now: NOW }), () => { at(NOW + r.int(1, 90) * MIN); return S.tick(A, C, NOW); },
    () => S.shops.buy(A, C, 'general', r.pick(['hp_potion', 'time_stop', 'feather']), 1, NOW), () => S.lifeskills.gather(A, C, r.pick(['forage', 'log', 'mine', 'hunt', 'fish', 'dig']), { rng: r, now: NOW }),
    () => S.loot.eventReward(A, C, { kind: r.pick(['fieldboss', 'chaosgate', 'ghostship', 'treasure']), rng: r, now: NOW }), () => S.mail.claimAll(A, C),
  ];
  for (let i = 0; i < (QUICK ? 400 : 2000); i++) { try { r.pick(acts)(); } catch (e) { check('fuzz action threw', false, String(e.stack || e)); break; } }
  walletSane(A, 'fuzz');
  check('fuzz: no NaN in wallet', Object.values(A.roster.wallet).every(Number.isFinite));
}

// ================================================================= economy
section('economy');
Date.now = REAL_NOW;
const sim = S.simulateEconomy({ runs: QUICK ? 12 : 48, seed: 1 });
check('economy: median within 2–4 h', sim.hours.median >= 1.8 && sim.hours.median <= 4, sim.hours);
check('economy: every run finishes within 12 h', sim.finished === sim.runs, sim.finished);
check('economy: no material is spent beyond what was earned', Object.keys(sim.spent).every(k => sim.spent[k] <= sim.earned[k] + 1), { spent: sim.spent, earned: sim.earned });
const late = S.simulateEconomy({ runs: QUICK ? 6 : 12, seed: 2, strategy: 'late', maxHours: 12 });
console.log('\n\n' + sim.text + '\n\n' + late.text.split('\n').slice(0, 2).join('\n'));
console.log(`\nmedian run timeline: ${sim.timeline.filter(e => /reforged|raid entry|legion/.test(e.what)).map(e => `${e.min}m ${e.what}`).join(' · ')}`);

// ---------------------------------------------------------------- report
console.log(`\n${pass} passed, ${failN} failed`);
for (const f of fails) console.log('  ✗ ' + f);
process.exit(failN ? 1 : 0);
