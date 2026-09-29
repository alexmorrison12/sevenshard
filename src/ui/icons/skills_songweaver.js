// Songweaver — rose-gold harp, teal notes.
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, slash, slashAB, streak, ring, rays, burst, embers,
  speedLines, backdrop, rgba, shade, mix, outline, bolt, runeCircle, add, norm, glowPath, clouds, note, metalLG, ribbon, bez, qbez,
} from './core.js';
import { harp, featherWing } from './motifs.js';

const ROSE = '#f5a890', TEAL = '#36d8c6', GOLD = '#ffd27a', PINK = '#ff7ab0', HOT = '#fff4ec';
const DUSK = ['#b86e70', '#3a1a2a', '#070309'];
const SEA = ['#2a8a8a', '#0a2a30', '#020607'];
const at = (x, px, py, rot, s, fn, o) => { x.save(); x.translate(px, py); x.rotate(rot); x.scale(s, s); fn(x, o); x.restore(); };
/** Stylised treble clef centred at (cx,cy), height ~44·s. */
function clef(x, cx, cy, s, col) {
  x.save(); x.translate(cx, cy); x.scale(s, s);
  const path = () => {
    x.beginPath();
    x.moveTo(2, 24); x.bezierCurveTo(-6, 26, -8, 18, -2, 16); // bottom hook
    x.moveTo(0, 20); x.bezierCurveTo(2, 6, 6, -14, 2, -22); x.bezierCurveTo(-2, -28, -8, -20, -4, -12); // stem up to the top loop
    x.bezierCurveTo(0, -4, 12, 2, 10, 10); x.bezierCurveTo(8, 18, -10, 18, -10, 8); x.bezierCurveTo(-10, 0, 0, -2, 4, 4); x.bezierCurveTo(6, 8, 2, 12, -2, 10);
  };
  x.lineCap = 'round';
  x.save(); add(x); x.strokeStyle = rgba(col, 0.35); x.lineWidth = 8; path(); x.stroke(); norm(x); x.restore();
  x.strokeStyle = 'rgba(20,4,10,.9)'; x.lineWidth = 5.2; path(); x.stroke();
  x.strokeStyle = lg(x, -10, -24, 10, 24, [[0, '#ffffff'], [0.4, mix(col, '#ffffff', 0.4)], [1, col]]); x.lineWidth = 3.2; path(); x.stroke();
  x.fillStyle = '#ffffff'; circle(x, 2, 24, 2.6); x.fill(); x.strokeStyle = 'rgba(20,4,10,.9)'; x.lineWidth = 0.8; x.stroke();
  x.restore();
}
/** War horn (anthem) mouthpiece at left, bell at (0,0) facing right. */
function horn(x, s = 1) {
  x.save(); x.scale(s, s);
  ribbon(x, qbez([-40, 12], [-22, 20], [0, 0]), t => 3 + t * t * 22, 24);
  x.fillStyle = lg(x, -40, -10, 0, 20, [[0, '#6a3a10'], [0.3, '#ffd87a'], [0.55, '#fff4c8'], [0.75, '#c48a22'], [1, '#5a3408']]); x.fill(); outline(x, 'rgba(30,12,0,.9)', 1);
  x.fillStyle = rg(x, 2, 0, 1, 12, [[0, '#1a0a02'], [0.7, '#5a3408'], [1, '#c48a22']]); ellipse(x, 0.5, 0, 4.5, 12, 0.5); x.fill(); outline(x, 'rgba(30,12,0,.9)', 1);
  for (const t of [0.3, 0.6]) { const p = qbez([-40, 12], [-22, 20], [0, 0])(t); x.strokeStyle = metalLG(x, p[0] - 3, p[1] - 6, p[0] + 3, p[1] + 6, 'dark'); x.lineWidth = 1.6; x.beginPath(); x.moveTo(p[0] - 1, p[1] - (3 + t * t * 22) / 2); x.lineTo(p[0] + 1, p[1] + (3 + t * t * 22) / 2); x.stroke(); }
  x.restore();
}

export const SONGWEAVER = {
  sound_shock(x, R) {
    backdrop(x, R, SEA, { angle: 0 });
    glow(x, 40, 52, 40, TEAL, 0.55);
    for (let i = 0; i < 4; i++) { const r = 16 + i * 11; glowPath(x, xx => { xx.beginPath(); xx.arc(30, 52, r, -0.75, 0.75); }, TEAL, 2.6 - i * 0.35); }
    note(x, 28, 60, 1.35, TEAL, 0);
    sparkle(x, 88, 52, 8, HOT);
  },
  harp_of_rhythm(x, R) {
    backdrop(x, R, DUSK);
    glow(x, 50, 52, 40, TEAL, 0.45);
    x.save(); add(x); x.lineWidth = 1.2; x.strokeStyle = rgba(TEAL, 0.6); ellipse(x, 50, 54, 40, 16, -0.2); x.stroke(); norm(x); x.restore();
    at(x, 50, 78, 0, 1.1, harp, { gem: TEAL });
    for (const [px, py, k, c] of [[14, 50, 0, TEAL], [84, 58, 1, PINK], [30, 72, 0, GOLD], [74, 36, 0, TEAL]]) note(x, px, py, 0.8, c, k);
  },
  stigma(x, R) {
    backdrop(x, R, ['#a03a6a', '#2e0c20', '#060106']);
    glow(x, 50, 50, 42, PINK, 0.55);
    rays(x, R, 50, 50, 12, 20, 50, PINK, { alpha: 0.45, spread: 0.1 });
    x.lineWidth = 3; x.strokeStyle = metalLG(x, 20, 20, 80, 80, 'rose'); circle(x, 50, 50, 30); x.stroke(); outline(x, 'rgba(40,0,20,.8)', 0.8);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; poly(x, [[50 + Math.cos(a - 0.06) * 31, 50 + Math.sin(a - 0.06) * 31], [50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38], [50 + Math.cos(a + 0.06) * 31, 50 + Math.sin(a + 0.06) * 31]]); x.fillStyle = mix(ROSE, '#ffffff', 0.3); x.fill(); }
    clef(x, 50, 50, 1.0, PINK);
  },
  guardian_tune(x, R) {
    backdrop(x, R, SEA);
    glow(x, 50, 52, 44, TEAL, 0.5);
    x.save(); add(x);
    x.fillStyle = rg(x, 42, 42, 4, 36, [[0, rgba('#ffffff', 0.3)], [0.7, rgba(TEAL, 0.12)], [1, rgba(TEAL, 0.45)]]); circle(x, 50, 52, 34); x.fill();
    x.lineWidth = 1.8; x.strokeStyle = rgba('#b0fff4', 0.8); circle(x, 50, 52, 34); x.stroke();
    x.lineWidth = 3; x.strokeStyle = rgba('#ffffff', 0.5); x.beginPath(); x.arc(50, 52, 29, PI * 1.1, PI * 1.45); x.stroke();
    norm(x); x.restore();
    // hexagon lattice hint
    x.strokeStyle = rgba('#b0fff4', 0.3); x.lineWidth = 0.7;
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; x.beginPath(); x.moveTo(50, 52); x.lineTo(50 + Math.cos(a) * 34, 52 + Math.sin(a) * 34); x.stroke(); }
    note(x, 44, 60, 1.2, TEAL, 1);
    sparkle(x, 34, 34, 7);
  },
  heavenly_tune(x, R) {
    backdrop(x, R, ['#c89040', '#3a240a', '#070402']);
    rays(x, R, 50, 50, 16, 14, 60, '#ffe0a0', { alpha: 0.45 });
    glow(x, 50, 50, 44, GOLD, 0.6);
    x.save(); x.translate(46, 44); featherWing(x, -1, 0.5, ['#ffffff', '#ffe8b0', '#b08a40'], 7); featherWing(x, 1, 0.5, ['#ffffff', '#ffe8b0', '#b08a40'], 7); x.restore();
    note(x, 44, 62, 1.4, GOLD, 0);
    for (const [px, py] of [[78, 70], [22, 74]]) { x.save(); x.translate(px, py); x.fillStyle = lg(x, 0, -8, 0, 8, [[0, '#ffffff'], [1, '#ff9a40']]); poly(x, [[0, -8], [6, 0], [2.4, 0], [2.4, 7], [-2.4, 7], [-2.4, 0], [-6, 0]]); x.fill(); outline(x, 'rgba(60,20,0,.8)', 0.8); x.restore(); }
  },
  rhapsody_of_light(x, R) {
    backdrop(x, R, DUSK, { cy: 30 });
    glow(x, 50, 50, 40, GOLD, 0.55);
    add(x); x.fillStyle = lg(x, 32, 0, 68, 0, [[0, rgba(GOLD, 0)], [0.35, rgba(GOLD, 0.45)], [0.5, rgba('#fff8e8', 0.95)], [0.65, rgba(GOLD, 0.45)], [1, rgba(GOLD, 0)]]); poly(x, [[40, 0], [60, 0], [64, 90], [36, 90]]); x.fill(); norm(x);
    ring(x, 50, 88, 26, 6, GOLD, 1.5);
    for (let i = 0; i < 5; i++) { const t = i / 4, a = t * TAU * 1.2; note(x, 50 + Math.cos(a) * 22, 80 - t * 62, 0.55 + t * 0.2, i % 2 ? ROSE : GOLD, 0); }
  },
  wind_of_music(x, R) {
    backdrop(x, R, ['#3aa088', '#0c3028', '#020706'], { angle: 0 });
    glow(x, 50, 50, 40, '#7affc8', 0.45);
    add(x);
    for (let i = 0; i < 4; i++) { const y0 = 30 + i * 13, f = bez([0, y0 + 8], [34, y0 - 12], [64, y0 + 16], [100, y0 - 4]); ribbon(x, f, t => 3.4 * Math.sin(PI * t) + 0.2, 24); x.fillStyle = rgba(i % 2 ? '#7affc8' : '#e0fff4', 0.55); x.fill(); }
    norm(x);
    for (const [px, py, s, c] of [[24, 40, 0.8, '#e0fff4'], [52, 58, 1, TEAL], [78, 36, 0.75, GOLD]]) note(x, px, py, s, c, 0, { rot: 0.25 });
    speedLines(x, R, 8, [0, 20, 60, 80], 0, '#e0fff4', { len: 20, w: 1 });
  },
  sonic_vibration(x, R) {
    backdrop(x, R, ['#9a3a8a', '#2a0c28', '#060106'], { cy: 30 });
    glow(x, 50, 72, 44, PINK, 0.55);
    for (let i = 0; i < 4; i++) ring(x, 50, 74, 12 + i * 10, (12 + i * 10) * 0.32, i % 2 ? PINK : '#ffc0e0', 1.8 - i * 0.2, 1 - i * 0.15);
    burst(x, R, 50, 72, 10, 4, 16, PINK, { sy: 0.6 });
    note(x, 50, 44, 1.2, PINK, 1);
    for (let i = 0; i < 3; i++) glowPath(x, xx => { xx.beginPath(); xx.arc(50, 72, 20 + i * 10, PI * 1.15, PI * 1.85); }, '#ffc0e0', 1);
  },
  prelude_of_storm(x, R) {
    backdrop(x, R, ['#4a3a8a', '#141030', '#030208'], { cy: 30, shaft: false });
    clouds(x, R, 50, 12, 112, 18, ['#e0d8ff', '#6a5aa0', '#1c1438'], 9);
    glow(x, 50, 62, 40, TEAL, 0.5);
    bolt(x, R, 32, 28, 26, 80, { col: TEAL, w: 1.8, gens: 5 });
    bolt(x, R, 70, 28, 78, 76, { col: '#b8a8ff', w: 1.6, gens: 5 });
    for (let i = 0; i < 3; i++) glowPath(x, xx => { xx.beginPath(); for (let t = 0; t <= 1.001; t += 0.04) { const a = t * TAU + i * 2.1, r = 10 + t * 20; const px = 50 + Math.cos(a) * r, py = 64 + Math.sin(a) * r * 0.5 - t * 10; t ? xx.lineTo(px, py) : xx.moveTo(px, py); } }, TEAL, 1.2);
    note(x, 44, 70, 1, TEAL, 1);
  },
  rhythm_buckshot(x, R) {
    backdrop(x, R, DUSK, { angle: 0 });
    glow(x, 60, 50, 40, ROSE, 0.45);
    for (const [px, py, s, c] of [[72, 26, 0.75, TEAL], [84, 50, 0.95, ROSE], [70, 74, 0.75, GOLD], [52, 40, 0.6, TEAL], [52, 62, 0.6, PINK]]) { streak(x, px - 40, 50 + (py - 50) * 0.3, px - 4, py, 3.2 * s, c, { a: 0.6, bias: 2 }); note(x, px, py + 4, s, c, 0); }
    burst(x, R, 16, 50, 8, 4, 14, ROSE);
  },
  soundholic(x, R) {
    backdrop(x, R, ['#b0508a', '#360c28', '#070106']);
    glow(x, 50, 52, 46, PINK, 0.7);
    for (let i = 0; i < 4; i++) ring(x, 50, 52, 14 + i * 9, 14 + i * 9, i % 2 ? PINK : ROSE, 1.8 - i * 0.3, 1 - i * 0.18);
    x.fillStyle = rg(x, 46, 46, 1, 14, [[0, '#ffffff'], [0.5, '#ffd0e8'], [1, rgba(PINK, 0.2)]]); circle(x, 50, 52, 12); x.fill();
    note(x, 47, 56, 0.85, '#ffffff', 1, { fill: '#ffffff' });
  },
  tempest_chord(x, R) {
    backdrop(x, R, SEA);
    glow(x, 50, 50, 44, TEAL, 0.6);
    // taut strings plucked into a shock
    for (let i = 0; i < 6; i++) { const xx0 = 22 + i * 11; glowPath(x, xx => { xx.beginPath(); xx.moveTo(xx0, 6); xx.quadraticCurveTo(xx0 + (i % 2 ? 7 : -7), 50, xx0, 94); }, i % 2 ? TEAL : '#b0fff4', 1.1); }
    burst(x, R, 50, 50, 12, 6, 26, TEAL);
    ring(x, 50, 50, 20, 20, '#ffffff', 1.2, 0.7);
    sparkle(x, 50, 50, 13);
  },
  identity_z(x, R) { // Anthem of Courage: the war horn sounds
    backdrop(x, R, ['#c0502a', '#3a120a', '#070201'], { angle: 0 });
    glow(x, 62, 44, 40, '#ffb050', 0.6);
    for (let i = 0; i < 3; i++) glowPath(x, xx => { xx.beginPath(); xx.arc(60, 44, 14 + i * 10, -0.8, 0.8); }, '#ffd080', 2 - i * 0.4);
    at(x, 58, 44, -0.2, 1, horn, 1);
    for (const [px, py, c] of [[84, 24, GOLD], [90, 58, '#ff8a60'], [76, 72, GOLD]]) note(x, px, py, 0.7, c, 0);
  },
  identity_x(x, R) { // Hymn of Mending
    backdrop(x, R, ['#4aa070', '#10301c', '#020604']);
    glow(x, 50, 50, 44, '#a0ffb8', 0.6);
    runeCircle(x, R, 50, 78, 34, '#a0ffc0', { sy: 0.3, points: 6, w: 1 });
    for (let i = 0; i < 12; i++) glow(x, 16 + R() * 68, 20 + R() * 60, 1.5 + R() * 2.4, i % 2 ? '#d8ffe0' : TEAL, 0.8);
    poly(x, [[65, 18], [71, 18], [71, 26], [79, 26], [79, 32], [71, 32], [71, 40], [65, 40], [65, 32], [57, 32], [57, 26], [65, 26]]); x.fillStyle = lg(x, 57, 18, 79, 40, [[0, '#ffffff'], [1, '#70d890']]); x.fill(); outline(x, 'rgba(10,50,20,.8)', 0.9);
    note(x, 44, 60, 1.45, '#8affc0', 0);
  },
  awakening(x, R) { // Grand Finale: the harp blazes, notes rain down
    backdrop(x, R, ['#e0a080', '#5a2030', '#0a0306'], { cy: 46 });
    rays(x, R, 50, 50, 24, 12, 64, '#fff0e0', { alpha: 0.5 });
    glow(x, 50, 50, 48, '#ffd0b0', 0.8);
    at(x, 50, 78, 0, 1.25, harp, { gem: TEAL, strings: '#fff8e0' });
    for (const [px, py, c, k] of [[16, 22, TEAL, 0], [84, 18, GOLD, 1], [22, 60, PINK, 0], [80, 56, TEAL, 0], [50, 14, GOLD, 0]]) note(x, px, py, 0.7, c, k);
    sparkle(x, 50, 44, 14);
  },
};
