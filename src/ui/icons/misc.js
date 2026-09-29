// Currencies (transparent), status effects (small bold tiles), UI menu glyphs (transparent, champagne metal).
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, rays, rgba, shade, mix, outline, metalLG, metalRG, gem, crystal,
  fire, fireLayers, bolt, glowPath, add, norm, ribbon, bez, qbez, shadowBlob, burst, streak, speedLines,
} from './core.js';
import { skull, arrowUp, greatsword, longsword, bootUp, featherWing, eye, figure, fist } from './motifs.js';
import { coin, heaterPath, heater } from './generic.js';
import { flask } from './items_misc.js';

const INK = 'rgba(6,4,8,.92)';
const at = (x, px, py, rot, s, fn, o) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); fn(x, o); x.restore(); };
function drop(x, cx, cy, r, col) {
  x.beginPath(); x.moveTo(cx, cy - r * 1.7); x.bezierCurveTo(cx + r * 0.4, cy - r * 0.8, cx + r, cy - r * 0.2, cx + r, cy + r * 0.3); x.arc(cx, cy + r * 0.3, r, 0, PI); x.bezierCurveTo(cx - r, cy - r * 0.2, cx - r * 0.4, cy - r * 0.8, cx, cy - r * 1.7); x.closePath();
  x.fillStyle = rg(x, cx - r * 0.35, cy - r * 0.2, 0, r * 1.5, [[0, '#ffffff'], [0.3, mix(col, '#ffffff', 0.35)], [0.75, col], [1, shade(col, -0.55)]]); x.fill(); outline(x, INK, 1.2);
}

// ------------------------------------------------------------------ currencies
const CUR = {
  silver(x, R) { coin(x, 40, 60, 24, 'silver'); coin(x, 60, 46, 24, 'silver'); },
  gold(x, R) { glow(x, 52, 48, 34, '#ffd040', 0.35); coin(x, 38, 62, 22, 'gold'); coin(x, 56, 46, 28, 'gold'); },
  crystal(x, R) { glow(x, 50, 50, 38, '#40a8ff', 0.5); crystal(x, 50, 90, 80, 38, -PI / 2, '#3a9aff', { skew: 0.05, glowA: 0.2 }); sparkle(x, 44, 30, 8); },
  royal(x, R) {
    glow(x, 50, 54, 38, '#b060ff', 0.5);
    gem(x, 50, 58, 26, '#a050ff', { n: 8, sy: 1.1, glowA: 0.3 });
    // crown
    poly(x, [[30, 30], [36, 14], [43, 24], [50, 8], [57, 24], [64, 14], [70, 30]]); x.fillStyle = metalLG(x, 30, 8, 70, 30, 'gold'); x.fill(); outline(x, INK, 1.1);
    for (const px of [36, 50, 64]) { x.fillStyle = '#ff3a5a'; circle(x, px, px === 50 ? 10 : 16, 2.2); x.fill(); }
  },
  shards(x, R) {
    glow(x, 50, 52, 38, '#fff0c0', 0.5);
    for (const [px, py, l, w, a] of [[50, 84, 60, 20, -PI / 2], [30, 84, 40, 14, -PI / 2 - 0.45], [70, 84, 42, 14, -PI / 2 + 0.4]]) crystal(x, px, py, l, w, a, '#ffe6a8', { glowA: 0.2 });
    sparkle(x, 50, 26, 9);
  },
  bloodstone(x, R) {
    glow(x, 50, 52, 36, '#ff2030', 0.45);
    x.beginPath(); x.ellipse(50, 54, 30, 26, 0, 0, TAU); x.fillStyle = rg(x, 40, 42, 2, 34, [[0, '#ffb0b0'], [0.3, '#e02030'], [0.8, '#5a0408'], [1, '#200002']]); x.fill(); outline(x, INK, 1.3);
    x.strokeStyle = metalLG(x, 34, 34, 66, 74, 'gold'); x.lineWidth = 2.4; poly(x, [[50, 36], [64, 54], [50, 72], [36, 54]]); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.55)'; ellipse(x, 40, 42, 8, 4, -0.5); x.fill();
  },
  pirate(x, R) { coin(x, 50, 52, 32, 'gold', { emblem: false }); x.save(); x.translate(50, 50); skull(x, 0.76, { bone: ['#8a5a10', '#6a4008', '#4a2a04', '#2a1802'] }); x.restore(); },
  token(x, R) {
    coin(x, 50, 52, 32, 'silver', { emblem: false });
    star(x, 50, 51, 5, 8, 20); x.fillStyle = lg(x, 30, 30, 70, 70, [[0, '#ffffff'], [0.5, '#6ac0ff'], [1, '#1a5aa0']]); x.fill(); outline(x, INK, 1);
  },
  pvp(x, R) {
    // medal with crossed swords on a ribbon
    x.fillStyle = lg(x, 30, 0, 70, 0, [[0, '#8a1a1a'], [0.5, '#e03a3a'], [1, '#8a1a1a']]); poly(x, [[34, 6], [48, 6], [56, 40], [42, 40]]); x.fill(); outline(x, INK, 1); poly(x, [[66, 6], [52, 6], [44, 40], [58, 40]]); x.fill(); outline(x, INK, 1);
    coin(x, 50, 62, 28, 'bronze', { emblem: false });
    at(x, 38, 76, 0.75, 0.42, longsword, { metal: 'silver', guard: 'gold' }); at(x, 62, 76, -0.75, 0.42, longsword, { metal: 'silver', guard: 'gold' });
  },
};

// ------------------------------------------------------------------ status effects
function sBg(x, R, col) {
  x.fillStyle = rg(x, 42, 36, 2, 70, [[0, shade(col, -0.3)], [0.55, shade(col, -0.75)], [1, '#050507']]); x.fillRect(0, 0, 100, 100);
  glow(x, 50, 50, 42, col, 0.45);
}
function fillSym(x, col, lw = 2) { x.fillStyle = lg(x, 25, 15, 75, 85, [[0, '#ffffff'], [0.35, mix(col, '#ffffff', 0.4)], [0.8, col], [1, shade(col, -0.45)]]); x.fill(); outline(x, INK, lw); }
const STATUS = {
  burn(x, R) { sBg(x, R, '#ff6a1e'); fire(x, R, 50, 90, 74, 52, 0, { n: 5 }); },
  bleed(x, R) { sBg(x, R, '#e01a28'); drop(x, 50, 46, 18, '#e01a28'); drop(x, 24, 76, 8, '#e01a28'); drop(x, 76, 78, 7, '#e01a28'); },
  poison(x, R) {
    sBg(x, R, '#60d020');
    drop(x, 50, 56, 22, '#60c020');
    x.save(); x.translate(50, 60); skull(x, 0.52, { bone: ['#1a3a0a', '#123008', '#0a2004', '#040a02'] }); x.restore();
    for (const [px, py, r] of [[26, 26, 4], [74, 22, 3], [70, 40, 2.4]]) { circle(x, px, py, r); x.fillStyle = rg(x, px - 1, py - 1, 0, r, [[0, '#e0ffb0'], [1, '#4a9a10']]); x.fill(); outline(x, INK, 0.8); }
  },
  freeze(x, R) {
    sBg(x, R, '#5ac8ff');
    x.save(); x.translate(50, 50);
    for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * PI / 3); x.beginPath(); x.moveTo(-3.4, 0); x.lineTo(-3.4, -32); x.lineTo(0, -38); x.lineTo(3.4, -32); x.lineTo(3.4, 0); x.closePath(); x.moveTo(-1.5, -18); x.lineTo(-12, -26); x.lineTo(-10, -30); x.lineTo(0, -24); x.lineTo(10, -30); x.lineTo(12, -26); x.lineTo(1.5, -18); x.closePath(); fillSym(x, '#8ad8ff', 1.4); x.restore(); }
    x.restore();
  },
  shock(x, R) { sBg(x, R, '#ffd020'); x.save(); x.translate(50, 50); x.scale(1.6, 1.6); poly(x, [[4, -26], [-12, 3], [-1, 3], [-7, 26], [12, -5], [1, -5]]); fillSym(x, '#ffe040', 1.2); x.restore(); },
  stun(x, R) {
    sBg(x, R, '#ffcc30');
    x.save(); add(x); x.lineWidth = 3; x.strokeStyle = rgba('#fff0a0', 0.6); ellipse(x, 50, 56, 36, 14); x.stroke(); norm(x); x.restore();
    for (const [a, s] of [[PI * 0.1, 1], [PI * 0.75, 0.8], [PI * 1.4, 0.9]]) { const px = 50 + Math.cos(a) * 34, py = 56 + Math.sin(a) * 13; star(x, px, py, 5, 5.5 * s, 13 * s); fillSym(x, '#ffd040', 1.4); }
  },
  fear(x, R) {
    sBg(x, R, '#a040ff');
    x.beginPath(); x.moveTo(50, 12); x.bezierCurveTo(76, 12, 84, 40, 80, 60); x.lineTo(86, 88); x.lineTo(72, 80); x.lineTo(62, 90); x.lineTo(50, 80); x.lineTo(38, 90); x.lineTo(28, 80); x.lineTo(14, 88); x.lineTo(20, 60); x.bezierCurveTo(16, 40, 24, 12, 50, 12); x.closePath();
    fillSym(x, '#d0a8ff', 2);
    x.fillStyle = '#12021e'; ellipse(x, 38, 42, 6, 9, 0.2); x.fill(); ellipse(x, 62, 42, 6, 9, -0.2); x.fill(); ellipse(x, 50, 64, 6, 9); x.fill();
  },
  sleep(x, R) {
    sBg(x, R, '#8a8aff');
    x.save(); x.beginPath(); x.arc(46, 52, 30, 0, TAU); x.arc(60, 42, 26, 0, TAU, true); fillSym(x, '#fff0b0', 2); x.restore();
    for (const [px, py, s] of [[74, 24, 7], [84, 44, 5]]) { star(x, px, py, 4, s * 0.35, s); x.fillStyle = '#ffffff'; x.fill(); }
  },
  silence(x, R) {
    sBg(x, R, '#6a8ab0');
    x.beginPath(); x.moveTo(20, 30); x.quadraticCurveTo(20, 18, 34, 18); x.lineTo(70, 18); x.quadraticCurveTo(82, 18, 82, 30); x.lineTo(82, 56); x.quadraticCurveTo(82, 68, 70, 68); x.lineTo(44, 68); x.lineTo(28, 84); x.lineTo(32, 68); x.quadraticCurveTo(20, 68, 20, 56); x.closePath();
    fillSym(x, '#c8d8f0', 2);
    x.strokeStyle = '#e02a2a'; x.lineWidth = 7; x.beginPath(); x.moveTo(18, 88); x.lineTo(86, 14); x.stroke(); x.strokeStyle = INK; x.lineWidth = 1.2; x.stroke();
  },
  slow(x, R) {
    sBg(x, R, '#40b0a0');
    // snail
    x.beginPath(); x.moveTo(12, 78); x.lineTo(80, 78); x.quadraticCurveTo(92, 78, 90, 66); x.lineTo(84, 60); x.lineTo(80, 70); x.lineTo(14, 72); x.closePath(); fillSym(x, '#b0f0e0', 1.6);
    circle(x, 44, 50, 26); fillSym(x, '#60c8b0', 2);
    glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.03) { const a = t * TAU * 2.2, r = 22 * (1 - t); const px = 44 + Math.cos(a) * r, py = 50 + Math.sin(a) * r; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, '#e0fff8', 1.6);
    x.strokeStyle = INK; x.lineWidth = 2; x.beginPath(); x.moveTo(84, 62); x.lineTo(88, 48); x.moveTo(88, 62); x.lineTo(94, 50); x.stroke();
  },
  knockdown(x, R) {
    sBg(x, R, '#ff9030');
    figure(x, { head: [26, 64], neck: [32, 64], sh: [[34, 58], [36, 68]], el: [[40, 50], [44, 76]], ha: [[46, 44], [52, 80]], hip: [56, 66], kn: [[66, 54], [70, 66]], ft: [[76, 44], [84, 60]] }, { col: '#fff0e0', s: 1.6 });
    x.strokeStyle = rgba('#ffffff', 0.8); x.lineWidth = 2; for (const px of [20, 50, 80]) { x.beginPath(); x.moveTo(px - 8, 86); x.lineTo(px + 8, 86); x.stroke(); }
    arrowUp(x, 50, 24, 1.1, '#ffb050', { down: true });
  },
  shield(x, R) { sBg(x, R, '#4ab0ff'); heaterPath(x, 50, 52, 1.12); fillSym(x, '#8ad0ff', 2.4); heaterPath(x, 50, 52, 0.8); x.strokeStyle = rgba('#ffffff', 0.7); x.lineWidth = 1.6; x.stroke(); },
  heal(x, R) { sBg(x, R, '#50e070'); poly(x, [[40, 12], [60, 12], [60, 40], [88, 40], [88, 60], [60, 60], [60, 88], [40, 88], [40, 60], [12, 60], [12, 40], [40, 40]]); fillSym(x, '#80f090', 2.4); },
  atk_up(x, R) { sBg(x, R, '#ff4a3a'); at(x, 30, 84, 0.62, 0.95, greatsword, { metal: 'steel', rune: '#ff6040' }); arrowUp(x, 74, 34, 2, '#ff7a5a'); },
  crit_up(x, R) {
    sBg(x, R, '#ffb020');
    burst(x, R, 42, 56, 10, 10, 34, '#ffc040');
    star(x, 42, 56, 8, 8, 22); fillSym(x, '#ffd060', 1.6);
    arrowUp(x, 76, 32, 1.8, '#ffe070');
  },
  speed_up(x, R) {
    sBg(x, R, '#40d0ff');
    speedLines(x, R, 8, [4, 40, 40, 90], 0, '#c0f0ff', { len: 22, w: 2.4 });
    at(x, 34, 44, 0, 1, xx => featherWing(xx, -1, 0.55, ['#ffffff', '#c0f0ff', '#2a8aa8'], 6));
    at(x, 46, 86, 0, 1.1, bootUp, { metal: 'silver', col: '#2a5a7a' });
    arrowUp(x, 80, 30, 1.6, '#80e8ff');
  },
  def_down(x, R) {
    sBg(x, R, '#c83a3a');
    heaterPath(x, 42, 52, 1); fillSym(x, '#a0a8b8', 2.2);
    glowPath(x, xx => poly(xx, [[42, 16], [36, 36], [48, 48], [38, 70], [44, 86]], false), '#ff5a3a', 2);
    arrowUp(x, 76, 64, 1.8, '#ff5a3a', { down: true });
  },
  brand(x, R) {
    sBg(x, R, '#ff4ab0');
    x.lineWidth = 5; x.strokeStyle = '#ff9ad0'; circle(x, 50, 50, 32); x.stroke(); outline(x, INK, 1);
    poly(x, [[50, 18], [58, 42], [82, 50], [58, 58], [50, 82], [42, 58], [18, 50], [42, 42]]); fillSym(x, '#ff7ac0', 1.8);
    x.fillStyle = '#ffffff'; circle(x, 50, 50, 6); x.fill();
  },
  counter(x, R) {
    sBg(x, R, '#3a8aff');
    burst(x, R, 50, 50, 12, 12, 44, '#6ab8ff');
    x.save(); x.translate(50, 50); x.scale(1.3, 1.3); poly(x, [[4, -26], [-12, 3], [-1, 3], [-7, 26], [12, -5], [1, -5]]); fillSym(x, '#bfe0ff', 1); x.restore();
  },
  stagger(x, R) {
    sBg(x, R, '#b060ff');
    glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.02) { const a = t * TAU * 2.4, r = 36 * (1 - t) + 2; const px = 50 + Math.cos(a) * r, py = 50 + Math.sin(a) * r * 0.8; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, '#e0b0ff', 4.2);
  },
  invuln(x, R) {
    sBg(x, R, '#ffd040');
    x.save(); add(x); x.fillStyle = rg(x, 42, 40, 4, 40, [[0, rgba('#ffffff', 0.5)], [0.7, rgba('#ffd040', 0.25)], [1, rgba('#ffd040', 0.7)]]); x.beginPath(); x.arc(50, 70, 38, PI, TAU); x.closePath(); x.fill(); norm(x); x.restore();
    x.lineWidth = 4; x.strokeStyle = '#fff0a0'; x.beginPath(); x.arc(50, 70, 38, PI, TAU); x.stroke(); outline(x, INK, 1);
    x.strokeStyle = rgba('#ffffff', 0.9); x.lineWidth = 3; x.beginPath(); x.arc(50, 70, 30, PI * 1.15, PI * 1.45); x.stroke();
    x.fillStyle = '#fff4c8'; x.fillRect(10, 70, 80, 5); outline(x, INK, 1); x.strokeRect(10, 70, 80, 5);
    star(x, 50, 54, 4, 4, 12); x.fillStyle = '#ffffff'; x.fill();
  },
  super_armor(x, R) {
    sBg(x, R, '#e8a020');
    x.save(); x.translate(50, 54); x.scale(1.25, 1.25);
    // breastplate + pauldrons in gold, star emblem
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 22, -14, 14, 10, s * 0.35, 0, TAU); x.fillStyle = metalLG(x, s * 22 - 14, -24, s * 22 + 14, -4, 'gold'); x.fill(); outline(x, INK, 1.2); }
    x.beginPath(); x.moveTo(-18, -20); x.quadraticCurveTo(0, -12, 18, -20); x.lineTo(20, 6); x.quadraticCurveTo(14, 26, 0, 30); x.quadraticCurveTo(-14, 26, -20, 6); x.closePath();
    x.fillStyle = rg(x, -6, -10, 1, 34, [[0, '#fff4c8'], [0.35, '#ffcc50'], [0.8, '#a86a10'], [1, '#4a2a04']]); x.fill(); outline(x, INK, 1.4);
    x.strokeStyle = 'rgba(80,40,0,.7)'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(0, -14); x.lineTo(0, 26); x.stroke(); x.beginPath(); x.moveTo(-18, 8); x.quadraticCurveTo(0, 16, 18, 8); x.stroke();
    x.restore();
    star(x, 50, 50, 5, 3.4, 8); x.fillStyle = '#ffffff'; x.fill(); outline(x, INK, 0.8);
  },
  rest(x, R) {
    sBg(x, R, '#ffa040');
    for (const [a, c] of [[-0.5, '#8a5a2a'], [0.5, '#6a4020']]) { x.save(); x.translate(50, 80); x.rotate(a); x.beginPath(); x.roundRect(-28, -5, 56, 10, 5); x.fillStyle = lg(x, 0, -5, 0, 5, [[0, shade(c, 0.4)], [1, shade(c, -0.5)]]); x.fill(); outline(x, INK, 1.4); x.restore(); }
    fire(x, R, 50, 76, 56, 40, 0, { n: 5 });
    for (const [px, py, s] of [[76, 22, 7], [86, 10, 5]]) { x.strokeStyle = '#ffffff'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(px - s, py - s); x.lineTo(px + s, py - s); x.lineTo(px - s, py + s); x.lineTo(px + s, py + s); x.stroke(); }
  },
};

// ------------------------------------------------------------------ UI menu glyphs
const CHAMP = ['#fffaf0', '#f2dfb4', '#c8a86a', '#6a5026', '#2a1e0a'];
/** Fill the current path with champagne metal, dark outline, top-left sheen. */
function gfill(x, lw = 2.2, m = CHAMP) {
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 3; x.shadowOffsetY = 1.5; x.fillStyle = '#000'; x.fill(); x.restore();
  x.fillStyle = lg(x, 18, 12, 82, 88, [[0, m[0]], [0.3, m[1]], [0.65, m[2]], [1, m[3]]]); x.fill();
  x.lineWidth = lw; x.strokeStyle = INK; x.stroke();
}
/** Dark inset detail stroke. */
function inset(x, lw = 2.4) { x.lineWidth = lw; x.strokeStyle = 'rgba(40,26,8,.9)'; x.stroke(); }
const UI = {
  character(x) {
    x.beginPath(); x.moveTo(18, 92); x.bezierCurveTo(18, 70, 30, 60, 50, 60); x.bezierCurveTo(70, 60, 82, 70, 82, 92); x.closePath(); gfill(x);
    x.beginPath(); x.moveTo(30, 44); x.bezierCurveTo(28, 12, 72, 12, 70, 44); x.lineTo(66, 56); x.lineTo(34, 56); x.closePath(); gfill(x);
    x.beginPath(); x.moveTo(36, 40); x.lineTo(64, 40); x.moveTo(50, 24); x.lineTo(50, 52); inset(x, 3);
  },
  inventory(x) {
    // satchel: body, flap with buckle, carry strap
    x.beginPath(); x.moveTo(30, 34); x.bezierCurveTo(30, 14, 70, 14, 70, 34); inset(x, 6); x.strokeStyle = CHAMP[2]; x.lineWidth = 3.6; x.stroke();
    x.beginPath(); x.moveTo(14, 40); x.quadraticCurveTo(14, 32, 22, 32); x.lineTo(78, 32); x.quadraticCurveTo(86, 32, 86, 40); x.lineTo(88, 82); x.quadraticCurveTo(88, 92, 78, 92); x.lineTo(22, 92); x.quadraticCurveTo(12, 92, 12, 82); x.closePath(); gfill(x);
    x.beginPath(); x.moveTo(14, 40); x.quadraticCurveTo(14, 32, 22, 32); x.lineTo(78, 32); x.quadraticCurveTo(86, 32, 86, 40); x.lineTo(84, 58); x.quadraticCurveTo(50, 68, 16, 58); x.closePath(); gfill(x, 2);
    x.beginPath(); x.roundRect(43, 54, 14, 14, 2); x.fillStyle = 'rgba(40,26,8,.95)'; x.fill(); x.beginPath(); x.roundRect(46, 57, 8, 8, 1); x.fillStyle = CHAMP[1]; x.fill();
    x.beginPath(); x.moveTo(20, 76); x.lineTo(80, 76); inset(x, 1.6);
  },
  skills(x) {
    x.beginPath(); x.moveTo(50, 28); x.bezierCurveTo(38, 20, 20, 20, 10, 26); x.lineTo(10, 84); x.bezierCurveTo(22, 78, 38, 78, 50, 86); x.bezierCurveTo(62, 78, 78, 78, 90, 84); x.lineTo(90, 26); x.bezierCurveTo(80, 20, 62, 20, 50, 28); x.closePath(); gfill(x);
    x.beginPath(); x.moveTo(50, 30); x.lineTo(50, 84); inset(x, 2.4);
    star(x, 50, 12, 4, 3, 10); x.fillStyle = '#fff4c8'; x.fill(); outline(x, INK, 1.2);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(50 + s * 10, 40 + i * 12); x.quadraticCurveTo(50 + s * 22, 36 + i * 12, 50 + s * 32, 38 + i * 12); inset(x, 2); }
  },
  engravings(x) {
    circle(x, 50, 50, 38); gfill(x);
    circle(x, 50, 50, 28); inset(x, 3);
    star(x, 50, 50, 6, 8, 20); x.fillStyle = 'rgba(40,26,8,.85)'; x.fill();
    circle(x, 50, 50, 5); x.fillStyle = '#fffaf0'; x.fill();
  },
  cards(x) {
    for (const [a, dx] of [[-0.35, -12], [0, 0], [0.35, 12]]) { x.save(); x.translate(50 + dx, 56); x.rotate(a); x.beginPath(); x.roundRect(-16, -30, 32, 50, 4); gfill(x, 2); x.beginPath(); x.roundRect(-11, -25, 22, 40, 2); inset(x, 1.8); x.restore(); }
    star(x, 50, 44, 4, 3, 8); x.fillStyle = 'rgba(40,26,8,.9)'; x.fill();
  },
  gems(x) {
    poly(x, [[26, 36], [36, 20], [64, 20], [74, 36], [50, 88]]); gfill(x);
    x.beginPath(); x.moveTo(26, 36); x.lineTo(74, 36); x.moveTo(36, 20); x.lineTo(44, 36); x.lineTo(50, 88); x.lineTo(56, 36); x.lineTo(64, 20); inset(x, 2.2);
  },
  map(x) {
    poly(x, [[10, 24], [36, 14], [64, 24], [90, 14], [90, 78], [64, 88], [36, 78], [10, 88]]); gfill(x);
    x.beginPath(); x.moveTo(36, 14); x.lineTo(36, 78); x.moveTo(64, 24); x.lineTo(64, 88); inset(x, 2.2);
    x.beginPath(); x.moveTo(22, 64); x.bezierCurveTo(34, 60, 44, 44, 54, 50); x.bezierCurveTo(62, 54, 70, 44, 76, 38); x.setLineDash([3, 3]); inset(x, 2.2); x.setLineDash([]);
    x.beginPath(); x.moveTo(72, 34); x.lineTo(80, 42); x.moveTo(80, 34); x.lineTo(72, 42); inset(x, 3);
  },
  guild(x) {
    x.beginPath(); x.moveTo(24, 8); x.lineTo(24, 94); inset(x, 5); x.strokeStyle = lg(x, 20, 0, 28, 0, [[0, CHAMP[1]], [1, CHAMP[3]]]); x.lineWidth = 3.4; x.stroke();
    x.beginPath(); x.moveTo(28, 14); x.lineTo(82, 14); x.lineTo(82, 64); x.lineTo(55, 54); x.lineTo(28, 64); x.closePath(); gfill(x);
    heaterPath(x, 55, 34, 0.42); inset(x, 2.2);
    circle(x, 24, 8, 5); gfill(x, 1.6);
  },
  market(x) {
    x.beginPath(); x.moveTo(50, 14); x.lineTo(50, 84); inset(x, 6); x.strokeStyle = CHAMP[1]; x.lineWidth = 3.6; x.stroke();
    x.beginPath(); x.moveTo(14, 26); x.lineTo(86, 26); inset(x, 6); x.strokeStyle = CHAMP[1]; x.lineWidth = 3.6; x.stroke();
    for (const cx of [22, 78]) { x.beginPath(); x.moveTo(cx, 28); x.lineTo(cx - 12, 54); x.moveTo(cx, 28); x.lineTo(cx + 12, 54); inset(x, 1.8); x.beginPath(); x.moveTo(cx - 16, 54); x.quadraticCurveTo(cx, 70, cx + 16, 54); x.closePath(); gfill(x, 2); }
    x.beginPath(); x.moveTo(32, 90); x.lineTo(68, 90); x.lineTo(60, 80); x.lineTo(40, 80); x.closePath(); gfill(x, 2);
    circle(x, 50, 14, 6); gfill(x, 1.8);
  },
  mail(x) {
    x.beginPath(); x.roundRect(10, 24, 80, 54, 5); gfill(x);
    x.beginPath(); x.moveTo(12, 28); x.lineTo(50, 56); x.lineTo(88, 28); inset(x, 3);
    x.beginPath(); x.moveTo(12, 76); x.lineTo(40, 50); x.moveTo(88, 76); x.lineTo(60, 50); inset(x, 2);
    circle(x, 50, 56, 7); x.fillStyle = '#c02a2a'; x.fill(); outline(x, INK, 1.4);
  },
  stronghold(x) {
    poly(x, [[18, 90], [18, 40], [26, 40], [26, 32], [34, 32], [34, 40], [42, 40], [42, 24], [50, 12], [58, 24], [58, 40], [66, 40], [66, 32], [74, 32], [74, 40], [82, 40], [82, 90]]); gfill(x);
    x.beginPath(); x.moveTo(42, 90); x.lineTo(42, 72); x.quadraticCurveTo(50, 60, 58, 72); x.lineTo(58, 90); x.closePath(); x.fillStyle = 'rgba(40,26,8,.9)'; x.fill();
    x.beginPath(); x.moveTo(26, 56); x.lineTo(34, 56); x.moveTo(66, 56); x.lineTo(74, 56); x.moveTo(50, 30); x.lineTo(50, 38); inset(x, 4);
  },
  tome(x) {
    x.beginPath(); x.roundRect(18, 12, 60, 78, 4); gfill(x);
    x.beginPath(); x.moveTo(26, 12); x.lineTo(26, 90); inset(x, 3);
    x.beginPath(); x.roundRect(78, 16, 6, 70, 2); gfill(x, 1.6);
    circle(x, 52, 48, 14); inset(x, 2.4);
    poly(x, [[52, 34], [56, 48], [52, 62], [48, 48]]); x.fillStyle = 'rgba(40,26,8,.9)'; x.fill();
  },
  collectibles(x) {
    circle(x, 50, 62, 26); gfill(x);
    x.beginPath(); x.moveTo(50, 36); x.quadraticCurveTo(48, 24, 54, 18); inset(x, 3.4);
    x.beginPath(); x.moveTo(54, 20); x.bezierCurveTo(62, 8, 80, 10, 82, 14); x.bezierCurveTo(78, 24, 62, 28, 54, 20); x.closePath(); gfill(x, 1.8);
    for (const s of [-1, 1]) { x.fillStyle = 'rgba(40,26,8,.95)'; ellipse(x, 50 + s * 9, 62, 3.6, 4.8); x.fill(); }
  },
  party(x) {
    for (const [cx, cy, s] of [[26, 46, 0.72], [74, 46, 0.72], [50, 38, 1]]) {
      x.beginPath(); x.moveTo(cx - 22 * s, cy + 50 * s); x.bezierCurveTo(cx - 22 * s, cy + 26 * s, cx - 10 * s, cy + 20 * s, cx, cy + 20 * s); x.bezierCurveTo(cx + 10 * s, cy + 20 * s, cx + 22 * s, cy + 26 * s, cx + 22 * s, cy + 50 * s); x.closePath(); gfill(x, 2);
      circle(x, cx, cy, 13 * s); gfill(x, 2);
    }
  },
  settings(x) {
    x.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 30 : 40; const a2 = a + TAU / 32; i ? x.lineTo(50 + Math.cos(a) * r, 50 + Math.sin(a) * r) : x.moveTo(50 + Math.cos(a) * r, 50 + Math.sin(a) * r); x.lineTo(50 + Math.cos(a2) * r, 50 + Math.sin(a2) * r); }
    x.closePath(); gfill(x);
    circle(x, 50, 50, 12); x.fillStyle = 'rgba(40,26,8,.95)'; x.fill(); outline(x, INK, 1.6);
  },
  songs(x) {
    x.save(); x.translate(50, 56); x.scale(2.6, 2.6);
    x.beginPath(); x.ellipse(-8, 10, 5, 3.6, -0.45, 0, TAU); x.moveTo(12, 6); x.ellipse(8, 6, 5, 3.6, -0.45, 0, TAU); x.rect(-4.4, -12, 2.2, 21); x.rect(11.6, -16, 2.2, 21); x.moveTo(-4.4, -12); x.lineTo(13.8, -16); x.lineTo(13.8, -10.5); x.lineTo(-4.4, -6.5); x.closePath();
    x.restore(); gfill(x, 2);
  },
  emotes(x) {
    circle(x, 50, 50, 38); gfill(x);
    for (const s of [-1, 1]) { x.fillStyle = 'rgba(40,26,8,.95)'; ellipse(x, 50 + s * 13, 40, 4.4, 6); x.fill(); }
    x.beginPath(); x.moveTo(30, 58); x.quadraticCurveTo(50, 78, 70, 58); inset(x, 4.4);
  },
  pvp(x) {
    for (const s of [-1, 1]) {
      x.save(); x.translate(50, 50); x.rotate(s * PI / 4);
      x.beginPath(); x.moveTo(-4, 16); x.lineTo(-4, -34); x.lineTo(0, -42); x.lineTo(4, -34); x.lineTo(4, 16); x.closePath(); gfill(x, 1.8);
      x.beginPath(); x.roundRect(-13, 16, 26, 5, 2); gfill(x, 1.6);
      x.beginPath(); x.roundRect(-2.5, 21, 5, 13, 1); gfill(x, 1.4); circle(x, 0, 37, 3.6); gfill(x, 1.4);
      x.restore();
    }
  },
  leaderboard(x) {
    x.beginPath(); x.moveTo(26, 14); x.lineTo(74, 14); x.bezierCurveTo(74, 46, 62, 58, 50, 58); x.bezierCurveTo(38, 58, 26, 46, 26, 14); x.closePath(); gfill(x);
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50 + s * 24, 20); x.bezierCurveTo(50 + s * 40, 20, 50 + s * 40, 42, 50 + s * 18, 44); inset(x, 5); x.strokeStyle = CHAMP[1]; x.lineWidth = 3; x.stroke(); }
    x.beginPath(); x.moveTo(44, 58); x.lineTo(56, 58); x.lineTo(58, 72); x.lineTo(42, 72); x.closePath(); gfill(x, 1.8);
    x.beginPath(); x.roundRect(30, 72, 40, 16, 2); gfill(x, 2);
    star(x, 50, 32, 5, 5, 11); x.fillStyle = 'rgba(40,26,8,.9)'; x.fill();
  },
  compass(x) {
    circle(x, 50, 50, 40); gfill(x); circle(x, 50, 50, 32); inset(x, 2);
    poly(x, [[50, 12], [58, 50], [50, 88], [42, 50]]); x.fillStyle = lg(x, 40, 12, 60, 88, [[0, '#e04a3a'], [0.5, '#e04a3a'], [0.5, '#fffaf0'], [1, '#c8a86a']]); x.fill(); outline(x, INK, 1.6);
    poly(x, [[12, 50], [50, 44], [88, 50], [50, 56]]); x.fillStyle = 'rgba(40,26,8,.85)'; x.fill();
    circle(x, 50, 50, 4); x.fillStyle = '#fffaf0'; x.fill(); outline(x, INK, 1);
  },
  quests(x) {
    x.beginPath(); x.moveTo(20, 14); x.lineTo(76, 14); x.lineTo(76, 84); x.quadraticCurveTo(76, 92, 68, 92); x.lineTo(24, 92); x.quadraticCurveTo(16, 92, 16, 84); x.lineTo(16, 18); x.closePath(); gfill(x);
    x.beginPath(); x.moveTo(44, 28); x.lineTo(52, 28); x.lineTo(51, 60); x.lineTo(45, 60); x.closePath(); x.fillStyle = 'rgba(40,26,8,.95)'; x.fill(); circle(x, 48, 72, 5); x.fill();
  },
  friends(x) {
    for (const [cx, s] of [[36, 1], [66, 0.82]]) {
      x.beginPath(); x.moveTo(cx - 24 * s, 92); x.bezierCurveTo(cx - 24 * s, 66, cx - 12 * s, 58, cx, 58); x.bezierCurveTo(cx + 12 * s, 58, cx + 24 * s, 66, cx + 24 * s, 92); x.closePath(); gfill(x, 2);
      circle(x, cx, 40, 14 * s); gfill(x, 2);
    }
    x.save(); x.translate(76, 20); x.scale(0.55, 0.55); x.beginPath(); x.moveTo(0, 14); x.bezierCurveTo(-18, 2, -20, -12, -10, -15); x.bezierCurveTo(-4, -17, 0, -12, 0, -8); x.bezierCurveTo(0, -12, 4, -17, 10, -15); x.bezierCurveTo(20, -12, 18, 2, 0, 14); x.closePath(); x.fillStyle = '#e04a5a'; x.fill(); outline(x, INK, 2.4); x.restore();
  },
  honing(x) {
    // anvil + hammer
    x.beginPath(); x.moveTo(10, 50); x.lineTo(74, 50); x.quadraticCurveTo(90, 50, 92, 42); x.quadraticCurveTo(84, 62, 66, 62); x.lineTo(62, 74); x.lineTo(72, 90); x.lineTo(28, 90); x.lineTo(38, 74); x.lineTo(34, 62); x.quadraticCurveTo(14, 62, 10, 50); x.closePath(); gfill(x);
    x.save(); x.translate(56, 30); x.rotate(-0.6); x.beginPath(); x.roundRect(-3, -2, 6, 34, 2); gfill(x, 1.8); x.beginPath(); x.roundRect(-14, -12, 28, 12, 3); gfill(x, 2); x.restore();
    for (const [px, py] of [[34, 38], [28, 30], [40, 28]]) { star(x, px, py, 4, 1, 4); x.fillStyle = '#ffd070'; x.fill(); }
  },
  mounts(x) {
    x.beginPath(); x.moveTo(30, 92); x.bezierCurveTo(28, 70, 34, 52, 40, 40); x.bezierCurveTo(34, 34, 30, 24, 34, 12); x.bezierCurveTo(40, 18, 44, 22, 48, 26);
    x.bezierCurveTo(60, 22, 70, 30, 78, 44); x.bezierCurveTo(86, 56, 90, 64, 84, 70); x.bezierCurveTo(78, 74, 70, 68, 64, 60); x.bezierCurveTo(60, 70, 64, 82, 66, 92); x.closePath(); gfill(x);
    circle(x, 60, 40, 3.6); x.fillStyle = 'rgba(40,26,8,.95)'; x.fill();
    x.beginPath(); x.moveTo(44, 30); x.bezierCurveTo(36, 44, 34, 60, 36, 80); inset(x, 2.2);
  },
  pets(x) {
    x.beginPath(); x.ellipse(50, 64, 20, 17, 0, 0, TAU); gfill(x);
    for (const [px, py, r] of [[24, 42, 9], [40, 26, 9.5], [60, 26, 9.5], [76, 42, 9]]) { x.beginPath(); x.ellipse(px, py, r * 0.85, r, 0, 0, TAU); gfill(x, 2); }
  },
  wardrobe(x) {
    x.beginPath(); x.moveTo(50, 30); x.lineTo(90, 70); x.quadraticCurveTo(92, 76, 86, 76); x.lineTo(14, 76); x.quadraticCurveTo(8, 76, 10, 70); x.closePath(); gfill(x);
    x.beginPath(); x.moveTo(50, 32); x.lineTo(50, 22); x.bezierCurveTo(50, 12, 64, 12, 62, 22); inset(x, 5); x.strokeStyle = CHAMP[1]; x.lineWidth = 3; x.stroke();
    x.beginPath(); x.moveTo(22, 70); x.lineTo(78, 70); inset(x, 2);
  },
  chat(x) {
    x.beginPath(); x.moveTo(20, 18); x.lineTo(80, 18); x.quadraticCurveTo(92, 18, 92, 30); x.lineTo(92, 58); x.quadraticCurveTo(92, 70, 80, 70); x.lineTo(46, 70); x.lineTo(26, 88); x.lineTo(30, 70); x.lineTo(20, 70); x.quadraticCurveTo(8, 70, 8, 58); x.lineTo(8, 30); x.quadraticCurveTo(8, 18, 20, 18); x.closePath(); gfill(x);
    for (const px of [30, 50, 70]) { circle(x, px, 44, 5); x.fillStyle = 'rgba(40,26,8,.95)'; x.fill(); }
  },
  photo(x) {
    x.beginPath(); x.moveTo(12, 34); x.lineTo(30, 34); x.lineTo(36, 22); x.lineTo(64, 22); x.lineTo(70, 34); x.lineTo(88, 34); x.quadraticCurveTo(92, 34, 92, 40); x.lineTo(92, 80); x.quadraticCurveTo(92, 86, 86, 86); x.lineTo(14, 86); x.quadraticCurveTo(8, 86, 8, 80); x.lineTo(8, 40); x.quadraticCurveTo(8, 34, 12, 34); x.closePath(); gfill(x);
    circle(x, 50, 60, 18); x.fillStyle = 'rgba(40,26,8,.95)'; x.fill(); circle(x, 50, 60, 11); x.fillStyle = rg(x, 46, 56, 1, 12, [[0, '#ffffff'], [1, '#8ab8e0']]); x.fill(); outline(x, INK, 1.2);
  },
  help(x) {
    circle(x, 50, 50, 40); gfill(x);
    x.beginPath(); x.moveTo(36, 38); x.bezierCurveTo(36, 22, 64, 22, 64, 38); x.bezierCurveTo(64, 48, 52, 50, 50, 58); x.lineTo(50, 62); inset(x, 7);
    circle(x, 50, 74, 5); x.fillStyle = 'rgba(40,26,8,.95)'; x.fill();
  },
  logout(x) {
    x.beginPath(); x.moveTo(20, 10); x.lineTo(60, 10); x.lineTo(60, 90); x.lineTo(20, 90); x.closePath(); gfill(x);
    x.beginPath(); x.moveTo(20, 10); x.lineTo(46, 20); x.lineTo(46, 96); x.lineTo(20, 90); x.closePath(); x.fillStyle = lg(x, 20, 10, 46, 90, [[0, CHAMP[2]], [1, CHAMP[4]]]); x.fill(); outline(x, INK, 2);
    circle(x, 40, 54, 3); x.fillStyle = '#fffaf0'; x.fill();
    poly(x, [[58, 44], [76, 44], [76, 32], [96, 50], [76, 68], [76, 56], [58, 56]]); gfill(x, 2);
  },
};

export const MISC_PAINT = {};
for (const k in CUR) MISC_PAINT[`currency:${k}`] = CUR[k];
for (const k in STATUS) MISC_PAINT[`status:${k}`] = STATUS[k];
for (const k in UI) MISC_PAINT[`ui:${k}`] = UI[k];
