// Small windows: game menu (Esc), world map.
//   gamemenu data: { items?: [{ id, label, glyph }] }            Actions: gamemenu { id }
//   map data: { canvas, x0, z0, size, you, markers, zone: { name, sub } }   (defaults to the HUD's minimap state)
//             Actions: map:click { x, z }
import { h, btn, esc, clear } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { Win } from '../core/windows.js';

const GM = [
  { id: 'resume', label: 'Resume', g: 'right' }, { id: 'settings', label: 'Settings', g: 'settings' }, { id: 'keys', label: 'Keybinds', g: 'keyboard' },
  { id: 'partyfinder', label: 'Party Finder', g: 'finder' }, { id: 'photo', label: 'Photo Mode', g: 'camera' }, { id: 'help', label: 'Help', g: 'info' },
  { id: 'charselect', label: 'Character Select', g: 'users' }, { id: 'title', label: 'Exit to Title', g: 'exit' },
];

export class GameMenuWin extends Win {
  static id = 'gamemenu'; static title = 'Game Menu'; static glyph = 'menu'; static width = 300;
  build() { this.body.classList.add('ss-gm'); }
  render(d) {
    clear(this.body);
    for (const m of d.items || GM) {
      const b = btn('ss-gm-b', this.body, null, () => this.pick(m.id), m.label);
      b.innerHTML = glyph(m.g || 'right') + `<span>${esc(m.label)}</span>`;
      if (m.id === 'title' || m.id === 'charselect') b.classList.add('is-sep');
    }
  }
  shown() { this.body.querySelector('button')?.focus(); }
  pick(id) {
    this.mgr.close(this.id);
    if (id === 'resume') return;
    if (id === 'settings' || id === 'keys') { const w = this.ui.open('settings'); if (id === 'keys' && w) { w.tab = 'keys'; w.tabs.set('keys'); w.fill(); } }
    if (id === 'photo') this.ui.setHudVisible(false);
    this.ui.emit('gamemenu', { id });
  }
}

export class MapWin extends Win {
  static id = 'map'; static title = 'World Map'; static glyph = 'map'; static width = 760;
  build() {
    const b = this.body;
    b.classList.add('ss-map');
    this.cap = h('div', 'ss-map-cap', b);
    this.frame = h('div', 'ss-map-frame', b);
    this.cv = h('canvas', 'ss-map-cv', this.frame);
    this.legend = h('div', 'ss-map-legend', b);
    this.legend.innerHTML = [['party', 'Party', '#5fb2ff'], ['quest', 'Quest', '#ffb43c'], ['npc', 'NPC', '#ffe07a'], ['portal', 'Portal', '#b47aff'], ['boss', 'Boss', '#ff4a3a'], ['seed', 'Pip Seed', '#7aff8a']].map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('');
    this.cv.addEventListener('click', e => {
      const m = this.m; if (!m) return;
      const r = this.cv.getBoundingClientRect();
      this.ui.emit('map:click', { x: m.x0 + (e.clientX - r.left) / r.width * m.size, z: m.z0 + (e.clientY - r.top) / r.height * m.size });
    });
  }
  render(d) {
    const hs = this.ui.hud.state || {};
    const m = this.m = d && d.canvas ? d : hs.minimap;
    const zone = (d && d.zone) || hs.zone || {};
    this.cap.innerHTML = `<b>${esc(zone.name || 'Unknown')}</b>${zone.sub ? `<span>${esc(zone.sub)}</span>` : ''}`;
    const S = 700, dpr = (globalThis.devicePixelRatio || 1) * this.ui.scale, W = Math.round(S * dpr);
    const cv = this.cv; if (cv.width !== W) { cv.width = cv.height = W; }
    const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#070a12'; x.fillRect(0, 0, W, W);
    if (!m || !m.canvas) return;
    x.imageSmoothingQuality = 'high';
    x.drawImage(m.canvas, 0, 0, W, W);
    const k = W / m.size, u = W / S;
    const col = { party: '#5fb2ff', quest: '#ffb43c', questdone: '#ffd35a', npc: '#ffe07a', vendor: '#ffd35a', portal: '#b47aff', dungeon: '#b47aff', boss: '#ff4a3a', elite: '#ff9a3a', seed: '#7aff8a', triport: '#5fe0e8', objective: '#ffcc55', poi: '#e8ecf5' };
    x.font = `600 ${Math.round(12 * u)}px "Segoe UI", Roboto, sans-serif`; x.textAlign = 'center';
    for (const mk of m.markers || []) {
      if (mk.kind === 'mob') continue;
      const X = (mk.x - m.x0) * k, Y = (mk.z - m.z0) * k;
      x.fillStyle = col[mk.kind] || '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.5 * u;
      x.beginPath(); x.arc(X, Y, 5 * u, 0, 7); x.fill(); x.stroke();
      if (mk.label && mk.kind !== 'party') { x.lineWidth = 3 * u; x.strokeText(mk.label, X, Y - 10 * u); x.fillStyle = '#f1f3f8'; x.fillText(mk.label, X, Y - 10 * u); }
    }
    if (m.you) {
      const X = (m.you.x - m.x0) * k, Y = (m.you.z - m.z0) * k;
      x.save(); x.translate(X, Y); x.rotate(-(m.you.facing || 0));
      x.fillStyle = '#fff4c8'; x.strokeStyle = '#3a2a08'; x.lineWidth = 2 * u;
      x.beginPath(); x.moveTo(0, -11 * u); x.lineTo(8 * u, 8 * u); x.lineTo(0, 4 * u); x.lineTo(-8 * u, 8 * u); x.closePath(); x.fill(); x.stroke();
      x.restore();
    }
  }
}
