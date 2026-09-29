// Birds: songbird `bird` (bluebird / robin / sparrow / goldfinch / cardinal), `seagull` (herring / blackback / hooded) and
// `chicken` (white / brown / black / rooster). Cheap critters (≤ 1.5k tris): lofted bodies (smooth elliptical rings,
// analytic skinning), feather-sheet wings (two bones: arm + hand; rest pose spread, folded procedurally), fan tails,
// thin rigid legs. Double-sided material (single-sheet feathers).
// Controller: BirdCtl = the framework's BipedCtl (IK legs, hops/walks, state.fly hover/lean) with its `_wings` hook
// overridden for bird wings: folded on the ground, flapping (downstroke extended, upstroke wrist-flexed), gliding
// (seagull), bounding flight (songbird: flap bursts + wing tucks). The game moves flyers; `fly` lifts the model by flyH.
import * as THREE from 'three';
import { BipedCtl, legsLocal, legsPlant } from '../ctl.js';
import { bDeath, bKnockback } from '../acts.js';
import { sweep, rigid, bez, taper, eyeGeo, aim } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addHorn, lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, bell, TAU, fract } from '../../kit/rig.js';
import { loftZ, chainSkin, gridSheet, limb, V3, L2 } from './common.js';

// ------------------------------------------------------------------------------------------------ shared builders
/** eye on a lofted head: eyeGeo aimed along dir at pos (no SDF needed) */
function eye(acc, bone, pos, dir, r, iris, o = {}) {
  const rings = o.irisA === 0 ? [{ a: o.pupilA ?? 0.6, c: 0 }] : [{ a: o.pupilA ?? 0.45, c: 0 }, { a: o.irisA ?? 0.85, c: 1 }];
  const g = eyeGeo(r, rings, o.seg ?? 8, 1.6);
  const pc = col(0x080606), ic = col(iris), rc = col(o.rim ?? 0x201814);
  const d = new V3(...dir).normalize();
  const m = aim([pos[0] - d.x * r * 0.45, pos[1] - d.y * r * 0.45, pos[2] - d.z * r * 0.45], dir, [0, 1, 0], 1);
  acc.add(g, { matrix: m, skin: rigid(bone), dtl: [0, 0, 0, 0], color: (p, n, uv) => uv[0] === 0 ? pc : uv[0] === 1 && rings.length > 1 ? ic : rc, emis: (p, uv) => (uv[0] === 1 ? (o.emis ?? 0.08) : 0) });
  const gp = new THREE.Vector3(-0.3 * r, 0.35 * r, r * 0.98).applyMatrix4(m);
  acc.add(new THREE.SphereGeometry(r * 0.22, 4, 3), { matrix: new THREE.Matrix4().makeTranslation(gp.x, gp.y, gp.z), skin: rigid(bone), color: 0xffffff, emis: 0.3, dtl: [0, 0, 0, 0] });
}
/**
 * Feather wing (single sheet, rest pose spread along ±X in the horizontal plane at the shoulder). Grid u (span 0→1),
 * v (chord 0 leading edge → 1 trailing edge). Arm = u < ARM (bone w1), hand = u > ARM (bone w2), root blends to chest.
 * o: { L, chord, tip (0 round … 1 pointed), feathers, scallop, sweep, cols: fn(u, v) → hex|[r,g,b] }
 */
const ARM = 0.42;
function featherWing(acc, side, S, bones, o) {
  const L = o.L, C = o.chord, nF = o.feathers ?? 9;
  const le = (u) => -C * 0.12 * Math.sin(Math.PI * Math.min(1, u / 0.85)) + (o.sweep ?? 0.1) * C * u * u; // wrist juts forward
  const chord = (u) => C * (u < ARM ? mix(0.92, 1, u / ARM) : Math.pow(Math.max(0, 1 - (u - ARM) / (1 - ARM)), mix(0.55, 1.15, o.tip ?? 0.5)) * mix(1, 0.85, (u - ARM) / (1 - ARM))) + 0.004;
  const g = gridSheet(o.nu ?? 14, 3, (u, v) => {
    const sc = (o.scallop ?? 0.12) * Math.pow(Math.abs(Math.sin(Math.PI * u * nF)), 0.7) * v * v * (u < ARM ? 1 : 1.3);
    const z = le(u) + chord(u) * v * (1 + sc);
    return [S[0] + side * u * L, S[1] - v * C * 0.05, S[2] + z];
  });
  const cf = o.cols;
  acc.add(g, {
    skin: (p) => {
      const u = Math.abs(p.x - S[0]) / L;
      if (u < 0.1) { const t = sstep(0.0, 0.1, u); return { si: [bones.chest, bones.w1, 0, 0], sw: [1 - t, t, 0, 0] }; }
      const t = sstep(ARM - 0.06, ARM + 0.04, u); return { si: [bones.w1, bones.w2, 0, 0], sw: [1 - t, t, 0, 0] };
    },
    dtl: [0.3, 0, 0.1, 0],
    color: (p, n, uv) => col(cf(uv[0], uv[1])),
  });
}
/** fan tail (single sheet) growing back from base along +Z */
function fanTail(acc, bone, base, len, w0, w1, colFn, o = {}) {
  const g = gridSheet(o.nu ?? 6, 2, (u, v) => {
    const x = (u - 0.5) * mix(w0, w1, v) * 2, notch = (o.notch ?? 0) * (1 - Math.abs(u - 0.5) * 2) * v;
    const tipC = (o.round ?? 0.2) * (1 - Math.pow(Math.abs(u - 0.5) * 2, 2)) * v;
    return [base[0] + x, base[1] - v * len * (o.droop ?? 0.18), base[2] + v * len * (1 + tipC - notch)];
  });
  acc.add(g, { skin: rigid(bone), dtl: [0.3, 0, 0.1, 0], color: (p, n, uv) => col(colFn(uv[0], uv[1])) });
}
/** thin bird legs: tarsus on the shin bone, 3 front toes + hallux on the foot bone; webbed feet optional */
function birdLegs(acc, R, D, cleg, web) {
  const b = (n) => R.index(n);
  for (const s of [-1, 1]) {
    const K = D.knee(s), A = D.ankle(s), r = D.legR;
    limb(acc, b(L2(s, 'shin')), K, A, r * 1.25, r, cleg, cleg, 5);
    const fb = b(L2(s, 'foot')), T = D.toe;
    const toes = [[-0.55, -1], [0, -1.1], [0.55, -1], [0, 0.45]];
    for (const [dx, dz] of toes) limb(acc, fb, [A[0], A[1] - r * 0.5, A[2]], [A[0] + dx * T * 0.55 * s, 0.003, A[2] + dz * T], r * 0.8, r * 0.45, cleg, cleg, 4);
    if (web) {
      const g = new THREE.BufferGeometry();
      const p0 = [A[0], 0.004, A[2]], p1 = [A[0] - 0.55 * T * 0.55, 0.003, A[2] - T], p2 = [A[0], 0.003, A[2] - 1.1 * T], p3 = [A[0] + 0.55 * T * 0.55, 0.003, A[2] - T];
      g.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p3], 3));
      g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
      acc.add(g, { skin: rigid(fb), color: web, dtl: [0, 0, 0.1, 0] });
    }
  }
}
function birdRig(R, D) {
  R.add('hips', null, D.hips); R.add('spine', 'hips', D.spine); R.add('chest', 'spine', D.chest);
  R.add('neck', 'chest', D.neck); R.add('head', 'neck', D.head); R.add('jaw', 'head', D.jaw);
  R.add('tail', 'hips', D.tail);
  for (const s of [-1, 1]) {
    R.add(L2(s, 'wing1'), 'chest', D.shoulder(s)); R.add(L2(s, 'wing2'), L2(s, 'wing1'), [D.shoulder(s)[0] + s * D.wingL * ARM, D.shoulder(s)[1], D.shoulder(s)[2]]);
    R.add(L2(s, 'thigh'), 'hips', D.hip(s)); R.add(L2(s, 'shin'), L2(s, 'thigh'), D.knee(s)); R.add(L2(s, 'foot'), L2(s, 'shin'), D.ankle(s));
  }
}
/** loft body skinned along its Z chain (head → tail); rings: [{z, y, rx, ry, ryB}] */
function birdBody(acc, R, rings, chainZ, chainBones, colorFn, radial = 12) {
  const idx = chainBones.map(n => R.index(n));
  const g = loftZ(rings, radial);
  acc.add(g, { skin: (p) => chainSkin(chainZ, idx, p.z), dtl: [0.35, 0, 0.12, 0], color: (p, n) => col(colorFn(p, n)) });
}
const hx = (h) => typeof h === 'number' ? col(h) : h;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const L3 = (a, b, t) => lerp3(hx(a), hx(b), clamp01(t));

// ------------------------------------------------------------------------------------------------ bird controller
/**
 * BipedCtl + feathered wings. spec.bw = { L, flapF, amp, mid, glide (0..1 share of cruise spent gliding),
 * bound (songbird bounding flight), hoverF, foldTilt, armFold }
 */
export class BirdCtl extends BipedCtl {
  constructor(inst, spec) {
    super(inst, spec);
    inst.material.side = THREE.DoubleSide; // single-sheet feathers
    this.open = 0; this.glideT = Math.random() * 10; this.bnd = Math.random();
  }
  _wings(dt, P) {
    const W = this.spec.bw, b = this.b;
    const fly = this.fly, sp = Math.abs(this.speedSm);
    // cruise mode: glide share (gull) / bounding tucks (songbird)
    this.glideT += dt;
    const cruise = fly * sstep(0.8, 2.5, sp);
    let glide = 0, tuck = 0;
    if (W.glide) glide = cruise * sstep(0.35, 0.6, 0.5 + 0.5 * Math.sin(this.glideT * TAU / 5.2)) * W.glide;
    if (W.bound) { this.bnd = fract(this.bnd + dt / 0.75); tuck = cruise * sstep(0.62, 0.7, this.bnd) * (1 - sstep(0.94, 1, this.bnd)); }
    const flapA = Math.max(fly * (1 - glide) * (1 - tuck), this.flap);
    const openT = Math.max(fly * (1 - tuck * 0.85), this.flap, this.wingSpread);
    this.open += (openT - this.open) * (1 - Math.exp(-(openT > this.open ? 14 : 6) * dt));
    const open = clamp01(this.open);
    const f = mix(W.flapF, W.hoverF ?? W.flapF * 1.4, fly * (1 - sstep(0.3, 1.5, sp)));
    this.wt += dt * TAU * f * (flapA > 0.02 ? 1 : 0.2);
    const beat = Math.sin(this.wt), up = Math.cos(this.wt);
    const fold = 1 - open;
    for (let s = -1; s <= 1; s += 2) {
      const w = s < 0 ? b.wingL : b.wingR;
      const roll = (W.mid + W.amp * beat * flapA + glide * 0.1 - tuck * 0.2) * open;
      // folded: yaw back along the body, roll the sheet upright (leading edge up), arm compressed
      P.rot(w[0], fold * (W.foldRoll ?? -0.3), -s * fold * (Math.PI / 2 - (W.foldYaw ?? 0.08)), s * roll);
      P.move(w[0], s * (W.foldOut ?? 0) * fold, (W.foldUp ?? 0) * fold, 0);
      if (W.foldPitch) P.prot(w[0], X_AXIS, W.foldPitch * fold); // folded tips follow the sloping back
      P.sc[w[0]].set(1 - fold * (1 - (W.armFold ?? 0.3)), 1, 1);
      P.move(w[1], -s * W.L * ARM * fold * (1 - (W.armFold ?? 0.3)), 0, 0);
      // hand: flexes back on the upstroke, lags the beat, droops slightly when gliding
      const flex = Math.max(0, up) * flapA * 0.7 * open;
      P.rot(w[1], 0, s * (flex * 0.9) + s * fold * 0.06, s * (W.amp * 0.35 * Math.sin(this.wt - 0.9) * flapA * open - glide * 0.12));
    }
    // tail fans in flight
    P.sc[b.tail[0]].set(1 + 0.6 * open * fly, 1, 1);
    this.wingBeat = beat;
  }
}

// ------------------------------------------------------------------------------------------------ shared actions
const peck = (d = 0.9, deep = 1) => ({ dur: d, a: 0.05, d: 0.9, fn(ctl, a, w) {
  const P = ctl.pose, b = ctl.b, k = a.k;
  const p = Math.max(bell(clamp01(k / 0.32)), bell(clamp01((k - 0.36) / 0.3)) * 0.9);
  P.rx(b.hips, -0.25 * p * w * deep); P.rx(b.spine, -0.25 * p * w * deep); P.rx(b.neck, -0.35 * p * w * deep); P.rx(b.head, -0.45 * p * w * deep);
  ctl.jaw = Math.max(ctl.jaw, 0.25 * p * w);
} });
const hop = (h) => ({ dur: 0.42, a: 0.04, d: 0.9, fn(ctl, a, w) {
  const P = ctl.pose, b = ctl.b, k = a.k, j = Math.sin(clamp01(k / 0.8) * Math.PI);
  P.move(b.hips, 0, h * j * w, -h * 0.4 * j * w); P.rx(b.hips, 0.15 * Math.sin(k * TAU) * w);
  legsLocal(ctl, j * w, 0.35, 1.0);
  ctl.wingSpread = Math.max(ctl.wingSpread, 0.25 * j * w);
} });
const flapAct = (d = 1.3) => ({ dur: d, a: 0.08, d: 0.85, fn(ctl, a, w) { // spread & flap on the spot (stretch / display)
  const P = ctl.pose, b = ctl.b, e = bell(clamp01(a.k * 1.05));
  ctl.flap = Math.max(ctl.flap, e * w);
  P.move(b.hips, 0, 0.012 * ctl.H * e * w, 0); P.rx(b.spine, 0.15 * e * w);
} });
const preen = { dur: 2.4, a: 0.12, d: 0.85, fn(ctl, a, w) { // head swings back to nibble the wing
  const P = ctl.pose, b = ctl.b, t = a.t, s = a.seed > 50 ? 1 : -1;
  P.rot(b.neck, -0.2 * w, 1.1 * s * w, 0); P.rot(b.head, (-0.4 + Math.sin(t * 13) * 0.08) * w, 0.9 * s * w, 0.3 * s * w);
  ctl.jaw = Math.max(ctl.jaw, (0.1 + 0.1 * Math.sin(t * 13)) * w); ctl.wingSpread = Math.max(ctl.wingSpread, 0.15 * w);
} };
const look = { dur: 1.8, a: 0.06, d: 0.9, fn(ctl, a, w) { // quick jerky head turns
  const P = ctl.pose, b = ctl.b, k = a.k;
  const yv = k < 0.3 ? 0.9 : k < 0.6 ? -0.9 : k < 0.85 ? 0.4 : 0;
  a.u.y = (a.u.y ?? 0) + (yv - (a.u.y ?? 0)) * 0.35;
  P.rot(b.head, 0.1 * w, a.u.y * w, a.u.y * 0.25 * w); P.rx(b.neck, 0.1 * w);
} };
const flee = { dur: 1, hold: true, fadeIn: 0.1, fadeOut: 0.4, fn(ctl, a, w) { // alarmed: crouched, tail up, wings loose
  const P = ctl.pose, b = ctl.b;
  P.rx(b.hips, -0.15 * w); P.rx(b.tail[0], -0.35 * w); P.rx(b.head, 0.15 * w);
  ctl.wingSpread = Math.max(ctl.wingSpread, 0.18 * w);
} };
const hitB = { dur: 0.4, a: 0.03, d: 0.5, hit: 0, fn(ctl, a, w) {
  const P = ctl.pose, b = ctl.b, j = sstep(0, 0.15, a.k) * (1 - sstep(0.3, 1, a.k)) * w;
  P.move(b.hips, 0, 0.02 * ctl.H * j, 0.05 * ctl.H * j); P.rx(b.spine, 0.3 * j); P.rx(b.head, 0.3 * j);
  P.sc[b.chest].multiplyScalar(1 + 0.15 * j); ctl.flap = Math.max(ctl.flap, 0.6 * j); ctl.jaw = Math.max(ctl.jaw, 0.5 * j);
} };
const birdPose = (extra) => (ctl, dt) => {
  const P = ctl.pose, B = ctl.b, G = ctl.gait;
  // head-bob while walking: the head holds still, then thrusts forward each step
  const hp = fract(G.phase * 2), v = clamp01(Math.abs(ctl.speedSm) / (ctl.spec.bobV ?? 0.5));
  const hold = hp < 0.65 ? hp / 0.65 : 1 - (hp - 0.65) / 0.35;
  P.move(B.head, 0, 0, (hold - 0.5) * (ctl.spec.bobZ ?? 0.03) * ctl.H * v * G.act * (1 - ctl.fly));
  // flight posture: tail streams, head levels, feet tuck
  P.rx(B.tail[0], 0.15 * ctl.fly);
  if (extra) extra(ctl, dt);
};

// ================================================================================================ songbird
const SB = { // dims (model space, faces −Z, feet at y = 0)
  hips: [0, 0.086, 0.014], spine: [0, 0.096, 0.0], chest: [0, 0.102, -0.018], neck: [0, 0.114, -0.03], head: [0, 0.128, -0.045], jaw: [0, 0.126, -0.068],
  tail: [0, 0.1, 0.058], shoulder: (s) => [s * 0.024, 0.114, -0.02], wingL: 0.12,
  hip: (s) => [s * 0.014, 0.08, 0.008], knee: (s) => [s * 0.017, 0.062, -0.006], ankle: (s) => [s * 0.017, 0.016, 0.006], legR: 0.0026, toe: 0.016,
};
const SB_PAL = {
  bluebird: { crown: 0x3a6ad8, back: 0x3a64c8, face: 0x3a64c8, throat: 0xd8783a, breast: 0xe0823c, belly: 0xf0ece4, wing: 0x3c6ae0, wing2: 0x2a3e8a, bar: null, tail: 0x2e4ea8, beak: 0x2a2a30, leg: 0x3a3438, eye: 0x1a1210 },
  robin: { crown: 0x3a3632, back: 0x6a5e52, face: 0x2e2a28, throat: 0xe06a2a, breast: 0xe8662a, belly: 0xf2ece2, wing: 0x5e544a, wing2: 0x3e3630, bar: null, tail: 0x3a3430, beak: 0xe8b030, leg: 0x6a5a4a, eye: 0x1a1210 },
  sparrow: { crown: 0x8a5a34, back: 0x9a6a3a, face: 0x9a9a92, throat: 0x2a2624, breast: 0xc8c0b0, belly: 0xe4dccc, wing: 0x8a5a30, wing2: 0x4e3420, bar: 0xf4f0e8, tail: 0x5a4028, beak: 0x4a3a2a, leg: 0x9a7a60, eye: 0x1a1210, streak: 0x3a2414 },
  goldfinch: { crown: 0x1a1a1c, back: 0xf4d020, face: 0xf4d428, throat: 0xf8dc30, breast: 0xf8d82c, belly: 0xf6ecc0, wing: 0x1c1c20, wing2: 0x0c0c0e, bar: 0xf8f4e8, tail: 0x1a1a1c, beak: 0xe8a07a, leg: 0xb89a80, eye: 0x1a1210 },
  cardinal: { crown: 0xd8201c, back: 0xb8241e, face: 0x141010, throat: 0x141010, breast: 0xe0281e, belly: 0xd8342a, wing: 0xb02a22, wing2: 0x8a1a16, bar: null, tail: 0x9a1e18, beak: 0xf07a28, leg: 0x8a6a5a, eye: 0x1a1210, crest: true },
};
export const bird = {
  name: 'Songbird',
  variants: ['bluebird', 'robin', 'sparrow', 'goldfinch', 'cardinal'],
  canFly: true,
  config(variant) { const v = SB_PAL[variant] ? variant : 'bluebird'; return { variant: v, pal: SB_PAL[v], scale: 1.5, mat: { dfreq: 16, rim: 0.3, wrap: 0.55 }, castShadow: true }; },
  rig(R) { birdRig(R, SB); },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    const rings = [
      { z: -0.074, y: 0.128, rx: 0.0, ry: 0.0 }, { z: -0.071, y: 0.128, rx: 0.009, ry: 0.009 }, { z: -0.064, y: 0.129, rx: 0.017, ry: 0.017 }, { z: -0.055, y: 0.13, rx: 0.022, ry: 0.022, ryB: 0.021 },
      { z: -0.045, y: 0.13, rx: 0.024, ry: 0.024, ryB: 0.023 }, { z: -0.035, y: 0.126, rx: 0.022, ry: 0.022, ryB: 0.024 }, { z: -0.026, y: 0.118, rx: 0.022, ry: 0.02, ryB: 0.026 },
      { z: -0.015, y: 0.106, rx: 0.028, ry: 0.024, ryB: 0.032 }, { z: -0.002, y: 0.099, rx: 0.031, ry: 0.026, ryB: 0.033 }, { z: 0.013, y: 0.096, rx: 0.03, ry: 0.025, ryB: 0.031 },
      { z: 0.028, y: 0.097, rx: 0.026, ry: 0.022, ryB: 0.026 }, { z: 0.042, y: 0.099, rx: 0.019, ry: 0.017, ryB: 0.018 }, { z: 0.054, y: 0.101, rx: 0.012, ry: 0.011, ryB: 0.011 }, { z: 0.064, y: 0.102, rx: 0.0, ry: 0.0 },
    ];
    birdBody(acc, R, rings, [-0.05, -0.03, -0.016, 0.002, 0.02, 0.058], ['head', 'neck', 'chest', 'spine', 'hips', 'tail'], (p, n) => {
      const up = n.y, fr = -n.z, z = p.z;
      const headK = sstep(-0.028, -0.04, z);
      let cc = L3(c.breast, c.belly, sstep(-0.005, 0.02, z) * sstep(0.1, -0.4, up));
      cc = L3(cc, c.back, sstep(-0.15, 0.35, up + Math.abs(n.x) * 0.25) * (1 - headK));
      cc = L3(cc, c.throat, sstep(-0.018, -0.03, z) * sstep(0.2, -0.4, up) * (1 - sstep(-0.05, -0.062, z)));
      cc = L3(cc, c.face, headK * sstep(0.6, -0.1, up));
      cc = L3(cc, c.crown, headK * sstep(0.2, 0.6, up));
      if (c.streak) cc = L3(cc, c.streak, sstep(0.3, 0.6, up) * (1 - headK) * sstep(0.6, 0.9, Math.sin(p.x * 900) * 0.5 + 0.5) * 0.7);
      if (c.crest) cc = L3(cc, c.face, headK * sstep(-0.1, -0.5, up) * sstep(-0.05, -0.065, z)); // mask around the beak
      return cc;
    });
    // beak (upper on head, lower on jaw)
    addHorn(acc, b('head'), [0, 0.13, -0.068], [0, 0.129, -0.078], [0, 0.126, -0.088], 0.0065, 0.0008, { base: c.beak, tip: c.beak, radial: 5, n: 3, flat: 0.8 });
    addHorn(acc, b('jaw'), [0, 0.125, -0.066], [0, 0.123, -0.075], [0, 0.123, -0.083], 0.0048, 0.0007, { base: c.beak, tip: c.beak, radial: 4, n: 3, flat: 0.7 });
    for (const s of [-1, 1]) eye(acc, b('head'), [s * 0.019, 0.134, -0.056], [s * 0.85, 0.1, -0.5], 0.0055, c.eye, { irisA: 0, pupilA: 0.9 });
    if (c.crest) addHorn(acc, b('head'), [0, 0.148, -0.05], [0, 0.166, -0.042], [0, 0.17, -0.026], 0.012, 0.001, { base: c.crown, tip: c.crown, radial: 5, n: 4, flat: 0.45 });
    const wc = (u, v) => { let q = L3(c.wing, c.wing2, sstep(0.35, 0.85, v) * (0.4 + 0.6 * sstep(0.3, 0.6, u))); if (c.bar) q = L3(q, c.bar, (1 - sstep(0.06, 0.12, Math.abs(v - 0.3))) * (1 - sstep(0.35, 0.55, u))); return q; };
    for (const s of [-1, 1]) featherWing(acc, s, SB.shoulder(s), { chest: b('chest'), w1: b(L2(s, 'wing1')), w2: b(L2(s, 'wing2')) }, { L: SB.wingL, chord: 0.05, tip: 0.35, feathers: 8, scallop: 0.14, cols: wc });
    fanTail(acc, b('tail'), [0, 0.102, 0.05], 0.07, 0.009, 0.022, (u, v) => L3(c.tail, c.wing2, sstep(0.5, 1, v)), { notch: 0.1, droop: 0.12 });
    birdLegs(acc, R, SB, c.leg);
  },
  sockets: { head: ['head', [0, 0.16, -0.045]], mouth: ['jaw', [0, 0.126, -0.086]], center: ['spine', [0, 0.1, 0]], back: ['spine', [0, 0.124, 0.004]], chest: ['chest', [0, 0.094, -0.035]] },
  height: 0.16, radius: 0.07,
  controller(inst) { return new BirdCtl(inst, SB_SPEC); },
  get actionList() { return SB_ACTIONS; },
};
const SB_ACTIONS = {
  hop: hop(0.035), peck: peck(0.8), flap: flapAct(1.0), preen, look, flee, hit: hitB,
  sing: { dur: 1.8, a: 0.1, d: 0.85, fn(ctl, a, w) { // head up, beak trilling, throat pulsing, tail flicks
    const P = ctl.pose, b = ctl.b, t = a.t, e = bell(clamp01(a.k * 1.05));
    P.rx(b.neck, 0.35 * e * w); P.rx(b.head, 0.45 * e * w); P.rx(b.tail[0], -0.3 * Math.max(0, Math.sin(t * 9)) * e * w);
    const tr = 0.5 + 0.5 * Math.sin(t * 34) * Math.sin(t * 5.3);
    ctl.jaw = Math.max(ctl.jaw, 0.45 * tr * e * w); P.sc[b.neck].multiplyScalar(1 + 0.12 * tr * e * w);
  } },
  death: bDeath({ dur: 1.2, dist: 1.2, peak: 0.6, spin: 0.3, lieY: 0.02, pitch: 2.9 }),
  knockback: bKnockback({ dur: 0.6 }),
};
const SB_SPEC = {
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail'], wingL: ['wing1L', 'wing2L'], wingR: ['wing1R', 'wing2R'] },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.017, 0, -0.004], body: 'hips', scap: 0.2, lift: 0.02, flex: 0.5, heel: 0.2 },
      { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.017, 0, -0.004], body: 'hips', scap: 0.2, lift: 0.02, flex: 0.5, heel: 0.2 },
    ],
    maxStride: 0.07, fMin: 0.8, actV: 0.08,
    gaits: [ // two-footed hops
      { v: 0.3, f: 3.0, duty: 0.4, lift: 1.3, off: { L: 0, R: 0.02 }, bob: 0.012, bobF: 1, bobPh: 0.7, pitch: 0.12, pitchF: 1 },
      { v: 1.2, f: 4.2, duty: 0.32, lift: 1.6, off: { L: 0, R: 0.03 }, bob: 0.018, bobF: 1, bobPh: 0.7, pitch: 0.14, pitchF: 1 },
    ],
  },
  lean: { walk: 0.05, run: 0.15, combat: 0 }, twist: 0.02, crouch: 0.01, breathe: 0.05,
  bw: { L: SB.wingL, flapF: 11, hoverF: 15, amp: 1.05, mid: 0.25, bound: true, foldRoll: -0.35, foldYaw: 0.1, armFold: 0.3, foldOut: 0.006, foldUp: 0.01, foldPitch: -0.14 },
  flyH: 1.5, flyBob: 0.05, flyLean: 0.45, airPaw: -1.0, bobV: 0.3, bobZ: 0.02,
  fidgets: [{ name: 'peck', w: 3 }, { name: 'look', w: 2 }, { name: 'hop', w: 2 }, { name: 'sing', w: 1 }, { name: 'preen', w: 1 }], fidgetGap: 1.6,
  pose: birdPose((ctl) => { ctl.pose.rx(ctl.b.hips, 0.12 * ctl.fly * (1 - sstep(0.3, 1.5, Math.abs(ctl.speedSm)))); }),
  actions: SB_ACTIONS,
};

// ================================================================================================ seagull
const SG = {
  hips: [0, 0.24, 0.03], spine: [0, 0.26, -0.01], chest: [0, 0.28, -0.06], neck: [0, 0.32, -0.12], head: [0, 0.37, -0.16], jaw: [0, 0.358, -0.21],
  tail: [0, 0.27, 0.13], shoulder: (s) => [s * 0.05, 0.31, -0.05], wingL: 0.56,
  hip: (s) => [s * 0.035, 0.22, 0.02], knee: (s) => [s * 0.04, 0.16, -0.01], ankle: (s) => [s * 0.042, 0.035, 0.018], legR: 0.0065, toe: 0.04,
};
const SG_PAL = {
  herring: { head: 0xdcdcd6, body: 0xdadad4, back: 0x98a4b0, wing: 0x9aa6b2, wingDark: 0x1c1c20, mirror: 0xdcdcd6, tail: 0xdcdcd6, beak: 0xf0c83a, spot: 0xd8321e, leg: 0xe8a898, eye: 0xf0e070, hood: null },
  blackback: { head: 0xdcdcd6, body: 0xdadad4, back: 0x2e3238, wing: 0x30343a, wingDark: 0x121214, mirror: 0xdcdcd6, tail: 0xdcdcd6, beak: 0xf0c83a, spot: 0xd8321e, leg: 0xe8b0a0, eye: 0xf0e070, hood: null },
  hooded: { head: 0x2a2624, body: 0xdcdcd6, back: 0x8a949e, wing: 0x8e98a2, wingDark: 0x141416, mirror: 0xdcdcd6, tail: 0xdcdcd6, beak: 0xa8201c, spot: 0x6a1010, leg: 0x9a2a24, eye: 0x2a1a14, hood: true },
};
export const seagull = {
  name: 'Seagull',
  variants: ['herring', 'blackback', 'hooded'],
  canFly: true,
  config(variant) { const v = SG_PAL[variant] ? variant : 'herring'; return { variant: v, pal: SG_PAL[v], scale: 1, mat: { dfreq: 9, rim: 0.3, wrap: 0.55 }, castShadow: true }; },
  rig(R) { birdRig(R, SG); },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    const rings = [
      { z: -0.205, y: 0.37, rx: 0, ry: 0 }, { z: -0.2, y: 0.37, rx: 0.018, ry: 0.02 }, { z: -0.19, y: 0.372, rx: 0.032, ry: 0.034, ryB: 0.03 }, { z: -0.175, y: 0.374, rx: 0.04, ry: 0.042, ryB: 0.036 },
      { z: -0.158, y: 0.372, rx: 0.042, ry: 0.043, ryB: 0.04 }, { z: -0.138, y: 0.36, rx: 0.038, ry: 0.038, ryB: 0.042 }, { z: -0.118, y: 0.338, rx: 0.036, ry: 0.034, ryB: 0.044 },
      { z: -0.095, y: 0.305, rx: 0.052, ry: 0.044, ryB: 0.06 }, { z: -0.065, y: 0.28, rx: 0.07, ry: 0.058, ryB: 0.07 }, { z: -0.025, y: 0.266, rx: 0.076, ry: 0.06, ryB: 0.07 },
      { z: 0.02, y: 0.262, rx: 0.07, ry: 0.056, ryB: 0.06 }, { z: 0.065, y: 0.266, rx: 0.056, ry: 0.046, ryB: 0.044 }, { z: 0.105, y: 0.272, rx: 0.038, ry: 0.032, ryB: 0.028 },
      { z: 0.135, y: 0.276, rx: 0.02, ry: 0.016, ryB: 0.014 }, { z: 0.152, y: 0.278, rx: 0, ry: 0 },
    ];
    birdBody(acc, R, rings, [-0.165, -0.125, -0.065, -0.012, 0.03, 0.13], ['head', 'neck', 'chest', 'spine', 'hips', 'tail'], (p, n) => {
      const up = n.y, z = p.z;
      let cc = L3(c.body, c.back, sstep(0.25, 0.7, up) * sstep(-0.1, -0.06, z) * (1 - sstep(0.12, 0.15, z)));
      if (c.hood) cc = L3(cc, c.head, sstep(-0.13, -0.15, z));
      else cc = L3(cc, c.head, sstep(-0.12, -0.15, z));
      return cc;
    }, 14);
    // heavy hooked bill with a red gonys spot
    addHorn(acc, b('head'), [0, 0.37, -0.198], [0, 0.366, -0.238], [0, 0.352, -0.272], 0.013, 0.003, { base: c.beak, tip: c.beak, radial: 6, n: 4, flat: 1.35 });
    addHorn(acc, b('head'), [0, 0.358, -0.262], [0, 0.352, -0.274], [0, 0.34, -0.276], 0.005, 0.001, { base: c.beak, tip: c.beak, radial: 4, n: 3 });
    addHorn(acc, b('jaw'), [0, 0.356, -0.2], [0, 0.35, -0.232], [0, 0.35, -0.258], 0.01, 0.002, { base: c.beak, tip: c.spot, radial: 5, n: 4, flat: 1.2, gpow: 3 });
    for (const s of [-1, 1]) eye(acc, b('head'), [s * 0.034, 0.384, -0.178], [s * 0.85, 0.15, -0.45], 0.0085, c.eye, { pupilA: 0.4, irisA: 0.95, rim: 0xd8382a });
    const wc = (u, v) => {
      let q = L3(c.back, c.wing, sstep(0.1, 0.4, v));
      q = L3(q, 0xdcdcd6, sstep(0.82, 0.95, v) * (1 - sstep(0.55, 0.62, u)) * 0.9);             // white trailing edge
      const tipK = sstep(0.7, 0.78, u);
      q = L3(q, c.wingDark, tipK * sstep(0.05, 0.3, v));                                     // black wing tips
      q = L3(q, c.mirror, tipK * (1 - sstep(0.02, 0.05, Math.hypot(u - 0.93, (v - 0.55) * 0.6))));  // white mirrors
      return q;
    };
    for (const s of [-1, 1]) featherWing(acc, s, SG.shoulder(s), { chest: b('chest'), w1: b(L2(s, 'wing1')), w2: b(L2(s, 'wing2')) }, { L: SG.wingL, chord: 0.17, tip: 0.9, feathers: 10, scallop: 0.08, sweep: 0.35, cols: wc, nu: 16 });
    fanTail(acc, b('tail'), [0, 0.278, 0.12], 0.13, 0.02, 0.05, (u, v) => col(c.tail), { round: 0.05, droop: 0.1 });
    birdLegs(acc, R, SG, c.leg, c.leg);
  },
  sockets: { head: ['head', [0, 0.43, -0.16]], mouth: ['jaw', [0, 0.35, -0.26]], center: ['spine', [0, 0.27, -0.01]], back: ['spine', [0, 0.32, 0.0]], chest: ['chest', [0, 0.25, -0.1]] },
  height: 0.42, radius: 0.16,
  controller(inst) { return new BirdCtl(inst, SG_SPEC); },
  get actionList() { return SG_ACTIONS; },
};
const SG_ACTIONS = {
  peck: peck(1.0, 0.9), flap: flapAct(1.5), preen, look, flee, hit: hitB,
  squawk: { dur: 1.6, a: 0.08, d: 0.85, fn(ctl, a, w) { // the long call: head thrown down, then up & back, bill wide
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const dn = bell(clamp01(k / 0.3)), upk = sstep(0.28, 0.42, k) * (1 - sstep(0.8, 1, k));
    P.rx(b.spine, (-0.25 * dn + 0.1 * upk) * w); P.rx(b.neck, (-0.6 * dn + 0.6 * upk) * w); P.rx(b.head, (-0.3 * dn + 0.5 * upk) * w);
    ctl.jaw = Math.max(ctl.jaw, (0.2 * dn + 0.6 * upk * (0.7 + 0.3 * Math.sin(t * 22))) * w);
    ctl.wingSpread = Math.max(ctl.wingSpread, 0.12 * upk * w);
  } },
  death: bDeath({ dur: 1.3, dist: 0.9, peak: 0.5, spin: 0.2, lieY: 0.05, pitch: 2.8 }),
  knockback: bKnockback({ dur: 0.7 }),
};
const SG_SPEC = {
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail'], wingL: ['wing1L', 'wing2L'], wingR: ['wing1R', 'wing2R'] },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.045, 0, -0.01], body: 'hips', scap: 0.25, lift: 0.035, flex: 0.6, heel: 0.3 },
      { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.045, 0, -0.01], body: 'hips', scap: 0.25, lift: 0.035, flex: 0.6, heel: 0.3 },
    ],
    maxStride: 0.14, fMin: 0.8, actV: 0.1,
    gaits: [ // waddling walk → hurried run
      { v: 0.45, f: 2.4, duty: 0.6, lift: 1, off: { L: 0, R: 0.5 }, bob: 0.008, bobF: 2, roll: 0.09, rollF: 1, rollPh: 0.25, sway: 0.012, swayF: 1, swayPh: 0.25 },
      { v: 1.8, f: 4.0, duty: 0.42, lift: 1.3, off: { L: 0, R: 0.5 }, bob: 0.014, bobF: 2, roll: 0.07, rollF: 1, rollPh: 0.25 },
    ],
  },
  lean: { walk: 0.08, run: 0.25, combat: 0 }, twist: 0.05, waddle: 0.12, crouch: 0.01, breathe: 0.03,
  bw: { L: SG.wingL, flapF: 3.0, hoverF: 4.2, amp: 0.65, mid: 0.18, glide: 0.85, foldRoll: -0.42, foldYaw: 0.1, armFold: 0.25, foldOut: 0.018, foldUp: 0.022, foldPitch: -0.2 },
  flyH: 2.6, flyBob: 0.12, flyLean: 0.3, airPaw: -1.2, bobV: 0.5, bobZ: 0.025,
  fidgets: [{ name: 'peck', w: 3 }, { name: 'look', w: 2 }, { name: 'squawk', w: 1 }, { name: 'preen', w: 1 }], fidgetGap: 2.5,
  pose: birdPose(),
  actions: SG_ACTIONS,
};

// ================================================================================================ chicken
const CK = {
  hips: [0, 0.22, 0.02], spine: [0, 0.25, 0.0], chest: [0, 0.27, -0.05], neck: [0, 0.31, -0.08], head: [0, 0.39, -0.1], jaw: [0, 0.385, -0.135],
  tail: [0, 0.28, 0.1], shoulder: (s) => [s * 0.07, 0.29, -0.04], wingL: 0.2,
  hip: (s) => [s * 0.04, 0.19, 0.02], knee: (s) => [s * 0.045, 0.12, -0.012], ankle: (s) => [s * 0.045, 0.026, 0.008], legR: 0.0085, toe: 0.045,
};
const CK_PAL = {
  white: { body: 0xdcd6ca, dark: 0xbfb6a4, tail: 0xd0c8b8, comb: 0xd82a22, beak: 0xe8b030, leg: 0xe8b030, sickle: null },
  brown: { body: 0xb8642c, dark: 0x7a3a18, tail: 0x5a2a14, comb: 0xd82a22, beak: 0xe0a830, leg: 0xe0a830, sickle: null },
  black: { body: 0x2a2a30, dark: 0x16161a, tail: 0x1a1c24, comb: 0xd02620, beak: 0x9a8a6a, leg: 0x6a6a64, sickle: null },
  rooster: { body: 0xc8541e, dark: 0x8a2a10, tail: 0x0e2a24, comb: 0xe02a20, beak: 0xe8b030, leg: 0xe8b030, sickle: 0x14463a, neck: 0xf0a030 },
};
export const chicken = {
  name: 'Chicken',
  variants: ['white', 'brown', 'black', 'rooster'],
  config(variant) {
    const v = CK_PAL[variant] ? variant : 'white';
    return { variant: v, pal: CK_PAL[v], rooster: v === 'rooster', shapeKey: v === 'rooster' ? 'rooster' : 'hen', h: 0.024, scale: v === 'rooster' ? 1.12 : 1, mat: { dfreq: 6, rim: 0.25 }, ao: { dist: 0.02, str: 0.7 } };
  },
  rig(R) { birdRig(R, CK); },
  sculpt(S, cfg) {
    const c = cfg.pal, f = [0.3, 0, 0.1, 0], RO = cfg.rooster;
    S.ell('spine', [0, 0.25, 0.0], [0.09, 0.095, 0.12], { k: 0.04, col: c.body, tag: 'body', dtl: f });
    S.ell('chest', [0, 0.25, -0.07], [0.075, 0.08, 0.07], { k: 0.04, col: c.body, tag: 'body', dtl: f });
    S.cone('neck', [0, 0.29, -0.08], [0, 0.37, -0.1], 0.045, 0.03, { k: 0.03, col: c.neck ?? c.body, tag: 'neck', b2: 'head', dtl: f });
    S.ell('head', [0, 0.395, -0.105], [0.03, 0.035, 0.038], { k: 0.02, col: c.neck ?? c.body, tag: 'head', dtl: f });
    S.cone('tail', [0, 0.27, 0.08], [0, 0.36, 0.15], 0.055, 0.025, { k: 0.03, col: c.tail, tag: 'tail', dtl: f });
    const cs = RO ? 1.5 : 1;
    for (let i = 0; i < (RO ? 4 : 3); i++) S.sph('head', [0, 0.435 + (i === 1 || i === 2 ? 0.01 * cs : 0), -0.13 + i * 0.02], 0.014 * cs, { k: 0.01, col: c.comb, tag: 'comb' });
    S.ell('jaw', [0, 0.36, -0.13], [0.01, 0.018 * cs, 0.01], { k: 0.008, col: c.comb, tag: 'wattle' });
    for (const s of [-1, 1]) S.cone(L2(s, 'thigh'), [s * 0.04, 0.2, 0.02], [s * 0.045, 0.12, -0.012], 0.035, 0.018, { k: 0.02, col: c.body, dtl: f });
  },
  paint(v, cfg) {
    const c = cfg.pal;
    v.mix(c.dark, sstep(0.8, 1, v.p[2] * 3) * 0.3 + sstep(0.3, 0.9, v.n[1]) * v.t('body') * 0.15);
    v.mix(c.comb, Math.max(v.t('comb'), v.t('wattle')));
    if (cfg.rooster) v.mix(c.neck, v.t('neck') * 0.8);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    for (const s of [-1, 1]) eye(acc, b('head'), [s * 0.026, 0.405, -0.117], [s, 0.1, -0.3], 0.008, 0xe8a020, { pupilA: 0.4, irisA: 0.9 });
    addHorn(acc, b('head'), [0, 0.395, -0.135], [0, 0.39, -0.155], [0, 0.378, -0.168], 0.012, 0.002, { base: c.beak, tip: c.beak, radial: 5, n: 4 });
    const wc = (u, v) => L3(c.body, c.dark, sstep(0.4, 1, v) * 0.8);
    for (const s of [-1, 1]) featherWing(acc, s, CK.shoulder(s), { chest: b('chest'), w1: b(L2(s, 'wing1')), w2: b(L2(s, 'wing2')) }, { L: CK.wingL, chord: 0.11, tip: 0.1, feathers: 7, scallop: 0.12, cols: wc, nu: 10 });
    if (cfg.rooster) for (let i = 0; i < 4; i++) { // arching sickle tail feathers
      const x = (i - 1.5) * 0.012, a = [x, 0.33, 0.12], m = [x * 1.5, 0.47 + i * 0.012, 0.2 + i * 0.01], e = [x * 2, 0.3 - i * 0.02, 0.3 + i * 0.012];
      acc.add(sweep(bez(a, m, e, 6), taper(6, 0.012, 0.003), { radial: 4, flat: 0.35 }), { skin: rigid(b('tail')), color: (p, n, uv) => lerp3(col(c.sickle), col(0x0a1a18), uv[1]), dtl: [0.2, 0, 0.1, 0] });
    }
    birdLegs(acc, R, CK, c.leg);
  },
  sockets: { head: ['head', [0, 0.46, -0.1]], mouth: ['jaw', [0, 0.38, -0.16]], center: ['spine', [0, 0.25, 0]], back: ['spine', [0, 0.33, 0.02]], chest: ['chest', [0, 0.25, -0.1]] },
  height: 0.46, radius: 0.13,
  controller(inst) { return new BirdCtl(inst, CK_SPEC); },
  get actionList() { return CK_ACTIONS; },
};
const CK_ACTIONS = {
  peck: peck(0.9), flap: flapAct(1.2), look, flee, hit: hitB,
  scratch: { dur: 1.4, a: 0.08, d: 0.85, fn(ctl, a, w) { // two backward rakes with one foot, then a look at the ground
    const P = ctl.pose, b = ctl.b, k = a.k, L = ctl.gait.legs[a.seed > 50 ? 0 : 1];
    const r1 = bell(clamp01(k / 0.3)), r2 = bell(clamp01((k - 0.32) / 0.3)), rk = Math.max(r1, r2);
    const back = Math.max(sstep(0.05, 0.25, k) * (1 - sstep(0.25, 0.3, k)), sstep(0.37, 0.57, k) * (1 - sstep(0.57, 0.62, k)));
    if (!L.override) L.override = new V3();
    L.override.set(L.home.x, 0.03 * rk, L.home.z - 0.04 + 0.1 * back); L.overrideLocal = false; L.overridePaw = -0.4 * rk;
    if (w * rk > L.overrideW) L.overrideW = w * Math.min(1, rk * 1.5);
    P.rx(b.hips, -0.12 * w); P.rx(b.neck, -0.3 * sstep(0.6, 0.8, k) * w); P.rx(b.head, -0.4 * sstep(0.6, 0.8, k) * w);
  } },
  cluck: { dur: 1.2, a: 0.1, d: 0.85, fn(ctl, a, w) { // head bobs with each cluck
    const P = ctl.pose, b = ctl.b, t = a.t, e = bell(a.k), c2 = Math.max(0, Math.sin(t * 16));
    P.move(b.head, 0, 0, -0.015 * c2 * e * w); P.rx(b.head, 0.15 * c2 * e * w); ctl.jaw = Math.max(ctl.jaw, 0.35 * c2 * e * w);
  } },
  crow: { dur: 2.2, a: 0.1, d: 0.85, fn(ctl, a, w) { // (rooster) chest out, head thrown up, beak wide
    const P = ctl.pose, b = ctl.b, t = a.t, e = sstep(0.1, 0.3, a.k) * (1 - sstep(0.8, 1, a.k));
    P.rx(b.spine, 0.2 * e * w); P.rx(b.neck, 0.55 * e * w); P.rx(b.head, 0.35 * e * w); P.sc[b.chest].multiplyScalar(1 + 0.1 * e * w);
    ctl.jaw = Math.max(ctl.jaw, (0.55 + 0.1 * Math.sin(t * 25)) * e * w); ctl.flap = Math.max(ctl.flap, 0.5 * env01(a.k, 0.05, 0.2) * w);
  } },
  jump: { dur: 0.9, a: 0.04, d: 0.9, fn(ctl, a, w) { // flutter-jump (up onto a fence)
    const P = ctl.pose, b = ctl.b, k = a.k, j = Math.sin(clamp01((k - 0.1) / 0.75) * Math.PI);
    P.move(b.hips, 0, 0.35 * j * w, 0); P.rx(b.hips, -0.25 * j * w);
    ctl.flap = Math.max(ctl.flap, sstep(0.05, 0.15, k) * (1 - sstep(0.75, 0.9, k)) * w);
    legsLocal(ctl, j * w, 0.35, 1.0);
  } },
  death: bDeath({ dur: 1.3, dist: 1.0, peak: 0.45, spin: 0.2, lieY: 0.06, pitch: 2.7 }),
  knockback: bKnockback({ dur: 0.7 }),
};
const env01 = (k, a, b) => sstep(0, a, k) * (1 - sstep(1 - b, 1, k));
const CK_SPEC = {
  bones: { hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail'], wingL: ['wing1L', 'wing2L'], wingR: ['wing1R', 'wing2R'] },
  gait: {
    legs: [
      { id: 'L', chain: ['thighL', 'shinL', 'footL'], toe: [-0.045, 0, -0.05], body: 'hips', scap: 0.3, lift: 0.04, flex: 0.6, heel: 0.3 },
      { id: 'R', chain: ['thighR', 'shinR', 'footR'], toe: [0.045, 0, -0.05], body: 'hips', scap: 0.3, lift: 0.04, flex: 0.6, heel: 0.3 },
    ],
    maxStride: 0.15, fMin: 0.8, actV: 0.12,
    gaits: [
      { v: 0.5, f: 2.4, duty: 0.6, lift: 0.9, off: { L: 0, R: 0.5 }, bob: 0.008, bobF: 2, roll: 0.06, rollF: 1, rollPh: 0.25, sway: 0.01, swayF: 1, swayPh: 0.25 },
      { v: 2.5, f: 4.5, duty: 0.4, lift: 1.2, off: { L: 0, R: 0.5 }, bob: 0.015, bobF: 2, roll: 0.05, rollF: 1, rollPh: 0.25 },
    ],
  },
  lean: { walk: 0.1, run: 0.4, combat: 0 }, twist: 0.05, waddle: 0.05, breathe: 0.03,
  bw: { L: CK.wingL, flapF: 7, hoverF: 9, amp: 0.9, mid: 0.2, foldRoll: 1.15, armFold: 0.3, foldOut: 0.03, foldUp: 0.0 },
  flyH: 0.6, flyBob: 0.06, flyLean: 0.4, airPaw: -0.8, bobV: 0.5, bobZ: 0.035,
  fidgets: [{ name: 'peck', w: 4 }, { name: 'scratch', w: 2 }, { name: 'cluck', w: 2 }, { name: 'look', w: 1 }, { name: 'flap', w: 1 }], fidgetGap: 2,
  pose: birdPose(),
  actions: CK_ACTIONS,
};
