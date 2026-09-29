// Boss portrait medallions (round) and NPC busts (square). Painted heads, light from the top-left.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, rays, rgba, shade, mix, outline, metalLG, metalRG, gem, crystal,
  fire, fireLayers, bolt, glowPath, add, norm, ribbon, bez, qbez, embers, smoke, backdrop, brush, clouds, rocks, burst,
} from './core.js';
import { greatsword, featherWing, batWing } from './motifs.js';
import { leaf } from './items_misc.js';

const INK = 'rgba(6,4,8,.92)';
function bg(x, R, pal, o = {}) {
  x.fillStyle = rg(x, o.cx ?? 50, o.cy ?? 40, 2, 76, [[0, pal[0]], [0.45, pal[1]], [1, pal[2]]]); x.fillRect(0, 0, 100, 100);
  brush(x, R, 18, [pal[0], pal[1], pal[2]], { angle: o.angle ?? -0.7, alpha: 0.12, len: 34, w: 10 });
}
/** Shaded fill: lit top-left → base → shadow. */
function skin(x, base, cx = 40, cy = 34, r = 60) { x.fillStyle = rg(x, cx, cy, 2, r, [[0, shade(base, 0.45)], [0.45, base], [1, shade(base, -0.75)]]); x.fill(); }
function hornRibbon(x, pts, w0, col = '#e8dcc8', dark = '#2a1a10') {
  const f = bez(...pts);
  ribbon(x, f, t => w0 * (1 - t) + 0.6, 26);
  x.fillStyle = lg(x, pts[0][0], pts[0][1], pts[3][0], pts[3][1], [[0, dark], [0.35, shade(col, -0.35)], [0.8, col], [1, '#ffffff']]); x.fill(); outline(x, INK, 1);
  x.strokeStyle = rgba(shade(col, -0.6), 0.6); x.lineWidth = 0.7;
  for (let i = 1; i < 7; i++) { const t = i / 8, p = f(t), q = f(t + 0.02), a = Math.atan2(q[1] - p[1], q[0] - p[0]), w = (w0 * (1 - t) + 0.6) / 2; x.beginPath(); x.moveTo(p[0] - Math.sin(a) * w, p[1] + Math.cos(a) * w); x.lineTo(p[0] + Math.sin(a) * w, p[1] - Math.cos(a) * w); x.stroke(); }
}
function glowEye(x, cx, cy, w, h, col, rot = 0) {
  glow(x, cx, cy, w * 2.2, col, 1);
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.beginPath(); x.moveTo(-w, 0); x.quadraticCurveTo(0, -h * 1.4, w, 0); x.quadraticCurveTo(0, h * 0.8, -w, 0); x.closePath();
  x.fillStyle = rg(x, 0, 0, 0, w, [[0, '#ffffff'], [0.45, mix(col, '#ffffff', 0.5)], [1, col]]); x.fill();
  x.restore();
}
function fangs(x, pts, col = '#fff4e0') { x.fillStyle = col; for (const [a, b, c] of pts) { poly(x, [a, b, c]); x.fill(); outline(x, INK, 0.5); } }

// ------------------------------------------------------------------ bosses
const B = {
  gorrath(x, R) { // the Horned Tyrant — minotaur demon lord
    bg(x, R, ['#e0602a', '#5a1208', '#120302']);
    glow(x, 50, 60, 50, '#ff5020', 0.5);
    embers(x, R, 14, 50, 40, 46, ['#ff8a3a', '#ffd070']);
    hornRibbon(x, [[34, 38], [16, 36], [2, 24], [8, 2]], 12);
    hornRibbon(x, [[66, 38], [84, 36], [98, 24], [92, 2]], 12);
    // shaggy mane + shoulders
    x.beginPath(); x.moveTo(6, 100); x.bezierCurveTo(8, 74, 20, 62, 30, 58); x.lineTo(70, 58); x.bezierCurveTo(80, 62, 92, 74, 94, 100); x.closePath(); skin(x, '#3a1a14', 30, 60, 60); outline(x, INK, 1.2);
    for (let i = 0; i < 9; i++) { const px = 16 + i * 8.5; poly(x, [[px - 5, 66], [px, 80 + (i % 2) * 6], [px + 5, 66]]); x.fillStyle = rgba('#1a0806', 0.7); x.fill(); }
    // iron collar with spikes
    x.beginPath(); x.moveTo(22, 74); x.quadraticCurveTo(50, 84, 78, 74); x.lineTo(80, 82); x.quadraticCurveTo(50, 92, 20, 82); x.closePath(); x.fillStyle = metalLG(x, 20, 70, 80, 92, 'dark'); x.fill(); outline(x, INK, 1);
    for (const px of [28, 40, 50, 60, 72]) { poly(x, [[px - 3, 80], [px, 70 - (px === 50 ? 6 : 0)], [px + 3, 80]]); x.fillStyle = metalLG(x, px - 3, 70, px + 3, 80, 'iron'); x.fill(); outline(x, INK, 0.6); }
    // head
    x.beginPath(); x.moveTo(50, 22); x.bezierCurveTo(66, 22, 72, 34, 70, 46); x.bezierCurveTo(69, 56, 64, 62, 62, 72); x.quadraticCurveTo(50, 80, 38, 72); x.bezierCurveTo(36, 62, 31, 56, 30, 46); x.bezierCurveTo(28, 34, 34, 22, 50, 22); x.closePath();
    skin(x, '#6a2a1e', 42, 34, 44); outline(x, INK, 1.3);
    // muzzle
    x.beginPath(); x.ellipse(50, 64, 11, 9, 0, 0, TAU); x.fillStyle = rg(x, 47, 60, 1, 13, [[0, '#8a5a4a'], [1, '#2a1410']]); x.fill(); outline(x, INK, 0.9);
    x.fillStyle = '#0a0404'; ellipse(x, 45.5, 64, 2, 1.4, 0.4); x.fill(); ellipse(x, 54.5, 64, 2, 1.4, -0.4); x.fill();
    x.lineWidth = 2.2; x.strokeStyle = metalLG(x, 44, 66, 56, 76, 'gold'); x.beginPath(); x.arc(50, 69, 5, 0.1, PI - 0.1); x.stroke();
    // brow + eyes
    x.fillStyle = rgba('#1a0806', 0.9); x.beginPath(); x.moveTo(32, 42); x.quadraticCurveTo(50, 50, 68, 42); x.lineTo(66, 46); x.quadraticCurveTo(50, 53, 34, 46); x.closePath(); x.fill();
    glowEye(x, 41, 47, 5, 2.4, '#ff6a1a', 0.2); glowEye(x, 59, 47, 5, 2.4, '#ff6a1a', -0.2);
    // forehead rune
    glowPath(x, xx => poly(xx, [[50, 28], [46, 36], [50, 40], [54, 36]], true), '#ff4a1a', 0.9);
  },
  skarn(x, R) { hellhound(x, R, { fur: '#2a1a16', fire: fireLayers('#5a0a00', '#e0400a', '#ffc040'), eye: '#ffb030', bg: ['#e06a2a', '#4a1206', '#100302'] }); },
  vesk(x, R) { hellhound(x, R, { fur: '#16142a', fire: fireLayers('#12062a', '#5a2ab0', '#b0a0ff', '#f0f0ff'), eye: '#8af0ff', bg: ['#5a4ab0', '#160c3a', '#04020c'], flip: true }); },
  varkhul(x, R) { // the Ravager — horned great helm, burning greatsword
    bg(x, R, ['#d0501a', '#40100a', '#0a0202'], { cy: 30 });
    fire(x, R, 50, 100, 70, 110, 0, { n: 9 });
    x.save(); x.translate(80, 96); x.rotate(-0.45); x.scale(1.05, 1.05); greatsword(x, { metal: 'iron', guard: 'dark', rune: '#ffb040', glow: '#ff5020', glowR: 8 }); x.restore();
    // pauldrons + chest
    x.beginPath(); x.moveTo(4, 100); x.bezierCurveTo(4, 78, 16, 66, 30, 64); x.lineTo(70, 64); x.bezierCurveTo(84, 66, 96, 78, 96, 100); x.closePath(); x.fillStyle = metalLG(x, 4, 60, 96, 100, 'obsidian'); x.fill(); outline(x, INK, 1.2);
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(50 + s * 30, 72, 18, 12, s * 0.3, 0, TAU); x.fillStyle = rg(x, 50 + s * 30 - 6, 66, 1, 20, [[0, '#8a7a8a'], [0.5, '#3a2a3a'], [1, '#0a060a']]); x.fill(); outline(x, INK, 1); poly(x, [[50 + s * 30, 62], [50 + s * 40, 48], [50 + s * 36, 64]]); x.fillStyle = '#d8c8b8'; x.fill(); outline(x, INK, 0.7); }
    // helm with demon horns
    hornRibbon(x, [[36, 34], [22, 28], [16, 12], [24, 2]], 9);
    hornRibbon(x, [[64, 34], [78, 28], [84, 12], [76, 2]], 9);
    x.beginPath(); x.moveTo(30, 44); x.bezierCurveTo(28, 14, 72, 14, 70, 44); x.lineTo(66, 64); x.lineTo(54, 70); x.lineTo(50, 60); x.lineTo(46, 70); x.lineTo(34, 64); x.closePath();
    x.fillStyle = rg(x, 42, 30, 2, 40, [[0, '#9a8a8a'], [0.4, '#3a2e30'], [1, '#08060a']]); x.fill(); outline(x, INK, 1.3);
    x.fillStyle = '#050000'; poly(x, [[33, 44], [47, 46], [47, 50], [35, 50]]); x.fill(); poly(x, [[67, 44], [53, 46], [53, 50], [65, 50]]); x.fill();
    glowEye(x, 41, 48, 5, 1.6, '#ff6a1a'); glowEye(x, 59, 48, 5, 1.6, '#ff6a1a');
    x.strokeStyle = metalLG(x, 30, 30, 70, 40, 'crimson'); x.lineWidth = 1.6; x.beginPath(); x.moveTo(31, 40); x.quadraticCurveTo(50, 34, 69, 40); x.stroke();
    embers(x, R, 14, 50, 50, 46, ['#ff8a3a', '#ffd070']);
  },
  ashmaw(x, R) { // siege behemoth — an ash-plated maw full of fire
    bg(x, R, ['#8a7a70', '#2a2220', '#080606']);
    smoke(x, R, 8, 50, 20, 40, '#6a6260', 0.35, 16);
    x.beginPath(); x.moveTo(4, 30); x.bezierCurveTo(20, 10, 80, 10, 96, 30); x.lineTo(100, 100); x.lineTo(0, 100); x.closePath(); skin(x, '#5a504a', 36, 20, 80); outline(x, INK, 1.3);
    for (const [px, py, s] of [[24, 26, 1], [50, 18, 1.1], [76, 26, 1], [12, 46, 0.8], [88, 46, 0.8]]) { poly(x, [[px - 9 * s, py + 4], [px - 4 * s, py - 6 * s], [px + 5 * s, py - 6 * s], [px + 9 * s, py + 4]]); x.fillStyle = lg(x, px, py - 6, px, py + 4, [[0, '#9a908a'], [1, '#3a3230']]); x.fill(); outline(x, INK, 0.9); }
    // gaping maw
    x.beginPath(); x.moveTo(16, 50); x.bezierCurveTo(26, 40, 74, 40, 84, 50); x.bezierCurveTo(80, 84, 62, 96, 50, 96); x.bezierCurveTo(38, 96, 20, 84, 16, 50); x.closePath();
    x.fillStyle = rg(x, 50, 74, 2, 34, [[0, '#fff0a0'], [0.2, '#ff8a20'], [0.5, '#a0200a'], [1, '#1a0402']]); x.fill(); outline(x, INK, 1.4);
    glow(x, 50, 74, 26, '#ff7a1a', 0.8);
    const top = []; for (let i = 0; i < 8; i++) { const t = (i + 0.5) / 8, px = 18 + t * 64; top.push([[px - 3.6, 48 - Math.sin(t * PI) * 5], [px, 60 - Math.sin(t * PI) * 3], [px + 3.6, 48 - Math.sin(t * PI) * 5]]); }
    fangs(x, top, '#f0e0c8');
    const bot = []; for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6, px = 26 + t * 48; bot.push([[px - 3.4, 90 - Math.sin(t * PI) * 4], [px, 80 - Math.sin(t * PI) * 2], [px + 3.4, 90 - Math.sin(t * PI) * 4]]); }
    fangs(x, bot, '#e0d0b8');
    glowEye(x, 22, 36, 3.4, 1.6, '#ff8a2a', 0.3); glowEye(x, 78, 36, 3.4, 1.6, '#ff8a2a', -0.3);
    embers(x, R, 10, 50, 70, 24, ['#ffb040', '#ffe080']);
  },
  gatekeeper(x, R) { // armoured sentinel with one burning eye
    bg(x, R, ['#5a3a8a', '#1a0e30', '#050208'], { cy: 30 });
    // gate arch behind
    x.strokeStyle = rgba('#8a6ac8', 0.5); x.lineWidth = 5; x.beginPath(); x.moveTo(8, 100); x.lineTo(8, 40); x.quadraticCurveTo(50, -6, 92, 40); x.lineTo(92, 100); x.stroke();
    x.beginPath(); x.moveTo(8, 100); x.bezierCurveTo(10, 78, 22, 70, 32, 68); x.lineTo(68, 68); x.bezierCurveTo(78, 70, 90, 78, 92, 100); x.closePath(); x.fillStyle = metalLG(x, 8, 64, 92, 100, 'dark'); x.fill(); outline(x, INK, 1.2);
    // monolithic helm
    x.beginPath(); x.moveTo(30, 30); x.lineTo(50, 14); x.lineTo(70, 30); x.lineTo(72, 64); x.lineTo(60, 76); x.lineTo(40, 76); x.lineTo(28, 64); x.closePath();
    x.fillStyle = rg(x, 42, 30, 2, 46, [[0, '#a098b8'], [0.45, '#4a4260'], [1, '#100c1a']]); x.fill(); outline(x, INK, 1.3);
    x.strokeStyle = rgba('#000000', 0.5); x.lineWidth = 1; x.beginPath(); x.moveTo(50, 14); x.lineTo(50, 36); x.moveTo(30, 30); x.lineTo(40, 44); x.moveTo(70, 30); x.lineTo(60, 44); x.stroke();
    glowPath(x, xx => { xx.beginPath(); xx.moveTo(36, 60); xx.lineTo(42, 66); xx.lineTo(58, 66); xx.lineTo(64, 60); }, '#b070ff', 1.2);
    // the eye
    x.fillStyle = '#050208'; poly(x, [[40, 44], [60, 44], [56, 54], [44, 54]]); x.fill();
    glowEye(x, 50, 49, 8, 3.6, '#c060ff');
    rays(x, R, 50, 49, 8, 4, 18, '#e0b0ff', { alpha: 0.5 });
  },
  rimewing(x, R) { // ice wyvern
    bg(x, R, ['#bfe8ff', '#3a7ab0', '#0a1a30'], { cy: 30 });
    for (let i = 0; i < 16; i++) glow(x, R() * 100, R() * 100, 0.8 + R() * 1.4, '#ffffff', 0.8);
    x.save(); x.translate(60, 40); batWing(x, 1, 0.9, '#5a9ad0'); x.restore();
    // long neck + head in profile facing left
    ribbon(x, bez([96, 100], [80, 80], [70, 60], [56, 46]), t => 22 - t * 8, 24); skin(x, '#6aa8d8', 70, 60, 50); outline(x, INK, 1.2);
    x.beginPath(); x.moveTo(62, 36); x.bezierCurveTo(50, 30, 30, 34, 12, 46); x.lineTo(10, 50); x.bezierCurveTo(20, 52, 34, 54, 44, 54); x.lineTo(24, 62); x.bezierCurveTo(34, 64, 50, 62, 62, 58); x.closePath();
    skin(x, '#8ac8f0', 40, 38, 40); outline(x, INK, 1.2);
    // ice crest
    for (const [px, py, l, a] of [[60, 34, 22, -2.2], [66, 38, 18, -1.9], [54, 34, 16, -2.5]]) crystal(x, px, py, l, 6, a, '#d8f4ff', { glow: false, lw: 0.6 });
    x.fillStyle = '#ffffff'; for (const tx of [18, 24, 30, 36]) { poly(x, [[tx, 52], [tx + 2.4, 52.5], [tx + 1, 57]]); x.fill(); }
    glowEye(x, 40, 41, 4, 1.8, '#40e0ff', -0.1);
    // frost breath
    x.save(); add(x); x.fillStyle = rg(x, 10, 58, 1, 22, [[0, 'rgba(255,255,255,.8)'], [1, 'rgba(160,220,255,0)']]); circle(x, 10, 58, 22); x.fill(); norm(x); x.restore();
  },
  cinderhorn(x, R) { // lava-crusted rhino beast (profile)
    bg(x, R, ['#d0581c', '#3a0e06', '#0a0201']);
    glow(x, 40, 70, 40, '#ff6a1a', 0.45);
    // head silhouette facing left: nose horn, second horn, small ear, heavy jaw
    const H = [[12, 70], [9, 62], [16, 55], [20, 14], [33, 50], [40, 44], [46, 26], [52, 40], [62, 36], [70, 24], [77, 12], [80, 31], [92, 42], [98, 70], [98, 100], [48, 100], [40, 86], [22, 82]];
    poly(x, H); skin(x, '#3e302c', 40, 44, 70); outline(x, INK, 1.3);
    // horns (bone, lit)
    poly(x, [[16, 55], [20, 14], [33, 50]]); x.fillStyle = lg(x, 20, 14, 26, 52, [[0, '#fff4e0'], [0.5, '#b8a080'], [1, '#3a2a1a']]); x.fill(); outline(x, INK, 1);
    poly(x, [[40, 44], [46, 26], [52, 40]]); x.fillStyle = lg(x, 46, 26, 46, 44, [[0, '#f0e0c8'], [1, '#4a3a28']]); x.fill(); outline(x, INK, 0.9);
    // molten cracks through the basalt hide
    for (const P of [[[56, 40], [62, 52], [58, 62], [66, 74], [62, 90]], [[74, 34], [80, 48], [88, 56], [92, 72]], [[40, 64], [50, 68], [56, 80], [52, 96]], [[66, 74], [78, 80], [86, 94]], [[30, 58], [36, 66], [34, 76]]]) glowPath(x, xx => poly(xx, P, false), '#ff7a1a', 1.3);
    glow(x, 60, 70, 18, '#ff6a1a', 0.35);
    x.fillStyle = '#0a0404'; ellipse(x, 13, 64, 2.2, 1.6, 0.4); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(14, 72); x.quadraticCurveTo(26, 76, 38, 74); x.stroke();
    glowEye(x, 44, 56, 4, 1.7, '#ffb030', -0.2);
    embers(x, R, 14, 60, 40, 40, ['#ff8a3a', '#ffd070']);
  },
  sandmaw(x, R) { // sand wurm, seen down its throat
    bg(x, R, ['#e8c888', '#8a6a3a', '#2a1a0a']);
    smoke(x, R, 10, 50, 50, 50, '#c8a870', 0.3, 14);
    for (let k = 0; k < 4; k++) { const r = 46 - k * 9; circle(x, 50, 54, r); x.fillStyle = rg(x, 44, 46, 2, r, [[0, shade('#b08a5a', 0.3 - k * 0.2)], [0.7, shade('#8a6a40', -k * 0.15)], [1, shade('#4a3418', -k * 0.2)]]); x.fill(); outline(x, INK, 1);
      const n = 14 - k * 2; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + k * 0.3; const r0 = r - 1, r1 = r - 7; poly(x, [[50 + Math.cos(a - 0.12) * r0, 54 + Math.sin(a - 0.12) * r0], [50 + Math.cos(a) * r1, 54 + Math.sin(a) * r1], [50 + Math.cos(a + 0.12) * r0, 54 + Math.sin(a + 0.12) * r0]]); x.fillStyle = '#f4e8d0'; x.fill(); outline(x, INK, 0.4); } }
    circle(x, 50, 54, 10); x.fillStyle = rg(x, 50, 54, 0, 10, [[0, '#000000'], [1, '#2a1004']]); x.fill();
    glow(x, 50, 54, 8, '#ffb040', 0.4);
  },
  kurai(x, R) { // Kurai the Pyrefox — nine burning tails
    bg(x, R, ['#ff9a3a', '#6a1a0a', '#120302']);
    for (let i = 0; i < 9; i++) { const a = -PI / 2 + (i - 4) * 0.34; x.save(); x.translate(50, 70); x.rotate(a + PI / 2); fire(x, R, 0, 0, 58, 16, 0, { n: 3, layers: fireLayers('#7a1a04', '#ff6a1a', '#ffd070') }); x.restore(); }
    // fox head
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50 + s * 10, 42); x.lineTo(50 + s * 26, 16); x.lineTo(50 + s * 28, 48); x.closePath(); skin(x, '#f0e0d0', 50 + s * 20, 26, 26); outline(x, INK, 1); x.beginPath(); x.moveTo(50 + s * 14, 40); x.lineTo(50 + s * 25, 22); x.lineTo(50 + s * 25, 44); x.closePath(); x.fillStyle = '#ff7a3a'; x.fill(); }
    x.beginPath(); x.moveTo(50, 34); x.bezierCurveTo(66, 34, 76, 46, 76, 56); x.bezierCurveTo(70, 70, 58, 82, 50, 90); x.bezierCurveTo(42, 82, 30, 70, 24, 56); x.bezierCurveTo(24, 46, 34, 34, 50, 34); x.closePath();
    skin(x, '#fff4ea', 42, 44, 40); outline(x, INK, 1.2);
    // flame markings
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50 + s * 4, 36); x.quadraticCurveTo(50 + s * 14, 44, 50 + s * 22, 50); x.quadraticCurveTo(50 + s * 12, 48, 50 + s * 6, 46); x.closePath(); x.fillStyle = '#ff5a1a'; x.fill(); }
    glowEye(x, 40, 56, 5, 2, '#ffd040', 0.35); glowEye(x, 60, 56, 5, 2, '#ffd040', -0.35);
    x.fillStyle = '#1a0a08'; ellipse(x, 50, 84, 3.4, 2.4); x.fill();
    embers(x, R, 16, 50, 40, 46, ['#ffb040', '#ffe080']);
  },
  nerissa(x, R) { // siren of the Drowned Choir
    bg(x, R, ['#3ac0b0', '#0a3a48', '#02080c']);
    for (let i = 0; i < 12; i++) { const px = R() * 100, py = R() * 100, r = 0.8 + R() * 2.4; x.strokeStyle = rgba('#c0fff4', 0.6); x.lineWidth = 0.6; circle(x, px, py, r); x.stroke(); }
    // hair mass
    x.beginPath(); x.moveTo(50, 12); x.bezierCurveTo(82, 12, 92, 40, 90, 64); x.bezierCurveTo(88, 84, 96, 96, 100, 100); x.lineTo(0, 100); x.bezierCurveTo(4, 96, 12, 84, 10, 64); x.bezierCurveTo(8, 40, 18, 12, 50, 12); x.closePath();
    skin(x, '#1a8a8a', 36, 24, 70); outline(x, INK, 1.2);
    x.strokeStyle = rgba('#7af0e0', 0.5); x.lineWidth = 1.2; for (let i = 0; i < 7; i++) { const px = 14 + i * 12; x.beginPath(); x.moveTo(px + 6, 20); x.bezierCurveTo(px - 6, 50, px + 10, 70, px, 98); x.stroke(); }
    // fin ears
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50 + s * 18, 46); x.lineTo(50 + s * 34, 32); x.lineTo(50 + s * 28, 44); x.lineTo(50 + s * 34, 50); x.lineTo(50 + s * 20, 56); x.closePath(); x.fillStyle = lg(x, 50 + s * 18, 40, 50 + s * 34, 52, [[0, '#a0fff0'], [1, '#2a8a9a']]); x.fill(); outline(x, INK, 0.9); }
    // face
    x.beginPath(); x.moveTo(50, 26); x.bezierCurveTo(64, 26, 70, 38, 69, 50); x.bezierCurveTo(68, 62, 60, 74, 50, 78); x.bezierCurveTo(40, 74, 32, 62, 31, 50); x.bezierCurveTo(30, 38, 36, 26, 50, 26); x.closePath();
    skin(x, '#b8e8e0', 44, 40, 40); outline(x, INK, 1.1);
    for (const s of [-1, 1]) { glowEye(x, 50 + s * 8.5, 50, 4.6, 1.8, '#60ffe8', s * -0.12); x.strokeStyle = rgba('#0a3a3a', 0.9); x.lineWidth = 1; x.beginPath(); x.moveTo(50 + s * 4, 45); x.quadraticCurveTo(50 + s * 9, 43, 50 + s * 14, 46); x.stroke(); }
    x.strokeStyle = rgba('#2a6a6a', 0.7); x.lineWidth = 0.9; x.beginPath(); x.moveTo(50, 52); x.lineTo(48.5, 60); x.lineTo(51, 61); x.stroke();
    x.fillStyle = '#3a8a90'; x.beginPath(); x.moveTo(44, 67); x.quadraticCurveTo(50, 70, 56, 67); x.quadraticCurveTo(50, 72, 44, 67); x.fill();
    // pearl circlet
    x.strokeStyle = metalLG(x, 32, 30, 68, 36, 'silver'); x.lineWidth = 1.4; x.beginPath(); x.moveTo(32, 38); x.quadraticCurveTo(50, 28, 68, 38); x.stroke();
    for (let i = 0; i < 5; i++) { const t = i / 4, px = 34 + t * 32, py = 37 - Math.sin(t * PI) * 7; x.fillStyle = rg(x, px - 0.6, py - 0.6, 0, 2.2, [[0, '#ffffff'], [1, '#a0c8d0']]); circle(x, px, py, i === 2 ? 2.8 : 1.8); x.fill(); }
  },
  deep_oracle(x, R) { // many-eyed thing from the deep
    bg(x, R, ['#2a6a7a', '#0c1a2a', '#020308']);
    for (let i = 0; i < 6; i++) { const a = PI * 0.15 + (i / 5) * PI * 0.7, sx = 50 + Math.cos(a) * 20, sy = 70; ribbon(x, bez([sx, sy], [sx + Math.cos(a) * 20, sy + 10], [sx + Math.cos(a) * 34, sy + 30], [sx + Math.cos(a) * 30 + (R() - 0.5) * 20, 104]), t => 8 * (1 - t) + 0.6, 24); x.fillStyle = lg(x, sx, sy, sx, 104, [[0, '#4a2a6a'], [1, '#12081e']]); x.fill(); outline(x, INK, 0.9); }
    // hooded mantle head
    x.beginPath(); x.moveTo(50, 8); x.bezierCurveTo(80, 10, 88, 40, 84, 64); x.quadraticCurveTo(70, 80, 50, 80); x.quadraticCurveTo(30, 80, 16, 64); x.bezierCurveTo(12, 40, 20, 10, 50, 8); x.closePath();
    skin(x, '#3a2a5a', 38, 24, 70); outline(x, INK, 1.2);
    x.beginPath(); x.moveTo(50, 22); x.bezierCurveTo(68, 22, 72, 44, 70, 60); x.quadraticCurveTo(60, 70, 50, 70); x.quadraticCurveTo(40, 70, 30, 60); x.bezierCurveTo(28, 44, 32, 22, 50, 22); x.closePath(); x.fillStyle = rg(x, 50, 46, 2, 30, [[0, '#0a1420'], [1, '#02040a']]); x.fill();
    for (const [px, py, s] of [[50, 40, 1.3], [40, 50, 0.9], [60, 50, 0.9], [44, 60, 0.7], [56, 60, 0.7], [50, 30, 0.6], [34, 38, 0.6], [66, 38, 0.6]]) glowEye(x, px, py, 3.2 * s, 1.8 * s, '#40ffd0');
    for (let i = 0; i < 4; i++) glowPath(x, xx => { xx.beginPath(); xx.arc(50, 44, 34 + i * 4, PI * 1.1, PI * 1.9); }, '#40ffd0', 0.5);
  },
  thunderhoof(x, R) { // Old Thunderhoof, the storm-bison of the plains
    bg(x, R, ['#5a78a8', '#162440', '#03050b'], { cy: 20 });
    clouds(x, R, 50, 6, 110, 16, ['#c8d8f0', '#4a5a80', '#141c30'], 8);
    // shaggy storm mane
    const M = []; for (let i = 0; i <= 20; i++) { const a = PI * 1.05 + (i / 20) * PI * 0.9 * 2 - PI * 0.9 + 0.05, r = i % 2 ? 40 : 46; M.push([50 + Math.cos(a) * r, 58 + Math.sin(a) * r * 0.9]); }
    x.beginPath(); x.moveTo(0, 100); for (const p of M) x.lineTo(p[0], p[1]); x.lineTo(100, 100); x.closePath(); skin(x, '#2a3244', 36, 30, 70); outline(x, INK, 1.2);
    for (let i = 0; i < 3; i++) bolt(x, R, 18 + i * 32, 22, 12 + i * 38, 70, { col: '#8ad0ff', w: 1.1, gens: 4 });
    // short bison horns
    for (const s of [-1, 1]) { x.save(); x.translate(50 + s * 20, 34); x.scale(s, 1); ribbon(x, bez([0, 0], [12, 2], [22, -4], [20, -18]), t => 8 * (1 - t) + 0.8, 20); x.fillStyle = lg(x, 0, 0, 20, -18, [[0, '#3a3226'], [0.45, '#b8ab92'], [1, '#fff8e8']]); x.fill(); outline(x, INK, 1); x.restore(); }
    // broad head
    x.beginPath(); x.moveTo(50, 28); x.bezierCurveTo(66, 28, 74, 38, 72, 52); x.bezierCurveTo(70, 64, 64, 72, 62, 82); x.quadraticCurveTo(50, 90, 38, 82); x.bezierCurveTo(36, 72, 30, 64, 28, 52); x.bezierCurveTo(26, 38, 34, 28, 50, 28); x.closePath();
    skin(x, '#4a5670', 42, 38, 46); outline(x, INK, 1.2);
    x.strokeStyle = rgba('#9ab8e0', 0.5); x.lineWidth = 0.9; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(36 + i * 5.5, 30); x.quadraticCurveTo(35 + i * 5.5, 38, 38 + i * 5.5, 44); x.stroke(); }
    // wide dark muzzle
    x.beginPath(); x.moveTo(34, 70); x.quadraticCurveTo(50, 60, 66, 70); x.quadraticCurveTo(68, 80, 50, 82); x.quadraticCurveTo(32, 80, 34, 70); x.closePath(); x.fillStyle = rg(x, 46, 68, 1, 18, [[0, '#4a5264'], [1, '#141824']]); x.fill(); outline(x, INK, 0.9);
    x.fillStyle = '#05070c'; ellipse(x, 43, 73, 3.4, 1.4, 0.55); x.fill(); ellipse(x, 57, 73, 3.4, 1.4, -0.55); x.fill();
    // brow and storm-lit eyes
    x.fillStyle = rgba('#141824', 0.9); x.beginPath(); x.moveTo(31, 48); x.quadraticCurveTo(50, 54, 69, 48); x.lineTo(68, 52); x.quadraticCurveTo(50, 58, 32, 52); x.closePath(); x.fill();
    glowEye(x, 40, 54, 4.6, 1.4, '#c0f0ff', 0.2); glowEye(x, 60, 54, 4.6, 1.4, '#c0f0ff', -0.2);
    // beard
    x.beginPath(); x.moveTo(38, 82); x.lineTo(40, 98); x.lineTo(45, 90); x.lineTo(50, 100); x.lineTo(55, 90); x.lineTo(60, 98); x.lineTo(62, 82); x.quadraticCurveTo(50, 88, 38, 82); x.closePath(); x.fillStyle = '#1e2432'; x.fill(); outline(x, INK, 0.8);
    glowPath(x, xx => poly(xx, [[50, 31], [47, 38], [52, 38], [49, 45]], false), '#aee8ff', 0.9);
  },
};
function hellhound(x, R, o) {
  bg(x, R, o.bg);
  x.save(); if (o.flip) { x.translate(100, 0); x.scale(-1, 1); }
  // flaming mane behind the head
  x.save(); x.translate(78, 84); x.rotate(0.5); fire(x, R, 0, 0, 80, 70, 0, { n: 8, layers: o.fire }); x.restore();
  // head + upper jaw (profile, facing left, ears up)
  const H = [[7, 54], [28, 44], [42, 40], [52, 32], [57, 7], [66, 27], [76, 9], [80, 32], [90, 50], [88, 72], [84, 100], [46, 100], [44, 80], [44, 67], [26, 62], [11, 60]];
  poly(x, H); skin(x, o.fur, 50, 36, 60); outline(x, INK, 1.3);
  // lower jaw (open)
  poly(x, [[44, 69], [20, 71], [12, 76], [22, 80], [44, 80]]); skin(x, shade(o.fur, -0.1), 30, 72, 24); outline(x, INK, 1);
  poly(x, [[12, 61], [44, 66], [44, 70], [19, 71]]); x.fillStyle = '#3a0606'; x.fill();
  glow(x, 28, 67, 10, o.fire[3][0], 0.5);
  fangs(x, [[[14, 60.5], [16, 67], [18, 61]], [[22, 61.5], [24, 68], [26, 62]], [[32, 63], [33.5, 67.5], [35, 63.5]], [[17, 72], [19, 66], [21, 72]], [[26, 72], [27.5, 67], [29, 72]]]);
  // brow ridge, fur tufts, ear insides
  x.fillStyle = rgba(shade(o.fur, -0.7), 0.9); poly(x, [[34, 44], [52, 40], [50, 44], [36, 47]]); x.fill();
  for (const [a, b, c] of [[[58, 12], [62, 26], [55, 28]], [[76, 14], [78, 30], [72, 30]]]) { poly(x, [a, b, c]); x.fillStyle = rgba(o.fire[2][0], 0.7); x.fill(); }
  x.strokeStyle = rgba(shade(o.fur, 0.5), 0.6); x.lineWidth = 0.9; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(56 + i * 5, 50 + i * 3); x.lineTo(60 + i * 5, 62 + i * 3); x.stroke(); }
  // molten / spectral veins
  for (let i = 0; i < 5; i++) { const sx = 52 + R() * 30, sy = 44 + R() * 40; glowPath(x, xx => poly(xx, [[sx, sy], [sx + (R() - 0.5) * 12, sy + 8], [sx + (R() - 0.5) * 14, sy + 16]], false), o.fire[3][0], 0.9); }
  x.fillStyle = '#0a0404'; ellipse(x, 10, 55, 2.4, 1.6, 0.3); x.fill();
  glowEye(x, 44, 47, 5.5, 2, o.eye, -0.3);
  x.restore();
  embers(x, R, 12, 60, 40, 44, [o.fire[3][0], o.fire[2][0]]);
}

// ------------------------------------------------------------------ NPC busts
/** Stylised painted human head (front, slight 3/4 light). */
function humanHead(x, o) {
  const sk = o.skin || '#e0b090';
  // neck
  x.beginPath(); x.moveTo(42, 64); x.lineTo(58, 64); x.lineTo(60, 80); x.lineTo(40, 80); x.closePath(); skin(x, shade(sk, -0.15), 44, 66, 20);
  // head
  x.beginPath(); x.moveTo(50, 20); x.bezierCurveTo(64, 20, 70, 32, 69, 44); x.bezierCurveTo(68, 58, 62, 70, 50, 74); x.bezierCurveTo(38, 70, 32, 58, 31, 44); x.bezierCurveTo(30, 32, 36, 20, 50, 20); x.closePath();
  skin(x, sk, 42, 36, 40); outline(x, INK, 1.1);
  // ears
  for (const s of [-1, 1]) { x.beginPath(); x.ellipse(50 + s * 19, 48, 3, 5.5, 0, 0, TAU); skin(x, shade(sk, -0.1), 50 + s * 19 - 1, 46, 7); outline(x, INK, 0.8); }
  // cheek shadow (right)
  x.fillStyle = rg(x, 64, 56, 1, 16, [[0, rgba(shade(sk, -0.6), 0.35)], [1, rgba(shade(sk, -0.6), 0)]]); x.fillRect(48, 36, 24, 36);
  // eyes
  for (const s of [-1, 1]) {
    const ex = 50 + s * 8, ey = 46;
    x.beginPath(); x.moveTo(ex - 4.4, ey); x.quadraticCurveTo(ex, ey - 3.2, ex + 4.4, ey); x.quadraticCurveTo(ex, ey + 2.2, ex - 4.4, ey); x.closePath(); x.fillStyle = '#f4ece4'; x.fill();
    x.save(); x.clip(); if (o.eyeGlow) glow(x, ex, ey, 6, o.eyes, 0.9); x.fillStyle = o.eyes || '#4a6a8a'; circle(x, ex + 0.3, ey, 2); x.fill(); x.fillStyle = '#0a0a0a'; circle(x, ex + 0.3, ey, 0.9); x.fill(); x.fillStyle = '#ffffff'; circle(x, ex - 0.4, ey - 0.8, 0.5); x.fill(); x.restore();
    x.strokeStyle = INK; x.lineWidth = 0.9; x.beginPath(); x.moveTo(ex - 4.4, ey); x.quadraticCurveTo(ex, ey - 3.2, ex + 4.4, ey); x.stroke();
    // brow
    x.strokeStyle = o.brow || shade(o.hair || '#3a2a1a', -0.1); x.lineWidth = o.browW ?? 1.8; x.beginPath(); x.moveTo(ex - 5, ey - 5 + (o.frown ? s * -0.8 : 0)); x.quadraticCurveTo(ex, ey - 7, ex + 5, ey - 5 + (o.frown ? s * 0.8 : 0)); x.stroke();
  }
  // nose
  x.strokeStyle = rgba(shade(sk, -0.55), 0.8); x.lineWidth = 1; x.beginPath(); x.moveTo(51, 48); x.lineTo(53, 57); x.quadraticCurveTo(50, 59, 47.5, 57.5); x.stroke();
  // mouth
  x.strokeStyle = rgba(shade(sk, -0.6), 0.9); x.lineWidth = 1.1; x.beginPath(); x.moveTo(45, 63.5); x.quadraticCurveTo(50, o.smile ? 66.5 : 64.5, 55, 63.5); x.stroke();
  x.fillStyle = rgba(shade(sk, -0.25), 0.8); x.beginPath(); x.moveTo(46, 64.5); x.quadraticCurveTo(50, 67, 54, 64.5); x.quadraticCurveTo(50, 66, 46, 64.5); x.fill();
}
const N = {
  brannoc(x, R) { // grizzled knight commander of Brighthold
    backdrop(x, R, ['#6a7a9a', '#1e2638', '#05070c'], { shaft: false });
    // armour + blue cape
    x.beginPath(); x.moveTo(0, 100); x.bezierCurveTo(2, 84, 14, 76, 30, 74); x.lineTo(70, 74); x.bezierCurveTo(86, 76, 98, 84, 100, 100); x.closePath(); x.fillStyle = lg(x, 0, 74, 0, 100, [[0, '#2a4a8a'], [1, '#0a1428']]); x.fill(); outline(x, INK, 1.1);
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(50 + s * 30, 84, 20, 13, s * 0.25, 0, TAU); x.fillStyle = rg(x, 50 + s * 30 - 6, 78, 1, 22, [[0, '#ffffff'], [0.3, '#b8c4d0'], [0.7, '#4a5462'], [1, '#141820']]); x.fill(); outline(x, INK, 1); x.strokeStyle = metalLG(x, 30, 80, 70, 90, 'gold'); x.lineWidth = 1.6; x.beginPath(); x.ellipse(50 + s * 30, 86, 17, 9, s * 0.25, PI * 1.1, PI * 1.9); x.stroke(); }
    x.beginPath(); x.moveTo(32, 76); x.lineTo(68, 76); x.lineTo(64, 100); x.lineTo(36, 100); x.closePath(); x.fillStyle = metalLG(x, 32, 76, 68, 100, 'steel'); x.fill(); outline(x, INK, 1);
    humanHead(x, { skin: '#d0a07a', eyes: '#5a7a9a', hair: '#9a9a98', brow: '#c8c8c4', browW: 2.4, frown: true });
    // grey swept hair
    x.beginPath(); x.moveTo(30, 44); x.bezierCurveTo(28, 18, 50, 10, 64, 16); x.bezierCurveTo(72, 20, 72, 34, 70, 44); x.bezierCurveTo(66, 30, 58, 26, 46, 28); x.bezierCurveTo(38, 30, 34, 36, 30, 44); x.closePath();
    x.fillStyle = lg(x, 30, 14, 70, 44, [[0, '#e8e8e4'], [0.5, '#9a9a98'], [1, '#4a4a48']]); x.fill(); outline(x, INK, 0.9);
    // short grey beard
    x.beginPath(); x.moveTo(33, 54); x.bezierCurveTo(34, 70, 42, 80, 50, 80); x.bezierCurveTo(58, 80, 66, 70, 67, 54); x.bezierCurveTo(62, 62, 56, 66, 50, 66); x.bezierCurveTo(44, 66, 38, 62, 33, 54); x.closePath();
    x.fillStyle = lg(x, 33, 54, 67, 80, [[0, '#d8d8d4'], [1, '#6a6a68']]); x.fill(); outline(x, INK, 0.8);
    x.fillStyle = '#c8c8c4'; x.beginPath(); x.moveTo(42, 60); x.quadraticCurveTo(50, 57, 58, 60); x.quadraticCurveTo(50, 62, 42, 60); x.fill();
    // scar over the left eye
    x.strokeStyle = 'rgba(140,60,50,.9)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(39, 36); x.lineTo(44, 54); x.stroke();
  },
  seraphine(x, R) { // young oracle who hears the Shards sing
    backdrop(x, R, ['#e8d8a8', '#5a4a70', '#0c0814'], { shaft: false });
    rays(x, R, 50, 40, 14, 20, 60, '#fff4d0', { alpha: 0.35 });
    // hood + robe
    x.beginPath(); x.moveTo(50, 8); x.bezierCurveTo(78, 8, 86, 36, 84, 60); x.bezierCurveTo(90, 76, 100, 86, 100, 100); x.lineTo(0, 100); x.bezierCurveTo(0, 86, 10, 76, 16, 60); x.bezierCurveTo(14, 36, 22, 8, 50, 8); x.closePath();
    x.fillStyle = rg(x, 40, 24, 2, 80, [[0, '#ffffff'], [0.4, '#e8e4f0'], [0.8, '#8a86a0'], [1, '#2a283a']]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = metalLG(x, 16, 20, 84, 90, 'gold'); x.lineWidth = 2.2; x.beginPath(); x.moveTo(20, 80); x.bezierCurveTo(22, 40, 30, 16, 50, 14); x.bezierCurveTo(70, 16, 78, 40, 80, 80); x.stroke();
    x.beginPath(); x.moveTo(50, 16); x.bezierCurveTo(70, 18, 74, 44, 72, 60); x.quadraticCurveTo(62, 78, 50, 80); x.quadraticCurveTo(38, 78, 28, 60); x.bezierCurveTo(26, 44, 30, 18, 50, 16); x.closePath(); x.fillStyle = '#1a1424'; x.fill();
    humanHead(x, { skin: '#f4dcc8', eyes: '#ffd870', eyeGlow: true, hair: '#f0e0b0', brow: '#c8b080', browW: 1.2, smile: true });
    // pale hair framing the face
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50, 20); x.bezierCurveTo(50 + s * 18, 20, 50 + s * 22, 34, 50 + s * 20, 58); x.bezierCurveTo(50 + s * 18, 44, 50 + s * 12, 30, 50 + s * 2, 26); x.closePath(); x.fillStyle = lg(x, 50, 20, 50 + s * 20, 58, [[0, '#fffae0'], [1, '#c8b070']]); x.fill(); outline(x, INK, 0.7); }
    // circlet with shard gem
    x.strokeStyle = metalLG(x, 34, 28, 66, 34, 'gold'); x.lineWidth = 1.6; x.beginPath(); x.moveTo(33, 34); x.quadraticCurveTo(50, 26, 67, 34); x.stroke();
    gem(x, 50, 29, 3.2, '#7ad8ff', { n: 4, glowA: 0.9, lw: 0.5 });
  },
  bramblebeard(x, R) { // Pip elder: round sprout, moss beard, walking twig
    backdrop(x, R, ['#b8e080', '#3a6a28', '#0a1604'], { shaft: false });
    for (let i = 0; i < 8; i++) glow(x, R() * 100, R() * 60, 1 + R() * 2, '#f0ffc0', 0.6);
    // walking twig
    x.strokeStyle = lg(x, 80, 20, 90, 100, [[0, '#a07a4a'], [1, '#4a3018']]); x.lineWidth = 3.4; x.beginPath(); x.moveTo(82, 100); x.quadraticCurveTo(86, 60, 80, 24); x.stroke(); outline(x, INK, 0.5);
    leaf(x, 80, 26, 12, 4, -2.2, '#6ac850'); leaf(x, 81, 30, 10, 3.4, -0.4, '#5ab040');
    // round body/head
    circle(x, 48, 58, 34); x.fillStyle = rg(x, 38, 44, 2, 40, [[0, '#fff8d8'], [0.5, '#e0c078'], [1, '#7a5a24']]); x.fill(); outline(x, INK, 1.3);
    // sprout
    x.strokeStyle = '#3a7a2a'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(48, 25); x.quadraticCurveTo(46, 14, 52, 8); x.stroke();
    leaf(x, 52, 9, 24, 8, -0.4, '#6ac850'); leaf(x, 49, 14, 18, 6, -2.6, '#5ab040');
    // bushy moss brows + eyes
    for (const s of [-1, 1]) {
      x.fillStyle = '#1a1208'; ellipse(x, 48 + s * 11, 54, 5, 6); x.fill(); x.fillStyle = '#ffffff'; circle(x, 48 + s * 11 - 1.6, 51.6, 1.8); x.fill();
      x.beginPath(); x.ellipse(48 + s * 11, 45, 9, 4, s * -0.2, 0, TAU); x.fillStyle = lg(x, 40, 41, 60, 49, [[0, '#9ad060'], [1, '#3a6a20']]); x.fill(); outline(x, INK, 0.7);
    }
    // big moss beard
    x.beginPath(); x.moveTo(24, 62); x.bezierCurveTo(26, 78, 34, 96, 48, 100); x.bezierCurveTo(62, 96, 70, 78, 72, 62); x.bezierCurveTo(64, 70, 56, 72, 48, 70); x.bezierCurveTo(40, 72, 32, 70, 24, 62); x.closePath();
    x.fillStyle = lg(x, 24, 60, 72, 100, [[0, '#a8e070'], [0.5, '#5a9a38'], [1, '#1e3a10']]); x.fill(); outline(x, INK, 1);
    x.strokeStyle = 'rgba(20,50,10,.6)'; x.lineWidth = 0.8; for (let i = 0; i < 7; i++) { const px = 32 + i * 5.4; x.beginPath(); x.moveTo(px, 70); x.quadraticCurveTo(px + 1, 82, px - 1, 94); x.stroke(); }
    x.fillStyle = 'rgba(255,130,130,.45)'; ellipse(x, 28, 60, 4, 2.4); x.fill(); ellipse(x, 68, 60, 4, 2.4); x.fill();
    for (const [px, py] of [[36, 84], [58, 80], [46, 92]]) { x.fillStyle = '#ff9ad0'; circle(x, px, py, 1.6); x.fill(); }
  },
  merchant(x, R) { // travelling merchant
    backdrop(x, R, ['#c89a58', '#4a2e14', '#0a0603'], { shaft: false });
    // coat + coin purse
    x.beginPath(); x.moveTo(0, 100); x.bezierCurveTo(4, 84, 16, 76, 32, 74); x.lineTo(68, 74); x.bezierCurveTo(84, 76, 96, 84, 100, 100); x.closePath(); x.fillStyle = lg(x, 0, 74, 0, 100, [[0, '#7a2a3a'], [1, '#2a0a14']]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = metalLG(x, 30, 76, 70, 100, 'gold'); x.lineWidth = 2; x.beginPath(); x.moveTo(50, 76); x.lineTo(50, 100); x.stroke();
    humanHead(x, { skin: '#c8905a', eyes: '#3a2a1a', hair: '#2a1a0a', brow: '#2a1a0a', smile: true });
    // grand moustache
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50, 60); x.bezierCurveTo(50 + s * 6, 57, 50 + s * 14, 58, 50 + s * 20, 54); x.bezierCurveTo(50 + s * 16, 62, 50 + s * 8, 63, 50, 62.5); x.closePath(); x.fillStyle = '#2a1a0a'; x.fill(); outline(x, INK, 0.5); }
    // turban hat with feather + gem
    x.beginPath(); x.moveTo(28, 40); x.bezierCurveTo(26, 14, 74, 14, 72, 40); x.quadraticCurveTo(50, 32, 28, 40); x.closePath();
    x.fillStyle = rg(x, 40, 22, 2, 34, [[0, '#f0e0c0'], [0.5, '#c8a86a'], [1, '#6a4a1a']]); x.fill(); outline(x, INK, 1.1);
    x.strokeStyle = 'rgba(90,60,20,.6)'; x.lineWidth = 1; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(30, 36 - i * 7); x.quadraticCurveTo(50, 26 - i * 8, 70, 36 - i * 7); x.stroke(); }
    gem(x, 50, 32, 4, '#e02a4a', { n: 6, glowA: 0.5, lw: 0.5, spark: false });
    x.save(); x.translate(56, 30); x.rotate(-0.4); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(4, -10, 12, -20, 22, -24); x.bezierCurveTo(16, -14, 8, -6, 2, 2); x.closePath(); x.fillStyle = lg(x, 0, 0, 22, -24, [[0, '#2a8a6a'], [1, '#c0fff0']]); x.fill(); outline(x, INK, 0.7); x.restore();
    // coin purse
    x.beginPath(); x.moveTo(20, 84); x.bezierCurveTo(10, 90, 12, 100, 22, 100); x.lineTo(34, 100); x.bezierCurveTo(42, 100, 42, 90, 32, 84); x.closePath(); x.fillStyle = rg(x, 22, 88, 1, 14, [[0, '#c08a58'], [1, '#4a2808']]); x.fill(); outline(x, INK, 0.9);
    glow(x, 26, 84, 5, '#ffd070', 0.8);
  },
};

export const PORTRAIT_PAINT = {};
for (const k in B) PORTRAIT_PAINT[`boss:${k}`] = B[k];
for (const k in N) PORTRAIT_PAINT[`npc:${k}`] = N[k];
