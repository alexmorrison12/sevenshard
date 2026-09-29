// Configurable painted busts for NPCs, dialog portraits and cards: face + hair + headwear + clothes + prop, and Pips.
// Head frame: centre ≈ (50, 46), crown y≈20, chin y≈74, temples x≈31/69 (100-unit space, light from the top-left).
import {
  PI, TAU, lg, rg, poly, circle, ellipse, star, glow, sparkle, rays, rgba, shade, mix, outline, metalLG, metalRG, gem,
  ribbon, bez, qbez, add, norm, glowPath, backdrop, brush, bolt, crystal, embers, fire, fireLayers, note, rivet, clouds,
} from './core.js';
import { harp, longsword } from './motifs.js';

const INK = 'rgba(8,5,6,.9)';
const fillShade = (x, base, cx = 42, cy = 34, r = 44) => { x.fillStyle = rg(x, cx, cy, 2, r, [[0, shade(base, 0.42)], [0.5, base], [1, shade(base, -0.72)]]); x.fill(); };

// ------------------------------------------------------------------ face
export function face(x, o) {
  const sk = o.skin || '#e2b48e', fem = !!o.fem, age = o.age || 0;
  const jw = fem ? 13.5 : 16.5;
  // neck + shadow under the jaw
  x.beginPath(); x.moveTo(43, 62); x.lineTo(57, 62); x.lineTo(59, 84); x.lineTo(41, 84); x.closePath(); fillShade(x, shade(sk, -0.12), 46, 64, 22);
  x.fillStyle = rgba(shade(sk, -0.7), 0.45); x.beginPath(); x.moveTo(42, 68); x.quadraticCurveTo(50, 78, 58, 68); x.lineTo(58, 74); x.quadraticCurveTo(50, 80, 42, 74); x.closePath(); x.fill();
  // ears
  if (!o.noEars) for (const s of [-1, 1]) { x.beginPath(); x.ellipse(50 + s * 18.8, 47, 3, 5.4, s * 0.1, 0, TAU); fillShade(x, shade(sk, -0.08), 50 + s * 18 - 1, 45, 7); outline(x, INK, 0.7); x.strokeStyle = rgba(shade(sk, -0.6), 0.6); x.lineWidth = 0.6; x.beginPath(); x.arc(50 + s * 18.8, 47, 1.8, s > 0 ? -1.2 : 1.9, s > 0 ? 1.2 : 4.3); x.stroke(); }
  // head
  const head = () => { x.beginPath(); x.moveTo(50, 20); x.bezierCurveTo(64, 20, 70, 32, 69, 44); x.bezierCurveTo(68.5, 55, 50 + jw, 64, 50 + jw * 0.52, 70); x.quadraticCurveTo(50, fem ? 74.5 : 75, 50 - jw * 0.52, 70); x.bezierCurveTo(50 - jw, 64, 31.5, 55, 31, 44); x.bezierCurveTo(30, 32, 36, 20, 50, 20); x.closePath(); };
  head(); fillShade(x, sk, 43, 36, 40); outline(x, INK, 1);
  x.save(); head(); x.clip();
  // modelling: shadow side, cheekbone, forehead light
  x.fillStyle = lg(x, 50, 0, 72, 0, [[0, rgba(shade(sk, -0.6), 0)], [1, rgba(shade(sk, -0.6), 0.4)]]); x.fillRect(50, 18, 22, 60);
  x.fillStyle = rg(x, 43, 30, 0, 14, [[0, rgba('#ffffff', 0.2)], [1, rgba('#ffffff', 0)]]); x.fillRect(28, 18, 30, 26);
  x.fillStyle = rg(x, 60, 58, 0, 9, [[0, rgba(shade(sk, -0.55), 0.35)], [1, rgba(shade(sk, -0.55), 0)]]); x.fillRect(50, 48, 20, 20);
  if (fem || age === 0) { x.fillStyle = rg(x, 38, 56, 0, 6, [[0, rgba('#ff7a6a', fem ? 0.22 : 0.12)], [1, rgba('#ff7a6a', 0)]]); x.fillRect(30, 48, 16, 16); x.fillStyle = rg(x, 62, 56, 0, 6, [[0, rgba('#ff7a6a', fem ? 0.18 : 0.1)], [1, rgba('#ff7a6a', 0)]]); x.fillRect(54, 48, 16, 16); }
  if (o.soot) { x.fillStyle = rgba('#2a2018', 0.35); ellipse(x, 58, 60, 6, 3, 0.4); x.fill(); ellipse(x, 40, 36, 4, 2, -0.3); x.fill(); }
  if (o.freckles) { x.fillStyle = rgba(shade(sk, -0.45), 0.55); for (let i = 0; i < 14; i++) { const s = i % 2 ? -1 : 1, px = 50 + s * (5 + (i * 7) % 9), py = 53 + ((i * 5) % 6); circle(x, px, py, 0.55); x.fill(); } }
  x.restore();
  // eyes
  const eyeC = o.eyes || '#5a7aa0', eg = o.eyeGlow;
  for (const s of [-1, 1]) {
    const ex = 50 + s * 8, ey = 46.5, w = fem ? 4.7 : 4.4;
    if (o.eyepatch && s === (o.eyepatch === 'r' ? 1 : -1)) continue;
    if (o.makeup) { x.fillStyle = rgba(o.makeup, 0.45); x.beginPath(); x.ellipse(ex, ey - 1.6, w + 0.6, 2.6, 0, PI, TAU); x.fill(); }
    x.beginPath(); x.moveTo(ex - w, ey); x.quadraticCurveTo(ex - 0.5, ey - 3.3, ex + w, ey - 0.2); x.quadraticCurveTo(ex, ey + 2.3, ex - w, ey); x.closePath();
    x.fillStyle = eg ? mix(eyeC, '#ffffff', 0.7) : '#f4ece6'; x.fill();
    x.save(); x.clip();
    if (eg) glow(x, ex, ey, 8, eyeC, 1);
    x.fillStyle = rg(x, ex, ey - 0.6, 0, 2.3, [[0, mix(eyeC, '#ffffff', 0.35)], [0.6, eyeC], [1, shade(eyeC, -0.55)]]); circle(x, ex + s * 0.2, ey - 0.2, 2.2); x.fill();
    x.fillStyle = eg ? '#ffffff' : '#0a0a0c'; circle(x, ex + s * 0.2, ey - 0.2, 0.95); x.fill();
    x.fillStyle = '#ffffff'; circle(x, ex - 0.6, ey - 1.1, 0.55); x.fill();
    x.fillStyle = rgba(shade(sk, -0.5), 0.35); x.fillRect(ex - 6, ey - 5, 12, 3.4); // lid shadow
    x.restore();
    x.strokeStyle = INK; x.lineWidth = fem ? 1.25 : 1.05; x.beginPath(); x.moveTo(ex - w, ey); x.quadraticCurveTo(ex - 0.5, ey - 3.3, ex + w, ey - 0.2); x.stroke();
    if (fem) { x.lineWidth = 0.8; x.beginPath(); x.moveTo(ex + s * w, ey - 0.1 * s); x.lineTo(ex + s * (w + 1.6), ey - 1.4); x.stroke(); }
    x.strokeStyle = rgba(shade(sk, -0.55), 0.6); x.lineWidth = 0.6; x.beginPath(); x.moveTo(ex - w + 1, ey + 1.2); x.quadraticCurveTo(ex, ey + 2.8, ex + w - 1, ey + 1); x.stroke();
    if (age >= 2) { x.beginPath(); x.moveTo(ex + s * (w + 0.5), ey + 0.6); x.lineTo(ex + s * (w + 3), ey + 1.6); x.moveTo(ex + s * (w + 0.6), ey + 1.8); x.lineTo(ex + s * (w + 2.6), ey + 3.2); x.stroke(); }
    // brow
    const bc = o.brow || shade(o.hairCol || '#3a2a1a', -0.15);
    x.strokeStyle = bc; x.lineWidth = o.browW ?? (fem ? 1.3 : 2.1); x.lineCap = 'round';
    const lift = o.frown ? s * 0.9 : fem ? -0.6 : 0;
    x.beginPath(); x.moveTo(ex - s * 4.8 * s + (s < 0 ? 0 : 0), ey - 5.3 + (o.frown ? 0.8 : 0)); x.quadraticCurveTo(ex, ey - 7.4 + lift, ex + s * 5.2 * s, ey - 5.6 - (o.frown ? -0.6 : 0.2)); x.stroke();
  }
  if (o.eyepatch) { const ex = 50 + (o.eyepatch === 'r' ? 8 : -8); x.fillStyle = '#141014'; ellipse(x, ex, 46.5, 5.4, 4.2); x.fill(); outline(x, INK, 0.6); x.strokeStyle = '#141014'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(ex - 5, 44); x.lineTo(31, 38); x.moveTo(ex + 5, 44); x.lineTo(69, 38); x.stroke(); }
  // nose
  x.strokeStyle = rgba(shade(sk, -0.55), 0.85); x.lineWidth = 1; x.beginPath(); x.moveTo(51.5, 48); x.lineTo(53.5, 56.5); x.quadraticCurveTo(51, 58.6, 48, 57.4); x.stroke();
  x.strokeStyle = rgba('#ffffff', 0.35); x.lineWidth = 0.8; x.beginPath(); x.moveTo(49.3, 49); x.lineTo(49.8, 55); x.stroke();
  x.fillStyle = rgba(shade(sk, -0.65), 0.6); ellipse(x, 48.3, 57.6, 1, 0.55); x.fill(); ellipse(x, 52.6, 57.6, 1, 0.55); x.fill();
  // mouth
  const lip = o.lip || (fem ? '#c86a6a' : shade(sk, -0.3)), mood = o.mood || 'neutral';
  const my = 63.5, curve = mood === 'smile' ? 2.4 : mood === 'grin' ? 3 : mood === 'frown' ? -1.6 : mood === 'smirk' ? 1 : 0.4;
  if (mood === 'grin') { x.beginPath(); x.moveTo(44.5, my); x.quadraticCurveTo(50, my + curve + 2.2, 55.5, my - 0.3); x.quadraticCurveTo(50, my + 0.8, 44.5, my); x.closePath(); x.fillStyle = '#fff8f0'; x.fill(); outline(x, INK, 0.6); }
  x.fillStyle = lip; x.beginPath(); x.moveTo(45, my); x.quadraticCurveTo(47.5, my - (fem ? 2.2 : 1.2), 50, my - 0.6); x.quadraticCurveTo(52.5, my - (fem ? 2.2 : 1.2), 55, my); x.quadraticCurveTo(50, my + 0.4, 45, my); x.fill();
  x.beginPath(); x.moveTo(45.5, my + 0.2); x.quadraticCurveTo(50, my + (fem ? 3.4 : 2.2) + curve * 0.2, 54.5, my + 0.2); x.quadraticCurveTo(50, my + 0.8, 45.5, my + 0.2); x.fillStyle = shade(lip, 0.15); x.fill();
  x.strokeStyle = rgba(shade(sk, -0.7), 0.95); x.lineWidth = 0.9; x.beginPath(); x.moveTo(44.8, my + (mood === 'smirk' ? -0.6 : 0)); x.quadraticCurveTo(50, my + curve, 55.2, my - (mood === 'smirk' ? 1.4 : 0)); x.stroke();
  if (age >= 1) { x.strokeStyle = rgba(shade(sk, -0.55), 0.45); x.lineWidth = 0.7; x.beginPath(); x.moveTo(44.5, 55); x.quadraticCurveTo(42, 60, 43.5, 64); x.moveTo(55.5, 55); x.quadraticCurveTo(58, 60, 56.5, 64); x.stroke(); }
  if (age >= 2) { x.strokeStyle = rgba(shade(sk, -0.5), 0.4); x.lineWidth = 0.6; for (const yy of [28, 31]) { x.beginPath(); x.moveTo(42, yy); x.quadraticCurveTo(50, yy - 1.4, 58, yy); x.stroke(); } }
  if (o.scar) { x.strokeStyle = 'rgba(150,60,55,.9)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(o.scar === 'r' ? 60 : 39, 36); x.lineTo(o.scar === 'r' ? 56 : 44, 55); x.stroke(); }
  if (o.glasses) { x.strokeStyle = metalLG(x, 36, 42, 64, 50, 'gold'); x.lineWidth = 1.1; for (const s of [-1, 1]) { circle(x, 50 + s * 8, 47, 5.2); x.stroke(); } x.beginPath(); x.moveTo(47.2, 46.5); x.quadraticCurveTo(50, 45, 52.8, 46.5); x.stroke(); }
  if (o.monocle) { x.strokeStyle = metalLG(x, 52, 42, 64, 52, 'gold'); x.lineWidth = 1.3; circle(x, 58, 47, 5.4); x.stroke(); x.beginPath(); x.moveTo(62, 51); x.quadraticCurveTo(64, 62, 60, 72); x.lineWidth = 0.6; x.stroke(); }
  if (o.earrings) for (const s of [-1, 1]) { x.fillStyle = metalRG(x, 50 + s * 19, 54, 2.4, 'gold'); circle(x, 50 + s * 19, 54, 1.6); x.fill(); gem(x, 50 + s * 19, 58, 1.6, o.earrings, { n: 4, spark: false, glow: false, lw: 0.4 }); }
}
// ------------------------------------------------------------------ hair
export function hairBack(x, o) {
  const c = o.hairCol, st = o.hair; if (!c || !st) return;
  const f = (pts) => { x.fillStyle = lg(x, 30, 16, 70, 96, [[0, shade(c, 0.3)], [0.5, c], [1, shade(c, -0.55)]]); x.fill(); outline(x, INK, 0.9); void pts; };
  if (st === 'long' || st === 'long_wavy') { x.beginPath(); x.moveTo(50, 16); x.bezierCurveTo(74, 16, 78, 40, 76, 62); x.bezierCurveTo(76, 76, 82, 88, 80, 96); x.lineTo(20, 96); x.bezierCurveTo(18, 88, 24, 76, 24, 62); x.bezierCurveTo(22, 40, 26, 16, 50, 16); x.closePath(); f(); }
  if (st === 'braid') { x.beginPath(); x.moveTo(50, 16); x.bezierCurveTo(72, 16, 74, 36, 70, 50); x.lineTo(30, 50); x.bezierCurveTo(26, 36, 28, 16, 50, 16); x.closePath(); f(); for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(66 + i * 0.8, 58 + i * 6, 4.4 - i * 0.3, 3.6, 0.4, 0, TAU); x.fillStyle = lg(x, 62, 54 + i * 6, 70, 62 + i * 6, [[0, shade(c, 0.35)], [1, shade(c, -0.4)]]); x.fill(); outline(x, INK, 0.7); } }
  if (st === 'ponytail') { x.beginPath(); x.moveTo(66, 30); x.bezierCurveTo(84, 34, 86, 60, 78, 82); x.bezierCurveTo(76, 64, 72, 46, 64, 38); x.closePath(); f(); }
  if (st === 'wild') { x.beginPath(); x.moveTo(50, 12); for (let i = 0; i <= 12; i++) { const a = PI + (i / 12) * PI, r = i % 2 ? 26 : 32; x.lineTo(50 + Math.cos(a) * r * 1.05, 44 + Math.sin(a) * r); } x.lineTo(78, 60); x.lineTo(22, 60); x.closePath(); f(); }
}
export function hairFront(x, o) {
  const c = o.hairCol, st = o.hair; if (!c || !st || st === 'bald') return;
  const grad = () => lg(x, 30, 14, 70, 60, [[0, shade(c, 0.4)], [0.5, c], [1, shade(c, -0.5)]]);
  const strands = (x0, x1, y0, y1) => { x.strokeStyle = rgba(shade(c, 0.5), 0.5); x.lineWidth = 0.6; for (let i = 0; i < 7; i++) { const px = x0 + ((x1 - x0) * i) / 6; x.beginPath(); x.moveTo(px, y0); x.quadraticCurveTo(px + 3, (y0 + y1) / 2, px + 1, y1); x.stroke(); } };
  x.fillStyle = grad();
  if (st === 'short' || st === 'wild' || st === 'ponytail' || st === 'bun' || st === 'braid') {
    x.beginPath(); x.moveTo(30.5, 44); x.bezierCurveTo(28, 16, 72, 16, 69.5, 44); x.bezierCurveTo(66, 32, 60, 28, 52, 30); x.quadraticCurveTo(46, 34, 40, 30); x.bezierCurveTo(35, 32, 32, 38, 30.5, 44); x.closePath(); x.fill(); outline(x, INK, 0.9); strands(36, 64, 22, 32);
    if (st === 'bun') { circle(x, 50, 15, 8); x.fillStyle = grad(); x.fill(); outline(x, INK, 0.9); x.strokeStyle = rgba(shade(c, -0.5), 0.7); x.lineWidth = 0.7; x.beginPath(); x.arc(50, 15, 5, 0.5, 2.8); x.stroke(); }
    if (st === 'wild') for (const [px, py, a] of [[34, 26, -2.4], [44, 20, -1.9], [58, 20, -1.3], [66, 28, -0.8]]) { x.save(); x.translate(px, py); x.rotate(a); poly(x, [[0, -2.4], [9, 0], [0, 2.4]]); x.fillStyle = grad(); x.fill(); outline(x, INK, 0.6); x.restore(); }
  } else if (st === 'swept') {
    x.beginPath(); x.moveTo(30.5, 44); x.bezierCurveTo(28, 18, 50, 10, 64, 16); x.bezierCurveTo(72, 20, 72, 34, 69.5, 44); x.bezierCurveTo(66, 30, 58, 26, 46, 28); x.bezierCurveTo(38, 30, 34, 36, 30.5, 44); x.closePath(); x.fill(); outline(x, INK, 0.9); strands(36, 62, 18, 28);
  } else if (st === 'long' || st === 'long_wavy') {
    x.beginPath(); x.moveTo(30.5, 50); x.bezierCurveTo(26, 14, 74, 14, 69.5, 50); x.bezierCurveTo(66, 30, 56, 26, 50, 27); x.bezierCurveTo(44, 26, 34, 30, 30.5, 50); x.closePath(); x.fill(); outline(x, INK, 0.9);
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50 + s * 17, 30); x.bezierCurveTo(50 + s * 21, 44, 50 + s * 18, 60, 50 + s * 22, 76); x.bezierCurveTo(50 + s * 24, 60, 50 + s * 22, 40, 50 + s * 19, 30); x.closePath(); x.fillStyle = grad(); x.fill(); outline(x, INK, 0.6); }
    strands(36, 64, 18, 30);
  } else if (st === 'fringe_only') {
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50 + s * 4, 24); x.bezierCurveTo(50 + s * 18, 26, 50 + s * 20, 44, 50 + s * 19, 64); x.bezierCurveTo(50 + s * 16, 46, 50 + s * 12, 32, 50 + s * 2, 27); x.closePath(); x.fillStyle = grad(); x.fill(); outline(x, INK, 0.6); }
  } else if (st === 'receding') {
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50 + s * 19, 50); x.bezierCurveTo(50 + s * 20, 36, 50 + s * 16, 28, 50 + s * 10, 26); x.bezierCurveTo(50 + s * 14, 32, 50 + s * 16, 40, 50 + s * 16.5, 50); x.closePath(); x.fill(); outline(x, INK, 0.7); }
  }
}
export function beard(x, o) {
  const c = o.beardCol || o.hairCol || '#4a3a2a', b = o.beard; if (!b) return;
  const g = lg(x, 34, 52, 66, 90, [[0, shade(c, 0.35)], [0.5, c], [1, shade(c, -0.5)]]);
  if (b === 'full' || b === 'long') {
    const bot = b === 'long' ? 96 : 84;
    x.beginPath(); x.moveTo(32.5, 52); x.bezierCurveTo(33, 70, 42, bot, 50, bot); x.bezierCurveTo(58, bot, 67, 70, 67.5, 52); x.bezierCurveTo(63, 62, 57, 67, 50, 67); x.bezierCurveTo(43, 67, 37, 62, 32.5, 52); x.closePath(); x.fillStyle = g; x.fill(); outline(x, INK, 0.8);
    x.strokeStyle = rgba(shade(c, 0.5), 0.45); x.lineWidth = 0.6; for (let i = 0; i < 8; i++) { const px = 38 + i * 3.4; x.beginPath(); x.moveTo(px, 66); x.quadraticCurveTo(px + 1, bot - 12, px - 0.5, bot - 4); x.stroke(); }
  }
  if (b === 'short') { x.beginPath(); x.moveTo(34, 56); x.bezierCurveTo(36, 70, 44, 77, 50, 77); x.bezierCurveTo(56, 77, 64, 70, 66, 56); x.bezierCurveTo(62, 64, 56, 67, 50, 67); x.bezierCurveTo(44, 67, 38, 64, 34, 56); x.closePath(); x.fillStyle = g; x.fill(); outline(x, INK, 0.7); }
  if (b === 'goatee') { x.beginPath(); x.moveTo(45, 66); x.quadraticCurveTo(50, 80, 55, 66); x.quadraticCurveTo(50, 69, 45, 66); x.closePath(); x.fillStyle = g; x.fill(); outline(x, INK, 0.6); }
  // moustache on top
  x.fillStyle = g;
  for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50, 60.5); x.bezierCurveTo(50 + s * 5, 58.5, 50 + s * (b === 'handlebar' ? 12 : 9), 59, 50 + s * (b === 'handlebar' ? 17 : 11), b === 'handlebar' ? 56 : 63); x.bezierCurveTo(50 + s * 8, 63, 50 + s * 4, 62.5, 50, 62.4); x.closePath(); x.fill(); outline(x, INK, 0.5); }
}
// ------------------------------------------------------------------ headwear
export function headwear(x, o) {
  const h = o.hat; if (!h) return;
  const c = o.hatCol || '#5a3a2a', tr = o.hatTrim || 'gold';
  if (h === 'hood' || h === 'hood_up') {
    x.beginPath(); x.moveTo(50, 8); x.bezierCurveTo(76, 8, 84, 36, 82, 60); x.bezierCurveTo(84, 72, 90, 80, 92, 96); x.lineTo(8, 96); x.bezierCurveTo(10, 80, 16, 72, 18, 60); x.bezierCurveTo(16, 36, 24, 8, 50, 8); x.closePath();
    x.moveTo(50, 17); x.bezierCurveTo(33, 18, 29, 40, 31, 56); x.quadraticCurveTo(40, 74, 50, 76); x.quadraticCurveTo(60, 74, 69, 56); x.bezierCurveTo(71, 40, 67, 18, 50, 17); x.closePath();
    fillShade(x, c, 38, 22, 76); x.save(); x.fillStyle = lg(x, 0, 0, 0, 1, [[0, '#000'], [1, '#000']]); x.restore(); outline(x, INK, 1);
    if (o.hatTrim) { x.strokeStyle = metalLG(x, 20, 16, 80, 90, tr); x.lineWidth = 1.8; x.beginPath(); x.moveTo(50, 17.5); x.bezierCurveTo(33.5, 18.5, 29.5, 40, 31.5, 56); x.moveTo(50, 17.5); x.bezierCurveTo(66.5, 18.5, 70.5, 40, 68.5, 56); x.stroke(); }
  }
  if (h === 'wide_hat') {
    x.beginPath(); x.ellipse(50, 27, 34, 8, -0.06, 0, TAU); fillShade(x, c, 40, 24, 36); outline(x, INK, 1);
    x.beginPath(); x.moveTo(34, 27); x.bezierCurveTo(34, 8, 66, 8, 66, 27); x.quadraticCurveTo(50, 31, 34, 27); x.closePath(); fillShade(x, shade(c, 0.1), 42, 14, 24); outline(x, INK, 1);
    x.fillStyle = o.hatBand || shade(c, -0.5); x.beginPath(); x.moveTo(34.5, 23); x.quadraticCurveTo(50, 27, 65.5, 23); x.lineTo(65.8, 26.5); x.quadraticCurveTo(50, 30.5, 34.2, 26.5); x.closePath(); x.fill();
    if (o.feather) { x.save(); x.translate(60, 22); x.rotate(-0.6); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(6, -8, 14, -16, 26, -18); x.bezierCurveTo(18, -10, 8, -3, 2, 3); x.closePath(); x.fillStyle = lg(x, 0, 0, 26, -18, [[0, shade(o.feather, -0.3)], [1, mix(o.feather, '#ffffff', 0.5)]]); x.fill(); outline(x, INK, 0.6); x.restore(); }
  }
  if (h === 'tricorn') {
    x.beginPath(); x.moveTo(16, 30); x.quadraticCurveTo(50, 14, 84, 30); x.quadraticCurveTo(70, 26, 64, 10); x.quadraticCurveTo(50, 4, 36, 10); x.quadraticCurveTo(30, 26, 16, 30); x.closePath(); fillShade(x, c, 40, 12, 40); outline(x, INK, 1);
    x.strokeStyle = metalLG(x, 16, 20, 84, 30, tr); x.lineWidth = 1.4; x.beginPath(); x.moveTo(17, 29.5); x.quadraticCurveTo(50, 14, 83, 29.5); x.stroke();
    if (o.hatEmblem === 'skull') { x.fillStyle = '#f0e8d8'; circle(x, 50, 16, 3.4); x.fill(); x.fillStyle = '#1a1010'; circle(x, 48.8, 15.6, 0.9); x.fill(); circle(x, 51.2, 15.6, 0.9); x.fill(); }
    if (o.feather) { x.save(); x.translate(64, 12); x.rotate(-0.9); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(6, -8, 14, -14, 24, -14); x.bezierCurveTo(16, -8, 8, -2, 2, 3); x.closePath(); x.fillStyle = lg(x, 0, 0, 24, -14, [[0, shade(o.feather, -0.3)], [1, mix(o.feather, '#ffffff', 0.4)]]); x.fill(); outline(x, INK, 0.6); x.restore(); }
  }
  if (h === 'cap') { x.beginPath(); x.moveTo(29, 36); x.bezierCurveTo(28, 12, 72, 12, 71, 36); x.quadraticCurveTo(50, 30, 29, 36); x.closePath(); fillShade(x, c, 42, 18, 30); outline(x, INK, 1); x.beginPath(); x.moveTo(29, 36); x.quadraticCurveTo(50, 28, 74, 38); x.lineTo(72, 34); x.quadraticCurveTo(50, 26, 29, 32); x.closePath(); x.fillStyle = shade(c, -0.4); x.fill(); }
  if (h === 'turban') {
    x.beginPath(); x.moveTo(28, 40); x.bezierCurveTo(26, 12, 74, 12, 72, 40); x.quadraticCurveTo(50, 32, 28, 40); x.closePath(); fillShade(x, c, 40, 20, 34); outline(x, INK, 1);
    x.strokeStyle = rgba(shade(c, -0.55), 0.6); x.lineWidth = 1; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(30, 36 - i * 7); x.quadraticCurveTo(50, 26 - i * 8, 70, 36 - i * 7); x.stroke(); }
    gem(x, 50, 31, 3.6, o.hatGem || '#e02a4a', { n: 6, glowA: 0.5, lw: 0.5, spark: false });
    if (o.feather) { x.save(); x.translate(55, 29); x.rotate(-0.4); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(4, -10, 12, -20, 22, -24); x.bezierCurveTo(16, -14, 8, -6, 2, 2); x.closePath(); x.fillStyle = lg(x, 0, 0, 22, -24, [[0, shade(o.feather, -0.3)], [1, mix(o.feather, '#ffffff', 0.6)]]); x.fill(); outline(x, INK, 0.6); x.restore(); }
  }
  if (h === 'helm') {
    x.beginPath(); x.moveTo(29, 44); x.bezierCurveTo(27, 12, 73, 12, 71, 44); x.lineTo(68, 46); x.quadraticCurveTo(50, 36, 32, 46); x.closePath();
    x.fillStyle = rg(x, 40, 22, 2, 34, [[0, '#ffffff'], [0.3, '#b8c4d2'], [0.7, '#4a5462'], [1, '#161a20']]); x.fill(); outline(x, INK, 1);
    x.fillStyle = metalLG(x, 48, 16, 52, 50, tr); poly(x, [[48.4, 15], [51.6, 15], [51.2, 52], [48.8, 52]]); x.fill(); outline(x, INK, 0.6);
    if (o.plume) { ribbon(x, bez([50, 15], [44, 4], [30, 2], [22, 14]), t => 7 * Math.sin(PI * t) + 1, 20); x.fillStyle = lg(x, 22, 2, 50, 15, [[0, shade(o.plume, -0.4)], [1, mix(o.plume, '#ffffff', 0.3)]]); x.fill(); outline(x, INK, 0.7); }
  }
  if (h === 'circlet' || h === 'crown') {
    x.strokeStyle = metalLG(x, 32, 28, 68, 36, tr); x.lineWidth = h === 'crown' ? 2.6 : 1.6; x.beginPath(); x.moveTo(32, 36); x.quadraticCurveTo(50, 27, 68, 36); x.stroke();
    if (h === 'crown') { for (const [px, py, s] of [[36, 31, 0.8], [43, 28.6, 1], [50, 27.8, 1.25], [57, 28.6, 1], [64, 31, 0.8]]) { poly(x, [[px - 2.6 * s, py + 1], [px, py - 8 * s], [px + 2.6 * s, py + 1]]); x.fillStyle = metalLG(x, px - 3, py - 8, px + 3, py + 1, tr); x.fill(); outline(x, INK, 0.5); } }
    gem(x, 50, h === 'crown' ? 30.5 : 30.8, h === 'crown' ? 2.8 : 2.6, o.hatGem || '#7ad8ff', { n: 4, glowA: 0.8, lw: 0.4 });
  }
  if (h === 'veil') {
    x.save(); add(x); x.beginPath(); x.moveTo(50, 12); x.bezierCurveTo(76, 12, 82, 40, 80, 70); x.lineTo(84, 96); x.lineTo(16, 96); x.lineTo(20, 70); x.bezierCurveTo(18, 40, 24, 12, 50, 12); x.closePath();
    x.fillStyle = lg(x, 20, 12, 80, 96, [[0, rgba(o.hatCol || '#c080ff', 0.35)], [1, rgba(o.hatCol || '#c080ff', 0.12)]]); x.fill(); norm(x); x.restore();
    x.strokeStyle = rgba(mix(o.hatCol || '#c080ff', '#ffffff', 0.4), 0.7); x.lineWidth = 0.8; x.beginPath(); x.moveTo(50, 12); x.bezierCurveTo(76, 12, 82, 40, 80, 70); x.moveTo(50, 12); x.bezierCurveTo(24, 12, 18, 40, 20, 70); x.stroke();
    for (let i = 0; i < 9; i++) { const t = i / 8, px = 30 + t * 40, py = 30 - Math.sin(t * PI) * 8; x.fillStyle = metalRG(x, px, py, 1.6, 'gold'); circle(x, px, py, 1); x.fill(); }
  }
  if (h === 'bandana') { x.beginPath(); x.moveTo(29, 38); x.bezierCurveTo(28, 16, 72, 16, 71, 38); x.quadraticCurveTo(50, 30, 29, 38); x.closePath(); fillShade(x, c, 42, 20, 30); outline(x, INK, 0.9); x.fillStyle = shade(c, -0.2); poly(x, [[68, 34], [80, 40], [76, 46], [70, 40]]); x.fill(); outline(x, INK, 0.7); for (let i = 0; i < 6; i++) { x.fillStyle = rgba('#ffffff', 0.6); circle(x, 36 + i * 6, 28 - Math.sin(i / 5 * PI) * 4, 0.9); x.fill(); } }
  if (h === 'straw') {
    x.beginPath(); x.ellipse(50, 28, 36, 9, 0.04, 0, TAU); fillShade(x, '#d8b060', 40, 24, 36); outline(x, INK, 1);
    x.beginPath(); x.moveTo(33, 28); x.bezierCurveTo(34, 10, 66, 10, 67, 28); x.quadraticCurveTo(50, 32, 33, 28); x.closePath(); fillShade(x, '#e0bc70', 42, 14, 24); outline(x, INK, 1);
    x.strokeStyle = 'rgba(120,80,20,.5)'; x.lineWidth = 0.6; for (let i = 0; i < 10; i++) { const a = (i / 10) * PI; x.beginPath(); x.moveTo(50 + Math.cos(a) * 14, 28 - Math.sin(a) * 2); x.lineTo(50 + Math.cos(a) * 34, 28 + Math.sin(a) * 3); x.stroke(); }
    x.fillStyle = '#a02a1a'; x.beginPath(); x.moveTo(33.5, 24); x.quadraticCurveTo(50, 28, 66.5, 24); x.lineTo(66.8, 27); x.quadraticCurveTo(50, 31, 33.2, 27); x.closePath(); x.fill();
  }
  if (h === 'top_hat') {
    x.beginPath(); x.ellipse(50, 28, 26, 6, 0, 0, TAU); fillShade(x, c, 40, 26, 26); outline(x, INK, 1);
    x.beginPath(); x.moveTo(37, 28); x.lineTo(38, 4); x.quadraticCurveTo(50, 1, 62, 4); x.lineTo(63, 28); x.quadraticCurveTo(50, 31, 37, 28); x.closePath(); x.fillStyle = lg(x, 37, 0, 63, 0, [[0, shade(c, -0.3)], [0.35, shade(c, 0.3)], [1, shade(c, -0.6)]]); x.fill(); outline(x, INK, 1);
    x.fillStyle = o.hatBand || '#a02030'; x.fillRect(37.6, 20, 25, 4.4);
  }
}
// ------------------------------------------------------------------ clothes & props
export function clothes(x, o) {
  const c = o.cloth || '#3a4a6a', t = o.trim || 'gold', k = o.clothes || 'robe';
  x.beginPath(); x.moveTo(0, 100); x.bezierCurveTo(2, 86, 14, 78, 30, 76); x.lineTo(70, 76); x.bezierCurveTo(86, 78, 98, 86, 100, 100); x.closePath();
  if (k === 'armor') x.fillStyle = metalLG(x, 0, 76, 100, 100, 'steel'); else x.fillStyle = lg(x, 0, 76, 20, 104, [[0, shade(c, 0.35)], [0.5, c], [1, shade(c, -0.6)]]);
  x.fill(); outline(x, INK, 1);
  if (k === 'armor') {
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(50 + s * 32, 86, 20, 12, s * 0.25, 0, TAU); x.fillStyle = rg(x, 50 + s * 32 - 6, 80, 1, 22, [[0, '#ffffff'], [0.3, '#b8c4d0'], [0.7, '#4a5462'], [1, '#141820']]); x.fill(); outline(x, INK, 0.9); x.strokeStyle = metalLG(x, 30, 80, 70, 90, t); x.lineWidth = 1.5; x.beginPath(); x.ellipse(50 + s * 32, 88, 17, 9, s * 0.25, PI * 1.1, PI * 1.9); x.stroke(); }
    x.beginPath(); x.moveTo(36, 78); x.lineTo(64, 78); x.lineTo(62, 100); x.lineTo(38, 100); x.closePath(); x.fillStyle = metalLG(x, 36, 78, 64, 100, 'silver'); x.fill(); outline(x, INK, 0.9);
    if (o.tabard) { x.fillStyle = lg(x, 44, 84, 56, 100, [[0, shade(o.tabard, 0.3)], [1, shade(o.tabard, -0.4)]]); poly(x, [[44, 86], [56, 86], [56, 100], [44, 100]]); x.fill(); outline(x, INK, 0.6); }
  } else if (k === 'apron') {
    x.fillStyle = lg(x, 36, 80, 64, 100, [[0, '#8a5a34'], [1, '#3a200e']]); poly(x, [[38, 80], [62, 80], [66, 100], [34, 100]]); x.fill(); outline(x, INK, 0.9);
    x.strokeStyle = '#2a1608'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(38, 80); x.lineTo(44, 70); x.moveTo(62, 80); x.lineTo(56, 70); x.stroke();
    rivet(x, 40, 84, 1.3, 'iron'); rivet(x, 60, 84, 1.3, 'iron');
  } else {
    // V-neck / collar with trim
    x.beginPath(); x.moveTo(38, 76); x.lineTo(50, 92); x.lineTo(62, 76); x.lineTo(58, 76); x.lineTo(50, 86); x.lineTo(42, 76); x.closePath(); x.fillStyle = k === 'noble' ? '#f4ece0' : shade(c, -0.5); x.fill();
    x.strokeStyle = metalLG(x, 30, 76, 70, 96, t); x.lineWidth = 1.8; x.beginPath(); x.moveTo(36, 77); x.lineTo(50, 94); x.lineTo(64, 77); x.stroke();
    if (k === 'coat') { for (const yy of [88, 95]) { x.fillStyle = metalRG(x, 55, yy, 1.8, t); circle(x, 55, yy, 1.4); x.fill(); } x.beginPath(); x.moveTo(30, 76); x.lineTo(36, 66); x.lineTo(42, 76); x.moveTo(70, 76); x.lineTo(64, 66); x.lineTo(58, 76); x.fillStyle = shade(c, -0.25); x.fill(); outline(x, INK, 0.7); }
    if (k === 'noble') { for (let i = 0; i < 5; i++) { x.fillStyle = '#fff8f0'; ellipse(x, 44 + i * 3, 78 + Math.sin(i) * 0.6, 2.4, 1.6); x.fill(); } gem(x, 50, 90, 2.6, o.jewel || '#ff3a5a', { n: 6, glowA: 0.4, lw: 0.4, spark: false }); }
    if (k === 'cloak') { x.fillStyle = metalRG(x, 36, 80, 3.4, t); circle(x, 36, 80, 3); x.fill(); outline(x, INK, 0.6); x.fillStyle = metalRG(x, 64, 80, 3.4, t); circle(x, 64, 80, 3); x.fill(); outline(x, INK, 0.6); }
  }
  if (o.pauldron) for (const s of [-1, 1]) { x.beginPath(); x.ellipse(50 + s * 34, 84, 16, 10, s * 0.3, 0, TAU); x.fillStyle = metalLG(x, 50 + s * 34 - 16, 76, 50 + s * 34 + 16, 94, o.pauldron); x.fill(); outline(x, INK, 0.8); }
}
export function prop(x, R, o) {
  const p = o.prop; if (!p) return;
  if (p === 'hammer') { x.save(); x.translate(80, 98); x.rotate(-0.35); x.fillStyle = lg(x, -2, 0, 2, 0, [[0, '#4a2a10'], [0.5, '#9a6a3a'], [1, '#2a1406']]); x.fillRect(-2, -34, 4, 34); x.beginPath(); x.roundRect(-10, -44, 20, 11, 2); x.fillStyle = metalLG(x, -10, -44, 10, -33, 'iron'); x.fill(); outline(x, INK, 0.8); x.restore(); }
  if (p === 'lute') { x.save(); x.translate(78, 92); x.rotate(-0.55); x.beginPath(); x.ellipse(0, 0, 11, 14, 0, 0, TAU); x.fillStyle = rg(x, -3, -4, 1, 16, [[0, '#e0a060'], [0.6, '#9a5a28'], [1, '#3a1a08']]); x.fill(); outline(x, INK, 0.9); x.fillStyle = '#1a0c04'; circle(x, 0, -2, 3); x.fill(); x.fillStyle = lg(x, -2, 0, 2, 0, [[0, '#6a3a18'], [1, '#2a1406']]); x.fillRect(-1.8, -32, 3.6, 20); x.strokeStyle = 'rgba(255,240,210,.8)'; x.lineWidth = 0.4; for (const d of [-1, 0, 1]) { x.beginPath(); x.moveTo(d, -32); x.lineTo(d * 1.6, 8); x.stroke(); } x.restore(); }
  if (p === 'book') { x.save(); x.translate(22, 90); x.rotate(0.2); x.beginPath(); x.roundRect(-12, -9, 24, 18, 2); x.fillStyle = lg(x, -12, -9, 12, 9, [[0, shade(o.propCol || '#5a2a7a', 0.3)], [1, shade(o.propCol || '#5a2a7a', -0.5)]]); x.fill(); outline(x, INK, 0.9); x.strokeStyle = metalLG(x, -12, -9, 12, 9, 'gold'); x.lineWidth = 1; x.strokeRect(-9, -6, 18, 12); x.restore(); }
  if (p === 'quill') { x.save(); x.translate(76, 96); x.rotate(-0.7); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(6, -12, 8, -26, 4, -36); x.bezierCurveTo(-2, -26, -4, -12, 0, 0); x.closePath(); x.fillStyle = lg(x, -4, -36, 8, 0, [[0, '#ffffff'], [1, '#b0a8c0']]); x.fill(); outline(x, INK, 0.7); x.restore(); }
  if (p === 'lantern') { x.save(); x.translate(76, 84); glow(x, 0, 0, 22, '#ffd070', 0.9); x.strokeStyle = metalLG(x, -6, -16, 6, -8, 'gold'); x.lineWidth = 1.4; x.beginPath(); x.arc(0, -12, 4, PI, TAU); x.stroke(); x.beginPath(); x.roundRect(-6, -9, 12, 16, 2); x.fillStyle = rg(x, 0, -1, 0, 9, [[0, '#ffffff'], [0.5, '#ffe080'], [1, '#c08020']]); x.fill(); x.strokeStyle = metalLG(x, -6, -9, 6, 7, 'gold'); x.lineWidth = 1.2; x.stroke(); x.restore(); }
  if (p === 'coins') { for (const [px, py] of [[20, 94], [26, 90], [32, 95]]) { ellipse(x, px, py, 5, 2.4); x.fillStyle = metalLG(x, px - 5, py - 2, px + 5, py + 2, 'gold'); x.fill(); outline(x, INK, 0.6); } }
  if (p === 'cards') { for (let i = 0; i < 4; i++) { x.save(); x.translate(76, 96); x.rotate(-0.7 + i * 0.3); x.beginPath(); x.roundRect(-5, -22, 10, 15, 1.5); x.fillStyle = i === 3 ? '#f4ecff' : lg(x, -5, -22, 5, -7, [[0, '#8a5ac0'], [1, '#3a1a5a']]); x.fill(); outline(x, INK, 0.6); if (i === 3) { star(x, 0, -14.5, 4, 1.2, 3.4); x.fillStyle = '#b060ff'; x.fill(); } x.restore(); } }
  if (p === 'gem') { glow(x, 76, 88, 12, o.propCol || '#40c0ff', 0.9); gem(x, 76, 88, 6, o.propCol || '#40c0ff', { n: 8, lw: 0.6 }); }
  if (p === 'needle') { x.save(); x.translate(76, 90); x.rotate(-0.8); x.strokeStyle = metalLG(x, 0, -20, 1, 0, 'silver'); x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -22); x.stroke(); x.restore(); x.strokeStyle = o.propCol || '#e04a8a'; x.lineWidth = 1; x.beginPath(); x.moveTo(68, 84); x.bezierCurveTo(60, 92, 76, 96, 70, 100); x.stroke(); }
  if (p === 'spear') { x.save(); x.translate(84, 100); x.rotate(-0.12); x.fillStyle = lg(x, -1.6, 0, 1.6, 0, [[0, '#3a2412'], [0.5, '#8a5a2a'], [1, '#2a1406']]); x.fillRect(-1.6, -90, 3.2, 90); poly(x, [[-4, -88], [0, -102], [4, -88], [0, -84]]); x.fillStyle = metalLG(x, -4, -102, 4, -84, 'steel'); x.fill(); outline(x, INK, 0.7); x.restore(); }
  if (p === 'oar') { x.save(); x.translate(84, 100); x.rotate(-0.25); x.fillStyle = lg(x, -1.6, 0, 1.6, 0, [[0, '#5a3a1a'], [0.5, '#a07a4a'], [1, '#3a2410']]); x.fillRect(-1.6, -70, 3.2, 70); x.beginPath(); x.ellipse(0, -80, 5, 14, 0, 0, TAU); x.fill(); outline(x, INK, 0.8); x.restore(); }
  if (p === 'pitchfork') { x.save(); x.translate(84, 100); x.rotate(-0.15); x.fillStyle = '#8a5a2a'; x.fillRect(-1.5, -70, 3, 70); x.strokeStyle = metalLG(x, -6, -90, 6, -70, 'iron'); x.lineWidth = 1.6; x.beginPath(); x.moveTo(-6, -70); x.lineTo(6, -70); for (const d of [-6, 0, 6]) { x.moveTo(d, -70); x.lineTo(d, -88); } x.stroke(); x.restore(); }
  if (p === 'staff') { x.save(); x.translate(82, 100); x.rotate(-0.1); x.fillStyle = lg(x, -2, 0, 2, 0, [[0, '#3a2a4a'], [0.5, '#8a7aa0'], [1, '#1a1024']]); x.fillRect(-1.8, -80, 3.6, 80); glow(x, 0, -84, 12, o.propCol || '#a070ff', 0.9); x.fillStyle = rg(x, -1, -85, 0, 5, [[0, '#ffffff'], [1, o.propCol || '#a070ff']]); circle(x, 0, -84, 4.4); x.fill(); x.restore(); }
  if (p === 'shield') { x.save(); x.translate(20, 88); x.beginPath(); x.moveTo(-14, -16); x.quadraticCurveTo(0, -20, 14, -16); x.bezierCurveTo(15, 2, 8, 12, 0, 18); x.bezierCurveTo(-8, 12, -15, 2, -14, -16); x.closePath(); x.fillStyle = metalLG(x, -14, -20, 14, 18, 'silver'); x.fill(); outline(x, INK, 1); star(x, 0, -2, 4, 2, 7); x.fillStyle = '#ffd060'; x.fill(); x.restore(); }
  if (p === 'jar') { x.save(); x.translate(76, 86); glow(x, 0, 0, 18, '#8ad0ff', 0.9); x.beginPath(); x.roundRect(-8, -10, 16, 22, 4); x.fillStyle = 'rgba(180,220,255,.25)'; x.fill(); outline(x, INK, 0.9); bolt(x, R, -2, -8, 2, 10, { col: '#8ad0ff', w: 1.2, gens: 3 }); x.fillStyle = metalLG(x, -9, -14, 9, -10, 'brass'); x.fillRect(-9, -14, 18, 4); x.restore(); }
  if (p === 'trident') { x.save(); x.translate(84, 100); x.rotate(-0.1); x.fillStyle = metalLG(x, -2, 0, 2, 0, 'silver'); x.fillRect(-1.6, -80, 3.2, 80); x.strokeStyle = metalLG(x, -8, -100, 8, -80, 'silver'); x.lineWidth = 1.8; x.beginPath(); x.moveTo(-8, -80); x.lineTo(8, -80); for (const d of [-8, 0, 8]) { x.moveTo(d, -80); x.lineTo(d, -96 - (d ? 0 : 4)); } x.stroke(); x.restore(); }
  if (p === 'letters') { for (let i = 0; i < 3; i++) { x.save(); x.translate(24 + i * 4, 92 - i * 3); x.rotate(-0.2 + i * 0.15); x.beginPath(); x.roundRect(-9, -6, 18, 12, 1); x.fillStyle = '#f4ead0'; x.fill(); outline(x, INK, 0.6); x.beginPath(); x.moveTo(-9, -6); x.lineTo(0, 1); x.lineTo(9, -6); x.stroke(); x.restore(); } }
}

/** Painted bust. cfg: { bg: [l, m, d], light, face opts…, hair, hairCol, beard, hat…, clothes, cloth, trim, prop, aura } */
export function bust(x, R, cfg) {
  backdrop(x, R, cfg.bg || ['#6a6050', '#241e16', '#070504'], { shaft: false, cx: 46, cy: 36 });
  if (cfg.aura) { rays(x, R, 50, 40, 16, 20, 64, cfg.aura, { alpha: 0.35 }); glow(x, 50, 44, 46, cfg.aura, 0.45); }
  if (cfg.backFx) cfg.backFx(x, R);
  if (cfg.hat === 'hood') {
    hairBack(x, cfg); clothes(x, cfg); headwear(x, cfg); face(x, cfg); beard(x, cfg);
    if (cfg.hair === 'long' || cfg.hair === 'long_wavy') hairFront(x, { ...cfg, hair: 'fringe_only' });
  } else {
    hairBack(x, cfg); clothes(x, cfg); face(x, cfg); beard(x, cfg); hairFront(x, cfg); headwear(x, cfg);
  }
  prop(x, R, cfg);
  if (cfg.frontFx) cfg.frontFx(x, R);
}
/** Ornate card border (kind colour). */
export function cardFrame(x, col) {
  x.lineCap = 'butt';
  x.lineWidth = 2.6; x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeRect(5.6, 5.6, 88.8, 88.8);
  x.lineWidth = 1.5; x.strokeStyle = metalLG(x, 0, 0, 100, 100, 'gold'); x.strokeRect(5.4, 5.4, 89.2, 89.2);
  x.lineWidth = 0.8; x.strokeStyle = rgba(col, 0.9); x.strokeRect(8, 8, 84, 84);
  for (const [cx, cy] of [[5.4, 5.4], [94.6, 5.4], [5.4, 94.6], [94.6, 94.6]]) { poly(x, [[cx, cy - 4.5], [cx + 4.5, cy], [cx, cy + 4.5], [cx - 4.5, cy]]); x.fillStyle = metalLG(x, cx - 4, cy - 4, cx + 4, cy + 4, 'gold'); x.fill(); x.lineWidth = 0.6; x.strokeStyle = 'rgba(40,20,0,.9)'; x.stroke(); gem(x, cx, cy, 1.6, col, { n: 4, spark: false, glow: false, lw: 0.3 }); }
  poly(x, [[50, 2.5], [56, 5.4], [50, 8.3], [44, 5.4]]); x.fillStyle = metalLG(x, 44, 2, 56, 9, 'gold'); x.fill(); x.lineWidth = 0.6; x.strokeStyle = 'rgba(40,20,0,.9)'; x.stroke();
  x.lineCap = 'round';
}

// ------------------------------------------------------------------ Pips
export function pip(x, R, cfg) {
  backdrop(x, R, cfg.bg || ['#b8e080', '#3a6a28', '#0a1604'], { shaft: false });
  for (let i = 0; i < 7; i++) glow(x, R() * 100, R() * 60, 1 + R() * 2, '#f0ffc0', 0.5);
  const body = cfg.body || '#e8c878', leafC = cfg.leaf || '#6ac850';
  const cy = cfg.small ? 62 : 58, r = cfg.small ? 28 : 34;
  if (cfg.backpack) { x.beginPath(); x.roundRect(62, cy - 18, 26, 30, 6); x.fillStyle = lg(x, 62, cy - 18, 88, cy + 12, [[0, '#b07a40'], [1, '#4a2a10']]); x.fill(); outline(x, INK, 1); }
  circle(x, 48, cy, r); x.fillStyle = rg(x, 38, cy - 14, 2, r * 1.2, [[0, mix(body, '#ffffff', 0.55)], [0.5, body], [1, shade(body, -0.55)]]); x.fill(); outline(x, INK, 1.3);
  // sprout
  if (!cfg.hat || cfg.hat === 'acorn') { x.strokeStyle = '#3a7a2a'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(48, cy - r + 1); x.quadraticCurveTo(46, cy - r - 10, 52, cy - r - 16); x.stroke(); leafy(x, 52, cy - r - 15, 22, 7, -0.4, leafC); leafy(x, 49, cy - r - 10, 16, 5, -2.6, shade(leafC, -0.1)); }
  // eyes
  const ey = cy - 4;
  for (const s of [-1, 1]) {
    if (cfg.mood === 'sleepy') { x.strokeStyle = '#1a1208'; x.lineWidth = 1.8; x.beginPath(); x.arc(48 + s * 10, ey, 4, 0.2, PI - 0.2); x.stroke(); continue; }
    x.fillStyle = '#1a1208'; ellipse(x, 48 + s * 10, ey, 4.6, 5.6); x.fill(); x.fillStyle = '#ffffff'; circle(x, 48 + s * 10 - 1.4, ey - 2, 1.8); x.fill(); circle(x, 48 + s * 10 + 1.4, ey + 1.6, 0.8); x.fill();
  }
  if (cfg.glasses) { x.strokeStyle = metalLG(x, 34, ey - 6, 62, ey + 6, 'gold'); x.lineWidth = 1.2; for (const s of [-1, 1]) { circle(x, 48 + s * 10, ey, 6.6); x.stroke(); } x.beginPath(); x.moveTo(44.6, ey - 1); x.lineTo(51.4, ey - 1); x.stroke(); }
  if (cfg.monocle) { x.strokeStyle = metalLG(x, 52, ey - 6, 64, ey + 6, 'gold'); x.lineWidth = 1.3; circle(x, 58, ey, 7); x.stroke(); }
  x.fillStyle = 'rgba(255,120,120,.45)'; ellipse(x, 48 - 17, cy + 5, 4, 2.4); x.fill(); ellipse(x, 48 + 17, cy + 5, 4, 2.4); x.fill();
  if (cfg.mustache) { x.fillStyle = cfg.mustache; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(48, cy + 6); x.bezierCurveTo(48 + s * 6, cy + 3, 48 + s * 12, cy + 4, 48 + s * 16, cy + 1); x.bezierCurveTo(48 + s * 12, cy + 9, 48 + s * 6, cy + 9, 48, cy + 8); x.closePath(); x.fill(); outline(x, INK, 0.5); } }
  else { x.strokeStyle = '#3a2008'; x.lineWidth = 1.3; x.beginPath(); x.arc(48, cy + 6, 3.6, 0.3, PI - 0.3); x.stroke(); }
  if (cfg.shawl) { x.beginPath(); x.moveTo(18, cy + 10); x.quadraticCurveTo(48, cy + 30, 78, cy + 10); x.lineTo(80, cy + 22); x.quadraticCurveTo(48, cy + 40, 16, cy + 22); x.closePath(); x.fillStyle = lg(x, 16, cy + 10, 80, cy + 40, [[0, mix(cfg.shawl, '#ffffff', 0.2)], [1, shade(cfg.shawl, -0.5)]]); x.fill(); outline(x, INK, 0.9); x.strokeStyle = rgba(shade(cfg.shawl, 0.4), 0.6); x.lineWidth = 0.7; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(22 + i * 8, cy + 18 + Math.sin(i) * 2); x.lineTo(24 + i * 8, cy + 26); x.stroke(); } }
  if (cfg.sash) { x.beginPath(); x.moveTo(26, cy - 10); x.lineTo(34, cy - 16); x.lineTo(74, cy + 20); x.lineTo(66, cy + 26); x.closePath(); x.fillStyle = lg(x, 26, cy - 16, 74, cy + 26, [[0, shade(cfg.sash, 0.3)], [1, shade(cfg.sash, -0.4)]]); x.fill(); outline(x, INK, 0.8); x.fillStyle = metalRG(x, 50, cy + 5, 4, 'gold'); circle(x, 50, cy + 5, 3); x.fill(); }
  // hats
  if (cfg.hat === 'top_hat') { const hy = cy - r + 4; x.beginPath(); x.ellipse(48, hy, 22, 5, 0, 0, TAU); x.fillStyle = '#1a1420'; x.fill(); outline(x, INK, 1); x.beginPath(); x.moveTo(36, hy); x.lineTo(37, hy - 24); x.quadraticCurveTo(48, hy - 27, 59, hy - 24); x.lineTo(60, hy); x.quadraticCurveTo(48, hy + 3, 36, hy); x.closePath(); x.fillStyle = lg(x, 36, 0, 60, 0, [[0, '#0a080c'], [0.35, '#4a4058'], [1, '#08060a']]); x.fill(); outline(x, INK, 1); x.fillStyle = '#b02a3a'; x.fillRect(36.6, hy - 7, 22.8, 4); leafy(x, 58, hy - 8, 12, 4, -0.6, leafC); }
  if (cfg.hat === 'acorn') { const hy = cy - r + 8; x.beginPath(); x.moveTo(22, hy + 2); x.bezierCurveTo(20, hy - 22, 76, hy - 22, 74, hy + 2); x.quadraticCurveTo(48, hy - 4, 22, hy + 2); x.closePath(); x.fillStyle = rg(x, 40, hy - 16, 2, 30, [[0, '#c89a60'], [0.6, '#7a5028'], [1, '#3a2008']]); x.fill(); outline(x, INK, 1); x.strokeStyle = 'rgba(40,20,5,.55)'; x.lineWidth = 0.8; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(26 + i * 11, hy); x.lineTo(34 + i * 9, hy - 14); x.stroke(); x.beginPath(); x.moveTo(70 - i * 11, hy); x.lineTo(62 - i * 9, hy - 14); x.stroke(); } }
  if (cfg.hat === 'pirate') { const hy = cy - r + 6; x.beginPath(); x.moveTo(16, hy + 4); x.quadraticCurveTo(48, hy - 8, 80, hy + 4); x.quadraticCurveTo(68, hy - 4, 62, hy - 18); x.quadraticCurveTo(48, hy - 24, 34, hy - 18); x.quadraticCurveTo(28, hy - 4, 16, hy + 4); x.closePath(); x.fillStyle = lg(x, 16, hy - 24, 80, hy + 4, [[0, '#4a3a5a'], [1, '#12081a']]); x.fill(); outline(x, INK, 1); x.fillStyle = '#f0e8d8'; circle(x, 48, hy - 10, 3.4); x.fill(); x.fillStyle = '#1a1010'; circle(x, 46.8, hy - 10.4, 0.9); x.fill(); circle(x, 49.2, hy - 10.4, 0.9); x.fill(); }
  if (cfg.prop === 'twig') { x.strokeStyle = lg(x, 80, 20, 90, 100, [[0, '#a07a4a'], [1, '#4a3018']]); x.lineWidth = 3.4; x.beginPath(); x.moveTo(84, 100); x.quadraticCurveTo(88, 60, 82, 26); x.stroke(); leafy(x, 82, 28, 12, 4, -2.2, leafC); }
  if (cfg.prop === 'seed') { glow(x, 20, 84, 12, '#f0ffa0', 0.8); circle(x, 20, 84, 6); x.fillStyle = rg(x, 18, 82, 0, 7, [[0, '#fff8c0'], [1, '#b08a30']]); x.fill(); outline(x, INK, 0.8); leafy(x, 20, 78, 8, 3, -1.2, leafC); }
  if (cfg.prop === 'mug') { x.beginPath(); x.roundRect(12, 78, 16, 18, 3); x.fillStyle = lg(x, 12, 78, 28, 96, [[0, '#c89a60'], [1, '#6a4020']]); x.fill(); outline(x, INK, 0.9); x.fillStyle = '#fff8e8'; ellipse(x, 20, 79, 8, 3); x.fill(); }
}
function leafy(x, cx, cy, len, w, a, col) {
  x.save(); x.translate(cx, cy); x.rotate(a);
  x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(len * 0.3, -w, len * 0.75, -w * 0.8, len, 0); x.bezierCurveTo(len * 0.75, w * 0.8, len * 0.3, w, 0, 0); x.closePath();
  x.fillStyle = lg(x, 0, -w, 0, w, [[0, shade(col, 0.45)], [0.5, col], [1, shade(col, -0.5)]]); x.fill(); outline(x, INK, 0.7);
  x.strokeStyle = rgba(shade(col, -0.6), 0.8); x.lineWidth = 0.6; x.beginPath(); x.moveTo(1, 0); x.lineTo(len - 2, 0); x.stroke();
  x.restore();
}

// ------------------------------------------------------------------ city objects (Wayfarer's board, mailbox, party finder)
export function noticeBoard(x, R, o = {}) {
  backdrop(x, R, o.bg || ['#8a7a5a', '#2a2216', '#070503'], { shaft: false });
  for (const px of [22, 78]) { x.fillStyle = lg(x, px - 3, 0, px + 3, 0, [[0, '#3a2410'], [0.5, '#8a5a2a'], [1, '#2a1606']]); x.fillRect(px - 3, 30, 6, 70); outline(x, INK, 0.7); x.strokeRect(px - 3, 30, 6, 70); }
  x.beginPath(); x.roundRect(12, 18, 76, 58, 3); x.fillStyle = lg(x, 12, 18, 88, 76, [[0, '#a0764a'], [1, '#4a2e12']]); x.fill(); outline(x, INK, 1.2);
  x.strokeStyle = 'rgba(40,20,5,.45)'; x.lineWidth = 0.8; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(12, 18 + i * 11.6); x.lineTo(88, 18 + i * 11.6); x.stroke(); }
  x.beginPath(); x.moveTo(8, 20); x.lineTo(50, 6); x.lineTo(92, 20); x.closePath(); x.fillStyle = lg(x, 8, 6, 92, 20, [[0, '#6a3a1a'], [1, '#2a1406']]); x.fill(); outline(x, INK, 1);
  const papers = o.papers || [[20, 26, -0.08], [44, 24, 0.05], [66, 28, 0.1], [26, 50, 0.06], [52, 48, -0.06], [70, 52, 0.04]];
  papers.forEach(([px, py, a], i) => { x.save(); x.translate(px + 7, py + 9); x.rotate(a); x.beginPath(); x.rect(-8, -10, 16, 20); x.fillStyle = lg(x, -8, -10, 8, 10, [[0, '#fff8e0'], [1, '#d8c498']]); x.fill(); outline(x, INK, 0.6); x.strokeStyle = 'rgba(90,60,30,.5)'; x.lineWidth = 0.6; for (let j = 0; j < 4; j++) { x.beginPath(); x.moveTo(-5, -5 + j * 4); x.lineTo(5, -5 + j * 4); x.stroke(); } if (o.marks) { x.fillStyle = o.marks[i % o.marks.length]; circle(x, 4, -7, 1.6); x.fill(); } x.fillStyle = '#c02a2a'; circle(x, 0, -9, 1.2); x.fill(); x.restore(); });
  if (o.flags) for (const [px, c] of [[18, '#c83a3a'], [82, '#3a6ac8']]) { x.strokeStyle = '#3a2410'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px, 20); x.lineTo(px, 2); x.stroke(); poly(x, [[px, 3], [px + (px < 50 ? 12 : -12), 7], [px, 11]]); x.fillStyle = c; x.fill(); outline(x, INK, 0.6); }
}
export function mailbox(x, R) {
  backdrop(x, R, ['#5a6a8a', '#1a2030', '#050608'], { shaft: false });
  x.fillStyle = lg(x, 46, 0, 54, 0, [[0, '#3a2410'], [0.5, '#8a5a2a'], [1, '#2a1606']]); x.fillRect(46, 60, 8, 40); outline(x, INK, 0.7); x.strokeRect(46, 60, 8, 40);
  x.beginPath(); x.moveTo(20, 60); x.lineTo(20, 38); x.bezierCurveTo(20, 20, 80, 20, 80, 38); x.lineTo(80, 60); x.closePath(); x.fillStyle = lg(x, 20, 20, 80, 60, [[0, '#3a6ac8'], [0.5, '#244a90'], [1, '#0e1e40']]); x.fill(); outline(x, INK, 1.2);
  x.strokeStyle = metalLG(x, 20, 30, 80, 40, 'gold'); x.lineWidth = 1.6; x.beginPath(); x.moveTo(22, 42); x.lineTo(78, 42); x.stroke();
  x.fillStyle = '#0a0c14'; x.beginPath(); x.roundRect(34, 46, 32, 5, 2); x.fill();
  x.save(); x.translate(52, 44); x.rotate(-0.15); x.beginPath(); x.rect(-10, -8, 20, 12); x.fillStyle = '#f8f0dc'; x.fill(); outline(x, INK, 0.7); x.beginPath(); x.moveTo(-10, -8); x.lineTo(0, -1); x.lineTo(10, -8); x.stroke(); circle(x, 0, -1, 2); x.fillStyle = '#c02a2a'; x.fill(); x.restore();
  x.strokeStyle = '#c02a2a'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(80, 50); x.lineTo(90, 50); x.lineTo(90, 30); x.stroke(); poly(x, [[90, 30], [98, 34], [90, 38]]); x.fillStyle = '#e04a3a'; x.fill(); outline(x, INK, 0.6);
}
export { leafy };
