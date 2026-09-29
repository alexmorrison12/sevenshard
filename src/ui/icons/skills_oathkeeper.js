// Oathkeeper — gold & white light, longsword and holy tome.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, slash, slashAB, streak, ring, rays, burst, embers, backdrop,
  rgba, shade, mix, outline, metalLG, metalRG, runeCircle, speedLines, clouds, add, norm, glowPath, bolt, gem, cracks, rocks,
} from './core.js';
import { longsword, chain, featherWing, book, figure } from './motifs.js';
import { heater } from './generic.js';

const GOLD = '#ffd25a', WHITE = '#fffbe8', SKY = '#8ecaff';
const NAVY = ['#3c5a8c', '#10182e', '#03050a'];
const WARM = ['#c8963c', '#3e2a0e', '#070503'];
const sword = (x, px, py, rot, s, o = {}) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); longsword(x, { metal: 'silver', guard: 'gold', gem: '#4ab0ff', ...o }); x.restore(); };
function sunSigil(x, cx, cy, r, col = GOLD) {
  star(x, cx, cy, 8, r * 0.45, r); x.fillStyle = rg(x, cx - r * 0.3, cy - r * 0.3, 0, r, [[0, '#ffffff'], [0.5, col], [1, shade(col, -0.35)]]); x.fill(); outline(x, 'rgba(60,30,0,.8)', 0.8);
  circle(x, cx, cy, r * 0.42); x.fillStyle = rg(x, cx - r * 0.12, cy - r * 0.12, 0, r * 0.45, [[0, '#ffffff'], [1, mix(col, '#ffffff', 0.4)]]); x.fill(); outline(x, 'rgba(60,30,0,.7)', 0.6);
}
function feather(x, cx, cy, len, a, col = '#fffbe8') {
  x.save(); x.translate(cx, cy); x.rotate(a);
  x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(len * 0.3, -len * 0.22, len * 0.8, -len * 0.16, len, 0); x.bezierCurveTo(len * 0.7, len * 0.12, len * 0.3, len * 0.14, 0, 0); x.closePath();
  x.fillStyle = lg(x, 0, -len * 0.2, 0, len * 0.15, [[0, '#ffffff'], [1, shade(col, -0.25)]]); x.fill(); outline(x, 'rgba(90,70,30,.6)', 0.5);
  x.strokeStyle = 'rgba(150,120,60,.7)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(0, 0); x.lineTo(len * 0.95, 0); x.stroke();
  x.restore();
}

export const OATHKEEPER = {
  holy_bulwark(x, R) {
    backdrop(x, R, WARM);
    rays(x, R, 50, 46, 18, 10, 60, '#ffe8a0', { alpha: 0.45 });
    // dome of light
    glow(x, 50, 52, 46, GOLD, 0.55);
    x.save(); add(x); x.lineWidth = 2.4; x.strokeStyle = rgba('#fff0b0', 0.55); x.beginPath(); x.ellipse(50, 70, 42, 50, 0, PI, TAU); x.stroke();
    x.fillStyle = rg(x, 50, 70, 20, 50, [[0, rgba(GOLD, 0)], [1, rgba(GOLD, 0.25)]]); x.beginPath(); x.ellipse(50, 70, 42, 50, 0, PI, TAU); x.fill(); norm(x); x.restore();
    heater(x, 50, 52, 0.95, '#e8ecf2', 'gold', { trimW: 4.8, trimMetal: 'gold' });
    sunSigil(x, 50, 48, 13);
    sparkle(x, 30, 28, 8); sparkle(x, 74, 66, 5);
  },
  heavenly_blessing(x, R) {
    backdrop(x, R, ['#d8b060', '#4a3414', '#080603'], { cy: 20 });
    rays(x, R, 50, -10, 10, 30, 110, '#fff4c0', { arc: 1.2, a0: PI / 2 - 0.6, spread: 0.05, alpha: 0.5 });
    runeCircle(x, R, 50, 76, 40, GOLD, { sy: 0.34, points: 8, w: 1.3 });
    for (const px of [24, 50, 76]) streak(x, px, 76, px, 10, 5, GOLD, { even: false, bias: 0.6, a: 0.7 });
    feather(x, 28, 36, 16, 0.6); feather(x, 70, 26, 14, 2.4); feather(x, 62, 52, 12, -0.4);
    sparkle(x, 50, 44, 11);
  },
  light_shock(x, R) {
    backdrop(x, R, NAVY);
    glow(x, 50, 50, 44, GOLD, 0.6);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; bolt(x, R, 50 + Math.cos(a) * 16, 50 + Math.sin(a) * 16, 50 + Math.cos(a) * 44, 50 + Math.sin(a) * 44, { col: '#ffe890', w: 1.6, gens: 4, jit: 0.3 }); }
    // brand seal: ring + sword cross
    x.lineWidth = 4; x.strokeStyle = metalLG(x, 30, 30, 70, 70, 'gold'); circle(x, 50, 50, 19); x.stroke(); outline(x, 'rgba(60,30,0,.6)', 0.8);
    add(x); x.fillStyle = rg(x, 50, 50, 0, 18, [[0, 'rgba(255,255,240,.9)'], [1, 'rgba(255,220,120,.2)']]); circle(x, 50, 50, 17); x.fill(); norm(x);
    poly(x, [[50, 30], [54, 44], [66, 50], [54, 56], [50, 72], [46, 56], [34, 50], [46, 44]]); x.fillStyle = lg(x, 36, 32, 64, 68, [[0, '#ffffff'], [0.5, GOLD], [1, '#a06a10']]); x.fill(); outline(x, 'rgba(80,40,0,.85)', 1);
    sparkle(x, 50, 50, 9);
  },
  sword_of_justice(x, R) {
    backdrop(x, R, WARM, { angle: 0.8 });
    glow(x, 54, 44, 40, GOLD, 0.45);
    slashAB(x, 12, 70, 86, 16, 16, 11, GOLD, { hot: '#fff6d0' });
    slashAB(x, 24, 90, 92, 40, 12, 7, GOLD, { hot: '#fff6d0' });
    sword(x, 30, 80, 0.72, 0.95);
    embers(x, R, 14, 60, 40, 36, [GOLD, WHITE]);
    sparkle(x, 82, 20, 8);
  },
  godsent_law(x, R) { // a colossal sword of light driven down from the heavens
    backdrop(x, R, ['#7080b8', '#1a2244', '#04050c'], { cy: 16, shaft: false });
    rays(x, R, 50, 0, 18, 10, 110, '#fff4c8', { arc: 1.3, a0: PI / 2 - 0.65, spread: 0.05, alpha: 0.45 });
    clouds(x, R, 50, 4, 116, 18, ['#fff6d8', '#b0a8a0', '#3a3a4a'], 10);
    x.fillStyle = lg(x, 0, 74, 0, 100, [[0, 'rgba(20,20,40,0)'], [1, 'rgba(10,10,20,.8)']]); x.fillRect(0, 74, 100, 26);
    glow(x, 50, 84, 40, GOLD, 0.8);
    cracks(x, R, 50, 88, 8, 36, GOLD, { sy: 0.3, w: 1.2 });
    ring(x, 50, 88, 40, 9, GOLD, 2);
    sword(x, 50, 8, PI, 1.28, { glow: '#ffe070', glowR: 10, rune: '#ffffff', metal: 'gold', guardW: 30 });
    burst(x, R, 50, 86, 12, 6, 22, '#fff0b0', { sy: 0.5 });
    rocks(x, R, 8, 50, 80, 36, { cols: ['#6a6070', '#2a2430'], a0: PI, arc: PI, size: 2.6, hot: GOLD });
  },
  holy_explosion(x, R) {
    backdrop(x, R, ['#e0b050', '#5a3a10', '#0a0602']);
    glow(x, 50, 50, 50, GOLD, 0.8);
    rays(x, R, 50, 50, 24, 12, 64, '#fff0b0', { alpha: 0.65 });
    burst(x, R, 50, 50, 14, 10, 34, GOLD);
    ring(x, 50, 50, 30, 30, WHITE, 1.6, 0.8);
    ring(x, 50, 50, 18, 18, GOLD, 1.1, 0.7);
    sparkle(x, 50, 50, 18);
    embers(x, R, 18, 50, 50, 44, [GOLD, WHITE]);
  },
  flash_slash(x, R) {
    backdrop(x, R, ['#4a6ea8', '#0e1a36', '#02040a'], { angle: 0 });
    speedLines(x, R, 12, [30, 30, 100, 70], PI, SKY, { len: 26, w: 1 });
    glow(x, 50, 52, 44, SKY, 0.4);
    slashAB(x, 4, 60, 96, 44, 4, 8, SKY, { hot: '#f0f8ff' });
    streak(x, 2, 53, 98, 51, 1.6, '#ffffff', { even: true });
    sword(x, 22, 88, 1.2, 0.72, { glow: SKY, glowR: 5 });
    sparkle(x, 90, 46, 14, '#ffffff', 0.2);
    rays(x, R, 90, 46, 8, 4, 24, '#ffffff', { alpha: 0.6 });
  },
  execution_of_justice(x, R) {
    backdrop(x, R, WARM, { angle: 0 });
    glow(x, 70, 50, 40, GOLD, 0.6);
    for (let i = 0; i < 6; i++) { const y1 = 22 + i * 11 + (R() - 0.5) * 4; streak(x, 6, 50 + (y1 - 50) * 0.35, 86, y1, 4.2, GOLD, { bias: 1.8 }); }
    burst(x, R, 84, 50, 10, 5, 20, GOLD);
    sword(x, 34, 50, PI / 2, 0.9, { glow: '#ffe070', glowR: 6 });
    sparkle(x, 86, 50, 11);
  },
  wrath_of_heaven(x, R) {
    backdrop(x, R, ['#606890', '#161a30', '#030408'], { cy: 20, shaft: false });
    clouds(x, R, 50, 8, 110, 24, ['#e8e0d0', '#6a6a80', '#1a1a28'], 8);
    glow(x, 50, 84, 40, GOLD, 0.7);
    // pillar of light from the clouds
    add(x);
    x.fillStyle = lg(x, 30, 0, 70, 0, [[0, rgba(GOLD, 0)], [0.25, rgba(GOLD, 0.45)], [0.45, rgba('#fffbe8', 0.95)], [0.55, rgba('#fffbe8', 0.95)], [0.75, rgba(GOLD, 0.45)], [1, rgba(GOLD, 0)]]);
    poly(x, [[38, 14], [62, 14], [68, 86], [32, 86]]); x.fill(); norm(x);
    ring(x, 50, 86, 34, 9, GOLD, 1.8);
    ring(x, 50, 86, 20, 5, WHITE, 1.1);
    embers(x, R, 16, 50, 60, 30, [GOLD, WHITE]);
  },
  charging_blade(x, R) { // a knight dashing sword-first
    backdrop(x, R, ['#c09040', '#3a260c', '#060402'], { angle: 0 });
    speedLines(x, R, 20, [0, 16, 60, 90], 0, '#ffe8a0', { len: 34, w: 2 });
    glow(x, 60, 52, 38, GOLD, 0.55);
    x.save(); add(x); x.fillStyle = lg(x, 0, 0, 60, 0, [[0, rgba(GOLD, 0)], [1, rgba(GOLD, 0.5)]]); poly(x, [[0, 36], [58, 40], [58, 66], [0, 74]]); x.fill(); norm(x); x.restore();
    figure(x, { head: [52, 32], neck: [50, 38], sh: [[42, 40], [57, 42]], el: [[34, 50], [64, 48]], ha: [[26, 46], [71, 48]], hip: [44, 62], kn: [[57, 70], [34, 72]], ft: [[63, 88], [18, 80]] },
      { col: '#0e1426', rim: '#ffe090', s: 1.3, cape: [30, 50, 14, 58] });
    sword(x, 70, 49, PI / 2, 0.78, { glow: '#ffe070', glowR: 5 });
    sparkle(x, 94, 49, 10);
  },
  sacred_chain(x, R) {
    backdrop(x, R, NAVY);
    glow(x, 50, 50, 40, GOLD, 0.6);
    runeCircle(x, R, 50, 50, 16, GOLD, { points: 6, w: 1 });
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + PI / 4, ex = 50 + Math.cos(a) * 52, ey = 50 + Math.sin(a) * 52;
      chain(x, t => [ex + (50 + Math.cos(a) * 16 - ex) * t, ey + (50 + Math.sin(a) * 16 - ey) * t], 9, 3.2, 'gold', { glow: GOLD });
    }
    sparkle(x, 50, 50, 12);
    embers(x, R, 10, 50, 50, 40, [GOLD, WHITE]);
  },
  rite_of_mending(x, R) {
    backdrop(x, R, ['#6aa84a', '#183a14', '#030803']);
    runeCircle(x, R, 50, 74, 38, '#b8ff80', { sy: 0.34, points: 6, w: 1.2 });
    glow(x, 50, 56, 40, '#a8ff70', 0.55);
    for (let i = 0; i < 14; i++) { const px = 18 + R() * 64, py = 20 + R() * 56; glow(x, px, py, 2 + R() * 3, i % 2 ? '#d8ffb0' : GOLD, 0.8); }
    // cross of light
    poly(x, [[45, 26], [55, 26], [55, 42], [71, 42], [71, 52], [55, 52], [55, 70], [45, 70], [45, 52], [29, 52], [29, 42], [45, 42]]);
    x.fillStyle = lg(x, 30, 26, 70, 70, [[0, '#ffffff'], [0.5, '#e0ffc0'], [1, '#78c050']]); x.fill(); outline(x, 'rgba(20,60,10,.8)', 1.2);
    sparkle(x, 50, 47, 10);
  },
  identity_z(x, R) { // Aegis of Dawn: sunrise behind a winged shield
    backdrop(x, R, ['#f0a850', '#6a2a14', '#0a0306'], { cy: 64, cx: 50 });
    glow(x, 50, 64, 50, '#ffc060', 0.8);
    rays(x, R, 50, 64, 20, 20, 70, '#ffe8a0', { alpha: 0.55 });
    x.save(); x.beginPath(); x.rect(0, 0, 100, 70); x.clip();
    x.fillStyle = rg(x, 50, 70, 4, 30, [[0, '#ffffff'], [0.4, '#fff0b0'], [1, '#ffa040']]); circle(x, 50, 70, 26); x.fill(); x.restore();
    x.fillStyle = lg(x, 0, 70, 0, 100, [[0, '#3a1a10'], [1, '#0a0406']]); x.fillRect(0, 70, 100, 30);
    x.save(); x.translate(50, 52); featherWing(x, -1, 1.1, ['#ffffff', '#ffe8b0', '#a07a3a'], 8); featherWing(x, 1, 1.1, ['#ffffff', '#ffe8b0', '#a07a3a'], 8); x.restore();
    heater(x, 50, 56, 0.58, '#f4f0e8', 'gold', { trimW: 4.4 });
    sunSigil(x, 50, 53, 8.5);
  },
  identity_x(x, R) { // Sacred Punishment: lances of light converging on one point
    backdrop(x, R, ['#9a8050', '#2a2010', '#050403']);
    glow(x, 50, 56, 36, GOLD, 0.8);
    for (const [ax, ay] of [[8, 8], [92, 8], [4, 70], [96, 70]]) streak(x, ax, ay, 50, 56, 5, GOLD, { bias: 0.7 });
    burst(x, R, 50, 56, 12, 8, 26, GOLD);
    ring(x, 50, 64, 30, 8, WHITE, 1.4);
    sparkle(x, 50, 56, 16);
    embers(x, R, 14, 50, 56, 34, [GOLD, WHITE]);
  },
  awakening(x, R) { // Radiant Judgment: great wings of light, halo and sword
    backdrop(x, R, ['#ffe0a0', '#8a5a1a', '#140a02'], { cy: 44, cx: 50 });
    rays(x, R, 50, 40, 26, 10, 70, '#ffffff', { alpha: 0.45 });
    glow(x, 50, 42, 46, '#fff0c0', 0.8);
    x.save(); x.translate(50, 46); featherWing(x, -1, 1.2, ['#ffffff', '#fff0c8', '#b89050'], 9); featherWing(x, 1, 1.2, ['#ffffff', '#fff0c8', '#b89050'], 9); x.restore();
    x.lineWidth = 3; x.strokeStyle = metalLG(x, 32, 12, 68, 24, 'gold'); ellipse(x, 50, 17, 15, 4.5); x.stroke(); glow(x, 50, 17, 18, '#fff0a0', 0.7);
    sword(x, 50, 30, PI, 0.9, { glow: '#fff4c0', glowR: 8, metal: 'gold', rune: '#ffffff' });
    sparkle(x, 50, 86, 12);
  },
};
