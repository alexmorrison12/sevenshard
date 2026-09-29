// Combat log / DPS meter. Listens to the running Level's events and splits combat into fights ("segments"): one per
// boss encounter / chaos run / Inferno floor, and idle-separated skirmishes in the open world. Per party member:
// damage, DPS, share, crit %, back / head attack %, counters, stagger contribution, shields, effective healing, damage
// taken, deaths, support buff uptime (and Brand uptime on bosses). For the local hero: a per-skill breakdown. A log
// of the fight's key moments (counters, stagger / part breaks, mechanics, awakenings, deaths, biggest hits).
//
//   const m = new Meter(session);  m.update(dt) each frame (rebinds itself when the level changes)
//   m.view(i) → full view of fight i (0 = live / latest)       m.windowData() → the UI 'meter' window shape
//   new MeterPanel(meta).toggle() — the detailed DOM panel (Backquote)
import { CLASSES } from '../../data/classes/index.js';
import { iconUrl } from '../../ui/core/icon.js';
import { glyph } from '../../ui/core/glyphs.js';
import { cls as clsInfo } from '../../ui/core/data.js';
import { short, int, pct, clockS, esc, pretty } from './fmt.js';
import { db, saveDb } from './store.js';

const isSupport = c => CLASSES[c]?.role === 'support';
const MAX_SEGS = 12, MAX_LOG = 320;
const OPEN_WORLD = new Set(['city', 'field', 'island', 'stronghold', 'sailing', 'guest', 'events', 'pvp']);
const DOT = { fire: 'Burn', bleed: 'Bleed', poison: 'Poison', lightning: 'Shock', ice: 'Frostbite', dark: 'Blight' };

export class Meter {
  constructor(session) {
    this.s = session; this.L = null; this.offs = []; this.segs = []; this.cur = null; this.ver = 0; this.pending = []; this.prePull = [];
  }
  get g() { return this.s.game; }
  me() { return this.g?.hero?.u || null; }
  bind(L) {
    for (const f of this.offs) { try { f(); } catch { /* old level */ } }
    this.offs = [];
    if (this.cur) this.close('zone');
    this.prePull = []; this.pending = [];
    this.L = L; if (!L?.on) return;
    const on = (t, fn) => { const off = L.on(t, ev => { try { fn(ev || {}); } catch (e) { console.warn('[meter]', t, e); } }); if (typeof off === 'function') this.offs.push(off); };
    on('damage', ev => this.onDamage(ev));
    // shields / heals before the first blow (pre-pull) are buffered and credited when the fight starts
    const support = (k, ev, v) => { if (!this.ally(ev.src) || !(v > 0)) return; if (this.cur) this.row(this.cur, ev.src)[k] += v; else { this.prePull.push({ k, u: ev.src, v, t: this.L.time }); if (this.prePull.length > 48) this.prePull.shift(); } };
    on('heal', ev => support('heal', ev, ev.real));
    on('shield', ev => support('shield', ev, ev.amount));
    on('death', ev => this.onDeath(ev));
    on('revive', ev => { if (this.cur && this.ally(ev.unit)) this.log('buff', `${ev.unit.name} is back on their feet`); });
    on('counter', ev => { if (!this.cur) return; this.log('mech', `★ COUNTER — ${ev.src?.name || '?'} stuns ${ev.tgt?.name || 'the boss'}`, ev.src); });
    on('staggerCheck', ev => this.cur && this.log('mech', `Stagger check${ev.label ? ` — ${ev.label}` : ''}`));
    on('staggerBreak', ev => this.cur && this.log('mech', `STAGGER BREAK — ${ev.tgt?.name || 'the boss'} is groggy${ev.src ? ` (last hit: ${ev.src.name})` : ''}`, ev.src));
    on('partBreak', ev => this.cur && this.log('mech', `Part break — ${ev.src?.name || '?'} breaks ${ev.tgt?.name || 'the boss'}’s ${pretty(ev.part || 'part').toLowerCase()}`, ev.src));
    on('awaken', ev => this.cur && this.ally(ev.unit) && this.log('buff', `${ev.unit.name} unleashes ${ev.def?.name || 'an awakening'}`, ev.unit));
    on('identity', ev => this.cur && this.ally(ev.unit) && this.log('buff', `${ev.unit.name}: ${ev.def?.name || 'identity'}`, ev.unit));
    on('bossBanner', ev => this.cur && ev.text && this.log('mech', String(ev.text)));
    on('bossEnrage', () => this.cur && this.log('mech', 'The boss is enraged'));
    on('cast', ev => this.onCast(ev));
  }
  ally(u) { const me = this.me(); return !!u && u.kind === 'hero' && u.team === (me ? me.team : 0); }
  members() { const p = this.g?.party; const list = p?.members?.map(m => m.kit?.u).filter(Boolean) || []; const me = this.me(); if (me && !list.includes(me)) list.unshift(me); return list; }

  // ------------------------------------------------------------------------------------------------ segments
  seg() {
    if (this.cur) return this.cur;
    const L = this.L, g = this.g;
    const S = { id: (this.segs[0]?.id || 0) + 1, t0: L.time, last: L.time, act: L.time, end: null, dur: 0, closedAt: 0, title: '', mode: g?.mode?.kind || '',
      zone: g?.zone?.name || '', bosses: new Map(), rows: new Map(), skills: new Map(), log: [], sg: new Map(), up: new Map(), brandT: 0, result: null, big: 0 };
    for (const u of this.members()) this.row(S, u);
    for (const p of this.pending) if (L.time - p.t < 2.5) this.skill(S, p.id, p.name).casts++;
    for (const p of this.prePull) if (L.time - p.t < 10 && p.u.level === L) this.row(S, p.u)[p.k] += p.v;
    this.pending = []; this.prePull = [];
    this.cur = S; this.segs.unshift(S); if (this.segs.length > MAX_SEGS) this.segs.length = MAX_SEGS;
    this.ver++;
    return S;
  }
  close(reason = 'end', dur = null) {
    const S = this.cur; if (!S) return null;
    S.end = reason; S.closedAt = Date.now();
    S.dur = dur ?? Math.max(1, S.last - S.t0);
    S.title = this.titleOf(S);
    // history must not pin the level's units (and their models) in memory
    for (const r of S.rows.values()) { r.dead = !!r.u?.dead; r.u = null; }
    S.sg.clear();
    this.cur = null; this.ver++;
    return S;
  }
  /** content finished (session 'clear' event): close the fight with the official time and remember the result */
  onClear(c = {}, r = {}) {
    let S = this.cur;
    if (!S && this.segs[0] && !this.segs[0].result && Date.now() - this.segs[0].closedAt < 20000) S = this.segs[0];
    if (!S) return null;
    if (this.cur === S) this.close(r.cleared ? 'clear' : 'wipe');
    if (r.time > 0) S.dur = r.time;
    S.result = { cleared: !!r.cleared, time: r.time || S.dur, name: r.name || '', kind: c.kind || '' };
    if (r.name) S.title = r.name;
    else if (c.kind === 'chaos') S.title = 'Chaos Dungeon';
    S.log.push({ t: S.dur, kind: r.cleared ? 'loot' : 'death', text: r.cleared ? `Cleared in ${clockS(S.dur)}` : 'The party wiped' });
    this.ver++;
    return S;
  }
  titleOf(S) {
    if (S.result?.name) return S.result.name;
    const bosses = [...S.bosses.values()].sort((a, b) => b.dmg - a.dmg);
    if (bosses.length >= 2 && bosses[1].dmg > bosses[0].dmg * 0.25) return `${bosses[0].name} & ${bosses[1].name}`;
    if (bosses.length) return bosses[0].name;
    const m = this.g?.mode;
    if (S.mode === 'chaos' && m) return `Demon Rift — Stage ${(m.stage ?? 0) + 1}`;
    if (S.mode === 'inferno' && m?.floor) return `Inferno — Floor ${m.floor}`;
    return S.zone ? `${S.zone} skirmish` : 'Skirmish';
  }
  reset() { this.segs = []; this.cur = null; this.ver++; }
  row(S, u) {
    let r = S.rows.get(u.id);
    if (!r) S.rows.set(u.id, r = { id: u.id, u, name: u.name, cls: u.cls, you: u === this.me(), support: isSupport(u.cls), dmg: 0, hits: 0, crits: 0, back: 0, head: 0, counters: 0, stagger: 0, heal: 0, shield: 0, taken: 0, deaths: 0, max: 0, bossDmg: 0 });
    return r;
  }
  skill(S, id, name) {
    let k = S.skills.get(id);
    if (!k) S.skills.set(id, k = { id, name: name || this.skillName(id), icon: this.skillIcon(id), dmg: 0, hits: 0, crits: 0, back: 0, head: 0, casts: 0, max: 0 });
    return k;
  }
  skillName(id) {
    const kit = this.g?.hero;
    if (id === 'basic') return 'Basic Attack';
    if (id === 'item') return 'Battle Items';
    if (id === 'boon') return 'Inferno Boons';
    if (id.startsWith('dot:')) return DOT[id.slice(4)] || 'Damage over Time';
    if (kit?.skills?.[id]?.name) return kit.skills[id].name;
    if (kit?.awaken?.id === id) return kit.awaken.name;
    const def = kit?.cls?.skills?.find(s => s.id === id); if (def?.name) return def.name;
    return pretty(id);
  }
  skillIcon(id) {
    const cls = this.g?.hero?.char?.cls || this.me()?.cls || 'reaver';
    if (id === 'basic') return 'skill:any:basic';
    if (id === 'item') return 'item:destruction_bomb';
    if (id === 'boon') return 'status:atk_up';
    if (id.startsWith('dot:')) return { fire: 'status:burn', bleed: 'status:bleed', poison: 'status:poison', lightning: 'status:shock', ice: 'status:freeze' }[id.slice(4)] || 'status:bleed';
    if (this.g?.hero?.awaken?.id === id) return `skill:${cls}:awakening`;
    return `skill:${cls}:${id}`;
  }
  log(kind, text, unit = null) {
    const S = this.cur; if (!S) return;
    S.log.push({ t: Math.max(0, this.L.time - S.t0), kind, text, you: !!unit && unit === this.me() });
    if (S.log.length > MAX_LOG) S.log.splice(0, S.log.length - MAX_LOG);
    this.ver++;
  }

  // ------------------------------------------------------------------------------------------------ events
  onDamage(ev) {
    if (!(ev.amount > 0) || ev.immune) return;
    const src = ev.src, tgt = ev.tgt; if (!tgt) return;
    if (this.ally(src) && tgt.team !== src.team && tgt.team !== 2) {
      const S = this.seg(), r = this.row(S, src), a = ev.amount;
      r.dmg += a; r.hits++; if (ev.crit) r.crits++; if (ev.back) r.back++; if (ev.head) r.head++; if (ev.counter) r.counters++;
      if (a > r.max) r.max = a;
      if (tgt.kind === 'boss') {
        r.bossDmg += a;
        let b = S.bosses.get(tgt.id); if (!b) S.bosses.set(tgt.id, b = { name: tgt.name, type: tgt.type, dmg: 0 });
        b.dmg += a;
        if (ev.killed) this.log('loot', `${tgt.name} falls to ${src.name}`, src);
      }
      // stagger: every dealDamage applies its stagger then emits, so the drop since the previous hit is this hit's
      const sg = tgt.data?.stagger;
      if (sg && sg.max > 0) {
        const p = S.sg.get(tgt.id), d = p && p.ref === sg ? p.v - sg.v : sg.max - sg.v;
        if (d > 0) r.stagger += d;
        S.sg.set(tgt.id, { ref: sg, v: sg.v });
      }
      if (src === this.me()) {
        const id = ev.dot ? 'dot:' + (ev.elem || 'bleed') : ev.skill || 'other';
        const k = this.skill(S, id);
        k.dmg += a; k.hits++; if (ev.crit) k.crits++; if (ev.back) k.back++; if (ev.head) k.head++; if (a > k.max) k.max = a;
        // the log keeps the fight's record-breaking hits of the local hero (not every hit)
        if (a > S.big) {
          if (!ev.dot && this.L.time - S.t0 > 6 && a > S.big * 1.15) this.log('dmg', `New biggest hit: ${short(a)}${ev.crit ? ' crit' : ''}${ev.back ? ' · back attack' : ev.head ? ' · head attack' : ''} — ${k.name}`, src);
          S.big = a;
        }
      }
      S.last = S.act = this.L.time;
      this.ver++;
    } else if (this.ally(tgt) && src !== tgt) {
      const S = src && src.team !== tgt.team ? this.seg() : this.cur; if (!S) return;
      this.row(S, tgt).taken += ev.amount + (ev.absorbed || 0);
      S.act = this.L.time;
    }
  }
  onDeath(ev) {
    const u = ev.unit, S = this.cur; if (!S || !u) return;
    if (this.ally(u)) { this.row(S, u).deaths++; this.log('death', `${u.name} was slain${ev.killer?.name ? ` by ${ev.killer.name}` : ''}`, u); }
  }
  onCast(ev) {
    const u = ev.unit, def = ev.def; if (!u || u !== this.me() || !def?.id || def.basic || def.id === 'dash') return;
    if (this.cur) { const k = this.skill(this.cur, def.id, def.name); k.casts++; }
    else { this.pending.push({ id: def.id, name: def.name, t: this.L.time }); if (this.pending.length > 8) this.pending.shift(); }
  }

  // ------------------------------------------------------------------------------------------------ frame
  update(dt) {
    const L = this.g?.level;
    if (L !== this.L) this.bind(L);
    const S = this.cur; if (!S || !L) return;
    // support uptime: share of ally-time spent under at least one of the support's buffs; Brand on bosses
    const party = this.members(), sups = party.filter(u => isSupport(u.cls));
    if (sups.length) {
      for (const s of sups) {
        let up = S.up.get(s.id); if (!up) S.up.set(s.id, up = { cov: 0, tot: 0, brand: 0 });
        for (const a of party) { if (a === s || a.dead) continue; up.tot += dt; if (a.statuses?.some(st => st.src === s && !st.def?.debuff)) up.cov += dt; }
      }
      let boss = false;
      for (const u of L.units) {
        if (u.kind !== 'boss' || u.dead) continue; boss = true;
        for (const st of u.statuses || []) if (st.id === 'brand' && st.src && sups.includes(st.src)) { S.up.get(st.src.id).brand += dt; break; }
      }
      if (boss) S.brandT += dt;
    }
    const m = this.g.mode, kind = m?.kind || '';
    if (kind === 'encounter' && (m.state === 'won' || m.state === 'lost')) { this.close(m.state === 'won' ? 'clear' : 'wipe', m.result?.time || null); return; }
    const idle = L.time - S.act;
    if ((OPEN_WORLD.has(kind) || !kind) && idle > 10) this.close('idle');
    else if (idle > 90) this.close('idle');
  }

  // ------------------------------------------------------------------------------------------------ views
  /** Full view of fight i (0 = live or latest): rows sorted by damage, the local hero's skills, the log. */
  view(i = 0) {
    const S = this.segs[i]; if (!S) return null;
    const live = S === this.cur;
    const dur = Math.max(1, live ? this.L.time - S.t0 : S.dur);
    const rows = [...S.rows.values()];
    const total = rows.reduce((a, r) => a + r.dmg, 0), sgTotal = rows.reduce((a, r) => a + r.stagger, 0);
    const out = rows.map(r => {
      const up = S.up.get(r.id);
      return { id: r.id, name: r.name, cls: r.cls, you: r.you, support: r.support, dead: r.u ? !!r.u.dead : !!r.dead, dmg: r.dmg, dps: r.dmg / dur, share: total ? r.dmg / total : 0,
        crit: r.hits ? r.crits / r.hits : 0, back: r.hits ? r.back / r.hits : 0, head: r.hits ? r.head / r.hits : 0, counters: r.counters, stagger: r.stagger,
        staggerShare: sgTotal ? r.stagger / sgTotal : 0, heal: r.heal, shield: r.shield, taken: r.taken, deaths: r.deaths, max: r.max, hits: r.hits,
        uptime: up && up.tot > 0 ? up.cov / up.tot : null, brand: up && S.brandT > 0 ? up.brand / S.brandT : null };
    }).sort((a, b) => b.dmg - a.dmg || a.name.localeCompare(b.name));
    const sk = [...S.skills.values()], skTotal = sk.reduce((a, k) => a + k.dmg, 0);
    const skills = sk.filter(k => k.dmg > 0 || k.casts > 0).map(k => ({ id: k.id, name: k.name, icon: k.icon, dmg: k.dmg, share: skTotal ? k.dmg / skTotal : 0, dps: k.dmg / dur,
      crit: k.hits ? k.crits / k.hits : 0, back: k.hits ? k.back / k.hits : 0, head: k.hits ? k.head / k.hits : 0, hits: k.hits, casts: k.casts, max: k.max })).sort((a, b) => b.dmg - a.dmg);
    return { index: i, count: this.segs.length, live, title: live ? this.titleOf(S) : S.title, zone: S.zone, dur, total, dps: total / dur, rows: out, skills, log: S.log.slice(), result: S.result, end: S.end, ver: this.ver };
  }
  /** The UI owner's 'meter' window data (src/ui/windows/meter.js), pushed ~2×/s while it is open. */
  windowData(i = 0) {
    const v = this.view(i);
    if (!v) return { title: 'No fight yet', time: 0, rows: [], skills: [], log: [] };
    return { title: v.title, time: v.dur,
      rows: v.rows.map(r => ({ name: r.name, cls: r.cls, dmg: r.dmg, dps: r.dps, you: r.you, support: r.support, dead: r.dead, crit: r.crit, back: r.back, counters: r.counters, stagger: r.staggerShare, heal: r.heal, shield: r.shield })),
      skills: v.skills.map(k => ({ id: k.id, name: k.name, icon: k.icon, dmg: k.dmg, hits: k.hits, crit: k.crit })),
      log: v.log.map(l => ({ t: l.t, text: l.text, kind: l.kind === 'loot' ? 'loot' : l.kind })) };
  }
  /** Support metrics of a unit in the latest fight (for the Top Support board). */
  supportOf(unitName) {
    const v = this.view(0); const r = v?.rows.find(x => x.name === unitName); if (!r) return null;
    const taken = v.rows.reduce((a, x) => a + x.taken, 0);
    return { uptime: r.uptime, brand: r.brand, shield: r.shield, heal: r.heal, taken, stagger: r.staggerShare };
  }
}

// ================================================================================================== the panel
const TABS = [{ id: 'dmg', label: 'Damage' }, { id: 'sup', label: 'Support' }, { id: 'skills', label: 'Skills' }, { id: 'log', label: 'Log' }];
export class MeterPanel {
  constructor(meta) {
    this.meta = meta; this.meter = meta.meter; this.el = null; this.isOpen = false; this.sel = 0; this.sig = '';
    const st = db().ui.meter || {}; this.tab = TABS.some(t => t.id === st.tab) ? st.tab : 'dmg';
  }
  build() {
    const layer = this.meta.ui.layer(); if (!layer) return null;
    const el = this.el = document.createElement('section');
    el.className = 'ss-mx-meter ss-panel ss-orn ss-ptr';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Combat meter');
    el.innerHTML = `<header class="ss-mx-mh"><i class="ss-mx-mi">${glyph('bolt')}</i><b>Combat Meter</b>
      <nav class="ss-mx-seg"><button type="button" data-a="prev" aria-label="Older fight">${glyph('left')}</button><span></span><button type="button" data-a="next" aria-label="Newer fight">${glyph('right')}</button></nav>
      <button type="button" class="ss-close" data-a="reset" aria-label="Reset meter" title="Reset">${glyph('refresh')}</button><button type="button" class="ss-close" data-a="close" aria-label="Close meter">${glyph('close')}</button></header>
      <div class="ss-tabs ss-mx-tabs">${TABS.map(t => `<button type="button" class="ss-tab" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
      <div class="ss-mx-sum"></div><div class="ss-mx-body ss-scroll"></div>
      <footer class="ss-mx-foot"><span><span class="ss-kbd">\`</span> toggle</span><span><span class="ss-kbd">Y</span> compact meter</span><span class="ss-mx-drag">drag the title to move</span></footer>`;
    layer.appendChild(el);
    this.segEl = el.querySelector('.ss-mx-seg span'); this.sum = el.querySelector('.ss-mx-sum'); this.body = el.querySelector('.ss-mx-body');
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { this.tab = b.dataset.tab; (db().ui.meter ||= {}).tab = this.tab; saveDb(); this.sig = ''; this.render(); return; }
      const a = b.dataset.a;
      if (a === 'close') this.close();
      else if (a === 'reset') { this.meter.reset(); this.sel = 0; this.sig = ''; this.render(); }
      else if (a === 'prev') { this.sel = Math.min(this.meter.segs.length - 1, this.sel + 1); this.sig = ''; this.render(); }
      else if (a === 'next') { this.sel = Math.max(0, this.sel - 1); this.sig = ''; this.render(); }
    });
    this.drag(el.querySelector('.ss-mx-mh'));
    return el;
  }
  drag(handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, id = null;
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      id = e.pointerId; handle.setPointerCapture(id); sx = e.clientX; sy = e.clientY; ox = this.x; oy = this.y; e.preventDefault();
    });
    handle.addEventListener('pointermove', e => { if (e.pointerId !== id) return; const s = this.meta.ui.scale(); this.place(ox + (e.clientX - sx) / s, oy + (e.clientY - sy) / s); });
    const end = e => { if (e.pointerId !== id) return; id = null; (db().ui.meter ||= {}).pos = { x: this.x, y: this.y }; saveDb(); };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  }
  place(x, y) {
    const { w, h } = this.meta.ui.size();
    const ew = this.el.offsetWidth || 470;
    this.x = Math.round(Math.max(40 - ew, Math.min(w - 40, x))); this.y = Math.round(Math.max(0, Math.min(h - 40, y)));
    this.el.style.left = this.x + 'px'; this.el.style.top = this.y + 'px';
    this.el.style.maxHeight = Math.max(200, Math.min(470, h - this.y - 12)) + 'px';   // long tabs scroll instead of leaving the screen
  }
  open() {
    if (!this.el && !this.build()) return;
    this.el.style.display = ''; this.isOpen = true; this.sel = 0; this.sig = '';
    const p = db().ui.meter?.pos;
    const { w, h } = this.meta.ui.size(), touch = !!this.meta.ui.ui?.touch;
    if (p && !touch) this.place(p.x, p.y);
    else if (touch) { this.place(12, 52); this.el.style.maxHeight = Math.max(160, h - 52 - 200) + 'px'; }   // clear of the stick and skill cluster
    else this.place(w - 474 - 16, 452);   // right side, under the quest tracker
    this.render();
  }
  close() { if (this.el) this.el.style.display = 'none'; this.isOpen = false; }
  toggle() { this.isOpen ? this.close() : this.open(); return this.isOpen; }
  /** re-render (cheap: skipped when nothing changed; live fights refresh their clock ~4×/s) */
  render() {
    if (!this.isOpen || !this.el) return;
    const v = this.meter.view(this.sel);
    const sig = `${this.tab}|${this.sel}|${v ? v.ver : -1}|${v?.live ? Math.floor(v.dur * 2) : ''}`;
    if (sig === this.sig) return; this.sig = sig;
    this.el.querySelectorAll('.ss-tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === this.tab));
    const segs = this.meter.segs.length;
    this.el.querySelector('[data-a="prev"]').disabled = this.sel >= segs - 1;
    this.el.querySelector('[data-a="next"]').disabled = this.sel <= 0;
    if (!v) {
      this.segEl.textContent = 'No fight yet';
      this.sum.innerHTML = '<span>Hit something — the meter starts with the first blow.</span>';
      this.body.innerHTML = `<div class="ss-mx-empty">${glyph('bolt')}<b>Waiting for combat</b><span>Damage, crits, back attacks, counters, stagger, shields and heals for everyone in your party, and a skill breakdown for you.</span></div>`;
      return;
    }
    this.segEl.innerHTML = `${esc(v.title)} <em>${v.live ? '<i class="ss-mx-live">LIVE</i>' : segs > 1 ? `${this.sel + 1}/${segs}` : ''}</em>`;
    const res = v.result ? (v.result.cleared ? '<b class="ss-mx-ok">Cleared</b>' : '<b class="ss-mx-bad">Wiped</b>') : '';
    this.sum.innerHTML = `<span>${glyph('clock')} ${clockS(v.dur)}</span><span><b>${short(v.dps)}</b> party DPS</span><span><b>${short(v.total)}</b> total</span>${res}`;
    const top = v.rows[0]?.dmg || 1;
    const crest = c => `<i class="ss-mx-cr" style="background-image:url('${iconUrl('class:' + c, 18)}')"></i>`;
    const who = r => `${crest(r.cls)}<b>${esc(r.name)}</b>${r.support ? `<em class="ss-mx-sp">${glyph('cross')}</em>` : ''}${r.deaths ? `<s>${glyph('skull')}${r.deaths}</s>` : ''}`;
    let html = '';
    if (this.tab === 'dmg') {
      html = `<div class="ss-mx-tr ss-mx-th ss-mx-c-dmg"><span>#</span><span>Name</span><span>Damage</span><span>DPS</span><span>%</span><span>Crit</span><span title="Back / head attack hits">B/H</span><span title="Counters">★</span></div>` +
        v.rows.map((r, i) => `<div class="ss-mx-tr ss-mx-c-dmg${r.you ? ' is-you' : ''}${r.dead ? ' is-dead' : ''}" style="--cc:${clsInfo(r.cls).color}"><u style="width:${(r.dmg / top * 100).toFixed(1)}%"></u>
          <span class="ss-mx-n">${i + 1}</span><span class="ss-mx-who">${who(r)}</span><span>${short(r.dmg)}</span><span>${short(r.dps)}</span><span>${pct(r.share, 1)}</span><span>${pct(r.crit)}</span><span>${pct(r.back + r.head)}</span><span>${r.counters || '·'}</span></div>`).join('');
    } else if (this.tab === 'sup') {
      html = `<div class="ss-mx-tr ss-mx-th ss-mx-c-sup"><span>Name</span><span>Shield</span><span>Heal</span><span title="Allies carrying this player’s buffs">Uptime</span><span title="Brand on the boss">Brand</span><span title="Share of stagger dealt">Stag.</span><span title="Damage taken">Taken</span></div>` +
        [...v.rows].sort((a, b) => (b.shield + b.heal) - (a.shield + a.heal) || b.staggerShare - a.staggerShare).map(r => `<div class="ss-mx-tr ss-mx-c-sup${r.you ? ' is-you' : ''}${r.dead ? ' is-dead' : ''}" style="--cc:${clsInfo(r.cls).color}">
          <span class="ss-mx-who">${who(r)}</span><span>${r.shield ? short(r.shield) : '·'}</span><span>${r.heal ? short(r.heal) : '·'}</span><span>${r.uptime != null ? pct(r.uptime) : '·'}</span><span>${r.brand != null ? pct(r.brand) : '·'}</span><span>${r.staggerShare ? pct(r.staggerShare) : '·'}</span><span>${short(r.taken)}</span></div>`).join('');
    } else if (this.tab === 'skills') {
      const sk = v.skills, stop = sk[0]?.dmg || 1;
      html = sk.length ? `<div class="ss-mx-tr ss-mx-th ss-mx-c-sk"><span></span><span>Skill</span><span>Damage</span><span>%</span><span>DPS</span><span>Crit</span><span title="Hits / casts">Hits</span><span>Max</span></div>` +
        sk.map(k => `<div class="ss-mx-tr ss-mx-c-sk"><u style="width:${(k.dmg / stop * 100).toFixed(1)}%"></u><i class="ss-mx-ic" style="background-image:url('${iconUrl(k.icon, 22)}')"></i><span class="ss-mx-who"><b>${esc(k.name)}</b></span>
          <span>${short(k.dmg)}</span><span>${pct(k.share, 1)}</span><span>${short(k.dps)}</span><span>${pct(k.crit)}</span><span>${int(k.hits)}${k.casts ? `<small>/${k.casts}</small>` : ''}</span><span>${short(k.max)}</span></div>`).join('')
        : '<div class="ss-mx-empty"><b>No skill data</b><span>Your own skills are broken down here once you deal damage.</span></div>';
    } else {
      const log = v.log.slice(-160);
      html = log.length ? log.map(l => `<div class="ss-mx-log is-${esc(l.kind)}${l.you ? ' is-you' : ''}"><span>${clockS(l.t)}</span><p>${esc(l.text)}</p></div>`).join('')
        : '<div class="ss-mx-empty"><b>Quiet so far</b><span>Counters, stagger and part breaks, mechanics, awakenings, deaths and record hits appear here.</span></div>';
    }
    const stick = this.tab === 'log' && this.body.scrollTop + this.body.clientHeight >= this.body.scrollHeight - 30;
    this.body.innerHTML = html;
    if (stick) this.body.scrollTop = this.body.scrollHeight;
  }
}
