// Character select. The lead renders the 3D roster lineup behind; the centre stays clear.
//   data: { server, roster: { level, xp: 0..1 }, chars: [{ id, name, cls, level, iLvl, title?, location?, rested? }],
//           selected: id, max: 6 }
// Actions: select:pick {id} · select:enter {id} · select:create {} · select:delete {id} (after type-to-confirm) · select:back {}
import { h, btn, esc, setText, show, fmt2 } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { iconUrl } from '../core/icon.js';
import { cls as clsInfo } from '../core/data.js';
import { Screen } from './screen.js';

export class CharSelectScreen extends Screen {
  static id = 'charselect';
  build() {
    const el = this.el;
    h('div', 'ss-cs-vig', el);
    const hd = h('header', 'ss-cs-hd', el);
    h('div', 'ss-cs-title', hd, 'Character Select');
    this.server = h('div', 'ss-cs-server', hd);
    const ro = this.roster = h('div', 'ss-cs-roster ss-ptr', hd);
    ro.innerHTML = `<span class="ss-cs-rl">Roster Level</span><b></b><div class="ss-bar ss-bar--gold"><i class="ss-fill"></i></div>`;
    ro._tip = { title: 'Roster Level', lines: ['Shared by every character on this server. Each level grants a small stat bonus to the whole roster.'] };
    this.rosterN = ro.querySelector('b'); this.rosterF = ro.querySelector('.ss-fill');
    const side = h('aside', 'ss-cs-side', el);
    this.count = h('div', 'ss-cs-count', side);
    this.list = h('div', 'ss-cs-list', side);
    this.list.setAttribute('role', 'listbox');
    this.list.setAttribute('aria-label', 'Characters');
    this.enter = btn('ss-btn ss-btn--primary ss-btn--lg ss-cs-enter', side, 'Enter World', () => this.enterWorld());
    const foot = h('div', 'ss-cs-foot', el);
    const back = btn('ss-btn ss-btn--ghost', foot, null, () => this.emit('select:back', {}), 'Back to title');
    back.innerHTML = glyph('left') + '<span>Title</span>';
    const del = this.del = btn('ss-btn ss-btn--ghost ss-cs-del', foot, null, () => this.remove(), 'Delete character');
    del.innerHTML = glyph('trash') + '<span>Delete</span>';
    this.plate = h('div', 'ss-cs-plate', el);
    this.cards = [];
  }
  render(d) {
    this.d = d;
    const chars = d.chars || [];
    const max = d.max || 6;
    if (!chars.find(c => c.id === this.sel)) this.sel = d.selected ?? chars[0]?.id ?? null;
    setText(this.server, `Server · ${d.server || 'Solmara-1'}`);
    const r = d.roster || { level: 1, xp: 0 };
    setText(this.rosterN, r.level ?? 1);
    this.rosterF.style.transform = `scaleX(${Math.max(0, Math.min(1, r.xp || 0))})`;
    setText(this.count, `Characters ${chars.length} / ${max}`);
    this.list.textContent = '';
    this.cards = [];
    for (let i = 0; i < max; i++) {
      const c = chars[i];
      if (!c) {
        const e = btn('ss-cs-card is-empty', this.list, null, () => this.emit('select:create', {}), 'Create a new character');
        e.innerHTML = `<span class="ss-cs-plus">${glyph('plus')}</span><span>Create Character</span>`;
        continue;
      }
      const info = clsInfo(c.cls);
      const card = h('div', 'ss-cs-card', this.list);
      card.setAttribute('role', 'option');
      card.tabIndex = 0;
      card.style.setProperty('--cc', info.color);
      card.innerHTML = `
        <div class="ss-cs-crest"><i style="background-image:url('${iconUrl('class:' + c.cls, 44)}')"></i></div>
        <div class="ss-cs-main">
          <div class="ss-cs-name">${esc(c.name)}</div>
          <div class="ss-cs-cls">Lv ${esc(c.level ?? 1)} · ${esc(info.name)}${c.title ? ` · <span>${esc(c.title)}</span>` : ''}</div>
          ${c.location ? `<div class="ss-cs-loc">${glyph('pin')}${esc(c.location)}</div>` : ''}
        </div>
        <div class="ss-cs-ilvl"><b>${fmt2(c.iLvl || 0)}</b><span>Item Level</span></div>
        ${c.rested ? `<span class="ss-cs-rest" title="Rest bonus">${glyph('leaf')}</span>` : ''}`;
      card.addEventListener('click', () => this.pick(c.id));
      card.addEventListener('dblclick', () => { this.pick(c.id); this.enterWorld(); });
      card.addEventListener('keydown', e => { if (e.key === 'Enter') { e.stopPropagation(); this.pick(c.id); this.enterWorld(); } });
      card._id = c.id;
      this.cards.push(card);
    }
    this.mark();
  }
  pick(id) {
    if (this.sel === id) return;
    this.sel = id; this.mark();
    this.emit('select:pick', { id });
  }
  mark() {
    for (const c of this.cards) { const on = c._id === this.sel; c.classList.toggle('is-sel', on); c.setAttribute('aria-selected', on); }
    const c = (this.d.chars || []).find(x => x.id === this.sel);
    show(this.plate, !!c); show(this.del, !!c);
    this.enter.disabled = !c;
    if (c) {
      const info = clsInfo(c.cls);
      this.plate.innerHTML = `<div class="ss-cs-pn">${esc(c.name)}</div><div class="ss-cs-pc"><span style="color:${info.color}">${esc(info.name)}</span> · Level ${esc(c.level ?? 1)} · Item Level ${fmt2(c.iLvl || 0)}</div>`;
      this.plate.classList.remove('is-swap'); void this.plate.offsetWidth; this.plate.classList.add('is-swap');
    }
  }
  enterWorld() { if (this.sel != null) this.emit('select:enter', { id: this.sel }); }
  async remove() {
    const c = (this.d.chars || []).find(x => x.id === this.sel);
    if (!c) return;
    const ok = await this.ui.confirm({ title: 'Delete Character', text: `${c.name} (Lv ${c.level} ${clsInfo(c.cls).name}) and everything they carry will be lost forever.`, ok: 'Delete', danger: true, match: c.name });
    if (ok) this.emit('select:delete', { id: c.id });
  }
  key(e) {
    const chars = this.d.chars || [];
    const i = chars.findIndex(c => c.id === this.sel);
    if (e.key === 'ArrowDown' && chars.length) { this.pick(chars[(i + 1) % chars.length].id); this.cards[(i + 1) % chars.length]?.focus(); return true; }
    if (e.key === 'ArrowUp' && chars.length) { this.pick(chars[(i - 1 + chars.length) % chars.length].id); this.cards[(i - 1 + chars.length) % chars.length]?.focus(); return true; }
    if (e.key === 'Enter') { this.enterWorld(); return true; }
    if (e.key === 'Delete') { this.remove(); return true; }
    if (e.key === 'Escape') { this.emit('select:back', {}); return true; }
    return false;
  }
}
