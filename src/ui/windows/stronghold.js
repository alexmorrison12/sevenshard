// Stronghold (Brightwater Isle): level, action energy, Buildings, Research, Workshop crafting queue, Dispatch missions.
// Timers count down locally between updates.
//   data: { level, xp, xpMax, energy: { now, max, perHour },
//     buildings: [{ id, name, level, max, desc, effect, next?: { cost: [{ name, icon, grade, need, have }], time, req?, can }, upgrading?: { left, total } }],
//     research: [{ id, name, desc, tier, time, cost?: [rows], state: 'locked'|'available'|'active'|'done', left?, total?, req? }],
//     craft: { slots, queue: [{ id, name, icon, grade, qty, left, total }], recipes: [{ id, name, icon, grade, time, out?, cost: [rows], can }] },
//     dispatch: { slots, crew: [{ id, name, role, power, busy }], missions: [{ id, name, time, chance, power, rewards: [{ name, icon, grade, count }], can }],
//                 active: [{ id, name, left, total }] },
//     garden?: { level, ready: [Row { name, icon, grade, count }] }, ranch?: { level, pets: [id], slots } }   (times in seconds)
// Actions: sh:upgrade { id } · sh:research { id } · sh:craft { id, qty } · sh:cancel { id } · sh:collect {} ·
//          sh:dispatch { id } · sh:claim { id } · sh:garden {} · sh:ranch {} · sh:recruit { pay: 'contract'|'silver' } ·
//          sh:rush { kind: 'research'|'craft'|'dispatch', id }  (finish now: 1 crystal per started 10 min)
import { h, btn, esc, fmtInt, fmtClock, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl, itemIcon } from '../core/icon.js';
import { slot, tabs } from '../core/kit.js';
import { Win } from '../core/windows.js';

const BG = { manor: 'stronghold', workshop: 'anvil', research: 'tome', barracks: 'users', garden: 'leaf', ranch: 'heart', dock: 'anchor' };
const costRow = c => `<span class="ss-shc${(c.have ?? Infinity) < (c.need || 0) ? ' is-short' : ''}"><i style="background-image:url('${c.icon && c.icon.startsWith('currency:') ? iconUrl(c.icon, 16) : itemIcon(c.icon || 'item:' + c.id, 16)}')"></i>${fmtInt(c.need || c.count || 0)}</span>`;

export class StrongholdWin extends Win {
  static id = 'stronghold'; static title = 'Stronghold'; static glyph = 'stronghold'; static width = 960;
  build() {
    const b = this.body; b.classList.add('ss-shw');
    this.hdr = h('div', 'ss-shw-hd', b);
    this.tab = 'buildings';
    this.tabs = tabs(b, [{ id: 'buildings', label: 'Buildings' }, { id: 'research', label: 'Research' }, { id: 'workshop', label: 'Workshop' }, { id: 'dispatch', label: 'Dispatch' }], this.tab, id => { this.tab = id; this.render(this.d); });
    this.pane = h('div', 'ss-shw-pane ss-scroll', b);
    this.timers = [];
  }
  shown() { clearInterval(this._iv); this._iv = setInterval(() => this.tick(), 1000); }
  hidden() { clearInterval(this._iv); }
  timer(el, left, total) { this.timers.push({ el, left, total }); }
  /** "Finish now" for a running job: 1 crystal per started 10 minutes. */
  rushBtn(parent, kind, id, left) {
    if (!(left > 0)) return null;
    const n = Math.max(1, Math.ceil(left / 600));
    const b = btn('ss-btn ss-btn--sm ss-btn--ghost ss-shw-rush', parent, null, () => this.ui.emit('sh:rush', { kind, id }), `Finish now for ${n} crystals`);
    b.innerHTML = `${glyph('bolt')}<i style="background-image:url('${iconUrl('currency:crystal', 14)}')"></i><b>${fmtInt(n)}</b>`;
    b._tip = { title: 'Finish now', lines: [`${fmtInt(n)} crystals (1 per started 10 minutes)`] };
    return b;
  }
  tick() {
    const el = (performance.now() - this.t0) / 1000;
    for (const t of this.timers) {
      const l = Math.max(0, t.left - el);
      t.el.querySelector('.t').textContent = l > 0 ? fmtClock(l) : 'Done';
      const f = t.el.querySelector('i'); if (f && t.total) f.style.transform = `scaleX(${Math.min(1, 1 - l / t.total).toFixed(4)})`;
      t.el.classList.toggle('is-done', l <= 0);
    }
  }
  render(d) {
    this.d = d = d || {}; this.t0 = performance.now(); this.timers = [];
    const e = d.energy || {};
    this.hdr.innerHTML = `<div class="ss-shw-emb">${glyph('stronghold')}</div><div class="ss-shw-id"><b>Brightwater Isle</b><span>Stronghold Level ${d.level || 1}</span>
      <div class="ss-shw-xp"><i style="transform:scaleX(${d.xpMax ? Math.min(1, (d.xp || 0) / d.xpMax) : 1})"></i></div></div>
      <div class="ss-shw-en"><span>Action Energy</span><b>${fmtInt(e.now || 0)}<em>/ ${fmtInt(e.max || 0)}</em></b>${e.perHour ? `<small>+${e.perHour}/h</small>` : ''}</div>`;
    const P = this.pane; clear(P);
    this[this.tab](P, d);
    this.tick();
  }
  buildings(P, d) {
    const g = h('div', 'ss-shw-grid', P);
    for (const b of d.buildings || []) {
      const c = h('div', 'ss-shw-b' + (b.level ? '' : ' is-unbuilt'), g);
      c.innerHTML = `<div class="ss-shw-bh"><i>${glyph(BG[b.id] || 'stronghold')}</i><div><b>${esc(b.name)}</b><span>Level ${b.level} / ${b.max}</span></div></div>
        <p>${esc(b.desc || '')}</p>${b.effect ? `<div class="ss-shw-eff">${glyph('sparkle')} ${esc(b.effect)}</div>` : ''}`;
      if (b.upgrading) { const t = h('div', 'ss-shw-timer', c); t.innerHTML = `<span>Upgrading</span><b class="t"></b><s><i></i></s>`; this.timer(t, b.upgrading.left, b.upgrading.total); }
      else if (b.next) {
        const n = h('div', 'ss-shw-next', c);
        n.innerHTML = `<div class="ss-shw-cost">${(b.next.cost || []).map(costRow).join('')}${b.next.time ? `<span class="ss-shc">${glyph('clock')}${fmtClock(b.next.time)}</span>` : ''}</div>${b.next.req ? `<em>${esc(b.next.req)}</em>` : ''}`;
        const u = btn('ss-btn ss-btn--sm ss-btn--primary', n, b.level ? 'Upgrade' : 'Build', () => this.ui.emit('sh:upgrade', { id: b.id }));
        u.disabled = !b.next.can;
      } else if (b.level >= b.max) h('div', 'ss-shw-max', c, 'Max level');
      // yields: garden harvest, pet ranch forage
      if (b.id === 'garden' && b.level > 0) {
        const ready = d.garden?.ready || [], y = h('div', 'ss-shw-yield', c);
        const rw = h('div', 'ss-shw-rw', y);
        for (const x of ready.slice(0, 5)) rw.appendChild(slot({ ...x, kind: x.kind || 'material' }, { size: 30 }));
        if (!ready.length) h('span', 'ss-shw-yt', rw, 'Nothing has grown yet');
        btn('ss-btn ss-btn--sm', y, 'Harvest', () => this.ui.emit('sh:garden', {})).disabled = !ready.length;
      }
      if (b.id === 'ranch' && b.level > 0) {
        const rc = d.ranch || {}, pets = (rc.pets || []).length, y = h('div', 'ss-shw-yield', c);
        h('span', 'ss-shw-yt', y, `${pets} / ${rc.slots || 0} pets stationed`);
        btn('ss-btn ss-btn--sm', y, 'Collect', () => this.ui.emit('sh:ranch', {})).disabled = !pets;
      }
    }
  }
  research(P, d) {
    const tiers = [...new Set((d.research || []).map(r => r.tier || 1))].sort((a, b) => a - b);
    for (const t of tiers) {
      h('div', 'ss-h', P, `Tier ${t}`);
      const g = h('div', 'ss-shw-rg', P);
      for (const r of (d.research || []).filter(x => (x.tier || 1) === t)) {
        const c = h('div', `ss-shw-r is-${r.state || 'locked'}`, g);
        c.innerHTML = `<div class="ss-shw-rh"><b>${esc(r.name)}</b>${r.state === 'done' ? glyph('check') : r.state === 'locked' ? glyph('lock') : ''}</div><p>${esc(r.desc || '')}</p>`;
        if (r.state === 'active') { const tm = h('div', 'ss-shw-timer', c); tm.innerHTML = `<span>Researching</span><b class="t"></b><s><i></i></s>`; this.timer(tm, r.left || 0, r.total || r.time); this.rushBtn(c, 'research', r.id, r.left); }
        else if (r.state === 'available') {
          const n = h('div', 'ss-shw-next', c);
          n.innerHTML = `<div class="ss-shw-cost">${(r.cost || []).map(costRow).join('')}${r.time ? `<span class="ss-shc">${glyph('clock')}${fmtClock(r.time)}</span>` : ''}</div>`;
          btn('ss-btn ss-btn--sm ss-btn--primary', n, 'Research', () => this.ui.emit('sh:research', { id: r.id }));
        } else if (r.state === 'locked' && r.req) h('em', 'ss-shw-req', c, r.req);
      }
    }
    if (!tiers.length) h('div', 'ss-empty', P, 'Build a Research Hall to unlock research.');
  }
  workshop(P, d) {
    const cr = d.craft || {};
    const q = h('div', 'ss-shw-queue', P);
    h('div', 'ss-h', q, `Crafting Queue · ${(cr.queue || []).length}/${cr.slots || 0}`);
    const ql = h('div', 'ss-shw-ql', q);
    for (let i = 0; i < (cr.slots || 0); i++) {
      const j = (cr.queue || [])[i];
      const s = h('div', 'ss-shw-qs' + (j ? '' : ' is-free'), ql);
      if (j) {
        s.appendChild(slot({ ...j, kind: 'battle', count: j.qty }, { size: 44 }));
        const t = h('div', 'ss-shw-timer sm', s); t.innerHTML = `<b class="t"></b><s><i></i></s>`; this.timer(t, j.left, j.total);
        this.rushBtn(s, 'craft', j.id, j.left);
        const x = btn('ss-close', s, null, () => this.ui.emit('sh:cancel', { id: j.id }), `Cancel ${j.name}`); x.innerHTML = glyph('close');
      } else h('span', '', s, 'Free slot');
    }
    const col = btn('ss-btn ss-btn--sm', q, 'Collect Finished', () => this.ui.emit('sh:collect', {}));
    col.disabled = !(cr.queue || []).some(j => j.left <= 0);
    h('div', 'ss-h', P, 'Recipes');
    const rl = h('div', 'ss-shw-recipes', P);
    for (const r of cr.recipes || []) {
      const c = h('div', 'ss-shw-rec', rl);
      c.appendChild(slot({ ...r, kind: 'battle', count: r.out }, { size: 44 }));
      h('div', 'ss-shw-rt', c).innerHTML = `<b>${esc(r.name)}</b><div class="ss-shw-cost">${(r.cost || []).map(costRow).join('')}${r.time ? `<span class="ss-shc">${glyph('clock')}${fmtClock(r.time)}</span>` : ''}</div>`;
      const b = btn('ss-btn ss-btn--sm ss-btn--primary', c, 'Craft', () => this.ui.emit('sh:craft', { id: r.id, qty: 1 }));
      b.disabled = !r.can || (cr.queue || []).length >= (cr.slots || 0);
    }
  }
  dispatch(P, d) {
    const dp = d.dispatch || {};
    const top = h('div', 'ss-shw-crew', P);
    const ch = h('div', 'ss-shw-crewh', top);
    h('div', 'ss-h', ch, `Crew · ${(dp.active || []).length}/${dp.slots || 0} missions running`);
    btn('ss-btn ss-btn--sm', ch, 'Hire · Crew Contract', () => this.ui.emit('sh:recruit', { pay: 'contract' }));
    const hs = btn('ss-btn ss-btn--sm', ch, null, () => this.ui.emit('sh:recruit', { pay: 'silver' }), 'Hire for 30,000 silver');
    hs.innerHTML = `Hire · <i class="ss-shw-ci" style="background-image:url('${iconUrl('currency:silver', 14)}')"></i>30,000`;
    const cl = h('div', 'ss-shw-cl', top);
    for (const m of dp.crew || []) { const c = h('div', 'ss-shw-cm' + (m.busy ? ' is-busy' : ''), cl); c.innerHTML = `<i>${glyph('character')}</i><div><b>${esc(m.name)}</b><span>${esc(m.role)} · Power ${m.power}</span></div>${m.busy ? '<em>Away</em>' : ''}`; }
    if ((dp.active || []).length) {
      h('div', 'ss-h', P, 'Under Way');
      for (const a of dp.active) {
        const r = h('div', 'ss-shw-act', P);
        r.innerHTML = `<b>${esc(a.name)}</b>`;
        const t = h('div', 'ss-shw-timer', r); t.innerHTML = `<b class="t"></b><s><i></i></s>`; this.timer(t, a.left, a.total);
        this.rushBtn(r, 'dispatch', a.id, a.left);
        const c = btn('ss-btn ss-btn--sm ss-btn--primary', r, 'Claim', () => this.ui.emit('sh:claim', { id: a.id })); c.disabled = a.left > 0;
      }
    }
    h('div', 'ss-h', P, 'Missions');
    for (const m of dp.missions || []) {
      const r = h('div', 'ss-shw-mis', P);
      r.innerHTML = `<div><b>${esc(m.name)}</b><span>${glyph('clock')} ${fmtClock(m.time || 0)} · Power ${m.power || 0} · ${Math.round((m.chance ?? 1) * 100)}% success</span></div>`;
      const rw = h('div', 'ss-shw-rw', r);
      for (const x of m.rewards || []) rw.appendChild(slot({ ...x, kind: x.kind || 'material' }, { size: 34 }));
      const b = btn('ss-btn ss-btn--sm ss-btn--primary', r, 'Dispatch', () => this.ui.emit('sh:dispatch', { id: m.id }));
      b.disabled = !m.can;
    }
  }
}
