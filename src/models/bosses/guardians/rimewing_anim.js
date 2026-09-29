// Rimewing animation: knuckle-walking gait (wing hands are the front feet), flight (hover / forward flight with
// flapping, billowing membranes), wing posture params blended by actions, and every guardian action.
import * as THREE from 'three';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';

const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const bump = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));   // trapezoid envelope
const WKEYS = ['open', 'flap', 'sweep', 'twist', 'lag', 'curl', 'tuck', 'fan'];

export function rimewingSpec(J) {
  const FLY_H = 5.5;
  const restQ = (s) => {
    const d0 = V(J.kn).sub(V(J.wr)); d0.x *= s; d0.normalize();
    return new THREE.Quaternion().setFromUnitVectors(d0, new THREE.Vector3(0.22 * s, -1, -0.28).normalize());
  };
  const M = (p, s) => [p[0] * s, p[1], p[2]];
  const legF = (s, n) => ({ id: 'F' + n, chain: ['wing0' + n, 'wing1' + n, 'wing2' + n], toe: [1.7 * s, 0, -2.05], contact: M(J.kn, s), restQ: restQ(s), body: 'chest', lift: 0.6, flex: 0.5, out: 0.3, pole: [0.35 * s, 1, 0.5], heel: 0.05, strength: 0.8 });
  const legH = (s, n) => ({ id: 'H' + n, chain: ['thigh' + n, 'shin' + n, 'meta' + n, 'foot' + n], toe: [0.78 * s, 0, 0.32], body: 'hips', lift: 0.42, flex: 0.9, out: 0.12, metaK: 0.8, heel: 0.3, strength: 1 });
  const gait = {
    legs: [legF(-1, 'L'), legF(1, 'R'), legH(-1, 'L'), legH(1, 'R')],
    maxStride: 3.0, actV: 0.3, actTurn: 1.1, settleDist: 0.18,
    gaits: [
      { v: 2.8, f: 0.7, duty: 0.66, lift: 0.9, off: { HL: 0, FL: 0.25, HR: 0.5, FR: 0.75 }, bob: 0.07, bobF: 2, bobPh: 0.15, roll: 0.035, rollF: 1, sway: 0.06, swayF: 1, nod: 0.04, nodF: 2, nodPh: 0.3 },
      { v: 7.5, f: 1.0, duty: 0.4, lift: 1.25, off: { HL: 0, HR: 0.1, FL: 0.48, FR: 0.58 }, bob: 0.2, bobF: 1, bobPh: 0.55, pitch: 0.07, pitchF: 1, pitchPh: 0.1, flex: 0.1, flexF: 1, flexPh: 0.2, nod: 0.06, nodF: 1, nodPh: 0.75, lean: 0.07 },
    ],
  };
  // rest directions of the finger bones (per side) for re-aiming
  const RD = {};
  for (const [s, n] of [[-1, 'L'], [1, 'R']]) for (let f = 0; f < 3; f++) {
    RD[`a${f}${n}`] = V(M(J.fm[f], s)).sub(V(M(J.kn, s))).normalize();
    RD[`b${f}${n}`] = V(M(J.ft[f], s)).sub(V(M(J.fm[f], s))).normalize();
  }

  // folded fingers: first phalanx up along the forearm towards the elbow, second back over the flank
  function foldFingers(ctl, P, L) {
    const s = L.side, n = s < 0 ? 'L' : 'R', b = ctl.b;
    const fold = ctl.u.fold[n];
    if (fold < 0.002) return;
    const cq = P.wq[b.chest];
    const el = P.wp[b['wing1' + n]], sh = P.wp[b['wing0' + n]];
    for (let f = 0; f < 3; f++) {
      const ia = b[`f${f}a${n}`], ib = b[`f${f}b${n}`];
      // phalanx 1 runs up along the forearm towards the elbow (slightly fanned outward / back)
      _v2.set(s * (0.12 + f * 0.05), 0.1 - f * 0.05, 0.08 + f * 0.16).applyQuaternion(cq);
      _v.copy(el).sub(P.wp[ia]).normalize().add(_v2).normalize();
      _q.setFromUnitVectors(RD[`a${f}${n}`], _v); P.wq[ia].slerp(_q, fold);
      P.wp[ib].copy(P.rest[ib]).sub(P.rest[ia]).applyQuaternion(P.wq[ia]).add(P.wp[ia]);
      // phalanx 2 sweeps back over the flank from elbow height
      _v.set(s * (0.28 - f * 0.06), 0.62 - f * 0.3, 1).normalize().applyQuaternion(cq);
      _q.setFromUnitVectors(RD[`b${f}${n}`], _v); P.wq[ib].slerp(_q, fold);
    }
  }

  function init(ctl) {
    ctl.u = { flapPh: 0, fold: { L: 1, R: 1 }, W: { L: {}, R: {} }, look: { y: 0, p: 0, ty: 0, tp: 0, timer: 2 }, jaw: 0, spin: 0 };
    for (const L of ctl.gait.legs) if (L.id[0] === 'F') L.after = (P, L2) => foldFingers(ctl, P, L2);
    ctl.lift = 0;
  }
  function channels(ctl, ch) { ch.altMul = 1; ch.eye = 1; ch.pitchAir = 0; }

  /** blend wing posture params toward `p` by weight w (side: 'L' | 'R' | undefined = both) */
  function wing(ctl, p, w, side) {
    for (const n of side ? [side] : ['L', 'R']) { const W = ctl.u.W[n]; for (const k in p) W[k] = mix(W[k], p[k], w); }
  }
  const setLegOv = (L, x, y, z, w, local = false, paw = 0) => {
    if (!L.override) L.override = new THREE.Vector3();
    L.override.set(x, y, z); L.overrideW = Math.max(L.overrideW, w); L.overrideLocal = local; L.overridePaw = paw;
  };

  function base(ctl, dt) {
    const P = ctl.P, b = ctl.b, G = ctl.gait, ch = ctl.ch, u = ctl.u, t = ctl.t;
    const fly = sm(ctl.fly), gr = 1 - fly;
    const aspd = Math.abs(G.sSm), run = sstep(3.2, 7, aspd) * gr;
    const idle = (1 - clamp01(G.act * 1.5)) * gr;
    const grog = ctl.groggy * gr, enr = ctl.enrage;
    // ---- flight rhythm
    const fwd = sstep(1.5, 7, Math.abs(ctl.speed)) * fly;
    const period = mix(1.18, 1.35, fwd);
    u.flapPh = (u.flapPh + dt / period) % 1;
    const ph = u.flapPh * TAU, down = Math.cos(ph);
    // ---- wing posture defaults
    for (const n of ['L', 'R']) {
      const W = u.W[n];
      for (const k of WKEYS) W[k] = 0;
      W.open = fly;
      W.flap = fly * (0.12 + down * mix(0.62, 0.5, fwd));
      W.lag = fly * -Math.sin(ph) * 0.5;
      W.curl = fly * Math.max(0, Math.sin(ph)) * 0.5;
      W.sweep = fly * (-0.05 - 0.12 * fwd);
      W.twist = fly * (0.05 + 0.15 * Math.sin(ph));
      W.fan = fly * 0.3;
    }
    // ---- body
    const breath = Math.sin(t * TAU * mix(0.22, 0.45, Math.max(enr, run)));
    P.sc[b.chest].setScalar(1 + breath * 0.012);
    const hoverBob = -Math.sin(ph) * 0.28 * fly;
    const alt = FLY_H * fly * ch.altMul;
    ctl.lift = alt + hoverBob;
    const crouch = 0.12 * gr * (1 - run) + 0.25 * grog;
    P.move(b.body, G.sway * gr, G.bob * gr - crouch + alt + hoverBob + G.gOff, 0);
    const airPitch = fly * (mix(0.28, -0.04, fwd) + ch.pitchAir + Math.sin(ph) * 0.03);
    P.rot(b.body, (G.pitch + G.gPitch) * gr - G.lean * 0.4 + airPitch + 0.05 * grog, 0, (G.roll + G.gRoll) * gr + ctl.turn * 0.12 * (gr * clamp01(aspd / 4) + fly * 1.5));
    P.rx(b.chest, G.flex * gr - 0.04 * breath * 0.3);
    P.rx(b.hips, -G.flex * 0.8 * gr);
    // ---- look around (idle)
    const L = u.look;
    L.timer -= dt;
    if (L.timer <= 0) { L.timer = 2 + Math.random() * 3.5; L.ty = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.1; L.tp = (Math.random() - 0.5) * 0.3; }
    const lk = idle * (1 - grog);
    L.y += (L.ty * lk - L.y) * (1 - Math.exp(-2.5 * dt)); L.p += (L.tp * lk - L.p) * (1 - Math.exp(-2.5 * dt));
    // ---- neck & head: S-curve on the ground, extended forward in flight; groggy droop
    const stab = -(G.pitch + G.flex) * 0.8 * gr;
    const nk = [0.12, 0.06, -0.02, -0.1], nkAir = [-0.22, -0.16, -0.08, 0.02];
    const nkGrog = [-0.35, -0.2, -0.1, 0.05];
    const sway = Math.sin(t * 0.5) * 0.05 * (1 - fly) + Math.sin(t * 1.1) * 0.12 * grog;
    for (let i = 0; i < 4; i++) {
      const pitch = nk[i] * gr + nkAir[i] * fly + nkGrog[i] * grog - 0.05 * run + stab * 0.25 + L.p * 0.25 - 0.04 * enr;
      P.rot(b['neck' + (i + 1)], pitch, L.y * 0.22 + sway * 0.5 + ctl.turn * 0.08, sway * 0.3 * grog);
    }
    P.rot(b.head, -0.16 * gr - 0.28 * fly + stab * 0.4 + G.nod * gr + L.p * 0.4 + 0.35 * grog + Math.sin(t * 1.7) * 0.03, L.y * 0.3 + sway * 0.4, Math.sin(t * 0.9) * 0.2 * grog);
    ch.jaw = Math.max(ch.jaw, 0.04 + 0.03 * Math.sin(t * 2.1) + 0.12 * enr * (0.5 + 0.5 * Math.sin(t * 4.3)) + 0.2 * grog);
    ch.throat = Math.max(ch.throat, 0.12 + 0.1 * breath + 0.25 * enr);
    ch.eye = Math.min(ch.eye, 1 - 0.65 * grog);
    // ---- tail: lazy S-wave, raised & lashing when enraged, streaming in flight
    for (let i = 0; i < 8; i++) {
      const f = i / 7;
      const wav = Math.sin(t * (0.8 + enr * 1.2 + run * 1.5) - i * 0.55) * (0.04 + f * 0.07) * (1 + enr * 0.6 + run * 0.4) * (1 - 0.6 * fly);
      const wavAir = Math.sin(t * 1.6 - i * 0.6) * 0.03 * fly;
      const pitch = (i < 3 ? 0.02 : -0.03) * gr + (i < 2 ? -0.12 : 0.03) * fly - 0.06 * grog * (i < 4 ? 1 : 0) + Math.sin(ph - i * 0.5) * 0.03 * fly;
      P.rot(b['tail' + (i + 1)], pitch, wav + wavAir - ctl.turn * 0.05, 0);
    }
    // ---- hind legs tuck back in flight (FK), IK blends out
    if (fly > 0.001) for (const n of ['L', 'R']) {
      P.rx(b['thigh' + n], -1.25 * fly); P.rx(b['shin' + n], 0.55 * fly); P.rx(b['meta' + n], -0.9 * fly); P.rx(b['foot' + n], 1.1 * fly);
    }
    for (const Lg of G.legs) Lg.ikW = Lg.id[0] === 'H' ? 1 - fly : 1;
    // groggy: wide, sagging stance
    for (const Lg of G.legs) Lg.homeOff.set(Lg.side * 0.2 * grog, 0, (Lg.id[0] === 'F' ? -0.2 : 0.1) * grog);
  }

  function finish(ctl, dt) {
    const P = ctl.P, b = ctl.b, u = ctl.u, ch = ctl.ch;
    for (const [s, n] of [[-1, 'L'], [1, 'R']]) {
      const W = u.W[n];
      const open = clamp01(W.open);
      u.fold[n] = 1 - open;
      const leg = ctl.gait.legs[s < 0 ? 0 : 1];
      leg.ikW = Math.min(leg.ikW, 1 - open);
      // FK wing (only visible where IK is weighted out)
      P.rot(b['wing0' + n], W.twist, s * (W.sweep - W.tuck * 0.9), s * W.flap);
      P.rot(b['wing1' + n], 0, s * (W.tuck * 1.2 - W.curl * 0.45), s * (-W.lag * 0.55 - W.tuck * 0.25));
      P.rot(b['wing2' + n], 0, s * (-W.tuck * 1.1 + W.curl * 0.55), s * (-W.lag * 0.45));
      for (let f = 0; f < 3; f++) {
        P.rot(b[`f${f}a${n}`], 0, s * (W.fan * (1 - f) * 0.14 - W.curl * (0.2 + f * 0.18) - W.tuck * (0.5 + f * 0.2)), s * (-W.lag * 0.3));
        P.rot(b[`f${f}b${n}`], 0, s * (-W.curl * 0.3 - W.tuck * 0.4), s * (-W.lag * 0.35));
      }
    }
    // jaw
    u.jaw += (ch.jaw - u.jaw) * (1 - Math.exp(-20 * dt));
    P.rx(b.jaw, -u.jaw);
  }

  function material(ctl, U, dt) {
    const u = ctl.u, ch = ctl.ch;
    U.uThroat.value += (ch.throat - U.uThroat.value) * (1 - Math.exp(-8 * dt));
    U.uEye.value = ch.eye;
    const fly = ctl.fly;
    const bil = -Math.cos(u.flapPh * TAU) * 0.25 * fly + (u.W.L.open - fly) * 0.05;
    U.uBillow.value.set(bil, bil);
    U.uGlowK.value = ctl.dead ? Math.max(0.05, U.uGlowK.value - dt * 0.4) : 1 + ctl.enrage * 0.35;
  }

  // ---------------------------------------------------------------- actions
  const loco = (speed, turn) => ({ loop: true, fin: 0.3, pre(ctl) { if (ctl.st.speed === undefined && ctl.st.turn === undefined) { ctl.ch.locoSpeed = speed || 0; ctl.ch.locoTurn = turn || 0; } } });
  const A = {
    idle: { dur: 4, loop: true },
    walk: { dur: 1.35, ...loco(3) },
    run: { dur: 0.95, ...loco(7.5) },
    turn: { dur: 1.6, ...loco(0, 1.0) },
    fly: { dur: 1.25, loop: true, overlay: true, fin: 0.01, start(ctl) { ctl.airLatch = 1; } },

    bite: { dur: 1.35, fin: 0.12, fout: 0.35, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const wind = bump(t, 0, 0.42, 0.42, 0.56), lunge = bump(t, 0.44, 0.6, 0.72, 1.25);
      P.move(b.body, 0, (-0.12 * wind - 0.3 * lunge) * w, (0.4 * wind - 1.0 * lunge) * w);
      P.rx(b.body, (0.06 * wind - 0.12 * lunge) * w);
      const np = [0.2, 0.18, 0.12, 0.05], nl = [-0.3, -0.25, -0.12, 0.1];
      for (let i = 0; i < 4; i++) P.rx(b['neck' + (i + 1)], (np[i] * wind + nl[i] * lunge) * w);
      P.rx(b.head, (0.35 * wind - 0.15 * lunge) * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, bump(t, 0.1, 0.42, 0.55, 0.63) * 0.9 * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, 0.4 * wind * w);
      wing(ctl, { open: 0.15 * wind }, w);
    } },

    claw: { dur: 1.6, fin: 0.15, fout: 0.35, fn(ctl, a, w) {
      // rears onto its left side and raises the right wing-arm high (the counter window), then slams it down ahead
      const P = ctl.P, b = ctl.b, t = a.t;
      const raise = bump(t, 0.05, 0.45, 0.72, 0.86), slam = bump(t, 0.72, 0.86, 1.05, 1.5), hold = bump(t, 0.4, 0.5, 0.7, 0.8);
      P.move(b.body, (-0.25 * raise + 0.2 * slam) * w, (0.35 * raise - 0.25 * slam) * w, (0.2 * raise - 0.5 * slam) * w);
      P.rot(b.body, (0.28 * raise - 0.12 * slam) * w, (0.2 * raise - 0.1 * slam) * w, (-0.18 * raise + 0.05 * slam) * w);
      P.rot(b.neck2, (-0.1 * raise + 0.1 * slam) * w, (-0.25 * raise) * w, 0);
      P.rot(b.head, (0.2 * raise - 0.2 * slam) * w, (-0.15 * raise) * w, 0);
      const L = ctl.gait.legs[1];
      const k = sstep(0.72, 0.86, t), sh = Math.sin(t * 40) * 0.05 * hold;
      const up = [2.0 + sh, 3.3 + 0.25 * hold, -2.0], dn = [1.3, 0, -3.35];
      setLegOv(L, mix(up[0], dn[0], k), mix(up[1], dn[1], k), mix(up[2], dn[2], k), bump(t, 0.05, 0.45, 1.05, 1.5) * w, false, mix(-0.9, 0, k));
      wing(ctl, { open: 0.25 * raise }, w, 'L');
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.3 * raise + 0.5 * slam) * w);
    } },

    tail_sweep: { dur: 2.1, fin: 0.1, fout: 0.3, fn(ctl, a, w) {
      // crouch, pivot-hop a full turn with the tail swinging wide, land
      const P = ctl.P, b = ctl.b, t = a.t;
      const crouch = bump(t, 0, 0.35, 0.4, 0.55) + bump(t, 1.45, 1.6, 1.7, 2.0) * 0.6;
      const spinK = sm((t - 0.4) / 1.1);
      const ang = (spinK * TAU) % TAU;
      const hop = Math.sin(clamp01((t - 0.4) / 1.1) * Math.PI);
      P.move(b.body, 0, (-0.3 * crouch + 0.35 * hop) * w, 0);
      P.prot(b.body, _v.set(0, 1, 0), ang * w);
      for (let i = 0; i < 8; i++) P.rot(b['tail' + (i + 1)], (i < 3 ? 0.06 : 0) * hop * w, -Math.sin(spinK * Math.PI) * (0.12 + i * 0.03) * w, 0);
      for (let i = 0; i < 4; i++) P.rot(b['neck' + (i + 1)], -0.05 * hop * w, Math.sin(spinK * Math.PI) * 0.12 * w, 0);
      const c = Math.cos(ang), s = Math.sin(ang), bx = 0, bz = 0.15;
      for (const L of ctl.gait.legs) {
        const hx = L.home.x - bx, hz = L.home.z - bz;
        setLegOv(L, bx + hx * c + hz * s, 0.35 * hop * (L.id[0] === 'F' ? 1.2 : 0.8), bz - hx * s + hz * c, w, false);
      }
      wing(ctl, { open: 0.2 * hop }, w);
    } },

    breath: { dur: 3.8, fin: 0.2, fout: 0.45, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const inhale = bump(t, 0, 1.0, 1.1, 1.35), blow = bump(t, 1.15, 1.4, 3.1, 3.6);
      const sweep = Math.sin((t - 1.3) * 1.35) * 0.32 * blow;
      P.move(b.body, 0, (0.3 * inhale - 0.28 * blow) * w, (0.35 * inhale - 0.45 * blow) * w);
      P.rot(b.body, (0.2 * inhale - 0.08 * blow) * w, sweep * 0.3 * w, 0);
      P.sc[b.chest].multiplyScalar(1 + 0.08 * inhale * w);
      const ni = [0.22, 0.2, 0.12, 0.02], nb = [-0.3, -0.24, -0.1, 0.12];
      for (let i = 0; i < 4; i++) P.rot(b['neck' + (i + 1)], (ni[i] * inhale + nb[i] * blow) * w, sweep * (0.3 + i * 0.1) * w, 0);
      P.rx(b.head, (0.3 * inhale + 0.05 * blow) * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.2 * inhale + 0.85 * blow + Math.sin(t * 30) * 0.03 * blow) * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, (sstep(0, 1.1, t) * (1 - sstep(3.1, 3.7, t)) * 1.3) * w);
      wing(ctl, { open: 0.3 * inhale + 0.18 * blow, flap: 0.4 * inhale }, w);
    } },

    takeoff: { dur: 2.4, fin: 0.15, fout: 0.25,
      pre(ctl, a) {
        const t = a.t;
        ctl.ch.air = clamp01(sm((t - 0.6) / 1.6) * 1.0);
        if (t < 0.6) ctl.ch.air = 0;
      },
      end(ctl) { ctl.airLatch = 1; },
      fn(ctl, a, w) {
        const P = ctl.P, b = ctl.b, t = a.t;
        const crouch = bump(t, 0, 0.5, 0.55, 0.75), leap = bump(t, 0.6, 0.8, 1.2, 1.8);
        P.move(b.body, 0, (-0.55 * crouch + 0.4 * leap) * w, 0);
        P.rx(b.body, (-0.1 * crouch + 0.2 * leap) * w);
        // strokes: raise (0.1-0.6), slam (0.6-0.9), recover, second stroke, settle into hover
        let flap, lag;
        if (t < 0.6) { flap = 1.0 * sstep(0.05, 0.55, t); lag = 0.3 * sstep(0.1, 0.5, t); }
        else if (t < 0.9) { flap = 1.0 - 1.7 * sm((t - 0.6) / 0.3); lag = -0.5; }
        else if (t < 1.3) { flap = -0.7 + 1.5 * sm((t - 0.9) / 0.4); lag = 0.45; }
        else if (t < 1.65) { flap = 0.8 - 1.4 * sm((t - 1.3) / 0.35); lag = -0.45; }
        else { flap = -0.6 + 0.75 * sm((t - 1.65) / 0.6); lag = 0.1; }
        const open = sstep(0.0, 0.45, t);
        wing(ctl, { open, flap, lag, curl: lag > 0 ? lag * 0.7 : 0, fan: 0.4, twist: 0.1 }, w * (1 - sstep(2.0, 2.4, t)));
        for (let i = 0; i < 4; i++) P.rx(b['neck' + (i + 1)], (-0.05 * leap + 0.06 * crouch) * w);
      } },

    land: { dur: 2.0, fin: 0.1, fout: 0.3,
      pre(ctl, a) { const t = a.t; ctl.ch.air = 1 - sm(t / 1.15); if (t >= 1.15) ctl.ch.air = 0; ctl.airLatch = 0; },
      fn(ctl, a, w) {
        const P = ctl.P, b = ctl.b, t = a.t;
        const flare = bump(t, 0, 0.35, 0.9, 1.2), impact = bump(t, 1.08, 1.18, 1.25, 1.75);
        P.move(b.body, 0, -0.5 * impact * w, 0);
        P.rx(b.body, (0.18 * flare - 0.1 * impact) * w);
        const open = 1 - sstep(1.15, 1.8, t);
        const fl = 0.35 * flare + Math.sin(t * 9) * 0.25 * flare - 0.25 * impact;
        wing(ctl, { open, flap: fl, sweep: 0.3 * flare, fan: 0.6, twist: -0.35 * flare, lag: -0.2 * flare }, w);
        for (let i = 0; i < 4; i++) P.rx(b['neck' + (i + 1)], (0.05 * flare - 0.08 * impact) * w);
      } },

    dive: { dur: 2.9, fin: 0.15, fout: 0.3,
      pre(ctl, a) {
        const t = a.t;
        const up = bump(t, 0, 0.8, 0.9, 1.0), plunge = bump(t, 0.95, 1.4, 1.5, 2.6);
        ctl.ch.altMul = 1 + 0.25 * up - 0.85 * plunge;
        ctl.ch.pitchAir = 0.35 * up - 0.75 * bump(t, 0.95, 1.2, 1.25, 1.45) + 0.25 * bump(t, 1.45, 1.7, 1.9, 2.4);
      },
      fn(ctl, a, w) {
        const P = ctl.P, b = ctl.b, t = a.t;
        const up = bump(t, 0, 0.8, 0.9, 1.0), plunge = bump(t, 0.95, 1.15, 1.4, 1.55), strike = bump(t, 1.3, 1.42, 1.5, 1.75), climb = bump(t, 1.5, 1.8, 2.4, 2.9);
        wing(ctl, { flap: 0.9 * up - 0.1 * plunge + Math.cos(t * 7) * 0.6 * climb, tuck: 0.7 * plunge, sweep: -0.25 * plunge, lag: 0.35 * up - 0.3 * climb * Math.sin(t * 7), curl: 0.2 * up }, w);
        const L = ctl.gait.legs;
        for (const Lg of L.slice(2)) { const s = Lg.side; P.rx(b['thigh' + (s < 0 ? 'L' : 'R')], 1.4 * strike * w); P.rx(b['meta' + (s < 0 ? 'L' : 'R')], 0.6 * strike * w); }
        for (let i = 0; i < 4; i++) P.rx(b['neck' + (i + 1)], (0.08 * up - 0.1 * plunge) * w);
        P.rx(b.head, (-0.3 * up - 0.2 * plunge) * w);
        ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.6 * plunge + 0.4 * strike) * w);
      } },

    ice_spikes: { dur: 3.1, fin: 0.2, fout: 0.4, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const rear = bump(t, 0, 0.8, 1.3, 1.55), slam = bump(t, 1.45, 1.6, 1.9, 2.4), roar = bump(t, 0.7, 1.0, 2.5, 2.9), pulse2 = bump(t, 2.0, 2.15, 2.25, 2.6);
      const shake = Math.sin(t * 38) * 0.03 * roar;
      P.move(b.body, 0, (0.55 * rear - 0.35 * slam) * w, (0.5 * rear - 0.2 * slam) * w);
      P.rot(b.body, (0.52 * rear - 0.1 * slam) * w, shake * w, shake * 0.5 * w);
      const nr = [0.25, 0.15, 0.0, -0.12], ns = [-0.25, -0.18, -0.05, 0.12];
      for (let i = 0; i < 4; i++) P.rot(b['neck' + (i + 1)], (nr[i] * rear + ns[i] * slam) * w, shake * w, 0);
      P.rx(b.head, (0.35 * rear - 0.1 * slam + 0.1 * pulse2) * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.3 * rear + 0.9 * roar) * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, (0.6 * rear + 1.2 * roar) * w);
      wing(ctl, { open: rear, flap: 0.6 * rear + Math.sin(t * 20) * 0.05 * roar, sweep: 0.15 * rear, fan: 0.7, twist: -0.15 * rear }, w);
    } },

    wing_gust: { dur: 2.5, fin: 0.2, fout: 0.4, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const rear = bump(t, 0, 0.7, 1.85, 2.3);
      // two mighty forward strokes: down at 1.2 and 1.6
      const st = (x) => Math.max(0, Math.sin(Math.PI * clamp01(x)));
      let flap = 0.9 * sstep(0.2, 0.7, t);
      flap -= 1.6 * st((t - 0.98) / 0.45) + 1.5 * st((t - 1.4) / 0.45);
      flap += 0.9 * st((t - 1.3) / 0.3) * 0;
      const sweepF = 0.55 * st((t - 0.98) / 0.45) + 0.5 * st((t - 1.4) / 0.45);
      P.move(b.body, 0, 0.5 * rear * w, 0.55 * rear * w);
      P.rx(b.body, (0.45 * rear - 0.08 * sweepF) * w);
      for (let i = 0; i < 4; i++) P.rx(b['neck' + (i + 1)], (0.08 - 0.12 * sweepF) * rear * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.4 * sweepF * w);
      wing(ctl, { open: rear, flap: flap * rear, sweep: sweepF * 0.8, fan: 0.8, twist: -0.3 * sweepF, lag: 0.3 * sweepF }, w);
    } },

    intro: { dur: 6.0, fin: 0.01, fout: 0.6, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const low = 1 - sstep(0.6, 2.0, t);
      const rise = bump(t, 1.8, 2.8, 4.3, 5.1), roar = bump(t, 2.7, 3.2, 4.1, 4.5), thud = bump(t, 4.9, 5.05, 5.2, 5.8);
      const shake = Math.sin(t * 36) * 0.035 * roar;
      P.move(b.body, 0, (-0.7 * low + 0.6 * rise - 0.3 * thud) * w, (0.5 * rise) * w);
      P.rot(b.body, (-0.12 * low + 0.55 * rise - 0.08 * roar) * w, shake * w, shake * 0.6 * w);
      const nl = [-0.35, -0.25, -0.1, 0.1], nr = [0.25, 0.12, -0.05, -0.18], no = [-0.2, -0.15, -0.05, 0.1];
      const look = bump(t, 0.9, 1.6, 2.0, 2.4);
      for (let i = 0; i < 4; i++) P.rot(b['neck' + (i + 1)], (nl[i] * low + nr[i] * rise + no[i] * roar + 0.08 * look) * w, (Math.sin(t * 1.3) * 0.12 * look + shake) * w, 0);
      P.rx(b.head, (0.4 * low + 0.3 * rise + 0.2 * roar) * w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.95 * roar + 0.1 * look) * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, (0.3 * look + 1.4 * roar) * w);
      ctl.ch.eye = Math.min(ctl.ch.eye, mix(1, 0.15, low * w));
      wing(ctl, { open: rise, flap: 0.75 * rise + Math.sin(t * 22) * 0.06 * roar - 0.2 * roar, sweep: 0.1 * rise, fan: 0.9, twist: -0.2 * rise, lag: 0.15 * roar }, w);
    } },

    groggy: { dur: 3.0, loop: true, fin: 0.4, pre(ctl, a, w) { ctl.ch.groggy = Math.max(ctl.ch.groggy, w); }, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const shakeK = bump(a.t % 3.0, 1.9, 2.05, 2.4, 2.6);
      P.rot(b.head, 0, Math.sin(t * 24) * 0.18 * shakeK * w, Math.sin(t * 24) * 0.12 * shakeK * w);
    } },

    death: { dur: 3.6, hold: true, fin: 0.05, fn(ctl, a, w) {
      const P = ctl.P, b = ctl.b, t = a.t;
      const throe = bump(t, 0, 0.35, 0.6, 1.1), fall = sm((t - 0.7) / 1.5), settle = sstep(2.2, 3.4, t);
      const bounce = t > 2.2 ? Math.sin(clamp01((t - 2.2) / 0.3) * Math.PI) * 0.06 : 0;
      P.move(b.body, (0.35 * fall) * w, (0.35 * throe - 1.28 * fall + bounce) * w, 0);
      P.rot(b.body, (0.35 * throe - 0.08 * fall) * w, 0.12 * fall * w, (1.15 * fall) * w);
      const nf = [-0.3, -0.25, -0.2, -0.1];
      for (let i = 0; i < 4; i++) P.rot(b['neck' + (i + 1)], (0.2 * throe + nf[i] * fall) * w, (0.12 * fall) * w, (-0.3 * fall) * w);
      P.rot(b.head, (0.45 * throe + 0.2 * fall) * w, 0, (-0.5 * fall) * w);
      for (let i = 0; i < 8; i++) P.rot(b['tail' + (i + 1)], (i < 3 ? 0.12 : -0.02) * fall * w, 0.07 * fall * w, 0);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.9 * throe + 0.35 * fall) * w);
      ctl.ch.throat = Math.max(ctl.ch.throat, 0.8 * throe * w);
      ctl.ch.eye = Math.min(ctl.ch.eye, 1 - settle);
      // legs go limp and splay; the upper wing drapes open over the body
      for (const L of ctl.gait.legs) {
        const up = L.side > 0, front = L.id[0] === 'F';
        const x = L.toe.x * (front ? 1.4 : 1.2), z = L.toe.z + (front ? -0.4 : 0.4);
        setLegOv(L, x + (up ? 0.4 : -0.3), up ? 0.9 : 0.05, z, fall * w, true, -0.6);
      }
      wing(ctl, { open: 0.55 * fall, flap: -0.3 * fall, sweep: 0.3 * fall, fan: 0.5 }, w, 'R');
      wing(ctl, { open: 0.35 * fall, flap: 0.6 * fall, sweep: -0.1 * fall }, w, 'L');
    } },
  };

  return { gait, init, channels, base, finish, material, actions: A, flyHeight: FLY_H };
}
