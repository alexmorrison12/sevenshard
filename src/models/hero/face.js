// Painted face layer (the eyes themselves are geometry, see eyes.js). One RGBA DataTexture per head variant
// (sex + face preset), 2x2 tiles of T px: (0,0) normal · (1,0) eyes closed (same paint; the lids blink) ·
// (0,1) mouth open · (1,1) laugh.
// Channels: R = ink (lash lines, creases, nostrils, lip parting, shading) · G = lip colour · B = highlight (teeth, lip
// gloss) · A = brow / stubble hair (coloured by the hair colour). A second texture holds war paint / tattoo marks.
// Canvas y grows with face v (upward), matching DataTexture row order.
import * as THREE from 'three';
import { RNG } from '../../core/noise.js';

const T = 256, S = T * 2, K = T / 128;
const CACHE = new Map();

const STYLE = {
  m: { lash: 1.0, liner: 0.9, shadow: 0.06, brow: 'strong', browW: 1.0, lips: 0.22, lipGloss: 0.0, jawShade: 0.12 },
  f: { lash: 1.5, liner: 1.25, wing: 1, shadow: 0.2, brow: 'arch', browW: 0.62, lips: 0.62, lipGloss: 0.12, blush: 1 },
};
// per preset painting (look.face 0..5), matching the sculpted presets in head.js
const VARIANTS = {
  m: [
    { brow: 1, extra: null },
    { brow: 1.35, extra: 'stubble', browShape: 'heavy' },
    { brow: 0.85, extra: null, jaw: 0.3 },
    { brow: 0.95, extra: null, browShape: 'swept' },
    { brow: 1.3, extra: 'scar', browShape: 'heavy', jaw: 1.4, lines: 1 },
    { brow: 1.2, extra: 'stubble', browShape: 'angry' },
  ],
  f: [
    { brow: 1, extra: null },
    { brow: 0.9, extra: 'blush' },
    { brow: 1.0, extra: null, browShape: 'swept', wing: 1.5 },
    { brow: 1.12, extra: 'mole', browShape: 'straight' },
    { brow: 1.2, extra: 'scar', browShape: 'straight', wing: 0.6 },
    { brow: 0.85, extra: 'freckles', wing: 0.8 },
  ],
};
export const FACE_COUNT = 6;

function mkCanvas(w = S, h = S) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
const W = a => `rgba(255,255,255,${a})`;

/** head: getHead() result ({ key, faceMap }) */
export function faceTexture(head, sex = 'm', faceIdx = 0) {
  const key = head.key + '|v2';
  if (CACHE.has(key)) return CACHE.get(key);
  const f = sex === 'f' ? 'f' : 'm';
  const va = VARIANTS[f][((faceIdx | 0) % 6 + 6) % 6];
  const st = { ...STYLE[f], ...(va.wing != null ? { wing: va.wing } : {}) };
  const lm = head.faceMap.lm;
  const ch = [0, 1, 2, 3].map(() => { const c = mkCanvas(); const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, S, S); return x; });
  const [R, G, Bc, A] = ch;
  for (let tile = 0; tile < 4; tile++) {
    const ox = (tile & 1) * T, oy = (tile >> 1) * T;
    const open = tile >= 2;
    const X = u => ox + u * T, Y = v => oy + v * T;
    for (const c of ch) { c.save(); c.beginPath(); c.rect(ox + 1, oy + 1, T - 2, T - 2); c.clip(); }
    paintFace({ R, G, B: Bc, A, X, Y, st, va, lm, open, laugh: tile === 3, rng: new RNG(faceIdx * 7 + 3), sex: f });
    for (const c of ch) c.restore();
  }
  const imgs = ch.map(c => c.getImageData(0, 0, S, S).data);
  const data = new Uint8Array(S * S * 4);
  for (let i = 0, n = S * S; i < n; i++) { data[i * 4] = imgs[0][i * 4]; data[i * 4 + 1] = imgs[1][i * 4]; data[i * 4 + 2] = imgs[2][i * 4]; data[i * 4 + 3] = imgs[3][i * 4]; }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  CACHE.set(key, tex);
  return tex;
}

function softEllipse(ctx, x, y, rx, ry, a, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(Math.max(0.5, rx), Math.max(0.5, ry));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, W(a)); g.addColorStop(1, W(0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function paintFace(o) {
  const { R, G, B, A, X, Y, st, va, lm, open, laugh, sex } = o;
  // ---- eyes: lash lines hugging the sculpted opening (ellipse ew × eh around the eye centre, tilted)
  for (const side of [-1, 1]) {
    const c = side < 0 ? lm.eyeL : lm.eyeR;
    const ew = lm.eyeW * 1.02, eh = lm.eyeH * 0.95, tilt = (lm.tilt || 0) * side;
    const pt = (t, k = 1) => { // t: -1 inner … +1 outer along the upper (k>0) / lower (k<0) arc
      const a = (1 - (t * 0.5 + 0.5)) * Math.PI; // π (inner) … 0 (outer)
      const x = Math.cos(a) * ew * side * -1, y = Math.sin(a) * eh * k;
      return [c[0] + x * Math.cos(tilt) - y * Math.sin(tilt) * side, c[1] + y * Math.cos(tilt) + x * Math.sin(tilt) * side * 0.5];
    };
    // upper liner: thick, heavier toward the outer corner; winged for heroines
    R.lineCap = 'round'; R.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      R.strokeStyle = W([0.95, 0.7, 0.35][pass]); R.lineWidth = (1.5 + pass * 1.4) * K * st.liner;
      R.beginPath();
      for (let i = 0; i <= 16; i++) { const t = -1 + 2 * i / 16; const p = pt(t, 1.02 + pass * 0.08); if (i === 0) R.moveTo(X(p[0]), Y(p[1])); else R.lineTo(X(p[0]), Y(p[1])); }
      R.stroke();
    }
    if (st.wing) { const p = pt(1, 1), q = [p[0] + side * ew * 0.35 * st.wing, p[1] + eh * 0.5 * st.wing]; R.lineWidth = 2.2 * K; R.strokeStyle = W(0.9); R.beginPath(); R.moveTo(X(pt(0.7, 1.05)[0]), Y(pt(0.7, 1.05)[1])); R.quadraticCurveTo(X(p[0]), Y(p[1]), X(q[0]), Y(q[1])); R.stroke(); }
    // lower lash line (lighter), shadow at the outer half
    R.strokeStyle = W(0.42); R.lineWidth = 1.2 * K;
    R.beginPath(); for (let i = 0; i <= 14; i++) { const t = -0.8 + 1.8 * i / 14; const p = pt(t, -1.02); if (i === 0) R.moveTo(X(p[0]), Y(p[1])); else R.lineTo(X(p[0]), Y(p[1])); } R.stroke();
    // lid crease + eyeshadow above the lid, soft socket shading, under-eye
    R.strokeStyle = W(0.22); R.lineWidth = 1.3 * K;
    R.beginPath(); for (let i = 0; i <= 12; i++) { const t = -0.7 + 1.6 * i / 12; const p = pt(t, 1.75); if (i === 0) R.moveTo(X(p[0]), Y(p[1])); else R.lineTo(X(p[0]), Y(p[1])); } R.stroke();
    softEllipse(R, X(c[0] + side * ew * 0.25), Y(c[1] + eh * 1.55), ew * T * 1.1, eh * T * 0.9, st.shadow + 0.06);
    softEllipse(R, X(c[0] - side * ew * 0.95), Y(c[1] + eh * 0.2), 4 * K, 6 * K, 0.18); // inner corner
    softEllipse(R, X(c[0]), Y(c[1] - eh * 2.1), ew * T * 0.9, eh * T * 0.8, 0.09);
    // brow
    paintBrow(o, c, ew, side);
  }
  // ---- nose: bridge sides, nostrils, soft shadow under the tip
  const nx = 0.5, ny = lm.nose[1];
  for (const s of [-1, 1]) {
    softEllipse(R, X(nx + s * 0.045), Y(ny + 0.1), 3.5 * K, 16 * K, 0.1);
    R.fillStyle = W(0.7); R.beginPath(); R.ellipse(X(nx + s * 0.034), Y(ny - 0.036), 2.6 * K, 1.5 * K, s * 0.5, 0, Math.PI * 2); R.fill();
    softEllipse(R, X(nx + s * 0.07), Y(ny - 0.008), 3.5 * K, 6 * K, 0.14);
  }
  softEllipse(R, X(nx), Y(ny - 0.058), 8 * K, 3 * K, 0.2);
  softEllipse(B, X(nx), Y(ny + 0.02), 2.5 * K, 4 * K, 0.06); // tip highlight
  // ---- mouth
  paintMouth(o, open, laugh);
  // ---- cheeks & jaw planes
  for (const s of [-1, 1]) {
    softEllipse(R, X(0.5 + s * 0.25), Y(ny - 0.07), 10 * K, 16 * K, sex === 'm' ? 0.12 : 0.07); // under the cheekbone
    softEllipse(R, X(0.5 + s * 0.38), Y(lm.brow + 0.02), 7 * K, 14 * K, 0.08);                   // temple
  }
  paintExtras(o);
}

function paintBrow(o, c, ew, side) {
  const { A, R, X, Y, st, va } = o;
  const by = o.lm.browLine ?? (o.lm.brow + 0.012);
  const th = st.browW * va.brow;
  const shape = va.browShape || st.brow;
  const x0 = c[0] - side * ew * 1.15, x1 = c[0] + side * ew * 1.4;
  let y0 = by - 0.012, ym = by + 0.02, y1 = by - 0.004;
  if (shape === 'arch') { y0 = by - 0.008; ym = by + 0.03; y1 = by - 0.012; }
  if (shape === 'angry') { y0 = by - 0.03; ym = by + 0.004; y1 = by + 0.022; }
  if (shape === 'swept') { y0 = by - 0.018; ym = by + 0.014; y1 = by + 0.04; }
  if (shape === 'heavy') { y0 = by - 0.016; ym = by + 0.012; y1 = by - 0.01; }
  if (shape === 'straight') { y0 = by - 0.01; ym = by + 0.012; y1 = by - 0.006; }
  const n = 20, top = [], bot = [];
  const Q = (t) => [x0 + (x1 - x0) * t, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ym + t * t * y1];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = Q(t);
    const w = Math.max(0.004, th * (0.95 + Math.sin(t * Math.PI) * 0.3 - t * 0.55) * 0.021);
    top.push([X(x), Y(y + w * 0.9)]); bot.push([X(x), Y(y - w)]);
  }
  A.fillStyle = W(0.8); A.beginPath(); A.moveTo(...top[0]);
  for (const p of top) A.lineTo(...p);
  for (let i = bot.length - 1; i >= 0; i--) A.lineTo(...bot[i]);
  A.closePath(); A.fill();
  // hair strokes, angled outward/up at the inner head, flattening toward the tail
  A.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const t = (i + 0.5) / 46, [x, y] = Q(t);
    const w = th * (0.95 + Math.sin(t * Math.PI) * 0.3 - t * 0.55) * 0.021;
    const ang = (1 - t) * 1.1 + 0.15;
    const yy = y + (o.rng.next() - 0.5) * w * 1.4;
    A.strokeStyle = W(0.55 + o.rng.next() * 0.45); A.lineWidth = (0.9 + o.rng.next() * 0.5) * K;
    A.beginPath(); A.moveTo(X(x), Y(yy - w * 0.5)); A.lineTo(X(x + side * Math.cos(ang) * 0.016), Y(yy - w * 0.5 + Math.sin(ang) * 0.016)); A.stroke();
  }
  // brow-bone shadow on the lid
  softEllipse(R, X(c[0] + side * 0.01), Y(by - 0.035), ew * o.X(1) * 0 + 16 * K, 4 * K, 0.1);
}

function paintMouth(o, open, laugh) {
  const { R, G, B, X, Y, st, lm } = o;
  const my = lm.lipMid ?? lm.mouth[1], mw = lm.mouthW, top = lm.lipTop ?? my + 0.05, bot = lm.lipBot ?? my - 0.05;
  const x0 = 0.5 - mw, x1 = 0.5 + mw;
  const curve = laugh ? 0.012 : 0;
  if (!open) {
    // lip colour: upper lip with a cupid's bow, fuller lower lip
    G.fillStyle = W(st.lips);
    G.beginPath();
    G.moveTo(X(x0 - 0.006), Y(my + 0.002));
    G.bezierCurveTo(X(0.5 - mw * 0.7), Y(my + (top - my) * 0.7), X(0.5 - mw * 0.3), Y(top + 0.004), X(0.5 - mw * 0.12), Y(top));
    G.quadraticCurveTo(X(0.5), Y(top - (top - my) * 0.18), X(0.5 + mw * 0.12), Y(top));
    G.bezierCurveTo(X(0.5 + mw * 0.3), Y(top + 0.004), X(0.5 + mw * 0.7), Y(my + (top - my) * 0.7), X(x1 + 0.006), Y(my + 0.002));
    G.bezierCurveTo(X(0.5 + mw * 0.75), Y(bot + 0.004), X(0.5 - mw * 0.75), Y(bot + 0.004), X(x0 - 0.006), Y(my + 0.002));
    G.fill();
    // lip outline shading (upper lip darker), parting line, corners
    softEllipse(R, X(0.5), Y((top + my) * 0.5), mw * T * 0.75, (top - my) * T * 0.45, 0.12 + st.lips * 0.1);
    R.strokeStyle = W(0.8); R.lineWidth = 1.4 * K; R.lineCap = 'round';
    R.beginPath(); R.moveTo(X(x0), Y(my + 0.003 + curve)); R.bezierCurveTo(X(0.5 - mw * 0.4), Y(my - 0.004), X(0.5 + mw * 0.4), Y(my - 0.004), X(x1), Y(my + 0.003 + curve)); R.stroke();
    for (const x of [x0, x1]) softEllipse(R, X(x), Y(my + 0.003), 2.4 * K, 1.8 * K, 0.45);
    softEllipse(R, X(0.5), Y(bot - 0.012), mw * T * 0.5, 2.6 * K, 0.16);                     // under the lower lip
    softEllipse(B, X(0.5 + mw * 0.12), Y((my + bot) * 0.5 - 0.004), mw * T * 0.32, 1.6 * K, st.lipGloss); // lower-lip gloss
    softEllipse(B, X(0.5), Y(top + 0.012), 3 * K, 1.4 * K, st.lipGloss * 0.6);                  // cupid's bow highlight
  } else {
    R.fillStyle = W(1); R.beginPath(); R.ellipse(X(0.5), Y(my - 0.012), mw * T * 0.95, (laugh ? 0.036 : 0.044) * T, 0, 0, Math.PI * 2); R.fill();
    B.save(); B.beginPath(); B.ellipse(X(0.5), Y(my - 0.012), mw * T * 0.95, 0.044 * T, 0, 0, Math.PI * 2); B.clip();
    B.fillStyle = W(0.85); B.fillRect(X(0.5 - mw), Y(my + 0.008), mw * 2 * T, 0.012 * T); B.restore();
    G.strokeStyle = W(st.lips * 0.9); G.lineWidth = 3 * K; G.beginPath(); G.ellipse(X(0.5), Y(my - 0.012), mw * T * 1.02, 0.05 * T, 0, 0, Math.PI * 2); G.stroke();
  }
  softEllipse(R, X(0.5), Y(lm.chin[1] + 0.03), mw * T * 0.6, 3 * K, 0.1);
  if (st.jawShade) {
    const A = o.A, jaw = st.jawShade * (o.va.jaw ?? 1);
    for (let i = 0; i < 1300; i++) {
      const a = o.rng.next() * Math.PI, rr = 0.18 + o.rng.next() * 0.22;
      const x = 0.5 + Math.cos(a) * rr * 0.95, y = my + 0.02 - Math.sin(a) * rr * 0.8;
      if (y > my + 0.045 && Math.abs(x - 0.5) < 0.22) continue;
      A.fillStyle = W(jaw * (0.4 + o.rng.next() * 0.6)); A.fillRect(X(x), Y(y), K, K);
    }
  }
}

function paintExtras(o) {
  const { R, A, B, G, X, Y, va, lm, rng } = o;
  if (va.extra === 'scar') {
    const e = lm.eyeR;
    R.strokeStyle = W(0.45); R.lineWidth = 1.6 * K; R.beginPath(); R.moveTo(X(e[0] + 0.03), Y(lm.brow + 0.07)); R.lineTo(X(e[0] - 0.045), Y(e[1] - 0.15)); R.stroke();
    B.strokeStyle = W(0.25); B.lineWidth = 0.9 * K; B.beginPath(); B.moveTo(X(e[0] + 0.033), Y(lm.brow + 0.07)); B.lineTo(X(e[0] - 0.042), Y(e[1] - 0.15)); B.stroke();
    A.globalCompositeOperation = 'destination-out'; A.lineWidth = 2.5 * K; A.beginPath(); A.moveTo(X(e[0] + 0.03), Y(lm.brow + 0.07)); A.lineTo(X(e[0] + 0.01), Y(lm.brow - 0.0)); A.stroke(); A.globalCompositeOperation = 'source-over';
  } else if (va.extra === 'freckles') {
    for (let i = 0; i < 70; i++) {
      const s = rng.next() < 0.5 ? -1 : 1;
      const x = 0.5 + s * (0.04 + rng.next() * 0.17), y = lm.nose[1] + (rng.next() - 0.25) * 0.11;
      R.fillStyle = W(0.12 + rng.next() * 0.14); R.beginPath(); R.arc(X(x), Y(y), (0.6 + rng.next() * 0.6) * K, 0, Math.PI * 2); R.fill();
    }
  } else if (va.extra === 'mole') {
    R.fillStyle = W(0.65); R.beginPath(); R.arc(X(lm.eyeL[0] + 0.03), Y(lm.mouth[1] + 0.04), 1.2 * K, 0, Math.PI * 2); R.fill();
  } else if (va.extra === 'stubble') {
    for (let i = 0; i < 2200; i++) {
      const a = rng.next() * Math.PI, rr = 0.16 + rng.next() * 0.25;
      const x = 0.5 + Math.cos(a) * rr * 0.95, y = lm.mouth[1] + 0.035 - Math.sin(a) * rr * 0.8;
      if (y > lm.mouth[1] + 0.07 && Math.abs(x - 0.5) < 0.22) continue;
      A.fillStyle = W(0.3 * (0.5 + rng.next() * 0.5)); A.fillRect(X(x), Y(y), K, K);
    }
  } else if (va.extra === 'blush') {
    for (const s of [-1, 1]) softEllipse(G, X(0.5 + s * 0.2), Y(lm.nose[1] + 0.005), 12 * K, 7 * K, 0.18);
  }
  if (va.lines) { // age lines on the forehead and beside the mouth
    R.strokeStyle = W(0.14); R.lineWidth = 1 * K;
    for (let i = 0; i < 3; i++) { R.beginPath(); R.moveTo(X(0.33), Y(lm.brow + 0.07 + i * 0.022)); R.quadraticCurveTo(X(0.5), Y(lm.brow + 0.085 + i * 0.022), X(0.67), Y(lm.brow + 0.07 + i * 0.022)); R.stroke(); }
  }
}

// ---- war paint / tattoo marks (look.marks 1..3), single tile in face uv space -------------------------------------
const MARK_CACHE = new Map();
const MS = 256;
export function marksTexture(head, marks = 0) {
  if (!marks) return null;
  const key = head.key + '|marks' + marks;
  if (MARK_CACHE.has(key)) return MARK_CACHE.get(key);
  const c = mkCanvas(MS, MS);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.fillRect(0, 0, MS, MS);
  const lm = head.faceMap.lm, X = u => u * MS, Y = v => v * MS, k = MS / 128;
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
  if (marks === 1) { // war paint: two slanted stripes under each eye + chin line
    for (const s of [-1, 1]) {
      const e = s < 0 ? lm.eyeL : lm.eyeR;
      for (let i = 0; i < 2; i++) {
        x.beginPath();
        const y0 = e[1] - 0.075 - i * 0.055;
        x.moveTo(X(e[0] - s * 0.03), Y(y0 + 0.012)); x.lineTo(X(e[0] + s * 0.11), Y(y0 + 0.028));
        x.lineTo(X(e[0] + s * 0.11), Y(y0 - 0.006)); x.lineTo(X(e[0] - s * 0.03), Y(y0 - 0.016)); x.closePath(); x.fill();
      }
    }
    x.fillRect(X(0.485), Y(lm.chin[1] - 0.02), 0.03 * MS, (lm.mouth[1] - lm.chin[1] - 0.035) * MS);
  } else if (marks === 2) { // tribal tattoo: curling lines over the brow and down one cheek
    x.lineWidth = 2.4 * k;
    x.beginPath(); x.moveTo(X(0.5), Y(lm.brow + 0.2)); x.quadraticCurveTo(X(0.5), Y(lm.brow + 0.08), X(0.5), Y(lm.brow + 0.05)); x.stroke();
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(X(0.5), Y(lm.brow + 0.14)); x.quadraticCurveTo(X(0.5 + s * 0.08), Y(lm.brow + 0.17), X(0.5 + s * 0.12), Y(lm.brow + 0.11)); x.stroke(); }
    const e = lm.eyeR;
    x.beginPath(); x.moveTo(X(e[0] + 0.04), Y(e[1] + 0.06)); x.bezierCurveTo(X(e[0] + 0.14), Y(e[1] - 0.02), X(e[0] + 0.02), Y(e[1] - 0.12), X(e[0] + 0.1), Y(e[1] - 0.22)); x.stroke();
    x.beginPath(); x.moveTo(X(e[0] + 0.07), Y(e[1] - 0.05)); x.quadraticCurveTo(X(e[0] + 0.16), Y(e[1] - 0.08), X(e[0] + 0.15), Y(e[1] - 0.16)); x.stroke();
    for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(X(e[0] + 0.1 - i * 0.02), Y(e[1] - 0.25 - i * 0.035), 1.6 * k, 0, 6.3); x.fill(); }
  } else { // arcane: vertical line through one eye + dots, crescent on the forehead
    const e = lm.eyeL;
    x.lineWidth = 2.2 * k;
    x.beginPath(); x.moveTo(X(e[0]), Y(e[1] + 0.13)); x.lineTo(X(e[0]), Y(e[1] + 0.05)); x.stroke();
    x.beginPath(); x.moveTo(X(e[0]), Y(e[1] - 0.05)); x.lineTo(X(e[0] + 0.005), Y(e[1] - 0.2)); x.stroke();
    for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(X(e[0] + 0.03 + i * 0.012), Y(e[1] - 0.12 - i * 0.03), 1.3 * k, 0, 6.3); x.fill(); }
    x.beginPath(); x.arc(X(0.5), Y(lm.brow + 0.12), 0.045 * MS, Math.PI * 0.15, Math.PI * 0.85, true); x.lineWidth = 2 * k; x.stroke();
    x.beginPath(); x.arc(X(0.5), Y(lm.brow + 0.125), 1.8 * k, 0, 6.3); x.fill();
  }
  const img = x.getImageData(0, 0, MS, MS).data;
  const data = new Uint8Array(MS * MS * 4);
  for (let i = 0; i < MS * MS; i++) { data[i * 4] = img[i * 4]; data[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(data, MS, MS, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  MARK_CACHE.set(key, tex);
  return tex;
}
