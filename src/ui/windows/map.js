// World map (M): two views — the current zone (painted minimap + markers) and Solmara (continent Valemont, the
// Glass Sea, Pipsprout Hollow, Brightwater Isle and the islands), painted procedurally.
//   data: { view?: 'zone'|'world', zone: { name, sub }, canvas, x0, z0, size, you, markers   (zone view; defaults to the HUD minimap)
//           world?: { regions: [{ id, name, x, y (0..1), kind: 'city'|'field'|'forest'|'mountain'|'island'|'stronghold'|'hollow',
//                                 level?, unlocked?, current?, pct?, triport? }], ship?: { x, y } } }
// Actions: map:click { x, z } (zone view) · map:travel { id } (world view, triport / sail)
import { h, esc, clear, rng, pretty } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { seg } from '../core/kit.js';
import { Win } from '../core/windows.js';

export const WORLD = [
  { id: 'solhaven', name: 'Solhaven', kind: 'city', x: 0.335, y: 0.615, level: 'Capital', triport: true },
  { id: 'goldmeadow', name: 'Goldmeadow', kind: 'field', x: 0.215, y: 0.62, level: 'Lv 1–25', triport: true },
  { id: 'thornwood', name: 'Thornwood', kind: 'forest', x: 0.19, y: 0.4, level: 'Lv 25–40', triport: true },
  { id: 'ashen_ridge', name: 'Ashen Ridge', kind: 'mountain', x: 0.3, y: 0.235, level: 'Lv 40–50', triport: true },
  { id: 'pipsprout', name: 'Pipsprout Hollow', kind: 'hollow', x: 0.6, y: 0.2, level: 'Pip Seeds' },
  { id: 'stronghold', name: 'Brightwater Isle', kind: 'stronghold', x: 0.64, y: 0.74, level: 'Stronghold' },
  { id: 'lantern', name: 'Lantern Isle', kind: 'island', x: 0.8, y: 0.3 }, { id: 'gulls', name: "Gull's Rest", kind: 'island', x: 0.52, y: 0.46 },
  { id: 'ember', name: 'Ember Key', kind: 'island', x: 0.88, y: 0.58 }, { id: 'mistveil', name: 'Mistveil', kind: 'island', x: 0.74, y: 0.5 },
  { id: 'coral', name: 'Coral Crown', kind: 'island', x: 0.83, y: 0.82 }, { id: 'wreckers', name: "Wreckers' Reef", kind: 'island', x: 0.47, y: 0.86 },
  { id: 'starfall', name: 'Starfall Atoll', kind: 'island', x: 0.92, y: 0.16 }, { id: 'moonwell', name: 'Moonwell', kind: 'island', x: 0.7, y: 0.1 },
];
const LAND = [ // [cx, cy, rx, ry, seed] (0..1 space)
  [0.26, 0.45, 0.17, 0.36, 3], [0.6, 0.2, 0.065, 0.075, 11], [0.64, 0.74, 0.05, 0.055, 17],
  [0.8, 0.3, 0.03, 0.034, 21], [0.52, 0.46, 0.022, 0.028, 23], [0.88, 0.58, 0.028, 0.03, 27], [0.74, 0.5, 0.032, 0.036, 29],
  [0.83, 0.82, 0.03, 0.03, 31], [0.47, 0.86, 0.024, 0.024, 33], [0.92, 0.16, 0.026, 0.028, 37], [0.7, 0.1, 0.028, 0.03, 41],
];
const KG = { city: '#ffd98a', field: '#d8e07a', forest: '#6fbf6a', mountain: '#ff8a5a', island: '#9fe0e8', stronghold: '#8fc8ff', hollow: '#9aff7a' };

/** Marker label: raw anchor ids ('portal:abyss', 'dock:ship') become readable names. */
export function markerLabel(mk) {
  const l = String(mk.label || ''), m = /^([a-z]+):([a-z0-9_]+)$/.exec(l);
  if (!m) return l;
  const [, k, rest] = m, name = pretty(rest);
  if (k === 'portal') return `${name} Portal`;
  if (k === 'dock') return rest === 'ship' ? 'Harbor' : `${name} Dock`;
  if (k === 'triport') return 'Triport';
  if (k === 'gate') return `To ${name}`;
  return name;
}
const LABEL_PRI = { quest: 0, objective: 0, questdone: 1, boss: 1, portal: 2, dungeon: 2, triport: 2, vendor: 3, npc: 4, seed: 5, poi: 5, elite: 6 };

export class MapWin extends Win {
  static id = 'map'; static title = 'World Map'; static glyph = 'map'; static width = 960;
  build() {
    const b = this.body;
    b.classList.add('ss-map');
    const top = h('div', 'ss-map-top', b);
    this.cap = h('div', 'ss-map-cap', top);
    this.view = 'zone';
    this.seg = seg(top, [{ id: 'zone', label: 'Zone' }, { id: 'world', label: 'Solmara' }], this.view, v => { this.view = v; this.render(this.d || {}); });
    this.frame = h('div', 'ss-map-frame', b);
    this.cv = h('canvas', 'ss-map-cv', this.frame);
    this.pins = h('div', 'ss-map-pins', this.frame);
    this.legend = h('div', 'ss-map-legend', b);
    // hover: name of the marker under the pointer (labels that didn't fit are still discoverable)
    this.cv.addEventListener('pointermove', e => this.hover(e));
    this.cv.addEventListener('pointerleave', () => { if (this.hov) this.hov.style.display = 'none'; });
    this.cv.addEventListener('click', e => {
      if (this.view !== 'zone') return;
      const m = this.m; if (!m) return;
      const r = this.cv.getBoundingClientRect();
      this.ui.emit('map:click', { x: m.x0 + (e.clientX - r.left) / r.width * m.size, z: m.z0 + (e.clientY - r.top) / r.height * m.size });
    });
  }
  render(d) {
    this.d = d;
    if (d.view && d.view !== this._dv) { this._dv = d.view; this.view = d.view; }
    this.seg.set(this.view);
    const hs = this.ui.hud.state || {};
    const zone = d.zone || hs.zone || {};
    this.cap.innerHTML = this.view === 'zone' ? `<b>${esc(zone.name || 'Unknown')}</b>${zone.sub ? `<span>${esc(zone.sub)}</span>` : ''}` : '<b>Solmara</b><span>Valemont · The Glass Sea</span>';
    this.frame.dataset.view = this.view;
    if (this.view === 'zone') this.drawZone(d.canvas ? d : hs.minimap); else this.drawWorld(d.world || {});
  }
  size(W, H) {
    const dpr = (globalThis.devicePixelRatio || 1) * this.ui.scale, cv = this.cv;
    const w = Math.round(W * dpr), hh = Math.round(H * dpr);
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return x;
  }
  drawZone(m) {
    this.m = m;
    clear(this.pins);
    const S = 620, x = this.size(S, S);
    x.fillStyle = '#070a12'; x.fillRect(0, 0, S, S);
    this.legend.innerHTML = [['Party', '#5fb2ff'], ['Quest', '#ffb43c'], ['NPC', '#ffe07a'], ['Portal', '#b47aff'], ['Boss', '#ff4a3a'], ['Pip Seed', '#7aff8a']].map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('');
    if (!m || !m.canvas) { x.fillStyle = '#5f6880'; x.font = '14px Georgia'; x.textAlign = 'center'; x.fillText('No map for this area.', S / 2, S / 2); return; }
    x.imageSmoothingQuality = 'high';
    x.drawImage(m.canvas, 0, 0, S, S);
    const k = S / m.size;
    const col = { party: '#5fb2ff', quest: '#ffb43c', questdone: '#ffd35a', npc: '#ffe07a', vendor: '#ffd35a', portal: '#b47aff', dungeon: '#b47aff', boss: '#ff4a3a', elite: '#ff9a3a', seed: '#7aff8a', triport: '#5fe0e8', objective: '#ffcc55', poi: '#e8ecf5' };
    const pts = this.pts = [];
    for (const mk of m.markers || []) {
      if (mk.kind === 'mob') continue;
      const X = (mk.x - m.x0) * k, Y = (mk.z - m.z0) * k;
      if (X < -6 || Y < -6 || X > S + 6 || Y > S + 6) continue;
      x.fillStyle = col[mk.kind] || '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.5;
      x.beginPath(); x.arc(X, Y, 5, 0, 7); x.fill(); x.stroke();
      pts.push({ X, Y, mk, label: mk.kind === 'player' ? '' : markerLabel(mk) });
    }
    // labels by priority; each tries above / below / right / left of its dot, clamped inside the map, and is
    // skipped when every spot collides with a label already placed (hover still names it)
    x.font = '600 12px "Segoe UI", Roboto, sans-serif';
    const boxes = [];
    const order = pts.filter(p => p.label && p.mk.kind !== 'party').sort((a, b) => (LABEL_PRI[a.mk.kind] ?? 5) - (LABEL_PRI[b.mk.kind] ?? 5));
    for (const p of order) {
      const w = x.measureText(p.label).width + 4;
      for (const [tx, ty, al] of [[p.X, p.Y - 10, 'center'], [p.X, p.Y + 19, 'center'], [p.X + 9, p.Y + 4, 'left'], [p.X - 9, p.Y + 4, 'right']]) {
        let l = al === 'center' ? tx - w / 2 : al === 'left' ? tx - 2 : tx - w + 2;
        const sh = l < 3 ? 3 - l : l + w > S - 3 ? S - 3 - (l + w) : 0;
        l += sh;
        const bx = { l, t: ty - 11, r: l + w, b: ty + 3 };
        if (bx.t < 2 || bx.b > S - 2 || boxes.some(o => bx.r > o.l && bx.l < o.r && bx.b > o.t && bx.t < o.b)) continue;
        boxes.push(bx); p.placed = true;
        x.textAlign = al; x.lineWidth = 3; x.strokeStyle = 'rgba(0, 0, 0, .9)'; x.lineJoin = 'round';
        x.strokeText(p.label, tx + sh, ty); x.fillStyle = p.mk.kind === 'quest' || p.mk.kind === 'objective' ? '#ffd88a' : '#f1f3f8'; x.fillText(p.label, tx + sh, ty);
        break;
      }
    }
    x.textAlign = 'center';
    this.hov = h('div', 'ss-map-hov', this.pins); this.hov.style.display = 'none';
    if (m.you) {
      const X = (m.you.x - m.x0) * k, Y = (m.you.z - m.z0) * k;
      x.save(); x.translate(X, Y); x.rotate(-(m.you.facing || 0));
      x.fillStyle = '#fff4c8'; x.strokeStyle = '#3a2a08'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(0, -11); x.lineTo(8, 8); x.lineTo(0, 4); x.lineTo(-8, 8); x.closePath(); x.fill(); x.stroke();
      x.restore();
    }
  }
  hover(e) {
    if (this.view !== 'zone' || !this.pts || !this.hov) return;
    const r = this.cv.getBoundingClientRect(), S = 620;
    const px = (e.clientX - r.left) / r.width * S, py = (e.clientY - r.top) / r.height * S;
    let best = null, bd = 12 * 12;
    for (const p of this.pts) { const d = (p.X - px) ** 2 + (p.Y - py) ** 2; if (p.label && d < bd) { bd = d; best = p; } }
    if (!best) { this.hov.style.display = 'none'; return; }
    this.hov.textContent = best.label;
    this.hov.style.display = '';
    this.hov.style.left = (best.X / S * 100) + '%'; this.hov.style.top = (best.Y / S * 100) + '%';
  }
  drawWorld(w) {
    const W = 900, H = 580, x = this.size(W, H);
    const regions = w.regions || WORLD.map(r => ({ ...r, unlocked: r.id !== 'starfall' && r.id !== 'moonwell', current: r.id === (this.ui.hud.state?.zone?.id || 'solhaven') }));
    // ocean
    const sea = x.createRadialGradient(W * 0.55, H * 0.5, 40, W * 0.55, H * 0.5, W * 0.7);
    sea.addColorStop(0, '#12405a'); sea.addColorStop(0.6, '#0b2a40'); sea.addColorStop(1, '#061524');
    x.fillStyle = sea; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(160,210,240,.07)'; x.lineWidth = 1;
    for (let i = 1; i < 10; i++) { x.beginPath(); x.moveTo(0, i * H / 10); x.lineTo(W, i * H / 10); x.stroke(); x.beginPath(); x.moveTo(i * W / 10, 0); x.lineTo(i * W / 10, H); x.stroke(); }
    const R = rng(7);
    x.strokeStyle = 'rgba(190,230,255,.12)';
    for (let i = 0; i < 70; i++) { const px = R() * W, py = R() * H; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 6, py - 3, px + 12, py); x.quadraticCurveTo(px + 18, py + 3, px + 24, py); x.stroke(); }
    // land
    for (const [cx, cy, rx, ry, seed] of LAND) {
      const pts = blob(cx * W, cy * H, rx * W, ry * H, seed);
      x.save();
      x.shadowColor = 'rgba(120,220,230,.35)'; x.shadowBlur = 14;
      x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath();
      const g = x.createLinearGradient(cx * W, (cy - ry) * H, cx * W, (cy + ry) * H);
      g.addColorStop(0, '#6d7a4a'); g.addColorStop(0.5, '#56683c'); g.addColorStop(1, '#3f5230');
      x.fillStyle = g; x.fill(); x.restore();
      x.strokeStyle = 'rgba(232,214,160,.75)'; x.lineWidth = 1.6; x.stroke();
    }
    // terrain accents on Valemont
    const tree = (px, py) => { x.fillStyle = '#2f4a26'; x.beginPath(); x.moveTo(px, py - 7); x.lineTo(px + 5, py + 3); x.lineTo(px - 5, py + 3); x.fill(); };
    const mount = (px, py, s = 1) => { x.fillStyle = '#4a3a34'; x.beginPath(); x.moveTo(px - 9 * s, py + 5 * s); x.lineTo(px, py - 9 * s); x.lineTo(px + 9 * s, py + 5 * s); x.fill(); x.fillStyle = 'rgba(255,120,60,.8)'; x.beginPath(); x.moveTo(px - 2 * s, py - 5 * s); x.lineTo(px, py - 9 * s); x.lineTo(px + 2 * s, py - 5 * s); x.fill(); };
    const R2 = rng(99);
    for (let i = 0; i < 26; i++) tree(W * (0.13 + R2() * 0.12), H * (0.32 + R2() * 0.14));
    for (let i = 0; i < 9; i++) mount(W * (0.24 + R2() * 0.12), H * (0.16 + R2() * 0.12), 0.9 + R2() * 0.5);
    x.fillStyle = 'rgba(230,220,120,.25)'; for (let i = 0; i < 40; i++) x.fillRect(W * (0.15 + R2() * 0.12), H * (0.56 + R2() * 0.12), 6, 3);
    // sea routes from Solhaven
    const sol = regions.find(r => r.id === 'solhaven') || regions[0];
    x.setLineDash([4, 6]); x.strokeStyle = 'rgba(255,236,190,.35)'; x.lineWidth = 1.2;
    for (const r of regions) if (r.kind === 'island' || r.kind === 'stronghold' || r.kind === 'hollow') { x.beginPath(); x.moveTo(sol.x * W + 14, sol.y * H); x.quadraticCurveTo((sol.x + r.x) / 2 * W, Math.max(sol.y, r.y) * H + 30, r.x * W, r.y * H); x.stroke(); }
    x.setLineDash([]);
    // compass rose
    const cr = (px, py, s) => { x.save(); x.translate(px, py); x.fillStyle = 'rgba(243,220,160,.8)'; for (let i = 0; i < 4; i++) { x.rotate(Math.PI / 2); x.beginPath(); x.moveTo(0, -s); x.lineTo(s * 0.18, 0); x.lineTo(-s * 0.18, 0); x.fill(); } x.fillStyle = '#f3dca0'; x.font = '700 11px Georgia'; x.textAlign = 'center'; x.fillText('N', 0, -s - 4); x.restore(); };
    cr(W - 60, H - 64, 26);
    // pins (DOM, clickable)
    clear(this.pins);
    this.legend.innerHTML = '<span><i style="background:#ffd98a"></i>City</span><span><i style="background:#d8e07a"></i>Field</span><span><i style="background:#9fe0e8"></i>Island</span><span><i style="background:#8fc8ff"></i>Stronghold</span><span class="ss-map-hint">Click a place with a triport or harbour to travel</span>';
    for (const r of regions) {
      const p = h('button', 'ss-map-pin' + (r.current ? ' is-here' : '') + (r.unlocked === false ? ' is-locked' : '') + (r.kind === 'island' ? ' is-isle' : ''), this.pins);
      p.type = 'button';
      p.style.left = (r.x * 100) + '%'; p.style.top = (r.y * 100) + '%'; p.style.setProperty('--c', KG[r.kind] || '#fff');
      p.innerHTML = `<i></i><b>${esc(r.name)}</b>${r.level ? `<span>${esc(r.level)}</span>` : ''}${r.pct != null ? `<em>${Math.round(r.pct)}%</em>` : ''}`;
      p.setAttribute('aria-label', r.name);
      p._tip = { title: r.name, lines: [r.level, r.unlocked === false ? 'Not discovered yet' : r.current ? 'You are here' : r.triport ? 'Triport: click to travel' : 'Sail here from the harbour', r.pct != null ? `Adventure Tome ${Math.round(r.pct)}%` : null] };
      p.disabled = r.unlocked === false;
      p.addEventListener('click', () => { if (!r.current && r.unlocked !== false) this.ui.emit('map:travel', { id: r.id }); });
      if (r.current) h('s', 'ss-map-you', p);
    }
    if (w.ship) { const s = h('div', 'ss-map-ship', this.pins); s.style.left = (w.ship.x * 100) + '%'; s.style.top = (w.ship.y * 100) + '%'; s.innerHTML = glyph('ship'); }
  }
}

/** Noisy closed outline around (cx, cy). */
function blob(cx, cy, rx, ry, seed) {
  const R = rng(seed), n = 64, ph = [R() * 6, R() * 6, R() * 6], out = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const k = 1 + 0.12 * Math.sin(a * 3 + ph[0]) + 0.07 * Math.sin(a * 7 + ph[1]) + 0.04 * Math.sin(a * 13 + ph[2]) + (R() - 0.5) * 0.05;
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}
