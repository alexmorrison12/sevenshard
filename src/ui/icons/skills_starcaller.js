// Starcaller — cosmic violet, icy blue and fire; staff with a star orb.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, slash, slashAB, streak, ring, rays, burst, embers, rocks,
  speedLines, backdrop, rgba, shade, mix, outline, fire, fireLayers, bolt, crystal, runeCircle, add, norm, glowPath, clouds, ribbon,
} from './core.js';
import { staff, meteor, figure } from './motifs.js';

const VIO = '#a86aff', ICE = '#7ad8ff', FIRE = '#ff6a20', HOT = '#f4e8ff';
const SPACE = ['#5a36a0', '#1c0c40', '#03020a'];
const FROST = ['#3a7ab0', '#0c2240', '#02050c'];
const EMBER = ['#b04a1e', '#3a1006', '#070201'];
const starsBg = (x, R, n = 20, col = '#e8e0ff') => { for (let i = 0; i < n; i++) glow(x, R() * 100, R() * 100, 0.8 + R() * 1.8, col, 0.4 + R() * 0.4); };
const ice = '#bff0ff';

export const STARCALLER = {
  doomfall(x, R) {
    backdrop(x, R, SPACE, { angle: 0.8 });
    starsBg(x, R, 16);
    glow(x, 40, 80, 40, FIRE, 0.6);
    x.fillStyle = lg(x, 0, 78, 0, 100, [[0, 'rgba(40,10,4,0)'], [1, 'rgba(40,10,4,.85)']]); x.fillRect(0, 78, 100, 22);
    for (const [hx, hy, r] of [[34, 70, 8], [64, 44, 6], [82, 20, 4.5], [18, 36, 4]]) meteor(x, R, hx + 30, hy - 36, hx, hy, r, { col: FIRE });
    ring(x, 34, 84, 22, 5, FIRE, 1.4);
    embers(x, R, 12, 40, 70, 30, [FIRE, '#ffd070']);
  },
  blaze_nova(x, R) {
    backdrop(x, R, EMBER);
    glow(x, 50, 54, 46, FIRE, 0.6);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; fire(x, R, 50 + Math.cos(a) * 20, 54 + Math.sin(a) * 20 * 0.7, 22, 12, a + PI / 2, { n: 3 }); }
    ring(x, 50, 54, 30, 21, '#ffb040', 2);
    ring(x, 50, 54, 14, 10, '#ffe0a0', 1.2);
    x.fillStyle = rg(x, 50, 54, 0, 10, [[0, '#ffffff'], [1, 'rgba(255,200,120,0)']]); circle(x, 50, 54, 10); x.fill();
    embers(x, R, 16, 50, 54, 44, [FIRE, '#ffd070']);
  },
  frost_lance(x, R) {
    backdrop(x, R, FROST, { angle: -0.7 });
    glow(x, 60, 40, 44, ICE, 0.5);
    speedLines(x, R, 14, [0, 40, 60, 100], -0.75, ice, { len: 26, w: 1.3 });
    streak(x, 4, 96, 70, 30, 9, ICE, { bias: 1.4, a: 0.6 });
    crystal(x, 16, 84, 86, 14, -0.78, '#8ad8ff', { skew: 0.08, glowA: 0.4 });
    for (let i = 0; i < 6; i++) crystal(x, 24 + i * 8, 80 - i * 8 + (R() - 0.5) * 8, 7, 3, -0.78 + (R() - 0.5), ice, { glow: false, lw: 0.5 });
    sparkle(x, 82, 18, 10, '#ffffff');
  },
  starfire_explosion(x, R) {
    backdrop(x, R, SPACE);
    starsBg(x, R, 14);
    glow(x, 50, 52, 48, VIO, 0.7);
    rays(x, R, 50, 52, 20, 10, 60, '#d8b8ff', { alpha: 0.5 });
    star(x, 50, 52, 8, 10, 34); x.save(); add(x); x.fillStyle = rg(x, 50, 52, 0, 34, [[0, '#ffffff'], [0.3, '#e8d0ff'], [0.7, rgba(VIO, 0.8)], [1, rgba(VIO, 0)]]); x.fill(); norm(x); x.restore();
    star(x, 50, 52, 4, 6, 22, -PI / 4); x.save(); add(x); x.fillStyle = rg(x, 50, 52, 0, 22, [[0, '#ffffff'], [1, 'rgba(255,200,255,0)']]); x.fill(); norm(x); x.restore();
    sparkle(x, 50, 52, 14);
    embers(x, R, 16, 50, 52, 42, [VIO, HOT, FIRE]);
  },
  punishing_bolt(x, R) {
    backdrop(x, R, ['#5a40a8', '#16103a', '#030208'], { cy: 20, shaft: false });
    clouds(x, R, 50, 8, 112, 22, ['#b8a8f0', '#3a2a70', '#0c0822'], 9);
    glow(x, 50, 60, 44, VIO, 0.7);
    bolt(x, R, 50, 14, 50, 90, { col: '#c8a0ff', w: 3.4, gens: 6, jit: 0.3, branches: 6, blen: 24 });
    bolt(x, R, 44, 16, 40, 60, { col: '#c8a0ff', w: 1.4, gens: 5, jit: 0.3 });
    ring(x, 50, 90, 32, 7, VIO, 1.8);
    sparkle(x, 50, 88, 14);
  },
  seraphic_hail(x, R) {
    backdrop(x, R, FROST, { cy: 20 });
    runeCircle(x, R, 50, 80, 38, ICE, { sy: 0.3, points: 6, w: 1.1 });
    glow(x, 50, 72, 40, ICE, 0.5);
    for (const [px, py, l] of [[24, 30, 22], [44, 18, 26], [66, 34, 24], [80, 16, 18], [34, 56, 18], [58, 62, 22]]) { streak(x, px + 6, py - 26, px, py, 2.6, ICE, { a: 0.6, bias: 2 }); crystal(x, px, py, l, 7, PI / 2 + 0.22, '#9ae0ff', { glowA: 0.25 }); }
    embers(x, R, 12, 50, 70, 40, [ice, '#ffffff']);
  },
  esoteric_rune(x, R) {
    backdrop(x, R, SPACE);
    glow(x, 50, 50, 44, VIO, 0.55);
    runeCircle(x, R, 50, 50, 38, '#c8a0ff', { points: 5, w: 1.4, glyphs: 16 });
    runeCircle(x, R, 50, 50, 20, '#e8d8ff', { points: 6, w: 1, glyphs: 8, rot: 0.3 });
    sparkle(x, 50, 50, 12);
  },
  lightning_vortex(x, R) {
    backdrop(x, R, ['#4a3aa0', '#12103a', '#02020a']);
    glow(x, 50, 50, 48, '#8a8aff', 0.55);
    for (let k = 0; k < 3; k++) {
      const f = t => { const a = t * TAU * 1.05 + k * TAU / 3, r = 5 + t * 40; return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r * 0.82]; };
      add(x); ribbon(x, f, t => 1 + t * 9 * (1 - t * 0.5), 40); x.fillStyle = rgba(k === 1 ? ICE : '#b89aff', 0.35); x.fill(); norm(x);
      glowPath(x, xx => { const p0 = f(0); xx.beginPath(); xx.moveTo(p0[0], p0[1]); for (let t = 0.02; t <= 1.001; t += 0.02) { const p = f(t); xx.lineTo(p[0], p[1]); } }, k === 1 ? ICE : '#c8b0ff', 1.3);
    }
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + R() * 0.5; bolt(x, R, 50 + Math.cos(a) * 8, 50 + Math.sin(a) * 8, 50 + Math.cos(a) * 44, 50 + Math.sin(a) * 38, { col: '#c0d0ff', w: 1.3, gens: 4, jit: 0.3 }); }
    glow(x, 50, 50, 16, '#ffffff', 0.9);
    x.fillStyle = rg(x, 50, 50, 0, 9, [[0, '#ffffff'], [1, 'rgba(200,210,255,0)']]); circle(x, 50, 50, 9); x.fill();
  },
  inferno_wave(x, R) { // a breaking wave of fire, curling forward
    backdrop(x, R, EMBER, { angle: 0 });
    glow(x, 60, 50, 50, FIRE, 0.6);
    const wave = () => { x.beginPath(); x.moveTo(-4, 100); x.bezierCurveTo(14, 70, 40, 34, 66, 20); x.bezierCurveTo(80, 12, 94, 14, 96, 26); x.bezierCurveTo(98, 36, 90, 42, 82, 38); x.bezierCurveTo(88, 32, 84, 26, 76, 30); x.bezierCurveTo(62, 40, 56, 66, 50, 100); x.closePath(); };
    wave(); x.fillStyle = lg(x, 10, 100, 80, 20, [[0, '#3a0600'], [0.4, '#b0240a'], [0.75, '#ff7a1a'], [1, '#ffd060']]); x.fill(); outline(x, 'rgba(40,6,0,.8)', 1);
    add(x); wave(); x.fillStyle = rg(x, 80, 26, 1, 40, [[0, rgba('#fff4c0', 0.8)], [1, rgba('#ff6a1a', 0)]]); x.fill(); norm(x);
    // interior darker trough
    x.beginPath(); x.moveTo(50, 100); x.bezierCurveTo(56, 66, 62, 42, 76, 30); x.bezierCurveTo(70, 44, 66, 70, 64, 100); x.closePath(); x.fillStyle = 'rgba(60,8,0,.55)'; x.fill();
    for (const [px, py, h, a] of [[22, 70, 22, 0.55], [38, 50, 26, 0.6], [54, 34, 28, 0.75], [70, 22, 24, 0.95], [88, 16, 18, 1.3]]) fire(x, R, px, py, h, h * 0.55, a, { n: 3 });
    glowPath(x, xx => { xx.beginPath(); xx.moveTo(2, 94); xx.bezierCurveTo(18, 68, 42, 36, 66, 22); xx.bezierCurveTo(80, 14, 93, 16, 95, 27); }, '#ffe080', 1.8);
    speedLines(x, R, 8, [0, 60, 30, 96], -0.8, '#ffb070', { len: 16, w: 1.2 });
    embers(x, R, 16, 64, 36, 34, [FIRE, '#ffd070']);
  },
  blink(x, R) {
    backdrop(x, R, SPACE);
    starsBg(x, R, 10);
    glow(x, 68, 52, 36, VIO, 0.6);
    ring(x, 68, 84, 18, 5, VIO, 1.4);
    // fading silhouette on the left, reappearing on the right
    x.globalAlpha = 0.35; figure(x, { head: [28, 34], neck: [28, 40], sh: [[23, 43], [33, 43]], el: [[20, 54], [36, 54]], ha: [[20, 62], [37, 62]], hip: [28, 64], kn: [[25, 76], [31, 76]], ft: [[24, 88], [32, 88]] }, { col: '#c0a0ff', s: 1.1 }); x.globalAlpha = 1;
    for (let i = 0; i < 20; i++) { const px = 22 + R() * 50, py = 30 + R() * 58; glow(x, px, py, 1 + R() * 2.4, i % 2 ? VIO : HOT, 0.8); }
    figure(x, { head: [68, 34], neck: [68, 40], sh: [[62, 43], [74, 43]], el: [[58, 54], [78, 54]], ha: [[57, 63], [79, 63]], hip: [68, 64], kn: [[64, 76], [72, 76]], ft: [[63, 88], [73, 88]] }, { col: '#0c0618', rim: '#d0b0ff', s: 1.15 });
    sparkle(x, 68, 50, 10, HOT);
  },
  void_rift(x, R) {
    backdrop(x, R, ['#3a1a6a', '#0e0620', '#020104']);
    starsBg(x, R, 18);
    glow(x, 50, 50, 50, VIO, 0.45);
    // accretion disc
    for (let k = 0; k < 3; k++) { x.save(); add(x); x.lineWidth = 6 - k * 1.6; x.strokeStyle = rgba(k ? '#e0c0ff' : VIO, 0.55 + k * 0.15); ellipse(x, 50, 50, 38 - k * 7, 12 - k * 2, -0.3); x.stroke(); norm(x); x.restore(); }
    for (let i = 0; i < 14; i++) { const a = R() * TAU, r = 16 + R() * 26; glowPath(x, xx => { xx.beginPath(); xx.arc(50, 50, r, a, a + 0.8); }, VIO, 0.8); }
    x.fillStyle = rg(x, 50, 50, 8, 18, [[0, '#000000'], [0.7, '#0a0014'], [1, 'rgba(10,0,20,0)']]); circle(x, 50, 50, 18); x.fill();
    x.save(); add(x); x.lineWidth = 1.6; x.strokeStyle = rgba('#f0d8ff', 0.9); circle(x, 50, 50, 12.5); x.stroke(); norm(x); x.restore();
    x.fillStyle = '#000000'; circle(x, 50, 50, 11.5); x.fill();
  },
  frost_nova(x, R) {
    backdrop(x, R, FROST);
    glow(x, 50, 50, 48, ICE, 0.6);
    ring(x, 50, 50, 36, 36, ICE, 1.6, 0.7);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.1; crystal(x, 50 + Math.cos(a) * 8, 50 + Math.sin(a) * 8, 26 + (i % 2) * 12, 9, a, '#9ae0ff', { glowA: 0.2 }); }
    x.fillStyle = rg(x, 50, 50, 0, 12, [[0, '#ffffff'], [1, 'rgba(180,230,255,0)']]); circle(x, 50, 50, 12); x.fill();
    sparkle(x, 50, 50, 12);
  },
  identity_z(x, R) { // Overload: the star orb spilling over
    backdrop(x, R, SPACE);
    rays(x, R, 50, 48, 24, 14, 62, '#d0b0ff', { alpha: 0.5 });
    glow(x, 50, 48, 48, VIO, 0.8);
    for (let k = 0; k < 3; k++) { x.save(); add(x); x.lineWidth = 1.4; x.strokeStyle = rgba(k === 1 ? ICE : '#e0c8ff', 0.8); ellipse(x, 50, 48, 32 - k * 4, 10 + k * 3, k * 1.05); x.stroke(); norm(x); x.restore(); }
    x.fillStyle = rg(x, 46, 43, 1, 20, [[0, '#ffffff'], [0.35, '#e8d8ff'], [0.75, VIO], [1, '#3a1a70']]); circle(x, 50, 48, 17); x.fill(); outline(x, 'rgba(30,10,60,.8)', 1);
    for (let i = 0; i < 5; i++) { const a = R() * TAU; bolt(x, R, 50 + Math.cos(a) * 16, 48 + Math.sin(a) * 16, 50 + Math.cos(a) * 42, 48 + Math.sin(a) * 42, { col: '#c8a8ff', w: 1.2, gens: 4 }); }
    sparkle(x, 44, 42, 9);
  },
  identity_x(x, R) { // Arcane Surge: a star-crystal overflowing with power
    backdrop(x, R, SPACE, { cy: 60 });
    glow(x, 50, 54, 46, VIO, 0.65);
    rays(x, R, 50, 54, 18, 12, 56, '#d8c0ff', { alpha: 0.4 });
    runeCircle(x, R, 50, 86, 34, VIO, { sy: 0.28, points: 5, w: 1 });
    crystal(x, 50, 88, 74, 30, -PI / 2, '#b080ff', { glowA: 0.5, skew: 0.04 });
    crystal(x, 34, 88, 34, 13, -PI / 2 - 0.35, '#8ad0ff', { glowA: 0.3 });
    crystal(x, 66, 88, 38, 14, -PI / 2 + 0.3, '#8ad0ff', { glowA: 0.3 });
    for (let i = 0; i < 4; i++) { const a = -PI / 2 + (i - 1.5) * 0.5; bolt(x, R, 50, 30, 50 + Math.cos(a) * 40, 30 + Math.sin(a) * 26 + 10, { col: '#d8b8ff', w: 1.1, gens: 4 }); }
    sparkle(x, 50, 18, 12);
  },
  awakening(x, R) { // Stellar Collapse: a star caving in on itself
    backdrop(x, R, ['#4a2a90', '#10062a', '#020106']);
    starsBg(x, R, 24);
    glow(x, 50, 50, 50, '#ff9a60', 0.45);
    for (let k = 0; k < 4; k++) { x.save(); add(x); x.lineWidth = 2.4 - k * 0.4; x.strokeStyle = rgba([FIRE, VIO, ICE, '#ffffff'][k], 0.7); ellipse(x, 50, 50, 40 - k * 6, 40 - k * 6); x.stroke(); norm(x); x.restore(); }
    rays(x, R, 50, 50, 18, 16, 56, '#ffd0a0', { alpha: 0.5 });
    // infalling streaks
    for (let i = 0; i < 16; i++) { const a = R() * TAU, r = 30 + R() * 16; streak(x, 50 + Math.cos(a) * r, 50 + Math.sin(a) * r, 50 + Math.cos(a + 0.4) * 14, 50 + Math.sin(a + 0.4) * 14, 1.4, i % 2 ? VIO : '#ffb070', { bias: 0.6 }); }
    x.fillStyle = rg(x, 48, 48, 0, 16, [[0, '#ffffff'], [0.4, '#fff0d0'], [0.8, rgba('#ffa060', 0.6)], [1, 'rgba(255,120,60,0)']]); circle(x, 50, 50, 16); x.fill();
    sparkle(x, 50, 50, 20);
  },
};
