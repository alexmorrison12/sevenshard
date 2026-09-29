// Cinderhorn animation: ponderous heavy-quadruped gait, head carriage with the great horn, burrow / erupt through the
// ground (state.burrowed or the burrow / erupt actions), and every guardian action.
import * as THREE from 'three';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';

const Y = new THREE.Vector3(0, 1, 0);
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const bump = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));

export function cinderhornSpec(J) {
  const DEPTH = 5.0;
  const M = (p, s) => [p[0] * s, p[1], p[2]];
  const legF = (s, n) => ({ id: 'F' + n, chain: ['fU' + n, 'fL' + n, 'fP' + n], toe: M(J.fToe, s), body: 'chest', lift: 0.45, flex: 0.7, out: 0.08, scap: 0.15, heel: 0.2, strength: 1 });
  const legR = (s, n) => ({ id: 'R' + n, chain: ['rT' + n, 'rS' + n, 'rM' + n, 'rP' + n], toe: M(J.rToe, s), body: 'hips', lift: 0.42, flex: 0.6, out: 0.1, scap: 0.12, metaK: 0.6, heel: 0.2, strength: 1 });
  const gait = {
    legs: [legF(-1, 'L'), legF(1, 'R'), legR(-1, 'L'), legR(1, 'R')],
    maxStride: 3.2, actV: 0.3, actTurn: 1.2, settleDist: 0.2,
    gaits: [
      { v: 2.6, f: 0.55, duty: 0.66, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.09, bobF: 2, bobPh: 0.1, roll: 0.05, rollF: 1, sway: 0.08, swayF: 1, nod: 0.05, nodF: 2, nodPh: 0.3 },
      { v: 7.5, f: 0.95, duty: 0.42, lift: 1.2, off: { FL: 0, RR: 0.05, FR: 0.5, RL: 0.55 }, bob: 0.22, bobF: 2, bobPh: 0.35, roll: 0.04, rollF: 1, pitch: 0.04, pitchF: 2, nod: 0.06, nodF: 2, nodPh: 0.5 },
    ],
  };
  function init(ctl) { ctl.u = { look: { y: 0, p: 0, ty: 0, tp: 0, timer: 2 }, jaw: 0, heat: 0 }; ctl.lift = 0; }
  const setLegOv = (L, x, y, z, w, local = false, paw = 0) => {
    if (!L.override) L.override = new THREE.Vector3();
    L.override.set(x, y, z); L.overrideW = Math.max(L.overrideW, w); L.overrideLocal = local; L.overridePaw = paw;
  };

  function base(ctl, dt) {
    const P = ctl.P, b = ctl.b, G = ctl.gait, ch = ctl.ch, u = ctl.u, t = ctl.t;
    const aspd = Math.abs(G.sSm), run = sstep(3, 7, aspd);
    const idle = 1 - clamp01(G.act * 1.5);
    const grog = ctl.groggy, enr = ctl.enrage;
    const bur = sm(ctl.burrow);
    const breath = Math.sin(t * TAU * mix(0.18, 0.4, Math.max(enr, run)));
    P.sc[b.chest].setScalar(1 + breath * 0.012);
    // sinking into the ground: shudder while partly buried
    const shud = Math.sin(t * 31) * 0.05 * bump(ctl.burrow, 0.02, 0.2, 0.8, 0.98);
    ctl.lift = -DEPTH * bur;
    const crouch = 0.1 * (1 - run) + 0.3 * grog;
    P.move(b.body, G.sway + shud, G.bob - crouch + G.gOff - DEPTH * bur, 0);
    P.rot(b.body, G.pitch + G.gPitch - G.lean * 0.5 + 0.05 * grog - 0.15 * bur, shud * 0.5, G.roll + G.gRoll + ctl.turn * clamp01(aspd / 4) * 0.1 + shud);
    P.rx(b.chest, G.flex); P.rx(b.hips, -G.flex * 0.8);
    const L = u.look; L.timer -= dt;
    if (L.timer <= 0) { L.timer = 2.5 + Math.random() * 3; L.ty = Math.random() < 0.4 ? 0 : (Math.random() - 0.5) * 0.9; L.tp = (Math.random() - 0.5) * 0.2; }
    const lk = idle * (1 - grog);
    L.y += (L.ty * lk - L.y) * (1 - Math.exp(-2 * dt)); L.p += (L.tp * lk - L.p) * (1 - Math.exp(-2 * dt));
    const sw = Math.sin(t * 0.9) * 0.15 * grog;
    P.rot(b.neck, -0.05 - 0.1 * run + L.p * 0.5 - 0.25 * grog, L.y * 0.5 + sw + ctl.turn * 0.1, 0);
    P.rot(b.head, 0.06 * run - (G.pitch + G.flex) * 0.5 + G.nod + L.p * 0.5 - 0.1 * grog, L.y * 0.4 + sw, Math.sin(t * 0.7) * 0.15 * grog);
    ch.jaw = Math.max(ch.jaw, 0.03 + 0.03 * Math.sin(t * 1.9) + 0.1 * enr + 0.18 * grog + 0.08 * run);
    ch.eye = Math.min(ch.eye, 1 - 0.6 * grog);
    ch.heat = Math.max(ch.heat, 0.25 * enr + 0.3 * run * 0);
    // tail: slow heavy sway
    for (let i = 1; i <= 3; i++) P.rot(b['tail' + i], (i === 1 ? -0.05 : 0.03) - 0.06 * grog, Math.sin(t * (0.7 + enr) - i * 0.6) * 0.08 * (1 + enr) - ctl.turn * 0.05, 0);
    for (const Lg of G.legs) { Lg.ikW = 1 - clamp01(bur * 2.5); Lg.homeOff.set(Lg.side * 0.15 * grog, 0, 0); }
  }
  function finish(ctl, dt) {
    const u = ctl.u, ch = ctl.ch;
    u.jaw += (ch.jaw - u.jaw) * (1 - Math.exp(-18 * dt));
    ctl.P.rx(ctl.b.jaw, -u.jaw);
  }
  function material(ctl, U, dt) {
    const u = ctl.u, ch = ctl.ch;
    u.heat += (ch.heat - u.heat) * (1 - Math.exp(-5 * dt));
    U.uHeat.value = u.heat;
    U.uThroat.value += (ch.throat - U.uThroat.value) * (1 - Math.exp(-8 * dt));
    U.uEye.value = ch.eye;
    U.uFlash.value = ch.flash;
    U.uGlowK.value = ctl.dead ? Math.max(0.12, U.uGlowK.value - dt * 0.35) : 1;
  }

  const loco = (speed, turn) => ({ loop: true, fin: 0.3, pre(ctl) { if (ctl.st.speed === undefined && ctl.st.turn === undefined) { ctl.ch.locoSpeed = speed || 0; ctl.ch.locoTurn = turn || 0; } } });
  const A = {
    idle: { dur: 4, loop: true },
    walk: { dur: 1.8, ...loco(2.6) },
    run: { dur: 1.0, ...loco(7.5) },

    gore: { dur: 1.6, fin: 0.12, fout: 0.35, fn(ctl, a, w) {
      // head drops low (horn levelled), short lunge, violent upward toss
      const P = ctl.P, b = ctl.b, t = a.t;
      const low = bump(t, 0, 0.5, 0.62, 0.8), toss = bump(t, 0.62, 0.8, 0.95, 1.4);
      P.move(b.body, 0, (-0.2 * low + 0.15 * toss) * w, (0.2 * low - 0.8 * toss) * w);
      P.rx(b.body, (-0.1 * low + 0.12 * toss) * w);
      P.rx(b.neck, (-0.35 * low + 0.35 * toss) * w);
      P.rot(b.head, (-0.3 * low + 0.55 * toss) * w, 0.2 * Math.sin(t * 20) * low * 0.2 * w, 0);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.25 * toss * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 0.5 * toss);
    } },

    charge: { dur: 3.6, fin: 0.15, fout: 0.4,
      pre(ctl, a) { const t = a.t; if (t > 1.2 && t < 2.8) ctl.ch.locoSpeed = 13; },
      fn(ctl, a, w) {
        // windup: paw the ground, snort, horn low → thundering charge → braced skid
        const P = ctl.P, b = ctl.b, t = a.t;
        const wind = bump(t, 0, 0.35, 1.05, 1.25), paw = bump(t, 0.2, 0.3, 0.95, 1.05), run = bump(t, 1.15, 1.35, 2.6, 2.8), skid = bump(t, 2.65, 2.85, 3.1, 3.55);
        const pw = Math.max(0, Math.sin((t - 0.2) * 9));
        P.move(b.body, 0, (-0.25 * wind - 0.15 * run - 0.2 * skid) * w, (0.25 * wind + 0.35 * skid) * w);
        P.rx(b.body, (-0.08 * wind - 0.06 * run + 0.18 * skid) * w);
        P.rx(b.neck, (-0.3 * wind - 0.25 * run - 0.1 * skid) * w);
        P.rot(b.head, (-0.2 * wind - 0.2 * run + 0.2 * skid) * w, Math.sin(t * 5) * 0.08 * wind * w, 0);
        const L = ctl.gait.legs[1];
        if (paw > 0) setLegOv(L, L.toe.x, 0.35 * pw, L.toe.z + 0.3 - 0.6 * pw, paw * w * (1 - run), false, -0.4);
        if (skid > 0) for (const Lg of ctl.gait.legs) if (Lg.id[0] === 'F') setLegOv(Lg, Lg.toe.x * 1.1, 0, Lg.toe.z - 0.7, skid * w, false, 0.3);
        ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.2 * wind * (0.5 + 0.5 * Math.sin(t * 7)) + 0.3 * skid) * w);
        ctl.ch.heat = Math.max(ctl.ch.heat, 0.6 * wind + 1.0 * run);
      } },

    stomp: { dur: 2.0, fin: 0.15, fout: 0.4, fn(ctl, a, w) {
      // rears up on the hind legs and slams both forefeet down
      const P = ctl.P, b = ctl.b, t = a.t;
      const rear = bump(t, 0, 0.8, 0.9, 1.05), slam = bump(t, 0.95, 1.05, 1.25, 1.8);
      const piv = [0, 2.3, 1.5];
      const ang = 0.5 * rear - 0.08 * slam;
      // rotate about the hips so the hind feet stay planted
      const dz = J.body[2] - piv[2], dy = J.body[1] - piv[1];
      P.move(b.body, 0, (Math.cos(ang) * dy - Math.sin(ang) * dz - dy - 0.3 * slam) * w, (Math.sin(ang) * dy + Math.cos(ang) * dz - dz) * w);
      P.rx(b.body, ang * w);
      P.rx(b.neck, (0.2 * rear - 0.25 * slam) * w); P.rx(b.head, (0.25 * rear - 0.2 * slam) * w);
      for (const L of ctl.gait.legs) if (L.id[0] === 'F') setLegOv(L, L.toe.x, 0.6, L.toe.z - 0.2, rear * w, true, -0.5);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.5 * rear + 0.3 * slam) * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 0.5 * rear + 1.2 * slam);
    } },

    lava_spit: { dur: 2.2, fin: 0.15, fout: 0.4, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const up = bump(t, 0, 0.5, 1.7, 2.1);
      const spit = Math.max(bump(t, 0.75, 0.85, 0.9, 1.0), bump(t, 1.05, 1.15, 1.2, 1.3), bump(t, 1.35, 1.45, 1.5, 1.6));
      P.move(b.body, 0, 0.1 * up * w, 0.2 * up * w);
      P.rx(b.body, 0.08 * up * w);
      P.rx(b.neck, (0.3 * up - 0.12 * spit) * w); P.rx(b.head, (0.15 * up - 0.18 * spit) * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.25 * up + 0.55 * spit) * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, 1.2 * up * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 0.6 * up);
    } },

    burrow: { dur: 2.4, fin: 0.15, fout: 0.2,
      pre(ctl, a) { ctl.ch.burrow = sm((a.t - 0.5) / 1.8); },
      end(ctl) { ctl.burrowLatch = 1; },
      fn(ctl, a, w) {
        const P = ctl.P, b = ctl.b, t = a.t;
        const dig = bump(t, 0, 0.4, 1.8, 2.3);
        const pw = Math.sin(t * 11);
        P.rx(b.neck, -0.35 * dig * w); P.rx(b.head, -0.3 * dig * w);
        for (const L of ctl.gait.legs) if (L.id[0] === 'F') setLegOv(L, L.toe.x, 0.25 * Math.max(0, pw * L.side), L.toe.z - 0.2 * pw * L.side, dig * w * (1 - sstep(0.6, 1.2, t)), false, -0.3);
        ctl.ch.heat = Math.max(ctl.ch.heat, 1.2 * dig);
      } },

    erupt: { dur: 2.0, fin: 0.01, fout: 0.4,
      pre(ctl, a) { const t = a.t; ctl.ch.burrow = 1 - sm(t / 0.5); ctl.burrowLatch = 0; },
      fn(ctl, a, w) {
        const P = ctl.P, b = ctl.b, t = a.t;
        const jump = Math.sin(clamp01(t / 0.95) * Math.PI) * (t < 0.95 ? 1 : 0), land = bump(t, 0.9, 1.0, 1.1, 1.6);
        P.move(b.body, 0, (1.4 * jump - 0.35 * land) * w, 0);
        P.rx(b.body, (0.45 * jump * (1 - clamp01(t / 0.9)) - 0.1 * land) * w);
        P.rx(b.neck, (0.3 * jump - 0.1 * land) * w); P.rx(b.head, 0.25 * jump * w);
        ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.8 * jump + 0.3 * land) * w);
        ctl.ch.heat = Math.max(ctl.ch.heat, 1.8 * jump + 0.8 * land);
        for (const L of ctl.gait.legs) setLegOv(L, L.toe.x, 0.9, L.toe.z + (L.id[0] === 'F' ? -0.4 : 0.3), jump * w, true, -0.5);
      } },

    tail_slam: { dur: 2.2, fin: 0.15, fout: 0.4, fn(ctl, a, w) {
      // pivots a quarter turn, lifts the molten club high and slams it down behind
      const P = ctl.P, b = ctl.b, t = a.t;
      const turnK = bump(t, 0, 0.6, 1.5, 2.1), lift = bump(t, 0.2, 0.9, 1.05, 1.2), slam = bump(t, 1.08, 1.2, 1.4, 1.9);
      const yaw = 0.9 * turnK;
      P.prot(b.body, Y, yaw * w);
      P.rx(b.hips, (0.1 * lift - 0.1 * slam) * w);
      P.rot(b.tail1, (-0.55 * lift + 0.3 * slam) * w, 0.2 * lift * w, 0);
      P.rot(b.tail2, (-0.45 * lift + 0.35 * slam) * w, 0, 0);
      P.rot(b.tail3, (-0.3 * lift + 0.3 * slam) * w, 0, 0);
      P.rx(b.club, (-0.2 * lift + 0.25 * slam) * w);
      P.rot(b.neck, 0, -0.35 * turnK * w, 0);
      const c = Math.cos(yaw * w), s = Math.sin(yaw * w), bz = 0.2;
      for (const L of ctl.gait.legs) { const hz = L.home.z - bz; setLegOv(L, L.home.x * c + hz * s, 0.25 * Math.sin(clamp01(t / 0.6) * Math.PI) * turnK, bz - L.home.x * s + hz * c, w, false); }
      ctl.ch.heat = Math.max(ctl.ch.heat, 1.0 * slam);
    } },

    roar: { dur: 2.6, fin: 0.2, fout: 0.45, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const rear = bump(t, 0, 0.6, 1.9, 2.4), roar = bump(t, 0.6, 0.95, 1.9, 2.3);
      const shake = Math.sin(t * 34) * 0.03 * roar;
      P.move(b.body, 0, 0.25 * rear * w, 0.2 * rear * w);
      P.rot(b.body, 0.18 * rear * w, shake * w, shake * w);
      P.rx(b.neck, (0.35 * rear + 0.1 * roar) * w); P.rot(b.head, (0.3 * rear + 0.25 * roar) * w, shake * 2 * w, 0);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.85 * roar * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, 1.3 * roar * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 1.6 * roar);
    } },

    intro: { dur: 6.0, fin: 0.01, fout: 0.6,
      pre(ctl, a) { const t = a.t; ctl.ch.burrow = 1 - sm((t - 0.4) / 1.3); ctl.burrowLatch = 0; },
      fn(ctl, a, w) {
        // bursts up out of the lava, shakes the magma off, turns its horn to the party and roars
        const P = ctl.P, b = ctl.b, t = a.t;
        const rise = bump(t, 0.4, 1.2, 1.5, 2.0), shake = bump(t, 1.9, 2.1, 2.9, 3.2), roar = bump(t, 3.5, 3.9, 4.8, 5.3), low = bump(t, 5.2, 5.6, 5.8, 6.0);
        const sh = Math.sin(t * 26);
        P.move(b.body, sh * 0.08 * shake * w, (0.8 * rise + 0.25 * roar - 0.2 * low) * w, 0.2 * roar * w);
        P.rot(b.body, (0.35 * rise + 0.2 * roar - 0.05 * low) * w, sh * 0.06 * shake * w, sh * 0.12 * shake * w);
        P.rot(b.neck, (0.3 * rise + 0.3 * roar - 0.25 * low) * w, sh * 0.2 * shake * w, 0);
        P.rot(b.head, (0.2 * rise + 0.3 * roar - 0.2 * low) * w, sh * 0.25 * shake * w, sh * 0.2 * shake * w);
        ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.6 * rise + 0.9 * roar) * w);
        ctl.ch.throat = Math.max(ctl.ch.throat, 1.4 * roar * w);
        ctl.ch.heat = Math.max(ctl.ch.heat, 2.0 * rise + 1.4 * roar + 0.6 * shake);
      } },

    groggy: { dur: 3.0, loop: true, fin: 0.4, pre(ctl, a, w) { ctl.ch.groggy = Math.max(ctl.ch.groggy, w); }, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, tt = a.t % 3;
      const shake = bump(tt, 1.8, 1.95, 2.35, 2.6);
      P.rot(b.head, 0, Math.sin(a.t * 20) * 0.2 * shake * w, Math.sin(a.t * 20) * 0.12 * shake * w);
    } },

    death: { dur: 3.4, hold: true, fin: 0.05, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const stag = bump(t, 0, 0.35, 0.55, 1.0), fall = sm((t - 0.6) / 1.4);
      const bounce = t > 2.0 ? Math.sin(clamp01((t - 2.0) / 0.3) * Math.PI) * 0.06 : 0;
      P.move(b.body, 0.3 * fall * w, (0.12 * stag - 1.25 * fall + bounce) * w, 0);
      P.rot(b.body, (0.1 * stag - 0.06 * fall) * w, 0.1 * fall * w, 1.25 * fall * w);
      P.rot(b.neck, (0.2 * stag - 0.3 * fall) * w, 0, -0.25 * fall * w);
      P.rot(b.head, (0.3 * stag - 0.1 * fall) * w, 0, -0.3 * fall * w);
      for (let i = 1; i <= 3; i++) P.rx(b['tail' + i], 0.08 * fall * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.6 * stag + 0.3 * fall) * w);
      ctl.ch.eye = Math.min(ctl.ch.eye, 1 - sstep(1.5, 3.0, t));
      for (const L of ctl.gait.legs) {
        const up = L.side > 0, front = L.id[0] === 'F';
        setLegOv(L, L.toe.x * 1.1 + (up ? 0.3 : 0), up ? 0.9 : 0.25, L.toe.z + (front ? -0.4 : 0.4), fall * w, true, -0.4);
      }
    } },
  };
  return { gait, init, base, finish, material, actions: A };
}
