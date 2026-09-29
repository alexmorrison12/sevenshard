// Sandmaw animation: the wurm is one FK chain rising from under the sand. A handful of posture params (rise, lean,
// bend, spin, coil, head pitch, maw) are blended by the base layer and actions, then spread along the chain with a
// travelling sway wave. Burrow / emerge slide the whole body through the ground plane (state.burrowed or actions).
import * as THREE from 'three';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { norm, cross, add } from './core/geo.js';

const _q = new THREE.Quaternion(), _ax = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const bump = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));
const PK = ['lean', 'bend', 'spin', 'coil', 'head', 'maw', 'sway', 'rise', 'thrash', 'tilt'];

export function sandmawSpec(G) {
  const { NS, FWD } = G;
  const DEPTH = 17;
  const Rt = norm(cross([0, 1, 0], FWD)), Up = cross(FWD, Rt);
  const petalAxis = [0, 1, 2, 3].map(k => {
    const a = k / 4 * Math.PI * 2 + Math.PI / 4;
    const radial = norm(add(Rt.map(v => v * Math.cos(a)), Up.map(v => v * Math.sin(a))));
    return new THREE.Vector3(...cross(FWD, radial)).normalize();
  });
  function init(ctl) { ctl.u = { W: {}, maw: 0 }; ctl.lift = 0; }
  function pose(ctl, p, w) { const W = ctl.u.W; for (const k in p) W[k] = mix(W[k], p[k], w); }

  function base(ctl, dt) {
    const t = ctl.t, W = ctl.u.W, ch = ctl.ch;
    for (const k of PK) W[k] = 0;
    const grog = ctl.groggy, enr = ctl.enrage;
    W.rise = 1 - sm(ctl.burrow);
    W.sway = 1 + 0.6 * enr - 0.5 * grog;
    W.maw = 0.22 + 0.08 * Math.sin(t * 1.3) + 0.15 * enr + 0.2 * grog;
    W.lean = 0.35 * grog; W.head = -0.35 * grog; W.bend = 0.15 * grog * Math.sin(t * 0.7);
    ch.eye = Math.min(ch.eye, 1 - 0.6 * grog);
    ch.throat = Math.max(ch.throat, 0.2 + 0.2 * Math.sin(t * 1.3) + 0.3 * enr);
  }

  function finish(ctl, dt) {
    const P = ctl.P, b = ctl.b, t = ctl.t, W = ctl.u.W, ch = ctl.ch;
    const rise = W.rise;
    ctl.lift = -DEPTH * (1 - rise);
    P.move(b.seg0, 0, -DEPTH * (1 - rise), 0);
    P.prot(b.seg0, Y, W.spin);
    P.rz(b.seg0, W.tilt * 0.6);
    for (let i = 0; i < NS; i++) {
      const f = i / (NS - 1);
      const up = sstep(0.25, 1, f);                         // upper segments do most of the work
      const wav = Math.sin(t * 0.85 - i * 0.42) * 0.035 * W.sway * (0.3 + f);
      const wavY = Math.sin(t * 0.6 - i * 0.5 + 1.3) * 0.05 * W.sway * f;
      const th = Math.sin(t * 13 - i * 0.9) * 0.05 * W.thrash * f;
      const pitch = W.lean * 0.16 * up + W.coil * 0.12 * Math.sin(f * Math.PI * 2) + wav + th;
      const yaw = W.bend * 0.13 * up + wavY + th * 0.7;
      P.rot(b['seg' + i], pitch, yaw, W.tilt * 0.04 * (1 - f));
    }
    P.rot(b.head, W.head + Math.sin(t * 1.1) * 0.04 * W.sway, Math.sin(t * 0.7) * 0.05 * W.sway, Math.sin(t * 9) * 0.1 * W.thrash);
    const u = ctl.u;
    u.maw += (clamp01(Math.max(W.maw, ch.jaw)) - u.maw) * (1 - Math.exp(-14 * dt));
    for (let k = 0; k < 4; k++) {
      const flick = Math.sin(t * 2.3 + k * 1.7) * 0.03;
      P.lq[b['petal' + k]].multiply(_q.setFromAxisAngle(petalAxis[k], u.maw * 1.75 + flick));
    }
  }
  function material(ctl, U, dt) {
    const ch = ctl.ch;
    U.uThroat.value += (ch.throat - U.uThroat.value) * (1 - Math.exp(-8 * dt));
    U.uEye.value = ctl.dead ? Math.max(0, U.uEye.value - dt * 0.4) : ch.eye;
    U.uFlame.value = 0.35 + 0.65 * ch.flame;   // sandfall streams
    U.uFlameAmp.value = 0.6;
    U.uGlowK.value = ctl.dead ? Math.max(0.1, U.uGlowK.value - dt * 0.3) : 1;
  }

  const A = {
    idle: { dur: 5, loop: true },

    bite: { dur: 1.9, fin: 0.15, fout: 0.45, fn(ctl, a, w) {
      // rears back, maw blooming open, then lunges down onto the target and snaps shut
      const t = a.t;
      const rear = bump(t, 0, 0.7, 0.8, 0.95), strike = bump(t, 0.85, 1.02, 1.15, 1.7);
      pose(ctl, { lean: -1.2 * rear + 3.3 * strike, head: 0.35 * rear - 0.45 * strike, maw: 0.9 * rear * (t < 1.0 ? 1 : 0) + 0.2 * strike, coil: 0.8 * rear, sway: 0.2 }, w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (t > 0.3 && t < 1.0 ? 0.95 : 0) * w);
    } },

    tail_sweep: { dur: 2.6, fin: 0.2, fout: 0.45, fn(ctl, a, w) {
      // bows low to one side and scythes its whole length across the sand in a wide arc
      const t = a.t;
      const low = bump(t, 0, 0.7, 1.9, 2.5), k = sm((t - 0.6) / 1.4);
      pose(ctl, { lean: 2.6 * low, spin: (-1.3 + 2.6 * k) * low, bend: (1.4 - 2.8 * k) * low, head: -0.3 * low, maw: 0.4 * low, sway: 0.2, tilt: 0.3 * low * (1 - 2 * k) }, w);
    } },

    sand_spit: { dur: 2.3, fin: 0.2, fout: 0.45, fn(ctl, a, w) {
      const t = a.t;
      const up = bump(t, 0, 0.6, 1.8, 2.2);
      const spit = Math.max(bump(t, 0.85, 0.95, 1.0, 1.1), bump(t, 1.2, 1.3, 1.35, 1.45), bump(t, 1.55, 1.65, 1.7, 1.8));
      pose(ctl, { lean: -0.8 * up + 0.9 * spit, head: 0.2 * up - 0.25 * spit, maw: 0.55 * up + 0.45 * spit, coil: 0.5 * up }, w);
      ctl.ch.throat = Math.max(ctl.ch.throat, 1.4 * up * w);
    } },

    sandstorm: { dur: 4.2, fin: 0.3, fout: 0.6, fn(ctl, a, w) {
      // towers up, gullet to the sky, and spins itself into a whirling roar
      const t = a.t;
      const up = bump(t, 0, 0.8, 3.5, 4.1), spin = sm((t - 0.8) / 2.9);
      pose(ctl, { rise: 1 + 0.12 * up, lean: -1.6 * up, head: 0.75 * up, maw: 1.0 * up, spin: spin * TAU * 2 * up, thrash: 0.6 * up * sstep(0.8, 1.2, t), coil: -0.4 * up, sway: 0.3 }, w);
      ctl.ch.throat = Math.max(ctl.ch.throat, 1.6 * up * w);
      ctl.ch.flame = Math.max(ctl.ch.flame, 1 + up);
    } },

    burrow: { dur: 2.6, fin: 0.15, fout: 0.2,
      pre(ctl, a) { ctl.ch.burrow = sm((a.t - 0.9) / 1.6); },
      end(ctl) { ctl.burrowLatch = 1; },
      fn(ctl, a, w) {
        const t = a.t;
        const arc = bump(t, 0, 0.9, 2.2, 2.6);
        pose(ctl, { lean: 2.4 * arc, head: -0.6 * arc, maw: 0.5 * arc, thrash: 0.3 * arc }, w);
        ctl.ch.flame = Math.max(ctl.ch.flame, 1.5);
      } },

    emerge: { dur: 2.4, fin: 0.01, fout: 0.5,
      pre(ctl, a) { const t = a.t; ctl.ch.burrow = 1 - sm(t / 0.55); ctl.burrowLatch = 0; },
      fn(ctl, a, w) {
        const t = a.t;
        const burst = bump(t, 0.2, 0.55, 0.9, 1.6), thrash = bump(t, 0.4, 0.6, 1.4, 1.9);
        pose(ctl, { rise: 1 + 0.18 * burst, lean: -1.0 * burst, head: 0.6 * burst, maw: 0.95 * burst, thrash: 0.9 * thrash, coil: 0.5 * burst }, w);
        ctl.ch.throat = Math.max(ctl.ch.throat, 1.2 * burst);
        ctl.ch.flame = Math.max(ctl.ch.flame, 2 - t);
      } },

    intro: { dur: 6.0, fin: 0.01, fout: 0.6,
      pre(ctl, a) { const t = a.t; ctl.ch.burrow = 1 - sm((t - 0.6) / 0.8); ctl.burrowLatch = 0; },
      fn(ctl, a, w) {
        // erupts from the dunes, towers, sways as sand pours off, then roars at the party with its maw in full bloom
        const t = a.t;
        const burst = bump(t, 0.6, 1.2, 1.8, 2.6), look = bump(t, 2.4, 3.0, 3.6, 3.9), roar = bump(t, 3.8, 4.3, 5.2, 5.8);
        pose(ctl, { rise: 1 + 0.2 * burst, lean: -1.2 * burst + 0.4 * look + 1.2 * roar, head: 0.7 * burst - 0.1 * look - 0.3 * roar, maw: 0.8 * burst + 1.0 * roar, thrash: 0.7 * burst + 0.35 * roar, bend: 0.5 * look * Math.sin(t * 2), sway: 1.5 }, w);
        ctl.ch.throat = Math.max(ctl.ch.throat, 1.2 * burst + 1.6 * roar);
        ctl.ch.flame = Math.max(ctl.ch.flame, 2.0 * burst + 0.8);
      } },

    groggy: { dur: 3.5, loop: true, fin: 0.5, pre(ctl, a, w) { ctl.ch.groggy = Math.max(ctl.ch.groggy, w); }, fn(ctl, a, w) {
      const tt = a.t % 3.5;
      pose(ctl, { thrash: 0.4 * bump(tt, 2.2, 2.4, 2.8, 3.1) }, w);
    } },

    death: { dur: 4.0, hold: true, fin: 0.05, fn(ctl, a, w) {
      // a last shriek, then the whole length topples forward onto the sand and settles, maw slack
      const t = a.t;
      const shriek = bump(t, 0, 0.4, 0.9, 1.3), fall = sm((t - 0.9) / 1.6), sink = sstep(2.5, 4.0, t);
      pose(ctl, { lean: -0.9 * shriek + 3.9 * fall, head: 0.5 * shriek - 0.2 * fall, maw: 1.0 * shriek + 0.45 * fall, thrash: 0.6 * shriek, sway: 1 - fall, bend: 0.5 * fall, rise: 1 - 0.1 * sink }, w);
      ctl.ch.throat = Math.max(ctl.ch.throat, 1.2 * shriek);
      ctl.ch.eye = Math.min(ctl.ch.eye, 1 - fall);
    } },
  };
  return { init, base, finish, material, actions: A };
}
