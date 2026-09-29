// Non-gear item renders: materials, battle items, trade goods, food, gifts, collectibles, misc. Objects only.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, rays, rgba, shade, mix, outline, metal, metalLG, metalRG, gem,
  ribbon, bez, qbez, add, norm, glowPath, crystal, fire, fireLayers, embers, smoke, rivet, runeCircle, bolt, note,
} from './core.js';
import { featherWing, skull, harp, arrowUp } from './motifs.js';
import { coin } from './generic.js';

const INK = 'rgba(6,4,8,.92)';
const at = (x, px, py, rot, s, fn, o) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); fn(x, o); x.restore(); };

/** Irregular rock base centred at (cx,cy). */
function rock(x, R, cx, cy, rx, ry, cols = ['#8a8078', '#4a423c', '#1a1612']) {
  const pts = []; const n = 9;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, rr = 0.8 + R() * 0.25; pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr * (Math.sin(a) > 0 ? 0.8 : 1)]); }
  poly(x, pts); x.fillStyle = rg(x, cx - rx * 0.4, cy - ry * 0.5, 1, rx * 1.3, [[0, cols[0]], [0.55, cols[1]], [1, cols[2]]]); x.fill(); outline(x, INK, 1.1);
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 0.8; for (let i = 0; i < 3; i++) { const a = R() * TAU; x.beginPath(); x.moveTo(cx + Math.cos(a) * rx * 0.3, cy + Math.sin(a) * ry * 0.3); x.lineTo(cx + Math.cos(a) * rx * 0.75, cy + Math.sin(a) * ry * 0.7); x.stroke(); }
}
function crystalCluster(x, R, cx, cy, col, s = 1) {
  for (const [dx, l, w, a] of [[-12, 30, 11, -PI / 2 - 0.45], [12, 28, 10, -PI / 2 + 0.4], [0, 42, 14, -PI / 2], [-4, 20, 8, -PI / 2 - 0.9], [7, 22, 8, -PI / 2 + 0.85]]) crystal(x, cx + dx * s, cy, l * s, w * s, a, col, { glowA: 0.25 });
}
/** Round-bottom flask with liquid colour. */
function flask(x, cx, cy, s, liquid, o = {}) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  const body = () => { x.beginPath(); x.arc(0, 12, 24, -PI / 2 - 0.32, -PI / 2 + 0.32, true); x.lineTo(7.5, -18); x.lineTo(-7.5, -18); x.closePath(); };
  body(); x.fillStyle = 'rgba(20,30,40,.55)'; x.fill();
  x.save(); body(); x.clip();
  x.fillStyle = rg(x, -4, 14, 2, 30, [[0, shade(liquid, 0.55)], [0.35, liquid], [1, shade(liquid, -0.65)]]); x.fillRect(-30, o.level ?? -2, 60, 50);
  x.fillStyle = rgba(shade(liquid, 0.6), 0.8); ellipse(x, 0, o.level ?? -2, 22, 2.6); x.fill();
  glow(x, -2, 14, 22, liquid, 0.4);
  x.fillStyle = 'rgba(255,255,255,.55)'; for (const [bx, by, br] of [[-8, 18, 1.4], [5, 8, 1], [9, 22, 1.8], [-2, 4, 0.8]]) { circle(x, bx, by, br); x.fill(); }
  x.restore();
  body(); outline(x, INK, 1.4);
  x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 12, 19, -2.6, -1.9); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1.2; x.beginPath(); x.arc(0, 12, 19, 0.5, 1.2); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(-5.5, -17, 2, 8);
  x.fillStyle = lg(x, -9, 0, 9, 0, [[0, '#6c7a86'], [0.4, '#e8f4ff'], [1, '#3a444c']]); x.beginPath(); x.roundRect(-9.5, -21, 19, 4, 2); x.fill(); outline(x, INK, 0.9);
  x.fillStyle = lg(x, -7, 0, 7, 0, [[0, '#5a3414'], [0.4, '#c08a50'], [1, '#3a200a']]);
  x.beginPath(); x.moveTo(-6.5, -21); x.lineTo(-7.5, -31); x.quadraticCurveTo(0, -33.5, 7.5, -31); x.lineTo(6.5, -21); x.closePath(); x.fill(); outline(x, INK, 0.9);
  x.restore();
}
/** Tall ornate vial. */
function vial(x, cx, cy, s, liquid, cap = 'gold') {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  const body = () => { x.beginPath(); x.moveTo(-6, -22); x.lineTo(6, -22); x.lineTo(6, -14); x.bezierCurveTo(16, -8, 16, 18, 10, 26); x.lineTo(-10, 26); x.bezierCurveTo(-16, 18, -16, -8, -6, -14); x.closePath(); };
  glow(x, 0, 8, 26, liquid, 0.5);
  body(); x.fillStyle = 'rgba(20,24,30,.5)'; x.fill();
  x.save(); body(); x.clip(); x.fillStyle = rg(x, -3, 8, 1, 24, [[0, '#ffffff'], [0.25, shade(liquid, 0.5)], [0.7, liquid], [1, shade(liquid, -0.6)]]); x.fillRect(-20, -6, 40, 40); x.restore();
  body(); outline(x, INK, 1.2);
  x.strokeStyle = 'rgba(255,255,255,.65)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-9, -6); x.bezierCurveTo(-13, 2, -12, 14, -8, 22); x.stroke();
  x.fillStyle = metalLG(x, -8, -30, 8, -20, cap); x.beginPath(); x.roundRect(-7.5, -26, 15, 5, 1.5); x.fill(); outline(x, INK, 0.8);
  x.beginPath(); x.moveTo(-4, -26); x.lineTo(-3, -33); x.quadraticCurveTo(0, -36, 3, -33); x.lineTo(4, -26); x.closePath(); x.fill(); outline(x, INK, 0.7);
  x.fillStyle = metalLG(x, -14, 10, 14, 16, cap); x.fillRect(-14, 10, 28, 3.4); x.strokeStyle = INK; x.lineWidth = 0.6; x.strokeRect(-14, 10, 28, 3.4);
  x.restore();
}
/** Round grenade with a fuse cap; body colour + emblem painter. */
function grenade(x, R, col, emblem, o = {}) {
  const cx = 50, cy = 56, r = 26;
  if (o.glow) glow(x, cx, cy, 40, o.glow, 0.45);
  circle(x, cx, cy, r); x.fillStyle = rg(x, cx - 9, cy - 10, 2, r * 1.2, [[0, shade(col, 0.55)], [0.45, col], [1, shade(col, -0.75)]]); x.fill(); outline(x, INK, 1.4);
  x.strokeStyle = rgba(shade(col, -0.7), 0.7); x.lineWidth = 1.2; x.beginPath(); x.ellipse(cx, cy, r, r * 0.3, 0, 0, PI); x.stroke();
  x.fillStyle = metalLG(x, cx - 8, cy - r - 8, cx + 8, cy - r + 2, o.cap || 'brass'); x.beginPath(); x.roundRect(cx - 7, cy - r - 7, 14, 9, 2); x.fill(); outline(x, INK, 0.9);
  x.strokeStyle = '#3a2a1a'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx + 2, cy - r - 7); x.quadraticCurveTo(cx + 12, cy - r - 18, cx + 20, cy - r - 12); x.stroke();
  glow(x, cx + 21, cy - r - 12, 7, '#ffb040', 1); sparkle(x, cx + 21, cy - r - 12, 5, '#ffe0a0');
  if (emblem) { x.save(); x.translate(cx, cy + 2); emblem(); x.restore(); }
  x.fillStyle = 'rgba(255,255,255,.45)'; ellipse(x, cx - 10, cy - 12, 6, 3.4, -0.6); x.fill();
}
function sunOrb(x, R, cx, cy, r, col) {
  glow(x, cx, cy, r * 2.4, col, 0.7);
  star(x, cx, cy, 12, r * 1.05, r * 1.45); x.fillStyle = rg(x, cx, cy, r * 0.8, r * 1.5, [[0, mix(col, '#ffffff', 0.4)], [1, shade(col, -0.2)]]); x.fill(); outline(x, 'rgba(90,40,0,.7)', 0.8);
  circle(x, cx, cy, r); x.fillStyle = rg(x, cx - r * 0.35, cy - r * 0.35, 0, r * 1.1, [[0, '#ffffff'], [0.45, mix(col, '#ffffff', 0.45)], [1, col]]); x.fill(); outline(x, 'rgba(90,40,0,.7)', 0.9);
}
function leaf(x, cx, cy, len, w, a, col) {
  x.save(); x.translate(cx, cy); x.rotate(a);
  x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(len * 0.3, -w, len * 0.75, -w * 0.8, len, 0); x.bezierCurveTo(len * 0.75, w * 0.8, len * 0.3, w, 0, 0); x.closePath();
  x.fillStyle = lg(x, 0, -w, 0, w, [[0, shade(col, 0.45)], [0.5, col], [1, shade(col, -0.5)]]); x.fill(); outline(x, INK, 0.8);
  x.strokeStyle = rgba(shade(col, -0.6), 0.8); x.lineWidth = 0.7; x.beginPath(); x.moveTo(1, 0); x.lineTo(len - 2, 0); x.stroke();
  for (let i = 1; i < 4; i++) { const px = (len * i) / 4; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + len * 0.1, -w * 0.5); x.moveTo(px, 0); x.lineTo(px + len * 0.1, w * 0.5); x.stroke(); }
  x.restore();
}
function parchment(x, cx, cy, w, h, o = {}) {
  x.beginPath(); x.moveTo(cx - w / 2, cy - h / 2); x.lineTo(cx + w / 2, cy - h / 2 + 2); x.lineTo(cx + w / 2 - 1, cy + h / 2); x.lineTo(cx - w / 2 + 2, cy + h / 2 - 2); x.closePath();
  x.fillStyle = rg(x, cx - w * 0.2, cy - h * 0.2, 2, w, [[0, '#fff4d8'], [0.6, '#e0c898'], [1, '#9a7a48']]); x.fill(); outline(x, INK, 1);
  if (o.lines !== false) { x.strokeStyle = 'rgba(90,60,30,.45)'; x.lineWidth = 0.8; for (let i = 0; i < 4; i++) { const yy = cy - h / 2 + 8 + i * (h - 14) / 4; x.beginPath(); x.moveTo(cx - w / 2 + 6, yy); x.lineTo(cx + w / 2 - 8, yy + 1); x.stroke(); } }
}
function waxSeal(x, cx, cy, r, col = '#b01a1a') {
  x.beginPath(); for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, rr = r * (i % 2 ? 0.88 : 1.02); i ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath();
  x.fillStyle = rg(x, cx - r * 0.3, cy - r * 0.3, 0, r * 1.2, [[0, shade(col, 0.4)], [0.6, col], [1, shade(col, -0.6)]]); x.fill(); outline(x, INK, 0.8);
  circle(x, cx, cy, r * 0.62); x.strokeStyle = rgba(shade(col, -0.6), 0.9); x.lineWidth = 0.9; x.stroke();
}
function box(x, cx, cy, w, h, d, col, lid) {
  // simple 3/4 box: front, right side, top
  poly(x, [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]); x.fillStyle = lg(x, cx - w / 2, 0, cx + w / 2, 0, [[0, shade(col, 0.15)], [1, shade(col, -0.3)]]); x.fill(); outline(x, INK, 1);
  poly(x, [[cx + w / 2, cy - h / 2], [cx + w / 2 + d, cy - h / 2 - d * 0.6], [cx + w / 2 + d, cy + h / 2 - d * 0.6], [cx + w / 2, cy + h / 2]]); x.fillStyle = shade(col, -0.55); x.fill(); outline(x, INK, 1);
  poly(x, [[cx - w / 2, cy - h / 2], [cx - w / 2 + d, cy - h / 2 - d * 0.6], [cx + w / 2 + d, cy - h / 2 - d * 0.6], [cx + w / 2, cy - h / 2]]); x.fillStyle = lid || shade(col, 0.4); x.fill(); outline(x, INK, 1);
}

/** Card pack in a colourway; legend = gold star seal, pip = leaf seal. */
function cardPack(x, R, col, dark, glowC, legend, pipSeal) {
  glow(x, 50, 50, 38, glowC, 0.45);
  for (const [dx, a, c] of [[-10, -0.25, shade(col, -0.3)], [8, 0.2, shade(col, -0.45)]]) { x.save(); x.translate(50 + dx, 46); x.rotate(a); x.beginPath(); x.roundRect(-14, -22, 28, 40, 3); x.fillStyle = lg(x, -14, -22, 14, 18, [[0, shade(c, 0.4)], [1, c]]); x.fill(); outline(x, INK, 1); x.strokeStyle = metalLG(x, -14, -22, 14, 18, 'gold'); x.lineWidth = 1; x.strokeRect(-11, -19, 22, 34); x.restore(); }
  x.beginPath(); x.moveTo(24, 50); x.lineTo(76, 50); x.lineTo(78, 88); x.lineTo(22, 88); x.closePath(); x.fillStyle = lg(x, 22, 50, 78, 88, [[0, shade(col, 0.25)], [0.5, col], [1, dark]]); x.fill(); outline(x, INK, 1.2);
  x.strokeStyle = metalLG(x, 22, 50, 78, 88, 'gold'); x.lineWidth = 1.6; x.beginPath(); x.moveTo(26, 56); x.lineTo(74, 56); x.stroke();
  if (legend) { star(x, 50, 71, 5, 5, 12); x.fillStyle = lg(x, 38, 60, 62, 82, [[0, '#ffffff'], [0.5, '#ffe070'], [1, '#b07010']]); x.fill(); outline(x, INK, 0.9); sparkle(x, 50, 71, 7); }
  else if (pipSeal) { waxSeal(x, 50, 71, 8, '#3a8a2a'); leaf(x, 46, 74, 10, 3.4, -0.8, '#b0ff80'); }
  else { waxSeal(x, 50, 71, 8, '#c02a2a'); star(x, 50, 71, 5, 2, 5); x.fillStyle = '#ffd070'; x.fill(); }
}
/** Drawstring pouch spilling gems. */
function pouch(x, R, col, gems, radiant) {
  x.beginPath(); x.moveTo(34, 40); x.bezierCurveTo(16, 56, 22, 88, 50, 88); x.bezierCurveTo(78, 88, 84, 56, 66, 40); x.closePath();
  x.fillStyle = rg(x, 42, 56, 2, 40, [[0, shade(col, 0.45)], [0.5, col], [1, shade(col, -0.65)]]); x.fill(); outline(x, INK, 1.3);
  x.fillStyle = shade(col, -0.2); poly(x, [[34, 40], [28, 28], [40, 34], [50, 26], [60, 34], [72, 28], [66, 40]]); x.fill(); outline(x, INK, 1);
  x.strokeStyle = metalLG(x, 30, 36, 70, 44, radiant ? 'gold' : 'bronze'); x.lineWidth = 2.2; x.beginPath(); x.moveTo(33, 41); x.quadraticCurveTo(50, 46, 67, 41); x.stroke();
  gems.forEach((c, i) => gem(x, 34 + i * 12, 30 - (i % 2) * 6 + (i === 0 ? 4 : 0), radiant ? 6 : 5.4, c, { n: i % 2 ? 6 : 8, glowA: radiant ? 0.7 : 0.4, lw: 0.6, spark: radiant }));
  if (radiant) sparkle(x, 60, 22, 8);
}

const M = {
  // ---- honing materials
  destruction_stone(x, R) { glow(x, 50, 48, 34, '#ff3a3a', 0.4); rock(x, R, 50, 70, 32, 18); crystalCluster(x, R, 50, 66, '#ff3a4a', 1.05); sparkle(x, 50, 26, 7); },
  guardian_stone(x, R) { glow(x, 50, 48, 34, '#3aa0ff', 0.4); rock(x, R, 50, 70, 32, 18); crystalCluster(x, R, 50, 66, '#3a9aff', 1.05); sparkle(x, 50, 26, 7); },
  leapstone(x, R) {
    glow(x, 50, 52, 36, '#c8e040', 0.45);
    x.beginPath(); x.ellipse(50, 56, 30, 24, -0.2, 0, TAU); x.fillStyle = rg(x, 40, 44, 2, 38, [[0, '#e8f0c0'], [0.4, '#8aa050'], [1, '#1e2a10']]); x.fill(); outline(x, INK, 1.3);
    glowPath(x, xx => { xx.beginPath(); xx.moveTo(50, 70); xx.lineTo(50, 42); xx.moveTo(40, 52); xx.lineTo(50, 40); xx.lineTo(60, 52); xx.moveTo(40, 62); xx.lineTo(50, 52); xx.lineTo(60, 62); }, '#f0ff80', 2.2);
    sparkle(x, 38, 42, 6);
  },
  fusion(x, R) {
    glow(x, 50, 54, 40, '#b060ff', 0.5);
    // two fused ingots with glowing seams
    const ingot = (cx, cy, s) => {
      x.save(); x.translate(cx, cy); x.scale(s, s);
      poly(x, [[-26, 8], [-18, -6], [18, -6], [26, 8]]); x.fillStyle = lg(x, 0, -6, 0, 8, [[0, '#f0e0ff'], [1, '#a070d0']]); x.fill(); outline(x, INK, 1);
      poly(x, [[-26, 8], [26, 8], [26, 18], [-26, 18]]); x.fillStyle = lg(x, -26, 0, 26, 0, [[0, '#6a3a9a'], [0.35, '#b888e8'], [1, '#3a1a5a']]); x.fill(); outline(x, INK, 1);
      glowPath(x, xx => { xx.beginPath(); xx.moveTo(-20, 13); xx.bezierCurveTo(-8, 9, 4, 17, 20, 12); }, '#f0b0ff', 1.1);
      x.restore();
    };
    ingot(50, 72, 1.25); ingot(50, 46, 1.05);
    crystal(x, 50, 40, 22, 9, -PI / 2, '#e090ff', { glowA: 0.5 });
    sparkle(x, 36, 34, 6);
  },
  shards(x, R) {
    glow(x, 50, 52, 38, '#fff0c0', 0.5);
    for (const [px, py, l, w, a] of [[50, 76, 44, 13, -PI / 2], [34, 78, 30, 10, -PI / 2 - 0.5], [66, 78, 32, 10, -PI / 2 + 0.45], [44, 82, 18, 7, -PI / 2 - 1.1], [58, 84, 18, 7, -PI / 2 + 1]]) crystal(x, px, py, l, w, a, '#ffe8b0', { glowA: 0.3 });
    sparkle(x, 50, 30, 9); sparkle(x, 30, 50, 5);
  },
  solar_grace(x, R) { sunOrb(x, R, 50, 52, 16, '#ffd040'); },
  solar_blessing(x, R) {
    x.save(); x.translate(50, 58); featherWing(x, -1, 1.05, ['#ffffff', '#ffe0a0', '#b07a2a'], 7); featherWing(x, 1, 1.05, ['#ffffff', '#ffe0a0', '#b07a2a'], 7); x.restore();
    sunOrb(x, R, 50, 52, 14, '#ffa030');
  },
  solar_protection(x, R) {
    rays(x, R, 50, 44, 16, 14, 44, '#ffc070', { alpha: 0.5 });
    sunOrb(x, R, 50, 36, 13, '#ff7a2a');
    x.beginPath(); x.moveTo(26, 46); x.quadraticCurveTo(50, 40, 74, 46); x.bezierCurveTo(74, 66, 64, 80, 50, 90); x.bezierCurveTo(36, 80, 26, 66, 26, 46); x.closePath();
    x.fillStyle = rg(x, 44, 56, 2, 36, [[0, '#ffb070'], [0.5, '#c0401a'], [1, '#4a1004']]); x.fill(); x.lineWidth = 2.6; x.strokeStyle = metalLG(x, 26, 40, 74, 90, 'gold'); x.stroke(); outline(x, INK, 0.8);
    star(x, 50, 62, 8, 4, 10); x.fillStyle = '#ffe070'; x.fill();
  },
  // ---- battle items
  hp_potion(x, R) { flask(x, 50, 54, 1.2, '#e8202a'); },
  elixir(x, R) { vial(x, 50, 52, 1.25, '#ffc830'); sparkle(x, 62, 40, 6); },
  destruction_bomb(x, R) { grenade(x, R, '#2a2a30', () => { glowPath(x, xx => poly(xx, [[-10, -10], [-2, -2], [-6, 6], [4, 12]], false), '#ff4a2a', 1.3); glowPath(x, xx => poly(xx, [[-2, -2], [8, -6], [12, 2]], false), '#ff4a2a', 1); }, { cap: 'iron' }); },
  flame_grenade(x, R) { grenade(x, R, '#c83a14', () => { fire(x, R, 0, 12, 22, 14, 0, { n: 4 }); }, { glow: '#ff6a1e' }); },
  frost_grenade(x, R) { grenade(x, R, '#3a8ac8', () => { for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * PI / 3); x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -11); x.moveTo(0, -6); x.lineTo(-3, -9); x.moveTo(0, -6); x.lineTo(3, -9); x.stroke(); x.restore(); } }, { glow: '#8ad8ff', cap: 'silver' }); },
  whirlwind_grenade(x, R) { grenade(x, R, '#3a9a5a', () => { glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.04) { const a = t * TAU * 1.6, r = 2 + t * 12; const px = Math.cos(a) * r, py = Math.sin(a) * r * 0.8; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, '#c0ffd0', 1.4); }, { glow: '#6af0a0' }); },
  clay_grenade(x, R) {
    // clay pot wrapped in cloth
    x.beginPath(); x.moveTo(40, 30); x.lineTo(60, 30); x.lineTo(58, 36); x.bezierCurveTo(78, 42, 80, 76, 64, 86); x.lineTo(36, 86); x.bezierCurveTo(20, 76, 22, 42, 42, 36); x.closePath();
    x.fillStyle = rg(x, 42, 50, 2, 40, [[0, '#e0a070'], [0.5, '#a0603a'], [1, '#3a1a08']]); x.fill(); outline(x, INK, 1.3);
    x.fillStyle = lg(x, 0, 52, 0, 62, [[0, '#e8dcc0'], [1, '#8a7a5a']]); poly(x, [[25, 54], [75, 54], [76, 62], [24, 62]]); x.fill(); outline(x, INK, 0.8);
    x.fillStyle = '#e8dcc0'; poly(x, [[42, 28], [58, 28], [56, 22], [44, 22]]); x.fill(); outline(x, INK, 0.8);
    x.strokeStyle = '#3a2a1a'; x.lineWidth = 2; x.beginPath(); x.moveTo(50, 22); x.quadraticCurveTo(58, 12, 64, 16); x.stroke(); glow(x, 64, 16, 6, '#ffb040', 1);
  },
  dark_grenade(x, R) { grenade(x, R, '#3a1a4a', () => { glow(x, 0, 0, 14, '#b040ff', 0.9); x.fillStyle = '#0a0010'; circle(x, 0, 0, 6); x.fill(); x.strokeStyle = rgba('#e0a0ff', 0.9); x.lineWidth = 1.2; circle(x, 0, 0, 7.5); x.stroke(); }, { glow: '#9a30ff', cap: 'dark' }); },
  sleep_bomb(x, R) {
    glow(x, 50, 56, 36, '#c0a0ff', 0.45);
    // cloth pouch bomb
    x.beginPath(); x.moveTo(36, 36); x.bezierCurveTo(18, 50, 20, 84, 50, 86); x.bezierCurveTo(80, 84, 82, 50, 64, 36); x.closePath();
    x.fillStyle = rg(x, 42, 52, 2, 40, [[0, '#e0d0ff'], [0.5, '#8a70c0'], [1, '#2a1a40']]); x.fill(); outline(x, INK, 1.3);
    x.fillStyle = '#6a4a9a'; poly(x, [[36, 36], [30, 24], [42, 30], [50, 22], [58, 30], [70, 24], [64, 36]]); x.fill(); outline(x, INK, 1);
    x.strokeStyle = metalLG(x, 34, 34, 66, 40, 'gold'); x.lineWidth = 2.4; x.beginPath(); x.moveTo(35, 37); x.quadraticCurveTo(50, 42, 65, 37); x.stroke();
    x.save(); x.beginPath(); x.arc(50, 62, 11, 0, TAU); x.arc(55, 58, 10, 0, TAU, true); x.fillStyle = '#fff4c0'; x.fill('evenodd'); x.restore(); glow(x, 46, 64, 12, '#fff0a0', 0.5);
    for (const [px, py, s] of [[70, 28, 3], [78, 20, 2.2]]) sparkle(x, px, py, s * 2);
  },
  panacea(x, R) { vial(x, 50, 52, 1.2, '#70f0b0', 'silver'); poly(x, [[47, 56], [53, 56], [53, 60], [57, 60], [57, 66], [53, 66], [53, 70], [47, 70], [47, 66], [43, 66], [43, 60], [47, 60]]); x.fillStyle = '#ffffff'; x.fill(); outline(x, 'rgba(10,60,30,.8)', 0.6); },
  time_stop(x, R) {
    glow(x, 50, 52, 38, '#6ac8ff', 0.5);
    x.save(); x.translate(50, 52); x.scale(1.4, 1.4);
    x.fillStyle = metalLG(x, -16, -24, 16, -18, 'gold'); x.fillRect(-16, -26, 32, 5); x.fillRect(-16, 21, 32, 5); x.strokeStyle = INK; x.lineWidth = 0.8; x.strokeRect(-16, -26, 32, 5); x.strokeRect(-16, 21, 32, 5);
    for (const sx of [-13, 13]) { x.fillStyle = metalLG(x, sx - 1.5, 0, sx + 1.5, 0, 'gold'); x.fillRect(sx - 1.3, -21, 2.6, 42); }
    x.beginPath(); x.moveTo(-10, -21); x.lineTo(10, -21); x.bezierCurveTo(10, -8, 2, -4, 2, 0); x.bezierCurveTo(2, 4, 10, 8, 10, 21); x.lineTo(-10, 21); x.bezierCurveTo(-10, 8, -2, 4, -2, 0); x.bezierCurveTo(-2, -4, -10, -8, -10, -21); x.closePath();
    x.fillStyle = 'rgba(180,230,255,.3)'; x.fill(); outline(x, INK, 0.9);
    x.beginPath(); x.moveTo(-7, -14); x.lineTo(7, -14); x.lineTo(0, -3); x.closePath(); x.fillStyle = '#8ae0ff'; x.fill();
    x.beginPath(); x.moveTo(-9, 20); x.quadraticCurveTo(0, 9, 9, 20); x.closePath(); x.fill();
    x.restore(); sparkle(x, 50, 52, 7);
  },
  feather(x, R) {
    glow(x, 50, 50, 40, '#ffe8a0', 0.6);
    x.save(); x.translate(26, 84); x.rotate(-0.85);
    x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(8, -14, 30, -18, 66, -2); x.bezierCurveTo(30, 12, 8, 10, 0, 0); x.closePath();
    x.fillStyle = lg(x, 0, -14, 0, 10, [[0, '#ffffff'], [0.5, '#ffe8b0'], [1, '#c09040']]); x.fill(); outline(x, 'rgba(90,60,10,.8)', 1);
    x.strokeStyle = 'rgba(150,110,40,.7)'; x.lineWidth = 0.6; for (let i = 1; i < 9; i++) { const px = i * 7; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + 5, -9 + i * 0.4); x.moveTo(px, 0); x.lineTo(px + 5, 7 - i * 0.3); x.stroke(); }
    x.strokeStyle = '#8a6a2a'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(-6, 2); x.lineTo(62, -1); x.stroke();
    x.restore();
    sparkle(x, 66, 34, 8); sparkle(x, 36, 44, 5);
  },
  // ---- trade goods
  herb(x, R) {
    for (const [a, l, c] of [[-2.1, 38, '#5ab040'], [-1.7, 44, '#6ac850'], [-1.3, 40, '#4a9a38'], [-1.0, 32, '#7ad060'], [-2.4, 30, '#5aa848']]) leaf(x, 50, 84, l, 7, a, c);
    x.fillStyle = lg(x, 42, 0, 58, 0, [[0, '#8a6a3a'], [1, '#4a3418']]); x.fillRect(44, 74, 12, 6); outline(x, INK, 0.7); x.strokeRect(44, 74, 12, 6);
  },
  flower(x, R) {
    x.strokeStyle = '#3a7a2a'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(50, 92); x.quadraticCurveTo(46, 70, 50, 50); x.stroke();
    leaf(x, 48, 76, 20, 6, -2.6, '#4aa038'); leaf(x, 49, 70, 18, 5, -0.5, '#5ab048');
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.save(); x.translate(50, 40); x.rotate(a); x.beginPath(); x.ellipse(0, -10, 7, 11, 0, 0, TAU); x.fillStyle = rg(x, 0, -6, 1, 14, [[0, '#ffffff'], [0.4, '#ff9ad0'], [1, '#c02a70']]); x.fill(); outline(x, INK, 0.8); x.restore(); }
    circle(x, 50, 40, 6); x.fillStyle = rg(x, 48, 38, 0, 6, [[0, '#fff8c0'], [1, '#e0a020']]); x.fill(); outline(x, INK, 0.7);
  },
  timber(x, R) {
    for (const [cx, cy] of [[34, 66], [66, 66], [50, 44]]) {
      x.save(); x.translate(cx, cy);
      x.beginPath(); x.moveTo(-26, -11); x.lineTo(14, -11); x.lineTo(14, 11); x.lineTo(-26, 11); x.closePath(); x.fillStyle = lg(x, 0, -11, 0, 11, [[0, '#a0703a'], [0.5, '#6a4420'], [1, '#2a1808']]); x.fill(); outline(x, INK, 1);
      x.strokeStyle = 'rgba(40,20,5,.5)'; x.lineWidth = 0.7; for (const yy of [-6, 0, 5]) { x.beginPath(); x.moveTo(-24, yy); x.lineTo(12, yy + 1); x.stroke(); }
      ellipse(x, 14, 0, 7, 11); x.fillStyle = rg(x, 14, 0, 1, 11, [[0, '#f0d8a8'], [0.6, '#c89a60'], [1, '#6a4420']]); x.fill(); outline(x, INK, 1);
      x.strokeStyle = 'rgba(120,80,30,.6)'; x.lineWidth = 0.6; for (const r of [3, 6]) { ellipse(x, 14, 0, r * 0.6, r); x.stroke(); }
      x.restore();
    }
  },
  ore(x, R) { rock(x, R, 50, 58, 38, 30, ['#c0c0cc', '#6a6a78', '#22222a']); for (let i = 0; i < 7; i++) { const px = 30 + R() * 40, py = 44 + R() * 26; x.fillStyle = metalRG(x, px, py, 3, 'silver'); circle(x, px, py, 1.8 + R() * 1.6); x.fill(); } sparkle(x, 40, 44, 5); },
  gem_ore(x, R) { rock(x, R, 50, 64, 34, 22, ['#8a7a70', '#4a3a34', '#18100c']); crystal(x, 42, 62, 26, 10, -PI / 2 - 0.35, '#c050ff', { glowA: 0.3 }); crystal(x, 58, 64, 30, 11, -PI / 2 + 0.25, '#40c0ff', { glowA: 0.3 }); crystal(x, 50, 66, 18, 8, -PI / 2, '#ff4a8a', { glowA: 0.3 }); },
  fish(x, R) {
    x.save(); x.translate(50, 52); x.rotate(-0.25);
    x.beginPath(); x.moveTo(-32, 0); x.bezierCurveTo(-20, -18, 14, -18, 26, -2); x.lineTo(38, -12); x.lineTo(36, 0); x.lineTo(38, 12); x.lineTo(26, 2); x.bezierCurveTo(14, 18, -20, 18, -32, 0); x.closePath();
    x.fillStyle = lg(x, 0, -16, 0, 16, [[0, '#3a6a8a'], [0.45, '#9ad0e0'], [0.6, '#e8f4f8'], [1, '#8aa0a8']]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = 'rgba(30,60,80,.5)'; x.lineWidth = 0.7; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(-10 + i * 6, 0, 5, -0.8, 0.8); x.stroke(); }
    x.fillStyle = '#ffffff'; circle(x, -22, -3, 3.2); x.fill(); outline(x, INK, 0.6); x.fillStyle = '#101820'; circle(x, -22, -3, 1.6); x.fill();
    x.fillStyle = '#6a9ab0'; poly(x, [[-4, -12], [8, -20], [10, -12]]); x.fill(); outline(x, INK, 0.7);
    x.restore();
  },
  meat(x, R) {
    x.save(); x.translate(46, 56); x.rotate(-0.5);
    x.fillStyle = lg(x, 20, -4, 40, 4, [[0, '#fff8e8'], [1, '#c8b890']]); x.beginPath(); x.roundRect(16, -3.5, 22, 7, 3); x.fill(); outline(x, INK, 0.9);
    for (const s of [-1, 1]) { circle(x, 40, s * 4.5, 4.6); x.fill(); outline(x, INK, 0.8); }
    x.beginPath(); x.moveTo(18, -6); x.bezierCurveTo(10, -26, -26, -26, -28, -2); x.bezierCurveTo(-28, 20, 8, 24, 18, 6); x.closePath();
    x.fillStyle = rg(x, -8, -8, 2, 30, [[0, '#ff9a8a'], [0.5, '#c8404a'], [1, '#5a0e14']]); x.fill(); outline(x, INK, 1.2);
    x.strokeStyle = 'rgba(255,230,220,.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-18, -10); x.quadraticCurveTo(-6, -2, 6, -12); x.stroke(); x.beginPath(); x.moveTo(-20, 6); x.quadraticCurveTo(-6, 10, 8, 4); x.stroke();
    x.restore();
  },
  relic_shard(x, R) {
    glow(x, 50, 50, 34, '#40e0c0', 0.4);
    poly(x, [[30, 20], [70, 16], [82, 44], [70, 84], [36, 80], [20, 50]]); x.fillStyle = rg(x, 40, 34, 2, 50, [[0, '#c8c0a8'], [0.5, '#7a7260'], [1, '#2a2618']]); x.fill(); outline(x, INK, 1.3);
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 1; x.beginPath(); x.moveTo(30, 20); x.lineTo(44, 40); x.lineTo(36, 80); x.stroke();
    glowPath(x, xx => { xx.beginPath(); xx.arc(56, 50, 12, 0, TAU); xx.moveTo(56, 34); xx.lineTo(56, 66); xx.moveTo(44, 44); xx.lineTo(68, 56); }, '#60f0d0', 1.4);
  },
  // ---- food (1 bread, 2 grilled fish skewer, 3 hearty stew, 4 feast roast)
  food_1(x, R) {
    x.beginPath(); x.ellipse(50, 60, 34, 20, -0.15, 0, TAU); x.fillStyle = rg(x, 40, 48, 2, 40, [[0, '#f8d898'], [0.5, '#c88a40'], [1, '#6a3a10']]); x.fill(); outline(x, INK, 1.2);
    x.strokeStyle = 'rgba(255,240,200,.8)'; x.lineWidth = 2; for (const px of [34, 48, 62]) { x.beginPath(); x.moveTo(px - 4, 52); x.quadraticCurveTo(px, 46, px + 6, 50); x.stroke(); }
    for (let i = 0; i < 10; i++) { x.fillStyle = '#fff4d8'; ellipse(x, 30 + R() * 40, 46 + R() * 16, 0.9, 0.5, R()); x.fill(); }
  },
  food_2(x, R) {
    x.strokeStyle = metalLG(x, 14, 80, 88, 20, 'iron'); x.lineWidth = 2; x.beginPath(); x.moveTo(12, 88); x.lineTo(88, 12); x.stroke();
    for (const [cx, cy] of [[34, 66], [56, 44]]) { x.save(); x.translate(cx, cy); x.rotate(-PI / 4); x.beginPath(); x.ellipse(0, 0, 13, 9, 0, 0, TAU); x.fillStyle = rg(x, -3, -3, 1, 14, [[0, '#f0c070'], [0.6, '#b06a2a'], [1, '#4a2208']]); x.fill(); outline(x, INK, 1); x.strokeStyle = 'rgba(40,10,0,.7)'; x.lineWidth = 1.4; for (const dx of [-5, 0, 5]) { x.beginPath(); x.moveTo(dx - 2, -7); x.lineTo(dx + 2, 7); x.stroke(); } x.restore(); }
    x.save(); x.translate(76, 24); x.rotate(-PI / 4); leaf(x, 0, 0, 12, 4, 0, '#6ab040'); x.restore();
    smoke(x, R, 5, 50, 30, 20, '#c8c8c8', 0.25, 7);
  },
  food_3(x, R) {
    smoke(x, R, 5, 50, 28, 18, '#d8d8d8', 0.25, 8);
    x.beginPath(); x.moveTo(18, 52); x.bezierCurveTo(20, 82, 80, 82, 82, 52); x.closePath(); x.fillStyle = rg(x, 40, 60, 2, 40, [[0, '#b07a4a'], [0.6, '#6a4020'], [1, '#2a1608']]); x.fill(); outline(x, INK, 1.2);
    ellipse(x, 50, 52, 32, 9); x.fillStyle = rg(x, 46, 50, 2, 32, [[0, '#e8a060'], [0.6, '#b0602a'], [1, '#6a3010']]); x.fill(); outline(x, INK, 1);
    for (const [px, py, c] of [[40, 50, '#f0d080'], [56, 52, '#e06a3a'], [48, 55, '#80c050'], [62, 48, '#f0d080']]) { x.fillStyle = c; ellipse(x, px, py, 3.4, 2); x.fill(); outline(x, INK, 0.5); }
    x.strokeStyle = metalLG(x, 60, 30, 80, 50, 'silver'); x.lineWidth = 2.4; x.beginPath(); x.moveTo(62, 50); x.lineTo(80, 28); x.stroke();
  },
  food_4(x, R) {
    // platter with a roast
    ellipse(x, 50, 70, 40, 14); x.fillStyle = metalLG(x, 10, 60, 90, 84, 'silver'); x.fill(); outline(x, INK, 1.2);
    ellipse(x, 50, 68, 32, 10); x.fillStyle = 'rgba(0,0,0,.25)'; x.fill();
    x.beginPath(); x.ellipse(50, 58, 26, 16, 0, 0, TAU); x.fillStyle = rg(x, 42, 50, 2, 30, [[0, '#f8c070'], [0.5, '#b0602a'], [1, '#4a1a06']]); x.fill(); outline(x, INK, 1.2);
    for (const s of [-1, 1]) { x.save(); x.translate(50 + s * 22, 50); x.rotate(s * -0.6); x.fillStyle = '#fff4e0'; x.fillRect(-2, -12, 4, 12); circle(x, 0, -13, 3); x.fill(); outline(x, INK, 0.6); x.restore(); }
    for (const [px, py] of [[28, 70], [72, 70]]) { x.fillStyle = '#6ab040'; circle(x, px, py, 4); x.fill(); outline(x, INK, 0.5); }
    x.fillStyle = '#e03a2a'; circle(x, 60, 72, 3); x.fill(); circle(x, 40, 73, 2.6); x.fill();
    smoke(x, R, 5, 50, 30, 20, '#d8d8d8', 0.25, 8);
  },
  // ---- gifts (1 wrapped box, 2 perfume, 3 music box, 4 golden statuette)
  gift_1(x, R) {
    box(x, 46, 60, 44, 34, 12, '#3a6ac8');
    x.fillStyle = lg(x, 40, 0, 52, 0, [[0, '#ffd070'], [1, '#c08a20']]); x.fillRect(42, 43, 8, 34); poly(x, [[24, 43], [68, 43], [80, 36], [36, 36]], true); x.save(); x.clip(); x.fillRect(42, 30, 8, 20); x.restore();
    x.strokeStyle = INK; x.lineWidth = 0.6; x.strokeRect(42, 43, 8, 34);
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(52 + s * 8, 30, 8, 5, s * 0.5, 0, TAU); x.fillStyle = '#ffc850'; x.fill(); outline(x, INK, 0.8); }
    circle(x, 52, 32, 3.4); x.fillStyle = '#e0a020'; x.fill(); outline(x, INK, 0.7);
  },
  gift_2(x, R) {
    glow(x, 50, 56, 34, '#ff9ad0', 0.4);
    x.beginPath(); x.moveTo(40, 40); x.lineTo(60, 40); x.bezierCurveTo(78, 44, 80, 84, 60, 88); x.lineTo(40, 88); x.bezierCurveTo(20, 84, 22, 44, 40, 40); x.closePath();
    x.fillStyle = rg(x, 42, 56, 2, 36, [[0, '#ffffff'], [0.3, '#ffc0e0'], [0.8, '#d04a90'], [1, '#6a1040']]); x.fill(); outline(x, INK, 1.2);
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(33, 52); x.bezierCurveTo(30, 62, 31, 74, 35, 82); x.stroke();
    x.fillStyle = metalLG(x, 42, 30, 58, 40, 'gold'); x.beginPath(); x.roundRect(43, 32, 14, 9, 2); x.fill(); outline(x, INK, 0.8);
    circle(x, 50, 24, 8); x.fillStyle = rg(x, 47, 21, 1, 9, [[0, '#ffffff'], [1, '#e070b0']]); x.fill(); outline(x, INK, 0.9);
  },
  gift_3(x, R) {
    box(x, 46, 66, 50, 24, 12, '#6a3a1a', '#8a5028');
    // open lid
    poly(x, [[21, 54], [71, 54], [84, 28], [34, 28]]); x.fillStyle = lg(x, 21, 28, 84, 54, [[0, '#a06a3a'], [1, '#4a2a10']]); x.fill(); outline(x, INK, 1);
    x.strokeStyle = metalLG(x, 21, 28, 84, 54, 'gold'); x.lineWidth = 1.6; poly(x, [[25, 52], [69, 52], [80, 30], [37, 30]]); x.stroke();
    for (const [px, py, c] of [[40, 40, '#ffd060'], [64, 36, '#8ae0ff']]) note(x, px, py, 0.6, c, 0);
    x.fillStyle = metalRG(x, 46, 64, 5, 'gold'); circle(x, 46, 64, 3.4); x.fill(); outline(x, INK, 0.6);
  },
  gift_4(x, R) {
    glow(x, 50, 50, 40, '#ffd070', 0.5);
    // golden statuette of a Pip on a plinth
    x.fillStyle = metalLG(x, 26, 76, 74, 90, 'dark'); x.beginPath(); x.roundRect(28, 76, 44, 12, 2); x.fill(); outline(x, INK, 1);
    x.fillStyle = metalLG(x, 30, 72, 70, 78, 'gold'); x.fillRect(30, 72, 40, 5); x.strokeStyle = INK; x.lineWidth = 0.8; x.strokeRect(30, 72, 40, 5);
    circle(x, 50, 50, 21); x.fillStyle = metalRG(x, 50, 50, 24, 'gold'); x.fill(); outline(x, INK, 1.2);
    leaf(x, 50, 30, 18, 6, -PI / 2 - 0.5, '#e8b030');
    for (const s of [-1, 1]) { x.fillStyle = '#3a2408'; ellipse(x, 50 + s * 7, 50, 2.4, 3.2); x.fill(); }
    sparkle(x, 40, 40, 7);
  },
  // ---- collectibles
  island_soul(x, R) {
    glow(x, 50, 50, 42, '#40e0d0', 0.6);
    circle(x, 50, 50, 28); x.fillStyle = rg(x, 42, 40, 2, 32, [[0, '#e8fffc'], [0.4, '#60e0d0'], [1, '#0a4a50']]); x.fill(); outline(x, INK, 1.2);
    x.save(); circle(x, 50, 50, 27); x.clip();
    x.fillStyle = 'rgba(10,60,70,.7)'; x.beginPath(); x.moveTo(20, 62); x.quadraticCurveTo(50, 54, 80, 62); x.lineTo(80, 80); x.lineTo(20, 80); x.closePath(); x.fill();
    x.fillStyle = '#2a6a3a'; x.beginPath(); x.moveTo(38, 60); x.quadraticCurveTo(50, 44, 62, 60); x.closePath(); x.fill();
    x.strokeStyle = '#5a3a1a'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(52, 56); x.quadraticCurveTo(54, 46, 50, 40); x.stroke(); leaf(x, 50, 40, 8, 3, -2.4, '#4ab048'); leaf(x, 50, 40, 8, 3, -0.6, '#4ab048');
    x.restore();
    glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.04) { const a = t * TAU * 1.2, r = 30 + t * 6; const px = 50 + Math.cos(a) * r, py = 50 + Math.sin(a) * r * 0.5; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, '#a0fff4', 1);
    sparkle(x, 40, 38, 7);
  },
  giants_heart(x, R) {
    glow(x, 50, 52, 42, '#ff7a3a', 0.6);
    x.beginPath(); x.moveTo(50, 86); x.bezierCurveTo(20, 66, 14, 40, 30, 28); x.bezierCurveTo(40, 22, 48, 28, 50, 34); x.bezierCurveTo(52, 28, 60, 22, 70, 28); x.bezierCurveTo(86, 40, 80, 66, 50, 86); x.closePath();
    x.fillStyle = rg(x, 40, 40, 2, 44, [[0, '#ffe0a0'], [0.3, '#ff8a3a'], [0.75, '#a02a10'], [1, '#3a0a04']]); x.fill(); outline(x, INK, 1.3);
    // crystal facets
    x.strokeStyle = 'rgba(255,230,180,.55)'; x.lineWidth = 1; poly(x, [[50, 34], [42, 50], [50, 86]], false); x.stroke(); poly(x, [[42, 50], [24, 44]], false); x.stroke(); poly(x, [[42, 50], [58, 56], [76, 44]], false); x.stroke(); poly(x, [[58, 56], [50, 86]], false); x.stroke();
    sparkle(x, 36, 38, 8);
  },
  masterpiece(x, R) {
    x.fillStyle = metalLG(x, 12, 16, 88, 84, 'gold'); x.beginPath(); x.roundRect(12, 18, 76, 64, 3); x.fill(); outline(x, INK, 1.2);
    x.fillStyle = rg(x, 40, 36, 2, 50, [[0, '#ffd8a0'], [0.5, '#e08a50'], [1, '#6a3a2a']]); x.fillRect(20, 26, 60, 48);
    x.fillStyle = '#3a5a3a'; x.beginPath(); x.moveTo(20, 74); x.lineTo(20, 56); x.lineTo(36, 44); x.lineTo(50, 58); x.lineTo(62, 48); x.lineTo(80, 60); x.lineTo(80, 74); x.closePath(); x.fill();
    x.fillStyle = '#fff4c0'; circle(x, 64, 36, 6); x.fill();
    x.strokeStyle = INK; x.lineWidth = 1; x.strokeRect(20, 26, 60, 48);
    for (const [px, py] of [[12, 18], [88, 18], [12, 82], [88, 82]]) rivet(x, px, py, 2.4, 'gold');
  },
  omnium_star(x, R) {
    glow(x, 50, 50, 42, '#ffd040', 0.7);
    star(x, 50, 52, 5, 14, 34); x.fillStyle = lg(x, 26, 22, 74, 80, [[0, '#ffffff'], [0.35, '#ffe070'], [0.75, '#e0a020'], [1, '#8a5a08']]); x.fill(); outline(x, INK, 1.3);
    for (let i = 0; i < 5; i++) { const a = -PI / 2 + i / 5 * TAU; x.strokeStyle = 'rgba(120,70,0,.55)'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(50, 52); x.lineTo(50 + Math.cos(a) * 34, 52 + Math.sin(a) * 34); x.stroke(); }
    sparkle(x, 42, 42, 8);
  },
  sea_bounty(x, R) {
    // message bottle with a bounty scroll
    x.save(); x.translate(50, 52); x.rotate(-0.6);
    x.beginPath(); x.moveTo(-8, -34); x.lineTo(8, -34); x.lineTo(8, -24); x.bezierCurveTo(18, -20, 18, 30, 14, 34); x.lineTo(-14, 34); x.bezierCurveTo(-18, 30, -18, -20, -8, -24); x.closePath();
    x.fillStyle = rg(x, -4, 0, 2, 34, [[0, 'rgba(200,255,230,.5)'], [0.7, 'rgba(60,160,130,.55)'], [1, 'rgba(20,70,60,.7)']]); x.fill(); outline(x, INK, 1.2);
    x.fillStyle = lg(x, -8, 0, 8, 0, [[0, '#c8a060'], [0.5, '#fff0c8'], [1, '#a07a40']]); x.beginPath(); x.roundRect(-7, -14, 14, 36, 4); x.fill(); outline(x, INK, 0.7);
    x.fillStyle = '#b01a1a'; x.fillRect(-7.5, 2, 15, 3);
    x.fillStyle = lg(x, -7, 0, 7, 0, [[0, '#5a3414'], [0.4, '#c08a50'], [1, '#3a200a']]); x.beginPath(); x.roundRect(-6, -42, 12, 9, 2); x.fill(); outline(x, INK, 0.8);
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-11, -16); x.bezierCurveTo(-14, -2, -14, 16, -11, 28); x.stroke();
    x.restore();
    for (let i = 0; i < 3; i++) glowPath(x, xx => { xx.beginPath(); xx.moveTo(14 + i * 26, 88); xx.quadraticCurveTo(24 + i * 26, 82, 34 + i * 26, 88); }, '#8ae0ff', 1);
  },
  world_leaf(x, R) {
    glow(x, 50, 50, 42, '#b0ff60', 0.6);
    leaf(x, 22, 80, 68, 20, -PI / 4, '#8ae040');
    glowPath(x, xx => { xx.beginPath(); xx.moveTo(24, 78); xx.lineTo(70, 32); }, '#f0ffb0', 1);
    sparkle(x, 64, 30, 8); sparkle(x, 40, 50, 5);
  },
  pip_seed(x, R) {
    glow(x, 50, 56, 36, '#c8f080', 0.45);
    // the Pip mascot seed: round body, sprout leaf, big eyes
    circle(x, 50, 60, 24); x.fillStyle = rg(x, 42, 50, 2, 28, [[0, '#fff8d8'], [0.5, '#e8c878'], [1, '#8a6a2a']]); x.fill(); outline(x, INK, 1.3);
    x.strokeStyle = '#3a7a2a'; x.lineWidth = 2; x.beginPath(); x.moveTo(50, 37); x.quadraticCurveTo(50, 28, 54, 24); x.stroke();
    leaf(x, 54, 24, 20, 7, -0.5, '#6ac850'); leaf(x, 51, 28, 14, 5, -2.5, '#5ab040');
    for (const s of [-1, 1]) { x.fillStyle = '#1a1208'; ellipse(x, 50 + s * 8, 60, 3.6, 4.6); x.fill(); x.fillStyle = '#ffffff'; circle(x, 50 + s * 8 - 1.2, 58.2, 1.4); x.fill(); }
    x.fillStyle = 'rgba(255,120,120,.5)'; ellipse(x, 36, 67, 3.4, 2); x.fill(); ellipse(x, 64, 67, 3.4, 2); x.fill();
    x.strokeStyle = '#3a2008'; x.lineWidth = 1.2; x.beginPath(); x.arc(50, 66, 3.4, 0.3, PI - 0.3); x.stroke();
  },
  // ---- misc
  card_pack(x, R) {
    glow(x, 50, 50, 38, '#c080ff', 0.4);
    for (const [dx, a, c] of [[-10, -0.25, '#3a2a6a'], [8, 0.2, '#6a2a4a']]) { x.save(); x.translate(50 + dx, 46); x.rotate(a); x.beginPath(); x.roundRect(-14, -22, 28, 40, 3); x.fillStyle = lg(x, -14, -22, 14, 18, [[0, shade(c, 0.4)], [1, c]]); x.fill(); outline(x, INK, 1); x.strokeStyle = metalLG(x, -14, -22, 14, 18, 'gold'); x.lineWidth = 1; x.strokeRect(-11, -19, 22, 34); x.restore(); }
    x.beginPath(); x.moveTo(24, 50); x.lineTo(76, 50); x.lineTo(78, 88); x.lineTo(22, 88); x.closePath(); x.fillStyle = lg(x, 22, 50, 78, 88, [[0, '#8a5ac0'], [0.5, '#4a2a7a'], [1, '#1a0a30']]); x.fill(); outline(x, INK, 1.2);
    x.strokeStyle = metalLG(x, 22, 50, 78, 88, 'gold'); x.lineWidth = 1.6; x.beginPath(); x.moveTo(26, 56); x.lineTo(74, 56); x.stroke();
    waxSeal(x, 50, 70, 8, '#c02a2a');
    star(x, 50, 70, 5, 2, 5); x.fillStyle = '#ffd070'; x.fill();
  },
  mount_whistle(x, R) {
    x.strokeStyle = '#6a3a1a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(70, 44); x.bezierCurveTo(88, 30, 80, 12, 60, 16); x.stroke();
    x.save(); x.translate(46, 56); x.rotate(-0.5);
    x.beginPath(); x.moveTo(-26, -5); x.lineTo(10, -6); x.bezierCurveTo(22, -12, 30, -4, 28, 6); x.bezierCurveTo(26, 16, 12, 16, 8, 8); x.lineTo(-26, 5); x.closePath();
    x.fillStyle = metalLG(x, -26, -10, 28, 14, 'brass'); x.fill(); outline(x, INK, 1.1);
    x.fillStyle = '#1a1008'; x.fillRect(-10, -6, 6, 3); ellipse(x, 18, 4, 5, 5); x.fill();
    x.fillStyle = metalRG(x, 26, -2, 4, 'gold'); circle(x, 26, -8, 3); x.fill(); outline(x, INK, 0.6);
    x.restore();
    sparkle(x, 24, 40, 5);
  },
  pet_charm(x, R) {
    x.strokeStyle = '#8a5a2a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(50, 26); x.lineTo(50, 12); x.stroke(); x.lineWidth = 2; x.strokeStyle = metalLG(x, 44, 6, 56, 16, 'gold'); circle(x, 50, 10, 4); x.stroke();
    circle(x, 50, 56, 28); x.fillStyle = metalRG(x, 50, 56, 32, 'gold'); x.fill(); outline(x, INK, 1.2);
    circle(x, 50, 56, 22); x.fillStyle = rg(x, 44, 50, 2, 24, [[0, '#ffd8e8'], [1, '#c05a8a']]); x.fill(); outline(x, INK, 0.8);
    x.fillStyle = '#ffffff'; ellipse(x, 50, 62, 8, 7); x.fill(); for (const [px, py] of [[40, 50], [46, 44], [54, 44], [60, 50]]) { ellipse(x, px, py, 3.4, 4); x.fill(); }
  },
  chest(x, R) {
    // treasure chest, lid slightly open with light
    glow(x, 50, 50, 36, '#ffd070', 0.5);
    x.beginPath(); x.moveTo(16, 50); x.lineTo(84, 50); x.lineTo(84, 84); x.lineTo(16, 84); x.closePath(); x.fillStyle = lg(x, 16, 50, 84, 84, [[0, '#a06a34'], [1, '#3a200a']]); x.fill(); outline(x, INK, 1.2);
    x.beginPath(); x.moveTo(16, 50); x.bezierCurveTo(16, 26, 84, 26, 84, 50); x.closePath(); x.fillStyle = lg(x, 16, 28, 84, 50, [[0, '#c08040'], [1, '#5a3010']]); x.fill(); outline(x, INK, 1.2);
    add(x); x.fillStyle = lg(x, 0, 44, 0, 54, [[0, 'rgba(255,230,140,0)'], [0.5, 'rgba(255,230,140,.9)'], [1, 'rgba(255,230,140,0)']]); x.fillRect(18, 46, 64, 6); norm(x);
    for (const px of [24, 76]) { x.fillStyle = metalLG(x, px - 3, 30, px + 3, 84, 'gold'); x.fillRect(px - 3, 32, 6, 52); x.strokeStyle = INK; x.lineWidth = 0.7; x.strokeRect(px - 3, 32, 6, 52); }
    x.fillStyle = metalLG(x, 44, 52, 56, 66, 'gold'); x.beginPath(); x.roundRect(44, 52, 12, 14, 2); x.fill(); outline(x, INK, 0.8);
    x.fillStyle = '#1a0a02'; circle(x, 50, 58, 1.6); x.fill(); x.fillRect(49.3, 58, 1.4, 4);
  },
  key(x, R) {
    glow(x, 50, 50, 34, '#ffd070', 0.4);
    x.save(); x.translate(50, 50); x.rotate(-PI / 4); x.scale(1.35, 1.35);
    x.lineWidth = 5; x.strokeStyle = metalLG(x, -30, -10, -6, 10, 'gold'); circle(x, -22, 0, 10); x.stroke(); outline(x, INK, 0.6);
    x.fillStyle = metalLG(x, 0, -3, 0, 3, 'gold'); x.fillRect(-12, -3, 44, 6); outline(x, INK, 0.6); x.strokeRect(-12, -3, 44, 6);
    x.fillRect(22, 3, 5, 9); x.fillRect(30, 3, 4, 7); x.strokeRect(22, 3, 5, 9); x.strokeRect(30, 3, 4, 7);
    gem(x, -22, 0, 4, '#ff3a4a', { n: 6, spark: false, glowA: 0.5, lw: 0.5 });
    x.restore();
  },
  map(x, R) {
    x.save(); x.translate(50, 52); x.rotate(-0.08);
    x.beginPath(); x.moveTo(-36, -26); for (let i = 1; i <= 6; i++) x.lineTo(-36 + i * 12, -26 + (i % 2 ? 3 : 0)); x.lineTo(36, 26); for (let i = 5; i >= 0; i--) x.lineTo(-36 + i * 12, 26 + (i % 2 ? 3 : 0)); x.closePath();
    x.fillStyle = rg(x, -10, -10, 2, 50, [[0, '#fff0c8'], [0.6, '#dcc08a'], [1, '#8a6a38']]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 0.8; for (const px of [-12, 12]) { x.beginPath(); x.moveTo(px, -26); x.lineTo(px, 28); x.stroke(); }
    x.fillStyle = 'rgba(90,120,70,.6)'; x.beginPath(); x.moveTo(-28, 6); x.bezierCurveTo(-20, -18, 8, -14, 10, 2); x.bezierCurveTo(12, 16, -20, 20, -28, 6); x.closePath(); x.fill();
    x.strokeStyle = '#8a2a10'; x.lineWidth = 1.2; x.setLineDash([2, 2]); x.beginPath(); x.moveTo(-22, 12); x.bezierCurveTo(-8, 18, 6, -6, 18, -6); x.stroke(); x.setLineDash([]);
    x.strokeStyle = '#c01a10'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(15, -11); x.lineTo(25, -1); x.moveTo(25, -11); x.lineTo(15, -1); x.stroke();
    x.restore();
  },
  coin_pirate(x, R) { coin(x, 50, 52, 30, 'gold', { emblem: false }); x.save(); x.translate(50, 50); skull(x, 0.72, { bone: ['#8a5a10', '#6a4008', '#4a2a04', '#2a1802'] }); x.restore(); },
  skill_potion(x, R) { vial(x, 50, 52, 1.25, '#6a7aff', 'silver'); star(x, 50, 58, 4, 3, 8); x.fillStyle = '#ffffff'; x.fill(); sparkle(x, 64, 38, 6); },
  scroll(x, R) {
    x.save(); x.translate(50, 50); x.rotate(-0.4);
    x.fillStyle = lg(x, 0, -14, 0, 14, [[0, '#fff4d8'], [0.6, '#e0c898'], [1, '#9a7a48']]); x.fillRect(-28, -14, 56, 28); outline(x, INK, 1); x.strokeRect(-28, -14, 56, 28);
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 30, 0, 5, 16, 0, 0, TAU); x.fillStyle = lg(x, s * 30 - 5, 0, s * 30 + 5, 0, [[0, '#c8a868'], [0.5, '#fff0c8'], [1, '#8a6a38']]); x.fill(); outline(x, INK, 1); x.fillStyle = '#5a3414'; x.fillRect(s * 30 - 2, -19, 4, 4); x.fillRect(s * 30 - 2, 15, 4, 4); }
    x.fillStyle = '#b01a2a'; x.fillRect(-4, -14, 8, 28);
    waxSeal(x, 0, 6, 6, '#c02a2a');
    x.restore();
  },
  quest(x, R) {
    parchment(x, 50, 54, 52, 60);
    x.fillStyle = lg(x, 40, 30, 60, 70, [[0, '#ffe070'], [1, '#c08a10']]);
    x.beginPath(); x.moveTo(45, 32); x.lineTo(55, 32); x.lineTo(53, 62); x.lineTo(47, 62); x.closePath(); x.fill(); outline(x, INK, 1);
    circle(x, 50, 71, 4.4); x.fill(); outline(x, INK, 1);
    glow(x, 50, 54, 22, '#ffd040', 0.4);
  },
  // ---- extra materials & consumables (src/data/items.js)
  horn_shard(x, R) {
    glow(x, 50, 56, 40, '#ff3a3a', 0.5);
    x.save(); x.translate(18, 88); x.rotate(-0.78); x.scale(1.3, 1.3);
    ribbon(x, bez([0, 0], [10, -6], [30, -8], [62, 4]), t => 22 * (1 - t * 0.85) + 1, 24);
    x.fillStyle = lg(x, 0, -12, 62, 8, [[0, '#4a2a1e'], [0.35, '#b8a288'], [0.8, '#f0e4d0'], [1, '#ffffff']]); x.fill(); outline(x, INK, 1.2);
    x.strokeStyle = 'rgba(70,40,20,.6)'; x.lineWidth = 0.8; for (let i = 1; i < 7; i++) { const p = bez([0, 0], [10, -6], [30, -8], [62, 4])(i / 8), w = (22 * (1 - (i / 8) * 0.85) + 1) / 2; x.beginPath(); x.moveTo(p[0] - 1, p[1] - w); x.lineTo(p[0] + 1, p[1] + w); x.stroke(); }
    // jagged broken end with a crimson glow
    poly(x, [[-2, -11], [4, -4], [-1, 2], [3, 9], [-3, 11]]); x.fillStyle = '#2a0808'; x.fill();
    glowPath(x, xx => poly(xx, [[-2, -11], [4, -4], [-1, 2], [3, 9], [-3, 11]], false), '#ff3a2a', 1.4);
    x.restore();
    embers(x, R, 8, 30, 76, 14, ['#ff5a3a', '#ffb070']);
  },
  resin(x, R) {
    glow(x, 50, 54, 34, '#ffb030', 0.5);
    x.beginPath(); x.moveTo(30, 40); x.bezierCurveTo(34, 22, 62, 20, 70, 36); x.bezierCurveTo(80, 50, 76, 76, 56, 82); x.bezierCurveTo(36, 88, 20, 70, 24, 56); x.bezierCurveTo(26, 50, 28, 46, 30, 40); x.closePath();
    x.fillStyle = rg(x, 42, 40, 2, 40, [[0, '#fff0b0'], [0.35, '#ffb838'], [0.8, '#a05a08'], [1, '#4a2402']]); x.fill(); outline(x, INK, 1.2);
    x.fillStyle = 'rgba(255,255,255,.55)'; ellipse(x, 42, 36, 8, 4, -0.5); x.fill();
    for (const [px, py, r] of [[56, 60, 2], [46, 66, 1.4], [60, 48, 1.2]]) { x.strokeStyle = 'rgba(255,240,200,.7)'; x.lineWidth = 0.7; circle(x, px, py, r); x.stroke(); }
    x.save(); x.translate(50, 56); x.rotate(0.4); x.fillStyle = 'rgba(60,30,5,.75)'; ellipse(x, 0, 0, 4, 1.6); x.fill(); x.strokeStyle = 'rgba(60,30,5,.6)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(-2, 0); x.lineTo(-5, -4); x.moveTo(2, 0); x.lineTo(5, -4); x.stroke(); x.restore();
  },
  heartwood(x, R) {
    glow(x, 50, 50, 38, '#ffc860', 0.45);
    x.beginPath(); x.moveTo(16, 42); x.lineTo(62, 30); x.lineTo(70, 64); x.lineTo(24, 76); x.closePath(); x.fillStyle = lg(x, 16, 30, 70, 76, [[0, '#8a5a30'], [0.5, '#5a3418'], [1, '#2a1606']]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = 'rgba(30,14,4,.5)'; x.lineWidth = 0.8; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(16 + i * 2, 42 + i * 8.5); x.lineTo(62 + i * 2, 30 + i * 8.5); x.stroke(); }
    x.save(); x.translate(66, 47); x.rotate(-0.26); ellipse(x, 0, 0, 10, 18); x.fillStyle = rg(x, 0, 0, 1, 18, [[0, '#fff4c0'], [0.3, '#ffd070'], [0.7, '#c08a40'], [1, '#6a4420']]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = 'rgba(120,70,20,.6)'; x.lineWidth = 0.6; for (const r of [4, 8, 12]) { ellipse(x, 0, 0, r * 0.55, r); x.stroke(); }
    glow(x, 0, 0, 10, '#fff0a0', 0.9); x.restore();
  },
  starsteel(x, R) {
    glow(x, 50, 52, 38, '#8ab0ff', 0.45);
    rock(x, R, 50, 58, 36, 28, ['#6a7090', '#2a2e44', '#0a0c16']);
    for (let i = 0; i < 9; i++) { const px = 30 + R() * 40, py = 42 + R() * 30; glow(x, px, py, 4, '#c0d8ff', 0.8); x.fillStyle = '#ffffff'; circle(x, px, py, 0.9); x.fill(); }
    x.save(); x.translate(56, 46); star(x, 0, 0, 4, 3, 11); x.fillStyle = '#ffffff'; x.fill(); glow(x, 0, 0, 14, '#9ac0ff', 0.9); x.restore();
  },
  hide(x, R) {
    x.beginPath(); x.moveTo(22, 26); x.quadraticCurveTo(34, 18, 44, 24); x.quadraticCurveTo(50, 14, 58, 24); x.quadraticCurveTo(70, 18, 80, 28); x.quadraticCurveTo(74, 44, 82, 58); x.quadraticCurveTo(76, 76, 64, 78); x.quadraticCurveTo(56, 88, 46, 80); x.quadraticCurveTo(32, 86, 24, 74); x.quadraticCurveTo(16, 60, 22, 48); x.quadraticCurveTo(14, 36, 22, 26); x.closePath();
    x.fillStyle = rg(x, 44, 40, 2, 44, [[0, '#d8a870'], [0.55, '#9a6a3a'], [1, '#4a2a10']]); x.fill(); outline(x, INK, 1.2);
    x.strokeStyle = 'rgba(255,230,190,.45)'; x.lineWidth = 0.8; x.setLineDash([1.6, 1.6]); x.beginPath(); x.moveTo(28, 30); x.quadraticCurveTo(50, 26, 74, 32); x.quadraticCurveTo(72, 56, 70, 72); x.quadraticCurveTo(50, 78, 30, 72); x.quadraticCurveTo(26, 50, 28, 30); x.stroke(); x.setLineDash([]);
  },
  pelt(x, R) {
    x.beginPath(); for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU, r = (i % 2 ? 30 : 36) * (1 + 0.1 * Math.sin(a * 3)); const px = 50 + Math.cos(a) * r * 1.1, py = 54 + Math.sin(a) * r * 0.85; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath();
    x.fillStyle = rg(x, 42, 42, 2, 44, [[0, '#ffffff'], [0.45, '#c8ccd4'], [1, '#5a6070']]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = 'rgba(80,86,100,.55)'; x.lineWidth = 0.8; for (let i = 0; i < 26; i++) { const px = 24 + R() * 52, py = 32 + R() * 44; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 2, py + 3, px + 1, py + 6); x.stroke(); }
    x.fillStyle = '#3a3e4a'; ellipse(x, 72, 36, 3, 4, 0.4); x.fill();
  },
  clam(x, R) {
    x.beginPath(); x.moveTo(20, 62); x.bezierCurveTo(22, 30, 78, 30, 80, 62); x.quadraticCurveTo(50, 72, 20, 62); x.closePath();
    x.fillStyle = rg(x, 42, 40, 2, 40, [[0, '#ffe8e0'], [0.5, '#e0a0a0'], [1, '#6a3a4a']]); x.fill(); outline(x, INK, 1.2);
    x.strokeStyle = 'rgba(120,60,70,.6)'; x.lineWidth = 0.9; for (let i = 0; i < 9; i++) { const a = PI + (i + 0.5) / 9 * PI; x.beginPath(); x.moveTo(50, 64); x.lineTo(50 + Math.cos(a) * 30, 64 + Math.sin(a) * 30 * 0.95); x.stroke(); }
    x.beginPath(); x.moveTo(22, 64); x.quadraticCurveTo(50, 76, 78, 64); x.quadraticCurveTo(66, 84, 50, 84); x.quadraticCurveTo(34, 84, 22, 64); x.closePath(); x.fillStyle = lg(x, 0, 64, 0, 84, [[0, '#c88a8a'], [1, '#5a2a34']]); x.fill(); outline(x, INK, 1.1);
  },
  pearl(x, R) {
    x.beginPath(); x.moveTo(16, 60); x.bezierCurveTo(14, 24, 86, 24, 84, 60); x.quadraticCurveTo(50, 50, 16, 60); x.closePath(); x.fillStyle = rg(x, 40, 36, 2, 44, [[0, '#ffe8f0'], [0.5, '#d8a8c0'], [1, '#6a3a5a']]); x.fill(); outline(x, INK, 1.1);
    x.beginPath(); x.moveTo(16, 62); x.quadraticCurveTo(50, 54, 84, 62); x.quadraticCurveTo(70, 86, 50, 86); x.quadraticCurveTo(30, 86, 16, 62); x.closePath(); x.fillStyle = lg(x, 0, 60, 0, 86, [[0, '#f0d0e0'], [1, '#7a4a64']]); x.fill(); outline(x, INK, 1.1);
    glow(x, 50, 62, 18, '#ffffff', 0.7);
    circle(x, 50, 62, 10); x.fillStyle = rg(x, 46, 58, 0.5, 12, [[0, '#ffffff'], [0.5, '#f0ecf8'], [1, '#a8a0c0']]); x.fill(); outline(x, INK, 0.9);
    sparkle(x, 46, 58, 5);
  },
  sunbloom(x, R) {
    glow(x, 50, 44, 34, '#ffd040', 0.6);
    x.strokeStyle = '#3a7a2a'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(50, 96); x.quadraticCurveTo(46, 74, 50, 58); x.stroke();
    leaf(x, 48, 80, 20, 6, -2.6, '#4aa038'); leaf(x, 49, 74, 18, 5, -0.5, '#5ab048');
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; x.save(); x.translate(50, 42); x.rotate(a); x.beginPath(); x.ellipse(0, -15, 4.2, 10, 0, 0, TAU); x.fillStyle = lg(x, 0, -25, 0, -5, [[0, '#fff4a0'], [1, '#e0901a']]); x.fill(); outline(x, INK, 0.6); x.restore(); }
    circle(x, 50, 42, 9); x.fillStyle = rg(x, 48, 40, 0, 10, [[0, '#8a5a1a'], [1, '#3a2006']]); x.fill(); outline(x, INK, 0.8);
    for (let i = 0; i < 10; i++) { const a = R() * TAU, r = R() * 6; x.fillStyle = '#ffd060'; circle(x, 50 + Math.cos(a) * r, 42 + Math.sin(a) * r, 0.7); x.fill(); }
  },
  buried_coin(x, R) {
    x.fillStyle = lg(x, 0, 60, 0, 100, [[0, '#6a4a2a'], [1, '#2a1a0a']]); x.beginPath(); x.moveTo(8, 70); x.quadraticCurveTo(50, 56, 92, 70); x.lineTo(92, 92); x.lineTo(8, 92); x.closePath(); x.fill(); outline(x, INK, 1);
    for (let i = 0; i < 12; i++) { x.fillStyle = rgba(i % 2 ? '#8a6a44' : '#3a2412', 0.8); circle(x, 14 + R() * 72, 72 + R() * 16, 1 + R() * 1.6); x.fill(); }
    x.save(); x.beginPath(); x.rect(0, 0, 100, 68); x.clip();
    coin(x, 50, 60, 24, ['#e8f0d8', '#a8b890', '#6a7a50', '#34402a', '#141a0e'], { emblem: false });
    x.restore();
    x.strokeStyle = 'rgba(40,50,30,.8)'; x.lineWidth = 1.2; circle(x, 50, 60, 13); x.stroke(); star(x, 50, 58, 5, 3, 8); x.fillStyle = 'rgba(40,50,30,.6)'; x.fill();
  },
  relic_idol(x, R) {
    glow(x, 50, 40, 30, '#ffe0a0', 0.5);
    x.lineWidth = 2.4; x.strokeStyle = metalLG(x, 36, 12, 64, 22, 'gold'); ellipse(x, 50, 18, 12, 4); x.stroke();
    x.beginPath(); x.moveTo(50, 22); x.bezierCurveTo(58, 22, 60, 30, 58, 36); x.bezierCurveTo(66, 42, 70, 70, 68, 86); x.lineTo(32, 86); x.bezierCurveTo(30, 70, 34, 42, 42, 36); x.bezierCurveTo(40, 30, 42, 22, 50, 22); x.closePath();
    x.fillStyle = rg(x, 44, 38, 2, 50, [[0, '#e8e0cc'], [0.5, '#9a927e'], [1, '#3a362a']]); x.fill(); outline(x, INK, 1.2);
    x.strokeStyle = 'rgba(40,36,26,.6)'; x.lineWidth = 0.9; for (const px of [42, 50, 58]) { x.beginPath(); x.moveTo(px, 44); x.quadraticCurveTo(px - 1, 66, px, 84); x.stroke(); }
    x.fillStyle = metalLG(x, 28, 84, 72, 92, 'gold'); x.fillRect(28, 84, 44, 7); x.strokeStyle = INK; x.lineWidth = 0.8; x.strokeRect(28, 84, 44, 7);
    glow(x, 50, 50, 8, '#fff0b0', 0.8);
  },
  card_pack_epic(x, R) { cardPack(x, R, '#7a3ac0', '#2a0a4a', '#c080ff'); },
  card_pack_legend(x, R) { cardPack(x, R, '#e0a020', '#5a3004', '#ffe070', true); },
  card_pack_pip(x, R) { cardPack(x, R, '#5ab040', '#1a3a0a', '#b0ff80', false, true); },
  gem_pouch(x, R) { pouch(x, R, '#8a5a34', ['#ff3a4a', '#3a9aff', '#ff3a4a']); },
  gem_pouch_hi(x, R) { glow(x, 50, 50, 40, '#ffd070', 0.5); pouch(x, R, '#c89a3a', ['#ff2a3a', '#1a9aff', '#ffb020', '#1aa0ff'], true); },
  accessory_chest(x, R) {
    glow(x, 50, 50, 40, '#ff6a2a', 0.55);
    x.beginPath(); x.moveTo(16, 52); x.lineTo(84, 52); x.lineTo(84, 86); x.lineTo(16, 86); x.closePath(); x.fillStyle = lg(x, 16, 52, 84, 86, [[0, '#b0302a'], [1, '#3a0a08']]); x.fill(); outline(x, INK, 1.2);
    x.beginPath(); x.moveTo(16, 52); x.bezierCurveTo(16, 28, 84, 28, 84, 52); x.closePath(); x.fillStyle = lg(x, 16, 30, 84, 52, [[0, '#d0503a'], [1, '#5a120a']]); x.fill(); outline(x, INK, 1.2);
    for (const px of [22, 50, 78]) { x.fillStyle = metalLG(x, px - 3, 30, px + 3, 86, 'gold'); x.fillRect(px - 2.6, 32, 5.2, 54); x.strokeStyle = INK; x.lineWidth = 0.6; x.strokeRect(px - 2.6, 32, 5.2, 54); }
    gem(x, 50, 60, 5, '#ff7a2a', { n: 6, glowA: 0.7, lw: 0.6 });
    // necklace draped over the lid
    x.strokeStyle = metalLG(x, 20, 30, 70, 50, 'gold'); x.lineWidth = 1.4; x.beginPath(); x.moveTo(28, 40); x.quadraticCurveTo(44, 54, 64, 38); x.stroke(); gem(x, 46, 49, 3.6, '#3ab0ff', { n: 6, spark: false, glowA: 0.6, lw: 0.5 });
  },
  life_tonic(x, R) { vial(x, 50, 52, 1.25, '#60e060', 'bronze'); leaf(x, 44, 62, 12, 4, -0.9, '#b0ff90'); sparkle(x, 62, 40, 6); },
  crew_contract(x, R) {
    parchment(x, 50, 52, 56, 64);
    // anchor emblem + seal
    x.strokeStyle = '#2a3a5a'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(50, 30); x.lineTo(50, 56); x.moveTo(42, 36); x.lineTo(58, 36); x.stroke(); x.beginPath(); x.arc(50, 48, 11, 0.2, PI - 0.2); x.stroke(); circle(x, 50, 28, 3); x.stroke();
    waxSeal(x, 66, 74, 7, '#1a4a8a');
    x.strokeStyle = 'rgba(40,30,20,.8)'; x.lineWidth = 1; x.beginPath(); x.moveTo(30, 76); x.bezierCurveTo(36, 70, 40, 80, 48, 74); x.stroke();
  },
  rename_ticket(x, R) {
    x.save(); x.translate(48, 56); x.rotate(-0.15);
    x.beginPath(); x.moveTo(-32, -18); x.lineTo(32, -18); x.lineTo(32, -6); x.arc(32, 0, 6, -PI / 2, PI / 2, true); x.lineTo(32, 18); x.lineTo(-32, 18); x.lineTo(-32, 6); x.arc(-32, 0, 6, PI / 2, -PI / 2, true); x.closePath();
    x.fillStyle = lg(x, -32, -18, 32, 18, [[0, '#ffe8b0'], [1, '#c8904a']]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = 'rgba(90,50,10,.6)'; x.lineWidth = 0.9; x.setLineDash([2, 2]); x.beginPath(); x.moveTo(-18, -18); x.lineTo(-18, 18); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(90,50,10,.55)'; x.fillRect(-12, -8, 34, 3); x.fillRect(-12, 2, 24, 3);
    star(x, -25, 0, 5, 2.4, 6); x.fillStyle = '#e0501a'; x.fill();
    x.restore();
    x.save(); x.translate(74, 78); x.rotate(-0.7); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(5, -10, 7, -22, 3, -32); x.bezierCurveTo(-2, -22, -4, -10, 0, 0); x.closePath(); x.fillStyle = lg(x, -4, -32, 7, 0, [[0, '#ffffff'], [1, '#9aa0b8']]); x.fill(); outline(x, INK, 0.7); x.restore();
  },
};

export const MISC_ITEM_PAINT = {};
for (const k in M) {
  const m = k.match(/^(food|gift)_(\d)$/);
  MISC_ITEM_PAINT[m ? `item:${m[1]}:${m[2]}` : `item:${k}`] = M[k];
}
export { flask, vial, coin, waxSeal, parchment, sunOrb, leaf };
