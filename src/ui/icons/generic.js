// Generic painters: item-slot / grade backgrounds and the tasteful per-prefix fallbacks for unknown ids.
import {
  TAU, PI, lg, rg, poly, circle, ellipse, star, glow, sparkle, slash, backdrop, rgba, shade, mix, outline, metalLG, metalRG,
  gem, rays, burst, embers, shadowBlob,
} from './core.js';
import { GRADES } from './ids.js';
import { palOf, hueBg } from './palette.js';

// ------------------------------------------------------------------ grade backgrounds (Lost Ark style: dark → grade colour, bottom-right)
export const GRADE_BG = [
  ['#121316', '#26282d', '#6a6d74'],
  ['#0a1208', '#1a3013', '#4f8a38'],
  ['#060c16', '#0f2a52', '#2a74cc'],
  ['#0c0816', '#2a1446', '#7438bc'],
  ['#140b03', '#3e2306', '#cc7616'],
  ['#140502', '#461606', '#d84a14'],
  ['#221c12', '#6a5636', '#e8d0a0'],
  ['#021412', '#08403c', '#1cc4b6'],
];
export function gradeBack(x, R, g) {
  const p = GRADE_BG[g] || GRADE_BG[0], col = (GRADES[g] || GRADES[0]).color;
  x.fillStyle = lg(x, 0, 0, 100, 100, [[0, p[0]], [0.55, p[1]], [1, p[2]]]); x.fillRect(0, 0, 100, 100);
  x.fillStyle = rg(x, 92, 96, 0, 70, [[0, rgba(mix(col, '#ffffff', 0.25), g >= 6 ? 0.55 : 0.4)], [1, rgba(col, 0)]]); x.fillRect(0, 0, 100, 100);
  x.fillStyle = rg(x, 18, 14, 0, 50, [[0, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, 0, 100, 100);
  if (g === 6) { // ancient: pale gold shimmer bands
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { x.fillStyle = lg(x, 0, 0, 100, 100, [[0.25 + i * 0.18, 'rgba(255,240,200,0)'], [0.3 + i * 0.18, 'rgba(255,240,200,.10)'], [0.35 + i * 0.18, 'rgba(255,240,200,0)']]); x.fillRect(0, 0, 100, 100); }
    x.globalCompositeOperation = 'source-over';
  }
  if (g === 7) { // primal: teal glow + motes
    glow(x, 78, 80, 55, '#39e6d8', 0.45);
    for (let i = 0; i < 9; i++) { const px = 30 + R() * 68, py = 30 + R() * 68; glow(x, px, py, 2 + R() * 3, '#9ffff4', 0.6); }
  }
}
/** Neutral backdrop for items requested without a grade. */
export function itemNeutral(x, R) {
  backdrop(x, R, ['#3a3e4a', '#181a22', '#07080b'], { n: 16, alpha: 0.08, shaft: false, cx: 46, cy: 42 });
}

// ------------------------------------------------------------------ fallbacks (also the early placeholders)
export function genericSkill(x, R, o) {
  const P = palOf(o.parts[1]);
  backdrop(x, R, P.bg);
  const a = -2.4 + R() * 0.6;
  glow(x, 52, 50, 44, P.main, 0.5);
  slash(x, 50, 54, 34, a, a + 2.3, 11, P.main);
  burst(x, R, 64, 36, 9, 4, 16, P.main);
  sparkle(x, 66, 34, 9, P.hot);
  embers(x, R, 10, 52, 52, 36, [P.main, P.hot, P.ember]);
}
export function genericItem(x, R) {
  // leather pouch with a glowing clasp
  shadowBlob(x, 50, 84, 30, 6, 0.55);
  x.beginPath(); x.moveTo(30, 40); x.bezierCurveTo(14, 58, 18, 86, 50, 86); x.bezierCurveTo(82, 86, 86, 58, 70, 40); x.closePath();
  x.fillStyle = rg(x, 40, 52, 2, 44, [[0, '#c08a58'], [0.5, '#7a4a24'], [1, '#2a1406']]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 1.3);
  x.beginPath(); x.moveTo(30, 40); x.quadraticCurveTo(50, 30, 70, 40); x.lineTo(76, 26); x.quadraticCurveTo(50, 16, 24, 26); x.closePath();
  x.fillStyle = lg(x, 0, 18, 0, 40, [[0, '#a8744a'], [1, '#4a2810']]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 1.1);
  x.strokeStyle = metalLG(x, 28, 0, 72, 0, 'gold'); x.lineWidth = 2.4; x.beginPath(); x.moveTo(31, 41); x.quadraticCurveTo(50, 33, 69, 41); x.stroke();
  gem(x, 50, 40, 5.5, '#40c8ff', { glowA: 0.6 });
}
export function genericRound(x, R, o) {
  const col = ['#6ab8ff', '#ffb040', '#c070ff', '#50e0a0', '#ff6060'][hashPick(o.base, 5)];
  x.fillStyle = rg(x, 44, 40, 2, 60, [[0, shade(col, -0.35)], [0.55, shade(col, -0.78)], [1, '#050608']]); x.fillRect(0, 0, 100, 100);
  glow(x, 50, 50, 34, col, 0.5);
  star(x, 50, 50, 4, 9, 30); x.fillStyle = lg(x, 30, 25, 70, 75, [[0, '#ffffff'], [0.4, shade(col, 0.4)], [1, shade(col, -0.4)]]); x.fill(); outline(x, 'rgba(0,0,0,.6)', 1);
  sparkle(x, 50, 50, 10);
}
export function genericClass(x, R, o) {
  heater(x, 50, 50, 1, '#3a4660', '#c9a45a');
  star(x, 50, 48, 4, 5, 18); x.fillStyle = metalLG(x, 34, 30, 66, 66, 'gold'); x.fill(); outline(x, 'rgba(0,0,0,.7)', 0.8);
  void R; void o;
}
export function genericCurrency(x) {
  coin(x, 50, 52, 30, 'gold');
}
export function genericStatus(x, R, o) {
  const col = o.debuff ? '#ff5a4a' : '#5ac8ff';
  x.fillStyle = rg(x, 44, 40, 2, 70, [[0, shade(col, -0.4)], [1, '#050608']]); x.fillRect(0, 0, 100, 100);
  glow(x, 50, 50, 36, col, 0.6);
  poly(x, [[50, 18], [80, 50], [50, 82], [20, 50]]); x.fillStyle = lg(x, 25, 20, 75, 80, [[0, '#ffffff'], [0.4, col], [1, shade(col, -0.5)]]); x.fill(); outline(x, 'rgba(0,0,0,.8)', 2);
}
export function genericUI(x) {
  x.save(); x.translate(50, 50);
  poly(x, [[0, -34], [30, 0], [0, 34], [-30, 0]]); x.fillStyle = metalLG(x, -30, -30, 30, 30, 'gold'); x.fill(); outline(x, 'rgba(0,0,0,.8)', 2);
  poly(x, [[0, -18], [16, 0], [0, 18], [-16, 0]]); x.fillStyle = '#1a1c24'; x.fill();
  x.restore();
}
export function genericBoss(x, R) {
  x.fillStyle = rg(x, 50, 40, 2, 64, [[0, '#5a1a14'], [0.6, '#1c0606'], [1, '#050102']]); x.fillRect(0, 0, 100, 100);
  glow(x, 50, 70, 50, '#ff4020', 0.35);
  // horned head silhouette
  x.beginPath(); x.moveTo(26, 96); x.bezierCurveTo(26, 70, 32, 52, 38, 46); x.bezierCurveTo(28, 36, 18, 24, 12, 8); x.bezierCurveTo(26, 18, 34, 26, 42, 34);
  x.bezierCurveTo(46, 32, 54, 32, 58, 34); x.bezierCurveTo(66, 26, 74, 18, 88, 8); x.bezierCurveTo(82, 24, 72, 36, 62, 46); x.bezierCurveTo(68, 52, 74, 70, 74, 96); x.closePath();
  x.fillStyle = lg(x, 30, 20, 70, 90, [[0, '#4a3a3a'], [1, '#0a0606']]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 1.2);
  glow(x, 43, 52, 6, '#ff5020', 1); glow(x, 57, 52, 6, '#ff5020', 1);
  void R;
}
export function genericNpc(x, R) {
  backdrop(x, R, ['#5a5040', '#241e16', '#070504'], { shaft: false });
  x.beginPath(); x.moveTo(14, 100); x.bezierCurveTo(16, 72, 30, 64, 38, 60); x.bezierCurveTo(26, 50, 28, 20, 50, 18); x.bezierCurveTo(72, 20, 74, 50, 62, 60);
  x.bezierCurveTo(70, 64, 84, 72, 86, 100); x.closePath();
  x.fillStyle = lg(x, 30, 20, 70, 100, [[0, '#6a5a48'], [1, '#1a1410']]); x.fill(); outline(x, 'rgba(0,0,0,.8)', 1.2);
  shadowBlob(x, 50, 44, 12, 12, 0.6);
}
export function genericTripod(x, R, o) { genericRound(x, R, o); }

// ------------------------------------------------------------------ small shared shapes
/** Heater shield centred at (cx,cy), ~60 units tall at s = 1. */
export function heaterPath(x, cx, cy, s = 1) {
  x.beginPath(); x.moveTo(cx - 28 * s, cy - 30 * s); x.quadraticCurveTo(cx, cy - 36 * s, cx + 28 * s, cy - 30 * s);
  x.bezierCurveTo(cx + 30 * s, cy + 2 * s, cx + 20 * s, cy + 22 * s, cx, cy + 36 * s);
  x.bezierCurveTo(cx - 20 * s, cy + 22 * s, cx - 30 * s, cy + 2 * s, cx - 28 * s, cy - 30 * s); x.closePath();
}
export function heater(x, cx, cy, s, field, trim, o = {}) {
  heaterPath(x, cx, cy, s);
  x.fillStyle = rg(x, cx - 10 * s, cy - 14 * s, 2, 50 * s, [[0, shade(field, 0.35)], [0.6, field], [1, shade(field, -0.6)]]); x.fill();
  x.lineWidth = (o.trimW ?? 4.4) * s; x.strokeStyle = metalLG(x, cx - 30 * s, cy - 30 * s, cx + 30 * s, cy + 30 * s, o.trimMetal || 'gold'); x.stroke();
  heaterPath(x, cx, cy, s * 1.07); outline(x, 'rgba(0,0,0,.85)', 1.4 * s);
  heaterPath(x, cx, cy, s * 0.92); outline(x, 'rgba(0,0,0,.45)', 0.8 * s);
  void trim;
}
export function coin(x, cx, cy, r, m = 'gold', o = {}) {
  const pm = typeof m === 'string' ? m : m;
  shadowBlob(x, cx + 2, cy + r * 0.85, r * 0.95, r * 0.28, 0.5);
  // rim thickness
  ellipse(x, cx, cy + r * 0.12, r, r * (o.sy ?? 0.92)); x.fillStyle = metalLG(x, cx - r, cy, cx + r, cy, pm); x.fill(); outline(x, 'rgba(0,0,0,.85)', 1.1);
  ellipse(x, cx, cy, r, r * (o.sy ?? 0.92)); x.fillStyle = metalRG(x, cx, cy, r * 1.1, pm); x.fill(); outline(x, 'rgba(0,0,0,.75)', 1);
  ellipse(x, cx, cy, r * 0.8, r * 0.8 * (o.sy ?? 0.92)); x.lineWidth = 1.2; x.strokeStyle = rgba('#000000', 0.35); x.stroke();
  ellipse(x, cx, cy + 0.6, r * 0.8, r * 0.8 * (o.sy ?? 0.92)); x.lineWidth = 0.7; x.strokeStyle = rgba('#ffffff', 0.4); x.stroke();
  if (o.emblem !== false) { star(x, cx, cy, 4, r * 0.14, r * 0.5); x.fillStyle = rgba('#000000', 0.25); x.fill(); star(x, cx - 0.5, cy - 0.7, 4, r * 0.14, r * 0.5); x.fillStyle = metalLG(x, cx - r, cy - r, cx + r, cy + r, pm); x.fill(); }
  sparkle(x, cx - r * 0.45, cy - r * 0.45, r * 0.35);
}
export function hashPick(s, n) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % n; }
export { hueBg, TAU, PI, rays };
