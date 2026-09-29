// Event Compass (H): today's schedule — field bosses, chaos gates, adventure islands, ghost ships… with a 24-hour
// timeline, live countdowns, track and go.
//   data: { events: [{ id, name, kind, where?, iLvl?, times?: [minutes after local midnight], dur?: minutes,
//                      next?: seconds until next start, active?: bool, left?: seconds left when active,
//                      rewards?: [{ name, icon, grade, count? }], icon? }], tracked?: [ids] }
//   kinds: field_boss chaos_gate adventure_island ghost_ship sea_bounty pvp guild
// Actions: compass:track { id, on } · compass:go { id }
import { h, btn, esc, fmtClock, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { slot } from '../core/kit.js';
import { Win } from '../core/windows.js';

const KIND = {
  field_boss: { name: 'Field Boss', c: '#ff7a5a', g: 'crown', icon: 'boss:thunderhoof' },
  chaos_gate: { name: 'Chaos Gate', c: '#b47aff', g: 'flame', icon: 'boss:gatekeeper' },
  adventure_island: { name: 'Adventure Island', c: '#5fe0c8', g: 'anchor', icon: 'item:island_soul' },
  ghost_ship: { name: 'Ghost Ship', c: '#8fb8ff', g: 'ship', icon: 'boss:deep_oracle' },
  sea_bounty: { name: 'Sea Bounty', c: '#5fb2ff', g: 'ship', icon: 'item:sea_bounty' },
  pvp: { name: 'Proving Grounds', c: '#ff9a4a', g: 'sword', icon: 'ui:pvp' },
  guild: { name: 'Guild', c: '#86e070', g: 'guild', icon: 'ui:guild' },
};

export class CompassWin extends Win {
  static id = 'compass'; static title = 'Event Compass'; static glyph = 'compass'; static width = 640;
  build() {
    const b = this.body;
    b.classList.add('ss-cp2');
    this.hdr = h('div', 'ss-ec-hd', b);
    this.tl = h('div', 'ss-ec-tl', b);
    this.list = h('div', 'ss-ec-list ss-scroll', b);
  }
  shown() { clearInterval(this._iv); this._iv = setInterval(() => this.tick(), 1000); }
  hidden() { clearInterval(this._iv); }
  render(d) {
    this.d = d; this.t0 = performance.now();
    this.tracked = new Set(d.tracked || this.tracked || []);
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    this.hdr.innerHTML = `<div><b>Today</b><span>${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span></div><div class="ss-ec-clock">${glyph('clock')}<b>${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}</b></div>`;
    // timeline
    clear(this.tl);
    const bar = h('div', 'ss-ec-bar', this.tl);
    for (let hh = 0; hh <= 24; hh += 3) { const t = h('span', 'ss-ec-hr', this.tl, String(hh).padStart(2, '0')); t.style.left = (hh / 24 * 100) + '%'; }
    for (const e of d.events || []) for (const m of e.times || []) {
      const k = KIND[e.kind] || {}; const p = h('i', 'ss-ec-pip ss-ptr', bar);
      p.style.left = (m / 1440 * 100) + '%'; p.style.setProperty('--c', k.c || '#c9a45a');
      if (m < mins) p.classList.add('is-past');
      p._tip = { title: e.name, lines: [`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, e.where] };
    }
    const needle = h('b', 'ss-ec-now', bar); needle.style.left = (mins / 1440 * 100) + '%';
    // list: soonest first
    const ev = (d.events || []).map(e => ({ e, next: this.nextOf(e, mins) })).sort((a, b) => (b.e.active ? 1 : 0) - (a.e.active ? 1 : 0) || a.next - b.next);
    clear(this.list);
    this.rows = [];
    for (const { e } of ev) {
      const k = KIND[e.kind] || { name: e.kind, c: '#c9a45a', g: 'star' };
      const r = h('div', 'ss-ec-row' + (e.active ? ' is-active' : ''), this.list);
      r.style.setProperty('--c', k.c);
      r.innerHTML = `<i class="ss-ec-ic" style="background-image:url('${iconUrl(e.icon || k.icon, 44)}')"></i>
        <div class="ss-ec-tx"><span class="ss-ec-kind">${glyph(k.g)}${esc(k.name)}</span><b>${esc(e.name)}</b><span class="ss-ec-where">${esc(e.where || '')}${e.iLvl ? ` · iLvl ${e.iLvl}` : ''}</span></div>
        <div class="ss-ec-time"><em></em><span></span></div>`;
      const rw = h('div', 'ss-ec-rw', r);
      for (const x of (e.rewards || []).slice(0, 4)) rw.appendChild(slot({ ...x, kind: x.kind || 'material' }, { size: 30 }));
      const acts = h('div', 'ss-ec-acts', r);
      const tr = btn('ss-btn ss-btn--sm ss-btn--icon' + (this.tracked.has(e.id) ? ' is-on' : ''), acts, null, () => { const on = !this.tracked.has(e.id); if (on) this.tracked.add(e.id); else this.tracked.delete(e.id); tr.classList.toggle('is-on', on); this.ui.emit('compass:track', { id: e.id, on }); }, `Track ${e.name}`);
      tr.innerHTML = glyph('pin'); tr._tip = { title: 'Track', lines: ['Get a reminder before it starts.'] };
      btn('ss-btn ss-btn--sm', acts, 'Go', () => this.ui.emit('compass:go', { id: e.id }), `Travel to ${e.name}`);
      this.rows.push({ e, el: r, em: r.querySelector('.ss-ec-time em'), sp: r.querySelector('.ss-ec-time span') });
    }
    if (!ev.length) h('div', 'ss-empty', this.list, 'No events scheduled today.');
    this.tick();
  }
  nextOf(e, mins) {
    if (e.next != null) return e.next;
    const ts = (e.times || []).map(m => m - mins).map(x => x < 0 ? x + 1440 : x);
    return ts.length ? Math.min(...ts) * 60 : Infinity;
  }
  tick() {
    if (!this.rows) return;
    const el = (performance.now() - this.t0) / 1000;
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    for (const r of this.rows) {
      const e = r.e;
      if (e.active) { r.em.textContent = 'Active'; r.sp.textContent = e.left != null ? fmtClock(Math.max(0, e.left - el)) + ' left' : 'Now'; continue; }
      const n = e.next != null ? Math.max(0, e.next - el) : this.nextOf(e, mins);
      r.em.textContent = n === Infinity ? '—' : n < 60 ? 'Starting' : 'Starts in';
      r.sp.textContent = n === Infinity ? '' : fmtClock(n);
      r.el.classList.toggle('is-soon', n < 300);
    }
  }
}
