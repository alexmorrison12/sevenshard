// Kurai animation: agile quadruped gait (walk / trot / gallop), elegant head carriage, living nine-tail fan
// (fan / lift / stream / flare params blended by actions), and every guardian action.
import * as THREE from 'three';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';

const _v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const bump = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));

export function kuraiSpec(J, T) {
  const { NT, TB } = T;
  const M = (p, s) => [p[0] * s, p[1], p[2]];
  const legF = (s, n) => ({ id: 'F' + n, chain: ['fU' + n, 'fL' + n, 'fP' + n], toe: M(J.fToe, s), body: 'chest', lift: 0.55, flex: 1.4, out: 0.06, scap: 0.3, heel: 0.5, strength: 0.7 });
  const legR = (s, n) => ({ id: 'R' + n, chain: ['rT' + n, 'rS' + n, 'rM' + n, 'rP' + n], toe: M(J.rToe, s), body: 'hips', lift: 0.5, flex: 0.9, out: 0.1, scap: 0.25, metaK: 1.0, heel: 0.35, strength: 0.8 });
  const gait = {
    legs: [legF(-1, 'L'), legF(1, 'R'), legR(-1, 'L'), legR(1, 'R')],
    maxStride: 5.5, actV: 0.35, actTurn: 1.0, settleDist: 0.15,
    gaits: [
      { v: 3, f: 0.62, duty: 0.62, lift: 0.8, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.07, bobF: 2, bobPh: 0.1, roll: 0.03, rollF: 1, sway: 0.04, swayF: 1, nod: 0.05, nodF: 2, nodPh: 0.3 },
      { v: 6.5, f: 0.85, duty: 0.45, lift: 1, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.1, bobF: 2, bobPh: 0.35, roll: 0.02, rollF: 1, nod: 0.04, nodF: 2, nodPh: 0.5, pitch: 0.015, pitchF: 2 },
      { v: 11, f: 1.05, duty: 0.3, lift: 1.3, off: { RL: 0, RR: 0.1, FR: 0.42, FL: 0.52 }, bob: 0.32, bobF: 1, bobPh: 0.62, pitch: 0.11, pitchF: 1, pitchPh: 0.05, flex: 0.16, flexF: 1, flexPh: 0.2, nod: 0.06, nodF: 1, nodPh: 0.8, lean: 0.05 },
    ],
  };
  const tailA = Array.from({ length: NT }, (_, i) => (i - 4) / 4 * 1.2);
  const tailE = Array.from({ length: NT }, (_, i) => 0.42 + 0.3 * (1 - Math.abs(i - 4) / 4));

  function init(ctl) {
    ctl.u = { look: { y: 0, p: 0, ty: 0, tp: 0, timer: 2 }, jaw: 0, T: {}, flame: 1, ear: 0 };
  }
  function channels(ctl, ch) { ch.eye = 1; ch.flame = 1; ch.flash = 0; }
  // tail posture params: fan (1 = rest spread), lift (rad, + raises), stream (0..1 flatten backwards), wrap (curl forward
  // around the body), whip (lateral lash), curl (tip curl), sway amplitude, flare (flame boost)
  const TK = ['fan', 'lift', 'stream', 'wrap', 'whip', 'curl', 'sway', 'twist'];
  function tails(ctl, p, w) { const Tp = ctl.u.T; for (const k in p) Tp[k] = mix(Tp[k], p[k], w); }
  const setLegOv = (L, x, y, z, w, local = false, paw = 0) => {
    if (!L.override) L.override = new THREE.Vector3();
    L.override.set(x, y, z); L.overrideW = Math.max(L.overrideW, w); L.overrideLocal = local; L.overridePaw = paw;
  };

  function base(ctl, dt) {
    const P = ctl.P, b = ctl.b, G = ctl.gait, ch = ctl.ch, u = ctl.u, t = ctl.t;
    const aspd = Math.abs(G.sSm), run = sstep(4, 10, aspd);
    const idle = 1 - clamp01(G.act * 1.5);
    const grog = ctl.groggy, enr = ctl.enrage;
    const breath = Math.sin(t * TAU * mix(0.25, 0.55, Math.max(enr, run)));
    P.sc[b.chest].setScalar(1 + breath * 0.015);
    const crouch = 0.08 * (1 - run) + 0.3 * grog;
    P.move(b.body, G.sway, G.bob - crouch + G.gOff, 0);
    P.rot(b.body, G.pitch + G.gPitch - G.lean * 0.5 + 0.04 * grog, 0, G.roll + G.gRoll + ctl.turn * clamp01(aspd / 5) * 0.14);
    P.rx(b.chest, G.flex); P.rx(b.hips, -G.flex * 0.8);
    // look around
    const L = u.look; L.timer -= dt;
    if (L.timer <= 0) { L.timer = 1.8 + Math.random() * 3; L.ty = Math.random() < 0.3 ? 0 : (Math.random() - 0.5) * 1.2; L.tp = (Math.random() - 0.5) * 0.3; }
    const lk = idle * (1 - grog);
    L.y += (L.ty * lk - L.y) * (1 - Math.exp(-3 * dt)); L.p += (L.tp * lk - L.p) * (1 - Math.exp(-3 * dt));
    const stab = -(G.pitch + G.flex) * 0.8;
    const sw = Math.sin(t * 1.2) * 0.14 * grog;
    P.rot(b.neck1, 0.05 - 0.28 * run + stab * 0.3 + L.p * 0.3 - 0.35 * grog, L.y * 0.4 + sw + ctl.turn * 0.1, 0);
    P.rot(b.neck2, -0.05 - 0.12 * run + stab * 0.3 + L.p * 0.3 - 0.15 * grog, L.y * 0.3 + sw, 0);
    P.rot(b.head, -0.04 + 0.25 * run + stab * 0.4 + G.nod + L.p * 0.4 + 0.3 * grog, L.y * 0.3 + sw * 0.8, Math.sin(t * 0.8) * 0.18 * grog);
    ch.jaw = Math.max(ch.jaw, (0.06 + 0.04 * Math.sin(t * 13)) * run + 0.04 * enr + 0.12 * grog);
    ch.eye = Math.min(ch.eye, 1 - 0.6 * grog);
    ch.flame = Math.min(1.8, ch.flame * (1 - 0.55 * grog) + 0.45 * enr);
    // ears: perked, twitching; flattened when enraged / running
    u.ear = 0.1 * idle * Math.pow(Math.max(0, Math.sin(t * 1.7)), 30) - 0.35 * run - 0.4 * enr - 0.5 * grog;
    // tails: default posture
    const Tp = u.T;
    for (const k of TK) Tp[k] = 0;
    Tp.fan = 1 + 0.25 * enr - 0.35 * run - 0.3 * grog;
    Tp.lift = 0.05 * enr - 0.45 * grog;
    Tp.stream = run;
    Tp.sway = 1 + enr * 0.6;
    Tp.curl = 0.1;
    for (const Lg of G.legs) Lg.homeOff.set(Lg.side * 0.15 * grog, 0, 0);
  }

  function finish(ctl, dt) {
    const P = ctl.P, b = ctl.b, u = ctl.u, ch = ctl.ch, t = ctl.t, Tp = u.T;
    const broken = ctl.broken.has('tails');
    if (broken) ch.flame *= 0.7;
    for (let i = 0; i < NT; i++) {
      const a = tailA[i], e = tailE[i], f = (i - 4) / 4;
      for (let j = 0; j < TB; j++) {
        const bi = b[`t${i}_${j}`];
        const wav = Math.sin(t * (1.3 + i * 0.07) * (1 + Tp.stream * 0.8) - j * 0.8 + i * 0.9) * (0.05 + j * 0.035) * Tp.sway;
        let yaw = wav, pitch = 0, roll = 0;
        if (j === 0) {
          yaw += a * (Tp.fan - 1) * 0.75 - a * Tp.stream * 0.45 + Tp.whip * (0.6 + 0.2 * (1 - Math.abs(f))) - Tp.wrap * Math.sign(f || 0.01) * 0.9;
          pitch += -Tp.lift + e * Tp.stream * 0.9 + Tp.wrap * 0.55;
        } else {
          pitch += Tp.curl * 0.12 * j + Tp.stream * 0.05 - Tp.wrap * 0.15;
          yaw += Tp.whip * 0.25 * j - Tp.wrap * Math.sign(f || 0.01) * 0.35;
        }
        roll = Tp.twist * f * 0.4;
        if (broken && (i < 2 || i > 6)) { pitch += j === 0 ? 0.9 : 0.25; yaw *= 0.3; }   // broken tails hang limp
        P.rot(bi, pitch, yaw, roll);
      }
    }
    P.rot(b.earL, u.ear * 0.8, 0, u.ear * 0.35); P.rot(b.earR, u.ear * 0.8, 0, -u.ear * 0.35);
    u.jaw += (ch.jaw - u.jaw) * (1 - Math.exp(-20 * dt));
    P.rx(b.jaw, -u.jaw);
  }

  function material(ctl, U, dt) {
    const ch = ctl.ch, u = ctl.u;
    u.flame += ((ctl.dead ? ch.flame * 0.08 : ch.flame) - u.flame) * (1 - Math.exp(-(ctl.dead ? 1.2 : 6) * dt));
    U.uFlame.value = u.flame;
    U.uFlameAmp.value = 0.8 + 0.6 * u.flame;
    U.uEye.value = ctl.dead ? Math.max(0, U.uEye.value - dt * 0.5) : ch.eye;
    U.uThroat.value += (ch.throat - U.uThroat.value) * (1 - Math.exp(-8 * dt));
    U.uFlash.value = ch.flash;
    U.uGlowK.value = ctl.dead ? Math.max(0.1, U.uGlowK.value - dt * 0.3) : 1 + ctl.enrage * 0.3;
  }

  const loco = (speed, turn) => ({ loop: true, fin: 0.3, pre(ctl) { if (ctl.st.speed === undefined && ctl.st.turn === undefined) { ctl.ch.locoSpeed = speed || 0; ctl.ch.locoTurn = turn || 0; } } });
  const spinLegs = (ctl, ang, hop, w) => {
    const c = Math.cos(ang), s = Math.sin(ang), bz = 0.1;
    for (const L of ctl.gait.legs) {
      const hx = L.home.x, hz = L.home.z - bz;
      setLegOv(L, hx * c + hz * s, hop * (L.id[0] === 'F' ? 0.7 : 0.5), bz - hx * s + hz * c, w, false);
    }
  };
  const A = {
    idle: { dur: 4, loop: true },
    walk: { dur: 1.6, ...loco(3) },
    run: { dur: 0.8, ...loco(10) },

    claw: { dur: 1.2, fin: 0.1, fout: 0.3, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const raise = bump(t, 0.0, 0.35, 0.45, 0.55), swipe = bump(t, 0.42, 0.55, 0.62, 1.0);
      P.move(b.body, -0.15 * raise * w, (0.25 * raise - 0.15 * swipe) * w, (0.2 * raise - 0.35 * swipe) * w);
      P.rot(b.body, (0.18 * raise - 0.08 * swipe) * w, (0.25 * raise - 0.35 * swipe) * w, -0.12 * raise * w);
      P.rot(b.neck1, (-0.1 * raise + 0.1 * swipe) * w, (-0.2 * raise + 0.25 * swipe) * w, 0);
      P.rot(b.head, 0.15 * raise * w, (-0.15 * raise + 0.2 * swipe) * w, 0);
      const k = sstep(0.42, 0.6, t);
      setLegOv(ctl.gait.legs[1], mix(1.1, -0.6, k), mix(2.2, 0.25, k), mix(-1.9, -2.6, k), bump(t, 0.0, 0.3, 0.7, 1.05) * w, false, mix(-1.0, 0.2, k));
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.4 * swipe * w);
      tails(ctl, { fan: 1.3, lift: 0.15 }, raise * w);
    } },

    tail_whip: { dur: 1.9, fin: 0.1, fout: 0.3, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const crouch = bump(t, 0, 0.3, 0.35, 0.5) + bump(t, 1.35, 1.5, 1.6, 1.85) * 0.5;
      const k = sm((t - 0.35) / 1.05), ang = (k * TAU) % TAU;
      const hop = Math.sin(clamp01((t - 0.35) / 1.05) * Math.PI);
      P.move(b.body, 0, (-0.3 * crouch + 0.5 * hop) * w, 0);
      P.prot(b.body, Y, ang * w);
      spinLegs(ctl, ang, hop, w);
      tails(ctl, { fan: 1.9, lift: -0.25, whip: -Math.sin(k * Math.PI) * 0.8, stream: 0, curl: -0.3, sway: 0.3 }, w * sstep(0.2, 0.45, t) * (1 - sstep(1.4, 1.8, t)));
      ctl.ch.flame = Math.max(ctl.ch.flame, 1 + 0.9 * hop);
    } },

    fire_orbs: { dur: 2.3, fin: 0.2, fout: 0.4, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const sit = bump(t, 0, 0.6, 1.9, 2.3);
      const flick = Math.max(bump(t, 0.85, 0.95, 1.0, 1.15), bump(t, 1.2, 1.3, 1.35, 1.5), bump(t, 1.55, 1.65, 1.7, 1.85));
      P.move(b.body, 0, -0.25 * sit * w, 0.2 * sit * w);
      P.rx(b.body, 0.22 * sit * w); P.rx(b.hips, 0.15 * sit * w);
      P.rx(b.neck1, (0.2 * sit - 0.15 * flick) * w); P.rx(b.head, (0.1 * sit + 0.1 * flick) * w);
      tails(ctl, { fan: 1.6, lift: 0.45 - 0.35 * flick, curl: -0.4 - 0.6 * flick, sway: 0.5, twist: 0.4 }, sit * w);
      ctl.ch.flame = Math.max(ctl.ch.flame, 1.1 + 0.5 * sit + 0.8 * flick);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.3 * flick * w);
      ctl.ch.eye = Math.max(ctl.ch.eye, 1 + flick);
    } },

    pounce: { dur: 1.8, fin: 0.1, fout: 0.35,
      pre(ctl, a) { const t = a.t; if (t > 0.45 && t < 1.12) ctl.ch.locoMul = 0.15; },
      fn(ctl, a, w) {
        const P = ctl.P, b = ctl.b, t = a.t;
        const crouch = bump(t, 0, 0.4, 0.45, 0.55), air = clamp01((t - 0.5) / 0.6), land = bump(t, 1.05, 1.12, 1.2, 1.6);
        const h = Math.sin(air * Math.PI) * (t < 1.1 ? 1 : 0);
        P.move(b.body, 0, (-0.55 * crouch + 2.6 * h - 0.4 * land) * w, (0.3 * crouch) * w);
        P.rx(b.body, (-0.12 * crouch + 0.3 * h * (1 - air) - 0.35 * h * air + 0.1 * land) * w);
        P.rx(b.neck1, (-0.2 * crouch - 0.2 * h) * w); P.rx(b.head, (0.15 * crouch + 0.2 * h) * w);
        for (const L of ctl.gait.legs) {
          const front = L.id[0] === 'F';
          setLegOv(L, L.toe.x, front ? 1.6 : 1.4, L.toe.z + (front ? -1.0 : 0.9), h * w, true, front ? -0.6 : -0.4);
        }
        ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.5 * h + 0.3 * land) * w);
        tails(ctl, { stream: 0.8 * h, fan: 1 - 0.3 * h, lift: 0.2 * crouch }, w);
      } },

    dash: { dur: 1.0, fin: 0.06, fout: 0.25,
      pre(ctl, a) { const t = a.t; if (t > 0.12 && t < 0.62) ctl.ch.locoSpeed = 14; },
      fn(ctl, a, w) {
        const P = ctl.P, b = ctl.b, t = a.t;
        const low = bump(t, 0, 0.15, 0.55, 0.8);
        P.move(b.body, 0, -0.35 * low * w, 0);
        P.rx(b.body, -0.06 * low * w);
        P.rx(b.neck1, -0.3 * low * w); P.rx(b.head, 0.28 * low * w);
        tails(ctl, { stream: 1, fan: 0.5, sway: 0.4 }, low * w);
        ctl.ch.flame = Math.max(ctl.ch.flame, 1 + 0.6 * low);
        ctl.ch.flash = Math.max(ctl.ch.flash, 0.5 * bump(t, 0.1, 0.18, 0.3, 0.5));
      } },

    clone: { dur: 1.9, fin: 0.12, fout: 0.35, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const coil = bump(t, 0, 0.6, 0.85, 1.0), burst = bump(t, 0.85, 0.95, 1.05, 1.5);
      const jit = Math.sin(t * 55) * 0.25 * bump(t, 0.7, 0.9, 1.0, 1.25);
      P.move(b.body, jit * w, (-0.4 * coil + 0.2 * burst) * w, 0);
      P.rot(b.body, 0.06 * burst * w, jit * 0.3 * w, 0);
      P.rx(b.neck1, (-0.25 * coil + 0.2 * burst) * w); P.rx(b.head, (0.2 * coil - 0.1 * burst) * w);
      tails(ctl, { wrap: coil, fan: 1 - 0.6 * coil + 1.2 * burst, lift: -0.3 * coil + 0.4 * burst, curl: 0.4 * coil }, w);
      ctl.ch.flame = Math.max(ctl.ch.flame, 0.6 + 1.6 * burst);
      ctl.ch.flash = Math.max(ctl.ch.flash, 1.2 * burst + 0.3 * bump(t, 0.5, 0.7, 0.8, 0.9) * (0.5 + 0.5 * Math.sin(t * 40)));
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.35 * burst * w);
    } },

    foxfire_breath: { dur: 3.3, fin: 0.15, fout: 0.4, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const inhale = bump(t, 0, 0.8, 0.9, 1.1), blow = bump(t, 0.95, 1.15, 2.8, 3.2);
      const sweep = Math.sin((t - 1.0) * 1.6) * 0.35 * blow;
      P.move(b.body, 0, (0.15 * inhale - 0.2 * blow) * w, (0.2 * inhale - 0.3 * blow) * w);
      P.rot(b.body, (0.12 * inhale - 0.06 * blow) * w, sweep * 0.3 * w, 0);
      P.sc[b.chest].multiplyScalar(1 + 0.07 * inhale * w);
      P.rot(b.neck1, (0.25 * inhale - 0.3 * blow) * w, sweep * 0.5 * w, 0);
      P.rot(b.neck2, (0.1 * inhale - 0.1 * blow) * w, sweep * 0.4 * w, 0);
      P.rx(b.head, (0.25 * inhale + 0.15 * blow) * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.15 * inhale + 0.7 * blow) * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, (sstep(0, 0.9, t) * (1 - sstep(2.8, 3.3, t)) * 1.6) * w);
      tails(ctl, { fan: 1.4, lift: 0.25 * inhale }, w);
      ctl.ch.flame = Math.max(ctl.ch.flame, 1 + 0.5 * inhale);
    } },

    howl: { dur: 2.7, fin: 0.2, fout: 0.45, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const sit = bump(t, 0, 0.6, 2.1, 2.6), howl = bump(t, 0.7, 1.1, 2.0, 2.4);
      P.move(b.body, 0, -0.35 * sit * w, 0.35 * sit * w);
      P.rx(b.body, 0.3 * sit * w); P.rx(b.hips, 0.12 * sit * w);
      P.rx(b.neck1, (0.35 * sit + 0.1 * howl) * w); P.rx(b.neck2, 0.2 * howl * w);
      P.rx(b.head, (0.25 * sit + 0.45 * howl + Math.sin(t * 6) * 0.03 * howl) * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.55 * howl * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, 0.8 * howl * w);
      tails(ctl, { fan: 1 + 0.8 * howl, lift: 0.6 * howl, curl: -0.5 * howl, sway: 0.6 }, sit * w);
      ctl.ch.flame = Math.max(ctl.ch.flame, 1 + 1.0 * howl);
      ctl.u.ear = mix(ctl.u.ear, -0.6, howl * w);
      for (const L of ctl.gait.legs) if (L.id[0] === 'R') setLegOv(L, L.toe.x * 1.1, 0, L.toe.z - 0.35, sit * w, false);
    } },

    intro: { dur: 6.0, fin: 0.01, fout: 0.6, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const lie = 1 - sstep(1.0, 2.5, t), unfurl = sstep(2.3, 3.8, t), howl = bump(t, 3.8, 4.2, 4.9, 5.3), hunt = bump(t, 5.2, 5.6, 5.8, 6.0);
      P.move(b.body, 0, (-1.35 * lie - 0.3 * howl * 0 - 0.3 * hunt) * w, (0.2 * lie + 0.25 * howl) * w);
      P.rot(b.body, (0.05 * lie + 0.22 * howl - 0.08 * hunt) * w, 0.25 * lie * w, 0);
      P.rot(b.neck1, (-0.55 * lie + 0.35 * howl - 0.2 * hunt) * w, 0.5 * lie * w, 0);
      P.rot(b.neck2, (-0.1 * lie + 0.2 * howl) * w, 0.3 * lie * w, 0);
      P.rot(b.head, (0.3 * lie + 0.45 * howl + 0.15 * hunt) * w, 0.2 * lie * w, 0.15 * lie * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.6 * howl * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, 0.9 * howl * w);
      ctl.ch.eye = Math.min(ctl.ch.eye, mix(1, 0.1, (1 - sstep(1.3, 1.8, t)) * w));
      ctl.ch.flame = Math.max(0.08, Math.min(ctl.ch.flame, 0.08 + unfurl * 1.0) + 1.1 * howl);
      tails(ctl, { wrap: 1 - unfurl, fan: 1 + 0.7 * howl, lift: 0.5 * howl - 0.2 * (1 - unfurl), curl: 0.4 * (1 - unfurl) - 0.4 * howl }, w);
      for (const L of ctl.gait.legs) {
        const front = L.id[0] === 'F';
        setLegOv(L, L.toe.x * 1.05, front ? 0 : 0.2, L.toe.z + (front ? -0.8 : -0.1), lie * w, false, front ? 0.4 : 0);
      }
      ctl.u.ear = mix(ctl.u.ear, -0.5, (lie + howl) * w);
    } },

    channel: { dur: 2.0, loop: true, fin: 0.5, fadeOut: 0.5, fn(ctl, a, w) {
      // sits tall gathering fire: tails fanned high like a burning halo, flames swelling with every beat
      const P = ctl.P, b = ctl.b, t = a.t, beat = Math.pow(0.5 + 0.5 * Math.sin(t / 2.0 * TAU - 1.2), 2);
      P.move(b.body, 0, -0.3 * w, 0.3 * w); P.rx(b.body, 0.28 * w); P.rx(b.hips, 0.12 * w);
      P.rx(b.neck1, 0.3 * w); P.rx(b.head, (0.15 + 0.05 * beat) * w);
      tails(ctl, { fan: 1.9, lift: 0.7, curl: -0.6, sway: 0.5 + beat * 0.3, twist: 0.3 }, w);
      ctl.ch.flame = Math.max(ctl.ch.flame, 1.3 + 0.7 * beat);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.2 * beat * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.2 * w);
      for (const L of ctl.gait.legs) if (L.id[0] === 'R') setLegOv(L, L.toe.x * 1.1, 0, L.toe.z - 0.35, w, false);
    } },

    groggy: { dur: 3.0, loop: true, fin: 0.4, pre(ctl, a, w) { ctl.ch.groggy = Math.max(ctl.ch.groggy, w); }, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, tt = a.t % 3;
      const shake = bump(tt, 1.9, 2.05, 2.4, 2.6);
      P.rot(b.head, 0, Math.sin(a.t * 24) * 0.2 * shake * w, Math.sin(a.t * 24) * 0.15 * shake * w);
    } },

    death: { dur: 3.3, hold: true, fin: 0.05, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const stag = bump(t, 0, 0.3, 0.5, 0.9), fall = sm((t - 0.5) / 1.3);
      const bounce = t > 1.8 ? Math.sin(clamp01((t - 1.8) / 0.3) * Math.PI) * 0.05 : 0;
      P.move(b.body, 0.25 * fall * w, (0.15 * stag - 1.95 * fall + bounce) * w, 0);
      P.rot(b.body, (-0.1 * stag) * w, 0, 1.3 * fall * w);
      P.rot(b.neck1, (0.2 * stag - 0.3 * fall) * w, 0.2 * fall * w, -0.2 * fall * w);
      P.rot(b.head, (0.3 * stag - 0.1 * fall) * w, 0, -0.4 * fall * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.5 * stag + 0.25 * fall) * w);
      tails(ctl, { fan: 1 + 0.3 * fall, lift: -0.4 * fall, sway: 1 - fall, curl: 0 }, w);
      for (const L of ctl.gait.legs) {
        const up = L.side > 0, front = L.id[0] === 'F';
        setLegOv(L, L.toe.x * 1.2 + (up ? 0.2 : 0), up ? 0.7 : 0.2, L.toe.z + (front ? -0.5 : 0.5), fall * w, true, -0.5);
      }
    } },
  };
  return { gait, init, channels, base, finish, material, actions: A, aliases: { roar: 'howl' } };
}
