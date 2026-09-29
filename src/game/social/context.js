// Pointing at people: hover detection for NPCs and players, click-to-talk, and the Lost Ark-style player context
// menu (Inspect, Invite to Party, Whisper, Add Friend, Duel). Inspect opens the character window with their gear.
import { makeGear, makeAccessory } from '../systems/gear.js';
import { CLASSES } from '../../data/classes/index.js';

const CSS = `
.ss-ctx{position:fixed;z-index:65;min-width:190px;padding:6px;border:1px solid #3a4560;border-radius:4px;background:linear-gradient(180deg,rgba(18,24,40,.98),rgba(9,12,22,.98));box-shadow:0 12px 40px rgba(0,0,0,.6);font:500 13px "Segoe UI",Roboto,system-ui,sans-serif;color:#e7e3d8}
.ss-ctx h4{margin:2px 6px 6px;font:600 13px "Segoe UI",Roboto,sans-serif;color:#f1dca6;display:flex;justify-content:space-between;gap:10px}
.ss-ctx h4 small{color:#8e97ad;font-weight:500}
.ss-ctx button{display:block;width:100%;text-align:left;padding:7px 10px;border:0;border-radius:3px;background:none;color:inherit;font:inherit;cursor:pointer}
.ss-ctx button:hover,.ss-ctx button:focus-visible{background:rgba(241,220,166,.1);outline:none;color:#fff}
`;
let styled = false;

export class SocialContext {
  constructor(session) {
    this.s = session; this.hover = null; this.menu = null; this.friends = new Set();
    if (!styled) { styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
    addEventListener('pointerdown', e => { if (this.menu && !this.menu.contains(e.target)) this.close(); }, true);
    addEventListener('keydown', e => { if (e.key === 'Escape' && this.menu) { this.close(); e.stopPropagation(); } }, true);
  }
  /** per frame: find the person under the cursor (screen-space pick) */
  update() {
    const g = this.s.game, L = g.level, me = g.hero?.u, inp = g.input;
    this.hover = null; g.hoverTarget = null;
    if (!L || !me || !inp.mouse.over || this.s.screen !== 'game') return;
    let best = null, bd = 30;
    const p = { x: 0, y: 0 };
    for (const u of L.units) {
      if (u === me || u.dead || !(u.kind === 'npc' || (u.kind === 'hero' && (u.team === 2 || u.remote || u.puppet || u.data.sim)))) continue;
      if (Math.hypot(u.pos.x - me.pos.x, u.pos.z - me.pos.z) > 28) continue;
      const s = g.cam.toScreen({ x: u.pos.x, y: u.pos.y + (u.height || 1.8) * 0.6, z: u.pos.z }, p); if (!s) continue;
      const d = Math.hypot(s.x - inp.mouse.x, (s.y - inp.mouse.y) * 0.6);
      if (d < bd) { bd = d; best = u; }
    }
    this.hover = best; g.hoverTarget = best;
    document.body.style.cursor = best ? 'pointer' : '';
    const atk = g.player?.moveBtn === 2 ? 0 : 2;
    if (best && inp.clicked(atk)) this.click(best);
  }
  click(u) {
    const me = this.s.game.hero.u;
    if (u.kind === 'npc') {
      if (me.distTo(u) > 3.2) { this.s.game.player.setDest(u.pos.x, u.pos.z + 1.5); this.pendingTalk = u; return; }
      this.s.interact(u); return;
    }
    this.open(u);
  }
  /** walk-then-talk */
  tick() {
    const u = this.pendingTalk, me = this.s.game.hero?.u; if (!u || !me) return;
    if (u.dead || !this.s.L?.byId.has(u.id)) { this.pendingTalk = null; return; }
    if (me.distTo(u) < 3) { this.pendingTalk = null; this.s.game.player.stop(); this.s.interact(u); }
  }
  open(u) {
    this.close();
    const el = this.menu = document.createElement('div'); el.className = 'ss-ctx';
    const cls = CLASSES[u.cls]?.name || '';
    el.innerHTML = `<h4><span>${esc(u.name)}</span><small>${esc(cls)} · ${u.data.ilvl || u.st?.ilvl || '—'}</small></h4>`;
    const item = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { this.close(); fn(); }; el.appendChild(b); };
    item('Inspect', () => this.inspect(u));
    item('Invite to Party', () => this.invite(u));
    item('Whisper', () => this.s.ui.chat.focus?.(`/w ${u.name} `));
    item(this.friends.has(u.name) ? 'Remove Friend' : 'Add Friend', () => { if (this.friends.has(u.name)) this.friends.delete(u.name); else this.friends.add(u.name); this.s.ui.toast(this.friends.has(u.name) ? `${u.name} added to friends.` : `${u.name} removed from friends.`, 'success'); });
    item('Challenge to a Duel', () => this.s.bus.emit('duel', { unit: u }) || this.s.ui.toast(`${u.name} accepts your challenge!`, 'info'));
    const m = this.s.game.input.mouse;
    el.style.left = Math.min(innerWidth - 210, m.x + 12) + 'px'; el.style.top = Math.min(innerHeight - 240, m.y + 12) + 'px';
    document.body.appendChild(el);
    el.querySelector('button')?.focus();
  }
  close() { this.menu?.remove(); this.menu = null; }
  /** the character window, filled with their gear (SimPlayers get plausible gear from their item level) */
  inspect(u) {
    const ilvl = u.data.ilvl || u.st?.ilvl || 1400;
    const set = ilvl >= 1340 ? 'horned' : 'vanguard';
    const base = set === 'horned' ? 1340 : 1100;
    const hone = Math.max(0, Math.min(25, Math.round((ilvl - base) / 10)));
    const gear = {};
    for (const sl of ['weapon', 'head', 'shoulder', 'chest', 'pants', 'gloves']) gear[sl] = makeGear(set, sl, u.cls, { hone, quality: 40 + ((u.id * 37) % 60) });
    gear.necklace = makeAccessory('necklace', 5); gear.earring1 = makeAccessory('earring', 5); gear.earring2 = makeAccessory('earring', 5); gear.ring1 = makeAccessory('ring', 5); gear.ring2 = makeAccessory('ring', 5);
    this.s.ui.open('character', { name: u.name, cls: u.cls, level: 60, iLvl: ilvl, title: u.data.title, guild: u.data.guild, gear, stats: { atk: Math.round(u.st?.atk || 40000), hp: Math.round(u.hpMax), crit: 560, spec: 1450, swift: 520, dom: 0, endur: 0, expert: 0 }, engravings: [], inspect: true });
  }
  invite(u) {
    const s = this.s;
    if (u.remote || u.puppet) { s.ui.toast(`${u.name} is already in your party (co-op).`, 'info'); return; }
    const list = s.invited ||= [];
    if (list.length >= 3) { s.ui.toast('Your party is full.', 'warn'); return; }
    if (list.some(x => x.name === u.name)) { s.ui.toast(`${u.name} is already in your party.`, 'info'); return; }
    const sim = u.data.sim; if (!sim) { s.ui.toast(`${u.name} is busy.`, 'info'); return; }
    const yes = Math.random() < 0.85;
    setTimeout(() => {
      if (!yes) { s.ui.chat.add({ channel: 'whisper', from: u.name, text: ['sorry, doing dailies rn', 'maybe later!', 'afk 5'][Math.floor(Math.random() * 3)] }); return; }
      list.push(sim);
      s.ui.chat.add({ channel: 'party', from: u.name, text: ['hi!', 'o/ ready when you are', 'let’s go', 'ty for the inv'][Math.floor(Math.random() * 4)] });
      s.ui.toast(`${u.name} joined your party. They’ll come with you into the rifts.`, 'party');
    }, 700 + Math.random() * 900);
  }
}
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
