// Deep Oracle animation: a bobbing dome with a darting, blinking eye, and eight tentacles that each writhe on their
// own rhythm; per-tentacle params (lift, bend, sweep, sink, writhe) let actions drive single tentacles (slam, sweep)
// or all of them (summon). ch.burrow = submerged amount.
import * as THREE from 'three';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';
import { norm, cross } from './core/geo.js';

const _q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const bump = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));

export function oracleSpec(J, D) {
  const { NTEN, TSEG, TEN } = D;
  const DEPTH = 11;
  const bendAxis = TEN.map(T => new THREE.Vector3(...norm(cross([0, 1, 0], T.dir))));
  const phase = TEN.map((_, i) => i * 2.39 + 0.7), speed = TEN.map((_, i) => 0.7 + ((i * 37) % 10) / 22);
  function init(ctl) {
    ctl.u = { T: TEN.map(() => ({})), eye: { y: 0, p: 0, ty: 0, tp: 0, timer: 1 }, blink: 0, blinkT: 3, lid: 1, B: {} };
    ctl.lift = 0;
  }
  const TK = ['lift', 'bend', 'sweep', 'sink', 'writhe', 'curl'];
  function ten(ctl, i, p, w) { const T = ctl.u.T[i]; for (const k in p) T[k] = mix(T[k], p[k], w); }
  function all(ctl, p, w) { for (let i = 0; i < NTEN; i++) ten(ctl, i, p, w); }
  function body(ctl, p, w) { const B = ctl.u.B; for (const k in p) B[k] = mix(B[k], p[k], w); }

  function base(ctl, dt) {
    const u = ctl.u, t = ctl.t, grog = ctl.groggy, enr = ctl.enrage;
    for (const T of u.T) { for (const k of TK) T[k] = 0; T.writhe = 1 + 0.6 * enr - 0.6 * grog; T.bend = 0.25 * grog; }
    const B = u.B; B.lean = 0.25 * grog; B.rise = -0.6 * grog; B.lid = 1 - 0.55 * grog; B.look = 1 - grog; B.twist = 0; B.eyeUp = 0;
    ctl.ch.eye = Math.min(ctl.ch.eye, 1 - 0.5 * grog);
    ctl.ch.throat = Math.max(ctl.ch.throat, 0.3 + 0.2 * Math.sin(t * 1.1));
  }

  function finish(ctl, dt) {
    const P = ctl.P, b = ctl.b, t = ctl.t, u = ctl.u, B = u.B;
    const sub = sm(ctl.burrow);
    ctl.lift = -DEPTH * sub + B.rise;
    const bob = Math.sin(t * 0.7) * 0.18;
    P.move(b.core, Math.sin(t * 0.45) * 0.15, bob - DEPTH * sub + B.rise, 0);
    P.rot(b.core, B.lean * 0.5 + Math.sin(t * 0.7 + 1) * 0.03, B.twist + Math.sin(t * 0.3) * 0.05, Math.sin(t * 0.5) * 0.03);
    P.rot(b.body, B.lean * 0.5, 0, 0);
    P.sc[b.mantle].setScalar(1 + Math.sin(t * 1.1) * 0.02);
    // eye: darting gaze + blinks
    const E = u.eye; E.timer -= dt;
    if (E.timer <= 0) { E.timer = 0.6 + Math.random() * 2.2; E.ty = (Math.random() - 0.5) * 0.7; E.tp = (Math.random() - 0.5) * 0.35; }
    E.y += (E.ty * B.look - E.y) * (1 - Math.exp(-9 * dt)); E.p += (E.tp * B.look - E.p) * (1 - Math.exp(-9 * dt));
    P.rot(b.eye, E.p + B.eyeUp, E.y, 0);
    u.blinkT -= dt;
    if (u.blinkT <= 0) { u.blink = 0.22; u.blinkT = 2.5 + Math.random() * 4; }
    u.blink = Math.max(0, u.blink - dt);
    const blink = u.blink > 0 ? 1 - Math.abs(u.blink - 0.11) / 0.11 : 0;
    const open = clamp01(B.lid * (1 - blink) * (ctl.broken.has('eye') ? 0.55 : 1));
    u.lid += (open - u.lid) * (1 - Math.exp(-22 * dt));
    P.rx(b.lidU, 1.15 * u.lid - 0.12); P.rx(b.lidD, -(1.0 * u.lid - 0.12));
    // tentacles
    for (let i = 0; i < NTEN; i++) {
      const T = u.T[i], ax = bendAxis[i];
      P.move(b[`t${i}_0`], 0, -T.sink * 9, 0);
      P.prot(b[`t${i}_0`], Y, T.sweep);
      for (let j = 0; j < TSEG; j++) {
        const f = j / (TSEG - 1);
        const ph = t * speed[i] * (1 + 0.5 * (T.writhe - 1)) + phase[i] - j * 0.65;
        const bend = (T.bend * 0.22 - T.lift * 0.2) * (0.4 + f) + Math.sin(ph) * 0.07 * T.writhe * (0.3 + f) + T.curl * 0.18 * f;
        const yaw = Math.sin(ph * 0.8 + 1.3) * 0.08 * T.writhe * (0.2 + f);
        const bi = b[`t${i}_${j}`];
        P.lq[bi].multiply(_q.setFromAxisAngle(ax, bend));
        P.ry(bi, yaw);
      }
    }
    ctl.P.rx(b.jaw, -ctl.ch.jaw * 0.5);
  }
  function material(ctl, U, dt) {
    const ch = ctl.ch;
    U.uEye.value += ((ctl.dead ? 0 : ch.eye * (ctl.broken.has('eye') ? 0.5 : 1)) - U.uEye.value) * (1 - Math.exp(-6 * dt));
    U.uThroat.value += (ch.throat - U.uThroat.value) * (1 - Math.exp(-8 * dt));
    U.uFlash.value = ch.flash;
    U.uGlowK.value = ctl.dead ? Math.max(0.1, U.uGlowK.value - dt * 0.25) : 1 + 0.35 * ctl.enrage + ch.heat;
  }

  const FRONT = [0, 7], SIDE = 1;
  const A = {
    idle: { dur: 5, loop: true },

    tentacle_slam: { dur: 2.4, fin: 0.15, fout: 0.45, fn(ctl, a, w) {
      // the two front tentacles rear high behind the dome, hang, and crash down in front
      const t = a.t;
      const rear = bump(t, 0, 0.9, 1.1, 1.25), slam = bump(t, 1.12, 1.32, 1.6, 2.2);
      for (const i of FRONT) ten(ctl, i, { lift: 4.5 * rear - 1.5 * slam, bend: 3.2 * slam, writhe: 0.4, curl: -0.8 * rear }, w);
      body(ctl, { lean: -0.2 * rear + 0.25 * slam, eyeUp: -0.2 * rear }, w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.6 * slam * w);
    } },

    tentacle_sweep: { dur: 2.6, fin: 0.15, fout: 0.45, fn(ctl, a, w) {
      // one tentacle drops low and scythes across the whole front
      const t = a.t;
      const low = bump(t, 0, 0.6, 1.9, 2.4), k = sm((t - 0.7) / 1.1);
      ten(ctl, SIDE, { bend: 2.4 * low, sweep: (-0.4 - 2.6 * k) * low, writhe: 0.3, curl: 0.6 * low, lift: -0.4 * low }, w);
      body(ctl, { twist: (0.2 - 0.4 * k) * low }, w);
    } },

    gaze: { dur: 3.6, fin: 0.2, fout: 0.45, fn(ctl, a, w) {
      // the lids peel wide, the iris blazes, and the eye sweeps its beam across the arena
      const t = a.t;
      const open = bump(t, 0, 0.9, 3.0, 3.5), beam = bump(t, 1.0, 1.2, 2.9, 3.2);
      body(ctl, { lid: 1 + 0.3 * open, lean: 0.25 * open, look: 1 - open, eyeUp: -0.12 * open, twist: Math.sin((t - 1.0) * 1.6) * 0.3 * beam }, w);
      ctl.u.eye.ty = Math.sin((t - 1.0) * 1.6) * 0.25 * beam;
      ctl.ch.eye = Math.max(ctl.ch.eye, 1 + 1.6 * open + 0.8 * beam);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.25 * beam * (0.6 + 0.4 * Math.sin(t * 24)));
      all(ctl, { writhe: 0.5, lift: 0.4 * open }, w);
    } },

    summon: { dur: 3.0, fin: 0.2, fout: 0.5, fn(ctl, a, w) {
      const t = a.t;
      const up = bump(t, 0, 0.9, 2.2, 2.9), pulse = bump(t, 1.45, 1.6, 1.75, 2.1);
      for (let i = 0; i < NTEN; i++) ten(ctl, i, { lift: 1.5 * up + Math.sin(t * 3 + i) * 0.3 * up, writhe: 1 + 1.6 * up, curl: -0.5 * up }, w);
      body(ctl, { rise: 0.8 * up, eyeUp: 0.25 * up, lid: 1 - 0.4 * up + 0.5 * pulse }, w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 0.8 * up + pulse);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.7 * pulse);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.5 * up * w);
    } },

    roar: { dur: 2.4, fin: 0.2, fout: 0.45, fn(ctl, a, w) {
      const t = a.t;
      const up = bump(t, 0, 0.6, 1.7, 2.2), roar = bump(t, 0.6, 0.8, 1.6, 2.0);
      all(ctl, { lift: 1.2 * up, writhe: 1 + 2 * roar, curl: -0.4 * up }, w);
      body(ctl, { rise: 0.5 * up, lid: 1 + 0.3 * roar, lean: -0.2 * up + 0.2 * roar }, w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 1.0 * roar * w);
      ctl.ch.eye = Math.max(ctl.ch.eye, 1 + roar);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.4 * roar);
    } },

    channel: { dur: 2.4, loop: true, fin: 0.6, fadeOut: 0.5, fn(ctl, a, w) {
      // the eye stares unblinking and brightens while every tentacle rises and weaves a slow spell
      const t = a.t, beat = Math.pow(0.5 + 0.5 * Math.sin(t / 2.4 * TAU - 1.2), 2);
      for (let i = 0; i < NTEN; i++) ten(ctl, i, { lift: 1.3 + 0.3 * Math.sin(t * 1.3 + i), writhe: 0.6, curl: -0.6 + 0.3 * Math.sin(t + i * 0.7) }, w);
      body(ctl, { rise: 0.6, lid: 1.2, look: 0, eyeUp: 0.1 }, w);
      ctl.ch.eye = Math.max(ctl.ch.eye, 1.4 + 0.8 * beat);
      ctl.ch.heat = Math.max(ctl.ch.heat, 0.5 + 0.5 * beat);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.2 * beat * w);
    } },

    submerge: { dur: 2.4, fin: 0.15, fout: 0.2,
      pre(ctl, a) { ctl.ch.burrow = sm((a.t - 0.3) / 1.9); },
      end(ctl) { ctl.burrowLatch = 1; },
      fn(ctl, a, w) { const t = a.t; body(ctl, { lid: 1 - sstep(0.8, 1.6, t) }, w); all(ctl, { lift: -1.0 * sstep(0, 0.8, t), writhe: 1.8 }, w); } },

    emerge: { dur: 2.2, fin: 0.01, fout: 0.4,
      pre(ctl, a) { ctl.ch.burrow = 1 - sm(a.t / 0.8); ctl.burrowLatch = 0; },
      fn(ctl, a, w) { const t = a.t; const burst = bump(t, 0.3, 0.7, 1.1, 1.8); all(ctl, { lift: 1.6 * burst, writhe: 1 + 2 * burst }, w); body(ctl, { rise: 0.9 * burst, lid: sstep(0.5, 1.0, t) }, w); ctl.ch.flash = Math.max(ctl.ch.flash, 0.5 * burst); } },

    intro: { dur: 6.5, fin: 0.01, fout: 0.6,
      pre(ctl, a) { ctl.ch.burrow = 1 - sm((a.t - 2.3) / 1.9); ctl.burrowLatch = 0; },
      fn(ctl, a, w) {
        // tentacles break the surface one by one, then the dome rises, and last of all the eye opens on the party
        const t = a.t;
        for (let i = 0; i < NTEN; i++) {
          const ti = 0.5 + ((i * 3) % NTEN) * 0.22;
          const rise = sm((t - ti) / 0.7);
          ten(ctl, i, { sink: (1 - rise) * (t < 4.4 ? 1 : 0) * (1 - sm(ctl.burrow)) * 0 + (1 - rise), lift: 1.4 * bump(t, ti, ti + 0.6, ti + 1.2, ti + 2) + 0.9 * bump(t, 4.4, 4.7, 5.4, 6.2), writhe: 1.5 + bump(t, 4.3, 4.6, 5.5, 6.2) * 1.5 }, w);
        }
        const open = sstep(4.2, 4.6, t), glare = bump(t, 4.4, 4.6, 5.3, 6.0);
        body(ctl, { lid: open, look: 0, rise: 0.8 * glare, lean: 0.2 * glare }, w);
        ctl.ch.eye = Math.max(ctl.ch.eye * open, 1 + 1.5 * glare);
        ctl.ch.flash = Math.max(ctl.ch.flash, 0.9 * bump(t, 4.5, 4.6, 4.7, 5.0));
        ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.7 * glare * w);
      } },

    groggy: { dur: 3.5, loop: true, fin: 0.5, pre(ctl, a, w) { ctl.ch.groggy = Math.max(ctl.ch.groggy, w); }, fn(ctl, a, w) {
      const tt = a.t % 3.5;
      ctl.u.eye.ty = Math.sin(a.t * 1.7) * 0.5; ctl.u.eye.tp = Math.cos(a.t * 1.3) * 0.3;   // the eye rolls
      body(ctl, { lid: 0.45 + 0.2 * bump(tt, 1.5, 1.7, 2.2, 2.6) }, w);
    } },

    death: { dur: 4.5, hold: true, fin: 0.05,
      pre(ctl, a) { ctl.ch.burrow = sm((a.t - 1.8) / 2.6) * 0.55; },
      fn(ctl, a, w) {
        const t = a.t;
        const thrash = bump(t, 0, 0.3, 1.2, 1.8), fall = sm((t - 1.2) / 1.6);
        all(ctl, { writhe: 1 + 3 * thrash - fall, lift: 1.2 * thrash - 0.2 * fall, bend: 3.5 * fall, curl: 0.8 * fall }, w);
        body(ctl, { lid: 1 - sstep(1.4, 2.4, t), lean: 0.4 * fall, eyeUp: 0.6 * thrash, look: 0 }, w);
        ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.9 * thrash * w);
        ctl.ch.eye = Math.min(ctl.ch.eye, 1 - sstep(1.4, 2.6, t));
      } },
  };
  return { init, base, finish, material, actions: A };
}
