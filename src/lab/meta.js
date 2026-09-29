// Meta lab: share cards, the leaderboards panel, the combat meter (fed by a synthetic raid fight through the real
// collector), ribbons, pills and the title challenge card — without running the game.
//   node tools/lab.mjs src/lab/meta.js  →  http://localhost:5299/lab/meta.html
//   ?card=clear|raid|hone|stone|profile|inferno|chaos|all   paint cards (window.__cards[kind] = canvas)
//   ?share=<kind>   the share modal     ?boards=<board>[&variant=]   the leaderboards panel     ?meter=1[&tab=dmg|sup|skills|log]
//   ?ribbons=1   ?pill=1   ?chal=1   ?touch=1
import { createUI } from '../ui/index.js';
import { Emitter } from '../core/events.js';
import { renderCard } from '../game/meta/cards.js';
import { heroPortrait, portraitDebug } from '../game/meta/portrait.js';
import { Meter, MeterPanel } from '../game/meta/meter.js';
import { MetaUI, BoardsPanel } from '../game/meta/ui.js';
import { ShareModal } from '../game/meta/share.js';
import { submit, todaysGuardian } from '../game/meta/boards.js';
import { legionRaceNews } from '../game/meta/records.js';
import { encodeChallenge, decodeChallenge, challengeLink } from '../game/meta/challenge.js';

const q = Object.fromEntries(new URLSearchParams(location.search));
document.body.style.background = 'radial-gradient(ellipse at 50% 40%, #1d2a44, #070a12 70%)';
const ui = createUI(document.body, { onAction: (t, p) => console.log('[action]', t, JSON.stringify(p).slice(0, 160)), touch: q.touch === '1' });
ui.screen(q.screen || 'game');

// ------------------------------------------------------------------------------------------------ a fake session
const L = new Emitter(); L.time = 0; L.units = [];
const CL = ['reaver', 'oathkeeper', 'stormfist', 'pistoleer', 'starcaller', 'songweaver', 'bladedancer', 'demonbound'];
const NAMES = ['Lookie', 'Miwen', 'Kaelthas', 'Velmira', 'Orrin', 'Seyla', 'Dravik', 'Nyssa'];
const heroes = CL.map((c, i) => ({ id: i + 1, name: NAMES[i], cls: c, kind: 'hero', team: 0, statuses: [], dead: false, data: {} }));
const boss = { id: 99, name: 'Gorrath', kind: 'boss', type: 'gorrath', team: 1, statuses: [], dead: false, data: { stagger: null } };
L.units = [...heroes, boss];
const kit = { char: { cls: 'reaver' }, skills: { whirlwind_edge: { name: 'Whirlwind Edge' }, hell_blade: { name: 'Hell Blade' }, mountain_cleave: { name: 'Mountain Cleave' }, red_dust: { name: 'Red Dust' }, finish_strike: { name: 'Finish Strike' }, sword_storm: { name: 'Sword Storm' } }, awaken: { id: 'worldsplitter', name: 'Worldsplitter' }, u: heroes[0] };
const session = { ui, game: { level: L, hero: kit, party: { members: heroes.map(u => ({ kit: { u } })) }, mode: { kind: 'encounter', state: 'fight' }, zone: { name: 'Throne of Horns' }, time: 0 },
  account: { roster: { records: {}, level: 12, guild: { name: 'Dawnforged' } }, save() {} }, char: { name: 'Lookie', cls: 'reaver', level: 60 }, bus: new Emitter() };
const meta = { s: session };
meta.ui = new MetaUI(meta);
meta.meter = new Meter(session);
meta.panel = new MeterPanel(meta);
meta.boardsPanel = new BoardsPanel(meta);
meta.shareModal = new ShareModal(meta);
window.__meta = meta; window.__heroPortrait = heroPortrait; window.__portraitDebug = portraitDebug;

// ------------------------------------------------------------------------------------------------ synthetic fight
function fight(secs = 214) {
  meta.meter.bind(L);
  const r = (a, b) => a + Math.random() * (b - a);
  const skills = Object.keys(kit.skills);
  for (let t = 0; t < secs; t += 0.1) {
    L.time = t;
    for (const u of heroes) {
      if (Math.random() > 0.55) continue;
      const sup = u.cls === 'oathkeeper' || u.cls === 'songweaver';
      const base = sup ? 9000 : [15000, 18000, 21000, 13000, 16000, 19000][u.id % 6];
      const crit = Math.random() < (sup ? 0.2 : 0.45), back = Math.random() < 0.3;
      const amount = Math.round(base * r(0.6, 1.5) * (crit ? 2 : 1));
      L.emit('damage', { src: u, tgt: boss, amount, crit, back, head: !back && Math.random() < 0.1, counter: Math.random() < 0.002, skill: u === heroes[0] ? (Math.random() < 0.06 ? 'worldsplitter' : Math.random() < 0.2 ? 'basic' : skills[Math.floor(Math.random() * skills.length)]) : 'x', killed: false });
      if (sup && Math.random() < 0.05) { L.emit('shield', { src: u, tgt: heroes[Math.floor(Math.random() * 8)], amount: Math.round(r(8e3, 3e4)) }); L.emit('heal', { src: u, tgt: heroes[2], amount: 12000, real: Math.round(r(2e3, 1e4)) }); }
    }
    if (Math.random() < 0.02) L.emit('damage', { src: boss, tgt: heroes[Math.floor(Math.random() * 8)], amount: Math.round(r(2e4, 9e4)), absorbed: 0 });
    if (Math.abs(t - 42) < 0.05) L.emit('bossBanner', { text: 'HORNED FURY — his horns blaze! Break a horn to quell it.' });
    if (Math.abs(t - 61) < 0.05) L.emit('counter', { src: heroes[2], tgt: boss });
    if (Math.abs(t - 88) < 0.05) { boss.data.stagger = { v: 900, max: 900 }; L.emit('staggerCheck', { unit: boss, label: 'Wrath of the Horned Tyrant' }); }
    if (boss.data.stagger && t > 88 && t < 96) { const who = heroes[Math.floor(Math.random() * 8)]; boss.data.stagger.v = Math.max(0, boss.data.stagger.v - r(10, 40)); L.emit('damage', { src: who, tgt: boss, amount: 12000, skill: 'x' }); if (boss.data.stagger.v <= 0) { L.emit('staggerBreak', { tgt: boss, src: who }); boss.data.stagger = null; } }
    if (Math.abs(t - 120) < 0.05) { heroes[6].dead = true; L.emit('death', { unit: heroes[6], killer: boss }); }
    if (Math.abs(t - 150) < 0.05) L.emit('awaken', { unit: heroes[0], def: { name: 'Worldsplitter' } });
    if (Math.abs(t - 176) < 0.05) L.emit('partBreak', { tgt: boss, src: heroes[3], part: 'horn_left' });
    // support uptime sampling: the songweaver keeps a buff on most allies
    for (const u of heroes) u.statuses = Math.random() < 0.82 ? [{ src: heroes[5], def: {} }] : [];
    boss.statuses = Math.random() < 0.7 ? [{ id: 'brand', src: heroes[1], def: { debuff: true } }] : [];
    meta.meter.update(0.1);
  }
  heroes[6].dead = false;
  meta.meter.onClear({ kind: 'raid', raid: 'gorrath', gate: 1 }, { cleared: true, time: secs, name: 'Gorrath' });
}

// ------------------------------------------------------------------------------------------------ mock card data
const party = heroes.map((u, i) => ({ name: u.name, cls: u.cls, dps: [5.31e6, 1.2e6, 4.4e6, 3.9e6, 4.8e6, 1.4e6, 3.3e6, 4.1e6][i], you: i === 0 }));
const tot = party.reduce((a, m) => a + m.dps, 0); for (const m of party) m.share = m.dps / tot;
const DATA = {
  clear: { content: 'guardian', boss: 'rimewing', over: 'Guardian Hunt · Daily Guardian', title: 'Rimewing', sub: 'Tyrant of the Frozen Sky', time: 98.84, rank: 'S', deaths: 0,
    board: { label: 'today', rank: 4, total: 37 }, badges: ['Personal best', 'Deathless'], party: party.slice(0, 4).map((m, i) => ({ ...m, share: [0.49, 0.12, 0.2, 0.19][i] })), you: { name: 'Lookie', cls: 'reaver', iLvl: 1445 } },
  raid: { content: 'raid', boss: 'gorrath', over: 'Legion Raid · Gate 2 · Hard', title: 'Gorrath', sub: 'The Horned Tyrant', time: 812.4, rank: 'C', deaths: 0,
    board: { label: 'this week', rank: 12, total: 164 }, badges: ['World First #9', 'Deathless', 'Premade'], party, you: { name: 'Lookie', cls: 'reaver', iLvl: 1445 } },
  chaos: { content: 'chaos', boss: 'gatekeeper', over: 'Chaos Dungeon', title: 'Demon Rift III', sub: '312 demons purged', time: 201.7, rank: 'A', kills: 312, deaths: 0, badges: ['First clear'], party: [{ ...party[0], share: 1, dmg: 1.07e9 }], you: { name: 'Lookie', cls: 'reaver', iLvl: 1445 } },
  hone: { name: 'Lookie', cls: 'reaver', item: { name: 'Horned Tyrant Greatsword', icon: 'item:weapon:reaver:t2', grade: 5 }, to: 20, taps: 2, chance: 0.11, base: 0.1, energy: 0.0465, luck: 0.81, iLvl: 1540 },
  stone: { name: 'Lookie', cls: 'reaver', label: '97', score: [9, 7, 2], grade: 5, stoneName: 'Relic Ability Stone',
    lines: [{ id: 'keen_edge', name: 'Keen Edge', slots: [1, 1, 1, 1, -1, 1, 1, 1, 1, 1], nodes: 9 }, { id: 'hexed_idol', name: 'Hexed Idol', slots: [1, -1, 1, 1, 1, -1, 1, -1, 1, 1], nodes: 7 }, { id: 'neg_atk', name: 'Atk. Power Reduction', slots: [-1, 1, -1, -1, 1, -1, -1, -1, -1, -1], nodes: 2, negative: true }] },
  profile: { name: 'Lookie', cls: 'reaver', level: 60, iLvl: 1445.83, title: 'Horn Breaker', guild: 'Dawnforged', roster: 12, weapon: { name: 'Horned Tyrant Greatsword', hone: 20, grade: 5 },
    engravings: [{ id: 'bloodfrenzy', name: 'Bloodfrenzy', level: 3 }, { id: 'keen_edge', name: 'Keen Edge', level: 3 }, { id: 'hexed_idol', name: 'Hexed Idol', level: 3 }, { id: 'vendetta', name: 'Vendetta', level: 3 }, { id: 'adrenaline', name: 'Adrenaline', level: 2 }, { id: 'neg_atk', name: 'Atk. Power Reduction', level: 1, neg: true }],
    records: ['Rimewing 1:38.8', 'Gorrath NM full raid 24:10.3'] },
  inferno: { name: 'Lookie', cls: 'reaver', floor: 73, time: 3121, kills: 2410, conquered: false, boons: ['Ember Fury ×2', 'Bloodthirst', 'Second Wind', 'Awakened Soul', 'Molten Core', 'Glass Cannon'], board: { rank: 6, total: 52 }, sub: 'Descended from floor 1' },
};

async function cards(list) {
  window.__cards = {};
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;overflow:auto;z-index:50;display:flex;flex-wrap:wrap;gap:16px;padding:16px;align-content:flex-start;background:#05070c';
  document.body.appendChild(wrap);
  for (const k of list) {
    const kind = k === 'raid' || k === 'chaos' ? 'clear' : k;
    const data = { ...DATA[k] };
    if (k === 'profile') data.portrait = await heroPortrait({ cls: 'reaver', sex: 'm', look: { face: 1, hair: 2, hairColor: 0x3a2616, skin: 2, eyes: 0x3a6ab0, height: 1, build: 0.6, marks: 1, markColor: 0x9a1c1c }, equip: { chest: { set: 'horned' }, weapon: { set: 'horned', hone: 20 } } });
    const c = await renderCard(kind, data);
    window.__cards[k] = c;
    c.style.cssText = `width:${list.length > 1 ? 780 : 1200}px;height:auto;box-shadow:0 8px 30px #000`;
    wrap.appendChild(c);
  }
  window.__ready = true;
}

// ------------------------------------------------------------------------------------------------ what to show
(async () => {
  if (q.card) return cards(q.card === 'all' ? ['clear', 'raid', 'hone', 'stone', 'profile', 'inferno', 'chaos'] : q.card.split(','));
  if (q.meter) { fight(+q.secs || 214); meta.panel.tab = q.tab || 'dmg'; meta.panel.open(); meta.panel.render(); }
  if (q.boards) {
    // a few of your own entries so the "you" rows show
    const me = { name: 'Lookie', cls: 'reaver', guild: 'Dawnforged', party: CL };
    submit({ ...me, board: 'legion_nm', variant: 'g1', value: 412.5, sub: 'Normal · Hounds of the Horn' });
    submit({ ...me, board: 'guardian', value: 101.3, sub: 'Deathless', party: CL.slice(0, 4) });
    submit({ ...me, board: 'stone', value: 907.08, sub: 'Keen Edge 9 · Hexed Idol 7 · −2' });
    submit({ ...me, board: 'legion_first', value: 5.2 * 3600e3, sub: 'Normal · 23:40.1', trial: true });
    meta.boardsPanel.open(q.boards === '1' ? 'legion_first' : q.boards, q.variant);
  }
  if (q.share) await meta.shareModal.open(q.share === 'raid' || q.share === 'chaos' ? 'clear' : q.share, DATA[q.share], { challenge: { kind: 'guardian', boss: 'rimewing', name: 'Lookie', cls: 'reaver', time: 98.84 } });
  if (q.ribbons) {
    meta.ui.ribbon({ over: 'New personal best', text: 'Rimewing 1:38.8 (−12.4 s)', sub: 'Deathless', kind: 'gold', icon: 'boss:rimewing', dur: 60 });
    meta.ui.ribbon({ over: 'Daily Guardian', text: '#4 of 37 today', sub: 'Rimewing · 1:38.8', kind: 'info', icon: 'boss:rimewing', dur: 60 });
    meta.ui.ribbon({ over: 'Challenge beaten!', text: 'You beat Kaelthas’s 1:52.3', sub: 'Your time: 1:38.8', kind: 'good', glyph: 'sword', action: { label: 'Send it back', fn: () => {} }, dur: 60 });
  }
  if (q.pill) meta.ui.pill({ text: '+20 in 2 taps!', sub: '1-in-22 luck · Horned Tyrant Greatsword', icon: 'item:weapon:reaver:t2', fn: () => {}, dur: 60 });
  if (q.chal) { const code = encodeChallenge({ kind: 'guardian', boss: 'rimewing', name: 'Kaelthas', cls: 'stormfist', time: 222.4, deaths: 0 }); window.__code = code; window.__decoded = decodeChallenge(code); window.__link = challengeLink(decodeChallenge(code)); ui.screen('title', { server: 'Solmara-1', status: 'Busy', news: [legionRaceNews()] }); meta.ui.titleChallenge(decodeChallenge(code), {}); }
  window.__news = legionRaceNews();
  window.__guardian = todaysGuardian();
  window.__ready = true;
})();
