// Rift Crystal: the chaos-dungeon objective (a stationary "mob", not a fighter). A geode spray of abyssal crystal spires
// hovering over a cracked basalt plinth carved with a glowing rune ring; a blazing core where the spires meet, three
// satellite shards orbiting. Every shard has its own bone so the cluster can pulse, flinch on hits and SHATTER on death
// (spires fly out on ballistic arcs and tumble, the core flares and dies, satellites drop, the fragments crumble away).
// Variants: violet (default), crimson, azure. ~2.4 m tall. Actions: hit, idle_alt (surge), death (hold), spawn (grows out
// of the ground).
import * as THREE from 'three';
import { BaseCtl, RV, rotA, moveA } from '../ctl.js';
import { rigid } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { orb } from '../parts2.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';

const PAL = {
  violet: { deep: 0x2a0c52, shard: 0x7a36c8, tip: 0xf2c4ff, core: 0xffe0ff, rock: 0x241f2a, rock2: 0x3e3448, glow: 0xc050ff, rune: 0xd070ff },
  crimson: { deep: 0x40080e, shard: 0xb02436, tip: 0xffc4a8, core: 0xfff0d0, rock: 0x261b1b, rock2: 0x42302e, glow: 0xff4030, rune: 0xff6040 },
  azure: { deep: 0x081c48, shard: 0x2a68c8, tip: 0xc8f4ff, core: 0xf0ffff, rock: 0x1b2129, rock2: 0x303c48, glow: 0x40b0ff, rune: 0x60c8ff },
};
const ROOT = [0, 0.78, 0]; // where the spires meet (the core)
// spray shards: [azimuth, elevation-from-vertical, length, radius, start offset from ROOT]; elevation > π/2 hangs below
const SPRAY = [
  [0, 0, 1.52, 0.27, 0.06], [0.3, 0.5, 1.0, 0.18, 0.1], [2.2, 0.55, 0.92, 0.17, 0.1], [4.2, 0.48, 1.05, 0.18, 0.1],
  [1.25, 0.95, 0.66, 0.13, 0.12], [3.3, 0.92, 0.7, 0.13, 0.12], [5.3, 0.88, 0.6, 0.12, 0.12],
  [1.2, 0.3, 1.18, 0.15, 0.08], [3.6, 0.26, 1.25, 0.16, 0.08],
  [0.9, 2.45, 0.46, 0.11, 0.08], [3.0, 2.55, 0.52, 0.12, 0.08], [5.0, 2.5, 0.42, 0.1, 0.08],
];
// plinth crystals growing from the rock (stay put when the cluster shatters): [azimuth, dist, tilt, length, radius]
const ROOTS = [[0.6, 0.52, 0.55, 0.42, 0.09], [2.5, 0.56, 0.6, 0.34, 0.08], [4.4, 0.5, 0.5, 0.48, 0.1], [5.6, 0.6, 0.7, 0.26, 0.06]];
// satellites: [radius, height, phase, length, r]
const ORBIT = [[0.95, 1.25, 0, 0.34, 0.07], [0.85, 1.7, 2.1, 0.28, 0.06], [1.05, 0.95, 4.2, 0.3, 0.06]];

const dirOf = (az, el) => [Math.sin(el) * Math.sin(az), Math.cos(el), Math.sin(el) * Math.cos(az)];

// hexagonal crystal: slightly tapered prism + pyramid cap, flat-shaded facets; uv.y = 0 at the base → 1 at the tip
function crystalGeo(h, r, cap = 0.3) {
  const body = h * (1 - cap);
  const g = new THREE.CylinderGeometry(r * 0.8, r, body, 6, 1, true); g.translate(0, body / 2, 0);
  const tip = new THREE.ConeGeometry(r * 0.8, h * cap, 6, 1, true); tip.translate(0, body + h * cap / 2, 0);
  const pos = [...g.toNonIndexed().attributes.position.array, ...tip.toNonIndexed().attributes.position.array];
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(0, pos[i + 1] / h);
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.dispose(); tip.dispose();
  return out;
}
const upTo = (d) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d).normalize());

function addShard(acc, bone, base, d, len, r, c, emisTip, spin = 0) {
  const q = upTo(d); if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...base), q, new THREE.Vector3(1, 1, 1));
  const c0 = col(c.deep), c1 = col(c.shard), c2 = col(c.tip);
  acc.add(crystalGeo(len, r), {
    matrix: m, skin: rigid(bone), dtl: [0, 0, 0.05, 0],
    color: (p, n, uv) => uv[1] < 0.55 ? lerp3(c0, c1, sstep(0, 0.55, uv[1])) : lerp3(c1, c2, sstep(0.55, 1, uv[1])),
    emis: (p, uv) => 0.06 + emisTip * sstep(0.5, 1, uv[1]) ** 1.5,
  });
}

export const rift_crystal = {
  name: 'Rift Crystal',
  variants: ['violet', 'crimson', 'azure'],
  config(variant) {
    const v = PAL[variant] ? variant : 'violet';
    return { variant: v, pal: PAL[v], shapeKey: 'base', h: 0.055, sphereMul: 1.25, grad: { top: 0.1, bottom: 0.3, y0: 0, y1: 0.3, low: 0.2 },
      mat: { dfreq: 3, rim: 0.4, rimColor: PAL[v].tip, spec: 0.45, shine: 40, dissolveCol: PAL[v].glow } };
  },
  rig(R) {
    R.add('base', null, [0, 0, 0]);
    R.add('cluster', 'base', ROOT);
    R.add('core', 'cluster', ROOT);
    SPRAY.forEach((s, i) => { const d = dirOf(s[0], s[1]); R.add('s' + i, 'cluster', [ROOT[0] + d[0] * s[4], ROOT[1] + d[1] * s[4], ROOT[2] + d[2] * s[4]]); });
    ORBIT.forEach((o, i) => R.add('o' + i, 'cluster', [Math.sin(o[2]) * o[0], o[1], Math.cos(o[2]) * o[0]]));
  },
  sculpt(S, cfg) { // cracked basalt plinth: a low domed disc ringed by tumbled blocks
    const c = cfg.pal, rk = { k: 0.1, col: c.rock, tag: 'rock', dtl: [0, 0.35, 0.5, 0] };
    S.ell('base', [0, 0.06, 0], [0.8, 0.14, 0.76], rk);
    S.ell('base', [0, 0.17, 0], [0.56, 0.12, 0.54], { ...rk, k: 0.14 });
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + 0.35, rr = 0.72 + 0.06 * Math.sin(i * 2.7);
      S.box('base', [Math.sin(a) * rr, 0.08 + 0.03 * Math.cos(i * 1.9), Math.cos(a) * rr], [0.17, 0.11 + 0.03 * Math.sin(i * 3.1), 0.13], 0.04,
        { k: 0.06, col: c.rock2, tag: 'rock', rot: [0.25 * Math.sin(i), a, 0.3 * Math.cos(i * 1.3)], dtl: [0, 0.35, 0.5, 0] });
    }
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, , z] = v.p, r = Math.hypot(x, z), a = Math.atan2(x, z);
    v.mix(c.rock2, sstep(0.6, 0.95, v.n[1]) * 0.25);
    if (v.n[1] < 0.3) return;
    // a broken rune ring on the dome + four wandering cracks that bleed rift light (wide enough for the voxel size)
    const ring = Math.abs(r - 0.42) < 0.05 && Math.sin(a * 7 + 0.5) > -0.55;
    let crack = false;
    for (let i = 0; i < 4; i++) { const ca = 0.3 + i * 1.62 + 0.18 * Math.sin(r * 9 + i); if (r > 0.2 && r < 0.95 && r * Math.abs(Math.sin(a - ca)) < 0.038 * (1.2 - r * 0.6) && Math.cos(a - ca) > 0) crack = true; }
    if (ring) { v.mix(c.rune, 0.95); v.emis = 1.7; } else if (crack) { v.mix(c.rune, 0.8); v.emis = 1.2; }
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    SPRAY.forEach((s, i) => {
      const d = dirOf(s[0], s[1]), base = [ROOT[0] + d[0] * s[4], ROOT[1] + d[1] * s[4], ROOT[2] + d[2] * s[4]];
      addShard(acc, b('s' + i), base, d, s[2], s[3], c, i === 0 ? 1.9 : 1.5, i * 0.7);
    });
    ROOTS.forEach(([az, dist, tilt, len, r], i) => {
      const d = dirOf(az, tilt), base = [Math.sin(az) * dist, 0.12, Math.cos(az) * dist];
      addShard(acc, b('base'), base, d, len, r, c, 1.1, i);
    });
    ORBIT.forEach((o, i) => {
      const p = [Math.sin(o[2]) * o[0], o[1], Math.cos(o[2]) * o[0]];
      // a bipyramid centred on its bone: two crystals base to base
      addShard(acc, b('o' + i), p, [0, 1, 0], o[3] * 0.6, o[4], c, 1.4, i);
      addShard(acc, b('o' + i), p, [0, -1, 0], o[3] * 0.4, o[4], c, 1.0, i);
    });
    orb(acc, ROOT, 0.15, rigid(b('core')), c.core, 5, 2);
  },
  sockets: {
    head: ['cluster', [0, 2.35, 0]], mouth: ['core', [0, ROOT[1], -0.18]], center: ['core', ROOT], chest: ['core', ROOT],
    back: ['cluster', [0, 1.3, 0.2]], top: ['s0', [0, 2.3, 0]], ground: ['base', [0, 0.2, 0]],
  },
  height: 2.4, radius: 0.85,
  controller(inst) { return new CrystalCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ---------------------------------------------------------------------------------------------------------- actions
const ACTIONS = {
  hit: { dur: 0.4, a: 0.02, d: 0.45, fn(ctl, a, w) { const j = Math.sin(clamp01(a.k * 1.4) * Math.PI) * w; if (j > ctl.shake) ctl.shake = j; } },
  idle_alt: { dur: 1.8, a: 0.2, d: 0.7, fn(ctl, a, w) { const s = Math.sin(a.k * Math.PI) * w; if (s > ctl.surge) ctl.surge = s; } },
  death: { dur: 2.0, hold: true, excl: true, state: true, fadeIn: 0.01, fn(ctl, a, w) { const t = a.t * w; if (t > ctl.burst) ctl.burst = t; } },
  spawn: { dur: 1.4, a: 0.001, d: 0.92, state: true, excl: true, fn(ctl, a, w) { const g = mix(1, a.k, w); if (g < ctl.grow) ctl.grow = g; } },
};
const SPEC = { bones: {}, actions: ACTIONS, fidgets: [{ name: 'idle_alt', w: 1 }], fidgetGap: 4, chargeK: 0.35 };
const EMPTY_STATE = {};

class CrystalCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    this.gait = null; this.shake = 0; this.surge = 0; this.burst = 0; this.grow = 1; this.yaw = Math.random() * TAU; this.orbT = Math.random() * 10;
    const P = this.pose;
    this.bBase = P.b.base; this.bCl = P.b.cluster; this.bCore = P.b.core;
    this.si = new Int32Array(SPRAY.map((_, i) => P.b['s' + i])); this.oi = new Int32Array(ORBIT.map((_, i) => P.b['o' + i]));
    // per-shard shatter flight: outward speed along the spire's azimuth, launch speed up, tumble rate (deterministic per shard)
    const n = SPRAY.length, f = this.fl = new Float64Array(n * 4);
    for (let i = 0; i < n; i++) {
      const s = SPRAY[i], d = dirOf(s[0], s[1]), h = Math.hypot(d[0], d[2]) || 1, j = Math.sin(i * 12.9898 + (inst.seed || 0) * 7.1) * 0.5;
      const sp = i === 0 ? 0.6 : 1.6 + 0.8 * Math.abs(j);
      f[i * 4] = (i === 0 ? Math.sin(1 + j) : d[0] / h) * sp; f[i * 4 + 1] = (i === 0 ? Math.cos(1 + j) : d[2] / h) * sp;
      f[i * 4 + 2] = s[1] > 1.5 ? 0.6 : 2.2 + 1.2 * Math.abs(j); f[i * 4 + 3] = (j < 0 ? -1 : 1) * (5 + 6 * Math.abs(j));
    }
  }
  update(dt, state = EMPTY_STATE) {
    dt = Math.min(dt, 0.1);
    const P = this.pose;
    this.t += dt; this.dt = dt;
    this._stateS(state);
    P.reset();
    this.shake = 0; this.surge = 0; this.burst = 0; this.grow = 1; this.glow = 1;
    this._idleW = 1; this._fidgetS();
    this.acts.apply();
    const t = this.t, bt = this.burst, alive = bt <= 0 ? 1 : 0, sh = this.shake, su = this.surge;
    // cluster: slow turn (frozen once shattered), bob, hit shudder
    this.yaw += dt * (0.18 + 0.5 * su) * alive;
    this.orbT += dt * (1 + 1.5 * su) * (alive ? 1 : 0.3);
    RV[0] = Math.sin(t * 37) * 0.07 * sh; RV[1] = this.yaw; RV[2] = Math.cos(t * 43) * 0.07 * sh; rotA(P.lq[this.bCl]);
    RV[0] = Math.sin(t * 51) * 0.03 * sh; RV[1] = (0.05 * Math.sin(t * 1.4) + 0.08 * su - 0.04 * sh) * alive; RV[2] = 0; moveA(P.lt[this.bCl]);
    // core pulse; swells on surge / hit; flares then implodes when shattered
    let cs = 1 + 0.07 * Math.sin(t * 3.3) + 0.35 * su + 0.3 * sh;
    if (bt > 0) cs = bt < 0.18 ? 1 + 2.2 * (bt / 0.18) : Math.max(0, 3.2 * (1 - (bt - 0.18) / 0.25));
    // spires breathe apart a little on surge (translate along their own axis) and shiver on hits
    const n = this.si.length, f = this.fl;
    for (let i = 0; i < n; i++) {
      const bi = this.si[i], s = SPRAY[i];
      if (bt <= 0) {
        const push = 0.05 * su + 0.02 * sh * Math.sin(t * 60 + i);
        const se = Math.sin(s[1]);
        RV[0] = se * Math.sin(s[0]) * push; RV[1] = Math.cos(s[1]) * push; RV[2] = se * Math.cos(s[0]) * push; moveA(P.lt[bi]);
      } else {
        // ballistic flight in cluster space (the cluster stops turning), then lie still and crumble
        const ft = Math.min(bt, 0.85), rest = P.rest[bi].y;
        const y = f[i * 4 + 2] * ft - 5.2 * ft * ft;
        RV[0] = f[i * 4] * ft; RV[1] = Math.max(0.04 - rest, y); RV[2] = f[i * 4 + 1] * ft; moveA(P.lt[bi]);
        const tum = f[i * 4 + 3] * Math.min(bt, 0.7);
        RV[0] = tum; RV[1] = 0; RV[2] = tum * 0.55; rotA(P.lq[bi]);
      }
      const g = this.grow < 1 ? sstep(0.12 + 0.045 * i, 0.55 + 0.045 * i, this.grow) : 1;
      const k = g * (bt > 1.1 ? Math.max(0, 1 - (bt - 1.1) / 0.8) : 1), sc = P.sc[bi]; sc.x = k; sc.y = k; sc.z = k;
    }
    // satellites orbit (and wobble); once shattered they drop to the ground and fade out
    for (let i = 0; i < this.oi.length; i++) {
      const bi = this.oi[i], o = ORBIT[i], r = o[0], a = this.orbT * (0.45 + 0.12 * i) + o[2];
      const x0 = Math.sin(o[2]) * r, z0 = Math.cos(o[2]) * r;
      const fall = bt > 0 ? Math.min(1, bt * 1.6) : 0, drop = (o[1] - 0.1) * fall * fall;
      RV[0] = Math.sin(a) * r * (1 + 0.1 * su) - x0; RV[1] = Math.sin(t * 1.3 + i * 2) * 0.1 + 0.15 * su - drop; RV[2] = Math.cos(a) * r * (1 + 0.1 * su) - z0; moveA(P.lt[bi]);
      RV[0] = 0.3 * Math.sin(t + i); RV[1] = t * (1.2 + 0.4 * i); RV[2] = 0.35 + 1.4 * fall; rotA(P.lq[bi]);
      const g = this.grow < 1 ? sstep(0.6, 0.95, this.grow) : 1;
      const k = g * (bt > 0.9 ? Math.max(0, 1 - (bt - 0.9) / 0.6) : 1), sc = P.sc[bi]; sc.x = k; sc.y = k; sc.z = k;
    }
    // spawn: the plinth heaves up out of the ground, the core sparks first, then the spires grow out of it
    if (this.grow < 1) {
      const g = this.grow;
      RV[0] = 0; RV[1] = -0.35 * (1 - sstep(0, 0.3, g)); RV[2] = 0; moveA(P.lt[this.bBase]);
      const bs = mix(0.6, 1, sstep(0, 0.3, g)), s0 = P.sc[this.bBase]; s0.x = bs; s0.y = bs; s0.z = bs;
      cs *= sstep(0.02, 0.25, g) * (1 + 0.35 * Math.sin(Math.PI * sstep(0.05, 0.6, g)));
      this.glow = 1 + 0.6 * (1 - g);
    }
    { const c = P.sc[this.bCore]; c.x = cs; c.y = cs; c.z = cs; }
    // emissive: breathing, surge / hit flares, white flash at the shatter then dark husk
    let gl = this.glow * (1 + 0.12 * Math.sin(t * 2.3)) + 0.9 * su + 1.2 * sh;
    if (bt > 0) gl = bt < 0.15 ? mix(gl, 4, bt / 0.15) : mix(4, 0.12, clamp01((bt - 0.15) / 0.5));
    this.glow = gl; this.charge = 0.8 * sh + 0.5 * su;
    P.fk();
    P.apply(this.inst.bones);
    this._uniforms();
  }
}
