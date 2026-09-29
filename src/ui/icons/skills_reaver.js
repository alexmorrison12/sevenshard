// Reaver — crimson & steel, huge greatsword.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, glow, sparkle, slash, streak, ring, rays, burst, embers, rocks, cracks, smoke,
  speedLines, slashAB, backdrop, rgba, shade, mix, outline, fire, fireLayers, metalLG, add, norm, ribbon, qbez, bez, shadowBlob,
} from './core.js';
import { greatsword, chain, figure } from './motifs.js';
import { hueBg } from './palette.js';

const RED = '#ff2e3e', HOT = '#ffc4b4', EMB = '#ff7a2a', STEEL = '#c8d4e2';
const sword = (x, px, py, rot, s, o = {}) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); greatsword(x, { metal: 'steel', guard: 'dark', gem: '#ff2a2a', ...o }); x.restore(); };
/** Perspective ground in the lower part of the icon. */
function ground(x, y0, col, a = 0.8) {
  x.fillStyle = lg(x, 0, y0, 0, 100, [[0, rgba(col, 0)], [0.35, rgba(shade(col, -0.5), a * 0.7)], [1, rgba(shade(col, -0.8), a)]]);
  x.fillRect(0, y0, 100, 100 - y0);
}

export const REAVER = {
  whirlwind_edge(x, R) {
    backdrop(x, R, hueBg('#d81c2c', 0.85));
    glow(x, 50, 56, 48, RED, 0.4);
    // spinning ring
    slash(x, 50, 58, 38, -PI * 1.05, PI * 0.1, 11, RED, { sy: 0.55, bias: 1.2 });
    slash(x, 50, 58, 38, PI * -0.05, PI * 1.1, 11, RED, { sy: 0.55, bias: 1.2 });
    x.lineWidth = 0.8; for (const r of [28, 44]) { x.strokeStyle = rgba(HOT, 0.35); x.beginPath(); x.ellipse(50, 58, r, r * 0.55, 0, PI * 0.1, PI * 0.9); x.stroke(); }
    // sword mid-spin with ghost trail
    for (const [a, al] of [[-0.75, 0.14], [-0.42, 0.28]]) { x.globalAlpha = al; sword(x, 44, 60, PI / 2 + a, 0.78); }
    x.globalAlpha = 1; sword(x, 44, 60, PI / 2 - 0.12, 0.78, { rune: '#ff4050' });
    embers(x, R, 14, 50, 58, 42, [RED, HOT, EMB], 1.2, 0.55);
    sparkle(x, 90, 55, 7, HOT);
  },
  tempest_slash(x, R) {
    backdrop(x, R, hueBg('#b0141e', 0.7), { angle: 0.8 });
    glow(x, 52, 50, 46, RED, 0.35);
    // three rising diagonal crescents (combo)
    slashAB(x, 8, 58, 58, 8, 10, 7, RED);
    slashAB(x, 14, 80, 80, 14, 12, 10, RED);
    slashAB(x, 36, 94, 94, 38, 10, 7, RED);
    embers(x, R, 16, 62, 44, 34, [RED, HOT, EMB]);
    sparkle(x, 80, 38, 9, HOT, 0.3);
  },
  diving_slash(x, R) {
    backdrop(x, R, hueBg('#a01820', 0.75));
    ground(x, 60, '#3a0a0c', 0.9);
    glow(x, 50, 80, 40, EMB, 0.55);
    ring(x, 50, 82, 30, 8, RED, 1.8);
    ring(x, 50, 82, 18, 4.5, HOT, 1.2);
    cracks(x, R, 50, 82, 7, 30, EMB, { sy: 0.3, w: 1.1 });
    streak(x, 50, 2, 50, 70, 5, RED, { even: true, a: 0.5 });
    sword(x, 50, 26, PI, 0.95, { rune: '#ff5040' }); // point down
    rocks(x, R, 9, 50, 76, 30, { cols: ['#5a3a30', '#2a1614', '#7a5040'], a0: PI, arc: PI, size: 3.4, sy: 0.9, hot: EMB });
    embers(x, R, 10, 50, 72, 30, [EMB, HOT]);
  },
  sword_storm(x, R) {
    backdrop(x, R, ['#6a2a36', '#2a0c14', '#070204'], { angle: 0.9 });
    glow(x, 60, 60, 44, RED, 0.35);
    const blades = [[26, 30, 0.42], [58, 20, 0.5], [80, 44, 0.44], [44, 58, 0.62], [70, 74, 0.46], [18, 66, 0.4]];
    for (const [px, py, s] of blades) {
      streak(x, px - 22 * s * 1.6, py - 30 * s * 1.6, px, py, 4 * s * 1.6, RED, { a: 0.8 });
      sword(x, px, py, PI - 0.62, s, { glow: '#ff2030', glowR: 5 });
    }
    embers(x, R, 12, 55, 55, 44, [RED, HOT]);
  },
  mountain_cleave(x, R) {
    backdrop(x, R, ['#ff8a3a', '#8a2a10', '#1a0604'], { cy: 30, cx: 50, r: 80, mid: 0.45, shaft: false });
    glow(x, 50, 40, 40, '#ffc070', 0.6);
    // two halves of a mountain, pushed apart by the cleave
    for (const s of [-1, 1]) {
      x.save(); x.translate(50 + s * 5, 0);
      x.beginPath(); x.moveTo(0, 100); x.lineTo(0, 40); x.lineTo(s * 7, 32); x.lineTo(s * 15, 42); x.lineTo(s * 25, 34); x.lineTo(s * 38, 56); x.lineTo(s * 50, 52); x.lineTo(s * 58, 66); x.lineTo(s * 58, 100); x.closePath();
      x.fillStyle = lg(x, s * 30, 30, s * 10, 96, [[0, '#5a3a30'], [0.45, '#26160f'], [1, '#080403']]); x.fill(); outline(x, 'rgba(0,0,0,.95)', 1.2);
      x.strokeStyle = rgba('#ffb070', 0.95); x.lineWidth = 1.8; x.beginPath(); x.moveTo(0, 100); x.lineTo(0, 40); x.stroke();
      x.strokeStyle = rgba('#ffe0c0', 0.6); x.lineWidth = 1.1; x.beginPath(); x.moveTo(s * 7, 32); x.lineTo(s * 15, 42); x.lineTo(s * 25, 34); x.lineTo(s * 38, 56); x.stroke();
      x.restore();
    }
    streak(x, 50, -6, 50, 106, 7, RED, { even: true });
    streak(x, 50, -6, 50, 106, 2.6, '#fff0d8', { even: true });
    rocks(x, R, 11, 50, 44, 22, { cols: ['#6a4a3e', '#3a2418'], size: 2.6, hot: EMB });
    embers(x, R, 16, 50, 48, 34, [EMB, HOT, RED]);
  },
  hell_blade(x, R) {
    backdrop(x, R, ['#a8341a', '#3a0c06', '#070201']);
    glow(x, 50, 50, 46, EMB, 0.55);
    // hellfire climbing the blade (behind), sword, then a hot additive lick in front
    fire(x, R, 50, 96, 90, 46, 0, { n: 6, layers: fireLayers('#4a0400', '#c8200a', '#ffb030') });
    sword(x, 50, 80, 0, 0.92, { glow: '#ff5020', glowR: 8, rune: '#ffd060', metal: 'iron' });
    x.globalAlpha = 0.55; fire(x, R, 50, 72, 44, 22, 0, { n: 4, layers: fireLayers('#5a0600', '#e02a10', '#ffcc40').slice(2) }); x.globalAlpha = 1;
    embers(x, R, 20, 50, 36, 36, [EMB, '#ffd060', RED], 1.3);
    sparkle(x, 50, 13, 9, '#ffe0a0');
  },
  red_dust(x, R) {
    backdrop(x, R, ['#8a0e1c', '#2e040a', '#060102'], { angle: 0 });
    // crimson wave sweeping low
    glow(x, 46, 66, 50, RED, 0.5);
    slash(x, 50, 150, 96, -PI * 0.83, -PI * 0.17, 16, '#ff1030', { bias: 1.1, hot: '#ff8090' });
    slash(x, 50, 150, 80, -PI * 0.78, -PI * 0.22, 8, RED, { bias: 1.1 });
    // dust motes rising
    for (let i = 0; i < 26; i++) { const px = 10 + R() * 80, py = 22 + R() * 50, r = 0.8 + R() * 2.4; glow(x, px, py, r * 3, i % 3 ? '#ff2a40' : '#ff9aa0', 0.5); }
    smoke(x, R, 6, 50, 36, 30, '#7a0a18', 0.3, 12);
    embers(x, R, 12, 50, 50, 40, ['#ffb0b8', RED]);
  },
  chain_sword(x, R) {
    backdrop(x, R, ['#5a4a52', '#221418', '#060304'], { angle: -0.3 });
    glow(x, 56, 44, 40, RED, 0.35);
    // chain whipping from the hilt, looping out
    const f = bez([34, 70], [4, 92], [4, 30], [30, 16]);
    chain(x, f, 17, 3.2, 'iron', { glow: '#ff3040' });
    sword(x, 34, 70, 0.72, 0.85, { rune: '#ff3040' });
    // hook at chain end
    x.save(); x.translate(30, 16); x.rotate(-0.4);
    x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(8, -4, 12, 4, 7, 9); x.lineTo(9, 3); x.bezierCurveTo(6, 1, 3, 2, 0, 3); x.closePath();
    x.fillStyle = metalLG(x, 0, -4, 12, 9, 'steel'); x.fill(); outline(x, 'rgba(0,0,0,.9)', 0.8);
    x.restore();
    // pull arrows (motion)
    speedLines(x, R, 7, [60, 24, 92, 64], PI * 0.8, HOT, { len: 16, w: 1.2 });
    embers(x, R, 8, 40, 50, 36, [RED, HOT]);
  },
  strike_wave(x, R) {
    backdrop(x, R, hueBg('#c01a28', 0.7), { angle: 0 });
    speedLines(x, R, 16, [0, 20, 60, 80], 0, '#ff7080', { len: 30, w: 1.6, a: 0.5 });
    glow(x, 60, 50, 40, RED, 0.5);
    // tall crescent wave flying right
    slash(x, 36, 50, 38, -PI * 0.42, PI * 0.42, 14, RED, { bias: 1 });
    slash(x, 30, 50, 34, -PI * 0.38, PI * 0.38, 6, HOT, { bias: 1 });
    embers(x, R, 12, 66, 50, 26, [RED, HOT]);
    sparkle(x, 74, 50, 8, HOT);
  },
  shoulder_charge(x, R) {
    backdrop(x, R, ['#8a3a26', '#2a120a', '#060302'], { angle: 0 });
    speedLines(x, R, 22, [0, 10, 60, 94], 0, '#ffb090', { len: 32, w: 2 });
    glow(x, 42, 52, 40, EMB, 0.45);
    glow(x, 88, 40, 30, EMB, 0.9);
    burst(x, R, 90, 40, 11, 6, 24, '#ffb060');
    figure(x, { head: [60, 27], neck: [56, 33], sh: [[43, 36], [66, 44]], el: [[33, 45], [70, 60]], ha: [[21, 39], [79, 63]], hip: [40, 64], kn: [[58, 73], [26, 76]], ft: [[66, 92], [8, 84]] },
      { col: '#140a08', rim: '#ff8a50', s: 1.25 });
    // big pauldron leading the charge
    x.save(); x.translate(72, 42); x.rotate(0.35); x.scale(1.05, 1.05);
    for (let k = 2; k >= 0; k--) {
      const rx = 13 - k * 2, oy = k * 5 - 2, ox = -k * 2;
      x.beginPath(); x.moveTo(ox - rx, oy + 6); x.bezierCurveTo(ox - rx, oy - 13, ox + rx + 5, oy - 14, ox + rx + 6, oy + 4); x.quadraticCurveTo(ox, oy + 1, ox - rx, oy + 6); x.closePath();
      x.fillStyle = rg(x, ox - 3, oy - 7, 1, rx * 1.5, [[0, '#ffffff'], [0.25, '#c8d2de'], [0.65, '#56606c'], [1, '#14181e']]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 1);
      x.strokeStyle = metalLG(x, ox - rx, 0, ox + rx, 0, 'gold'); x.lineWidth = 1.3; x.beginPath(); x.moveTo(ox - rx + 1.5, oy + 5); x.quadraticCurveTo(ox, oy + 0.5, ox + rx + 5, oy + 3); x.stroke();
    }
    poly(x, [[2, -12], [14, -18], [8, -8]]); x.fillStyle = metalLG(x, 2, -18, 14, -8, 'steel'); x.fill(); outline(x, 'rgba(0,0,0,.85)', 0.7);
    x.restore();
    embers(x, R, 10, 88, 40, 16, [EMB, HOT]);
  },
  finish_strike(x, R) {
    backdrop(x, R, hueBg('#c0201e', 0.7));
    glow(x, 66, 36, 44, EMB, 0.7);
    rays(x, R, 68, 34, 14, 8, 50, '#ffb070', { alpha: 0.5 });
    burst(x, R, 68, 34, 12, 8, 30, RED);
    ring(x, 68, 34, 20, 20, HOT, 1.4, 0.8);
    sword(x, 22, 86, 0.78, 0.92, { rune: '#ff6040' });
    sparkle(x, 68, 34, 12, '#ffffff');
    embers(x, R, 14, 66, 36, 30, [EMB, HOT, RED]);
  },
  wind_blade(x, R) {
    backdrop(x, R, ['#5c6c84', '#1a2230', '#050608'], { angle: 0.8 });
    glow(x, 50, 50, 44, '#dfe8ff', 0.4);
    // two crossing slash waves (an X)
    slashAB(x, 14, 20, 86, 82, 14, 12, '#e8f0ff', { hot: '#ffffff' });
    slashAB(x, 86, 18, 14, 82, 14, 12, '#e8f0ff', { hot: '#ffffff' });
    slashAB(x, 20, 24, 82, 78, 9, 3.4, RED);
    slashAB(x, 80, 22, 18, 78, 9, 3.4, RED);
    sparkle(x, 50, 50, 11);
    speedLines(x, R, 10, [10, 10, 90, 90], -0.7, '#dfe8ff', { len: 14, w: 1 });
    embers(x, R, 10, 50, 50, 40, ['#e8f0ff', RED]);
  },
  identity_z(x, R) { // Burst Mode: horned helm with blazing eyes in a crimson aura
    backdrop(x, R, ['#c01020', '#3a0408', '#060001']);
    rays(x, R, 50, 56, 22, 10, 62, '#ff3040', { alpha: 0.5 });
    glow(x, 50, 56, 44, RED, 0.7);
    fire(x, R, 50, 96, 70, 76, 0, { n: 8, layers: fireLayers('#2a0004', '#a80818', '#ff3048', '#ff9aa8') });
    x.save(); x.translate(50, 58);
    for (const s of [-1, 1]) { ribbon(x, bez([s * 14, -10], [s * 30, -12], [s * 34, -30], [s * 24, -44]), t => 9 * (1 - t) + 0.5, 22); x.fillStyle = lg(x, s * 14, -10, s * 24, -44, [[0, '#2a1a1a'], [0.5, '#8a6a60'], [1, '#e8d8c8']]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 1); }
    x.beginPath(); x.moveTo(-19, 6); x.bezierCurveTo(-21, -24, 21, -24, 19, 6); x.lineTo(16, 22); x.lineTo(5, 25); x.lineTo(4, 4); x.lineTo(-4, 4); x.lineTo(-5, 25); x.lineTo(-16, 22); x.closePath();
    x.fillStyle = rg(x, -7, -12, 1, 34, [[0, '#9a9ea6'], [0.35, '#3a3e46'], [1, '#08090c']]); x.fill(); outline(x, 'rgba(0,0,0,.95)', 1.3);
    x.strokeStyle = metalLG(x, -20, 0, 20, 0, 'crimson'); x.lineWidth = 2.2; x.beginPath(); x.moveTo(-19.5, 0); x.quadraticCurveTo(0, -5, 19.5, 0); x.stroke();
    x.fillStyle = '#050000'; poly(x, [[-15, 3], [-4, 3], [-4, 10], [-13, 9]]); x.fill(); poly(x, [[15, 3], [4, 3], [4, 10], [13, 9]]); x.fill();
    glow(x, -9, 6, 12, '#ff2030', 1); glow(x, 9, 6, 12, '#ff2030', 1);
    add(x); x.fillStyle = '#ffd0d0'; poly(x, [[-13, 5], [-5, 5], [-5, 7.5], [-12, 7]]); x.fill(); poly(x, [[13, 5], [5, 5], [5, 7.5], [12, 7]]); x.fill(); norm(x);
    x.restore();
    embers(x, R, 14, 50, 40, 40, [RED, '#ff9aa0']);
  },
  identity_x(x, R) { // Crimson Finale: a full crimson sun-slash detonating
    backdrop(x, R, ['#a0101a', '#300408', '#050001']);
    glow(x, 50, 50, 50, RED, 0.8);
    rays(x, R, 50, 50, 26, 16, 60, '#ff5060', { alpha: 0.5 });
    slash(x, 50, 50, 32, -PI * 1.1, PI * 0.45, 13, RED, { bias: 1.1 });
    slash(x, 50, 50, 22, PI * 0.1, PI * 1.6, 8, '#ff7080', { bias: 1.1 });
    burst(x, R, 50, 50, 10, 6, 20, '#ff4050');
    sparkle(x, 50, 50, 16);
    embers(x, R, 18, 50, 50, 46, [RED, HOT]);
  },
  awakening(x, R) { // Worldsplitter: a world cloven by a single blow
    backdrop(x, R, ['#7a1a22', '#240408', '#040001'], { cy: 30, shaft: false });
    for (let i = 0; i < 18; i++) { const px = R() * 100, py = R() * 100; glow(x, px, py, 1 + R() * 2, '#ffd8d0', 0.5); }
    glow(x, 50, 58, 50, RED, 0.45);
    for (const s of [-1, 1]) {
      x.save(); x.translate(50 + s * 5, 60); x.rotate(s * 0.1);
      x.beginPath(); x.arc(0, 0, 32, s > 0 ? -PI / 2 : PI / 2, s > 0 ? PI / 2 : PI * 1.5); x.closePath();
      x.save(); x.clip();
      x.fillStyle = rg(x, -12, -14, 2, 40, [[0, '#4a5a70'], [0.5, '#1c2432'], [1, '#05070c']]); x.fillRect(-40, -40, 80, 80);
      // continents
      x.fillStyle = rgba('#5a4a3a', 0.85);
      for (const [cx, cy, rx, ry] of [[-14, -12, 10, 6], [8, -18, 7, 5], [-6, 8, 12, 7], [14, 14, 8, 6], [-20, 16, 6, 4]]) { ellipse(x, cx, cy, rx, ry, 0.4); x.fill(); }
      x.fillStyle = 'rgba(255,255,255,.22)'; ellipse(x, -10, -22, 12, 2.2, -0.3); x.fill(); ellipse(x, 6, 2, 14, 1.8, -0.2); x.fill();
      // molten cut face
      x.fillStyle = lg(x, 0, 0, s * 8, 0, [[0, '#ffd080'], [0.4, '#ff5020'], [1, 'rgba(120,20,0,0)']]); x.fillRect(s > 0 ? 0 : -8, -34, 8, 68);
      x.restore();
      x.beginPath(); x.arc(0, 0, 32, s > 0 ? -PI / 2 : PI / 2, s > 0 ? PI / 2 : PI * 1.5); x.closePath(); outline(x, 'rgba(0,0,0,.9)', 1);
      x.strokeStyle = rgba('#ff9a8a', 0.6); x.lineWidth = 1.4; x.beginPath(); x.arc(0, 0, 33, s > 0 ? -PI * 0.45 : PI * 1.05, s > 0 ? -PI * 0.1 : PI * 1.45); x.stroke();
      x.restore();
    }
    glow(x, 50, 58, 34, EMB, 0.8);
    streak(x, 50, -6, 50, 106, 9, RED, { even: true });
    streak(x, 50, -6, 50, 106, 3.2, '#fff0d8', { even: true });
    rocks(x, R, 12, 50, 60, 36, { cols: ['#5a4a3e', '#2a2418'], size: 2.2, hot: EMB });
    embers(x, R, 16, 50, 56, 36, [EMB, HOT, RED]);
  },
};
