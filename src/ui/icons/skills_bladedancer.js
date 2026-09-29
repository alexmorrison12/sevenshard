// Bladedancer — silver and violet, curved twin blades.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, glow, sparkle, slash, slashAB, streak, ring, rays, burst, embers, smoke,
  speedLines, backdrop, rgba, shade, mix, outline, fire, fireLayers, bolt, add, norm, glowPath,
} from './core.js';
import { curvedBlade, figure, moon, skull } from './motifs.js';

const VIO = '#b072ff', SIL = '#dce4f0', HOT = '#f4f0ff', MAG = '#e060ff';
const NIGHT = ['#5c4c8e', '#1c1236', '#04030b'];
const blade = (x, px, py, rot, s, o = {}) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); curvedBlade(x, { metal: 'silver', guard: 'dark', wrap: '#5a3a8a', ...o }); x.restore(); };

export const BLADEDANCER = {
  blitz_rush(x, R) {
    backdrop(x, R, NIGHT, { angle: 0 });
    speedLines(x, R, 18, [0, 14, 70, 88], 0, '#d8c0ff', { len: 34, w: 1.8 });
    glow(x, 66, 50, 38, VIO, 0.7);
    streak(x, 0, 52, 86, 50, 20, VIO, { bias: 2.2 });
    for (const [px, a] of [[28, 0.18], [46, 0.35]]) { x.globalAlpha = a; blade(x, px, 56, PI / 2 + 0.08, 1.3, { glow: VIO }); }
    x.globalAlpha = 1; blade(x, 62, 56, PI / 2 + 0.08, 1.3, { glow: VIO, glowR: 5, edgeGlow: MAG });
    sparkle(x, 92, 50, 11, HOT);
  },
  spincutter(x, R) {
    backdrop(x, R, NIGHT);
    glow(x, 50, 50, 44, VIO, 0.5);
    slash(x, 50, 50, 30, -PI * 0.2, PI * 0.9, 8, VIO, { bias: 1.2 });
    slash(x, 50, 50, 30, PI * 0.8, PI * 1.9, 8, VIO, { bias: 1.2 });
    blade(x, 50, 50, PI * 0.3, 0.9, { edgeGlow: MAG });
    blade(x, 50, 50, PI * 1.3, 0.9, { edgeGlow: MAG });
    x.fillStyle = rg(x, 49, 49, 0, 5, [[0, '#ffffff'], [1, '#6a4a9a']]); circle(x, 50, 50, 4); x.fill(); outline(x, 'rgba(0,0,0,.8)', 0.8);
  },
  maelstrom(x, R) {
    backdrop(x, R, ['#4a3a8a', '#150c30', '#030208']);
    glow(x, 50, 50, 46, VIO, 0.6);
    for (let k = 0; k < 3; k++) glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.02) { const a = t * TAU * 1.2 + k * TAU / 3, r = 6 + t * 38; const px = 50 + Math.cos(a) * r, py = 50 + Math.sin(a) * r; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, k === 1 ? SIL : VIO, 1.8);
    for (let i = 0; i < 7; i++) { const t = 0.25 + i / 8, a = t * TAU * 1.2 + i * 1.3, r = 6 + t * 38; blade(x, 50 + Math.cos(a) * r, 50 + Math.sin(a) * r, a + PI, 0.34); }
    x.fillStyle = rg(x, 50, 50, 0, 8, [[0, '#ffffff'], [1, 'rgba(200,160,255,0)']]); circle(x, 50, 50, 8); x.fill();
  },
  void_strike(x, R) {
    backdrop(x, R, ['#3a2466', '#0c0620', '#020104']);
    glow(x, 50, 50, 46, VIO, 0.6);
    // void sphere
    x.fillStyle = rg(x, 44, 42, 2, 30, [[0, '#2a1450'], [0.6, '#0a0418'], [1, '#000000']]); circle(x, 50, 50, 26); x.fill();
    x.save(); add(x); x.lineWidth = 2.4; x.strokeStyle = rgba(MAG, 0.8); circle(x, 50, 50, 26); x.stroke(); x.lineWidth = 6; x.strokeStyle = rgba(VIO, 0.25); circle(x, 50, 50, 28); x.stroke(); norm(x); x.restore();
    for (let i = 0; i < 10; i++) { const a = R() * TAU; streak(x, 50 + Math.cos(a) * 44, 50 + Math.sin(a) * 44, 50 + Math.cos(a) * 28, 50 + Math.sin(a) * 28, 1.4, VIO, { bias: 0.5 }); }
    slashAB(x, 14, 80, 88, 18, 6, 9, SIL, { hot: '#ffffff' });
    sparkle(x, 50, 50, 10);
  },
  death_trance(x, R) {
    backdrop(x, R, ['#5a2a8a', '#1a0a30', '#040108']);
    glow(x, 50, 56, 46, MAG, 0.5);
    fire(x, R, 50, 96, 64, 64, 0, { n: 7, layers: fireLayers('#1a0430', '#6a1aa8', '#d080ff', '#ffe8ff') });
    x.save(); x.translate(50, 42); skull(x, 0.78, { eyes: MAG, bone: ['#f4ecff', '#c8b8e0', '#6a5a8a', '#2a1e3a'] }); x.restore();
    blade(x, 30, 80, -0.6, 0.9, { edgeGlow: MAG }); blade(x, 70, 80, 0.6, 0.9, { edgeGlow: MAG });
  },
  moonlight_sonic(x, R) {
    backdrop(x, R, ['#4a4a90', '#12123a', '#03030a']);
    for (let i = 0; i < 14; i++) glow(x, R() * 100, R() * 100, 0.8 + R() * 1.5, '#e8e8ff', 0.5);
    glow(x, 50, 48, 44, '#c8c0ff', 0.5);
    x.fillStyle = rg(x, 42, 40, 2, 30, [[0, '#ffffff'], [0.5, '#e0dcff'], [1, '#8a80c8']]); circle(x, 50, 48, 26); x.fill();
    x.fillStyle = 'rgba(120,110,170,.35)'; for (const [cx, cy, r] of [[40, 40, 5], [58, 56, 7], [56, 36, 3]]) { circle(x, cx, cy, r); x.fill(); }
    rays(x, R, 50, 48, 16, 26, 56, '#e0dcff', { alpha: 0.45 });
    slashAB(x, 10, 70, 90, 26, 10, 7, VIO, { hot: '#ffffff' });
    blade(x, 24, 88, 0.9, 0.8, { edgeGlow: MAG });
  },
  soul_absorber(x, R) {
    backdrop(x, R, NIGHT);
    glow(x, 56, 44, 40, '#8af0ff', 0.4);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + 0.3, r = 38, sx = 50 + Math.cos(a) * r, sy = 50 + Math.sin(a) * r;
      glowPath(x, xx => { xx.beginPath(); xx.moveTo(sx, sy); xx.quadraticCurveTo(50 + Math.cos(a + 0.9) * r * 0.6, 50 + Math.sin(a + 0.9) * r * 0.6, 50, 50); }, i % 2 ? '#8af0ff' : VIO, 1.3);
      glow(x, sx, sy, 7, '#c0f8ff', 0.9); x.fillStyle = '#ffffff'; circle(x, sx, sy, 1.6); x.fill();
    }
    blade(x, 50, 76, 0.1, 1.05, { glow: '#8af0ff', glowR: 6, edgeGlow: '#8af0ff' });
  },
  wind_cut(x, R) {
    backdrop(x, R, ['#6a7a9a', '#1a2032', '#040508'], { angle: 0.3 });
    glow(x, 50, 50, 44, SIL, 0.35);
    for (const [y0, y1, w] of [[30, 22, 5], [54, 46, 7], [78, 70, 5]]) slashAB(x, 4, y0, 96, y1, 5, w, '#e8eeff', { hot: '#ffffff' });
    speedLines(x, R, 12, [10, 10, 90, 90], -0.08, '#e8eeff', { len: 18, w: 1 });
    blade(x, 80, 88, -2.2, 0.7);
  },
  dark_order(x, R) {
    backdrop(x, R, NIGHT);
    glow(x, 50, 50, 44, VIO, 0.45);
    // boomerang orbit with return arrow
    x.save(); add(x); x.lineWidth = 2; x.strokeStyle = rgba(VIO, 0.7); x.setLineDash([4, 3]); ellipse(x, 50, 50, 36, 22, -0.4); x.stroke(); x.setLineDash([]); norm(x); x.restore();
    for (const [a, s] of [[0.4, 0.62], [2.2, 0.62], [4.1, 0.62]]) { const px = 50 + Math.cos(a) * 36 * Math.cos(-0.4) - Math.sin(a) * 22 * Math.sin(-0.4), py = 50 + Math.cos(a) * 36 * Math.sin(-0.4) + Math.sin(a) * 22 * Math.cos(-0.4); slash(x, px, py, 9, a, a + 2.4, 3, VIO); blade(x, px, py, a * 2 + 1, s, { edgeGlow: MAG }); }
    x.save(); x.translate(50, 50); x.fillStyle = rg(x, 0, 0, 0, 10, [[0, '#ffffff'], [0.4, '#d8b8ff'], [1, 'rgba(160,100,255,0)']]); circle(x, 0, 0, 10); x.fill(); x.restore();
  },
  upper_slash(x, R) {
    backdrop(x, R, NIGHT, { cy: 70 });
    glow(x, 50, 40, 44, VIO, 0.55);
    slashAB(x, 34, 96, 58, 6, -20, 13, VIO, { hot: '#f0e0ff' });
    blade(x, 58, 22, 0.25, 0.95, { glow: VIO, glowR: 5, edgeGlow: MAG });
    speedLines(x, R, 10, [20, 30, 80, 100], -PI / 2, '#d8c0ff', { len: 22, w: 1.2 });
    sparkle(x, 60, 8, 9, HOT);
  },
  blade_dance(x, R) {
    backdrop(x, R, ['#6a3aa0', '#1c0c3a', '#040108']);
    glow(x, 50, 50, 46, VIO, 0.55);
    const cuts = [[10, 30, 90, 70], [16, 76, 84, 20], [50, 6, 54, 94], [6, 52, 94, 46], [24, 12, 80, 88]];
    cuts.forEach(([ax, ay, bx, by], i) => slashAB(x, ax, ay, bx, by, 8 * (i % 2 ? 1 : -1), 5, i % 2 ? VIO : SIL, { hot: '#ffffff' }));
    sparkle(x, 50, 50, 12);
    embers(x, R, 14, 50, 50, 40, [VIO, HOT]);
  },
  shadow_step(x, R) {
    backdrop(x, R, ['#3a2a60', '#100822', '#020104']);
    smoke(x, R, 10, 40, 60, 30, '#3a1a5a', 0.55, 14);
    glow(x, 60, 50, 36, VIO, 0.5);
    x.globalAlpha = 0.5; figure(x, { head: [30, 34], neck: [30, 40], sh: [[25, 43], [35, 43]], el: [[22, 54], [38, 54]], ha: [[22, 62], [39, 62]], hip: [30, 64], kn: [[27, 76], [33, 76]], ft: [[26, 88], [34, 88]] }, { col: '#6a3aa0', s: 1.1 }); x.globalAlpha = 1;
    figure(x, { head: [62, 32], neck: [60, 38], sh: [[54, 40], [66, 42]], el: [[48, 50], [72, 48]], ha: [[44, 58], [80, 40]], hip: [60, 62], kn: [[54, 74], [68, 72]], ft: [[50, 88], [74, 86]] }, { col: '#0a0414', rim: '#c090ff', s: 1.15 });
    blade(x, 82, 40, 0.6, 0.62, { edgeGlow: MAG });
    streak(x, 30, 50, 60, 46, 3, VIO, { a: 0.7 });
  },
  identity_z(x, R) { // Surge: dash-through that detonates with every orb
    backdrop(x, R, ['#6a3ab0', '#1c0a40', '#040108'], { angle: -0.7 });
    glow(x, 50, 50, 48, MAG, 0.6);
    streak(x, 6, 94, 94, 6, 12, VIO, { even: false, bias: 1 });
    for (let i = 0; i < 5; i++) bolt(x, R, 20 + i * 14, 80 - i * 14, 20 + i * 14 + (R() - 0.5) * 30, 80 - i * 14 + (R() - 0.5) * 30, { col: MAG, w: 1.1, gens: 3 });
    blade(x, 50, 50, PI / 4, 1.1, { glow: MAG, glowR: 6, edgeGlow: '#ffffff' });
    sparkle(x, 84, 16, 11, HOT);
  },
  identity_x(x, R) { // Surge orbs
    backdrop(x, R, NIGHT);
    glow(x, 50, 52, 40, VIO, 0.5);
    for (const [px, py] of [[50, 28], [28, 66], [72, 66]]) { glow(x, px, py, 18, MAG, 0.8); x.fillStyle = rg(x, px - 3, py - 3, 0, 11, [[0, '#ffffff'], [0.4, '#e8c8ff'], [1, VIO]]); circle(x, px, py, 10); x.fill(); outline(x, 'rgba(40,10,80,.8)', 1); sparkle(x, px - 3, py - 3, 4); }
    for (const [a, b] of [[[50, 28], [28, 66]], [[28, 66], [72, 66]], [[72, 66], [50, 28]]]) bolt(x, R, a[0], a[1], b[0], b[1], { col: MAG, w: 1, gens: 4, jit: 0.15 });
  },
  awakening(x, R) { // Thousand Cuts
    backdrop(x, R, ['#7a4ab8', '#1e0c40', '#040108']);
    glow(x, 50, 50, 50, MAG, 0.6);
    for (let i = 0; i < 16; i++) { const a = R() * PI, r = 30 + R() * 16, cx = 50 + (R() - 0.5) * 20, cy = 50 + (R() - 0.5) * 20; slashAB(x, cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r, (R() - 0.5) * 16, 2.6 + R() * 2.6, i % 3 ? VIO : SIL, { hot: '#ffffff' }); }
    burst(x, R, 50, 50, 12, 6, 22, MAG);
    sparkle(x, 50, 50, 16);
  },
};
