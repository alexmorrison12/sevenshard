// Nerissa animation: floating hover with a slow bob, eel-like travelling waves down the tail, drifting hair fronds,
// conductor arms while singing, and every boss action. `ch.burrow` doubles as "submerged" (dive / intro / death).
import * as THREE from 'three';
import { sstep, clamp01, mix, TAU } from '../../kit/rig.js';

const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const bump = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));
const PK = ['lean', 'arms', 'armsUp', 'armsFwd', 'clasp', 'headUp', 'tailUp', 'tailCurl', 'tailSide', 'hairUp', 'hairBack', 'rise', 'twist', 'sway', 'pitch', 'wave'];

export function nerissaSpec(J, D) {
  const { NT, NH, HB } = D;
  const DEPTH = 7.5;
  function init(ctl) { ctl.u = { W: {}, jaw: 0, look: { y: 0, p: 0, ty: 0, tp: 0, timer: 2 } }; ctl.lift = 0; }
  function pose(ctl, p, w) { const W = ctl.u.W; for (const k in p) W[k] = mix(W[k], p[k], w); }

  function base(ctl, dt) {
    const t = ctl.t, W = ctl.u.W, ch = ctl.ch, L = ctl.u.look;
    for (const k of PK) W[k] = 0;
    const grog = ctl.groggy, enr = ctl.enrage;
    W.sway = 1 + 0.5 * enr - 0.4 * grog; W.wave = 1 + 0.6 * enr;
    W.arms = 0.25 - 0.2 * grog; W.lean = 0.35 * grog; W.headUp = -0.4 * grog; W.rise = -0.9 * grog; W.tailCurl = 0.1;
    L.timer -= dt;
    if (L.timer <= 0) { L.timer = 2 + Math.random() * 3; L.ty = (Math.random() - 0.5) * 0.9; L.tp = (Math.random() - 0.5) * 0.2; }
    L.y += (L.ty * (1 - grog) - L.y) * (1 - Math.exp(-2 * dt)); L.p += (L.tp - L.p) * (1 - Math.exp(-2 * dt));
    ch.eye = Math.min(ch.eye, 1 - 0.6 * grog);
    ch.throat = Math.max(ch.throat, 0.2 + 0.15 * Math.sin(t * 1.7) + 0.3 * enr);
    ch.jaw = Math.max(ch.jaw, 0.04 * grog);
  }

  function finish(ctl, dt) {
    const P = ctl.P, b = ctl.b, t = ctl.t, W = ctl.u.W, ch = ctl.ch, L = ctl.u.look;
    const sub = sm(ctl.burrow);
    ctl.lift = -DEPTH * sub + W.rise;
    const bob = Math.sin(t * 0.9) * 0.12 * W.sway;
    P.move(b.hips, Math.sin(t * 0.55) * 0.08 * W.sway, bob - DEPTH * sub + W.rise, 0);
    P.rot(b.hips, W.pitch + Math.sin(t * 0.9 + 0.6) * 0.03, W.twist * 0.4 + Math.sin(t * 0.4) * 0.06 * W.sway, Math.sin(t * 0.55) * 0.03 * W.sway);
    const br = Math.sin(t * 1.7);
    P.sc[b.chest].setScalar(1 + br * 0.015);
    P.rot(b.spine, W.lean * 0.5 + Math.sin(t * 0.9 + 1.2) * 0.03, W.twist * 0.3, Math.sin(t * 0.7) * 0.03);
    P.rot(b.chest, W.lean * 0.5 - 0.02 * br, W.twist * 0.3, 0);
    P.rot(b.neck, -W.headUp * 0.3 + L.p * 0.3, L.y * 0.4, 0);
    P.rot(b.head, -W.headUp * 0.7 + L.p * 0.6 + Math.sin(t * 1.1) * 0.03, L.y * 0.5, Math.sin(t * 0.6) * 0.08);
    // arms: drifting on the air; conductor spread (arms), raised (armsUp), reaching forward (armsFwd), clasped (clasp)
    for (const [s, n] of [[-1, 'L'], [1, 'R']]) {
      const drift = Math.sin(t * 0.8 + (s > 0 ? 0 : 1.7)) * 0.08 * W.sway;
      const out = W.arms * 0.9 + W.armsUp * 0.6 + drift;
      P.rot(b['arm' + n], -W.armsFwd * 1.1 - W.armsUp * 0.5 + W.clasp * -0.9, s * (W.clasp * 0.5), s * (out + W.armsUp * 1.2));
      P.rot(b['fore' + n], -0.25 - W.armsFwd * 0.3 - W.clasp * 0.9 + drift, s * W.clasp * 0.3, s * (W.armsUp * 0.3));
      P.rot(b['hand' + n], 0.1 + Math.sin(t * 1.3 + s) * 0.08, 0, s * (0.1 + W.armsUp * 0.2));
    }
    // tail: travelling eel wave (yaw + pitch), curl up (tailUp) and to the side
    for (let i = 0; i < NT; i++) {
      const f = i / (NT - 1);
      const ph = t * 1.6 * W.wave - i * 0.62;
      const yaw = Math.sin(ph) * (0.06 + 0.1 * f) * W.sway + W.tailSide * 0.18 * f;
      const pitch = Math.sin(ph * 0.7 + 1.1) * 0.04 * W.sway - W.tailUp * (i < 4 ? 0.28 : 0.2) + W.tailCurl * 0.08;
      P.rot(b['tail' + i], pitch, yaw, 0);
    }
    // hair: drifting fronds; lifted (hairUp) or streaming back (hairBack)
    for (let i = 0; i < NH; i++) {
      const a = (i - (NH - 1) / 2) / ((NH - 1) / 2);
      for (let j = 0; j < HB; j++) {
        const ph = t * 1.2 - j * 0.9 + i * 0.7;
        P.rot(b[`h${i}_${j}`], Math.sin(ph) * 0.07 - W.hairUp * 0.3 / (j + 1) + W.hairBack * 0.2, Math.sin(ph * 0.8 + 1) * 0.08 + a * W.hairUp * 0.15, 0);
      }
    }
    const u = ctl.u;
    u.jaw += (ch.jaw - u.jaw) * (1 - Math.exp(-16 * dt));
    P.rx(b.jaw, -u.jaw * 0.9);
  }
  function material(ctl, U, dt) {
    const ch = ctl.ch;
    U.uThroat.value += (Math.max(ch.throat, ch.sing) - U.uThroat.value) * (1 - Math.exp(-8 * dt));
    U.uEye.value = ctl.dead ? Math.max(0, U.uEye.value - dt * 0.3) : ch.eye;
    U.uFlash.value = ch.flash;
    U.uGlowK.value = ctl.dead ? Math.max(0.1, U.uGlowK.value - dt * 0.25) : 1 + 0.3 * ctl.enrage;
  }

  const A = {
    idle: { dur: 5, loop: true },

    sing: { dur: 2.4, loop: true, fin: 0.5, fadeOut: 0.6, fn(ctl, a, w) {
      const t = a.t, beat = Math.pow(0.5 + 0.5 * Math.sin(t / 2.4 * TAU - 1.2), 3);
      pose(ctl, { armsUp: 0.8, arms: 0.5, headUp: 0.45 + 0.1 * beat, hairUp: 0.8, rise: 0.5, sway: 1.4, tailCurl: 0.5, twist: Math.sin(t * 0.8) * 0.3 }, w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.45 + 0.2 * beat) * w);
      ctl.ch.sing = Math.max(ctl.ch.sing, (0.8 + 0.8 * beat) * w);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.1 * beat * w);
    } },

    tail_slap: { dur: 2.0, fin: 0.15, fout: 0.4, fn(ctl, a, w) {
      // the tail coils up behind and over her head, then lashes down in front of her
      const t = a.t;
      const coil = bump(t, 0, 0.75, 0.85, 1.0), slap = bump(t, 0.85, 1.05, 1.2, 1.8);
      pose(ctl, { tailUp: 2.6 * coil - 1.4 * slap, lean: -0.35 * coil + 0.5 * slap, pitch: -0.25 * coil + 0.3 * slap, arms: 0.6, rise: 0.4 * coil, tailSide: 0.4 * coil }, w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.3 * slap * w);
    } },

    water_orb: { dur: 2.2, fin: 0.15, fout: 0.4, fn(ctl, a, w) {
      const t = a.t;
      const gather = bump(t, 0, 0.8, 1.05, 1.2), thrust = bump(t, 1.1, 1.25, 1.45, 1.9);
      pose(ctl, { clasp: gather, armsFwd: 0.4 * gather + 1.0 * thrust, lean: -0.15 * gather + 0.3 * thrust, twist: 0.3 * gather - 0.4 * thrust, headUp: -0.15 * gather, hairBack: thrust }, w);
      ctl.ch.sing = Math.max(ctl.ch.sing, 1.2 * gather * w);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.5 * thrust * w);
    } },

    dive: { dur: 3.4, fin: 0.1, fout: 0.4,
      pre(ctl, a) { const t = a.t; ctl.ch.burrow = sm((t - 0.65) / 0.45) * (1 - sm((t - 2.15) / 0.4)); },
      fn(ctl, a, w) {
        const t = a.t;
        const up = bump(t, 0, 0.5, 0.6, 0.8), plunge = bump(t, 0.55, 0.9, 2.1, 2.2), burst = bump(t, 2.15, 2.45, 2.6, 3.2);
        pose(ctl, { rise: 1.2 * up + 1.0 * burst, pitch: -0.4 * up + 2.2 * plunge * (1 - sstep(1.0, 1.1, t)) - 0.3 * burst, armsUp: 1.0 * up + 0.8 * burst, arms: 0.8 * burst, headUp: 0.3 * up + 0.5 * burst, hairBack: plunge + burst, tailUp: -0.6 * plunge, hairUp: burst }, w);
        ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.6 * burst * w);
        ctl.ch.flash = Math.max(ctl.ch.flash, 0.6 * burst * w);
      } },

    scream: { dur: 2.6, fin: 0.15, fout: 0.45, fn(ctl, a, w) {
      const t = a.t;
      const wind = bump(t, 0, 0.6, 0.7, 0.85), scream = bump(t, 0.75, 0.95, 2.0, 2.4);
      const shake = Math.sin(t * 40) * 0.03 * scream;
      pose(ctl, { lean: -0.3 * wind + 0.45 * scream, arms: 1.0 * scream + 0.3 * wind, armsFwd: -0.7 * scream, headUp: 0.4 * wind - 0.15 * scream, hairBack: 1.3 * scream, twist: shake * 5, tailSide: shake * 10 }, w);
      ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.2 * wind + 1.0 * scream) * w);
      ctl.ch.sing = Math.max(ctl.ch.sing, 1.6 * scream * w);
      ctl.ch.flash = Math.max(ctl.ch.flash, 0.4 * scream * w);
    } },

    intro: { dur: 6.0, fin: 0.01, fout: 0.6,
      pre(ctl, a) { ctl.ch.burrow = 1 - sm((a.t - 0.3) / 2.4); },
      fn(ctl, a, w) {
        // rises out of the black water head bowed and hair veiling her face, opens her eyes, spreads her arms, sings
        const t = a.t;
        const bow = 1 - sstep(1.8, 3.0, t), open = sstep(2.6, 3.2, t), song = bump(t, 3.4, 4.0, 5.3, 5.9), pulse = bump(t, 4.4, 4.6, 4.7, 5.0);
        pose(ctl, { headUp: -0.8 * bow + 0.4 * song, lean: 0.4 * bow, arms: 0.1 * bow + 0.9 * song, armsUp: 0.8 * song, hairUp: 0.9 * song, rise: 0.4 * song, sway: 1.2 }, w);
        ctl.ch.eye = Math.min(ctl.ch.eye, mix(0.05, 1, open));
        ctl.ch.jaw = Math.max(ctl.ch.jaw, 0.6 * song * w);
        ctl.ch.sing = Math.max(ctl.ch.sing, (1.0 * song + 1.2 * pulse) * w);
        ctl.ch.flash = Math.max(ctl.ch.flash, 0.6 * pulse);
      } },

    groggy: { dur: 3.0, loop: true, fin: 0.4, pre(ctl, a, w) { ctl.ch.groggy = Math.max(ctl.ch.groggy, w); }, fn(ctl, a, w) {
      const tt = a.t % 3;
      pose(ctl, { twist: Math.sin(a.t * 18) * 0.15 * bump(tt, 1.8, 1.95, 2.3, 2.5) }, w);
    } },

    death: { dur: 4.0, hold: true, fin: 0.05,
      pre(ctl, a) { ctl.ch.burrow = sm((a.t - 1.4) / 2.3) * 0.75; },
      fn(ctl, a, w) {
        const t = a.t;
        const arch = bump(t, 0, 0.5, 1.0, 1.6), fall = sm((t - 0.9) / 1.4);
        pose(ctl, { lean: -0.7 * arch - 0.6 * fall, headUp: 0.9 * arch + 0.3 * fall, arms: 1.1 * arch + 0.5 * fall, armsUp: 0.6 * arch, pitch: -1.2 * fall, hairUp: arch, sway: 1 - fall, tailUp: 0.5 * fall }, w);
        ctl.ch.jaw = Math.max(ctl.ch.jaw, (0.9 * arch + 0.3 * fall) * w);
        ctl.ch.sing = Math.max(ctl.ch.sing, 1.4 * arch * w);
        ctl.ch.eye = Math.min(ctl.ch.eye, 1 - sstep(1.5, 3.0, t));
      } },
  };
  return { init, base, finish, material, actions: A, aliases: { roar: 'scream', channel: 'sing' } };
}
