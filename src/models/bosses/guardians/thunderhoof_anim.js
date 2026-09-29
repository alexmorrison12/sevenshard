// Old Thunderhoof animation: heavy-hoofed quadruped gait with a low bison head carriage, crackling antlers (ch.heat
// drives the strobing arcs and veins), and every field-boss action.
import * as THREE from 'three';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';

const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const bump = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));

export function thunderhoofSpec(J) {
  const M = (p, s) => [p[0] * s, p[1], p[2]];
  const legF = (s, n) => ({ id: 'F' + n, chain: ['fU' + n, 'fL' + n, 'fP' + n], toe: M(J.fToe, s), body: 'chest', lift: 0.45, flex: 1.1, out: 0.06, scap: 0.25, heel: 0.35, strength: 1 });
  const legR = (s, n) => ({ id: 'R' + n, chain: ['rT' + n, 'rS' + n, 'rM' + n, 'rP' + n], toe: M(J.rToe, s), body: 'hips', lift: 0.42, flex: 0.8, out: 0.1, scap: 0.2, metaK: 0.9, heel: 0.3, strength: 1 });
  const gait = {
    legs: [legF(-1, 'L'), legF(1, 'R'), legR(-1, 'L'), legR(1, 'R')],
    maxStride: 3.6, actV: 0.3, actTurn: 1.1, settleDist: 0.18,
    gaits: [
      { v: 2.8, f: 0.6, duty: 0.64, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.08, bobF: 2, bobPh: 0.1, roll: 0.04, rollF: 1, sway: 0.06, swayF: 1, nod: 0.06, nodF: 2, nodPh: 0.3 },
      { v: 8.5, f: 0.95, duty: 0.34, lift: 1.25, off: { RL: 0, RR: 0.1, FR: 0.42, FL: 0.52 }, bob: 0.28, bobF: 1, bobPh: 0.62, pitch: 0.09, pitchF: 1, pitchPh: 0.05, flex: 0.1, flexF: 1, flexPh: 0.2, nod: 0.06, nodF: 1, nodPh: 0.8, lean: 0.05 },
    ],
  };
  function init(ctl) { ctl.u = { look: { y: 0, p: 0, ty: 0, tp: 0, timer: 2 }, jaw: 0, heat: 0 }; }
  const setLegOv = (L, x, y, z, w, local = false, paw = 0) => {
    if (!L.override) L.override = new THREE.Vector3();
    L.override.set(x, y, z); L.overrideW = Math.max(L.overrideW, w); L.overrideLocal = local; L.overridePaw = paw;
  };
  function base(ctl, dt) {
    const P = ctl.P, b = ctl.b, G = ctl.gait, ch = ctl.ch, u = ctl.u, t = ctl.t;
    const aspd = Math.abs(G.sSm), run = sstep(3, 8, aspd);
    const idle = 1 - clamp01(G.act * 1.5);
    const grog = ctl.groggy, enr = ctl.enrage;
    const breath = Math.sin(t * TAU * mix(0.2, 0.45, Math.max(enr, run)));
    P.sc[b.chest].setScalar(1 + breath * 0.014);
    const crouch = 0.08 * (1 - run) + 0.35 * grog;
    P.move(b.body, G.sway, G.bob - crouch + G.gOff, 0);
    P.rot(b.body, G.pitch + G.gPitch - G.lean * 0.5 + 0.06 * grog, 0, G.roll + G.gRoll + ctl.turn * clamp01(aspd / 4) * 0.1);
    P.rx(b.chest, G.flex); P.rx(b.hips, -G.flex * 0.8);
    const L = u.look; L.timer -= dt;
    if (L.timer <= 0) { L.timer = 2.5 + Math.random() * 3; L.ty = Math.random() < 0.4 ? 0 : (Math.random() - 0.5) * 0.9; L.tp = (Math.random() - 0.5) * 0.25; }
    const lk = idle * (1 - grog);
    L.y += (L.ty * lk - L.y) * (1 - Math.exp(-2 * dt)); L.p += (L.tp * lk - L.p) * (1 - Math.exp(-2 * dt));
    const sw = Math.sin(t * 0.9) * 0.15 * grog;
    P.rot(b.neck, -0.06 - 0.12 * run + L.p * 0.5 - 0.3 * grog, L.y * 0.5 + sw + ctl.turn * 0.1, 0);
    P.rot(b.head, 0.08 * run - (G.pitch + G.flex) * 0.5 + G.nod + L.p * 0.5 - 0.08 * grog, L.y * 0.4 + sw, Math.sin(t * 0.7) * 0.15 * grog);
    ch.jaw = Math.max(ch.jaw, 0.02 + 0.02 * Math.sin(t * 1.7) + 0.08 * enr + 0.15 * grog + 0.06 * run);
    ch.eye = Math.min(ch.eye, 1 - 0.6 * grog);
    ch.heat = Math.max(ch.heat, 0.12 + 0.35 * enr + 0.2 * run - 0.12 * grog);
    for (let i = 1; i <= 2; i++) P.rot(b['tail' + i], -0.05 + 0.12 * run, Math.sin(t * (1.1 + enr * 2) - i * 0.7) * 0.12 * (1 + enr), 0);
    for (const Lg of G.legs) Lg.homeOff.set(Lg.side * 0.14 * grog, 0, 0);
  }
  function finish(ctl, dt) {
    const u = ctl.u, ch = ctl.ch;
    u.jaw += (ch.jaw - u.jaw) * (1 - Math.exp(-18 * dt));
    ctl.P.rx(ctl.b.jaw, -u.jaw);
  }
  function material(ctl, U, dt) {
    const u = ctl.u, ch = ctl.ch;
    u.heat += (ch.heat - u.heat) * (1 - Math.exp(-6 * dt));
    U.uHeat.value = ctl.dead ? Math.max(0, U.uHeat.value - dt * 0.4) : u.heat;
    U.uEye.value = ctl.dead ? Math.max(0, U.uEye.value - dt * 0.4) : ch.eye;
    U.uFlash.value = ch.flash;
    U.uGlowK.value = ctl.dead ? Math.max(0.1, U.uGlowK.value - dt * 0.3) : 1 + 0.5 * u.heat;
  }

  const loco = (speed, turn) => ({ loop: true, fin: 0.3, pre(ctl) { if (ctl.st.speed === undefined && ctl.st.turn === undefined) { ctl.ch.locoSpeed = speed || 0; ctl.ch.locoTurn = turn || 0; } } });
  const A = {
    idle: { dur: 4, loop: true },
    walk: { dur: 1.8, ...loco(2.8) },
    run: { dur: 0.95, ...loco(8.5) },

    gore: { dur: 1.6, fin: 0.12, fout: 0.35, fn(ctl, a, w) {
      // dips the antler crown low, then hooks it up and across
      const P = ctl.P, b = ctl.b, t = a.t;
      const low = bump(t, 0, 0.5, 0.6, 0.75), hook = bump(t, 0.6, 0.78, 0.92, 1.4);
      P.move(b.body, 0, (-0.2 * low + 0.1 * hook) * w, (0.15 * low - 0.6 * hook) * w);
      P.rx(b.body, (-0.08 * low + 0.1 * hook) * w);
      P.rot(b.neck, (-0.35 * low + 0.3 * hook) * w, 0.25 * hook * w, 0);
      P.rot(b.head, (-0.25 * low + 0.45 * hook) * w, 0.3 * hook * w, -0.35 * hook * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 0.5 + 0.8 * hook);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.2 * hook * w);
    } },

    charge: { dur: 3.4, fin: 0.15, fout: 0.4,
      pre(ctl, a) { const t = a.t; if (t > 1.15 && t < 2.7) ctl.ch.locoSpeed = 14; },
      fn(ctl, a, w) {
        // paws the earth with lightning skittering off the antlers, lowers the crown, thunders forward, skids
        const P = ctl.P, b = ctl.b, t = a.t;
        const wind = bump(t, 0, 0.3, 1.0, 1.2), paw = bump(t, 0.2, 0.3, 0.9, 1.0), run = bump(t, 1.1, 1.3, 2.55, 2.75), skid = bump(t, 2.6, 2.8, 3.0, 3.4);
        const pw = Math.max(0, Math.sin((t - 0.2) * 9));
        P.move(b.body, 0, (-0.2 * wind - 0.15 * run - 0.2 * skid) * w, (0.2 * wind + 0.3 * skid) * w);
        P.rx(b.body, (-0.07 * wind - 0.05 * run + 0.16 * skid) * w);
        P.rx(b.neck, (-0.3 * wind - 0.3 * run - 0.1 * skid) * w);
        P.rot(b.head, (-0.25 * wind - 0.2 * run + 0.2 * skid) * w, Math.sin(t * 5) * 0.1 * wind * w, 0);
        const L = ctl.gait.legs[1];
        if (paw > 0) setLegOv(L, L.toe.x, 0.35 * pw, L.toe.z + 0.35 - 0.7 * pw, paw * w * (1 - run), false, -0.5);
        if (skid > 0) for (const Lg of ctl.gait.legs) if (Lg.id[0] === 'F') setLegOv(Lg, Lg.toe.x * 1.1, 0, Lg.toe.z - 0.7, skid * w, false, 0.3);
        ctl.ch.heat = Math.max(ctl.ch.heat, 0.7 * wind + 1.2 * run + 0.6 * skid);
        ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.2 * wind + 0.3 * skid) * w);
      } },

    stomp: { dur: 2.0, fin: 0.15, fout: 0.4, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const rear = bump(t, 0, 0.8, 0.9, 1.05), slam = bump(t, 0.95, 1.05, 1.25, 1.8);
      const piv = [0, 2.4, 1.6], ang = 0.55 * rear - 0.08 * slam;
      const dz = J.body[2] - piv[2], dy = J.body[1] - piv[1];
      P.move(b.body, 0, (Math.cos(ang) * dy - Math.sin(ang) * dz - dy - 0.3 * slam) * w, (Math.sin(ang) * dy + Math.cos(ang) * dz - dz) * w);
      P.rx(b.body, ang * w);
      P.rx(b.neck, (0.2 * rear - 0.3 * slam) * w); P.rx(b.head, (0.3 * rear - 0.2 * slam) * w);
      for (const L of ctl.gait.legs) if (L.id[0] === 'F') setLegOv(L, L.toe.x, 0.7, L.toe.z - 0.3, rear * w, true, -0.6);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.5 * rear + 0.3 * slam) * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 0.6 * rear + 1.6 * slam);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.6 * bump(t, 1.0, 1.05, 1.1, 1.35));
    } },

    lightning_call: { dur: 3.2, fin: 0.2, fout: 0.45, fn(ctl, a, w) {
      // rears half up and throws its antlers to the sky; each bellow calls a bolt down (hits)
      const P = ctl.P, b = ctl.b, t = a.t;
      const up = bump(t, 0, 0.7, 2.6, 3.1);
      const strike = Math.max(bump(t, 1.2, 1.3, 1.35, 1.5), bump(t, 1.7, 1.8, 1.85, 2.0), bump(t, 2.2, 2.3, 2.35, 2.5));
      P.move(b.body, 0, 0.35 * up * w, 0.3 * up * w);
      P.rx(b.body, 0.3 * up * w);
      P.rx(b.neck, (0.45 * up - 0.1 * strike) * w); P.rot(b.head, (0.5 * up - 0.15 * strike) * w, Math.sin(t * 3) * 0.1 * up * w, 0);
      for (const L of ctl.gait.legs) if (L.id[0] === 'F') setLegOv(L, L.toe.x, 0.15 + 0.15 * Math.max(0, Math.sin(t * 6 + L.side)), L.toe.z - 0.1, up * w * 0.6, true, -0.3);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.3 * up + 0.5 * strike) * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 1.2 * up + 1.5 * strike);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.9 * strike);
    } },

    roar: { dur: 2.2, fin: 0.15, fout: 0.4, fn(ctl, a, w) {
      // a thunderous bellow, crown thrown back, lightning bursting from every tine
      const P = ctl.P, b = ctl.b, t = a.t;
      const up = bump(t, 0, 0.5, 1.6, 2.0), roar = bump(t, 0.5, 0.75, 1.5, 1.9), sh = Math.sin(t * 34) * 0.025 * roar;
      P.move(b.body, 0, 0.2 * up * w, 0.15 * up * w); P.rot(b.body, 0.15 * up * w, sh * w, sh * w);
      P.rx(b.neck, (0.35 * up + 0.1 * roar) * w); P.rot(b.head, (0.35 * up + 0.2 * roar) * w, sh * 2 * w, 0);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.8 * roar * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 0.8 * up + 1.4 * roar);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.5 * bump(t, 0.7, 0.8, 0.9, 1.2));
    } },

    channel: { dur: 2.0, loop: true, fin: 0.5, fadeOut: 0.5, fn(ctl, a, w) {
      // crown lifted to the storm, the whole beast humming with charge
      const P = ctl.P, b = ctl.b, t = a.t, beat = Math.pow(0.5 + 0.5 * Math.sin(t / 2.0 * TAU - 1.2), 2), sh = Math.sin(t * 31) * 0.015;
      P.move(b.body, sh * w, (0.2 + 0.05 * beat) * w, 0.2 * w); P.rot(b.body, 0.2 * w, 0, sh * w);
      P.rx(b.neck, 0.4 * w); P.rx(b.head, (0.45 + 0.05 * beat) * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 1.1 + 0.9 * beat);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.3 * beat * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.25 * w);
    } },

    intro: { dur: 6.0, fin: 0.01, fout: 0.6, fn(ctl, a, w) {
      // head low grazing in the mist; the ear flicks, it lifts that crown, the antlers kindle one by one, and it bellows
      const P = ctl.P, b = ctl.b, t = a.t;
      const graze = 1 - sstep(1.2, 2.2, t), lift = bump(t, 1.8, 2.6, 4.8, 5.5), bellow = bump(t, 3.4, 3.8, 4.6, 5.1), paw = bump(t, 5.0, 5.2, 5.6, 5.9);
      P.rx(b.neck, (-0.6 * graze + 0.3 * lift + 0.15 * bellow) * w);
      P.rot(b.head, (-0.35 * graze + 0.25 * lift + 0.35 * bellow) * w, 0.15 * graze * Math.sin(t * 2) * w, 0);
      P.move(b.body, 0, (0.15 * bellow) * w, 0);
      P.rx(b.body, 0.12 * bellow * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.08 * graze * (0.5 + 0.5 * Math.sin(t * 6)) + 0.75 * bellow) * w);
      ctl.ch.heat = Math.max(0, Math.min(ctl.ch.heat, 0.05 + 0.6 * sstep(2.4, 3.6, t)) + 1.6 * bellow);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.7 * bump(t, 3.8, 3.9, 4.0, 4.3));
      const L = ctl.gait.legs[1];
      if (paw > 0) setLegOv(L, L.toe.x, 0.3 * Math.max(0, Math.sin(t * 9)), L.toe.z + 0.2, paw * w, false, -0.4);
    } },

    groggy: { dur: 3.0, loop: true, fin: 0.4, pre(ctl, a, w) { ctl.ch.groggy = Math.max(ctl.ch.groggy, w); }, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, tt = a.t % 3;
      const shake = bump(tt, 1.8, 1.95, 2.35, 2.6);
      P.rot(b.head, 0, Math.sin(a.t * 20) * 0.22 * shake * w, Math.sin(a.t * 20) * 0.14 * shake * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 0.4 * shake);
    } },

    death: { dur: 3.5, hold: true, fin: 0.05, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const stag = bump(t, 0, 0.35, 0.55, 1.0), knees = bump(t, 0.5, 1.0, 1.4, 1.8), fall = sm((t - 1.1) / 1.4);
      const bounce = t > 2.5 ? Math.sin(clamp01((t - 2.5) / 0.3) * Math.PI) * 0.05 : 0;
      P.move(b.body, 0.25 * fall * w, (0.1 * stag - 0.5 * knees - 1.35 * fall + bounce) * w, 0);
      P.rot(b.body, (0.1 * stag - 0.2 * knees + 0.1 * fall) * w, 0.1 * fall * w, 1.2 * fall * w);
      P.rot(b.neck, (0.25 * stag - 0.3 * fall) * w, 0, -0.3 * fall * w);
      P.rot(b.head, (0.35 * stag - 0.1 * fall) * w, 0, -0.35 * fall * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.6 * stag + 0.3 * fall) * w);
      ctl.ch.heat = Math.max(ctl.ch.heat, 1.4 * stag);
      ctl.ch.eye = Math.min(ctl.ch.eye, 1 - sstep(1.5, 3.0, t));
      for (const L of ctl.gait.legs) {
        const up = L.side > 0, front = L.id[0] === 'F';
        const kneel = front ? knees * (1 - fall) : 0;
        setLegOv(L, L.toe.x * 1.1 + (up ? 0.3 : 0), up ? 0.8 * fall : 0.2 * fall + 0.5 * kneel, L.toe.z + (front ? -0.4 : 0.4) * fall + 0.6 * kneel, Math.max(fall, kneel) * w, true, -0.5);
      }
    } },
  };
  return { gait, init, base, finish, material, actions: A };
}
