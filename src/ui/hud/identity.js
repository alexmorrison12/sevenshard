// Identity gauge above the HP bar. One component, five looks (HudState.identity.kind):
//   gauge   — Reaver Bloodlust / Oathkeeper Sanctity / Starcaller Arcane Surge: segmented bar, Z (and X) ready glow
//   orbs    — Stormfist Chi / Bladedancer Surge: up to maxOrbs orbs, the next one fills from value/max
//   stance  — Pistoleer: pistol · shotgun · rifle chips (current lit) + Deadeye gauge (X when full)
//   bubbles — Songweaver Serenade: glassy bubbles, next fills from value/max
//   demon   — Demonbound: spiked crimson gauge, Demonform countdown while active
// Colour comes from the player's class (identity.cls, HudState.cls, or the `you` party entry).
import { h, setText, setCls, setStyle, show, replay, clamp, mix } from '../core/util.js';
import { cls as clsInfo } from '../core/data.js';

const KIND_COL = { gauge: ['#e0443a', '#ff9a6a'], orbs: ['#46b8ff', '#b8ecff'], stance: ['#ff9a3a', '#ffd9a0'], bubbles: ['#5fe0c8', '#ffc8ec'], demon: ['#e0305a', '#b066ff'] };
const STANCES = [['pistol', 'Pistol'], ['shotgun', 'Shotgun'], ['rifle', 'Rifle']];

export class Identity {
  constructor(ui, parent) {
    this.ui = ui;
    this.el = h('div', 'ss-id ss-ptr', parent);
    this.kind = null; this.cls = null; this.n = -1;
    this.el._tip = () => {
      const c = clsInfo(this.cls), id = c.identity || {};
      const s = this.s || {};
      return { title: s.label || id.name || 'Identity', lines: [id.desc || 'Your class identity.', id.z ? `Z · ${id.z}` : null, id.x ? `X · ${id.x}` : null] };
    };
  }
  build(kind, n) {
    this.kind = kind; this.n = n;
    const el = this.el;
    el.textContent = '';
    el.className = `ss-id ss-ptr ss-id--${kind}`;
    this.lbl = h('div', 'ss-id-lbl', el);
    this.name = h('span', 'ss-id-name', this.lbl);
    this.val = h('span', 'ss-id-val', this.lbl);
    this.keys = h('div', 'ss-id-keys', el);
    this.kz = h('span', 'ss-kbd ss-id-k', this.keys, 'Z');
    this.kx = h('span', 'ss-kbd ss-id-k', this.keys, 'X');
    this.orbs = [];
    if (kind === 'orbs' || kind === 'bubbles') {
      const row = h('div', 'ss-id-orbs', el);
      for (let i = 0; i < n; i++) { const o = h('i', kind === 'bubbles' ? 'ss-bub' : 'ss-orb', row); o._f = h('b', '', o); h('s', '', o); this.orbs.push(o); }
    }
    if (kind === 'stance') {
      const row = h('div', 'ss-id-stances', el);
      this.stances = STANCES.map(([id, name]) => { const c = h('span', 'ss-stance', row); c.dataset.s = id; h('i', '', c); h('b', '', c, name); return c; });
    }
    const bar = this.bar = h('div', 'ss-id-bar', el);
    this.fill = h('i', 'ss-id-fill', bar);
    h('i', 'ss-id-ticks', bar);
    this.edge = h('i', 'ss-id-edge', bar);
    this._full = false; this._orbs = -1; this._active = false;
  }
  update(s, hud) {
    this.s = s;
    show(this.el, !!s);
    if (!s) return;
    const kind = s.kind || 'gauge';
    const n = kind === 'orbs' || kind === 'bubbles' ? Math.max(1, s.maxOrbs || 3) : 0;
    if (kind !== this.kind || n !== this.n) this.build(kind, n);
    const clsId = s.cls || hud?.cls || (hud?.party && hud.party.find(p => p.you)?.cls) || null;
    const colKey = clsId + '|' + (s.color || '');
    if (colKey !== this._colKey) {
      this._colKey = colKey; this.cls = clsId;
      const c = clsId ? clsInfo(clsId) : null;
      let [a, b] = c ? [c.color, c.color2] : KIND_COL[kind];
      if (s.color) { a = s.color; b = mix(s.color, '#ffffff', 0.45); }
      setStyle(this.el, '--c', a); setStyle(this.el, '--c2', b);
    }
    const info = clsInfo(this.cls).identity || {};
    const frac = clamp((s.value || 0) / Math.max(1, s.max || 100), 0, 1);
    const active = !!s.active;
    const full = frac >= 0.999;
    const label = active ? (s.activeLabel || s.label || info.z || 'Active') : (s.label || info.name || 'Identity');
    setText(this.name, label);
    setText(this.val, active && s.activeLeft != null ? Math.ceil(s.activeLeft) + 's' : kind === 'orbs' || kind === 'bubbles' ? '' : Math.floor(frac * 100) + '%');
    setStyle(this.fill, 'transform', `scaleX(${frac.toFixed(4)})`);
    setStyle(this.edge, 'left', (frac * 100).toFixed(2) + '%');
    show(this.edge, frac > 0.01 && frac < 0.995);
    if (active !== this._active) { this._active = active; setCls(this.el, 'is-active', active); if (active) replay(this.el, 'is-burst'); }
    let zReady = (s.ready ?? full) && !active, xReady = false;
    if (kind === 'orbs' || kind === 'bubbles') {
      const k = clamp(s.orbs || 0, 0, n);
      for (let i = 0; i < n; i++) {
        const o = this.orbs[i];
        const f = i < k ? 1 : i === k ? frac : 0;
        setCls(o, 'on', i < k);
        setStyle(o._f, 'transform', `scaleY(${f.toFixed(3)})`);
      }
      if (k > this._orbs && this._orbs >= 0) { const o = this.orbs[k - 1]; if (o) replay(o, 'is-pop'); }
      this._orbs = k;
      zReady = k >= 1 && !active;
      xReady = !!info.x && k >= 2 && !active;
      if (kind === 'bubbles') { zReady = k >= 1; xReady = k >= 1; }
    } else if (kind === 'stance') {
      const cur = typeof s.stance === 'number' ? STANCES[s.stance]?.[0] : s.stance;
      for (const c of this.stances) setCls(c, 'on', c.dataset.s === cur);
      zReady = true; xReady = full;
    } else if (kind === 'gauge' && info.x) {
      xReady = full && !active;
    }
    if (active && kind === 'gauge' && info.x) xReady = true; // e.g. Reaver: Z again = Crimson Finale
    show(this.kx, !!info.x || kind === 'stance' || kind === 'bubbles');
    setCls(this.kz, 'is-ready', zReady);
    setCls(this.kx, 'is-ready', xReady);
    if (full !== this._full) { this._full = full; setCls(this.el, 'is-full', full); if (full && !active) replay(this.el, 'is-flash'); }
  }
}
