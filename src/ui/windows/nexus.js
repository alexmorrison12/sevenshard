// Rift Nexus: the content selector. Categories (Chaos Dungeon, Guardian Hunt, Abyssal Dungeon, Legion Raid,
// Inferno Descent…), content list with item-level gates, detail with gates, difficulty (normal / hard / trial),
// party size + AI fill, rewards, Enter.
//   data: { iLvl, cats?: [{ id, label }], selected?,
//           content: [{ id, cat, name, sub?, iLvl, players?: '1–4', icon?, desc?, locked?: string, cleared?: bool, note?,
//                       modes?: [{ id: 'normal'|'hard'|'trial', label, iLvl? }], gates?: [{ name, boss?, icon?, cleared? }],
//                       rewards?: [{ id?, name, icon, grade, count? }] }],
//           party?: { size, members: [{ name, cls }] }, aiFill?: true }
// Actions: nexus:select { id } · nexus:enter { id, mode, gate, aiFill }
import { h, btn, esc, fmt2, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { slot, seg, toggle, vtabs } from '../core/kit.js';
import { cls as clsInfo } from '../core/data.js';
import { Win } from '../core/windows.js';

const CATS = { chaos: 'Chaos Dungeon', guardian: 'Guardian Hunt', abyss: 'Abyssal Dungeon', raid: 'Legion Raid', inferno: 'Inferno Descent', event: 'Events', pvp: 'Proving Grounds' };
const CAT_G = { chaos: 'flame', guardian: 'target', abyss: 'anchor', raid: 'crown', inferno: 'flame', event: 'star', pvp: 'sword' };

export class NexusWin extends Win {
  static id = 'nexus'; static title = 'Rift Nexus'; static glyph = 'compass'; static width = 1080;
  build() {
    const b = this.body;
    b.classList.add('ss-nx');
    this.cats = h('div', 'ss-nx-cats', b);
    this.list = h('div', 'ss-nx-list ss-scroll', b);
    this.det = h('div', 'ss-nx-det', b);
    this.cat = null; this.sel = null; this.mode = 'normal'; this.gate = 0; this.aiFill = true;
  }
  render(d) {
    this.d = d;
    const content = d.content || [];
    const catIds = d.cats ? d.cats.map(c => c.id) : [...new Set(content.map(c => c.cat))];
    if (!this.cat || !catIds.includes(this.cat)) this.cat = (content.find(c => c.id === d.selected) || content[0] || {}).cat || catIds[0];
    if (d.aiFill != null && this._aiInit !== true) { this.aiFill = d.aiFill; this._aiInit = true; }
    clear(this.cats);
    const il = h('div', 'ss-nx-il', this.cats);
    il.innerHTML = `<span>Your Item Level</span><b>${fmt2(d.iLvl || 0)}</b>`;
    vtabs(this.cats, catIds.map(id => ({ id, label: (d.cats || []).find(c => c.id === id)?.label || CATS[id] || id, glyph: glyph(CAT_G[id] || 'star'), count: content.filter(c => c.cat === id).length })), this.cat, id => { this.cat = id; this.sel = null; this.render(this.d); });
    // list
    clear(this.list);
    const list = content.filter(c => c.cat === this.cat);
    if (!this.sel || !list.find(c => c.id === this.sel)) this.sel = (list.find(c => c.id === d.selected) || list.find(c => !c.locked) || list[0])?.id;
    for (const c of list) {
      const locked = !!c.locked || (c.iLvl && d.iLvl < c.iLvl && !(c.modes || []).some(m => m.id === 'trial'));
      const r = h('div', 'ss-nx-card ss-ptr' + (c.id === this.sel ? ' is-sel' : '') + (locked ? ' is-locked' : '') + (c.cleared ? ' is-done' : ''), this.list);
      r.setAttribute('role', 'button'); r.tabIndex = 0;
      r.innerHTML = `<i class="ss-nx-ic" style="background-image:url('${iconUrl(c.icon || 'boss:' + (c.gates?.[0]?.boss || 'gatekeeper'), 56)}')"></i>
        <div class="ss-nx-ct"><b>${esc(c.name)}</b><span>${esc(c.sub || CATS[c.cat] || '')}${c.players ? ` · ${esc(c.players)} players` : ''}</span></div>
        <div class="ss-nx-req${d.iLvl >= (c.iLvl || 0) ? '' : ' is-low'}"><span>iLvl</span><b>${c.iLvl ? fmt2(c.iLvl).replace('.00', '') : '—'}</b></div>
        ${c.cleared ? `<em class="ss-nx-tag">${glyph('check')}Cleared</em>` : locked ? `<em class="ss-nx-tag is-lock">${glyph('lock')}</em>` : ''}`;
      r.addEventListener('click', () => { this.sel = c.id; this.gate = 0; this.mode = 'normal'; this.ui.emit('nexus:select', { id: c.id }); this.render(this.d); });
      r.addEventListener('keydown', e => { if (e.key === 'Enter') r.click(); });
    }
    if (!list.length) h('div', 'ss-empty', this.list, 'Nothing here yet.');
    this.detail(content.find(c => c.id === this.sel));
  }
  detail(c) {
    const D = this.det, d = this.d;
    clear(D);
    if (!c) return;
    const modes = c.modes || [{ id: 'normal', label: 'Normal', iLvl: c.iLvl }];
    if (!modes.find(m => m.id === this.mode)) this.mode = modes[0].id;
    const mode = modes.find(m => m.id === this.mode);
    const need = mode.iLvl ?? c.iLvl ?? 0;
    const locked = !!c.locked || (this.mode !== 'trial' && d.iLvl < need);
    const hd = h('div', 'ss-nx-dhd', D);
    hd.innerHTML = `<i class="ss-nx-dic" style="background-image:url('${iconUrl(c.icon || 'boss:' + (c.gates?.[this.gate]?.boss || c.gates?.[0]?.boss || 'gatekeeper'), 112)}')"></i>
      <div><div class="ss-nx-over">${esc(c.sub || CATS[c.cat] || '')}</div><div class="ss-nx-name">${esc(c.name)}</div>
      <div class="ss-nx-meta"><span>${glyph('users')} ${esc(c.players || '1–4')}</span><span class="${d.iLvl >= need ? 'ss-good' : 'ss-bad'}">${glyph('shield')} iLvl ${fmt2(need).replace('.00', '')}</span>${c.note ? `<span>${glyph('clock')} ${esc(c.note)}</span>` : ''}</div></div>`;
    if (c.desc) h('p', 'ss-nx-desc', D, c.desc);
    if (c.gates && c.gates.length > 1) {
      h('div', 'ss-h', D, 'Gates');
      const gl = h('div', 'ss-nx-gates', D);
      c.gates.forEach((g, i) => {
        const b = btn('ss-nx-gate' + (i === this.gate ? ' is-on' : '') + (g.cleared ? ' is-done' : ''), gl, null, () => { this.gate = i; this.detail(c); }, g.name);
        b.innerHTML = `<i style="background-image:url('${iconUrl(g.icon || 'boss:' + (g.boss || 'gatekeeper'), 40)}')"></i><div><span>Gate ${i + 1}</span><b>${esc(g.name)}</b></div>${g.cleared ? glyph('check') : ''}`;
        b.setAttribute('aria-pressed', i === this.gate);
      });
    }
    const opts = h('div', 'ss-nx-opts', D);
    if (modes.length > 1) {
      const r = h('div', 'ss-nx-opt', opts); h('span', 'ss-label', r, 'Difficulty');
      seg(r, modes.map(m => ({ id: m.id, label: m.label || m.id })), this.mode, id => { this.mode = id; this.detail(c); });
    }
    const pr = h('div', 'ss-nx-opt', opts); h('span', 'ss-label', pr, 'Party');
    const party = d.party || { size: 1, members: [] };
    const pm = h('div', 'ss-nx-party', pr);
    const max = parseInt(String(c.players || '4').split(/[–-]/).pop()) || 4;
    for (let i = 0; i < max; i++) {
      const m = party.members?.[i];
      const e = h('i', 'ss-nx-pm' + (m ? '' : this.aiFill ? ' is-ai' : ' is-empty'), pm);
      if (m) { e.style.backgroundImage = `url('${iconUrl('class:' + m.cls, 26)}')`; e._tip = { title: m.name, lines: [clsInfo(m.cls).name] }; e.classList.add('ss-ptr'); }
      else if (this.aiFill) e.textContent = 'AI';
    }
    toggle(pr, 'Fill with AI adventurers', this.aiFill, v => { this.aiFill = v; this.detail(c); });
    if (c.rewards && c.rewards.length) {
      h('div', 'ss-h', D, 'Rewards');
      const rg = h('div', 'ss-nx-rw', D);
      for (const r of c.rewards) rg.appendChild(slot({ ...r, kind: r.kind || 'material' }, { size: 44 }));
    }
    const ft = h('div', 'ss-nx-ft', D);
    if (locked) h('div', 'ss-nx-lock', ft, c.locked || `Requires item level ${fmt2(need).replace('.00', '')}`);
    const go = btn('ss-btn ss-btn--primary ss-btn--lg ss-nx-go', ft, this.mode === 'trial' ? 'Enter Trial' : 'Enter', () => this.ui.emit('nexus:enter', { id: c.id, mode: this.mode, gate: this.gate, aiFill: this.aiFill }));
    go.disabled = locked;
  }
}
