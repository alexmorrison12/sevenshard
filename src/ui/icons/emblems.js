// Engraving emblems (round), tripod emblems (round), class crests (transparent heraldry).
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, slashAB, streak, ring, rays, burst, embers, backdrop, rgba,
  shade, mix, outline, fire, fireLayers, bolt, crystal, runeCircle, add, norm, glowPath, metalLG, metalRG, gem, note, ribbon,
  bez, qbez, cracks, speedLines, blur, noBlur, rocks,
} from './core.js';
import {
  greatsword, longsword, curvedBlade, glaive, pistol, rifle, harp, fist, palm, boot, claws, chain, featherWing, batWing, muzzle,
  demonHead, eye, skull, moon, arrowUp, figure, bootUp, clawMarks,
} from './motifs.js';
import { heaterPath, heater } from './generic.js';
import { CLASS_COLORS } from './ids.js';

const INK = 'rgba(8,4,10,.92)';
const at = (x, px, py, rot, s, fn, o) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); fn(x, o); x.restore(); };
/** Dark medallion field with a coloured inner glow. */
function field(x, R, col, o = {}) {
  x.fillStyle = rg(x, 44, 38, 2, 62, [[0, shade(col, o.k ?? -0.35)], [0.5, shade(col, -0.78)], [1, '#040406']]); x.fillRect(0, 0, 100, 100);
  glow(x, 50, 50, 40, col, o.glowA ?? 0.45);
  if (o.rays) rays(x, R, 50, 50, o.rays, 12, 50, mix(col, '#ffffff', 0.4), { alpha: 0.28 });
}
/** Fill the current path as a bright symbol: white-hot top-left → colour → dark, with an ink outline. */
function sym(x, col, lw = 1.3, box = [25, 20, 75, 80]) {
  x.fillStyle = lg(x, box[0], box[1], box[2], box[3], [[0, '#ffffff'], [0.35, mix(col, '#ffffff', 0.45)], [0.75, col], [1, shade(col, -0.45)]]); x.fill();
  outline(x, INK, lw);
}
function drop(x, cx, cy, r, col) {
  x.beginPath(); x.moveTo(cx, cy - r * 1.7); x.bezierCurveTo(cx + r * 0.4, cy - r * 0.8, cx + r, cy - r * 0.2, cx + r, cy + r * 0.3); x.arc(cx, cy + r * 0.3, r, 0, PI); x.bezierCurveTo(cx - r, cy - r * 0.2, cx - r * 0.4, cy - r * 0.8, cx, cy - r * 1.7); x.closePath();
  sym(x, col, 1, [cx - r, cy - r * 1.7, cx + r, cy + r * 1.3]);
}
function heart(x, cx, cy, s, col) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  x.beginPath(); x.moveTo(0, 14); x.bezierCurveTo(-18, 2, -20, -12, -10, -15); x.bezierCurveTo(-4, -17, 0, -12, 0, -8); x.bezierCurveTo(0, -12, 4, -17, 10, -15); x.bezierCurveTo(20, -12, 18, 2, 0, 14); x.closePath();
  sym(x, col, 1.2 / s, [-20, -17, 20, 14]);
  x.restore();
}
function hourglass(x, cx, cy, s, col) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  x.fillStyle = metalLG(x, -14, -22, 14, -18, 'gold'); x.fillRect(-14, -24, 28, 4); x.fillRect(-14, 20, 28, 4); x.strokeStyle = INK; x.lineWidth = 0.8; x.strokeRect(-14, -24, 28, 4); x.strokeRect(-14, 20, 28, 4);
  x.beginPath(); x.moveTo(-11, -20); x.lineTo(11, -20); x.bezierCurveTo(11, -8, 2, -4, 2, 0); x.bezierCurveTo(2, 4, 11, 8, 11, 20); x.lineTo(-11, 20); x.bezierCurveTo(-11, 8, -2, 4, -2, 0); x.bezierCurveTo(-2, -4, -11, -8, -11, -20); x.closePath();
  x.fillStyle = 'rgba(200,230,255,.25)'; x.fill(); outline(x, INK, 1);
  x.beginPath(); x.moveTo(-7, -12); x.lineTo(7, -12); x.lineTo(0, -2); x.closePath(); x.fillStyle = col; x.fill();
  x.beginPath(); x.moveTo(-10, 19); x.quadraticCurveTo(0, 8, 10, 19); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1; x.beginPath(); x.moveTo(-8, -17); x.quadraticCurveTo(-8, -8, -3, -3); x.stroke();
  x.restore();
}
function downArrow(x, cx, cy, s, col = '#ff4a3a') { arrowUp(x, cx, cy, s, col, { down: true }); }
function snowflake(x, cx, cy, r, col) {
  x.save(); x.translate(cx, cy);
  for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * PI / 3); x.beginPath(); x.moveTo(-2, 0); x.lineTo(-2, -r); x.lineTo(0, -r - 3); x.lineTo(2, -r); x.lineTo(2, 0); x.closePath(); x.moveTo(-1, -r * 0.55); x.lineTo(-7, -r * 0.8); x.lineTo(-6, -r * 0.9); x.lineTo(0, -r * 0.7); x.lineTo(6, -r * 0.9); x.lineTo(7, -r * 0.8); x.lineTo(1, -r * 0.55); x.closePath(); sym(x, col, 0.8, [-10, -r, 10, 0]); x.restore(); }
  x.restore();
}
function bolt2(x, cx, cy, s, col) { // chunky lightning glyph
  x.save(); x.translate(cx, cy); x.scale(s, s);
  poly(x, [[4, -24], [-10, 2], [-1, 2], [-6, 24], [10, -4], [1, -4]]); sym(x, col, 1.2 / s, [-10, -24, 10, 24]);
  x.restore();
}
function flame(x, R, cx, cy, h, col = '#ff7a1e') { fire(x, R, cx, cy, h, h * 0.62, 0, { n: 5, layers: col === '#ff7a1e' ? undefined : fireLayers(shade(col, -0.7), shade(col, -0.2), mix(col, '#ffffff', 0.4)) }); }

// ------------------------------------------------------------------ engravings
const E = {
  vendetta(x, R) { field(x, R, '#e0303a', { rays: 10 }); at(x, 50, 56, 0, 0.95, demonHead, { skin: '#5a1016', eye: '#ffda40', horn: '#f0e0d0' }); },
  hexed_idol(x, R) {
    field(x, R, '#8a5aff');
    // stitched voodoo doll with pins
    x.save(); x.translate(50, 54);
    x.beginPath(); x.arc(0, -18, 12, 0, TAU); x.moveTo(-8, -8); x.lineTo(-22, -4); x.quadraticCurveTo(-24, 2, -18, 3); x.lineTo(-9, 1); x.lineTo(-12, 22); x.quadraticCurveTo(-8, 27, -3, 22); x.lineTo(0, 10); x.lineTo(3, 22); x.quadraticCurveTo(8, 27, 12, 22); x.lineTo(9, 1); x.lineTo(18, 3); x.quadraticCurveTo(24, 2, 22, -4); x.lineTo(8, -8); x.closePath();
    x.fillStyle = rg(x, -6, -14, 2, 34, [[0, '#e8d8b0'], [0.6, '#a08a60'], [1, '#4a3a20']]); x.fill(); outline(x, INK, 1.2);
    x.strokeStyle = 'rgba(60,30,10,.8)'; x.lineWidth = 0.8; x.setLineDash([1.5, 1.5]); x.beginPath(); x.moveTo(0, -30); x.lineTo(0, 10); x.stroke(); x.setLineDash([]);
    for (const [ex, ey] of [[-4, -19], [4, -19]]) { x.strokeStyle = '#1a0a20'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(ex - 2, ey - 2); x.lineTo(ex + 2, ey + 2); x.moveTo(ex + 2, ey - 2); x.lineTo(ex - 2, ey + 2); x.stroke(); }
    for (const [px, py, a] of [[-6, -2, -0.6], [8, -24, 0.7], [4, 8, 0.3]]) { x.save(); x.translate(px, py); x.rotate(a); x.strokeStyle = metalLG(x, 0, -14, 1, 0, 'silver'); x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -14); x.stroke(); x.fillStyle = '#c040ff'; circle(x, 0, -14, 2.2); x.fill(); glow(x, 0, -14, 5, '#c060ff', 0.8); x.restore(); }
    x.restore();
  },
  keen_edge(x, R) {
    field(x, R, '#7ad8ff');
    at(x, 34, 72, 0.78, 0.82, greatsword, { metal: 'silver', guard: 'dark' });
    streak(x, 22, 80, 80, 20, 2, '#e0f8ff', { bias: 1 });
    sparkle(x, 66, 32, 16, '#ffffff', 0.2);
  },
  adrenaline(x, R) {
    field(x, R, '#ff5a3a');
    heart(x, 50, 50, 1.45, '#ff4a3a');
    glowPath(x, xx => poly(xx, [[14, 52], [30, 52], [36, 40], [44, 64], [52, 30], [58, 58], [64, 52], [86, 52]], false), '#ffffff', 1.8, { coreA: 1 });
  },
  backstabber(x, R) {
    field(x, R, '#a070ff');
    // cloaked back silhouette with a dagger striking from behind
    x.beginPath(); x.moveTo(24, 90); x.bezierCurveTo(22, 64, 30, 50, 40, 46); x.bezierCurveTo(34, 38, 36, 24, 48, 22); x.bezierCurveTo(60, 22, 62, 38, 56, 46); x.bezierCurveTo(68, 50, 76, 64, 74, 90); x.closePath();
    x.fillStyle = lg(x, 30, 20, 70, 90, [[0, '#3a2a5a'], [1, '#0a0614']]); x.fill(); outline(x, INK, 1.2);
    at(x, 70, 30, -2.4, 0.9, curvedBlade, { metal: 'silver', edgeGlow: '#e0b0ff' });
    burst(x, R, 52, 56, 8, 3, 12, '#c090ff');
  },
  frontliner(x, R) {
    field(x, R, '#ffc040');
    heater(x, 50, 52, 0.72, '#3a4a70', 'gold');
    for (const dy of [-8, 8]) { x.save(); x.translate(50, 52 + dy); x.rotate(PI / 2); arrowUp(x, 0, 0, 1.1, '#ffd060'); x.restore(); }
  },
  wind_captain(x, R) {
    field(x, R, '#40e0c0');
    x.save(); x.translate(40, 58); featherWing(x, 1, 0.8, ['#ffffff', '#b0fff0', '#2a8a7a'], 7); x.restore();
    for (let i = 0; i < 3; i++) glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.04) { const a = t * TAU * 0.9 + i * 2, r = 8 + t * 22; const px = 44 + Math.cos(a) * r, py = 56 + Math.sin(a) * r * 0.6; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, '#a0fff0', 1.2);
  },
  spirit_absorption(x, R) {
    field(x, R, '#60c8ff');
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; glowPath(x, xx => { xx.beginPath(); xx.moveTo(50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36); xx.quadraticCurveTo(50 + Math.cos(a + 1) * 22, 50 + Math.sin(a + 1) * 22, 50, 50); }, '#80e0ff', 1.3); glow(x, 50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36, 6, '#c0f4ff', 0.9); }
    x.fillStyle = rg(x, 46, 46, 1, 14, [[0, '#ffffff'], [0.5, '#a0e8ff'], [1, '#2a7ac0']]); circle(x, 50, 50, 12); x.fill(); outline(x, INK, 1);
  },
  precise_blade(x, R) {
    field(x, R, '#c0e040');
    x.strokeStyle = rgba('#e8ff90', 0.9); x.lineWidth = 1.6; circle(x, 50, 50, 26); x.stroke();
    x.beginPath(); x.moveTo(50, 16); x.lineTo(50, 30); x.moveTo(50, 70); x.lineTo(50, 84); x.moveTo(16, 50); x.lineTo(30, 50); x.moveTo(70, 50); x.lineTo(84, 50); x.stroke();
    at(x, 50, 70, 0, 0.9, curvedBlade, { metal: 'silver', curve: 1, w: 6 });
  },
  super_charge(x, R) {
    field(x, R, '#ffe040');
    for (const r of [30, 22]) ring(x, 50, 50, r, r, '#ffe040', 1.4, 0.8);
    bolt2(x, 50, 50, 1.1, '#ffe040');
  },
  barricade(x, R) {
    field(x, R, '#4a8aff');
    x.save(); add(x); x.fillStyle = rg(x, 44, 40, 4, 34, [[0, rgba('#ffffff', 0.35)], [1, rgba('#4a8aff', 0.4)]]); circle(x, 50, 50, 30); x.fill(); x.lineWidth = 1.6; x.strokeStyle = rgba('#a0c8ff', 0.9); circle(x, 50, 50, 30); x.stroke(); norm(x); x.restore();
    // brick rampart
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - (r % 2); c++) { const bx = 28 + c * 12 + (r % 2) * 6, by = 54 - r * 9; x.beginPath(); x.roundRect(bx, by, 11, 8, 1); x.fillStyle = lg(x, bx, by, bx + 11, by + 8, [[0, '#dfe8f8'], [1, '#6a7a98']]); x.fill(); outline(x, INK, 0.8); }
  },
  expert(x, R) {
    field(x, R, '#60e080');
    x.save(); x.translate(50, 58); x.scale(1.05, 1.05); palm(x); x.fillStyle = rg(x, -6, -10, 1, 34, [[0, '#ffffff'], [0.5, '#a0f0b0'], [1, '#2a8a4a']]); x.fill(); outline(x, INK, 1.1); x.restore();
    poly(x, [[46, 36], [54, 36], [54, 44], [62, 44], [62, 52], [54, 52], [54, 60], [46, 60], [46, 52], [38, 52], [38, 44], [46, 44]]); x.fillStyle = '#ffffff'; x.fill(); outline(x, 'rgba(10,60,20,.9)', 1);
    glow(x, 50, 48, 14, '#b0ffc0', 0.6);
  },
  awakening(x, R) {
    field(x, R, '#ffd870', { rays: 16, k: -0.2 });
    star(x, 50, 50, 8, 10, 34); sym(x, '#ffd060', 1.2);
    star(x, 50, 50, 4, 6, 18, -PI / 4); x.fillStyle = '#ffffff'; x.fill();
    sparkle(x, 50, 50, 12);
  },
  master_brawler(x, R) {
    field(x, R, '#ff9030');
    burst(x, R, 72, 50, 10, 6, 20, '#ffb050');
    at(x, 42, 52, 0, 1.15, fist, { metal: 'steel', trim: 'gold', cuff: '#4a2a14' });
  },
  ether_predator(x, R) {
    field(x, R, '#40d0a0');
    glow(x, 50, 50, 22, '#80ffd0', 1); x.fillStyle = rg(x, 46, 46, 1, 15, [[0, '#ffffff'], [0.45, '#90ffd8'], [1, '#128a60']]); circle(x, 50, 50, 14); x.fill(); outline(x, INK, 1);
    clawMarks(x, 50, 50, 0.95, '#c0fff0', 0.45, 3);
  },
  crisis_evasion(x, R) {
    field(x, R, '#f0e0a0');
    x.save(); x.translate(50, 48); featherWing(x, -1, 0.55, ['#ffffff', '#f4e8c0', '#9a8a5a'], 6); featherWing(x, 1, 0.55, ['#ffffff', '#f4e8c0', '#9a8a5a'], 6); x.restore();
    hourglass(x, 50, 52, 1.05, '#ffd070');
  },
  stabilized_status(x, R) {
    field(x, R, '#80e0a0');
    heater(x, 50, 52, 0.66, '#2a5a3a', 'silver', { trimMetal: 'silver' });
    heart(x, 50, 50, 0.95, '#ff6a6a');
  },
  all_out_attack(x, R) {
    field(x, R, '#ff4040', { rays: 12 });
    burst(x, R, 50, 44, 10, 6, 22, '#ff6a3a');
    at(x, 30, 78, 0.75, 0.62, greatsword, { metal: 'steel' }); at(x, 70, 78, -0.75, 0.62, greatsword, { metal: 'steel' });
  },
  mana_flow(x, R) {
    field(x, R, '#4a9aff');
    for (let k = 0; k < 2; k++) glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.03) { const a = t * TAU * 1.1 + k * PI, r = 30 - t * 14; const px = 50 + Math.cos(a) * r, py = 52 + Math.sin(a) * r; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, '#80c0ff', 1.6);
    drop(x, 50, 54, 11, '#4a9aff');
  },
  heavy_armor(x, R) {
    field(x, R, '#9ab0c8');
    x.save(); x.translate(50, 52);
    x.beginPath(); x.moveTo(-24, 8); x.bezierCurveTo(-26, -28, 26, -28, 24, 8); x.lineTo(20, 26); x.lineTo(6, 30); x.lineTo(5, 8); x.lineTo(-5, 8); x.lineTo(-6, 30); x.lineTo(-20, 26); x.closePath();
    x.fillStyle = rg(x, -8, -14, 1, 38, [[0, '#ffffff'], [0.3, '#b8c4d0'], [0.7, '#4a5462'], [1, '#12161c']]); x.fill(); outline(x, INK, 1.3);
    x.fillStyle = metalLG(x, -3, 0, 3, 0, 'gold'); poly(x, [[-3, -24], [0, -27], [3, -24], [2.4, 6], [-2.4, 6]]); x.fill(); outline(x, INK, 0.7);
    x.fillStyle = '#05060a'; poly(x, [[-19, 10], [-6, 10], [-6, 16], [-17, 15]]); x.fill(); poly(x, [[19, 10], [6, 10], [6, 16], [17, 15]]); x.fill();
    x.restore();
  },
  sight_focus(x, R) { field(x, R, '#ffb040'); at(x, 50, 50, 0, 1, (xx) => eye(xx, 64, '#ffb040', { open: 0.4, lw: 1.4 })); x.strokeStyle = rgba('#fff0c0', 0.9); x.lineWidth = 1.2; circle(x, 50, 50, 9); x.stroke(); },
  drops_of_ether(x, R) { field(x, R, '#60f0e0'); drop(x, 50, 36, 9, '#60f0e0'); drop(x, 32, 64, 8, '#60f0e0'); drop(x, 68, 64, 8, '#60f0e0'); },
  propulsion(x, R) {
    field(x, R, '#ffa040');
    speedLines(x, R, 10, [6, 30, 44, 80], 0, '#ffd8a0', { len: 22, w: 1.8 });
    fire(x, R, 30, 72, 26, 16, -PI / 2, { n: 4 });
    at(x, 34, 50, 0, 1, (xx) => featherWing(xx, -1, 0.5, ['#ffffff', '#ffe0b0', '#a07030'], 6));
    at(x, 50, 74, 0, 0.95, bootUp, { metal: 'steel' });
  },
  increase_mass(x, R) {
    field(x, R, '#c09060');
    // iron weight pressing down
    x.beginPath(); x.moveTo(30, 70); x.lineTo(36, 38); x.lineTo(64, 38); x.lineTo(70, 70); x.closePath(); x.fillStyle = metalLG(x, 30, 38, 70, 70, 'iron'); x.fill(); outline(x, INK, 1.3);
    x.lineWidth = 3.4; x.strokeStyle = metalLG(x, 40, 22, 60, 38, 'iron'); x.beginPath(); x.arc(50, 36, 9, PI, TAU); x.stroke(); outline(x, INK, 0.6);
    x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(38, 50, 24, 5);
    for (const px of [30, 50, 70]) { x.save(); x.translate(px, 82); arrowUp(x, 0, 0, 0.55, '#ffd080', { down: true }); x.restore(); }
  },
  // class engravings
  bloodfrenzy(x, R) { field(x, R, '#e8313f', { rays: 10 }); drop(x, 50, 54, 18, '#d01020'); for (const s of [-1, 1]) { poly(x, [[50 + s * 6, 34], [50 + s * 11, 34], [50 + s * 8.5, 46]]); x.fillStyle = '#ffffff'; x.fill(); outline(x, INK, 0.7); } },
  tempered_fury(x, R) { field(x, R, '#ff7030'); flame(x, R, 50, 90, 70); at(x, 50, 80, 0, 0.9, greatsword, { metal: 'iron', rune: '#ffd060', glow: '#ff6020', glowR: 6 }); },
  blessed_aura(x, R) {
    field(x, R, '#f2c14e', { rays: 16, k: -0.2 });
    x.lineWidth = 3; x.strokeStyle = metalLG(x, 32, 20, 68, 30, 'gold'); ellipse(x, 50, 26, 16, 5); x.stroke(); glow(x, 50, 26, 18, '#fff0a0', 0.7);
    ring(x, 50, 56, 30, 30, '#fff0b0', 1.2, 0.8);
    heater(x, 50, 58, 0.55, '#f4f0e8', 'gold');
    star(x, 50, 55, 8, 3.5, 9); x.fillStyle = '#ffd060'; x.fill();
  },
  judgment(x, R) {
    field(x, R, '#ffd060', { rays: 12 });
    at(x, 50, 26, PI, 1.02, longsword, { metal: 'gold', guard: 'gold', glow: '#fff0a0', glowR: 7, gem: '#ff4040' });
    ring(x, 50, 84, 22, 5, '#fff0b0', 1.2);
  },
  storm_conduit(x, R) { field(x, R, '#46b4ff', { rays: 8 }); at(x, 44, 52, -0.4, 1.05, fist, { metal: 'silver', cuff: '#1a3050', glow: '#8ad8ff' }); for (let i = 0; i < 4; i++) { const a = -PI / 2 + (i - 1.5) * 0.5; bolt(x, R, 60, 36, 60 + Math.cos(a) * 34, 36 + Math.sin(a) * 34, { col: '#8ad8ff', w: 1.4, gens: 4 }); } },
  chi_master(x, R) {
    field(x, R, '#40c8ff');
    for (const [px, py, c] of [[50, 30, '#ffb030'], [32, 62, '#46b6ff'], [68, 62, '#46b6ff']]) { glow(x, px, py, 16, c, 0.9); x.fillStyle = rg(x, px - 3, py - 3, 0, 10, [[0, '#ffffff'], [0.5, mix(c, '#ffffff', 0.4)], [1, c]]); circle(x, px, py, 9); x.fill(); outline(x, INK, 1); }
    glowPath(x, xx => { xx.beginPath(); xx.arc(50, 51, 22, 0, TAU); }, '#a0e0ff', 1.2);
  },
  quickdraw(x, R) { field(x, R, '#ff8a1e'); speedLines(x, R, 8, [10, 30, 50, 70], PI, '#ffd8a0', { len: 18, w: 1.4 }); x.globalAlpha = 0.35; at(x, 36, 62, -0.5, 1.05, pistol, {}); x.globalAlpha = 1; at(x, 36, 60, -0.15, 1.1, pistol, {}); glow(x, 76, 52, 12, '#ff9a30', 0.9); },
  longshot(x, R) {
    field(x, R, '#4ac0d0');
    at(x, 40, 64, -0.3, 0.72, rifle, { lens: '#80e0ff' });
    x.strokeStyle = rgba('#b0f4ff', 0.95); x.lineWidth = 1.4; circle(x, 70, 34, 13); x.stroke(); x.beginPath(); x.moveTo(70, 18); x.lineTo(70, 50); x.moveTo(54, 34); x.lineTo(86, 34); x.stroke(); glow(x, 70, 34, 6, '#ff4a3a', 1);
  },
  ignition(x, R) { field(x, R, '#ff6a20'); flame(x, R, 50, 86, 62); star(x, 50, 50, 5, 7, 16); sym(x, '#ffe070', 1); sparkle(x, 50, 50, 10); },
  wellspring(x, R) {
    field(x, R, '#9d6bff');
    for (let i = 0; i < 7; i++) { const a = -PI / 2 + (i - 3) * 0.28; streak(x, 50, 70, 50 + Math.cos(a) * 36, 70 + Math.sin(a) * 50, 2.2, i % 2 ? '#c0a0ff' : '#80d0ff', { bias: 0.8 }); }
    ring(x, 50, 72, 24, 7, '#c0a0ff', 1.6);
    for (let i = 0; i < 5; i++) sparkle(x, 26 + R() * 48, 18 + R() * 36, 3 + R() * 3);
  },
  last_refrain(x, R) { field(x, R, '#f07a8a', { glowA: 0.7, k: -0.5 }); for (let i = 0; i < 3; i++) glowPath(x, xx => { xx.beginPath(); xx.arc(40, 62, 28 + i * 8, -1.25, -0.15); }, '#ffc0c8', 1.6 - i * 0.35); for (let i = 3; i >= 1; i--) { x.globalAlpha = 0.55 - i * 0.12; note(x, 36 + i * 11, 60 - i * 6, 1.05, '#ffe0e4', 0, { glow: false }); } x.globalAlpha = 1; note(x, 38, 66, 1.7, '#ffd0d8', 0); },
  heart_of_courage(x, R) { field(x, R, '#ff5a4a', { rays: 10 }); flame(x, R, 50, 74, 50); heart(x, 50, 56, 1.25, '#ff4a4a'); note(x, 47, 60, 0.6, '#ffffff', 0, { outline: false }); },
  afterglow(x, R) { field(x, R, '#b58cff'); moon(x, 50, 50, 28, '#d8c0ff', { bite: 0.42, biteY: 0.3, biteR: 0.86 }); sparkle(x, 66, 36, 8); sparkle(x, 72, 60, 5); },
  stormsurge(x, R) {
    field(x, R, '#d060ff');
    for (const [px, py] of [[50, 30], [30, 64], [70, 64]]) { glow(x, px, py, 14, '#e080ff', 0.9); x.fillStyle = rg(x, px - 2, py - 2, 0, 8, [[0, '#ffffff'], [1, '#b050ff']]); circle(x, px, py, 7.5); x.fill(); outline(x, INK, 0.8); }
    for (const [a, b] of [[[50, 30], [30, 64]], [[30, 64], [70, 64]], [[70, 64], [50, 30]]]) bolt(x, R, a[0], a[1], b[0], b[1], { col: '#e080ff', w: 1.2, gens: 4, jit: 0.2 });
    bolt(x, R, 50, 52, 50, 88, { col: '#ffffff', w: 1.2, gens: 3 });
  },
  unleashed(x, R) {
    field(x, R, '#b232ff', { rays: 10 });
    at(x, 50, 58, 0, 0.9, demonHead, { skin: '#2a0a36', eye: '#ff3a2a' });
    for (const s of [-1, 1]) { chain(x, t => [50 + s * (14 + t * 26), 80 - t * 8], 6, 2.6, 'iron'); poly(x, [[50 + s * 12, 78], [50 + s * 16, 72], [50 + s * 18, 80]]); x.fillStyle = '#ffd080'; x.fill(); }
  },
  restraint(x, R) {
    field(x, R, '#a0283a');
    at(x, 50, 50, 0, 1, (xx) => eye(xx, 74, '#ff3a2a', { open: 0.46, slit: true, white: '#2a0608', lw: 1.6 }));
    glow(x, 50, 50, 14, '#ff4a2a', 0.7);
    chain(x, t => [6 + t * 88, 26 + t * 48], 13, 3.2, 'iron'); chain(x, t => [6 + t * 88, 74 - t * 48], 13, 3.2, 'iron');
    // padlock
    x.lineWidth = 2.4; x.strokeStyle = metalLG(x, 44, 40, 56, 50, 'gold'); x.beginPath(); x.arc(50, 50, 5, PI, TAU); x.stroke();
    x.beginPath(); x.roundRect(43, 50, 14, 11, 2); x.fillStyle = metalLG(x, 43, 50, 57, 61, 'gold'); x.fill(); outline(x, INK, 0.8);
  },
  // negatives
  neg_atk(x, R) {
    field(x, R, '#c02020');
    at(x, 30, 78, 0.55, 0.78, greatsword, { metal: 'iron', len: 34 });
    x.save(); x.translate(56, 34); x.rotate(0.9); poly(x, [[-6, 0], [6, 0], [4, -18], [0, -24], [-4, -18]]); x.fillStyle = metalLG(x, -6, 0, 6, -24, 'iron'); x.fill(); outline(x, INK, 1); x.restore();
    glowPath(x, xx => poly(xx, [[38, 48], [44, 44], [42, 40], [48, 36]], false), '#ff8a6a', 0.9);
    downArrow(x, 72, 64, 1.3);
  },
  neg_speed(x, R) { field(x, R, '#c02020'); hourglass(x, 42, 50, 1.05, '#ff9a6a'); downArrow(x, 70, 62, 1.3); },
  neg_def(x, R) { field(x, R, '#c02020'); heater(x, 44, 50, 0.62, '#3a3a4a', 'iron', { trimMetal: 'iron' }); glowPath(x, xx => poly(xx, [[44, 28], [40, 44], [48, 52], [42, 70]], false), '#ff6a4a', 1.2); downArrow(x, 70, 62, 1.3); },
  neg_move(x, R) { field(x, R, '#c02020'); at(x, 38, 72, 0, 0.9, bootUp, { metal: 'iron', col: '#4a3a30' }); downArrow(x, 74, 62, 1.3); },
};

// ------------------------------------------------------------------ tripods (small round emblems)
function tri(x, R, col) {
  x.fillStyle = rg(x, 44, 38, 2, 60, [[0, shade(col, -0.25)], [0.55, shade(col, -0.72)], [1, '#050507']]); x.fillRect(0, 0, 100, 100);
  glow(x, 50, 50, 36, col, 0.55);
}
const T = {
  quick_prep(x, R) {
    tri(x, R, '#4ab0ff');
    x.lineWidth = 5; x.strokeStyle = metalLG(x, 20, 20, 80, 80, 'silver'); circle(x, 50, 52, 24); x.stroke(); outline(x, INK, 0.8);
    x.save(); add(x); x.fillStyle = rgba('#8ad0ff', 0.55); x.beginPath(); x.moveTo(50, 52); x.arc(50, 52, 21, -PI / 2, PI * 0.9); x.closePath(); x.fill(); norm(x); x.restore();
    x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.beginPath(); x.moveTo(50, 52); x.lineTo(50, 36); x.moveTo(50, 52); x.lineTo(62, 58); x.stroke();
    x.save(); x.translate(26, 30); x.rotate(-0.6); poly(x, [[0, -7], [8, 0], [0, 7]]); sym(x, '#8ad0ff', 1); x.restore();
  },
  mobility(x, R) { tri(x, R, '#50e070'); speedLines(x, R, 10, [6, 26, 44, 80], 0, '#c0ffc8', { len: 20, w: 1.8 }); at(x, 36, 52, 0, 1, (xx) => featherWing(xx, -1, 0.5, ['#ffffff', '#c0ffc8', '#3a8a4a'], 6)); at(x, 50, 76, 0, 0.95, bootUp, { metal: 'steel', col: '#3a6a3a' }); },
  weak_point(x, R) {
    tri(x, R, '#ff9030');
    gem(x, 50, 50, 20, '#ff9a40', { n: 4, glowA: 0.3, spark: false });
    glowPath(x, xx => poly(xx, [[50, 30], [46, 44], [54, 52], [48, 70]], false), '#ffffff', 1.4);
    x.strokeStyle = rgba('#fff0d0', 0.95); x.lineWidth = 2; x.beginPath(); x.moveTo(50, 12); x.lineTo(50, 24); x.moveTo(50, 76); x.lineTo(50, 88); x.moveTo(12, 50); x.lineTo(24, 50); x.moveTo(76, 50); x.lineTo(88, 50); x.stroke();
  },
  enhanced(x, R) { tri(x, R, '#ff4a4a'); at(x, 40, 76, 0.3, 0.72, greatsword, { metal: 'steel' }); arrowUp(x, 70, 40, 1.2, '#ff8a6a'); },
  wide(x, R) { tri(x, R, '#ffd040'); add(x); x.fillStyle = rg(x, 50, 80, 4, 60, [[0, rgba('#fff0a0', 0.9)], [1, rgba('#ffd040', 0.15)]]); x.beginPath(); x.moveTo(50, 80); x.arc(50, 80, 56, -PI * 0.86, -PI * 0.14); x.closePath(); x.fill(); norm(x); glowPath(x, xx => { xx.beginPath(); xx.arc(50, 80, 50, -PI * 0.86, -PI * 0.14); }, '#fff0a0', 2.4); for (const a of [-PI * 0.8, -PI * 0.2]) { x.save(); x.translate(50 + Math.cos(a) * 34, 80 + Math.sin(a) * 34); x.rotate(a + PI / 2); arrowUp(x, 0, 0, 0.9, '#ffffff'); x.restore(); } },
  super_armor(x, R) { tri(x, R, '#f0c040'); heater(x, 50, 50, 0.7, '#4a5a7a', 'gold'); star(x, 50, 47, 5, 5, 12); x.fillStyle = lg(x, 40, 36, 60, 60, [[0, '#ffffff'], [1, '#ffc040']]); x.fill(); outline(x, INK, 0.9); },
  bleed(x, R) { tri(x, R, '#e02030'); drop(x, 50, 44, 12, '#d01020'); drop(x, 30, 66, 7, '#d01020'); drop(x, 70, 68, 6, '#d01020'); },
  burn(x, R) { tri(x, R, '#ff6a1e'); flame(x, R, 50, 84, 62); },
  freeze(x, R) { tri(x, R, '#6ad0ff'); snowflake(x, 50, 50, 24, '#a0e8ff'); },
  shock(x, R) { tri(x, R, '#ffd030'); bolt2(x, 50, 50, 1.2, '#ffe040'); },
  pull(x, R) {
    tri(x, R, '#a060ff');
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4; x.save(); x.translate(50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26); x.rotate(a - PI / 2); arrowUp(x, 0, 0, 0.9, '#d0a0ff'); x.restore(); }
    glow(x, 50, 50, 12, '#e0c0ff', 1);
  },
  pierce(x, R) {
    tri(x, R, '#c8d4e0');
    for (const cx of [34, 58]) { x.lineWidth = 2; x.strokeStyle = rgba('#e0e8f0', 0.9); ellipse(x, cx, 50, 6, 14); x.stroke(); }
    streak(x, 8, 50, 86, 50, 3, '#e0e8ff', { even: true });
    poly(x, [[92, 50], [78, 42], [80, 50], [78, 58]]); sym(x, '#c8d4e0', 1);
  },
  extra_hit(x, R) { tri(x, R, '#ff70b0'); slashAB(x, 20, 66, 72, 18, 8, 7, '#ff90c8'); slashAB(x, 30, 82, 82, 34, 8, 7, '#ff90c8'); },
  charge(x, R) {
    tri(x, R, '#6aa0ff');
    x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.5)'; circle(x, 50, 50, 24); x.stroke();
    glowPath(x, xx => { xx.beginPath(); xx.arc(50, 50, 24, -PI / 2, PI * 1.1); }, '#8ac0ff', 3);
    x.fillStyle = rg(x, 47, 47, 0, 12, [[0, '#ffffff'], [1, '#4a80ff']]); circle(x, 50, 50, 10); x.fill(); outline(x, INK, 0.8);
  },
  zone(x, R) { tri(x, R, '#40d0b0'); runeCircle(x, R, 50, 58, 34, '#80ffe0', { sy: 0.45, points: 6, w: 1.4 }); streak(x, 50, 58, 50, 16, 4, '#80ffe0', { bias: 0.5 }); },
  element(x, R) {
    tri(x, R, '#c080ff');
    gem(x, 50, 30, 10, '#ff6a2a', { n: 4, spark: false, glowA: 0.4 });
    gem(x, 30, 64, 10, '#6ad0ff', { n: 4, spark: false, glowA: 0.4 });
    gem(x, 70, 64, 10, '#ffd040', { n: 4, spark: false, glowA: 0.4 });
  },
  stance(x, R) {
    tri(x, R, '#5a9aff');
    for (const s of [-1, 1]) { x.save(); x.translate(50 + s * 34, 50); x.rotate(s > 0 ? -PI / 2 : PI / 2); arrowUp(x, 0, 0, 0.8, '#ffb0a0'); x.restore(); }
    heater(x, 50, 50, 0.72, '#2a4a8a', 'silver', { trimMetal: 'silver' });
    x.fillStyle = metalLG(x, 40, 60, 60, 70, 'gold'); poly(x, [[50, 34], [58, 46], [54, 46], [54, 62], [46, 62], [46, 46], [42, 46]]); x.fill(); outline(x, INK, 0.8);
    x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.beginPath(); x.moveTo(20, 84); x.lineTo(80, 84); x.stroke(); outline(x, INK, 0.4);
  },
  unstoppable(x, R) {
    tri(x, R, '#ffb030');
    burst(x, R, 50, 50, 12, 8, 34, '#ffc050');
    for (const s of [-1, 1]) { chain(x, t => [50 + s * (10 + t * 30), 50 + s * t * 8], 6, 3, 'iron'); }
    x.save(); x.translate(50, 50); x.scale(0.9, 0.9); star(x, 0, 0, 5, 7, 17); x.fillStyle = lg(x, -17, -17, 17, 17, [[0, '#ffffff'], [0.5, '#ffd060'], [1, '#a06010']]); x.fill(); outline(x, INK, 1); x.restore();
  },
  swift(x, R) {
    tri(x, R, '#a0e040');
    speedLines(x, R, 8, [6, 26, 40, 74], 0, '#e0ffb0', { len: 16, w: 1.4 });
    for (let i = 0; i < 3; i++) { const px = 34 + i * 16; poly(x, [[px - 8, 30], [px + 8, 50], [px - 8, 70], [px - 2, 70], [px + 14, 50], [px - 2, 30]]); sym(x, '#c0f060', 1); }
  },
  mana_saver(x, R) {
    tri(x, R, '#3a8aff');
    x.save(); x.beginPath(); x.moveTo(46, 18); x.bezierCurveTo(52, 30, 64, 42, 64, 56); x.arc(46, 56, 18, 0, PI); x.bezierCurveTo(28, 42, 40, 30, 46, 18); x.closePath(); x.fillStyle = 'rgba(20,40,80,.8)'; x.fill(); x.clip();
    x.fillStyle = rg(x, 40, 60, 1, 24, [[0, '#e0f0ff'], [0.4, '#4a9aff'], [1, '#12306a']]); x.fillRect(20, 50, 50, 30); x.restore();
    x.beginPath(); x.moveTo(46, 18); x.bezierCurveTo(52, 30, 64, 42, 64, 56); x.arc(46, 56, 18, 0, PI); x.bezierCurveTo(28, 42, 40, 30, 46, 18); x.closePath(); outline(x, INK, 1.2);
    downArrow(x, 74, 66, 0.95, '#80c0ff');
  },
  keen(x, R) { tri(x, R, '#ffb040'); at(x, 50, 52, 0, 1, (xx) => eye(xx, 58, '#ffb040', { open: 0.42, lw: 1.3 })); sparkle(x, 72, 30, 10, '#ffffff'); },
  crushing(x, R) {
    tri(x, R, '#b060ff');
    poly(x, [[22, 74], [78, 74], [72, 90], [28, 90]]); x.fillStyle = lg(x, 22, 74, 78, 90, [[0, '#a8a0b8'], [1, '#3a3448']]); x.fill(); outline(x, INK, 1);
    glowPath(x, xx => poly(xx, [[50, 74], [46, 80], [52, 84], [48, 90]], false), '#e0b0ff', 1);
    burst(x, R, 50, 70, 10, 5, 18, '#d090ff', { sy: 0.6 });
    at(x, 50, 30, PI / 2, 0.95, fist, { metal: 'steel', cuff: '#3a2a5a' });
  },
  aftershock(x, R) {
    tri(x, R, '#ff8a30');
    ring(x, 50, 58, 34, 14, '#ffb050', 2); ring(x, 50, 58, 20, 8, '#ffd080', 1.5);
    burst(x, R, 50, 56, 10, 4, 16, '#ffb050', { sy: 0.6 });
    rocks(x, R, 6, 50, 52, 26, { cols: ['#8a6a50', '#3a2a1a'], a0: PI, arc: PI, size: 2.6 });
  },
  back(x, R) {
    tri(x, R, '#a070ff');
    x.beginPath(); x.moveTo(32, 90); x.bezierCurveTo(30, 68, 36, 56, 42, 52); x.bezierCurveTo(36, 46, 38, 30, 50, 28); x.bezierCurveTo(62, 30, 64, 46, 58, 52); x.bezierCurveTo(64, 56, 70, 68, 68, 90); x.closePath();
    x.fillStyle = lg(x, 30, 28, 70, 90, [[0, '#4a3a6a'], [1, '#100a1c']]); x.fill(); outline(x, INK, 1.2);
    glowPath(x, xx => { xx.beginPath(); xx.moveTo(86, 30); xx.bezierCurveTo(96, 60, 80, 76, 56, 66); }, '#d0a0ff', 2);
    x.save(); x.translate(56, 66); x.rotate(PI * 1.1); poly(x, [[0, -6], [8, 0], [0, 6]]); sym(x, '#e0c0ff', 1); x.restore();
    burst(x, R, 52, 64, 8, 3, 12, '#e0b0ff');
  },
  head(x, R) {
    tri(x, R, '#ff6a3a');
    x.save(); x.translate(50, 58); x.beginPath(); x.moveTo(-22, 6); x.bezierCurveTo(-24, -26, 24, -26, 22, 6); x.lineTo(18, 22); x.lineTo(6, 26); x.lineTo(4, 6); x.lineTo(-4, 6); x.lineTo(-6, 26); x.lineTo(-18, 22); x.closePath();
    x.fillStyle = rg(x, -8, -12, 1, 34, [[0, '#ffffff'], [0.3, '#b8c4d0'], [0.7, '#4a5462'], [1, '#14181e']]); x.fill(); outline(x, INK, 1.2);
    x.fillStyle = '#05060a'; poly(x, [[-17, 8], [-5, 8], [-5, 13], [-15, 12]]); x.fill(); poly(x, [[17, 8], [5, 8], [5, 13], [15, 12]]); x.fill(); x.restore();
    burst(x, R, 50, 36, 10, 4, 18, '#ffb050');
    x.save(); x.translate(50, 18); x.rotate(PI); arrowUp(x, 0, 0, 0.9, '#ffd080'); x.restore();
  },
  scorched(x, R) {
    tri(x, R, '#ff5a1a');
    x.save(); add(x); x.fillStyle = rg(x, 50, 72, 2, 34, [[0, 'rgba(255,160,60,.8)'], [1, 'rgba(255,80,20,0)']]); ellipse(x, 50, 72, 36, 12); x.fill(); norm(x); x.restore();
    for (const [px, h] of [[30, 28], [50, 40], [70, 30], [40, 22], [60, 24]]) fire(x, R, px, 76, h, 12, 0, { n: 3 });
  },
  vital(x, R) {
    tri(x, R, '#ff4a6a');
    x.strokeStyle = rgba('#ffd0d8', 0.95); x.lineWidth = 2; circle(x, 50, 52, 24); x.stroke(); circle(x, 50, 52, 12); x.stroke();
    x.beginPath(); x.moveTo(50, 18); x.lineTo(50, 34); x.moveTo(50, 70); x.lineTo(50, 86); x.moveTo(16, 52); x.lineTo(32, 52); x.moveTo(68, 52); x.lineTo(84, 52); x.stroke();
    for (const [a, s] of [[0.3, 1], [2.4, 0.8], [4.4, 0.9]]) { star(x, 50 + Math.cos(a) * 20, 52 + Math.sin(a) * 8 - 20, 5, 2.4 * s, 6 * s); x.fillStyle = '#ffe070'; x.fill(); outline(x, INK, 0.6); }
    glow(x, 50, 52, 8, '#ff4a6a', 1);
  },
};

// ------------------------------------------------------------------ class crests (transparent heraldry)
function crest(x, col, draw) {
  // soft shadow
  x.save(); x.translate(1.5, 2.5); heaterPath(x, 50, 50, 1.2); x.fillStyle = 'rgba(0,0,0,.45)'; x.fill(); x.restore();
  heaterPath(x, 50, 50, 1.2);
  x.fillStyle = rg(x, 40, 34, 2, 64, [[0, shade(col, 0.1)], [0.55, shade(col, -0.45)], [1, shade(col, -0.85)]]); x.fill();
  x.save(); heaterPath(x, 50, 50, 1.2); x.clip(); glow(x, 50, 46, 34, col, 0.5); draw(); x.restore();
  x.lineWidth = 4.6; x.strokeStyle = metalLG(x, 16, 10, 84, 90, 'gold'); heaterPath(x, 50, 50, 1.16); x.stroke();
  heaterPath(x, 50, 50, 1.25); outline(x, INK, 1.6);
  heaterPath(x, 50, 50, 1.08); outline(x, 'rgba(0,0,0,.5)', 0.9);
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(19, 16); x.quadraticCurveTo(50, 8.5, 81, 16); x.stroke();
}
const C = {
  reaver(x, R) { crest(x, CLASS_COLORS.reaver, () => { flame(x, R, 50, 94, 60, '#ff5a3a'); at(x, 50, 78, 0, 0.82, greatsword, { metal: 'steel', rune: '#ff4050' }); }); },
  oathkeeper(x, R) { crest(x, '#3a5aa0', () => { rays(x, R, 50, 40, 16, 8, 50, '#ffe8a0', { alpha: 0.6 }); x.fillStyle = rg(x, 50, 40, 0, 14, [[0, '#ffffff'], [0.6, '#ffe070'], [1, 'rgba(255,200,80,0)']]); circle(x, 50, 40, 14); x.fill(); at(x, 50, 76, 0, 0.9, longsword, { metal: 'silver', guard: 'gold', gem: '#4ab0ff' }); }); },
  stormfist(x, R) { crest(x, CLASS_COLORS.stormfist, () => { for (let i = 0; i < 3; i++) bolt(x, R, 50, 20, 20 + i * 30, 90, { col: '#bfe8ff', w: 1.2, gens: 4 }); at(x, 42, 50, -PI / 2, 1, fist, { metal: 'silver', cuff: '#16305a', glow: '#8ad8ff' }); }); },
  pistoleer(x, R) { crest(x, '#7a4a20', () => {
    // brass cylinder charge behind a bold revolver
    x.save(); x.translate(50, 44); circle(x, 0, 0, 20); x.fillStyle = metalRG(x, 0, 0, 22, 'brass'); x.fill(); outline(x, INK, 1.2);
    for (let i = 0; i < 6; i++) { const a = -PI / 2 + i * TAU / 6, cx = Math.cos(a) * 12, cy = Math.sin(a) * 12; x.fillStyle = '#1a0c04'; circle(x, cx, cy, 4.6); x.fill(); glow(x, cx, cy, 7, '#ff8a20', 0.8); x.fillStyle = rg(x, cx - 0.6, cy - 0.6, 0, 3.4, [[0, '#fff0b0'], [1, '#c05a10']]); circle(x, cx, cy, 3); x.fill(); }
    x.restore();
    x.save(); x.translate(30, 80); x.rotate(-0.72); x.scale(1.7, 1.7); x.shadowColor = 'rgba(0,0,0,.65)'; x.shadowBlur = 5; pistol(x, { metal: 'steel', trim: 'gold' }); x.shadowBlur = 0; x.restore();
  }); },
  starcaller(x, R) { crest(x, CLASS_COLORS.starcaller, () => { for (let i = 0; i < 12; i++) glow(x, 20 + R() * 60, 16 + R() * 60, 1 + R() * 1.4, '#ffffff', 0.7); star(x, 50, 44, 8, 7, 24); x.fillStyle = lg(x, 30, 24, 70, 64, [[0, '#ffffff'], [0.5, '#d8c0ff'], [1, '#6a3ab0']]); x.fill(); outline(x, INK, 1); x.fillStyle = rg(x, 48, 42, 0, 8, [[0, '#ffffff'], [1, '#7ad8ff']]); circle(x, 50, 44, 6.5); x.fill(); }); },
  songweaver(x, R) { crest(x, '#b85a6a', () => { at(x, 50, 72, 0, 0.95, harp, { gem: '#36d8c6' }); note(x, 72, 36, 0.55, '#36d8c6', 0); }); },
  bladedancer(x, R) { crest(x, '#5a3a90', () => { moon(x, 50, 40, 16, '#e0d0ff', { bite: 0.5, biteY: 0.2 }); at(x, 36, 76, 0.55, 0.9, curvedBlade, { metal: 'silver', edgeGlow: '#e0b0ff' }); x.save(); x.translate(64, 76); x.rotate(-0.55); x.scale(-0.9, 0.9); curvedBlade(x, { metal: 'silver', edgeGlow: '#e0b0ff' }); x.restore(); }); },
  demonbound(x, R) { crest(x, '#5a1a50', () => { fire(x, R, 50, 94, 50, 60, 0, { n: 6, layers: fireLayers('#1a0022', '#6a10a0', '#e060ff') }); at(x, 50, 56, 0, 0.8, demonHead, { skin: '#1a0a20', eye: '#ff3a2a' }); }); },
};

export const EMBLEM_PAINT = {};
for (const k in E) EMBLEM_PAINT[`engr:${k}`] = E[k];
for (const k in T) EMBLEM_PAINT[`tripod:${k}`] = T[k];
for (const k in C) EMBLEM_PAINT[`class:${k}`] = C[k];
export { E as ENGRAVING_PAINTERS };
