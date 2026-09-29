// Stormfist — electric blue & amber, gauntlets and kicks.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, glow, sparkle, slash, slashAB, streak, ring, rays, burst, embers, rocks, cracks, smoke,
  speedLines, backdrop, rgba, shade, mix, outline, fire, fireLayers, bolt, clouds, add, norm, ribbon, bez, qbez, glowPath,
} from './core.js';
import { fist, boot, palm, dragon, tigerHead, figure } from './motifs.js';

const BLUE = '#46b6ff', HOT = '#e8f8ff', AMBER = '#ffae2e';
const NIGHT = ['#2a6cb4', '#0c2448', '#02050c'];
const DUSK = ['#b87a2a', '#3a200a', '#070402'];
const at = (x, px, py, rot, s, fn, o) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); fn(x, o); x.restore(); };
const zap = (x, R, cx, cy, r, n, col = BLUE) => { for (let i = 0; i < n; i++) { const a = R() * TAU, b = a + (R() - 0.5) * 1.6; bolt(x, R, cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3, cx + Math.cos(b) * r, cy + Math.sin(b) * r, { col, w: 1.3, gens: 4, jit: 0.35 }); } };

export const STORMFIST = {
  lightning_kick(x, R) {
    backdrop(x, R, NIGHT, { angle: -0.8 });
    glow(x, 70, 30, 40, BLUE, 0.7);
    slashAB(x, 36, 92, 84, 18, -22, 12, BLUE, { hot: HOT });
    figure(x, { head: [30, 32], neck: [32, 38], sh: [[25, 41], [38, 42]], el: [[18, 52], [44, 52]], ha: [[12, 46], [46, 60]], hip: [38, 62], kn: [[32, 76], [56, 50]], ft: [[28, 94], [74, 30]] },
      { col: '#060c18', rim: '#6ac8ff', s: 1.3 });
    glow(x, 74, 30, 14, HOT, 1);
    zap(x, R, 74, 30, 26, 5);
    sparkle(x, 76, 28, 10, HOT);
  },
  blazing_fist(x, R) {
    backdrop(x, R, DUSK, { angle: 0 });
    glow(x, 58, 50, 44, AMBER, 0.6);
    fire(x, R, 50, 52, 52, 30, -PI / 2, { n: 5 });
    at(x, 46, 52, 0, 1.25, fist, { metal: 'steel', cuff: '#4a2a14' });
    burst(x, R, 84, 50, 12, 6, 22, AMBER);
    sparkle(x, 86, 48, 9, '#fff4d0');
    embers(x, R, 14, 60, 50, 36, [AMBER, '#ffd870', '#ff6a20']);
  },
  tempest_barrage(x, R) {
    backdrop(x, R, NIGHT, { angle: 0 });
    glow(x, 70, 50, 38, BLUE, 0.6);
    const fs = [[30, 28, 0.62, 0.35], [26, 72, 0.62, 0.35], [40, 40, 0.7, 0.55], [38, 62, 0.7, 0.55], [48, 50, 0.9, 1]];
    for (const [px, py, s, a] of fs) { streak(x, px - 30, py, px + 8, py, 5 * s, BLUE, { a: a * 0.8 }); x.globalAlpha = a; at(x, px, py, 0, s, fist, { metal: 'steel', cuff: '#1a2a44' }); x.globalAlpha = 1; }
    for (const [px, py] of [[74, 30], [80, 52], [72, 72]]) burst(x, R, px, py, 9, 3, 12, BLUE);
    zap(x, R, 78, 50, 22, 4);
  },
  sweeping_kick(x, R) {
    backdrop(x, R, ['#9a7a4a', '#2e2214', '#060403'], { cy: 30 });
    smoke(x, R, 10, 50, 84, 44, '#8a7050', 0.45, 12);
    glow(x, 60, 76, 44, AMBER, 0.45);
    slash(x, 48, 78, 42, PI * 0.15, PI * 1.2, 10, AMBER, { sy: 0.34, bias: 1.2 });
    slash(x, 48, 78, 34, PI * 0.25, PI * 1.15, 5, '#fff0c0', { sy: 0.34, bias: 1.2 });
    figure(x, { head: [36, 44], neck: [38, 50], sh: [[32, 53], [45, 54]], el: [[24, 62], [52, 62]], ha: [[18, 72], [58, 70]], hip: [44, 70], kn: [[34, 78], [62, 76]], ft: [[40, 92], [86, 80]] },
      { col: '#140c06', rim: '#ffc060', s: 1.3 });
    rocks(x, R, 8, 56, 82, 34, { cols: ['#7a6040', '#3a2a18'], size: 2.2, sy: 0.4 });
    sparkle(x, 86, 80, 8, '#fff0c0');
  },
  storm_dragon_upper(x, R) {
    backdrop(x, R, NIGHT, { cy: 60 });
    glow(x, 50, 50, 46, BLUE, 0.55);
    const f = bez([30, 104], [90, 72], [4, 50], [56, 30]);
    dragon(x, R, f, 15, ['#e8f8ff', '#46b6ff', '#0a3470'], { glow: BLUE, eye: '#ffffff', head: 0.95 });
    bolt(x, R, 60, 16, 76, 2, { col: BLUE, w: 1.2, gens: 3 });
    zap(x, R, 40, 70, 30, 4);
    embers(x, R, 12, 50, 50, 40, [HOT, BLUE]);
  },
  swiftwind_dash(x, R) {
    backdrop(x, R, ['#2a9a9a', '#0a3034', '#020707'], { angle: 0 });
    glow(x, 56, 50, 40, '#6af0e0', 0.45);
    add(x);
    for (let i = 0; i < 5; i++) {
      const y0 = 26 + i * 12, f = bez([2, y0 + 6], [40, y0 - 10], [66, y0 + 16], [96, y0 - 2]);
      ribbon(x, f, t => 3.2 * Math.sin(PI * t) + 0.2, 24); x.fillStyle = rgba(i % 2 ? '#6af0e0' : '#e0fffa', 0.55); x.fill();
    }
    norm(x);
    // spiral gust
    glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.02) { const a = t * TAU * 1.6, r = 4 + t * 22; const px = 62 + Math.cos(a) * r, py = 50 + Math.sin(a) * r * 0.7; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, '#8af8ee', 1.6);
    speedLines(x, R, 12, [0, 10, 60, 90], 0, '#c0fff8', { len: 24, w: 1.2 });
    sparkle(x, 62, 50, 8);
  },
  ground_quake(x, R) {
    backdrop(x, R, ['#a86a2a', '#361c08', '#060302'], { cy: 30 });
    x.fillStyle = lg(x, 0, 56, 0, 100, [[0, 'rgba(30,14,4,0)'], [0.4, 'rgba(30,14,4,.7)'], [1, 'rgba(10,4,0,.95)']]); x.fillRect(0, 56, 100, 44);
    glow(x, 50, 74, 42, AMBER, 0.7);
    cracks(x, R, 50, 76, 9, 40, AMBER, { sy: 0.32, w: 1.4 });
    ring(x, 50, 76, 36, 10, AMBER, 2);
    at(x, 50, 26, PI / 2, 1.2, fist, { metal: 'steel', cuff: '#3a2412' });
    rocks(x, R, 12, 50, 66, 38, { cols: ['#6a5040', '#34261a', '#8a6a4a'], a0: PI, arc: PI, size: 3.4, hot: AMBER });
    embers(x, R, 10, 50, 66, 34, [AMBER, '#ffe0a0']);
  },
  thunder_palm(x, R) {
    backdrop(x, R, NIGHT);
    glow(x, 50, 52, 46, BLUE, 0.55);
    x.save(); x.translate(50, 56); x.scale(1.2, 1.2); palm(x);
    x.fillStyle = rg(x, -6, -10, 1, 34, [[0, '#ffffff'], [0.3, '#c8d8ec'], [0.7, '#5a6a84'], [1, '#18202c']]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 1.1);
    x.strokeStyle = rgba('#8ad8ff', 0.8); x.lineWidth = 0.9; for (const fx of [-10.5, -4, 3, 9.5]) { x.beginPath(); x.moveTo(fx, -6); x.lineTo(fx, fx === -4 || fx === 3 ? -26 : -20); x.stroke(); }
    x.restore();
    glow(x, 50, 50, 26, BLUE, 1);
    x.fillStyle = rg(x, 46, 46, 1, 14, [[0, '#ffffff'], [0.4, '#bfe8ff'], [1, rgba(BLUE, 0)]]); circle(x, 50, 50, 14); x.fill();
    zap(x, R, 50, 50, 40, 7, '#8ad0ff');
    sparkle(x, 50, 50, 12);
  },
  moonflash_kick(x, R) {
    backdrop(x, R, ['#4a5aa0', '#141a3a', '#03040a']);
    for (let i = 0; i < 14; i++) glow(x, R() * 100, R() * 60, 1 + R() * 1.6, '#e0e8ff', 0.6);
    glow(x, 50, 48, 40, '#b8d0ff', 0.45);
    slash(x, 50, 52, 36, PI * 0.6, PI * 2.4, 12, '#b8d0ff', { bias: 1.25, hot: '#ffffff' });
    figure(x, { head: [48, 72], neck: [49, 66], sh: [[43, 63], [56, 64]], el: [[36, 72], [63, 72]], ha: [[34, 80], [66, 80]], hip: [50, 48], kn: [[42, 36], [60, 34]], ft: [[46, 22], [70, 18]] },
      { col: '#060a18', rim: '#c0d8ff', s: 1.25 });
    glow(x, 70, 18, 10, '#ffffff', 0.9);
    sparkle(x, 72, 16, 9, '#ffffff');
  },
  heavenly_strike(x, R) {
    backdrop(x, R, ['#3a4a80', '#0c1230', '#02030a'], { cy: 20, shaft: false });
    clouds(x, R, 50, 10, 112, 24, ['#a8b8e0', '#3a4468', '#0c1024'], 9);
    glow(x, 50, 84, 40, BLUE, 0.7);
    bolt(x, R, 48, 14, 52, 84, { col: BLUE, w: 3.6, gens: 5, jit: 0.2, branches: 3, blen: 18 });
    ring(x, 50, 86, 32, 8, BLUE, 1.8);
    rocks(x, R, 8, 50, 80, 30, { cols: ['#4a5060', '#20242c'], a0: PI, arc: PI, size: 2.6, hot: BLUE });
    sparkle(x, 52, 84, 12, HOT);
  },
  lightning_whisper(x, R) {
    backdrop(x, R, ['#4a4ab0', '#141444', '#03030c']);
    glow(x, 50, 50, 40, '#8a9aff', 0.6);
    for (let k = 0; k < 3; k++) { const r0 = 10 + k * 9; glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.04) { const a = t * PI * 1.4 + k * 2.1, r = r0 + Math.sin(t * 9 + k) * 2; const px = 50 + Math.cos(a) * r, py = 50 + Math.sin(a) * r; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, '#9aa8ff', 1.4 - k * 0.3); }
    x.fillStyle = rg(x, 47, 47, 1, 12, [[0, '#ffffff'], [0.5, '#c0c8ff'], [1, 'rgba(140,150,255,0)']]); circle(x, 50, 50, 12); x.fill();
    zap(x, R, 50, 50, 36, 5, '#aab4ff');
    sparkle(x, 50, 50, 10);
  },
  soaring_tiger(x, R) {
    backdrop(x, R, DUSK, { angle: -0.8 });
    speedLines(x, R, 16, [0, 40, 60, 100], -0.8, '#ffd890', { len: 30, w: 1.8 });
    glow(x, 60, 40, 40, AMBER, 0.6);
    streak(x, 6, 96, 56, 46, 14, AMBER, { a: 0.6 });
    at(x, 60, 42, -0.2, 0.95, tigerHead, { fur: '#ffae2e', eye: '#fff4c0' });
    zap(x, R, 60, 42, 38, 3, '#ffd070');
  },
  identity_z(x, R) { // Dragon Ascent: electric dragon coiling upward
    backdrop(x, R, NIGHT);
    glow(x, 50, 50, 48, BLUE, 0.6);
    const f = t => { const a = -PI / 2 + t * TAU * 1.15, r = 34 - t * 16; return [50 + Math.cos(a) * r, 64 - t * 36 + Math.sin(a) * r * 0.45]; };
    dragon(x, R, f, 13, ['#ffffff', '#6ac8ff', '#0a3470'], { glow: BLUE, head: 1 });
    zap(x, R, 50, 56, 44, 4);
    sparkle(x, 50, 18, 8, HOT);
  },
  identity_x(x, R) { // Thunder Tiger: electric-blue tiger roaring amid lightning
    backdrop(x, R, NIGHT);
    rays(x, R, 50, 52, 18, 10, 60, '#8ad0ff', { alpha: 0.45 });
    glow(x, 50, 52, 44, BLUE, 0.7);
    zap(x, R, 50, 52, 48, 6, '#9ad8ff');
    at(x, 50, 54, 0, 1.25, tigerHead, { fur: '#8ad0ff', stripe: '#06183a', eye: '#ffffff' });
  },
  awakening(x, R) { // Heaven's Fury: a fist of lightning out of the storm
    backdrop(x, R, ['#3a5aa0', '#0c1634', '#02030a'], { cy: 20, shaft: false });
    clouds(x, R, 50, 12, 116, 28, ['#b8c8f0', '#3a4a78', '#0a1024'], 10);
    glow(x, 50, 60, 46, BLUE, 0.7);
    for (const [ax, bx] of [[20, 14], [80, 88], [36, 26]]) bolt(x, R, ax, 22, bx, 96, { col: BLUE, w: 1.4, gens: 5 });
    streak(x, 50, 18, 50, 70, 16, BLUE, { even: false, bias: 0.6 });
    at(x, 50, 44, PI / 2, 1.3, fist, { metal: 'silver', cuff: '#16305a' });
    glow(x, 50, 80, 20, HOT, 0.9);
    ring(x, 50, 86, 34, 8, BLUE, 1.8);
    sparkle(x, 50, 80, 12);
  },
};
