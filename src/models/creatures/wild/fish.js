// Fish — ambient swimmer (~0.4 m). The root sits ON the water surface (y = 0); the fish swims ~0.35 m below it with a
// travelling body wave down a short spine chain (head · body · sp1 · sp2 · tail), sculling pectoral fins, a breathing
// jaw, and leaps clean out of the water with `jump`. Lofted, laterally compressed body with countershading and species
// patterns, forked tail, dorsal / anal / pelvic / pectoral fins (single sheets, double-sided material).
// Variants: trout (default), koi, reef (blue tang-like), salmon (sockeye red with a green head).
// Actions: jump (leap & dive, lands ~0.6 m ahead), dart (hold: fast flight), nibble (rises to peck at the surface —
// bobbers / bait), flop (loop: stranded on a deck, flopping on its side at the root), hit, death (belly-up at the surface).
import * as THREE from 'three';
import { BaseCtl } from '../ctl.js';
import { rigid } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { lerp3 } from '../../kit/parts.js';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { loftZ, chainSkin, fanSheet, gridSheet, vnoise, hs, V3 } from './common.js';
import { eyeGeo, aim } from '../../kit/geo.js';

const PAL = {
  trout: { back: 0x4e6036, side: 0xb8bca8, belly: 0xece8dc, band: 0xd8807a, spots: 0x1a1a14, fin: 0x8a8a6a, fin2: 0xd89a8a, eye: 0xd8b060 },
  koi: { back: 0xe8e2d6, side: 0xeeeae2, belly: 0xf2eee6, patch: 0xe8561e, spots: 0x16161a, fin: 0xf0e8e0, fin2: 0xf0a080, eye: 0x1a1a1a },
  reef: { back: 0x1e4ed0, side: 0x2a62e8, belly: 0x5a8ae8, stripe: 0x0a0e24, fin: 0x1a3aa0, fin2: 0xf4d020, eye: 0x1a1a1a, tail: 0xf4d020 },
  salmon: { back: 0x9a2020, side: 0xc83026, belly: 0xd8584a, head: 0x3a5a3a, spots: 0x5a1010, fin: 0x6a2a24, fin2: 0x3a5a3a, eye: 0xd8c060 },
};
const Z_BONES = [-0.11, -0.03, 0.04, 0.1, 0.16];
const N_BONES = ['head', 'body', 'sp1', 'sp2', 'tail'];

export const fish = {
  name: 'Fish',
  variants: ['trout', 'koi', 'reef', 'salmon'],
  config(variant) { const v = PAL[variant] ? variant : 'trout'; return { variant: v, pal: PAL[v], scale: v === 'koi' ? 1.1 : v === 'reef' ? 0.8 : 1, mat: { dfreq: 14, rim: 0.3, spec: 0.5, shine: 50, wrap: 0.5 }, castShadow: false }; },
  rig(R) {
    R.add('body', null, [0, 0, Z_BONES[1]]);
    R.add('head', 'body', [0, 0, Z_BONES[0]]); R.add('jaw', 'head', [0, -0.012, -0.17]);
    R.add('sp1', 'body', [0, 0, Z_BONES[2]]); R.add('sp2', 'sp1', [0, 0, Z_BONES[3]]); R.add('tail', 'sp2', [0, 0, Z_BONES[4]]);
    R.add('finL', 'head', [-0.02, -0.02, -0.1]); R.add('finR', 'head', [0.02, -0.02, -0.1]);
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n), v = cfg.variant;
    const idx = N_BONES.map(n => b(n));
    // ---- body: laterally compressed loft, snout → peduncle
    const prof = [[-0.205, 0, 0], [-0.198, 0.012, 0.014], [-0.185, 0.02, 0.026], [-0.165, 0.027, 0.036], [-0.14, 0.032, 0.043], [-0.11, 0.035, 0.047], [-0.07, 0.036, 0.048],
      [-0.03, 0.034, 0.046], [0.01, 0.03, 0.041], [0.05, 0.024, 0.033], [0.09, 0.017, 0.024], [0.125, 0.011, 0.016], [0.15, 0.008, 0.012], [0.168, 0.007, 0.011], [0.176, 0, 0]];
    const rings = prof.map(([z, rx, ry]) => ({ z, y: 0, rx: rx * (v === 'reef' ? 0.8 : 1), ry: ry * (v === 'reef' ? 1.45 : 1), ryB: ry * (v === 'reef' ? 1.35 : 0.95) }));
    const cBack = col(c.back), cSide = col(c.side), cBelly = col(c.belly);
    acc.add(loftZ(rings, 12), {
      skin: (p) => { // lower snout rides the jaw
        const t = sstep(-0.16, -0.176, p.z) * sstep(-0.001, -0.006, p.y);
        return t > 0.02 ? { si: [b('jaw'), b('head'), 0, 0], sw: [t, 1 - t, 0, 0] } : chainSkin(Z_BONES, idx, p.z);
      },
      dtl: [0, 0.35, 0.2, 0],
      color: (p, n) => {
        const up = n.y, z = p.z, y = p.y;
        let cc = lerp3(cSide, cBack, sstep(0.05, 0.6, up));
        cc = lerp3(cc, cBelly, sstep(-0.2, -0.7, up));
        if (v === 'trout') {
          cc = lerp3(cc, col(c.band), (1 - sstep(0.004, 0.012, Math.abs(y - 0.002))) * sstep(-0.16, -0.1, z) * 0.7);
          const sp = hs(Math.floor(z * 90) * 7.3 + Math.floor(y * 90) * 3.1 + (p.x > 0 ? 1 : 0));
          cc = lerp3(cc, col(c.spots), (sp > 0.8 ? 1 : 0) * sstep(-0.1, 0.4, up) * 0.85);
        } else if (v === 'koi') {
          const bl = vnoise(z * 22 + 3, 1) + vnoise(z * 9 + p.x * 40, 2) * 0.6 + up * 0.5;
          cc = lerp3(cc, col(c.patch), sstep(0.25, 0.4, bl) * sstep(-0.3, 0.2, up));
          cc = lerp3(cc, col(c.spots), sstep(0.62, 0.7, vnoise(z * 31 + 7, 3) + p.x * 8) * sstep(0.2, 0.6, up) * 0.9);
        } else if (v === 'reef') {
          const sw = Math.abs(y - (0.012 - (z + 0.06) * 0.25)) < 0.009 && z > -0.13 && z < 0.08 ? 1 : 0;
          cc = lerp3(cc, col(c.stripe), sw * 0.9 * sstep(-0.3, 0.3, Math.abs(n.x)));
          cc = lerp3(cc, col(c.tail), sstep(0.13, 0.15, z));
        } else if (v === 'salmon') {
          cc = lerp3(cc, col(c.head), sstep(-0.11, -0.13, z));
          cc = lerp3(cc, col(c.spots), (hs(Math.floor(z * 70) * 5.1 + Math.floor(y * 70) * 2.7) > 0.85 ? 1 : 0) * sstep(0.2, 0.6, up) * 0.6);
        }
        // gill line & mouth line
        cc = lerp3(cc, cBack, (1 - sstep(0.002, 0.006, Math.abs(z + 0.12 + y * 0.3))) * sstep(-0.9, -0.1, up) * (1 - sstep(0.02, 0.03, Math.abs(y))) * 0.5);
        return cc;
      },
    });
    // ---- eyes
    for (const s of [-1, 1]) {
      const g = eyeGeo(0.0085, [{ a: 0.5, c: 0 }, { a: 0.95, c: 1 }], 8, 1.5);
      const pc = col(0x060606), ic = col(c.eye);
      acc.add(g, { matrix: aim([s * 0.021, 0.008, -0.168], [s, 0.12, -0.25], [0, 1, 0], 1), skin: rigid(b('head')), dtl: [0, 0, 0, 0], color: (p, n, uv) => uv[0] === 0 ? pc : ic, emis: (p, uv) => uv[0] === 1 ? 0.08 : 0 });
    }
    // ---- fins (single sheets). finCol: base → tip, with ray lines
    const cf = col(c.fin), cf2 = col(c.fin2);
    const finC = (f, t, m) => { const j = t * (m - 1); return lerp3(lerp3(cf, cf2, sstep(0.3, 1, f)), cf, (Math.abs(j - Math.round(j)) < 0.05 ? 0.4 : 0)); };
    const addFin = (bone, outline, map, rings = 2, colF = finC) => acc.add(fanSheet(outline, [0, 0], map, rings), { skin: typeof bone === 'number' ? rigid(bone) : bone, dtl: [0, 0, 0.15, 0], color: (p, n, uv) => colF(uv[0], uv[1], outline.length) });
    // caudal (forked) — plane x = 0, u back, v up
    addFin(b('tail'), [[0.02, -0.055], [0.055, -0.06], [0.07, -0.05], [0.05, -0.02], [0.045, 0], [0.05, 0.02], [0.07, 0.05], [0.055, 0.06], [0.02, 0.055]].map(([u, w]) => [u * (v === 'koi' ? 1.2 : 1), w * (v === 'reef' ? 0.8 : 1)]), (u, w) => [0, w, 0.162 + u], 3, v === 'reef' ? (f) => lerp3(col(c.tail), col(0xfff0a0), sstep(0.7, 1, f)) : finC);
    // dorsal (sail along the back)
    addFin(chainSkin(Z_BONES, idx, -0.01), [[-0.05, 0.004], [-0.04, 0.04], [-0.02, 0.05], [0.0, 0.042], [0.02, 0.026], [0.032, 0.004]].map(([z, h]) => [z, h * (v === 'reef' ? 0.9 : 1)]), (z, h) => [0, 0.03 * (v === 'reef' ? 1.4 : 1) + h, -0.01 + z], 2);
    // anal & pelvic
    addFin(chainSkin(Z_BONES, idx, 0.08), [[-0.02, -0.002], [-0.01, -0.03], [0.012, -0.028], [0.02, -0.004]], (z, h) => [0, -0.02 * (v === 'reef' ? 1.4 : 1) + h, 0.08 + z], 2);
    for (const s of [-1, 1]) {
      addFin(chainSkin(Z_BONES, idx, 0.0), [[-0.012, 0], [0.006, -0.026], [0.018, -0.02], [0.012, 0]], (z, h) => [s * 0.008, -0.036 + h * 0.8, 0.0 + z], 2);
      // pectorals on their own bones (they scull)
      addFin(b(s < 0 ? 'finL' : 'finR'), [[0.004, -0.008], [0.03, -0.012], [0.042, 0.0], [0.03, 0.01], [0.004, 0.006]], (u, h) => [s * 0.02 + s * u * 0.25, -0.02 + h, -0.1 + u], 2);
    }
  },
  sockets: { head: ['head', [0, 0.05, -0.12]], mouth: ['jaw', [0, -0.006, -0.2]], center: ['body', [0, 0, -0.03]], back: ['body', [0, 0.035, -0.03]] },
  height: 0.1, radius: 0.2,
  controller(inst) { return new FishCtl(inst, SPEC); },
  get actionList() { return ACTIONS; },
};

// ================================================================================================ controller
export class FishCtl extends BaseCtl {
  constructor(inst, spec) {
    super(inst, spec);
    inst.material.side = THREE.DoubleSide;
    this.gait = null;
    const b = this.pose.b;
    this.bb = { body: b.body, head: b.head, jaw: b.jaw, sp1: b.sp1, sp2: b.sp2, tail: b.tail, finL: b.finL, finR: b.finR };
    this.ph = Math.random() * 10; this.sd = Math.random() * 100;
    this.depth = 0.35; this.amp = 0; this.freq = 1; this.fin = 1; this.roll = 0; this.pitch = 0;
  }
  update(dt, state = {}) {
    dt = Math.min(dt, 0.1);
    const P = this.pose, B = this.bb, t = this.t += dt;
    this._state(state, dt);
    this.speedSm += (this._speed - this.speedSm) * (1 - Math.exp(-3 * dt));
    this.turnSm += (this._turn - this.turnSm) * (1 - Math.exp(-3 * dt));
    P.reset();
    const sp = clamp01(Math.abs(this.speedSm) / 2.5);
    // base swim parameters (actions blend on top)
    this.depth = 0.35 + vnoise(t * 0.3, this.sd) * 0.06; this.amp = 0.1 + 0.32 * sp; this.freq = 1.1 + 3.2 * sp;
    this.fin = 1 - 0.7 * sp; this.roll = 0; this.pitch = vnoise(t * 0.5, this.sd + 4) * 0.08; this.jaw = 0.1 + 0.08 * Math.sin(t * 3.1); this.glow = 1;
    this.lift = 0; this.fwd = 0;
    this.acts.apply();
    this.ph += dt * TAU * this.freq;
    const A = this.amp, ph = this.ph, tb = this.turnSm;
    P.move(B.body, vnoise(t * 0.4, this.sd + 8) * 0.04, -this.depth + this.lift, vnoise(t * 0.35, this.sd + 9) * 0.05 - this.fwd);
    P.rot(B.body, this.pitch, A * 0.12 * Math.sin(ph) + tb * 0.12, this.roll);
    P.ry(B.head, -A * 0.35 * Math.sin(ph) + tb * 0.25);
    P.ry(B.sp1, A * 0.45 * Math.sin(ph - 0.9) - tb * 0.2);
    P.ry(B.sp2, A * 0.7 * Math.sin(ph - 1.8) - tb * 0.25);
    P.ry(B.tail, A * 1.1 * Math.sin(ph - 2.7) - tb * 0.2);
    const sc = Math.sin(t * 5.3 + this.sd) * 0.35 * this.fin;
    P.rot(B.finL, 0, 0.3 + sc, 0); P.rot(B.finR, 0, -0.3 - sc, 0);
    P.rx(B.jaw, -this.jaw);
    P.fk();
    P.apply(this.inst.bones);
    this._uniforms();
  }
}

const ACTIONS = {
  jump: { dur: 1.2, a: 0.02, d: 0.95, fn(ctl, a, w) { // bursts up, arcs through the air, dives back in ahead
    const k = a.k, air = clamp01((k - 0.12) / 0.7), h = 4 * air * (1 - air);
    const up = sstep(0.0, 0.12, k), dive = sstep(0.82, 1, k);
    ctl.lift += (h * 0.75 + ctl.depth * sstep(0.02, 0.14, k) * (1 - sstep(0.8, 0.95, k)) + 0.25 * up * (1 - air)) * w;
    ctl.fwd += (air * 0.6 - 0.3) * sstep(0, 0.1, k) * (1 - dive) * w;
    const vy = 1 - 2 * air;                                     // vertical velocity sign through the arc
    ctl.pitch = mix(ctl.pitch, Math.atan2(vy * 1.6, 1) + 0.25 * up * (1 - air), w);
    ctl.roll += Math.sin(air * Math.PI) * 0.6 * w;
    ctl.amp = mix(ctl.amp, 0.55, w); ctl.freq = mix(ctl.freq, 5.5, w); ctl.fin = mix(ctl.fin, 0.2, w);
  } },
  dart: { dur: 1, hold: true, fadeIn: 0.08, fadeOut: 0.6, fn(ctl, a, w) { ctl.amp = mix(ctl.amp, 0.5, w); ctl.freq = mix(ctl.freq, 6, w); ctl.depth += 0.12 * w; ctl.fin = mix(ctl.fin, 0.1, w); } },
  nibble: { dur: 2.4, a: 0.2, d: 0.8, fn(ctl, a, w) { // rises to the surface and pecks at it
    const t = a.t, e = sstep(0, 0.25, a.k) * (1 - sstep(0.8, 1, a.k)), peck = Math.max(0, Math.sin(t * 7));
    ctl.depth = mix(ctl.depth, 0.06 - 0.03 * peck, e * w); ctl.pitch = mix(ctl.pitch, 0.5, e * w); ctl.amp = mix(ctl.amp, 0.06, e * w);
    ctl.jaw = Math.max(ctl.jaw, 0.5 * peck * e * w);
  } },
  flop: { dur: 1.6, loop: true, fadeIn: 0.2, fadeOut: 0.3, fn(ctl, a, w) { // stranded on a deck / shore: lies on its side, flopping
    const t = a.t, hop = Math.max(0, Math.sin(t * 5.2)) * (Math.sin(t * 1.3) > 0.2 ? 1 : 0.2);
    ctl.depth = mix(ctl.depth, -0.03 - 0.05 * hop, w); ctl.roll = mix(ctl.roll, Math.PI / 2, w); ctl.pitch = mix(ctl.pitch, 0, w);
    ctl.amp = mix(ctl.amp, 0.45 + 0.3 * hop, w); ctl.freq = mix(ctl.freq, 2.6, w); ctl.jaw = Math.max(ctl.jaw, 0.4 * Math.abs(Math.sin(t * 4)) * w);
  } },
  hit: { dur: 0.4, a: 0.03, d: 0.5, hit: 0, fn(ctl, a, w) { const j = Math.sin(Math.PI * a.k) * w; ctl.roll += 0.6 * j; ctl.fwd -= 0.08 * j; ctl.amp = mix(ctl.amp, 0.6, j); ctl.freq = mix(ctl.freq, 7, j); } },
  death: { dur: 2.5, hold: true, excl: true, state: true, fadeIn: 0.05, keep: true, fn(ctl, a, w) { // goes still, rolls belly-up and floats to the surface
    const k = a.k, e = sstep(0, 0.6, k);
    ctl.roll = mix(ctl.roll, Math.PI * 0.94, e * w); ctl.depth = mix(ctl.depth, 0.0, sstep(0.1, 1, k) * w); ctl.pitch = mix(ctl.pitch, -0.08, e * w);
    ctl.amp = mix(ctl.amp, 0.02, e * w); ctl.freq = mix(ctl.freq, 0.4, e * w); ctl.fin = mix(ctl.fin, 0, e * w); ctl.jaw = mix(ctl.jaw, 0.3, e * w);
  } },
};
const SPEC = { bones: {}, actions: ACTIONS, fidgets: [{ name: 'nibble', w: 1 }], fidgetGap: 6 };
