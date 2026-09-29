// Pistoleer — brass, gunsmoke and muzzle orange. Pistol skills burn orange, shotgun skills red-orange, rifle skills cool blue.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, glow, sparkle, slash, slashAB, streak, ring, rays, burst, embers, smoke,
  speedLines, backdrop, rgba, shade, mix, outline, fire, fireLayers, metalLG, metalRG, add, norm, glowPath, bez, runeCircle,
} from './core.js';
import { pistol, shotgun, rifle, muzzle, dragon, eye, figure } from './motifs.js';

const ORNG = '#ff8a1e', HOT = '#fff0c0', BRASS = '#d8a24a', ICE = '#7ad0ff';
const SMOKE = ['#6a5a4a', '#241c16', '#060504'];
const at = (x, px, py, rot, s, fn, o) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); fn(x, o); x.restore(); };
const tracer = (x, x0, y0, x1, y1, col = ORNG) => streak(x, x0, y0, x1, y1, 1.6, col, { bias: 2 });

export const PISTOLEER = {
  quick_shot(x, R) { // backstep and fire
    backdrop(x, R, SMOKE, { angle: 0 });
    speedLines(x, R, 14, [0, 24, 50, 90], PI, '#e0c0a0', { len: 26, w: 1.4, a: 0.45 });
    smoke(x, R, 6, 70, 40, 16, '#6a6058', 0.35, 10);
    glow(x, 70, 40, 30, ORNG, 0.65);
    for (const [dx, a] of [[-22, 0.14], [-11, 0.3]]) { x.globalAlpha = a; at(x, 38 + dx, 56, -0.14, 1.2, pistol, {}); }
    x.globalAlpha = 1; at(x, 38, 56, -0.14, 1.2, pistol, {});
    at(x, 79, 42, -0.14, 1, (xx) => muzzle(xx, R, 0.95, ORNG));
    tracer(x, 82, 38, 100, 34); tracer(x, 84, 45, 100, 44); tracer(x, 80, 50, 98, 56);
  },
  spiral_tracker(x, R) {
    backdrop(x, R, ['#7a5230', '#261608', '#050302'], { angle: -0.6 });
    glow(x, 78, 24, 26, ORNG, 0.8);
    for (let k = 0; k < 3; k++) {
      glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.02) { const px = 12 + t * 66 + Math.cos(t * 12 + k * 2.1) * 8 * (1 - t), py = 86 - t * 62 + Math.sin(t * 12 + k * 2.1) * 8 * (1 - t); t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, ORNG, 1.4);
    }
    // bullet heads
    for (const [px, py, a] of [[78, 24, -0.75], [66, 38, -0.9], [54, 48, -0.6]]) { x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = metalLG(x, -3, -2, 3, 2, 'brass'); x.beginPath(); x.moveTo(-3.5, -1.6); x.lineTo(1.5, -1.6); x.quadraticCurveTo(4.5, 0, 1.5, 1.6); x.lineTo(-3.5, 1.6); x.closePath(); x.fill(); outline(x, 'rgba(0,0,0,.8)', 0.5); x.restore(); glow(x, px, py, 6, HOT, 0.6); }
    // target mark
    x.strokeStyle = rgba('#ff5a3a', 0.9); x.lineWidth = 1.4; circle(x, 80, 22, 8); x.stroke(); x.beginPath(); x.moveTo(80, 10); x.lineTo(80, 16); x.moveTo(80, 28); x.lineTo(80, 34); x.moveTo(68, 22); x.lineTo(74, 22); x.moveTo(86, 22); x.lineTo(92, 22); x.stroke();
  },
  equilibrium(x, R) {
    backdrop(x, R, SMOKE, { angle: 0 });
    glow(x, 50, 50, 40, ORNG, 0.35);
    at(x, 58, 60, 0, 0.95, pistol, {});
    x.save(); x.translate(42, 44); x.scale(-0.95, 0.95); pistol(x, {}); x.restore();
    at(x, 91, 50.5, 0, 0.75, (xx) => muzzle(xx, R, 1, ORNG));
    x.save(); x.translate(9, 34.5); x.scale(-0.75, 0.75); muzzle(x, R, 1, ORNG); x.restore();
    sparkle(x, 50, 52, 8, HOT);
  },
  dexterous_shot(x, R) {
    backdrop(x, R, ['#8a6034', '#2a1a0a', '#050302']);
    glow(x, 50, 50, 40, ORNG, 0.45);
    for (const r of [26, 34]) { x.save(); add(x); x.lineWidth = 2; x.strokeStyle = rgba(HOT, 0.4); x.beginPath(); x.arc(50, 52, r, -PI * 0.9, PI * 0.2); x.stroke(); norm(x); x.restore(); }
    slash(x, 50, 52, 30, -PI * 0.95, PI * 0.15, 7, ORNG, { bias: 1.2 });
    x.globalAlpha = 0.3; at(x, 44, 60, -0.9, 1, pistol, {}); x.globalAlpha = 1;
    at(x, 44, 58, -0.35, 1.05, pistol, {});
    at(x, 80, 45, -0.35, 0.7, (xx) => muzzle(xx, R, 1, ORNG));
    embers(x, R, 10, 60, 40, 30, [ORNG, HOT]);
  },
  dual_buckshot(x, R) {
    backdrop(x, R, ['#8a3a1e', '#2a0e06', '#060201'], { angle: -0.5 });
    glow(x, 70, 36, 40, '#ff5a1e', 0.65);
    for (let i = 0; i < 18; i++) { const a = -0.55 + (R() - 0.5) * 0.9, d = 22 + R() * 30, px = 60 + Math.cos(a) * d, py = 48 + Math.sin(a) * d; tracer(x, 60 + Math.cos(a) * (d - 12), 48 + Math.sin(a) * (d - 12), px, py, '#ff7a30'); x.fillStyle = HOT; circle(x, px, py, 0.9); x.fill(); }
    at(x, 26, 76, -0.55, 0.88, shotgun, {});
    at(x, 61, 49, -0.55, 1.05, (xx) => muzzle(xx, R, 1, '#ff5a1e'));
    smoke(x, R, 5, 40, 40, 14, '#5a4a40', 0.3, 8);
  },
  shotgun_rapid_fire(x, R) {
    backdrop(x, R, ['#7a2e1a', '#240a04', '#050201'], { angle: 0 });
    glow(x, 76, 50, 36, '#ff5a1e', 0.6);
    at(x, 70, 42, -0.1, 0.72, (xx) => muzzle(xx, R, 1, '#ff6a2a'));
    at(x, 76, 52, 0.04, 0.92, (xx) => muzzle(xx, R, 1, '#ff5a1e'));
    at(x, 70, 62, 0.16, 0.7, (xx) => muzzle(xx, R, 1, '#ff6a2a'));
    at(x, 34, 60, -0.04, 0.9, shotgun, {});
    for (const [px, py, a] of [[40, 24, 0.6], [52, 16, -0.4], [30, 34, 1.2], [60, 28, 0.2]]) { x.save(); x.translate(px, py); x.rotate(a); x.beginPath(); x.roundRect(-4, -2, 8, 4, 1); x.fillStyle = lg(x, 0, -2, 0, 2, [[0, '#ff6a5a'], [1, '#6a0a0a']]); x.fill(); x.fillStyle = metalLG(x, 2, -2, 4, 2, 'brass'); x.fillRect(2, -2, 2.4, 4); x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 0.5; x.strokeRect(-4, -2, 8.4, 4); x.restore(); }
    smoke(x, R, 5, 50, 30, 16, '#5a4a40', 0.3, 8);
  },
  last_request(x, R) {
    backdrop(x, R, ['#b0481a', '#3a1206', '#070201']);
    glow(x, 64, 56, 46, '#ff6a1e', 0.8);
    burst(x, R, 66, 56, 13, 10, 36, '#ff7a2a');
    ring(x, 66, 56, 26, 26, HOT, 1.6, 0.8);
    smoke(x, R, 8, 66, 56, 26, '#4a3a30', 0.35, 12);
    at(x, 10, 36, 0.42, 0.95, shotgun, {});
    sparkle(x, 66, 56, 14, '#ffffff');
    embers(x, R, 16, 66, 56, 36, ['#ff7a2a', HOT]);
  },
  dragon_shot(x, R) {
    backdrop(x, R, ['#9a3a16', '#2e0c04', '#060101'], { angle: -0.6 });
    glow(x, 66, 36, 40, '#ff6a1e', 0.7);
    fire(x, R, 30, 70, 44, 26, PI * 1.25, { n: 5 });
    const f = bez([10, 92], [30, 70], [40, 52], [70, 32]);
    dragon(x, R, f, 11, ['#fff0a0', '#ff7a20', '#7a1a04'], { glow: '#ff6a1e', eye: '#ffffff', head: 1.1 });
    embers(x, R, 16, 56, 46, 40, ['#ff7a2a', '#ffd060', HOT]);
  },
  focused_shot(x, R) {
    backdrop(x, R, ['#2e4a60', '#0c1620', '#020406'], { angle: -0.5 });
    glow(x, 84, 30, 26, ICE, 0.7);
    streak(x, 72, 44, 100, 28, 1.3, ICE, { even: true });
    x.strokeStyle = rgba(ICE, 0.9); x.lineWidth = 1.2; circle(x, 86, 31, 7); x.stroke(); circle(x, 86, 31, 1.5); x.stroke();
    x.beginPath(); x.moveTo(86, 20); x.lineTo(86, 26); x.moveTo(86, 36); x.lineTo(86, 42); x.moveTo(75, 31); x.lineTo(81, 31); x.moveTo(91, 31); x.lineTo(97, 31); x.stroke();
    at(x, 26, 70, -0.5, 0.8, rifle, { lens: ICE });
    for (let i = 0; i < 3; i++) runeCircle(x, R, 58 + i * 5, 51 - i * 2.7, 5.4 - i, ICE, { sy: 1, points: 5, w: 0.6, glowA: 0.2 });
  },
  perfect_shot(x, R) {
    backdrop(x, R, ['#2a5a80', '#0a1a2c', '#020408'], { angle: 0 });
    glow(x, 64, 46, 50, ICE, 0.6);
    add(x); x.fillStyle = lg(x, 0, 38, 0, 58, [[0, rgba(ICE, 0)], [0.3, rgba(ICE, 0.7)], [0.5, '#ffffff'], [0.7, rgba(ICE, 0.7)], [1, rgba(ICE, 0)]]); poly(x, [[68, 44], [104, 34], [104, 60], [68, 50]]); x.fill(); norm(x);
    ring(x, 72, 47, 4, 13, ICE, 1.6);
    ring(x, 84, 46, 3.4, 11, ICE, 1.2, 0.8);
    at(x, 28, 62, -0.2, 0.74, rifle, { lens: ICE });
    sparkle(x, 68, 47, 13, '#ffffff');
  },
  target_down(x, R) {
    backdrop(x, R, ['#4a3a30', '#16100c', '#040302']);
    // scope view
    x.save(); circle(x, 50, 50, 36); x.clip();
    x.fillStyle = rg(x, 46, 44, 2, 40, [[0, '#6a8a8a'], [0.6, '#2a3a3a'], [1, '#081010']]); x.fillRect(0, 0, 100, 100);
    x.fillStyle = 'rgba(20,30,30,.8)'; poly(x, [[30, 70], [40, 50], [46, 54], [56, 40], [70, 70]]); x.fill();
    glow(x, 50, 50, 16, '#ff3a2a', 0.8);
    x.restore();
    x.lineWidth = 3.2; x.strokeStyle = metalLG(x, 14, 14, 86, 86, 'brass'); circle(x, 50, 50, 37); x.stroke(); outline(x, 'rgba(0,0,0,.9)', 0.8);
    x.strokeStyle = 'rgba(10,10,10,.95)'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(14, 50); x.lineTo(42, 50); x.moveTo(58, 50); x.lineTo(86, 50); x.moveTo(50, 14); x.lineTo(50, 42); x.moveTo(50, 58); x.lineTo(50, 86); x.stroke();
    for (const r of [10, 18]) { x.strokeStyle = rgba('#ff4a3a', 0.9); x.lineWidth = 0.9; circle(x, 50, 50, r); x.stroke(); }
    x.fillStyle = '#ff5a4a'; circle(x, 50, 50, 1.8); x.fill(); glow(x, 50, 50, 6, '#ff3a2a', 1);
  },
  catastrophe(x, R) {
    backdrop(x, R, ['#8a4a2a', '#2a1208', '#060201'], { cy: 30 });
    smoke(x, R, 10, 50, 70, 46, '#3a2a24', 0.5, 14);
    for (const [px, py, s] of [[26, 70, 0.8], [58, 78, 1.1], [80, 62, 0.7]]) { glow(x, px, py, 22 * s, '#ff6a1e', 0.8); burst(x, R, px, py, 10, 5 * s, 20 * s, '#ff7a2a'); fire(x, R, px, py + 4, 20 * s, 16 * s, 0, { n: 4 }); }
    for (const [px, py] of [[40, 20], [70, 12], [22, 30]]) { streak(x, px - 8, py - 16, px, py, 3, ORNG, { bias: 2 }); x.fillStyle = '#1a1210'; circle(x, px, py, 2.6); x.fill(); glow(x, px, py, 5, ORNG, 0.8); }
    embers(x, R, 14, 50, 60, 40, [ORNG, HOT]);
  },
  identity_z(x, R) { // stance cycle: pistol → shotgun → rifle
    backdrop(x, R, SMOKE);
    glow(x, 50, 50, 40, BRASS, 0.4);
    x.save(); add(x); x.lineWidth = 3; x.strokeStyle = rgba(BRASS, 0.6);
    for (let i = 0; i < 3; i++) { const a0 = -PI / 2 + i * TAU / 3 + 0.35, a1 = a0 + TAU / 3 - 0.7; x.beginPath(); x.arc(50, 52, 34, a0, a1); x.stroke(); const ex = 50 + Math.cos(a1) * 34, ey = 52 + Math.sin(a1) * 34; x.save(); x.translate(ex, ey); x.rotate(a1 + PI / 2); x.fillStyle = rgba(HOT, 0.9); poly(x, [[0, -4], [5, 0], [0, 4]]); x.fill(); x.restore(); }
    norm(x); x.restore();
    at(x, 34, 30, -0.2, 0.62, pistol, {});
    at(x, 58, 60, -0.2, 0.55, shotgun, {});
    at(x, 34, 78, -0.2, 0.42, rifle, { lens: ICE });
  },
  identity_x(x, R) { // Deadeye Focus
    backdrop(x, R, ['#9a5a1e', '#2e1606', '#050201']);
    glow(x, 50, 50, 40, ORNG, 0.6);
    x.save(); x.translate(50, 50); eye(x, 70, '#ff8a1e', { open: 0.36, lw: 1.6 }); x.restore();
    x.strokeStyle = rgba('#ffe0b0', 0.95); x.lineWidth = 1.2; circle(x, 50, 50, 10); x.stroke();
    x.beginPath(); x.moveTo(50, 30); x.lineTo(50, 42); x.moveTo(50, 58); x.lineTo(50, 70); x.moveTo(26, 50); x.lineTo(40, 50); x.moveTo(60, 50); x.lineTo(74, 50); x.stroke();
    sparkle(x, 45, 45, 5);
  },
  awakening(x, R) { // Last Rites: the revolver cylinder, every chamber alight
    backdrop(x, R, ['#b0601e', '#3a1806', '#060201']);
    glow(x, 50, 50, 50, ORNG, 0.6);
    rays(x, R, 50, 50, 20, 20, 62, '#ffc070', { alpha: 0.45 });
    circle(x, 50, 50, 30); x.fillStyle = metalRG(x, 50, 50, 34, 'brass'); x.fill(); outline(x, 'rgba(0,0,0,.9)', 1.4);
    for (let i = 0; i < 6; i++) { const a = -PI / 2 + i * TAU / 6, cx = 50 + Math.cos(a) * 18, cy = 50 + Math.sin(a) * 18; x.fillStyle = '#1a0c04'; circle(x, cx, cy, 7.4); x.fill(); glow(x, cx, cy, 11, '#ff7a20', 0.9); x.fillStyle = rg(x, cx - 1, cy - 1, 0, 6, [[0, '#ffffff'], [0.4, '#ffd070'], [1, '#c04a10']]); circle(x, cx, cy, 5.4); x.fill(); }
    x.fillStyle = metalRG(x, 50, 50, 8, 'dark'); circle(x, 50, 50, 6.5); x.fill(); outline(x, 'rgba(0,0,0,.9)', 1);
    for (let i = 0; i < 6; i++) { const a = -PI / 2 + (i + 0.5) * TAU / 6; x.strokeStyle = 'rgba(40,20,0,.8)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26); x.lineTo(50 + Math.cos(a) * 30, 50 + Math.sin(a) * 30); x.stroke(); }
    smoke(x, R, 6, 50, 86, 30, '#4a3a30', 0.35, 10);
  },
};
