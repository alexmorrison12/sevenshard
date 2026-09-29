// Reusable painted subjects: weapons, hands, figures, creatures, chains, wings. Local coordinates, light from top-left.
import {
  TAU, PI, lg, rg, poly, circle, ellipse, star, blur, noBlur, outline, rgba, shade, mix, metal, metalLG, metalRG, ribbon,
  glow, sparkle, bez, qbez, strokeCurve, gem,
} from './core.js';

const INK = 'rgba(6,4,8,.92)';

// ------------------------------------------------------------------ blades
/** Greatsword: hilt centre at (0,0), blade toward −y. o: len, w, metal, guard, glow (colour), rune (colour), gem */
export function greatsword(x, o = {}) {
  const L = o.len ?? 62, w = o.w ?? 16, m = metal(o.metal || 'steel'), gm = metal(o.guard || 'dark');
  const h = w / 2, b0 = -4;
  const outlineP = () => poly(x, [[-h, b0], [-h * 1.08, -L * 0.62], [-h * 0.72, -L + w * 0.9], [0, -L], [h * 0.72, -L + w * 0.9], [h * 1.08, -L * 0.62], [h, b0]]);
  if (o.glow) { outlineP(); blur(x, o.glowR ?? 8, o.glow); x.fillStyle = rgba(o.glow, 0.9); x.fill(); x.fill(); noBlur(x); }
  // lit half / shade half
  poly(x, [[-h, b0], [-h * 1.08, -L * 0.62], [-h * 0.72, -L + w * 0.9], [0, -L], [0, b0]]);
  x.fillStyle = lg(x, -h, 0, 0, 0, [[0, m[2]], [0.35, m[1]], [1, m[0]]]); x.fill();
  poly(x, [[0, b0], [0, -L], [h * 0.72, -L + w * 0.9], [h * 1.08, -L * 0.62], [h, b0]]);
  x.fillStyle = lg(x, 0, 0, h, 0, [[0, m[2]], [0.5, m[3]], [1, m[4]]]); x.fill();
  // fuller
  x.fillStyle = lg(x, -w * 0.12, 0, w * 0.12, 0, [[0, m[3]], [0.5, m[4]], [1, m[2]]]);
  poly(x, [[-w * 0.11, b0 - 3], [-w * 0.08, -L * 0.66], [0, -L * 0.7], [w * 0.08, -L * 0.66], [w * 0.11, b0 - 3]]); x.fill();
  if (o.rune) {
    const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
    x.strokeStyle = rgba(o.rune, 0.5); x.lineWidth = w * 0.26; x.beginPath(); x.moveTo(0, b0 - 4); x.lineTo(0, -L * 0.64); x.stroke();
    x.strokeStyle = rgba(mix(o.rune, '#ffffff', 0.6), 0.95); x.lineWidth = w * 0.08; x.stroke();
    x.globalCompositeOperation = pc;
  }
  // edge highlight
  x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 0.8; poly(x, [[-h + 0.6, b0 - 1], [-h * 1.08 + 0.7, -L * 0.62], [-h * 0.72 + 0.6, -L + w * 0.9], [0, -L + 1.2]], false); x.stroke();
  outlineP(); outline(x, INK, 1.1);
  // guard
  const gw = o.guardW ?? w * 2.3;
  x.beginPath();
  x.moveTo(-gw / 2, -9); x.quadraticCurveTo(-gw * 0.3, -3.5, 0, -5); x.quadraticCurveTo(gw * 0.3, -3.5, gw / 2, -9);
  x.quadraticCurveTo(gw / 2 + 1.5, -3, gw / 2 - 3, 2); x.quadraticCurveTo(gw * 0.2, 1, 0, 4); x.quadraticCurveTo(-gw * 0.2, 1, -gw / 2 + 3, 2);
  x.quadraticCurveTo(-gw / 2 - 1.5, -3, -gw / 2, -9); x.closePath();
  x.fillStyle = lg(x, 0, -8, 0, 4, [[0, gm[0]], [0.4, gm[1]], [1, gm[3]]]); x.fill(); outline(x, INK, 1);
  x.strokeStyle = metalLG(x, -gw / 2, 0, gw / 2, 0, o.trim || 'gold'); x.lineWidth = 1; x.beginPath(); x.moveTo(-gw / 2 + 1.5, -7.4); x.quadraticCurveTo(-gw * 0.3, -2.4, 0, -3.6); x.quadraticCurveTo(gw * 0.3, -2.4, gw / 2 - 1.5, -7.4); x.stroke();
  if (o.gem) gem(x, 0, -1, 3, o.gem, { n: 6, glowA: 0.6, spark: false, lw: 0.6 });
  // grip + pommel
  const gl = o.grip ?? 14;
  x.fillStyle = lg(x, -2.6, 0, 2.6, 0, [[0, '#1a0c06'], [0.4, '#5a2e16'], [1, '#120804']]); x.fillRect(-2.5, 4, 5, gl);
  x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 0.8; for (let yy = 5.5; yy < gl + 3; yy += 2.6) { x.beginPath(); x.moveTo(-2.5, yy); x.lineTo(2.5, yy + 1.5); x.stroke(); }
  x.fillStyle = metalRG(x, 0, gl + 6.5, 4, o.trim || 'gold'); poly(x, [[0, gl + 2.5], [3.8, gl + 5.8], [0, gl + 10.5], [-3.8, gl + 5.8]]); x.fill(); outline(x, INK, 0.8);
}
/** Slim knightly longsword: hilt centre at (0,0), blade toward −y. */
export function longsword(x, o = {}) {
  const L = o.len ?? 60, w = o.w ?? 7.5, m = metal(o.metal || 'silver'), h = w / 2, b0 = -3;
  const outlineP = () => poly(x, [[-h, b0], [-h * 0.92, -L + w * 1.6], [0, -L], [h * 0.92, -L + w * 1.6], [h, b0]]);
  if (o.glow) { outlineP(); blur(x, o.glowR ?? 8, o.glow); x.fillStyle = rgba(o.glow, 0.9); x.fill(); x.fill(); noBlur(x); }
  poly(x, [[-h, b0], [-h * 0.92, -L + w * 1.6], [0, -L], [0, b0]]); x.fillStyle = lg(x, -h, 0, 0, 0, [[0, m[2]], [0.4, m[1]], [1, m[0]]]); x.fill();
  poly(x, [[0, b0], [0, -L], [h * 0.92, -L + w * 1.6], [h, b0]]); x.fillStyle = lg(x, 0, 0, h, 0, [[0, m[2]], [1, m[4]]]); x.fill();
  x.strokeStyle = rgba(m[3], 0.8); x.lineWidth = w * 0.14; x.beginPath(); x.moveTo(0, b0 - 3); x.lineTo(0, -L * 0.7); x.stroke();
  if (o.rune) { const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter'; x.strokeStyle = rgba(o.rune, 0.9); x.lineWidth = w * 0.12; x.stroke(); x.globalCompositeOperation = pc; }
  x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 0.7; poly(x, [[-h + 0.5, b0 - 1], [-h * 0.92 + 0.5, -L + w * 1.6], [0, -L + 1]], false); x.stroke();
  outlineP(); outline(x, INK, 1);
  // cross guard with flared ends
  const gw = o.guardW ?? 26, gm = o.guard || 'gold';
  x.beginPath(); x.moveTo(-gw / 2, -5.5); x.lineTo(-gw / 2 + 3, -3); x.lineTo(gw / 2 - 3, -3); x.lineTo(gw / 2, -5.5); x.lineTo(gw / 2 + 0.5, 0.5); x.lineTo(gw / 2 - 3, -0.5); x.lineTo(-gw / 2 + 3, -0.5); x.lineTo(-gw / 2 - 0.5, 0.5); x.closePath();
  x.fillStyle = lg(x, 0, -5, 0, 1, [[0, metal(gm)[0]], [0.5, metal(gm)[1]], [1, metal(gm)[3]]]); x.fill(); outline(x, INK, 0.8);
  if (o.gem) gem(x, 0, -2, 2.6, o.gem, { n: 6, glowA: 0.5, spark: false, lw: 0.5 });
  const gl = o.grip ?? 11;
  x.fillStyle = lg(x, -2, 0, 2, 0, [[0, '#2a1606'], [0.45, '#8a5a2a'], [1, '#1a0a02']]); x.fillRect(-1.9, 0, 3.8, gl);
  x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 0.6; for (let yy = 1.5; yy < gl; yy += 2) { x.beginPath(); x.moveTo(-1.9, yy); x.lineTo(1.9, yy + 1.1); x.stroke(); }
  x.fillStyle = metalRG(x, 0, gl + 2.6, 3, gm); circle(x, 0, gl + 2.6, 2.8); x.fill(); outline(x, INK, 0.7);
}
/** Curved single-edged dancer's blade: hilt at (0,0), blade toward −y, edge on the right. */
export function curvedBlade(x, o = {}) {
  const L = o.len ?? 44, w = o.w ?? 7, m = metal(o.metal || 'silver'), c = o.curve ?? 7;
  const P = () => {
    x.beginPath(); x.moveTo(-w * 0.35, -2);
    x.bezierCurveTo(-w * 0.45 - c * 0.2, -L * 0.45, -c * 0.5, -L * 0.8, c * 0.9, -L);
    x.bezierCurveTo(c * 0.4 + w * 0.3, -L * 0.75, w * 0.9 + c * 0.2, -L * 0.4, w * 0.65, -2); x.closePath();
  };
  if (o.glow) { P(); blur(x, o.glowR ?? 7, o.glow); x.fillStyle = rgba(o.glow, 0.9); x.fill(); x.fill(); noBlur(x); }
  P(); x.fillStyle = lg(x, -w, -L * 0.5, w, -L * 0.45, [[0, m[3]], [0.35, m[1]], [0.55, m[0]], [0.75, m[2]], [1, m[4]]]); x.fill();
  if (o.edgeGlow) { const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter'; x.strokeStyle = rgba(o.edgeGlow, 0.9); x.lineWidth = 1.4; x.beginPath(); x.moveTo(w * 0.65, -3); x.bezierCurveTo(w * 0.9 + c * 0.2, -L * 0.4, c * 0.4 + w * 0.3, -L * 0.75, c * 0.9, -L); x.stroke(); x.globalCompositeOperation = pc; }
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(w * 0.5, -4); x.bezierCurveTo(w * 0.75 + c * 0.2, -L * 0.4, c * 0.35 + w * 0.2, -L * 0.74, c * 0.85, -L + 1.5); x.stroke();
  P(); outline(x, INK, 0.9);
  // small guard + wrapped grip
  x.fillStyle = metalLG(x, -5, 0, 5, 0, o.guard || 'dark'); x.beginPath(); x.ellipse(0.2, -1, 5.2, 2, -0.1, 0, TAU); x.fill(); outline(x, INK, 0.7);
  const gl = o.grip ?? 10;
  x.fillStyle = lg(x, -2, 0, 2, 0, [[0, '#1a1024'], [0.45, o.wrap || '#5a3a8a'], [1, '#0c0612']]); x.fillRect(-1.8, 0.5, 3.6, gl);
  x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 0.6; for (let yy = 2; yy < gl; yy += 2) { x.beginPath(); x.moveTo(-1.8, yy); x.lineTo(1.8, yy + 1); x.stroke(); }
  x.fillStyle = metalRG(x, 0, gl + 1.8, 2.2, o.guard || 'dark'); circle(x, 0, gl + 1.8, 2.1); x.fill(); outline(x, INK, 0.6);
}
/** Demonic glaive: butt at (0,0), blade toward −y. */
export function glaive(x, o = {}) {
  const L = o.len ?? 78, m = metal(o.metal || 'obsidian'), bl = o.blade ?? 26;
  // haft
  x.fillStyle = lg(x, -2, 0, 2, 0, [[0, '#0a0608'], [0.45, '#3a2632'], [1, '#050304']]); x.fillRect(-1.8, -L + bl * 0.6, 3.6, L - bl * 0.6);
  outline(x, INK, 0.6); x.strokeRect(-1.8, -L + bl * 0.6, 3.6, L - bl * 0.6);
  for (const yy of [-L * 0.35, -L * 0.62]) { x.fillStyle = metalLG(x, -3, 0, 3, 0, o.bands || 'crimson'); x.fillRect(-2.6, yy, 5.2, 3); outline(x, INK, 0.5); x.strokeRect(-2.6, yy, 5.2, 3); }
  // crescent blade
  x.save(); x.translate(0, -L + bl * 0.55);
  const P = () => { x.beginPath(); x.moveTo(-2, 4); x.bezierCurveTo(-14, -2, -12, -bl * 0.8, 2, -bl * 1.25); x.bezierCurveTo(-3, -bl * 0.75, -4, -bl * 0.25, 3, -2); x.bezierCurveTo(10, 0, 12, 6, 10, 10); x.closePath(); };
  if (o.glow) { P(); blur(x, o.glowR ?? 8, o.glow); x.fillStyle = rgba(o.glow, 0.9); x.fill(); x.fill(); noBlur(x); }
  P(); x.fillStyle = lg(x, -14, -bl, 8, 4, [[0, m[0]], [0.3, m[1]], [0.6, m[2]], [1, m[4]]]); x.fill(); outline(x, INK, 0.9);
  if (o.edge) { const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter'; x.strokeStyle = rgba(o.edge, 0.95); x.lineWidth = 1.2; x.beginPath(); x.moveTo(-2, 3); x.bezierCurveTo(-13.2, -2, -11.2, -bl * 0.8, 2, -bl * 1.22); x.stroke(); x.globalCompositeOperation = pc; }
  // back spike
  poly(x, [[2, -1], [12, -8], [4, 3]]); x.fillStyle = lg(x, 2, -8, 12, 2, [[0, m[1]], [1, m[3]]]); x.fill(); outline(x, INK, 0.7);
  x.restore();
}
/** Claw hand of three hooked talons, wrist at (0,0), reaching toward −y. */
export function claws(x, o = {}) {
  const col = o.col || '#2a1a2e', tal = o.talon || '#e8dcc8';
  x.beginPath(); x.moveTo(-9, 8); x.bezierCurveTo(-12, -2, -8, -12, 0, -14); x.bezierCurveTo(8, -12, 12, -2, 9, 8); x.closePath();
  x.fillStyle = rg(x, -3, -6, 1, 18, [[0, shade(col, 0.5)], [0.6, col], [1, shade(col, -0.7)]]); x.fill(); outline(x, INK, 1);
  for (const [a, l] of [[-0.45, 22], [0, 26], [0.45, 22]]) {
    x.save(); x.rotate(a); x.translate(0, -12);
    x.beginPath(); x.moveTo(-3, 0); x.bezierCurveTo(-4, -l * 0.5, 0, -l * 0.9, 5, -l); x.bezierCurveTo(1.5, -l * 0.7, 2.5, -l * 0.35, 3, 0); x.closePath();
    x.fillStyle = lg(x, -4, 0, 4, -l, [[0, shade(col, -0.2)], [0.35, shade(tal, -0.35)], [1, tal]]); x.fill(); outline(x, INK, 0.8);
    x.restore();
  }
}

// ------------------------------------------------------------------ firearms (side view, muzzle toward +x, grip at origin)
export function pistol(x, o = {}) {
  const m = metal(o.metal || 'dark'), br = metal(o.trim || 'brass'), L = o.len ?? 34;
  // grip
  x.beginPath(); x.moveTo(-4, -6); x.bezierCurveTo(-8, 2, -10, 10, -8, 16); x.lineTo(0, 17); x.bezierCurveTo(-1, 10, 1, 2, 5, -4); x.closePath();
  x.fillStyle = lg(x, -9, 0, 3, 8, [[0, '#6a3a1a'], [0.5, '#3a1e0c'], [1, '#1a0c04']]); x.fill(); outline(x, INK, 0.9);
  x.fillStyle = metalRG(x, -4, 16.5, 3, br); circle(x, -4, 16.5, 2.6); x.fill(); outline(x, INK, 0.6);
  // frame + cylinder
  x.beginPath(); x.roundRect(-6, -11, 16, 9, 2); x.fillStyle = metalLG(x, 0, -11, 0, -2, m); x.fill(); outline(x, INK, 0.9);
  x.beginPath(); x.roundRect(-1, -12, 9, 10, 3); x.fillStyle = metalLG(x, 0, -12, 0, -2, br); x.fill(); outline(x, INK, 0.8);
  for (const yy of [-9.5, -7, -4.5]) { x.strokeStyle = rgba(br[4], 0.7); x.lineWidth = 0.6; x.beginPath(); x.moveTo(0, yy); x.lineTo(7, yy); x.stroke(); }
  // barrel
  x.beginPath(); x.roundRect(8, -10.5, L - 8, 5.2, 1.5); x.fillStyle = metalLG(x, 0, -10.5, 0, -5.3, m); x.fill(); outline(x, INK, 0.9);
  x.fillStyle = metalLG(x, 0, -11.5, 0, -4.5, br); x.fillRect(L - 3.5, -11.5, 3.5, 7); x.fillRect(12, -11.2, 3, 6.4);
  x.strokeStyle = INK; x.lineWidth = 0.6; x.strokeRect(L - 3.5, -11.5, 3.5, 7);
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(9, -9.8); x.lineTo(L - 4, -9.8); x.stroke();
  // hammer + trigger guard
  poly(x, [[-6, -10], [-10, -15], [-7, -15.5], [-3, -11]]); x.fillStyle = metalLG(x, -10, -15, -3, -10, m); x.fill(); outline(x, INK, 0.6);
  x.strokeStyle = metalLG(x, -2, 0, 6, 0, br); x.lineWidth = 1.3; x.beginPath(); x.arc(2, -1, 4, 0.1, PI - 0.3); x.stroke();
}
export function shotgun(x, o = {}) {
  const m = metal(o.metal || 'dark'), br = metal(o.trim || 'brass'), L = o.len ?? 46;
  // stock
  x.beginPath(); x.moveTo(-22, -6); x.lineTo(-4, -9); x.lineTo(2, -3); x.lineTo(-2, 1); x.lineTo(-24, 6); x.quadraticCurveTo(-27, 0, -22, -6); x.closePath();
  x.fillStyle = lg(x, -24, -8, -4, 6, [[0, '#8a5028'], [0.5, '#4a260e'], [1, '#1c0c04']]); x.fill(); outline(x, INK, 0.9);
  // receiver
  x.beginPath(); x.roundRect(-4, -11, 14, 9, 2); x.fillStyle = metalLG(x, 0, -11, 0, -2, br); x.fill(); outline(x, INK, 0.9);
  // twin barrels (wide)
  for (const [yy, hh] of [[-13.5, 4.6], [-9, 4.6]]) { x.beginPath(); x.roundRect(9, yy, L - 9, hh, 1.6); x.fillStyle = metalLG(x, 0, yy, 0, yy + hh, m); x.fill(); outline(x, INK, 0.8); }
  x.fillStyle = metalLG(x, 0, -14.5, 0, -3.5, br); x.fillRect(L - 4, -14.5, 4, 11); x.strokeStyle = INK; x.lineWidth = 0.6; x.strokeRect(L - 4, -14.5, 4, 11);
  // pump
  x.beginPath(); x.roundRect(16, -5, 14, 4.5, 2); x.fillStyle = lg(x, 0, -5, 0, -0.5, [[0, '#9a6030'], [1, '#3a1c08']]); x.fill(); outline(x, INK, 0.7);
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(10, -13); x.lineTo(L - 5, -13); x.stroke();
}
export function rifle(x, o = {}) {
  const m = metal(o.metal || 'dark'), br = metal(o.trim || 'brass'), L = o.len ?? 70;
  x.beginPath(); x.moveTo(-28, -4); x.lineTo(-6, -7); x.lineTo(0, -1); x.lineTo(-4, 3); x.lineTo(-30, 8); x.quadraticCurveTo(-33, 2, -28, -4); x.closePath();
  x.fillStyle = lg(x, -30, -6, -4, 6, [[0, '#8a5028'], [0.5, '#4a260e'], [1, '#1c0c04']]); x.fill(); outline(x, INK, 0.9);
  x.beginPath(); x.roundRect(-6, -9, 16, 7, 1.5); x.fillStyle = metalLG(x, 0, -9, 0, -2, m); x.fill(); outline(x, INK, 0.8);
  x.beginPath(); x.roundRect(9, -8, L - 9, 3.6, 1.2); x.fillStyle = metalLG(x, 0, -8, 0, -4.4, m); x.fill(); outline(x, INK, 0.7);
  x.fillStyle = metalLG(x, 0, -9, 0, -3.4, br); x.fillRect(L - 4, -9, 4, 5.6); x.fillRect(26, -8.6, 2.4, 4.8);
  // scope
  x.beginPath(); x.roundRect(-4, -16, 22, 4.6, 2.2); x.fillStyle = metalLG(x, 0, -16, 0, -11.4, br); x.fill(); outline(x, INK, 0.8);
  x.fillStyle = rgba(o.lens || '#80d0ff', 0.9); ellipse(x, 18, -13.7, 1.2, 2.2); x.fill();
  x.fillStyle = metalLG(x, 0, -12, 0, -9, m); x.fillRect(2, -11.6, 2.4, 3); x.fillRect(12, -11.6, 2.4, 3);
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(10, -7.4); x.lineTo(L - 5, -7.4); x.stroke();
}
/** Muzzle flash at (0,0) pointing +x. */
export function muzzle(x, R, s = 1, col = '#ff8a1e') {
  x.save(); x.scale(s, s);
  glow(x, 6, 0, 22, col, 0.8);
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  x.beginPath();
  const n = 7;
  for (let i = 0; i < n * 2; i++) { const a = -PI * 0.55 + (i / (n * 2 - 1)) * PI * 1.1, r = i % 2 ? 4 : 10 + R() * 9 + (Math.abs(a) < 0.3 ? 8 : 0); const px = 3 + Math.cos(a) * r, py = Math.sin(a) * r * 0.7; i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.closePath(); x.fillStyle = rg(x, 3, 0, 0, 20, [[0, '#ffffff'], [0.3, '#fff0a0'], [0.6, rgba(col, 0.85)], [1, rgba(col, 0)]]); x.fill();
  x.globalCompositeOperation = pc; x.restore();
}

// ------------------------------------------------------------------ magic implements
/** Staff with star orb head: foot at (0,0), head toward −y. */
export function staff(x, o = {}) {
  const L = o.len ?? 80, orb = o.orb || '#a86aff';
  x.fillStyle = lg(x, -2.4, 0, 2.4, 0, [[0, '#2a1606'], [0.4, '#8a5a30'], [1, '#1a0a02']]);
  x.beginPath(); x.roundRect(-2, -L + 14, 4, L - 14, 2); x.fill(); outline(x, INK, 0.7);
  for (const yy of [-L * 0.25, -L * 0.55]) { x.fillStyle = metalLG(x, -3, 0, 3, 0, o.trim || 'silver'); x.fillRect(-2.8, yy, 5.6, 2.6); }
  // cradle prongs
  x.save(); x.translate(0, -L + 12);
  const tm = o.trim || 'silver';
  for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 2, 2); x.bezierCurveTo(s * 10, -2, s * 10, -12, s * 3, -18); x.lineWidth = 2.2; x.strokeStyle = metalLG(x, -10, -18, 10, 2, tm); x.stroke(); }
  glow(x, 0, -10, 18, orb, 0.9);
  x.fillStyle = rg(x, -2, -12, 0.5, 7, [[0, '#ffffff'], [0.35, mix(orb, '#ffffff', 0.5)], [1, orb]]); circle(x, 0, -10, 5.8); x.fill(); outline(x, rgba(shade(orb, -0.6), 0.8), 0.7);
  sparkle(x, -1.5, -11.5, 5);
  x.restore();
}
/** Harp: base centre at (0,0), ~48 tall. */
export function harp(x, o = {}) {
  const m = metal(o.metal || 'rose'), str = o.strings || '#7af0e4';
  // soundbox pillar (right) + neck (top curve) + column (left)
  const frame = () => {
    x.beginPath();
    x.moveTo(-16, 4); x.bezierCurveTo(-20, -18, -20, -36, -12, -46);  // column
    x.bezierCurveTo(-4, -52, 6, -36, 18, -40); x.bezierCurveTo(24, -42, 24, -48, 20, -50); // neck scroll
    x.bezierCurveTo(28, -48, 28, -36, 20, -34); x.lineTo(16, 4); x.closePath();
  };
  frame(); x.fillStyle = metalLG(x, -20, -50, 26, 4, m); x.fill(); outline(x, INK, 1);
  // inner cut-out (strings area)
  x.beginPath(); x.moveTo(-12, 0); x.bezierCurveTo(-15, -16, -15, -32, -9, -40); x.bezierCurveTo(-2, -44, 6, -32, 14, -34); x.lineTo(11, 0); x.closePath();
  x.fillStyle = o.hole || 'rgba(10,6,14,.85)'; x.fill(); outline(x, rgba(m[4], 0.8), 0.7);
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const t = i / 6, xx = -10 + t * 22, top = -40 + Math.sin(t * PI) * -2 + t * 6 + (t > 0.6 ? 2 : 0);
    x.strokeStyle = rgba(str, 0.45); x.lineWidth = 1.4; x.beginPath(); x.moveTo(xx, top); x.lineTo(xx * 0.95, 0); x.stroke();
    x.strokeStyle = rgba('#ffffff', 0.8); x.lineWidth = 0.45; x.stroke();
  }
  x.globalCompositeOperation = pc;
  // base
  x.beginPath(); x.roundRect(-19, 0, 38, 6, 3); x.fillStyle = metalLG(x, 0, 0, 0, 6, m); x.fill(); outline(x, INK, 0.8);
  if (o.gem) gem(x, 21, -43, 3, o.gem, { n: 6, spark: false, glowA: 0.6, lw: 0.5 });
}
/** Closed book, spine left, cover facing viewer, centre (0,0), w×h. */
export function book(x, w, h, cover, o = {}) {
  // pages block (visible at right/bottom edge)
  x.beginPath(); x.roundRect(-w / 2 + 2, -h / 2 + 2.5, w, h, 2); x.fillStyle = lg(x, 0, -h / 2, 0, h / 2, [[0, '#f4ead0'], [1, '#b8a47a']]); x.fill(); outline(x, INK, 0.9);
  x.strokeStyle = 'rgba(120,90,50,.5)'; x.lineWidth = 0.4; for (let i = 1; i < 5; i++) { x.beginPath(); x.moveTo(w / 2 + 0.5, -h / 2 + 3 + i * 1.2); x.lineTo(w / 2 + 0.5, h / 2 + 1); x.stroke(); }
  // cover
  x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 2.5);
  x.fillStyle = lg(x, -w / 2, -h / 2, w / 2, h / 2, [[0, shade(cover, 0.3)], [0.5, cover], [1, shade(cover, -0.55)]]); x.fill(); outline(x, INK, 1.1);
  // spine band
  x.fillStyle = lg(x, -w / 2, 0, -w / 2 + 7, 0, [[0, shade(cover, -0.6)], [0.5, shade(cover, -0.2)], [1, shade(cover, -0.5)]]); x.fillRect(-w / 2, -h / 2, 6, h);
  // metal corners + border
  const tm = o.trim || 'gold';
  x.strokeStyle = metalLG(x, -w / 2, -h / 2, w / 2, h / 2, tm); x.lineWidth = 1.2; x.beginPath(); x.roundRect(-w / 2 + 8, -h / 2 + 3, w - 11, h - 6, 1.5); x.stroke();
  for (const [cx, cy, sx, sy] of [[w / 2, -h / 2, -1, 1], [w / 2, h / 2, -1, -1]]) { poly(x, [[cx, cy], [cx + sx * 9, cy], [cx, cy + sy * 9]]); x.fillStyle = metalLG(x, cx + sx * 9, cy, cx, cy + sy * 9, tm); x.fill(); outline(x, INK, 0.6); }
}

// ------------------------------------------------------------------ hands & figures
/** Armoured fist seen from the side, knuckles toward +x, wrist at (0,0). o: metal, trim, glow (rune colour), cuff */
export function fist(x, o = {}) {
  const m = metal(o.metal || 'steel'), tm = o.trim || 'gold', cuff = o.cuff || '#2a2030';
  // vambrace flaring toward the elbow
  x.beginPath(); x.moveTo(-34, -13); x.lineTo(-5, -10.5); x.lineTo(-5, 10.5); x.lineTo(-34, 14); x.closePath();
  x.fillStyle = lg(x, 0, -13, 0, 14, [[0, m[1]], [0.25, m[0]], [0.5, m[2]], [0.85, m[3]], [1, m[4]]]); x.fill(); outline(x, INK, 1);
  x.fillStyle = lg(x, 0, -12, 0, 12, [[0, shade(cuff, 0.3)], [1, shade(cuff, -0.5)]]); x.fillRect(-9, -10.5, 4, 21);
  for (const bx of [-31, -17]) { x.fillStyle = metalLG(x, bx, -14, bx + 3, 14, tm); x.fillRect(bx, -13 + (bx + 34) * 0.08, 3, 26.5 - (bx + 34) * 0.18); }
  if (o.glow) { const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter'; x.strokeStyle = rgba(o.glow, 0.5); x.lineWidth = 3; x.beginPath(); x.moveTo(-28, 0.5); x.lineTo(-10, 0); x.stroke(); x.strokeStyle = rgba('#ffffff', 0.9); x.lineWidth = 1; x.stroke(); x.globalCompositeOperation = pc; }
  // back of hand + palm
  x.beginPath(); x.moveTo(-6, -11); x.bezierCurveTo(0, -15, 8, -16, 14, -14.5); x.lineTo(15, 12); x.bezierCurveTo(8, 14, 0, 14, -6, 11); x.closePath();
  x.fillStyle = rg(x, 2, -9, 1, 24, [[0, m[0]], [0.3, m[1]], [0.75, m[2]], [1, m[4]]]); x.fill(); outline(x, INK, 1.1);
  // curled fingers: four stacked rolls forming the punching face
  for (let i = 0; i < 4; i++) {
    const y = -14.5 + i * 6.4;
    x.beginPath(); x.roundRect(11, y, 12.5 - i * 0.6, 6.6, 3.2);
    x.fillStyle = lg(x, 11, y, 23, y + 6.6, [[0, m[0]], [0.4, m[1]], [1, m[3]]]); x.fill(); outline(x, INK, 0.8);
  }
  // thumb wrapped across the lower fingers
  x.beginPath(); x.moveTo(0, 3); x.bezierCurveTo(8, 0, 18, 1, 21, 5); x.bezierCurveTo(20, 9.5, 11, 10.5, 1, 8.5); x.closePath();
  x.fillStyle = lg(x, 0, 1, 12, 10, [[0, m[0]], [0.5, m[1]], [1, m[3]]]); x.fill(); outline(x, INK, 0.9);
  // knuckle guard
  x.beginPath(); x.moveTo(9, -15.5); x.bezierCurveTo(16, -17, 22, -16, 25, -12); x.lineTo(25.5, -2); x.lineTo(22, -3); x.lineTo(21, -12); x.bezierCurveTo(17, -14, 13, -14, 9, -13); x.closePath();
  x.fillStyle = metalLG(x, 9, -17, 25, -2, tm); x.fill(); outline(x, INK, 0.8);
  x.strokeStyle = 'rgba(255,255,255,.65)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(-3, -12.5); x.bezierCurveTo(3, -15, 8, -15, 12, -14.5); x.stroke();
}
/** Open palm facing viewer, fingers up, centre (0,0), ~46 tall. */
export function palm(x) {
  x.beginPath();
  x.moveTo(-12, 22); x.bezierCurveTo(-15, 10, -15, 2, -13, -6);
  for (const [fx, fy, ty, fw] of [[-10.5, -6, -22, 5.2], [-4, -8, -30, 5.6], [3, -8, -31, 5.6], [9.5, -6, -25, 5.2]]) {
    x.lineTo(fx - fw / 2, fy); x.lineTo(fx - fw / 2, ty + fw / 2); x.arc(fx, ty + fw / 2, fw / 2, PI, 0); x.lineTo(fx + fw / 2, fy);
  }
  x.lineTo(13, -2); x.bezierCurveTo(16, -4, 22, -12, 25, -9); x.bezierCurveTo(27, -7, 20, 4, 15, 10);
  x.bezierCurveTo(14, 16, 13, 20, 12, 22); x.closePath();
}
/** Armoured leg kicking toward +x: knee at the left, pointed sabaton at the right, ankle at (0,0). */
export function boot(x, o = {}) {
  const m = metal(o.metal || 'steel'), tm = o.trim || 'gold', col = o.col || '#1c1c2a';
  // greave (shin) with a raised ridge
  x.beginPath(); x.moveTo(-34, -10); x.bezierCurveTo(-20, -11, -8, -9, -1, -8); x.lineTo(1, 7); x.bezierCurveTo(-10, 9, -22, 11, -34, 10); x.closePath();
  x.fillStyle = lg(x, 0, -11, 0, 11, [[0, m[1]], [0.2, m[0]], [0.45, m[2]], [0.8, m[3]], [1, m[4]]]); x.fill(); outline(x, INK, 1);
  x.strokeStyle = rgba(m[0], 0.8); x.lineWidth = 0.8; x.beginPath(); x.moveTo(-32, -4); x.bezierCurveTo(-20, -4.5, -10, -3.5, -2, -3); x.stroke();
  if (o.glow) { const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter'; x.strokeStyle = rgba(o.glow, 0.55); x.lineWidth = 2.6; x.beginPath(); x.moveTo(-30, 2); x.lineTo(-4, 1.5); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 0.8; x.stroke(); x.globalCompositeOperation = pc; }
  // knee cop
  x.fillStyle = metalRG(x, -35, -1, 9, 'steel'); circle(x, -35, 0, 7.5); x.fill(); outline(x, INK, 0.9);
  x.fillStyle = metalRG(x, -35.5, -0.5, 3, tm); circle(x, -35, 0, 2.6); x.fill();
  // sabaton: articulated plates to a pointed toe
  x.beginPath(); x.moveTo(-3, -9); x.bezierCurveTo(6, -10, 14, -6, 24, -1); x.lineTo(25, 1); x.bezierCurveTo(16, 3, 6, 8, -1, 9); x.closePath();
  x.fillStyle = lg(x, 0, -10, 6, 9, [[0, m[0]], [0.35, m[1]], [0.75, m[2]], [1, m[4]]]); x.fill(); outline(x, INK, 1);
  x.strokeStyle = rgba(m[4], 0.85); x.lineWidth = 0.8;
  for (const t of [0.25, 0.48, 0.7]) { const px = -2 + t * 26; x.beginPath(); x.moveTo(px, -9 + t * 7); x.quadraticCurveTo(px + 1.8, (t * 7 - 9 + 9 - t * 8) / 2, px - 0.5, 9 - t * 8.5); x.stroke(); }
  // sole
  x.fillStyle = col; poly(x, [[-1, 9], [25, 1], [24, 3.2], [0, 11.5]]); x.fill(); outline(x, INK, 0.6);
  x.strokeStyle = metalLG(x, -2, -10, 2, 10, tm); x.lineWidth = 1.8; x.beginPath(); x.moveTo(-2, -8.5); x.lineTo(0, 8.5); x.stroke();
}
/** Upright armoured boot (side view, toe toward +x), sole centre near (0,0), ~42 tall. */
export function bootUp(x, o = {}) {
  const m = metal(o.metal || 'steel'), col = o.col || '#6a4424', tm = o.trim || 'gold';
  x.beginPath(); x.moveTo(-11, -40); x.lineTo(8, -40); x.lineTo(9, -13); x.bezierCurveTo(15, -11, 25, -9, 28, -3); x.lineTo(28, 1); x.lineTo(-13, 1); x.lineTo(-12, -20); x.closePath();
  x.fillStyle = lg(x, -12, -40, 20, 2, [[0, shade(col, 0.45)], [0.5, col], [1, shade(col, -0.6)]]); x.fill(); outline(x, INK, 1.1);
  x.beginPath(); x.moveTo(-9, -37); x.lineTo(6, -37); x.lineTo(7, -15); x.quadraticCurveTo(-1, -12, -10, -13); x.closePath();
  x.fillStyle = lg(x, -10, 0, 7, 0, [[0, m[3]], [0.25, m[1]], [0.45, m[0]], [0.75, m[2]], [1, m[4]]]); x.fill(); outline(x, INK, 0.9);
  x.beginPath(); x.moveTo(12, -11); x.bezierCurveTo(20, -10, 26, -7, 28, -2); x.lineTo(12, -1); x.closePath();
  x.fillStyle = lg(x, 12, -11, 28, -1, [[0, m[0]], [0.5, m[1]], [1, m[3]]]); x.fill(); outline(x, INK, 0.8);
  x.fillStyle = lg(x, 0, 0, 0, 5, [[0, '#3a2412'], [1, '#0e0804']]); x.beginPath(); x.roundRect(-14, 0, 43, 4.5, 1.5); x.fill(); outline(x, INK, 0.7);
  x.fillStyle = metalLG(x, -12, -42, 9, -38, tm); x.fillRect(-12, -42, 21, 4); x.strokeStyle = INK; x.lineWidth = 0.7; x.strokeRect(-12, -42, 21, 4);
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(-7, -35); x.lineTo(-8, -16); x.stroke();
}
/**
 * Dynamic humanoid silhouette from joints, built from tapered limb capsules (reads as a heroic body, not a stick man).
 * J: { head, neck, hip, sh: [back, front], el: [..], ha: [..], kn: [..], ft: [..] } in icon units.
 * o.col fill, o.rim rim-light colour (offset toward the top-left), o.s thickness scale, o.cape: [cx, cy, ex, ey].
 */
export function figure(x, J, o = {}) {
  const col = o.col || '#0c0a10', rim = o.rim, s = o.s ?? 1;
  const seg = (a, b, wa, wb) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    x.beginPath(); x.moveTo(a[0] + nx * wa, a[1] + ny * wa); x.lineTo(b[0] + nx * wb, b[1] + ny * wb); x.lineTo(b[0] - nx * wb, b[1] - ny * wb); x.lineTo(a[0] - nx * wa, a[1] - ny * wa); x.closePath(); x.fill();
    circle(x, b[0], b[1], wb); x.fill(); circle(x, a[0], a[1], wa); x.fill();
  };
  const pieces = () => {
    const [b, f] = J.sh, h = J.hip, n = J.neck;
    if (o.cape) { x.beginPath(); x.moveTo(b[0], b[1] - 1); x.quadraticCurveTo(o.cape[0], o.cape[1], o.cape[2], o.cape[3]); x.lineTo(h[0] - 2 * s, h[1] - 2 * s); x.closePath(); x.fill(); }
    for (let i = 0; i < 2; i++) { seg(h, J.kn[i], 3.6 * s, 2.7 * s); seg(J.kn[i], J.ft[i], 2.6 * s, 1.7 * s); }
    const mx = (b[0] + f[0]) / 2, my = (b[1] + f[1]) / 2;
    x.beginPath(); x.moveTo(b[0], b[1]); x.quadraticCurveTo(mx, my - 2.5 * s, f[0], f[1]);
    x.quadraticCurveTo(f[0] + (h[0] - f[0]) * 0.3 + 2 * s, f[1] + (h[1] - f[1]) * 0.6, h[0] + 3.4 * s, h[1]);
    x.lineTo(h[0] - 3.4 * s, h[1]); x.quadraticCurveTo(b[0] + (h[0] - b[0]) * 0.4 - 1.5 * s, b[1] + (h[1] - b[1]) * 0.55, b[0], b[1]); x.closePath(); x.fill();
    seg(n, J.head, 2.2 * s, 2.2 * s); circle(x, J.head[0], J.head[1], 4.3 * s); x.fill();
    for (let i = 0; i < 2; i++) { seg(J.sh[i], J.el[i], 2.7 * s, 2.1 * s); seg(J.el[i], J.ha[i], 2.1 * s, 1.7 * s); circle(x, J.ha[i][0], J.ha[i][1], 2.2 * s); x.fill(); }
  };
  if (rim) { x.save(); x.translate(-1, -1); x.fillStyle = rim; pieces(); x.restore(); }
  x.fillStyle = col; pieces();
}

// ------------------------------------------------------------------ chains, wings, creatures
/** Chain of links along f(t). */
export function chain(x, f, n, size = 4, m = 'iron', o = {}) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = f(t), a = f(Math.max(0, t - 0.01)), b = f(Math.min(1, t + 0.01));
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    x.save(); x.translate(p[0], p[1]); x.rotate(ang);
    if (i % 2 === 0) {
      x.lineWidth = size * 0.42; x.strokeStyle = metalLG(x, -size, -size, size, size, m); ellipse(x, 0, 0, size * 1.05, size * 0.62); x.stroke();
      x.lineWidth = 0.5; x.strokeStyle = INK; ellipse(x, 0, 0, size * 1.28, size * 0.86); x.stroke(); ellipse(x, 0, 0, size * 0.82, size * 0.38); x.stroke();
    } else {
      x.beginPath(); x.roundRect(-size * 1.1, -size * 0.22, size * 2.2, size * 0.44, size * 0.2); x.fillStyle = metalLG(x, 0, -size * 0.3, 0, size * 0.3, m); x.fill(); outline(x, INK, 0.5);
    }
    if (o.glow) glow(x, 0, 0, size * 1.6, o.glow, 0.25);
    x.restore();
  }
}
/** Demon bat wing attached at (0,0), spreading toward +x/−y. side = ±1. */
export function batWing(x, side, s, col, o = {}) {
  x.save(); x.scale(side * s, s);
  const tips = [[40, -34], [46, -12], [40, 6], [28, 16]];
  x.beginPath(); x.moveTo(0, 0); x.lineTo(18, -26); x.lineTo(tips[0][0], tips[0][1]);
  for (let i = 1; i < tips.length; i++) { const p = tips[i - 1], q = tips[i]; x.quadraticCurveTo((p[0] + q[0]) / 2 - 8, (p[1] + q[1]) / 2 - 2, q[0], q[1]); }
  x.quadraticCurveTo(14, 14, 0, 8); x.closePath();
  x.fillStyle = rg(x, 14, -14, 2, 50, [[0, shade(col, 0.35)], [0.5, col], [1, shade(col, -0.75)]]); x.fill(); outline(x, INK, 1);
  // bones
  x.strokeStyle = shade(col, -0.6); x.lineWidth = 1.6;
  for (const tp of tips) { x.beginPath(); x.moveTo(18, -26); x.lineTo(tp[0], tp[1]); x.stroke(); }
  x.beginPath(); x.moveTo(0, 0); x.lineTo(18, -26); x.lineWidth = 2.6; x.stroke();
  if (o.fire) { x.globalCompositeOperation = 'lighter'; x.strokeStyle = rgba(o.fire, 0.8); x.lineWidth = 1.2; for (let i = 1; i < tips.length; i++) { const p = tips[i - 1], q = tips[i]; x.beginPath(); x.moveTo(p[0], p[1]); x.quadraticCurveTo((p[0] + q[0]) / 2 - 8, (p[1] + q[1]) / 2 - 2, q[0], q[1]); x.stroke(); } x.globalCompositeOperation = 'source-over'; }
  x.restore();
}
/** Feathered wing from (0,0), side ±1. cols = [light, mid, dark]. */
export function featherWing(x, side, s, cols, n = 8) {
  x.save(); x.scale(side * s, s);
  for (let row = 0; row < 2; row++) {
    for (let i = n - 1; i >= 0; i--) {
      const t = i / (n - 1), a = -1.25 + t * 1.35 + row * 0.08, len = (row ? 20 : 30) + (1 - Math.abs(t - 0.25)) * (row ? 8 : 14);
      x.save(); x.rotate(a);
      x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(len * 0.3, -4.2, len * 0.8, -4, len, 0); x.bezierCurveTo(len * 0.8, 3, len * 0.3, 3.2, 0, 0); x.closePath();
      x.fillStyle = lg(x, 0, -4, 0, 4, [[0, cols[0]], [0.55, cols[1]], [1, cols[2]]]); x.fill(); outline(x, 'rgba(0,0,0,.45)', 0.5);
      x.restore();
    }
  }
  x.restore();
}
/** Crescent moon (disc at cx,cy radius r, bite offset). */
export function moon(x, cx, cy, r, col, o = {}) {
  x.save();
  x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.arc(cx + r * (o.bite ?? 0.45), cy - r * (o.biteY ?? 0.25), r * (o.biteR ?? 0.9), 0, TAU, true);
  glow(x, cx - r * 0.3, cy, r * 1.8, col, 0.4);
  x.fillStyle = rg(x, cx - r * 0.5, cy - r * 0.2, 0, r * 1.2, [[0, '#ffffff'], [0.4, mix(col, '#ffffff', 0.5)], [1, col]]); x.fill('evenodd');
  x.restore();
}
/** Meteor with a fiery tail from (tx,ty) to head (hx,hy). */
export function meteor(x, R, tx, ty, hx, hy, r, o = {}) {
  const col = o.col || '#ff6a1a';
  const f = t => [tx + (hx - tx) * t, ty + (hy - ty) * t];
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  ribbon(x, f, t => r * 2.6 * Math.pow(t, 1.3), 16); x.fillStyle = lg(x, tx, ty, hx, hy, [[0, rgba(col, 0)], [0.7, rgba(col, 0.45)], [1, rgba(col, 0.8)]]); x.fill();
  ribbon(x, f, t => r * 1.3 * Math.pow(t, 1.6), 16); x.fillStyle = lg(x, tx, ty, hx, hy, [[0, rgba('#ffe080', 0)], [0.8, rgba('#fff0b0', 0.8)], [1, '#ffffff']]); x.fill();
  x.globalCompositeOperation = pc;
  glow(x, hx, hy, r * 3.2, col, 0.8);
  // rocky head
  x.fillStyle = rg(x, hx - r * 0.35, hy - r * 0.35, 0, r * 1.1, [[0, '#fff8d0'], [0.35, '#ffb040'], [0.7, o.crust || '#8a2a08'], [1, '#2a0802']]);
  x.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, rr = r * (0.85 + R() * 0.25); i ? x.lineTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr) : x.moveTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr); } x.closePath(); x.fill();
  outline(x, 'rgba(40,6,0,.7)', 0.6);
}
/** Serpentine dragon body following f(t) (head at t=1), width w. cols = [light, mid, dark]. */
export function dragon(x, R, f, w, cols, o = {}) {
  const wf = t => w * (0.18 + 0.82 * Math.pow(Math.sin(Math.min(1, t * 1.05) * PI * 0.5), 0.8));
  if (o.glow) { ribbon(x, f, t => wf(t) * 2.2, 48); x.save(); blur(x, 8, o.glow); x.fillStyle = rgba(o.glow, 0.3); x.fill(); x.restore(); noBlur(x); }
  ribbon(x, f, wf, 48); x.fillStyle = lg(x, 20, 10, 80, 90, [[0, cols[0]], [0.45, cols[1]], [1, cols[2]]]); x.fill(); outline(x, INK, 1);
  // dorsal spikes + scale rows
  for (let i = 1; i < 22; i++) {
    const t = i / 23, p = f(t), q = f(t + 0.01), a = Math.atan2(q[1] - p[1], q[0] - p[0]), ww = wf(t);
    x.save(); x.translate(p[0], p[1]); x.rotate(a);
    poly(x, [[-1.6, -ww / 2 + 0.3], [1.2, -ww / 2 - ww * 0.32], [1.8, -ww / 2 + 0.3]]); x.fillStyle = cols[0]; x.fill(); outline(x, rgba(cols[2], 0.8), 0.4);
    x.strokeStyle = rgba(cols[2], 0.7); x.lineWidth = 0.6; x.beginPath(); x.moveTo(-0.5, ww * 0.12); x.quadraticCurveTo(1.2, ww * 0.3, -0.5, ww * 0.48); x.stroke();
    x.strokeStyle = rgba('#ffffff', 0.35); x.beginPath(); x.arc(0, -ww * 0.1, ww * 0.22, PI * 1.1, PI * 1.9); x.stroke();
    x.restore();
  }
  // head (profile facing +x): domed skull, long snout, open jaw, antler horns, mane, barbels
  const hp = f(1), hq = f(0.97), ha = Math.atan2(hp[1] - hq[1], hp[0] - hq[0]);
  x.save(); x.translate(hp[0], hp[1]); x.rotate(ha); const hs = (o.head ?? 1) * w / 11; x.scale(hs, hs);
  for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(-6, -6 + i * 3); x.quadraticCurveTo(-15, -11 + i * 5, -21, -7 + i * 6.5); x.quadraticCurveTo(-12, -3 + i * 3.4, -6, -3 + i * 3); x.closePath(); x.fillStyle = rgba(i % 2 ? cols[0] : cols[1], 0.95); x.fill(); outline(x, rgba(cols[2], 0.6), 0.4); }
  for (const [hx, hy, cx2, cy2, ex, ey] of [[-3, -9, -10, -19, -22, -21], [2, -9.5, -4, -21, -14, -26]]) {
    ribbon(x, qbez([hx, hy], [cx2, cy2], [ex, ey]), t => 2.8 * (1 - t) + 0.3, 12);
    x.fillStyle = lg(x, hx, hy, ex, ey, [[0, cols[1]], [0.6, cols[0]], [1, '#ffffff']]); x.fill(); outline(x, INK, 0.5);
  }
  x.beginPath(); x.moveTo(-6, 3); x.bezierCurveTo(2, 4.5, 10, 6.5, 17, 10.5); x.quadraticCurveTo(17.5, 12.5, 14, 12.5); x.bezierCurveTo(6, 11, -2, 9.5, -7, 7.5); x.closePath();
  x.fillStyle = lg(x, 0, 3, 0, 12, [[0, cols[1]], [1, cols[2]]]); x.fill(); outline(x, INK, 0.7);
  x.beginPath(); x.moveTo(1, 1.5); x.bezierCurveTo(10, 0.5, 17, -0.5, 23, -0.5); x.bezierCurveTo(19, 5, 12, 7, 2, 4.5); x.closePath(); x.fillStyle = '#2a0610'; x.fill();
  x.fillStyle = '#ffffff'; for (const tx of [8, 12, 16, 20]) { poly(x, [[tx, 0], [tx + 1.4, -0.1], [tx + 0.6, 2.4]]); x.fill(); }
  x.beginPath(); x.moveTo(-8, -6); x.bezierCurveTo(-4, -11.5, 4, -11.5, 8, -7.5); x.bezierCurveTo(12, -6.5, 18, -5.5, 22, -4.5); x.quadraticCurveTo(25.5, -4, 24, -0.8); x.bezierCurveTo(18, 0.2, 10, 1, 2, 1.8); x.lineTo(-8, 4); x.closePath();
  x.fillStyle = lg(x, -6, -11, 10, 2, [[0, cols[0]], [0.55, cols[1]], [1, cols[2]]]); x.fill(); outline(x, INK, 0.8);
  x.fillStyle = rgba(cols[2], 0.9); x.beginPath(); x.moveTo(1, -8); x.quadraticCurveTo(7, -10, 11, -6.5); x.lineTo(9, -5.2); x.quadraticCurveTo(6, -7, 2, -6.2); x.closePath(); x.fill();
  glow(x, 6, -4.8, 5, o.eye || '#ffffff', 1); x.fillStyle = '#ffffff'; ellipse(x, 6, -4.8, 1.8, 0.8, -0.15); x.fill();
  x.fillStyle = '#0a0a14'; circle(x, 21.5, -3, 0.6); x.fill();
  x.strokeStyle = rgba(cols[0], 0.95); x.lineWidth = 0.8; x.beginPath(); x.moveTo(21, -1); x.bezierCurveTo(26, 4, 18, 10, 26, 16); x.stroke(); x.beginPath(); x.moveTo(18, -4.5); x.bezierCurveTo(22, -10, 16, -14, 24, -18); x.stroke();
  x.restore();
}
/** Fierce tiger head (front, roaring), centre (0,0), ~56 wide. */
export function tigerHead(x, o = {}) {
  const fur = o.fur || '#ffae2e', dark = o.stripe || '#1a0e04', eye = o.eye || '#aef0ff', pale = o.pale || '#fff4e4';
  // ears pinned back
  for (const s of [-1, 1]) {
    x.beginPath(); x.moveTo(s * 10, -16); x.quadraticCurveTo(s * 22, -28, s * 27, -18); x.quadraticCurveTo(s * 24, -12, s * 17, -9); x.closePath();
    x.fillStyle = lg(x, 0, -28, 0, -8, [[0, shade(fur, 0.2)], [1, shade(fur, -0.5)]]); x.fill(); outline(x, INK, 0.9);
    x.beginPath(); x.moveTo(s * 13, -15); x.quadraticCurveTo(s * 21, -22, s * 23, -17); x.quadraticCurveTo(s * 20, -13, s * 16, -11); x.closePath(); x.fillStyle = shade(pale, -0.1); x.fill();
  }
  // head with jagged cheek ruff
  x.beginPath(); x.moveTo(0, -21);
  x.bezierCurveTo(14, -22, 23, -14, 25, -4); x.lineTo(30, 0); x.lineTo(25, 4); x.lineTo(29, 9); x.lineTo(22, 11); x.lineTo(24, 17); x.lineTo(15, 17);
  x.quadraticCurveTo(8, 28, 0, 28); x.quadraticCurveTo(-8, 28, -15, 17); x.lineTo(-24, 17); x.lineTo(-22, 11); x.lineTo(-29, 9); x.lineTo(-25, 4); x.lineTo(-30, 0); x.lineTo(-25, -4);
  x.bezierCurveTo(-23, -14, -14, -22, 0, -21); x.closePath();
  x.fillStyle = rg(x, -7, -10, 2, 34, [[0, shade(fur, 0.4)], [0.5, fur], [1, shade(fur, -0.6)]]); x.fill(); outline(x, INK, 1.1);
  // pale cheeks + muzzle
  for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 5, 2); x.quadraticCurveTo(s * 20, 2, s * 24, 12); x.quadraticCurveTo(s * 14, 18, s * 5, 12); x.closePath(); x.fillStyle = rgba(pale, 0.95); x.fill(); }
  // stripes
  x.fillStyle = dark;
  for (const s of [-1, 1]) {
    for (const [ax, ay, bx, by, cx2, cy2] of [[9, -19, 4, -12, 6, -20], [17, -15, 10, -10, 18, -11], [23, -6, 14, -3, 23, -2], [25, 6, 17, 7, 24, 10]]) { poly(x, [[s * ax, ay], [s * bx, by], [s * cx2, cy2]]); x.fill(); }
  }
  poly(x, [[-2.5, -21], [0, -13], [2.5, -21]]); x.fill();
  // angry brows + eyes
  for (const s of [-1, 1]) {
    x.beginPath(); x.moveTo(s * 4, -6); x.lineTo(s * 15, -9.5); x.quadraticCurveTo(s * 12, -4, s * 5, -3.5); x.closePath();
    glow(x, s * 10, -6, 9, eye, 0.9); x.fillStyle = eye; x.fill(); outline(x, INK, 0.9);
    x.fillStyle = '#081018'; ellipse(x, s * 10, -6.2, 0.8, 1.8); x.fill();
    x.fillStyle = dark; poly(x, [[s * 3, -8], [s * 16, -12], [s * 15, -10], [s * 4, -6]]); x.fill();
  }
  // nose bridge + nose
  x.fillStyle = shade(fur, 0.25); poly(x, [[-3, -6], [3, -6], [4, 3], [-4, 3]]); x.fill();
  x.beginPath(); x.moveTo(-5, 2); x.lineTo(5, 2); x.lineTo(0, 6.5); x.closePath(); x.fillStyle = '#2a1410'; x.fill();
  // roaring maw with fangs
  x.beginPath(); x.moveTo(-10, 9); x.quadraticCurveTo(0, 6.5, 10, 9); x.quadraticCurveTo(9, 23, 0, 25); x.quadraticCurveTo(-9, 23, -10, 9); x.closePath();
  x.fillStyle = rg(x, 0, 16, 1, 12, [[0, '#8a1a1a'], [1, '#2a0404']]); x.fill(); outline(x, INK, 0.9);
  x.fillStyle = '#ffffff';
  for (const s of [-1, 1]) { poly(x, [[s * 8.5, 9], [s * 6, 16], [s * 5, 9.2]]); x.fill(); poly(x, [[s * 7, 23], [s * 5.5, 17.5], [s * 4, 23.6]]); x.fill(); }
  x.fillStyle = '#d0506a'; ellipse(x, 0, 21, 4, 2); x.fill();
}
/** Horned demon face (front), centre (0,0), ~56 wide. */
export function demonHead(x, o = {}) {
  const skin = o.skin || '#3a1e3e', horn = o.horn || '#d8c8b0', eye = o.eye || '#ff3a2a';
  for (const s of [-1, 1]) {
    ribbon(x, bez([s * 12, -14], [s * 26, -20], [s * 32, -34], [s * 22, -48]), t => 9 * (1 - t) + 0.6, 22);
    x.fillStyle = lg(x, s * 12, -14, s * 22, -48, [[0, shade(horn, -0.6)], [0.5, horn], [1, '#ffffff']]); x.fill(); outline(x, INK, 0.9);
  }
  x.beginPath(); x.moveTo(0, -22); x.bezierCurveTo(16, -22, 22, -10, 20, 2); x.bezierCurveTo(18, 14, 10, 24, 0, 28); x.bezierCurveTo(-10, 24, -18, 14, -20, 2); x.bezierCurveTo(-22, -10, -16, -22, 0, -22); x.closePath();
  x.fillStyle = rg(x, -5, -8, 2, 32, [[0, shade(skin, 0.5)], [0.5, skin], [1, shade(skin, -0.7)]]); x.fill(); outline(x, INK, 1.1);
  // brow ridge
  x.fillStyle = rgba(shade(skin, -0.7), 0.85); x.beginPath(); x.moveTo(-17, -6); x.quadraticCurveTo(0, 2, 17, -6); x.lineTo(15, -2); x.quadraticCurveTo(0, 5, -15, -2); x.closePath(); x.fill();
  for (const s of [-1, 1]) {
    x.beginPath(); x.moveTo(s * 4, -1); x.lineTo(s * 14, -5); x.lineTo(s * 12, 1); x.closePath();
    glow(x, s * 9, -1.5, 10, eye, 1); x.fillStyle = mix(eye, '#ffffff', 0.4); x.fill();
  }
  // snarl
  x.beginPath(); x.moveTo(-9, 12); x.quadraticCurveTo(0, 22, 9, 12); x.quadraticCurveTo(0, 16, -9, 12); x.closePath(); x.fillStyle = '#12040a'; x.fill();
  x.fillStyle = '#fff4e8'; for (const s of [-1, 1]) { poly(x, [[s * 7, 12.5], [s * 5.6, 18.5], [s * 4.6, 13.6]]); x.fill(); }
  glow(x, 0, 16, 7, eye, 0.5);
}
/** Stylised eye (almond) centre (0,0), width w. */
export function eye(x, w, iris, o = {}) {
  const h = w * (o.open ?? 0.42);
  x.beginPath(); x.moveTo(-w / 2, 0); x.quadraticCurveTo(0, -h * 1.2, w / 2, 0); x.quadraticCurveTo(0, h * 1.2, -w / 2, 0); x.closePath();
  x.fillStyle = o.white || '#f0e8e0'; x.fill();
  x.save(); x.clip();
  glow(x, 0, 0, w * 0.5, iris, 0.8);
  x.fillStyle = rg(x, -w * 0.05, -w * 0.06, 0, w * 0.24, [[0, mix(iris, '#ffffff', 0.6)], [0.5, iris], [1, shade(iris, -0.6)]]); circle(x, 0, 0, w * 0.22); x.fill();
  x.fillStyle = '#050305'; if (o.slit) ellipse(x, 0, 0, w * 0.035, w * 0.18); else circle(x, 0, 0, w * 0.09); x.fill();
  x.fillStyle = 'rgba(255,255,255,.9)'; circle(x, -w * 0.07, -w * 0.08, w * 0.04); x.fill();
  x.restore();
  x.beginPath(); x.moveTo(-w / 2, 0); x.quadraticCurveTo(0, -h * 1.2, w / 2, 0); x.quadraticCurveTo(0, h * 1.2, -w / 2, 0); x.closePath(); outline(x, INK, o.lw ?? 1.2);
}
/** Skull (front) centre (0,0) scale s. */
export function skull(x, s, o = {}) {
  x.save(); x.scale(s, s);
  const bone = o.bone || ['#fff8e6', '#d8c9a4', '#8a7650', '#3a2e1c'];
  x.beginPath();
  x.moveTo(-20, -2); x.bezierCurveTo(-22, -26, 22, -26, 20, -2);
  x.bezierCurveTo(20, 6, 16, 9, 14, 12); x.lineTo(12, 22); x.bezierCurveTo(4, 26, -4, 26, -12, 22); x.lineTo(-14, 12);
  x.bezierCurveTo(-16, 9, -20, 6, -20, -2); x.closePath();
  x.fillStyle = rg(x, -6, -10, 2, 32, [[0, bone[0]], [0.4, bone[1]], [0.8, bone[2]], [1, bone[3]]]); x.fill(); outline(x, INK, 1.2);
  for (const ex of [-8.5, 8.5]) {
    x.beginPath(); x.moveTo(ex - 7, 0); x.bezierCurveTo(ex - 7, -8, ex + 7, -8, ex + 7, 0); x.bezierCurveTo(ex + 6, 5, ex - 6, 5, ex - 7, 0); x.closePath();
    x.fillStyle = '#120806'; x.fill();
    if (o.eyes) { glow(x, ex, -1, 9, o.eyes, 0.9); x.fillStyle = '#ffffff'; circle(x, ex, -1, 1.2); x.fill(); }
  }
  x.fillStyle = '#1a0c06'; poly(x, [[0, 5], [-3.4, 11], [3.4, 11]]); x.fill();
  x.strokeStyle = 'rgba(30,18,6,.9)'; x.lineWidth = 1; for (let i = -8; i <= 8; i += 4) { x.beginPath(); x.moveTo(i, 15); x.lineTo(i, 22); x.stroke(); }
  x.beginPath(); x.moveTo(-11, 17); x.lineTo(11, 17); x.stroke();
  x.restore();
}
/** Three curved claw-rake marks. */
export function clawMarks(x, cx, cy, s, col, rot = 0, n = 3) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 11;
    const f = qbez([off - 10, -30], [off + 6, 0], [off - 4, 30]);
    ribbon(x, f, t => 7.5 * Math.sin(PI * t) + 0.3, 20); x.fillStyle = rgba(col, 0.35); x.fill();
    ribbon(x, f, t => 4.2 * Math.sin(PI * t) + 0.2, 20); x.fillStyle = rgba(col, 0.9); x.fill();
    ribbon(x, f, t => 1.5 * Math.sin(PI * t), 20); x.fillStyle = '#ffffff'; x.fill();
  }
  x.globalCompositeOperation = pc; x.restore();
}
/** Arrow (for buff/debuff markers) pointing up at (cx,cy). */
export function arrowUp(x, cx, cy, s, col, o = {}) {
  x.save(); x.translate(cx, cy); x.scale(s, o.down ? -s : s);
  poly(x, [[0, -10], [9, 0], [3.6, 0], [3.6, 10], [-3.6, 10], [-3.6, 0], [-9, 0]]);
  x.fillStyle = lg(x, 0, -10, 0, 10, [[0, mix(col, '#ffffff', 0.55)], [0.5, col], [1, shade(col, -0.45)]]); x.fill();
  outline(x, 'rgba(0,0,0,.85)', 1.4 / s);
  x.restore();
}
export { star, strokeCurve, sparkle };
