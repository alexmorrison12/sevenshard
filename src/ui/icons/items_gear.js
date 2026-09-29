// Gear item renders: weapons, armour, accessories, gems, engraving books. Objects only (background/shadow by index.js).
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, rays, rgba, shade, mix, outline, metal, metalLG, metalRG, gem,
  ribbon, bez, qbez, add, norm, glowPath, tintMetal, rivet, crystal,
} from './core.js';
import { greatsword, longsword, curvedBlade, glaive, pistol, harp, staff, fist, palm, book } from './motifs.js';
import { ENGRAVING_PAINTERS } from './emblems.js';
import { ENGR_COMBAT, ENGR_CLASS, CLASSES } from './ids.js';

const INK = 'rgba(6,4,8,.92)';
/** Tier looks: story (iron/leather), Vanguard (silver/gold/blue), Horned Tyrant (obsidian/crimson, glowing, horned). */
export const TIER = {
  t0: { metal: 'iron', trim: 'bronze', guard: 'iron', cloth: '#6a4424', glow: null, gem: '#8a9aa8', rune: null },
  t1: { metal: 'silver', trim: 'gold', guard: 'gold', cloth: '#2a4a8a', glow: '#6ab8ff', gem: '#3aa0ff', rune: '#8ad0ff' },
  t2: { metal: 'obsidian', trim: 'crimson', guard: 'obsidian', cloth: '#4a0a14', glow: '#ff2a3a', gem: '#ff2a3a', rune: '#ff4050', horns: true },
};
const at = (x, px, py, rot, s, fn, o) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); fn(x, o); x.restore(); };
/** Curved horn pair spreading from (0,0) (the Horned Tyrant motif). */
export function horns(x, cx, cy, s, col = '#e8dcc8') {
  for (const d of [-1, 1]) {
    x.save(); x.translate(cx, cy); x.scale(d * s, s);
    ribbon(x, bez([0, 0], [10, -2], [18, -8], [16, -20]), t => 4.4 * (1 - t) + 0.4, 18);
    x.fillStyle = lg(x, 0, 0, 16, -20, [[0, '#2a1a14'], [0.4, shade(col, -0.35)], [1, col]]); x.fill(); outline(x, INK, 0.7);
    x.restore();
  }
}
function aura(x, t, cx = 50, cy = 50, r = 40) { if (t.glow) glow(x, cx, cy, r, t.glow, t.horns ? 0.45 : 0.3); }

// ------------------------------------------------------------------ weapons
const WEAPON = {
  reaver(x, R, t) {
    aura(x, t);
    at(x, 28, 76, PI / 4, 1.2, greatsword, { metal: t.metal, guard: t.guard, trim: t.trim, gem: t.gem, rune: t.rune, glow: t.horns ? t.glow : null, glowR: 5 });
    if (t.horns) { x.save(); x.translate(28, 76); x.rotate(PI / 4); horns(x, 0, -6, 0.95); x.restore(); }
  },
  oathkeeper(x, R, t) {
    aura(x, t);
    at(x, 28, 76, PI / 4, 1.22, longsword, { metal: t.metal === 'obsidian' ? 'obsidian' : t.metal === 'iron' ? 'steel' : 'silver', guard: t.horns ? 'crimson' : t.trim === 'bronze' ? 'bronze' : 'gold', gem: t.gem, rune: t.rune, guardW: 28, glow: t.horns ? t.glow : null, glowR: 5 });
    if (t.horns) { x.save(); x.translate(28, 76); x.rotate(PI / 4); horns(x, 0, -5, 0.85); x.restore(); }
  },
  stormfist(x, R, t) {
    aura(x, t);
    at(x, 44, 70, -PI / 2 + 0.25, 1.65, fist, { metal: t.metal === 'iron' ? 'iron' : t.metal, trim: t.trim, cuff: t.cloth, glow: t.rune });
    if (t.horns) { for (const [px, py, a] of [[48, 30, -0.3], [58, 30, 0.1], [66, 34, 0.5]]) { x.save(); x.translate(px, py); x.rotate(a); poly(x, [[-2.4, 0], [0, -9], [2.4, 0]]); x.fillStyle = lg(x, 0, 0, 0, -9, [[0, '#3a2020'], [1, '#e8d8c8']]); x.fill(); outline(x, INK, 0.6); x.restore(); } }
  },
  pistoleer(x, R, t) {
    aura(x, t);
    const o = { metal: t.metal === 'silver' ? 'steel' : t.metal === 'obsidian' ? 'obsidian' : 'iron', trim: t.horns ? 'crimson' : t.trim === 'bronze' ? 'bronze' : 'brass' };
    at(x, 36, 42, -0.35, 1.45, pistol, o);
    at(x, 26, 68, -0.2, 1.55, pistol, o);
    if (t.rune) { glow(x, 78, 58, 10, t.rune, 0.7); }
  },
  starcaller(x, R, t) {
    aura(x, t, 64, 34, 30);
    at(x, 16, 100, PI / 4 - 0.05, 1.3, staff, { orb: t.horns ? '#ff3a6a' : t.metal === 'iron' ? '#8ad8ff' : '#b07aff', trim: t.horns ? 'crimson' : t.metal === 'iron' ? 'iron' : 'silver' });
    if (t.horns) { x.save(); x.translate(76, 26); horns(x, 0, 6, 0.6); x.restore(); }
  },
  songweaver(x, R, t) {
    aura(x, t);
    at(x, 50, 82, -0.12, 1.45, harp, { metal: t.horns ? 'obsidian' : t.metal === 'iron' ? 'bronze' : 'rose', strings: t.horns ? '#ff6a7a' : '#7af0e4', gem: t.gem });
    if (t.horns) horns(x, 64, 24, 0.5);
  },
  bladedancer(x, R, t) {
    aura(x, t);
    const o = { metal: t.metal === 'obsidian' ? 'obsidian' : t.metal === 'iron' ? 'steel' : 'silver', guard: t.horns ? 'crimson' : 'dark', wrap: t.horns ? '#5a0a14' : t.metal === 'iron' ? '#5a3a20' : '#5a3a8a', edgeGlow: t.rune, len: 50, w: 8 };
    at(x, 28, 84, 0.55, 1.2, curvedBlade, o);
    x.save(); x.translate(72, 84); x.rotate(-0.55); x.scale(-1.2, 1.2); curvedBlade(x, o); x.restore();
  },
  demonbound(x, R, t) {
    aura(x, t);
    at(x, 18, 98, PI / 4, 1.16, glaive, { len: 66, blade: 28, metal: t.horns ? 'obsidian' : t.metal === 'iron' ? 'iron' : 'dark', bands: t.horns ? 'crimson' : t.trim, edge: t.rune || null, glow: t.horns ? t.glow : null, glowR: 5 });
  },
};

// ------------------------------------------------------------------ armour
function helm(x, R, t) {
  aura(x, t, 50, 48, 38);
  const m = metal(t.metal);
  x.save(); x.translate(50, 54);
  if (t.horns) horns(x, 0, -12, 1.35);
  if (t.metal === 'silver') { // plume
    ribbon(x, bez([0, -28], [-6, -44], [-22, -44], [-30, -30]), u => 8 * Math.sin(PI * u) + 1, 20);
    x.fillStyle = lg(x, -30, -44, 0, -28, [[0, shade(t.cloth, -0.4)], [0.5, mix(t.cloth, '#ffffff', 0.2)], [1, t.cloth]]); x.fill(); outline(x, INK, 0.9);
  }
  x.beginPath(); x.moveTo(-26, 6); x.bezierCurveTo(-28, -32, 28, -32, 26, 6); x.lineTo(22, 28); x.lineTo(7, 32); x.lineTo(5, 8); x.lineTo(-5, 8); x.lineTo(-7, 32); x.lineTo(-22, 28); x.closePath();
  x.fillStyle = rg(x, -9, -16, 1, 42, [[0, m[0]], [0.25, m[1]], [0.6, m[2]], [1, m[4]]]); x.fill(); outline(x, INK, 1.4);
  if (t.metal !== 'iron') { x.fillStyle = metalLG(x, -3, 0, 3, 0, t.trim); poly(x, [[-3, -26], [0, -29], [3, -26], [2.4, 4], [-2.4, 4]]); x.fill(); outline(x, INK, 0.8); }
  x.fillStyle = lg(x, -26, 0, 26, 0, [[0, shade(metal(t.trim)[2], -0.3)], [0.4, metal(t.trim)[1]], [1, shade(metal(t.trim)[2], -0.3)]]);
  x.beginPath(); x.moveTo(-26.5, 1); x.quadraticCurveTo(0, -5, 26.5, 1); x.lineTo(26, 6); x.quadraticCurveTo(0, 0, -26, 6); x.closePath(); x.fill(); outline(x, INK, 0.8);
  x.fillStyle = '#050608'; poly(x, [[-20, 9], [-6, 9], [-6, 15], [-18, 14]]); x.fill(); poly(x, [[20, 9], [6, 9], [6, 15], [18, 14]]); x.fill();
  if (t.glow && t.horns) { glow(x, -12, 12, 8, t.glow, 1); glow(x, 12, 12, 8, t.glow, 1); }
  x.fillStyle = 'rgba(0,0,0,.7)'; for (let i = 0; i < 3; i++) { x.fillRect(-18 + i * 3.4, 20, 1.4, 6); x.fillRect(14.6 - i * 3.4, 20, 1.4, 6); }
  if (t.metal === 'iron') for (const [rx, ry] of [[-20, -8], [20, -8], [-24, 2], [24, 2]]) rivet(x, rx, ry, 1.4, 'bronze');
  x.restore();
}
function shoulder(x, R, t) {
  aura(x, t, 50, 48, 40);
  const m = metal(t.metal);
  x.save(); x.translate(50, 50); x.rotate(-0.2);
  // articulated lames hanging below the cap
  for (let k = 2; k >= 1; k--) {
    const y0 = 6 + k * 10, w = 33 - k * 4;
    x.beginPath(); x.moveTo(-w, y0 - 6); x.quadraticCurveTo(0, y0 + 5, w, y0 - 8); x.lineTo(w - 2, y0 + 2); x.quadraticCurveTo(0, y0 + 15, -w + 2, y0 + 4); x.closePath();
    x.fillStyle = lg(x, 0, y0 - 6, 0, y0 + 14, [[0, m[0]], [0.3, m[1]], [0.75, m[2]], [1, m[4]]]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = metalLG(x, -w, 0, w, 0, t.trim); x.lineWidth = 1.4; x.beginPath(); x.moveTo(-w + 3, y0 + 2.5); x.quadraticCurveTo(0, y0 + 12.5, w - 3, y0 + 0.5); x.stroke();
  }
  if (t.metal === 'iron') { x.fillStyle = lg(x, -40, 0, -30, 0, [[0, '#3a2010'], [1, '#7a5230']]); x.beginPath(); x.roundRect(-44, -4, 10, 30, 2); x.fill(); outline(x, INK, 0.8); x.fillStyle = metalLG(x, -44, 8, -34, 16, 'bronze'); x.fillRect(-45, 8, 12, 7); x.strokeRect(-45, 8, 12, 7); }
  // domed cap
  x.beginPath(); x.moveTo(-38, 6); x.bezierCurveTo(-40, -32, 32, -40, 38, 0); x.quadraticCurveTo(0, 14, -38, 6); x.closePath();
  x.fillStyle = rg(x, -12, -18, 1, 50, [[0, m[0]], [0.25, m[1]], [0.6, m[2]], [1, m[4]]]); x.fill(); outline(x, INK, 1.4);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-30, -6); x.bezierCurveTo(-28, -22, -10, -30, 8, -28); x.stroke();
  // raised ridge
  x.strokeStyle = rgba(m[4], 0.8); x.lineWidth = 1.2; x.beginPath(); x.moveTo(-10, 9); x.bezierCurveTo(-6, -10, 4, -22, 16, -26); x.stroke();
  x.strokeStyle = rgba(m[0], 0.8); x.lineWidth = 0.8; x.beginPath(); x.moveTo(-11.5, 8); x.bezierCurveTo(-7.5, -11, 2.5, -23, 14.5, -27); x.stroke();
  x.strokeStyle = metalLG(x, -38, 0, 38, 0, t.trim); x.lineWidth = 3; x.beginPath(); x.moveTo(-36, 5.5); x.quadraticCurveTo(0, 13, 36, 1); x.stroke(); outline(x, INK, 0.1);
  for (const [px, py] of [[-28, 5.5], [0, 9.5], [26, 4.5]]) rivet(x, px, py, 1.6, t.trim === 'crimson' ? 'dark' : t.trim);
  if (t.horns) for (const [px, py, a] of [[-18, -20, -0.5], [-2, -28, -0.1], [16, -26, 0.35]]) { x.save(); x.translate(px, py); x.rotate(a); poly(x, [[-4, 5], [0, -15], [4, 5]]); x.fillStyle = lg(x, 0, 5, 0, -15, [[0, '#2a1a14'], [1, '#f0e0d0']]); x.fill(); outline(x, INK, 0.8); x.restore(); }
  if (t.gem) { if (t.glow) glow(x, -6, -8, t.horns ? 12 : 8, t.glow, 0.9); gem(x, -6, -8, t.horns ? 5.4 : 4.4, t.gem, { n: 6, spark: false, glow: false, lw: 0.6 }); }
  x.restore();
}
function chest(x, R, t) {
  aura(x, t, 50, 46, 40);
  const m = metal(t.metal);
  x.beginPath();
  x.moveTo(26, 18); x.lineTo(40, 14); x.quadraticCurveTo(50, 22, 60, 14); x.lineTo(74, 18); x.lineTo(84, 30); x.lineTo(76, 40); x.lineTo(74, 84);
  x.quadraticCurveTo(50, 92, 26, 84); x.lineTo(24, 40); x.lineTo(16, 30); x.closePath();
  if (t.metal === 'iron') x.fillStyle = rg(x, 42, 36, 2, 60, [[0, '#b0845a'], [0.4, '#7a5230'], [1, '#2a1406']]);
  else x.fillStyle = rg(x, 42, 36, 2, 60, [[0, m[0]], [0.3, m[1]], [0.65, m[2]], [1, m[4]]]);
  x.fill(); outline(x, INK, 1.4);
  if (t.metal === 'iron') { // leather jerkin: stitching + studs
    x.strokeStyle = 'rgba(255,220,170,.4)'; x.lineWidth = 0.7; x.setLineDash([1.6, 1.6]); x.beginPath(); x.moveTo(50, 22); x.lineTo(50, 86); x.stroke(); x.setLineDash([]);
    for (let r = 0; r < 4; r++) for (const sx of [34, 44, 56, 66]) rivet(x, sx, 40 + r * 11, 1.3, 'iron');
  } else {
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(28, 44); x.quadraticCurveTo(50, 54, 72, 44); x.stroke();
    x.beginPath(); x.moveTo(50, 22); x.lineTo(50, 50); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(28, 45.4); x.quadraticCurveTo(50, 55.4, 72, 45.4); x.stroke();
    for (let i = 0; i < 3; i++) { const yy = 60 + i * 8; x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(27, yy); x.quadraticCurveTo(50, yy + 5, 73, yy); x.stroke(); x.strokeStyle = metalLG(x, 27, 0, 73, 0, t.trim); x.lineWidth = 0.9; x.beginPath(); x.moveTo(27, yy + 1.4); x.quadraticCurveTo(50, yy + 6.4, 73, yy + 1.4); x.stroke(); }
  }
  x.strokeStyle = metalLG(x, 38, 0, 62, 0, t.trim); x.lineWidth = 3; x.beginPath(); x.moveTo(40, 15); x.quadraticCurveTo(50, 23, 60, 15); x.stroke();
  if (t.horns) { for (const s of [-1, 1]) { x.save(); x.translate(50 + s * 30, 22); x.rotate(s * 0.6); poly(x, [[-3.5, 4], [0, -13], [3.5, 4]]); x.fillStyle = lg(x, 0, 4, 0, -13, [[0, '#2a1a14'], [1, '#f0e0d0']]); x.fill(); outline(x, INK, 0.8); x.restore(); } }
  if (t.gem) { if (t.glow) glow(x, 50, 36, t.horns ? 14 : 9, t.glow, 0.9); gem(x, 50, 36, t.horns ? 6 : 4.8, t.gem, { glow: false, n: 6, lw: 0.7 }); }
  if (t.metal === 'silver') { x.fillStyle = lg(x, 42, 56, 58, 90, [[0, mix(t.cloth, '#ffffff', 0.15)], [1, shade(t.cloth, -0.5)]]); poly(x, [[43, 84], [57, 84], [55, 96], [50, 99], [45, 96]]); x.fill(); outline(x, INK, 0.8); }
}
function pants(x, R, t) {
  aura(x, t, 50, 52, 40);
  const m = metal(t.metal), cloth = t.cloth;
  x.beginPath(); x.moveTo(26, 12); x.lineTo(74, 12); x.lineTo(80, 88); x.lineTo(58, 90); x.lineTo(51, 36); x.lineTo(49, 36); x.lineTo(42, 90); x.lineTo(20, 88); x.closePath();
  x.fillStyle = rg(x, 40, 30, 2, 70, [[0, shade(cloth, 0.45)], [0.5, cloth], [1, shade(cloth, -0.75)]]); x.fill(); outline(x, INK, 1.3);
  // belt
  x.fillStyle = lg(x, 0, 12, 0, 20, [[0, '#6a4a2a'], [1, '#2a1808']]); x.fillRect(25, 11, 50, 8); x.strokeStyle = INK; x.lineWidth = 0.8; x.strokeRect(25, 11, 50, 8);
  x.fillStyle = metalLG(x, 45, 10, 55, 20, t.trim); x.fillRect(45, 10, 10, 10); x.strokeRect(45, 10, 10, 10);
  if (t.metal !== 'iron') { // tassets + greaves
    for (const s of [-1, 1]) {
      x.beginPath(); x.moveTo(50 + s * 3, 20); x.lineTo(50 + s * 24, 20); x.lineTo(50 + s * 25, 36); x.quadraticCurveTo(50 + s * 14, 40, 50 + s * 4, 36); x.closePath();
      x.fillStyle = lg(x, 50, 20, 50 + s * 25, 40, [[0, m[0]], [0.5, m[1]], [1, m[3]]]); x.fill(); outline(x, INK, 0.9);
      x.beginPath(); x.moveTo(50 + s * 8, 58); x.lineTo(50 + s * 26, 56); x.lineTo(50 + s * 28, 88); x.lineTo(50 + s * 10, 89); x.closePath();
      x.fillStyle = lg(x, 50 + s * 8, 0, 50 + s * 28, 0, [[0, m[1]], [0.3, m[0]], [0.6, m[2]], [1, m[4]]]); x.fill(); outline(x, INK, 0.9);
    }
  }
  for (const kx of [31, 69]) { x.fillStyle = rg(x, kx - 2, 54, 1, 10, [[0, m[0]], [0.35, m[1]], [1, m[3]]]); ellipse(x, kx, 56, 8, 8.5); x.fill(); outline(x, INK, 0.9); if (t.horns) { x.save(); x.translate(kx, 52); poly(x, [[-2.4, 0], [0, -8], [2.4, 0]]); x.fillStyle = '#e8d8c8'; x.fill(); outline(x, INK, 0.6); x.restore(); } }
  if (t.glow && t.horns) for (const kx of [31, 69]) glow(x, kx, 56, 7, t.glow, 0.9);
}
function gloves(x, R, t) {
  aura(x, t, 50, 48, 40);
  const m = metal(t.metal);
  x.save(); x.translate(50, 54); x.rotate(-0.18); x.scale(1.25, 1.25);
  palm(x);
  if (t.metal === 'iron') x.fillStyle = rg(x, -4, -8, 1, 32, [[0, '#c08a58'], [0.5, '#7a4a24'], [1, '#2a1406']]);
  else x.fillStyle = rg(x, -4, -8, 1, 32, [[0, m[0]], [0.35, m[1]], [0.75, m[2]], [1, m[4]]]);
  x.fill(); outline(x, INK, 1.1);
  for (const [fx, fy] of [[-10.5, -12], [-4, -16], [3, -16], [9.5, -12]]) { x.beginPath(); x.roundRect(fx - 2.8, fy - 3, 5.6, 5, 1.5); x.fillStyle = metalLG(x, fx - 3, fy - 3, fx + 3, fy + 2, t.metal === 'iron' ? 'iron' : t.trim); x.fill(); outline(x, INK, 0.6); }
  if (t.horns) for (const [fx, ty] of [[-10.5, -22], [-4, -30], [3, -31], [9.5, -25]]) { poly(x, [[fx - 2.4, ty + 2], [fx, ty - 5], [fx + 2.4, ty + 2]]); x.fillStyle = '#f0e0d0'; x.fill(); outline(x, INK, 0.5); }
  x.fillStyle = lg(x, -16, 0, 16, 0, [[0, shade(t.cloth, -0.6)], [0.5, shade(t.cloth, 0.25)], [1, shade(t.cloth, -0.7)]]);
  poly(x, [[-15, 18], [15, 18], [18, 34], [-18, 34]]); x.fill(); outline(x, INK, 1);
  x.strokeStyle = metalLG(x, -18, 0, 18, 0, t.trim); x.lineWidth = 2; x.beginPath(); x.moveTo(-15, 19.5); x.lineTo(15, 19.5); x.stroke();
  if (t.gem) { if (t.glow) glow(x, 0, 4, 9, t.glow, 0.8); gem(x, 0, 4, 3.6, t.gem, { glow: false, n: 6, lw: 0.6, spark: false }); }
  x.restore();
}
const ARMOR = { head: helm, shoulder, chest, pants, gloves };

// ------------------------------------------------------------------ accessories
const ACC = {
  necklace(x, R) {
    x.strokeStyle = metalLG(x, 10, 0, 90, 40, 'gold'); x.lineWidth = 1.8;
    for (const s of [-1, 1]) for (let i = 0; i < 12; i++) { const t = i / 11, px = 50 + s * (36 - t * 30), py = 8 + t * 40 - Math.sin(t * PI) * 6; ellipse(x, px, py, 2.2, 1.3, (s > 0 ? -0.9 : 0.9) + (PI / 2) * (i % 2)); x.stroke(); }
    x.fillStyle = metalLG(x, 34, 46, 66, 92, 'gold');
    x.beginPath(); x.moveTo(50, 46); x.bezierCurveTo(68, 54, 70, 78, 50, 92); x.bezierCurveTo(30, 78, 32, 54, 50, 46); x.closePath(); x.fill(); outline(x, INK, 1.2);
    const col = '#3ab0ff';
    glow(x, 50, 72, 22, col, 0.5);
    x.fillStyle = rg(x, 46, 64, 0.5, 15, [[0, '#ffffff'], [0.3, shade(col, 0.4)], [0.75, col], [1, shade(col, -0.6)]]);
    x.beginPath(); x.moveTo(50, 54); x.bezierCurveTo(62, 62, 63, 78, 50, 87); x.bezierCurveTo(37, 78, 38, 62, 50, 54); x.closePath(); x.fill(); outline(x, 'rgba(0,0,0,.7)', 0.8);
    x.fillStyle = metalRG(x, 50, 46, 5, 'gold'); circle(x, 50, 46, 4.4); x.fill(); outline(x, INK, 0.8);
    sparkle(x, 45, 63, 6);
  },
  earring(x, R) {
    // hook + stud + drop
    x.lineWidth = 2.2; x.strokeStyle = metalLG(x, 40, 8, 60, 30, 'gold'); x.beginPath(); x.arc(50, 22, 10, PI * 0.95, PI * 2.3); x.stroke(); outline(x, INK, 0.4);
    x.fillStyle = metalRG(x, 50, 34, 5, 'gold'); circle(x, 50, 34, 4.6); x.fill(); outline(x, INK, 0.8);
    x.strokeStyle = metalLG(x, 48, 38, 52, 50, 'gold'); x.lineWidth = 1.6; x.beginPath(); x.moveTo(50, 38); x.lineTo(50, 48); x.stroke();
    const col = '#c050ff';
    glow(x, 50, 68, 24, col, 0.5);
    x.fillStyle = metalLG(x, 36, 46, 64, 92, 'gold'); x.beginPath(); x.moveTo(50, 46); x.bezierCurveTo(66, 58, 66, 82, 50, 92); x.bezierCurveTo(34, 82, 34, 58, 50, 46); x.closePath(); x.fill(); outline(x, INK, 1.1);
    x.fillStyle = rg(x, 46, 62, 0.5, 16, [[0, '#ffffff'], [0.3, shade(col, 0.45)], [0.75, col], [1, shade(col, -0.6)]]); x.beginPath(); x.moveTo(50, 52); x.bezierCurveTo(61, 62, 61, 80, 50, 87); x.bezierCurveTo(39, 80, 39, 62, 50, 52); x.closePath(); x.fill();
    sparkle(x, 46, 62, 6);
  },
  ring(x, R) {
    x.lineWidth = 9; x.strokeStyle = metalLG(x, 20, 40, 80, 70, 'gold'); ellipse(x, 50, 62, 26, 20); x.stroke();
    x.lineWidth = 1; x.strokeStyle = INK; ellipse(x, 50, 62, 30.5, 24.5); x.stroke(); ellipse(x, 50, 62, 21.5, 15.5); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.4; x.beginPath(); x.ellipse(50, 62, 28, 22, 0, 3.4, 4.3); x.stroke();
    x.fillStyle = metalLG(x, 38, 30, 62, 46, 'gold'); poly(x, [[36, 46], [41, 32], [59, 32], [64, 46]]); x.fill(); outline(x, INK, 1);
    gem(x, 50, 32, 11, '#ff3050', { glowA: 0.55 });
  },
  stone(x, R) {
    // ability stone: a faceted rune-stone with three facet lines (2 blue engravings, 1 red penalty)
    glow(x, 50, 50, 40, '#4ab0ff', 0.35);
    const O = [[36, 8], [64, 8], [84, 26], [84, 74], [64, 92], [36, 92], [16, 74], [16, 26]];
    poly(x, O); x.fillStyle = rg(x, 38, 30, 2, 64, [[0, '#b8c8e0'], [0.35, '#5a6a8a'], [0.8, '#1e2638'], [1, '#0a0c14']]); x.fill(); outline(x, INK, 1.5);
    // bevel facets
    const I = [[40, 18], [60, 18], [74, 30], [74, 70], [60, 82], [40, 82], [26, 70], [26, 30]];
    for (let i = 0; i < 8; i++) { const j = (i + 1) % 8, lit = 0.5 + 0.5 * Math.cos(((i + 0.5) / 8) * TAU + PI * 0.25 + PI); poly(x, [O[i], O[j], I[j], I[i]]); x.fillStyle = rgba(lit > 0.5 ? '#e8f0ff' : '#000010', Math.abs(lit - 0.5) * 0.7); x.fill(); }
    poly(x, I); x.fillStyle = rg(x, 42, 36, 2, 40, [[0, '#6a7a9a'], [0.6, '#2a3248'], [1, '#141824']]); x.fill(); outline(x, 'rgba(0,0,0,.6)', 0.8);
    x.strokeStyle = metalLG(x, 26, 18, 74, 82, 'gold'); x.lineWidth = 1.4; poly(x, I); x.stroke();
    for (let r = 0; r < 3; r++) {
      const yy = 36 + r * 14, col = r === 2 ? '#ff4a3a' : '#4ab8ff', lit = [4, 3, 1][r];
      for (let i = 0; i < 5; i++) { const px = 32 + i * 9, py = yy; if (i < lit) glow(x, px, py, 5.5, col, 0.9); x.fillStyle = i < lit ? rg(x, px - 0.5, py - 0.5, 0, 3, [[0, '#ffffff'], [1, col]]) : '#0c0e16'; poly(x, [[px, py - 3.2], [px + 3.2, py], [px, py + 3.2], [px - 3.2, py]]); x.fill(); outline(x, INK, 0.6); }
    }
    sparkle(x, 38, 16, 6);
  },
  bracelet(x, R) {
    x.lineWidth = 10; x.strokeStyle = metalLG(x, 16, 40, 84, 76, 'silver'); ellipse(x, 50, 56, 32, 18); x.stroke();
    x.lineWidth = 1; x.strokeStyle = INK; ellipse(x, 50, 56, 37, 23); x.stroke(); ellipse(x, 50, 56, 27, 13); x.stroke();
    x.strokeStyle = metalLG(x, 16, 40, 84, 76, 'gold'); x.lineWidth = 1.6; ellipse(x, 50, 56, 35, 21); x.stroke(); ellipse(x, 50, 56, 29, 15); x.stroke();
    for (const [px, py, c] of [[50, 74, '#3ad0a0'], [28, 68, '#ff4a6a'], [72, 68, '#4a9aff']]) gem(x, px, py, 5.4, c, { n: 6, glowA: 0.4, spark: false, lw: 0.6 });
    sparkle(x, 34, 44, 5);
  },
};

// ------------------------------------------------------------------ gems (Ruinstone red / Swiftstone blue, levels 1–10)
function gemIcon(x, R, kind, lv) {
  const k = (lv - 1) / 9;
  const base = kind === 'ruin' ? mix('#8a3a3a', '#ff1a2a', k) : mix('#3a5a8a', '#1a9aff', k);
  const col = kind === 'ruin' ? mix(base, '#ff6a3a', k * 0.25) : mix(base, '#40e0ff', k * 0.3);
  const r = 25 + k * 8;
  if (lv >= 4) glow(x, 50, 52, r * 2.1, col, 0.25 + k * 0.5);
  if (lv >= 10) rays(x, R, 50, 52, 16, r * 0.8, r * 2.2, mix(col, '#ffffff', 0.4), { alpha: 0.5 });
  if (lv >= 7) { // gold bezel
    const n = kind === 'ruin' ? 8 : 6;
    x.save(); x.translate(50, 52);
    poly(x, Array.from({ length: n }, (_, i) => { const a = -PI / 2 + i / n * TAU; return [Math.cos(a) * (r + 4), Math.sin(a) * (r + 4) * (kind === 'ruin' ? 1 : 1.25)]; }));
    x.fillStyle = metalLG(x, -r, -r, r, r, 'gold'); x.fill(); outline(x, INK, 1);
    x.restore();
  }
  if (kind === 'ruin') gem(x, 50, 52, r, col, { n: 8, glow: false, inner: 0.52 + k * 0.08 });
  else gem(x, 50, 52, r, col, { n: 6, sy: 1.25, glow: false, inner: 0.5 + k * 0.08 });
  if (lv < 4) { x.fillStyle = 'rgba(40,30,30,.28)'; circle(x, 50, 52, r * 0.9); x.fill(); }
  if (lv >= 5) sparkle(x, 38, 36, 6 + k * 4);
  if (lv >= 8) sparkle(x, 66, 70, 5);
  if (lv >= 10) glow(x, 50, 52, r * 0.9, '#ffffff', 0.35);
}

// ------------------------------------------------------------------ engraving books
const CLASS_OF = {}; for (const c in ENGR_CLASS) for (const e of ENGR_CLASS[c]) CLASS_OF[e] = c;
const CLASS_COVER = { reaver: '#8a1a22', oathkeeper: '#2a4a8a', stormfist: '#1a4a7a', pistoleer: '#6a3a14', starcaller: '#4a2a8a', songweaver: '#8a3a4a', bladedancer: '#3a2a6a', demonbound: '#3a0e2e' };
function engrBook(x, R, e) {
  const cls = CLASS_OF[e];
  const cover = cls ? CLASS_COVER[cls] : '#2a3448';
  x.save(); x.translate(52, 52); x.rotate(-0.08);
  book(x, 54, 70, cover, { trim: cls ? 'gold' : 'silver' });
  // emblem medallion on the cover
  x.save(); x.beginPath(); x.arc(3, -2, 17, 0, TAU); x.clip();
  x.translate(3 - 17, -2 - 17); x.scale(0.34, 0.34); ENGRAVING_PAINTERS[e](x, R); x.restore();
  x.lineWidth = 2.6; x.strokeStyle = metalLG(x, -14, -19, 20, 15, cls ? 'gold' : 'silver'); circle(x, 3, -2, 17.2); x.stroke(); outline(x, INK, 0.6);
  x.restore();
}

export const GEAR_PAINT = {};
for (const c of CLASSES) {
  for (const tk of ['t0', 't1', 't2']) GEAR_PAINT[`item:weapon:${c}:${tk}`] = (x, R) => WEAPON[c](x, R, TIER[tk]);
  GEAR_PAINT[`item:weapon:${c}`] = (x, R) => WEAPON[c](x, R, TIER.t1);
}
for (const s in ARMOR) for (const tk of ['t0', 't1', 't2']) GEAR_PAINT[`item:${s}:${tk}`] = (x, R) => ARMOR[s](x, R, TIER[tk]);
for (const a in ACC) GEAR_PAINT[`item:${a}`] = ACC[a];
for (const k of ['ruin', 'swift']) for (let i = 1; i <= 10; i++) GEAR_PAINT[`item:gem:${k}:${i}`] = (x, R) => gemIcon(x, R, k, i);
for (const e of [...ENGR_COMBAT, ...Object.values(ENGR_CLASS).flat()]) GEAR_PAINT[`item:book:${e}`] = (x, R) => engrBook(x, R, e);
