// Demonbound — black, abyssal purple and blood red; glaive and claws. Also the shared `any` skills.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, slash, slashAB, streak, ring, rays, burst, embers, rocks, cracks,
  smoke, speedLines, backdrop, rgba, shade, mix, outline, fire, fireLayers, crystal, add, norm, glowPath, bez, qbez, ribbon,
  metalLG,
} from './core.js';
import { glaive, claws, chain, batWing, demonHead, eye, figure, clawMarks, greatsword, longsword, fist } from './motifs.js';

const PUR = '#b232ff', RED = '#ff2a3a', HOT = '#ffd0f0', BLOOD = '#c0101e';
const ABYSS = ['#4e1c50', '#180818', '#030103'];
const GORE = ['#8a1420', '#280408', '#050001'];
const HELL = fireLayers('#1a0022', '#6a10a0', '#e060ff', '#ffe8ff');
const glv = (x, px, py, rot, s, o = {}) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); glaive(x, { metal: 'obsidian', bands: 'crimson', ...o }); x.restore(); };
function drop(x, cx, cy, r, col = BLOOD) {
  x.beginPath(); x.moveTo(cx, cy - r * 1.6); x.bezierCurveTo(cx + r * 0.4, cy - r * 0.8, cx + r, cy - r * 0.2, cx + r, cy + r * 0.3); x.arc(cx, cy + r * 0.3, r, 0, PI); x.bezierCurveTo(cx - r, cy - r * 0.2, cx - r * 0.4, cy - r * 0.8, cx, cy - r * 1.6); x.closePath();
  x.fillStyle = rg(x, cx - r * 0.35, cy, 0, r * 1.4, [[0, '#ff8a8a'], [0.4, col], [1, shade(col, -0.6)]]); x.fill(); outline(x, 'rgba(20,0,0,.8)', 0.6);
}

export const DEMONBOUND = {
  demonic_slash(x, R) {
    backdrop(x, R, ABYSS, { angle: 0.8 });
    glow(x, 52, 46, 44, PUR, 0.55);
    slashAB(x, 8, 76, 90, 14, 20, 14, PUR, { hot: '#f0c0ff' });
    slashAB(x, 14, 82, 92, 26, 16, 4, RED);
    glv(x, 30, 92, 0.75, 0.9, { glow: PUR, edge: MAG() });
    embers(x, R, 14, 56, 44, 36, [PUR, RED, HOT]);
  },
  ruining_rush(x, R) {
    backdrop(x, R, ABYSS, { angle: 0 });
    speedLines(x, R, 18, [0, 20, 70, 84], 0, '#d8a0ff', { len: 34, w: 1.8 });
    fire(x, R, 40, 52, 60, 34, -PI / 2, { n: 6, layers: HELL });
    glow(x, 78, 52, 30, RED, 0.8);
    burst(x, R, 82, 52, 10, 5, 20, RED);
    glv(x, 24, 58, PI / 2 - 0.05, 0.85, { glow: PUR, edge: RED });
  },
  cruel_cutter(x, R) {
    backdrop(x, R, ABYSS);
    glow(x, 54, 48, 40, PUR, 0.55);
    slash(x, 54, 48, 34, -PI * 0.1, PI * 1.2, 9, PUR, { bias: 1.3 });
    slash(x, 54, 48, 34, PI * 0.9, PI * 2.2, 6, RED, { bias: 1.3 });
    x.save(); x.translate(54, 48); x.rotate(0.6);
    for (let i = 0; i < 2; i++) { x.save(); x.rotate(i * PI); x.translate(0, 34); glaive(x, { len: 56, blade: 22, glow: PUR, edge: RED }); x.restore(); }
    x.restore();
    x.fillStyle = rg(x, 54, 48, 0, 6, [[0, '#ffffff'], [1, '#6a1a8a']]); circle(x, 54, 48, 4.5); x.fill();
  },
  blood_massacre(x, R) {
    backdrop(x, R, GORE);
    glow(x, 50, 50, 48, RED, 0.6);
    slashAB(x, 10, 20, 90, 84, 16, 12, RED, { hot: '#ffb0b0' });
    slashAB(x, 90, 16, 12, 86, 16, 12, RED, { hot: '#ffb0b0' });
    burst(x, R, 50, 50, 12, 6, 26, RED);
    for (let i = 0; i < 9; i++) { const a = R() * TAU, d = 20 + R() * 22; drop(x, 50 + Math.cos(a) * d, 50 + Math.sin(a) * d, 2 + R() * 2.4); }
  },
  grind_chain(x, R) {
    backdrop(x, R, ['#7a3a4a', '#260a14', '#050103'], { angle: 0.6 });
    glow(x, 44, 58, 44, RED, 0.55);
    const f = bez([94, 10], [58, 6], [74, 72], [28, 70]);
    streak(x, 90, 12, 34, 68, 8, RED, { a: 0.45 });
    chain(x, f, 16, 3.8, 'steel', { glow: RED });
    x.save(); x.translate(26, 70); x.rotate(PI * 0.1); x.scale(1.3, 1.3);
    x.beginPath(); x.moveTo(0, -3); x.bezierCurveTo(-12, -3, -16, 8, -8, 14); x.lineTo(-7, 8); x.bezierCurveTo(-10, 4, -6, 1, 0, 3); x.closePath();
    x.fillStyle = metalLG(x, -16, -3, 0, 14, 'steel'); x.fill(); outline(x, 'rgba(0,0,0,.9)', 0.8);
    poly(x, [[-9, 9], [-15, 12], [-9, 13]]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 0.6); x.restore();
    speedLines(x, R, 10, [30, 20, 96, 80], -0.7, '#ffb0b8', { len: 18, w: 1.3 });
    embers(x, R, 10, 30, 66, 22, [RED, HOT]);
  },
  thrust_of_destruction(x, R) {
    backdrop(x, R, ABYSS, { cy: 70 });
    glow(x, 50, 24, 40, PUR, 0.7);
    rays(x, R, 50, 20, 14, 10, 40, '#e0a0ff', { alpha: 0.5 });
    burst(x, R, 50, 20, 12, 6, 24, PUR);
    ring(x, 50, 24, 20, 8, HOT, 1.4);
    glv(x, 50, 104, 0, 1.05, { glow: PUR, edge: HOT });
    speedLines(x, R, 10, [20, 40, 80, 100], -PI / 2, '#d8a0ff', { len: 24, w: 1.4 });
  },
  demolition(x, R) {
    backdrop(x, R, ['#5a2060', '#1a081c', '#040104'], { cy: 30 });
    x.fillStyle = lg(x, 0, 60, 0, 100, [[0, 'rgba(10,0,10,0)'], [1, 'rgba(10,0,10,.9)']]); x.fillRect(0, 60, 100, 40);
    glow(x, 50, 76, 44, PUR, 0.6);
    cracks(x, R, 50, 82, 8, 40, PUR, { sy: 0.3, w: 1.2 });
    for (const [px, py, l, w, a] of [[50, 86, 58, 16, -PI / 2], [30, 88, 40, 12, -PI / 2 - 0.35], [70, 88, 42, 12, -PI / 2 + 0.35], [16, 90, 24, 8, -PI / 2 - 0.6], [86, 90, 26, 8, -PI / 2 + 0.6]]) crystal(x, px, py, l, w, a, '#8a2ab0', { glowA: 0.3 });
    rocks(x, R, 10, 50, 76, 40, { cols: ['#4a3040', '#200e1a'], a0: PI, arc: PI, size: 2.6, hot: PUR });
  },
  soul_chain(x, R) {
    backdrop(x, R, ABYSS);
    glow(x, 50, 50, 44, '#9a7aff', 0.5);
    for (let k = 0; k < 3; k++) { const rot = k * 1.05; chain(x, t => { const a = t * TAU; return [50 + Math.cos(a) * 34 * Math.cos(rot) - Math.sin(a) * 12 * Math.sin(rot), 50 + Math.cos(a) * 34 * Math.sin(rot) + Math.sin(a) * 12 * Math.cos(rot)]; }, 22, 2.6, 'dark', { glow: '#b090ff' }); }
    // captured soul
    glow(x, 50, 50, 18, '#c0b0ff', 1);
    x.beginPath(); x.moveTo(50, 36); x.bezierCurveTo(60, 40, 60, 56, 54, 62); x.quadraticCurveTo(50, 66, 46, 62); x.bezierCurveTo(40, 56, 40, 40, 50, 36); x.closePath();
    x.fillStyle = rg(x, 48, 46, 1, 16, [[0, '#ffffff'], [0.5, '#d8d0ff'], [1, 'rgba(160,140,255,.3)']]); x.fill();
    x.fillStyle = '#2a1a4a'; ellipse(x, 47, 47, 1.4, 2.2); x.fill(); ellipse(x, 53, 47, 1.4, 2.2); x.fill();
  },
  blood_pillars(x, R) {
    backdrop(x, R, GORE, { cy: 30 });
    x.fillStyle = lg(x, 0, 70, 0, 100, [[0, 'rgba(20,0,0,0)'], [1, 'rgba(20,0,0,.9)']]); x.fillRect(0, 70, 100, 30);
    for (const [px, h, w] of [[26, 58, 13], [52, 76, 16], [76, 50, 12]]) {
      glow(x, px, 90 - h / 2, h * 0.6, RED, 0.45);
      add(x); x.fillStyle = lg(x, px - w, 0, px + w, 0, [[0, rgba(RED, 0)], [0.25, rgba(BLOOD, 0.9)], [0.5, rgba('#ff9a9a', 1)], [0.75, rgba(BLOOD, 0.9)], [1, rgba(RED, 0)]]); poly(x, [[px - w / 2, 90], [px - w * 0.3, 90 - h], [px + w * 0.3, 90 - h], [px + w / 2, 90]]); x.fill(); norm(x);
      ring(x, px, 90, w, w * 0.3, RED, 1.2);
      for (let i = 0; i < 3; i++) drop(x, px + (R() - 0.5) * w * 1.6, 90 - h - 4 - R() * 10, 1.6 + R() * 1.4);
    }
  },
  howl(x, R) {
    backdrop(x, R, ['#5a2a7a', '#1a0826', '#040106'], { cy: 70, cx: 30 });
    glow(x, 36, 66, 40, PUR, 0.6);
    for (let i = 0; i < 4; i++) glowPath(x, xx => { xx.beginPath(); xx.arc(36, 66, 24 + i * 12, -PI * 0.55, PI * 0.05); }, i % 2 ? '#e0a0ff' : PUR, 2.8 - i * 0.5);
    for (const [px, py, s] of [[76, 22, 1], [86, 46, 0.8], [62, 12, 0.7]]) { x.save(); x.translate(px, py); x.scale(s, s); x.globalAlpha = 0.75; x.beginPath(); x.moveTo(0, -9); x.bezierCurveTo(7, -9, 8, -2, 7, 3); x.lineTo(8, 9); x.lineTo(4, 7); x.lineTo(0, 10); x.lineTo(-4, 7); x.lineTo(-8, 9); x.lineTo(-7, 3); x.bezierCurveTo(-8, -2, -7, -9, 0, -9); x.closePath(); x.fillStyle = '#e8d0ff'; x.fill(); x.fillStyle = '#2a0a3a'; ellipse(x, -2.6, -2, 1.4, 2); x.fill(); ellipse(x, 2.6, -2, 1.4, 2); x.fill(); x.globalAlpha = 1; x.restore(); }
    x.save(); x.translate(34, 68); x.rotate(-0.35); x.scale(0.82, 0.82); demonHead(x, { skin: '#3a1a4a', eye: '#ff3a8a' }); x.restore();
    x.beginPath(); x.ellipse(38, 80, 6, 6.5, -0.35, 0, TAU); x.fillStyle = '#12020a'; x.fill(); glow(x, 38, 80, 9, PUR, 0.7);
  },
  leaping_blow(x, R) {
    backdrop(x, R, ABYSS, { cy: 30 });
    glow(x, 50, 86, 40, PUR, 0.65);
    ring(x, 50, 88, 36, 8, PUR, 1.8);
    cracks(x, R, 50, 88, 7, 30, PUR, { sy: 0.3, w: 1 });
    slashAB(x, 14, 66, 62, 84, -14, 7, PUR, { hot: '#f0c0ff' });
    figure(x, { head: [54, 24], neck: [52, 30], sh: [[44, 32], [58, 34]], el: [[40, 20], [62, 22]], ha: [[46, 12], [56, 12]], hip: [48, 52], kn: [[38, 58], [60, 52]], ft: [[30, 70], [66, 64]] }, { col: '#0a040e', rim: '#d080ff', s: 1.25 });
    glv(x, 52, 16, 0.55, 0.78, { glow: PUR, edge: RED });
    speedLines(x, R, 8, [20, 30, 80, 60], PI / 2 + 0.3, '#d8a0ff', { len: 16, w: 1 });
  },
  demon_vision(x, R) {
    backdrop(x, R, GORE);
    glow(x, 50, 50, 44, RED, 0.6);
    rays(x, R, 50, 50, 14, 20, 50, '#ff6a6a', { alpha: 0.4 });
    x.save(); x.translate(50, 50); eye(x, 72, '#ff3a2a', { open: 0.4, slit: true, white: '#1a0406', lw: 1.6 }); x.restore();
    glow(x, 50, 50, 10, '#ffb070', 0.8);
  },
  identity_z(x, R) { // Demonform
    backdrop(x, R, ['#5a1a60', '#1a061c', '#030103']);
    glow(x, 50, 50, 48, PUR, 0.6);
    fire(x, R, 50, 98, 60, 80, 0, { n: 8, layers: HELL });
    x.save(); x.translate(50, 46); batWing(x, -1, 0.8, '#3a1a44', { fire: PUR }); batWing(x, 1, 0.8, '#3a1a44', { fire: PUR }); x.restore();
    x.save(); x.translate(50, 56); demonHead(x, { skin: '#2e1236', eye: '#ff3a2a' }); x.restore();
  },
  identity_x(x, R) { // Revert: the demon mask cracks, light pours through
    backdrop(x, R, ['#6a4a70', '#1e1220', '#040204']);
    glow(x, 50, 52, 44, '#ffe0c0', 0.5);
    x.save(); x.translate(50, 56); demonHead(x, { skin: '#4a2a50', eye: '#ffffff' }); x.restore();
    glowPath(x, xx => poly(xx, [[50, 30], [46, 42], [54, 50], [47, 62], [53, 74], [49, 84]], false), '#ffe8c0', 1.6);
    glowPath(x, xx => poly(xx, [[46, 42], [36, 46], [30, 58]], false), '#ffe8c0', 1);
    rays(x, R, 50, 56, 10, 10, 50, '#fff0d8', { alpha: 0.35 });
  },
  awakening(x, R) { // Abyssal Rupture: the world tears open onto the Abyss
    backdrop(x, R, ['#6a1a3a', '#1c0410', '#020001']);
    glow(x, 50, 52, 50, PUR, 0.5);
    const tear = [[6, 92], [20, 70], [16, 62], [34, 52], [30, 42], [50, 34], [48, 24], [66, 18], [70, 8], [84, 4], [74, 20], [78, 30], [60, 40], [66, 50], [46, 60], [52, 70], [32, 80], [34, 90]];
    poly(x, tear); x.fillStyle = rg(x, 46, 48, 2, 44, [[0, '#000000'], [0.7, '#0e0216'], [1, '#3a0a4a']]); x.fill();
    glowPath(x, xx => poly(xx, tear, true), PUR, 2.2);
    for (const [ex, ey, s] of [[46, 44, 1], [32, 64, 0.8], [62, 26, 0.8], [24, 78, 0.6], [56, 54, 0.6]]) { for (const d of [-1, 1]) { glow(x, ex + d * 3 * s, ey, 5 * s, RED, 1); x.fillStyle = '#ffd0c0'; ellipse(x, ex + d * 3 * s, ey, 1.8 * s, 0.7 * s, d * 0.3); x.fill(); } }
    for (let i = 0; i < 8; i++) { const t = R(), p = tear[(t * (tear.length - 1)) | 0]; streak(x, p[0], p[1], p[0] + (R() - 0.3) * 30, p[1] - 10 - R() * 20, 1.6, '#e060ff', { bias: 0.5 }); }
    rocks(x, R, 12, 50, 50, 44, { cols: ['#4a2a3a', '#1a0a12'], size: 2.4, hot: PUR });
  },
  abyss_claw(x, R) {
    backdrop(x, R, ABYSS, { angle: 0.8 });
    glow(x, 50, 50, 44, PUR, 0.6);
    clawMarks(x, 50, 50, 1.25, PUR, 0.5, 3);
    embers(x, R, 14, 50, 50, 40, [PUR, HOT]);
  },
  rending_talons(x, R) {
    backdrop(x, R, GORE, { angle: 0.7 });
    glow(x, 50, 50, 46, RED, 0.55);
    clawMarks(x, 54, 50, 1.2, RED, -0.55, 4);
    // three hooked talons raking through
    for (const [dx, dy] of [[-12, 6], [0, 0], [12, -6]]) { x.save(); x.translate(26 + dx, 30 + dy); x.rotate(-0.6); ribbon(x, bez([0, 0], [10, 6], [18, 18], [14, 30]), t => 6 * (1 - t) + 0.4, 20); x.fillStyle = lg(x, 0, 0, 14, 30, [[0, '#3a1a1a'], [0.4, '#c8b8a8'], [1, '#ffffff']]); x.fill(); outline(x, 'rgba(0,0,0,.9)', 0.8); x.restore(); }
    for (let i = 0; i < 6; i++) drop(x, 56 + R() * 34, 50 + R() * 40, 1.6 + R() * 1.8);
  },
  hellfire_wings(x, R) {
    backdrop(x, R, ['#6a1a3a', '#1e0612', '#030101']);
    glow(x, 50, 56, 50, '#ff4a6a', 0.55);
    fire(x, R, 50, 100, 50, 90, 0, { n: 9, layers: fireLayers('#2a0010', '#a01040', '#ff6a8a', '#ffe0e8') });
    x.save(); x.translate(50, 56); batWing(x, -1, 1.02, '#2a0a1a', { fire: '#ff5a7a' }); batWing(x, 1, 1.02, '#2a0a1a', { fire: '#ff5a7a' }); x.restore();
    glow(x, 50, 56, 12, '#ffb0c0', 0.9);
  },
  demonic_slam(x, R) {
    backdrop(x, R, ABYSS, { cy: 30 });
    x.fillStyle = lg(x, 0, 64, 0, 100, [[0, 'rgba(10,0,10,0)'], [1, 'rgba(10,0,10,.9)']]); x.fillRect(0, 64, 100, 36);
    glow(x, 50, 80, 46, PUR, 0.75);
    ring(x, 50, 84, 42, 11, PUR, 2.2);
    ring(x, 50, 84, 24, 6, HOT, 1.2);
    cracks(x, R, 50, 84, 9, 44, RED, { sy: 0.3, w: 1.2 });
    x.save(); x.translate(50, 22); x.rotate(PI / 2); x.scale(1.5, 1.5); fist(x, { metal: 'obsidian', trim: 'crimson', cuff: '#2a0a2a', glow: PUR }); x.restore();
    rocks(x, R, 12, 50, 74, 42, { cols: ['#4a3040', '#1a0a14'], a0: PI, arc: PI, size: 3, hot: PUR });
  },
};
function MAG() { return '#ff6af0'; }

// ------------------------------------------------------------------ shared skills
export const ANY = {
  dash(x, R) {
    backdrop(x, R, ['#4a6a9a', '#141e34', '#03050a'], { angle: 0 });
    speedLines(x, R, 22, [0, 16, 80, 90], 0, '#c8e0ff', { len: 34, w: 1.8 });
    glow(x, 64, 54, 34, '#8ac8ff', 0.5);
    const pose = dx => ({ head: [60 + dx, 30], neck: [57 + dx, 36], sh: [[50 + dx, 38], [62 + dx, 40]], el: [[42 + dx, 46], [66 + dx, 50]], ha: [[34 + dx, 42], [72 + dx, 56]], hip: [50 + dx, 60], kn: [[62 + dx, 70], [40 + dx, 72]], ft: [[70 + dx, 86], [26 + dx, 80]] });
    for (const [dx, a] of [[-30, 0.18], [-16, 0.35]]) { x.globalAlpha = a; figure(x, pose(dx), { col: '#8ab8ff', s: 1.15 }); }
    x.globalAlpha = 1; figure(x, pose(0), { col: '#0a1020', rim: '#b8dcff', s: 1.15 });
    smoke(x, R, 5, 30, 86, 20, '#8a9ab0', 0.3, 8);
  },
  basic(x, R) {
    backdrop(x, R, ['#6a7486', '#1c2029', '#050608'], { angle: 0.8 });
    glow(x, 52, 46, 40, '#e8eef8', 0.35);
    slashAB(x, 12, 74, 88, 18, 16, 10, '#e8eef8', { hot: '#ffffff' });
    x.save(); x.translate(28, 84); x.rotate(0.72); x.scale(0.95, 0.95); longsword(x, { metal: 'steel', guard: 'iron' }); x.restore();
    sparkle(x, 84, 20, 8);
  },
};
export { greatsword };
