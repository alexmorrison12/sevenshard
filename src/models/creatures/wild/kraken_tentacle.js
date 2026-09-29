// Kraken tentacle — one giant arm (~7.3 m above the water, ~2 m more below) for sailing / sea-bounty encounters. The root
// sits ON the waterline (y = 0); spawn several around a ship for a kraken attack. Tapering, slightly flattened arm with a
// curling tip, two zig-zag rows of cupped suckers along the inner (−Z, toward the target) side, mottled skin with a pale
// underside, wet sheen. Variants: crimson (default), violet, lumen (bioluminescent: glowing rings & sucker rims);
// elite: elder (×1.35, barnacle-crusted, hooked suckers, ember spots).
// Rig: a 15-bone FK chain (t0 deep under water … t14 at the tip), smooth analytic B-spline skinning. Procedural idle:
// travelling curl waves + a breathing hooked tip. Actions steer per-bone curl / side / twist angles and the base offset.
// Sockets: head (top), mouth & tip (tip end), grip (inside the curled tip — attach a grabbed hero between the grab hits),
// center (mid-arm hit point), back, base (waterline splash).
import * as THREE from 'three';
import { BaseCtl } from '../ctl.js';
import { rigid, sweep, aim } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addHorn, lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { loftZ, chainSkin, V3 } from './common.js';

const PAL = {
  crimson: { skin: 0x8e2446, dark: 0x4a0e28, light: 0xc05a6a, belly: 0xdca494, sucker: 0xecc8b8, cup: 0x9a4050, tip: 0x5a1430, glow: 0x000000, glowEm: 0, spec: 0.35 },
  violet: { skin: 0x5a2a7a, dark: 0x2a0e44, light: 0x9a62b0, belly: 0xd4aac6, sucker: 0xe6cade, cup: 0x7a3a6e, tip: 0x2e1446, glow: 0x000000, glowEm: 0, spec: 0.35 },
  lumen: { skin: 0x1e1a48, dark: 0x0c0a24, light: 0x3a3c7a, belly: 0x565c94, sucker: 0x7ae0f4, cup: 0x1e2a5a, tip: 0x0e0c28, glow: 0x5ff0ff, glowEm: 1.3, spec: 0.4 },
  elder: { skin: 0x3a1a26, dark: 0x160810, light: 0x6a3440, belly: 0xa88a7e, sucker: 0xc8b098, cup: 0x5a2222, tip: 0x12060a, glow: 0xff7a2a, glowEm: 1.4, spec: 0.3 },
};

// rest pose: straight up the +Y axis; chain joints (y) and the radius profile
const TY = [-2.2, -1.25, -0.35, 0.55, 1.4, 2.2, 2.95, 3.65, 4.3, 4.9, 5.45, 5.95, 6.4, 6.8, 7.12];
const TIP_Y = 7.34;
const TN = TY.map((_, i) => 't' + i);
const RK = [[-2.3, 0.8], [0, 0.72], [2, 0.58], [4, 0.41], [5.5, 0.27], [6.5, 0.15], [7.1, 0.07], [TIP_Y, 0.012]];
function rAt(y) {
  if (y <= RK[0][0]) return RK[0][1];
  for (let i = 1; i < RK.length; i++) if (y <= RK[i][0]) { const u = (y - RK[i - 1][0]) / (RK[i][0] - RK[i - 1][0]); return mix(RK[i - 1][1], RK[i][1], u); }
  return RK[RK.length - 1][1];
}
const FRONT = 0.8; // sucker side (−Z) is flatter
const hsh = (i) => { const q = Math.sin(i * 127.1 + 311.7) * 43758.5453; return q - Math.floor(q); };
// elder: sparse small ember dots in two rows along the flanks
const emberSpot = (y, a) => { const k = Math.round((y - 0.2) / 0.55), yc = 0.2 + k * 0.55, ac = (k % 2 ? 1 : -1) * 1.75; return (1 - sstep(0.05, 0.1, Math.hypot(y - yc, (a - ac) * 0.35))) * sstep(-0.2, 0.3, y) * (1 - sstep(5.8, 6.6, y)); };

export const kraken_tentacle = {
  name: 'Kraken Tentacle',
  variants: ['crimson', 'violet', 'lumen', 'elder'],
  config(variant, opts = {}) {
    const v = PAL[variant] ? variant : (opts.elite ? 'elder' : 'crimson');
    const elite = v === 'elder' || !!opts.elite;
    return {
      variant: v, pal: PAL[v === 'crimson' && elite ? 'elder' : v], elite, scale: elite ? 1.35 : 1, castShadow: true, sphereMul: 2.2,
      mat: { dfreq: 1.1, rim: 0.22, rimColor: 0xffd8e8, spec: PAL[v].spec, shine: 30, wrap: 0.5 },
    };
  },
  rig(R) { for (let i = 0; i < TY.length; i++) R.add(TN[i], i ? TN[i - 1] : null, [0, TY[i], 0]); },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, E = cfg.elite;
    const idx = TN.map(n => R.index(n));
    const skin = (y) => chainSkin(TY, idx, y);
    const cSkin = col(c.skin), cDark = col(c.dark), cLight = col(c.light), cBelly = col(c.belly), cTip = col(c.tip), cGlow = col(c.glow);
    // ================================================================= arm: loft along Z, rotated so +Z → +Y and the loft's top (+Y) → front (−Z)
    const rings = [];
    for (let y = -2.3; y < TIP_Y; y += y < 4 ? 0.13 : 0.1) { const r = rAt(y); rings.push({ z: y, rx: r, ry: r * FRONT, ryB: r }); }
    rings.push({ z: TIP_Y, rx: 0, ry: 0 });
    const tube = loftZ(rings, 20);
    const M = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    const mottle = (y, a) => {
      const m1 = Math.sin(y * 4.3 + Math.sin(a * 3.0 + y * 1.3) * 1.4) * Math.sin(a * 3.7 - y * 2.1);
      const m2 = Math.sin(y * 9.7 + a * 5.3 + Math.sin(y * 3.1) * 2.0);
      return { blot: sstep(0.25, 0.6, m1), speck: sstep(0.82, 0.95, m2) };
    };
    const ringGlow = (y, front) => { // lumen: glowing bands of dots along the flanks
      if (!c.glowEm) return 0;
      const k = Math.round((y - 0.3) / 0.42), yc = 0.3 + k * 0.42;
      return (1 - sstep(0.04, 0.11, Math.abs(y - yc))) * sstep(0.2, 0.5, Math.abs(front)) * (1 - sstep(0.85, 1, Math.abs(front))) * sstep(-0.2, 0.3, y) * (1 - sstep(6.6, 7.1, y));
    };
    acc.add(tube, {
      matrix: M, skin: (p) => skin(p.y), dtl: [0.04, 0.05, 0.5, 0],
      color: (p, n) => {
        const y = p.y, r = Math.max(1e-3, rAt(y));
        const a = Math.atan2(p.x / r, -p.z / r); // 0 = front (sucker side), ±π = back
        const front = Math.cos(a), belly = sstep(0.35, 0.75, front);
        const { blot, speck } = mottle(y, a);
        let cc = lerp3(cSkin, cDark, blot * 0.6 * (1 - belly));
        cc = lerp3(cc, cLight, speck * 0.5 * (1 - belly));
        cc = lerp3(cc, cDark, sstep(-0.3, -0.95, front) * 0.25); // darker spine line
        cc = lerp3(cc, cBelly, belly);
        cc = lerp3(cc, cTip, sstep(5.8, 7.2, y) * (1 - belly * 0.6));
        const g = ringGlow(y, front);
        if (g > 0) cc = lerp3(cc, cGlow, g);
        if (E) cc = lerp3(cc, cGlow, emberSpot(y, a) * (1 - belly) * 0.85);
        return cc;
      },
      emis: (p) => {
        if (!c.glowEm) return 0;
        const y = p.y, r = Math.max(1e-3, rAt(y)), a = Math.atan2(p.x / r, -p.z / r), front = Math.cos(a);
        let g = ringGlow(y, front);
        if (E) g = Math.max(g, emberSpot(y, a) * (1 - sstep(0.35, 0.75, front)));
        return g * c.glowEm;
      },
    });
    // ================================================================= suckers: lathe cups in two zig-zag rows on the front
    // profile from the skin base inward (outward-facing winding): outer wall → lip → inner wall → recessed floor
    const prof = [[1.25, -0.14], [1.18, 0.12], [1.02, 0.34], [0.84, 0.36], [0.66, 0.12], [0.34, 0.02], [0, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
    const cupG = new THREE.LatheGeometry(prof, 8); cupG.rotateX(Math.PI / 2); // axis → +Z
    const cS = col(c.sucker), cC = col(c.cup);
    let y = 0.15, row = 0, n = 0;
    while (y < 7.0) {
      const r = rAt(y), rs = Math.max(0.028, r * 0.3);
      const ang = (row ? 1 : -1) * 0.42; // ± around the front centre
      const px = Math.sin(ang) * r, pz = -Math.cos(ang) * r * FRONT;
      const nrm = new V3(Math.sin(ang), 0, -Math.cos(ang) / FRONT).normalize();
      const m = aim([px - nrm.x * rs * 0.1, y, pz - nrm.z * rs * 0.1], [nrm.x, nrm.y, nrm.z], [0, 1, 0], [rs, rs, rs * 1.15]);
      const sk = skin(y);
      acc.add(cupG, {
        matrix: m, skin: sk, dtl: [0, 0.05, 0.2, 0],
        color: (p, nn, uv) => lerp3(cS, cC, sstep(0.45, 0.75, uv[1])),
        emis: (p, uv) => c.glowEm ? c.glowEm * 0.8 * (1 - sstep(0.4, 0.55, uv[1])) * sstep(0.15, 0.3, uv[1]) : 0,
      });
      if (E && rs > 0.07) addHorn(acc, sk, [px + nrm.x * rs * 0.2, y, pz + nrm.z * rs * 0.2], [px + nrm.x * rs * 0.9, y + rs * 0.3, pz + nrm.z * rs * 0.9], [px + nrm.x * rs * 1.0, y - rs * 0.3, pz + nrm.z * rs * 1.1], rs * 0.28, 0.004, { base: 0x2a1a14, tip: 0xe8dcc8, radial: 4, n: 4 });
      y += rs * 1.25; row ^= 1; n++;
    }
    // ================================================================= elder: barnacle crust on the back
    if (E) for (let i = 0; i < 26; i++) {
      const by = -0.1 + hsh(i) * 5.2, r = rAt(by), a = Math.PI + (hsh(i + 50) - 0.5) * 2.4;
      const nx = Math.sin(a), nz = -Math.cos(a), sz = 0.05 + hsh(i + 9) * 0.07;
      const g = new THREE.CylinderGeometry(sz * 0.45, sz, sz * 1.1, 6, 1, false); g.rotateX(Math.PI / 2);
      acc.add(g, { matrix: aim([nx * r * 0.98, by, nz * r * 0.98], [nx, 0.15, nz], [0, 1, 0], 1), skin: skin(by), color: (p, nn) => lerp3(col(0xb8ac98), col(0x5a4a3a), sstep(0.2, -0.6, nn.y)), dtl: [0, 0.4, 0.3, 0] });
    }
  },
  sockets: {
    head: ['t13', [0, 7.25, 0]], mouth: ['t14', [0, TIP_Y, 0]], tip: ['t14', [0, TIP_Y, 0]], grip: ['t11', [0, 6.1, -0.42]],
    center: ['t6', [0, 2.95, 0]], chest: ['t5', [0, 2.2, -0.35]], back: ['t5', [0, 2.2, 0.45]], base: ['t2', [0, 0, 0]],
  },
  height: 7.3, radius: 0.9,
  controller(inst) { return new TentacleCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ================================================================================================ controller
const NB = TY.length;
export class TentacleCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = null;
    this.ch = TN.map(n => this.pose.b[n]);
    this.cx = new Float32Array(NB); this.cy = new Float32Array(NB); this.cz = new Float32Array(NB);
    this.bx = 0; this.by = 0; this.bz = 0; this.ph = Math.random() * 10; this.sw = Math.random() * 10;
    this.side = Math.random() < 0.5 ? -1 : 1;
  }
  play(name, dur, loop) { if (name === 'emerge') name = 'spawn'; return super.play(name, dur, loop); }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose;
    this.t += dt;
    this._state(state, dt);
    this.speedSm += (this._speed - this.speedSm) * (1 - Math.exp(-2 * dt));
    this.turnSm += (this._turn - this.turnSm) * (1 - Math.exp(-2 * dt));
    P.reset();
    // ---- idle: gentle S, travelling curl waves, a breathing hooked tip; combat → coiled forward, restless
    const t = this.t, cb = this.combat, cx = this.cx, cy = this.cy, cz = this.cz;
    this.ph += dt * (1.1 + 0.8 * cb); this.sw += dt * (0.55 + 0.3 * cb);
    const breathe = 0.5 + 0.5 * Math.sin(t * 0.9);
    for (let i = 0; i < NB; i++) {
      const f = i / (NB - 1);
      const amp = mix(0.03, 0.2, f * f) * (1 + 0.4 * cb);
      cx[i] = (i < 2 ? 0.05 : i < 5 ? 0.09 : i < 9 ? -0.1 : -(0.26 + 0.16 * breathe + 0.1 * cb) * Math.min(1.6, (i - 7) / 3)) + amp * Math.sin(this.ph - i * 0.55);
      cz[i] = mix(0.02, 0.1, f) * Math.sin(this.sw - i * 0.4 + 1.3) - this.turnSm * 0.04;
      cy[i] = 0.05 * Math.sin(t * 0.4 + i * 0.2) * f;
    }
    cx[0] += -0.08 * cb - 0.06 * clamp01(this.speedSm / 4);
    this.bx = 0; this.by = 0; this.bz = 0; this.glow = 1;
    this._fidget(dt, 1 - cb);
    this.acts.apply();
    for (let i = 0; i < NB; i++) P.rot(this.ch[i], cx[i], cy[i], cz[i]);
    P.move(this.ch[0], this.bx, this.by, this.bz);
    P.fk();
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

// ================================================================================================ actions
const env2 = (k, a, b, c, d) => sstep(a, b, k) * (1 - sstep(c, d, k));
const sideOf = (ctl, a) => (a.u.side ?? (a.u.side = ctl.side * (Math.sin(a.seed * 7.13) > -0.6 ? 1 : -1)));
/** blend every bone's curl toward target(i) with weight w */
function toCurl(ctl, w, fx, fz, fy) {
  for (let i = 0; i < NB; i++) {
    if (fx) ctl.cx[i] = mix(ctl.cx[i], fx(i, i / (NB - 1)), w);
    if (fz) ctl.cz[i] = mix(ctl.cz[i], fz(i, i / (NB - 1)), w);
    if (fy) ctl.cy[i] = mix(ctl.cy[i], fy(i, i / (NB - 1)), w);
  }
}
const ACTIONS = {
  attack: { dur: 1.6, a: 0.06, d: 0.86, hit: 0.52, fn(ctl, a, w) { // cock back to one side → horizontal sweep across the deck
    const k = a.k, s = sideOf(ctl, a);
    const cock = env2(k, 0, 0.32, 0.34, 0.44), sweepK = sstep(0.36, 0.62, k), rec = 1 - sstep(0.66, 1, k);
    const yaw = (1.15 * cock - 1.25 * sweepK * rec) * s;
    const vel = env2(k, 0.36, 0.45, 0.55, 0.64); // fast phase → whip lag
    const low = sstep(0.2, 0.42, k) * rec;
    toCurl(ctl, w * Math.max(cock, low),
      (i, f) => i === 0 ? -0.95 * low - 0.3 * cock : i < 5 ? 0.05 : i < 10 ? -0.1 * low + 0.12 * cock : -0.14 - 0.08 * cock,
      (i, f) => i === 0 ? 0 : s * vel * 0.16 * f * 2 - s * cock * 0.06 * f,
      (i) => i === 0 ? yaw : 0);
    ctl.cy[0] = mix(ctl.cy[0], yaw, w);
    ctl.by += 0.5 * low * w;
  } },
  attack_big: { dur: 3.2, a: 0.04, d: 0.9, hit: 0.68, fn(ctl, a, w) { // rises very high, coils back (telegraph) → slams down onto the deck
    const k = a.k, t = a.t;
    const rise = env2(k, 0, 0.28, 0.6, 0.66), trem = env2(k, 0.3, 0.36, 0.58, 0.62) * Math.sin(t * 38) * 0.05;
    const slam = env2(k, 0.6, 0.68, 0.84, 0.98), quiver = env2(k, 0.68, 0.7, 0.8, 0.86) * Math.sin(t * 30) * 0.04;
    toCurl(ctl, w * rise, (i, f) => i === 0 ? 0.22 + trem : i < 7 ? 0.02 : 0.42 + trem * 2, (i, f) => trem * f);
    toCurl(ctl, w * slam, (i, f) => i === 0 ? -0.42 : i < 3 ? -0.05 : i < 7 ? -0.36 + quiver : i < 11 ? -0.1 + quiver : -0.05, (i) => 0);
    ctl.by += (1.9 * rise + 1.0 * slam) * w;
    ctl.glow = mix(ctl.glow, 1 + 1.8 * sstep(0.1, 0.55, k) * (1 - sstep(0.62, 0.7, k)), w);
    ctl.charge = Math.max(ctl.charge, sstep(0.2, 0.58, k) * (1 - sstep(0.6, 0.66, k)) * w);
  } },
  grab: { dur: 3.6, a: 0.05, d: 0.9, hit: 0.34, hits: [0.34, 0.86], fn(ctl, a, w) { // reach → curl around the prey → lift, shake → hurl it forward
    const k = a.k, t = a.t;
    const reach = env2(k, 0, 0.24, 0.34, 0.5), wrap = sstep(0.26, 0.36, k) * (1 - sstep(0.84, 0.9, k));
    const lift = env2(k, 0.36, 0.58, 0.82, 0.88), shake = env2(k, 0.6, 0.64, 0.78, 0.82) * Math.sin(t * 16);
    const throwK = env2(k, 0.8, 0.86, 0.9, 1.0);
    toCurl(ctl, w * reach, (i, f) => i === 0 ? -0.62 : i < 5 ? -0.04 : i < 9 ? -0.16 : 0.04);
    toCurl(ctl, w * lift, (i, f) => i === 0 ? 0.12 : i < 9 ? 0.02 : ctl.cx[i]);
    ctl.cz[0] += 0.28 * shake * w; for (let i = 1; i < NB; i++) ctl.cz[i] -= 0.05 * shake * w * (i / NB);
    toCurl(ctl, w * throwK, (i, f) => i === 0 ? -0.55 : i < 9 ? -0.12 : 0.15);
    for (let i = 9; i < NB; i++) ctl.cx[i] = mix(ctl.cx[i], -0.98, wrap * w); // the tip coils into a tight loop around the prey
    ctl.by += 0.4 * lift * w;
  } },
  hit: { dur: 0.5, a: 0.03, d: 0.5, hit: 0, fn(ctl, a, w) {
    const k = a.k, j = sstep(0, 0.1, k) * (1 - sstep(0.2, 1, k)) * w, s = sideOf(ctl, a);
    ctl.cx[0] += 0.22 * j; ctl.cz[0] += 0.12 * s * j;
    for (let i = 8; i < NB; i++) ctl.cx[i] -= 0.28 * j;
    for (let i = 3; i < 8; i++) ctl.cz[i] -= 0.06 * s * j;
  } },
  roar: { dur: 2.0, a: 0.1, d: 0.85, fn(ctl, a, w) { // threat display: rears tall, the tip lashes
    const k = a.k, t = a.t, up = env2(k, 0, 0.2, 0.8, 1);
    toCurl(ctl, w * up, (i, f) => i === 0 ? 0.08 : i < 9 ? 0.0 : -0.2 + Math.sin(t * 14 - i) * 0.35, (i, f) => Math.sin(t * 9 - i * 0.7) * 0.08 * f);
    ctl.by += 1.2 * up * w; ctl.glow = mix(ctl.glow, 1.8, up * w);
  } },
  idle_alt: { dur: 3.0, a: 0.12, d: 0.85, fn(ctl, a, w) { // the tip coils into a tight spiral and unrolls
    const k = a.k, c = env2(k, 0.05, 0.4, 0.55, 0.95);
    for (let i = 8; i < NB; i++) ctl.cx[i] = mix(ctl.cx[i], -0.85 - 0.05 * (i - 8), c * w);
    ctl.cx[0] += 0.08 * c * w;
  } },
  stun: { dur: 2.6, loop: true, state: true, fadeIn: 0.3, fadeOut: 0.4, fn(ctl, a, w) {
    const ph = a.t / 2.6 * TAU;
    toCurl(ctl, w, (i, f) => i === 0 ? -0.35 : i < 8 ? -0.12 : 0.05 * Math.sin(ph - i), (i, f) => i === 0 ? 0.3 * Math.sin(ph) : 0.04 * Math.sin(ph - i * 0.5));
    ctl.by -= 0.5 * w; ctl.glow = mix(ctl.glow, 0.5, w);
  } },
  knockdown: { dur: 1.0, hold: true, excl: true, state: true, fadeIn: 0.05, fadeOut: 0.1, hit: 0, fn(ctl, a, w) { // slaps onto the water, lies twitching
    const k = a.k, t = a.t, s = sideOf(ctl, a), f = sstep(0.05, 0.5, k);
    const tw = Math.pow(Math.max(0, Math.sin(t * 1.3 + a.seed)), 10) * sstep(1.2, 1.6, t) * 0.15;
    toCurl(ctl, w * f, (i, u) => i === 0 ? -1.2 : i < 4 ? -0.18 + tw : 0.03 + 0.04 * Math.sin(t * 2 - i), (i) => i === 0 ? 0.25 * s : 0);
    ctl.by -= 0.4 * f * w;
  } },
  getup: { dur: 1.3, a: 0.001, d: 0.9, state: true, fn(ctl, a, w) {
    const k = a.k, f = 1 - sstep(0.05, 0.95, k), s = sideOf(ctl, a);
    toCurl(ctl, w * f, (i) => i === 0 ? -1.2 : i < 4 ? -0.18 : 0.03, (i) => i === 0 ? 0.25 * s : 0);
    ctl.by -= 0.4 * f * w;
  } },
  death: { dur: 4.0, hold: true, excl: true, state: true, fadeIn: 0.05, keep: true, fn(ctl, a, w) { // writhes, collapses limp across the water, sinks
    const k = a.k, t = a.t, s = sideOf(ctl, a);
    const writhe = env2(k, 0, 0.04, 0.12, 0.2), fall = sstep(0.12, 0.42, k), sink = sstep(0.5, 0.98, k);
    for (let i = 0; i < NB; i++) ctl.cx[i] += Math.sin(t * 13 - i * 0.9) * 0.2 * writhe * w;
    toCurl(ctl, w * fall, (i, f) => i === 0 ? -1.05 : i < 3 ? -0.2 : 0.06 * Math.sin(i * 1.7 + a.seed) + 0.02, (i, f) => i === 0 ? 0.55 * s : 0.03 * Math.sin(i * 2.3));
    ctl.by -= (0.6 * fall + 8.5 * sink) * w;
    ctl.glow = mix(ctl.glow, 0.05, sstep(0.15, 0.6, k) * w);
  } },
  spawn: { dur: 2.2, a: 0.001, d: 0.92, state: true, excl: true, fn(ctl, a, w) { // spirals up out of the sea, the coiled tip unfurling
    const k = a.k, rise = sstep(0.0, 0.55, k), unfurl = sstep(0.3, 0.85, k);
    ctl.by -= 9.6 * (1 - rise) * w;
    ctl.cy[0] += (1 - rise) * 2.4 * w;
    for (let i = 7; i < NB; i++) ctl.cx[i] = mix(ctl.cx[i], -0.9, (1 - unfurl) * w);
    ctl.cx[0] += 0.12 * env2(k, 0.4, 0.55, 0.7, 0.9) * w;
  } },
  submerge: { dur: 1.8, hold: true, excl: true, state: true, fadeIn: 0.05, fadeOut: 0.05, fn(ctl, a, w) { // coils and slides under
    const k = a.k, coil = sstep(0, 0.4, k), down = sstep(0.2, 1, k);
    for (let i = 6; i < NB; i++) ctl.cx[i] = mix(ctl.cx[i], -0.85, coil * w);
    ctl.by -= 9.6 * down * down * w; ctl.cy[0] -= 1.6 * down * w;
  } },
};
ACTIONS.emerge = ACTIONS.spawn; // alias (the controller maps play('emerge') → spawn semantics)

const SPEC = {
  bones: {},
  fidgets: [{ name: 'idle_alt', w: 1 }], fidgetGap: 6,
  chargeK: 0.25,
  actions: ACTIONS,
};
