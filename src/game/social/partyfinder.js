// Party Finder: AI adventurers post listings for every piece of content (Lost Ark culture included: "know mechs",
// "no stuck-ups", "learning party"). Apply to one and, once accepted, you launch with them; or post your own and pick
// from applicants. Also the matchmaking button. Window data: registerWindow('partyfinder'); actions 'pf:*'.
import { registerPlugin, registerWindow, registerAction } from '../registry.js';
import { makeSim } from './names.js';
import { RAIDS, GUARDIANS } from '../../data/raids.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';
import { CLASSES } from '../../data/classes/index.js';
import { itemLevel } from '../systems/stats.js';

const NOTES = ['know mechs', 'learning party, be patient', 'no stuck-ups', 'fast clear', 'bring counters', 'chill run', 'prog party, wipes expected', 'need 1 support', 'carry mood', 'first clear, pls help', 'exp only', 'gold run'];
function contents() {
  const out = [];
  for (const r of Object.values(RAIDS)) r.gates.forEach((g, i) => { if (!g.bosses.every(b => BOSS_DEFS[b.boss])) return; out.push({ c: { kind: 'raid', raid: r.id, gate: i }, name: `${r.name} · Gate ${i + 1}`, max: r.players, req: r.ilvl.normal }); if (r.ilvl.hard) out.push({ c: { kind: 'raid', raid: r.id, gate: i, hard: true }, name: `${r.name} · Gate ${i + 1} (Hard)`, max: r.players, req: r.ilvl.hard }); });
  for (const g of GUARDIANS) if (BOSS_DEFS[g.id]) out.push({ c: { kind: 'guardian', boss: g.id }, name: `Guardian Hunt · ${BOSS_DEFS[g.id].name}`, max: 4, req: g.ilvl });
  for (const t of [1, 2, 3, 4]) out.push({ c: { kind: 'chaos', tier: t }, name: `Chaos Dungeon · Demon Rift ${['I', 'II', 'III', 'IV'][t - 1]}`, max: 4, req: [1100, 1250, 1400, 1500][t - 1] });
  return out;
}

class PartyFinder {
  constructor() { this.id = 'partyfinder'; this.listings = []; this.mine = null; this.seed = 1; this.t = 0; }
  init(s) { this.s = s; this.refresh(); }
  refresh() {
    const all = contents(); this.listings = [];
    for (let i = 0; i < 22; i++) {
      const k = all[(i * 5 + this.seed) % all.length];
      const lead = makeSim(this.seed * 1000 + i * 17);
      const n = 1 + ((i * 7 + this.seed) % (k.max - 1));
      const members = [lead];
      for (let j = 1; j < n; j++) members.push(makeSim(this.seed * 1000 + i * 17 + j * 3));
      for (const m of members) m.ilvl = Math.max(m.ilvl, k.req + ((m.seed % 40)));
      this.listings.push({ id: `L${this.seed}-${i}`, content: k.c, title: k.name, max: k.max, req: k.req, note: NOTES[(i + this.seed) % NOTES.length], leader: lead, members, age: (i * 37) % 600 });
    }
    this.seed++;
  }
  update(dt) {
    this.t += dt;
    if (this.t > 45) { this.t = 0; this.refresh(); if (this.s.ui.isOpen?.('partyfinder')) this.s.refreshWindow('partyfinder'); }
    const m = this.mine;
    if (m && m.members.length < m.max && Math.random() < dt * 0.35) {    // applicants trickle in
      const sim = makeSim(Math.floor(Math.random() * 1e6)); sim.ilvl = Math.max(sim.ilvl, m.req + Math.floor(Math.random() * 30));
      if (!m.applicants.some(a => a.name === sim.name)) { m.applicants.push(sim); this.s.ui.toast?.(`${sim.name} (${CLASSES[sim.cls]?.name || sim.cls}, ${sim.ilvl}) applied to your party.`, 'party'); if (this.s.ui.isOpen?.('partyfinder')) this.s.refreshWindow('partyfinder'); }
    }
  }
  view() {
    const s = this.s, il = Math.floor(itemLevel(s.char || {}));
    const row = x => ({ name: x.name, cls: x.cls, ilvl: x.ilvl, support: CLASSES[x.cls]?.role === 'support', title: x.title });
    return {
      you: { name: s.char?.name, cls: s.char?.cls, ilvl: il },
      listings: this.listings.map(l => ({ id: l.id, title: l.title, content: l.content, max: l.max, req: l.req, note: l.note, age: l.age, leader: row(l.leader), members: l.members.map(row), canApply: il >= l.req && l.members.length < l.max })),
      mine: this.mine ? { title: this.mine.title, content: this.mine.content, max: this.mine.max, req: this.mine.req, note: this.mine.note, members: this.mine.members.map(row), applicants: this.mine.applicants.map(row) } : null,
      contents: contents().map(k => ({ ...k.c, title: k.name, max: k.max, req: k.req, locked: il < k.req })),
    };
  }
  async apply(id) {
    const s = this.s, l = this.listings.find(x => x.id === id); if (!l) return;
    if (Math.floor(itemLevel(s.char)) < l.req) { s.ui.toast('Your item level is too low for this party.', 'error'); return; }
    s.ui.toast(`Applied to ${l.leader.name}’s party…`, 'info');
    await new Promise(r => setTimeout(r, 900 + Math.random() * 1400));
    if (Math.random() < 0.12) { s.ui.chat.add({ channel: 'whisper', from: l.leader.name, text: 'sorry, filled!' }); return; }
    s.ui.chat.add({ channel: 'party', from: l.leader.name, text: ['welcome!', 'hi, we go', 'o/ ready?', 'ty for joining'][Math.floor(Math.random() * 4)] });
    s.ui.close?.('partyfinder');
    this.launch(l.content, l.members);
  }
  launch(content, sims) {
    const s = this.s;
    s.invited.length = 0; s.invited.push(...sims);           // Party.fill takes these first
    s.launch({ ...content, trial: Math.floor(itemLevel(s.char)) < (content.kind === 'raid' ? (RAIDS[content.raid]?.ilvl?.[content.hard ? 'hard' : 'normal'] || 0) : 0) });
  }
  create(p) {
    const k = contents().find(x => JSON.stringify(x.c) === JSON.stringify(p.content)) || contents()[0];
    this.mine = { title: k.name, content: k.c, max: k.max, req: p.req || k.req, note: p.note || 'all welcome', members: [], applicants: [] };
    this.s.ui.toast('Your party is listed. Applicants will appear shortly.', 'success');
  }
}
const pf = registerPlugin(new PartyFinder());
registerWindow('partyfinder', () => pf.view());
registerAction('pf:', (s, type, p) => {
  const m = pf.mine;
  switch (type) {
    case 'pf:apply': pf.apply(p.id); return true;
    case 'pf:create': pf.create(p); break;
    case 'pf:accept': if (m) { const i = m.applicants.findIndex(a => a.name === p.name); if (i >= 0 && m.members.length < m.max - 1) m.members.push(m.applicants.splice(i, 1)[0]); } break;
    case 'pf:decline': if (m) m.applicants = m.applicants.filter(a => a.name !== p.name); break;
    case 'pf:cancel': pf.mine = null; break;
    case 'pf:start': if (m) { const sims = m.members; pf.mine = null; s.ui.close?.('partyfinder'); pf.launch(m.content, sims); } return true;
    case 'pf:match': { const k = p.content; const l = pf.listings.find(x => JSON.stringify(x.content) === JSON.stringify(k) && x.members.length < x.max); if (l) pf.apply(l.id); else { pf.create({ content: k }); } return true; }
    case 'pf:refresh': pf.refresh(); break;
    default: return false;
  }
  s.refreshWindow('partyfinder');
  return true;
});
export { pf };
