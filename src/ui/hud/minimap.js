// Top-right minimap: zone name + sub-area + clock, a north-up map window centred on the player drawn from the
// zone's painted minimap canvas, markers, zoom, event-compass and world-map buttons.
//   zone: { name, sub }   minimap: { canvas, x0, z0, size, you: { x, z, facing }, markers: [{ x, z, kind, label }] }
// Marker kinds: party player npc vendor quest questdone objective portal boss elite mob seed ping poi triport dungeon
import { h, setText, show, clamp, btn } from '../core/util.js';
import { glyph } from '../core/glyphs.js';

const VIEW = 188; // css px (virtual)
const MK = {
  party: { c: '#5fb2ff', r: 3.6, ring: '#0b2a55' },
  player: { c: '#9be07a', r: 2.8 },
  npc: { c: '#ffe07a', r: 2.6 },
  vendor: { c: '#ffd35a', r: 3.2, shape: 'coin' },
  quest: { c: '#ffb43c', r: 5, shape: 'bang' },
  questdone: { c: '#ffd35a', r: 5, shape: 'q' },
  objective: { c: '#ffcc55', r: 7, shape: 'ring' },
  portal: { c: '#b47aff', r: 5, shape: 'swirl' },
  dungeon: { c: '#b47aff', r: 5.5, shape: 'gate' },
  boss: { c: '#ff4a3a', r: 6, shape: 'diamond' },
  elite: { c: '#ff9a3a', r: 3.6 },
  mob: { c: '#e04a3a', r: 2.2 },
  seed: { c: '#7aff8a', r: 3.6, shape: 'leaf' },
  ping: { c: '#ffffff', r: 8, shape: 'ping' },
  poi: { c: '#e8ecf5', r: 3.6, shape: 'diamond' },
  triport: { c: '#5fe0e8', r: 4.4, shape: 'diamond' },
};

export class Minimap {
  constructor(ui, parent) {
    this.ui = ui;
    const el = this.el = h('div', 'ss-mm', parent);
    const hd = h('div', 'ss-mm-hd', el);
    this.zone = h('div', 'ss-mm-zone', hd);
    this.sub = h('div', 'ss-mm-sub', hd);
    const frame = this.frame = h('div', 'ss-mm-frame ss-ptr', el);
    this.cv = h('canvas', 'ss-mm-cv', frame);
    this.x = this.cv.getContext('2d');
    h('span', 'ss-mm-n', frame, 'N');
    const bar = h('div', 'ss-mm-bar', el);
    this.clock = h('span', 'ss-mm-clock', bar);
    const tools = h('div', 'ss-mm-tools', bar);
    const mk = (g, label, fn) => { const b = btn('ss-mm-b', tools, null, fn, label); b.innerHTML = glyph(g); b._tip = { title: label }; return b; };
    this.compass = mk('compass', 'Event Compass', () => ui.emit('hud:compass', {}));
    mk('minus', 'Zoom out', () => { this.range = clamp(this.range * 1.35, 30, 400); this.dirty = true; this.draw(); });
    mk('plus', 'Zoom in', () => { this.range = clamp(this.range / 1.35, 30, 400); this.dirty = true; this.draw(); });
    mk('map', 'World Map (M)', () => ui.toggle('map'));
    this.range = 110; // metres across the view
    this.dpr = 1; this.dirty = true; this.m = null; this._clockT = -1e9;
    frame.addEventListener('click', e => { const p = this.toWorld(e); if (p) ui.emit('hud:minimap', p); });
    frame.addEventListener('pointermove', e => { this._hover = this.nearest(e); });
    frame.addEventListener('pointerleave', () => { this._hover = null; });
    frame._tip = () => this._hover ? { title: this._hover.label || this._hover.kind } : null;
    frame._tipLive = true;
    this.resize(1);
  }
  resize(s) {
    const d = Math.max(1, Math.round(VIEW * s * (globalThis.devicePixelRatio || 1)));
    if (this.cv.width !== d) { this.cv.width = this.cv.height = d; this.dirty = true; this.draw(); }
  }
  update(zone, m) {
    if (zone) { setText(this.zone, zone.name || ''); setText(this.sub, zone.sub || ''); }
    show(this.sub, !!(zone && zone.sub));
    const t = performance.now();
    if (t - this._clockT > 5000) { this._clockT = t; const d = new Date(); setText(this.clock, d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')); }
    this.m = m || null;
    this.draw();
  }
  /** world metres → view pixels */
  _view() {
    const m = this.m, W = this.cv.width;
    const you = m && m.you ? m.you : { x: 0, z: 0 };
    return { cx: you.x, cz: you.z, k: W / this.range, W };
  }
  draw() {
    const x = this.x, W = this.cv.width, m = this.m;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#070a12'; x.fillRect(0, 0, W, W);
    if (!m) return;
    const { cx, cz, k } = this._view();
    // map image
    if (m.canvas && m.size) {
      const src = m.canvas, sw = src.width || 1, sh = src.height || 1;
      const ppm = sw / m.size; // source pixels per metre
      const half = this.range / 2;
      const sx = (cx - half - m.x0) * ppm, sy = (cz - half - m.z0) * (sh / m.size);
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      try { x.drawImage(src, sx, sy, this.range * ppm, this.range * (sh / m.size), 0, 0, W, W); } catch { /* canvas not ready */ }
    }
    // markers
    const px = wx => (wx - cx) * k + W / 2, pz = wz => (wz - cz) * k + W / 2;
    const u = W / VIEW; // device px per css px
    if (m.markers) for (const mk of m.markers) {
      const st = MK[mk.kind] || MK.poi;
      let X = px(mk.x), Y = pz(mk.z);
      const edge = st.shape === 'bang' || st.shape === 'q' || st.shape === 'objective' || st.shape === 'ring' || mk.kind === 'boss' || mk.kind === 'party';
      if (X < 0 || Y < 0 || X > W || Y > W) {
        if (!edge) continue;
        // clamp important markers to the rim
        const dx = X - W / 2, dy = Y - W / 2, s = (W / 2 - 7 * u) / Math.max(Math.abs(dx), Math.abs(dy));
        X = W / 2 + dx * s; Y = W / 2 + dy * s;
      }
      drawMarker(x, st, X, Y, u);
    }
    // you
    const f = m.you ? m.you.facing || 0 : 0;
    x.save(); x.translate(W / 2, W / 2); x.rotate(-f);
    // view cone
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 34 * u);
    g.addColorStop(0, 'rgba(255,236,170,.32)'); g.addColorStop(1, 'rgba(255,236,170,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 34 * u, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); x.closePath(); x.fill();
    x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 3 * u;
    x.fillStyle = '#fff4c8'; x.strokeStyle = '#3a2a08'; x.lineWidth = 1.2 * u;
    x.beginPath(); x.moveTo(0, -7 * u); x.lineTo(5 * u, 5.5 * u); x.lineTo(0, 3 * u); x.lineTo(-5 * u, 5.5 * u); x.closePath(); x.fill(); x.stroke();
    x.restore();
    // inner vignette
    const v = x.createRadialGradient(W / 2, W / 2, W * 0.3, W / 2, W / 2, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
    x.fillStyle = v; x.fillRect(0, 0, W, W);
  }
  _local(e) {
    const r = this.cv.getBoundingClientRect();
    return { u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height };
  }
  toWorld(e) {
    if (!this.m) return null;
    const { u, v } = this._local(e), { cx, cz } = this._view();
    return { x: cx + (u - 0.5) * this.range, z: cz + (v - 0.5) * this.range };
  }
  nearest(e) {
    if (!this.m || !this.m.markers) return null;
    const p = this.toWorld(e); if (!p) return null;
    let best = null, bd = (this.range * 0.05) ** 2;
    for (const mk of this.m.markers) { if (!mk.label) continue; const d = (mk.x - p.x) ** 2 + (mk.z - p.z) ** 2; if (d < bd) { bd = d; best = mk; } }
    return best;
  }
}

function drawMarker(x, st, X, Y, u) {
  const r = st.r * u;
  x.save();
  x.shadowColor = 'rgba(0,0,0,.85)'; x.shadowBlur = 2.5 * u;
  x.fillStyle = st.c; x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 1 * u;
  switch (st.shape) {
    case 'diamond': x.beginPath(); x.moveTo(X, Y - r); x.lineTo(X + r, Y); x.lineTo(X, Y + r); x.lineTo(X - r, Y); x.closePath(); x.fill(); x.stroke(); break;
    case 'bang': case 'q': {
      x.beginPath(); x.moveTo(X, Y - r * 1.2); x.lineTo(X + r, Y); x.lineTo(X, Y + r * 1.2); x.lineTo(X - r, Y); x.closePath(); x.fill(); x.stroke();
      x.shadowBlur = 0; x.fillStyle = '#2a1600'; x.font = `bold ${Math.round(r * 1.5)}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(st.shape === 'bang' ? '!' : '?', X, Y + r * 0.08); break;
    }
    case 'ring': x.lineWidth = 2 * u; x.strokeStyle = st.c; x.globalAlpha = 0.9; x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 0.18; x.fill(); break;
    case 'ping': { const t = (performance.now() % 1200) / 1200; x.strokeStyle = st.c; x.lineWidth = 2 * u; x.globalAlpha = 1 - t; x.beginPath(); x.arc(X, Y, r * (0.4 + t), 0, Math.PI * 2); x.stroke(); break; }
    case 'swirl': case 'gate': x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.fill(); x.stroke(); x.fillStyle = '#1a0830'; x.beginPath(); x.arc(X, Y, r * 0.45, 0, Math.PI * 2); x.fill(); break;
    case 'coin': x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.fill(); x.stroke(); x.fillStyle = 'rgba(80,50,0,.7)'; x.fillRect(X - r * 0.15, Y - r * 0.55, r * 0.3, r * 1.1); break;
    case 'leaf': x.beginPath(); x.ellipse(X, Y, r, r * 0.6, -0.7, 0, Math.PI * 2); x.fill(); x.stroke(); break;
    default:
      x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.fill(); x.stroke();
      if (st.ring) { x.shadowBlur = 0; x.strokeStyle = '#e8f4ff'; x.lineWidth = 1 * u; x.stroke(); }
  }
  x.restore();
}
