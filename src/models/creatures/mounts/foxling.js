// Foxling: a tiny chibi fox pet (~0.45 m to the ear tips). Big round head, huge ears, big glossy eyes, cream cheeks
// & bib, dark socks, and an oversized fluffy tail with a pale tip. Follows the player (walk → trot → bounding run),
// hops, cheers with a spin, sits, curls up to sleep, snaps up loot, waves, faints. Variants: red, snow, shadow.
import * as THREE from 'three';
import { QuadCtl } from '../ctl.js';
import { leafGeo } from '../../kit/geo.js';
import { col } from '../../kit/sdf.js';
import { addG, rigidSkin, lerp3, sstep, clamp01, mix, TAU, Jiggle, legTo } from './common.js';
import { cuteEye, petPost, popIn } from './petkit.js';

const PAL = {
  red: { fur: 0xf0782a, fur2: 0xd85a1a, cream: 0xfff3e2, sock: 0x2e2220, earIn: 0xffc4b0, nose: 0x1e1414, iris: 0x4a2a14, ring: 0x8a5a2a, tip: 0xfffaf2, tipGlow: 0 },
  snow: { fur: 0xf3f6fb, fur2: 0xcfdbe8, cream: 0xffffff, sock: 0xa8bcd4, earIn: 0xf8d0d8, nose: 0x2a2a38, iris: 0x1c2a4a, ring: 0x5a8ac8, tip: 0xdfeeff, tipGlow: 0 },
  shadow: { fur: 0x3e3656, fur2: 0x2a2440, cream: 0xd8ccf4, sock: 0x17131f, earIn: 0x9a7ac8, nose: 0x100c16, iris: 0x2a1450, ring: 0xa070ff, tip: 0xc8a4ff, tipGlow: 1.4 },
};

export const foxling = {
  name: 'Foxling',
  variants: ['red', 'snow', 'shadow'],
  pet: true,
  config(variant) {
    const v = PAL[variant] ? variant : 'red';
    return { variant: v, pal: PAL[v], shapeKey: 'base', scale: 1, h: 0.024, hg: { 1: 0.0175 }, aoScale: 0.45, ao: { dist: 0.014, str: 0.7 },
      grad: { top: 0.12, bottom: 0.2, y0: 0.0, y1: 0.25, low: 0.15 }, mat: { dfreq: 9, rim: 0.45, rimColor: 0xfff2e0 } };
  },
  rig(R) {
    R.add('body', null, [0, 0.16, 0.02]);
    R.add('chest', 'body', [0, 0.165, -0.06]);
    R.add('hips', 'body', [0, 0.16, 0.09]);
    R.add('neck', 'chest', [0, 0.2, -0.1]);
    R.add('head', 'neck', [0, 0.27, -0.13]);
    R.add('jaw', 'head', [0, 0.245, -0.19]);
    R.add('earL', 'head', [-0.05, 0.335, -0.115]); R.add('earR', 'head', [0.05, 0.335, -0.115]);
    R.add('eyeL', 'head', [-0.032, 0.285, -0.207]); R.add('eyeR', 'head', [0.032, 0.285, -0.207]);
    R.add('tail1', 'hips', [0, 0.18, 0.14]); R.add('tail2', 'tail1', [0, 0.22, 0.25]); R.add('tail3', 'tail2', [0, 0.31, 0.33]);
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      R.add('fU' + n, 'chest', [0.042 * s, 0.14, -0.07]); R.add('fL' + n, 'fU' + n, [0.044 * s, 0.085, -0.062]); R.add('fP' + n, 'fL' + n, [0.044 * s, 0.024, -0.072]);
      R.add('rT' + n, 'hips', [0.048 * s, 0.15, 0.1]); R.add('rS' + n, 'rT' + n, [0.052 * s, 0.1, 0.072]); R.add('rM' + n, 'rS' + n, [0.052 * s, 0.056, 0.118]); R.add('rP' + n, 'rM' + n, [0.052 * s, 0.018, 0.108]);
    }
  },
  sculpt(S, cfg) {
    const c = cfg.pal, fur = [0.35, 0, 0.1, 0], furS = [0.22, 0, 0.08, 0];
    // ---- bean body, cream bib
    S.ell('body', [0, 0.16, 0.02], [0.07, 0.068, 0.11], { k: 0.03, col: c.fur, tag: 'body', dtl: fur });
    S.ell('chest', [0, 0.16, -0.055], [0.066, 0.072, 0.06], { k: 0.03, col: c.fur, tag: 'body', dtl: fur });
    S.ell('chest', [0, 0.15, -0.09], [0.045, 0.055, 0.035], { k: 0.025, col: c.cream, tag: 'bib', dtl: fur });
    S.ell('hips', [0, 0.16, 0.09], [0.064, 0.064, 0.058], { k: 0.03, col: c.fur, tag: 'body', dtl: fur });
    S.cone('neck', [0, 0.18, -0.08], [0, 0.24, -0.12], 0.045, 0.04, { k: 0.025, col: c.fur, b2: 'head', t0: 0.4, t1: 1, dtl: fur });
    // ---- legs: short, dark socks, round paws
    for (const s of [-1, 1]) {
      const n = s < 0 ? 'L' : 'R';
      S.cone('fU' + n, [s * 0.042, 0.15, -0.07], [s * 0.044, 0.085, -0.062], 0.022, 0.016, { k: 0.014, col: c.fur, b2: 'fL' + n, t0: 0.8, t1: 1, dtl: fur });
      S.cone('fL' + n, [s * 0.044, 0.085, -0.062], [s * 0.044, 0.026, -0.072], 0.015, 0.014, { k: 0.01, col: c.sock, tag: 'sock', b2: 'fP' + n, t0: 0.85, t1: 1, dtl: furS });
      S.ell('fP' + n, [s * 0.044, 0.014, -0.08], [0.019, 0.014, 0.023], { k: 0.01, col: c.sock, tag: 'sock', dtl: furS });
      S.ell('rT' + n, [s * 0.05, 0.14, 0.095], [0.03, 0.045, 0.042], { k: 0.02, col: c.fur, rot: [0.3, 0, 0], dtl: fur });
      S.cone('rS' + n, [s * 0.052, 0.1, 0.075], [s * 0.052, 0.056, 0.118], 0.018, 0.013, { k: 0.012, col: c.fur, b2: 'rM' + n, t0: 0.85, t1: 1, dtl: fur });
      S.cone('rM' + n, [s * 0.052, 0.056, 0.118], [s * 0.052, 0.018, 0.108], 0.013, 0.012, { k: 0.01, col: c.sock, tag: 'sock', b2: 'rP' + n, t0: 0.8, t1: 1, dtl: furS });
      S.ell('rP' + n, [s * 0.052, 0.012, 0.1], [0.018, 0.013, 0.024], { k: 0.01, col: c.sock, tag: 'sock', dtl: furS });
    }
    // ---- oversized fluffy tail: fat plume with fur clumps and a pale tip
    S.cone('tail1', [0, 0.175, 0.13], [0, 0.22, 0.24], 0.03, 0.06, { k: 0.03, col: c.fur, tag: 'tail', b2: 'tail2', t0: 0.4, t1: 1, dtl: fur });
    S.seg('tail2', [0, 0.21, 0.22], [0, 0.31, 0.34], 0.075, 0.08, { k: 0.04, col: c.fur, tag: 'tail', zs: 1.15, b2: 'tail3', t0: 0.6, t1: 1, dtl: fur });
    S.cone('tail3', [0, 0.3, 0.32], [0, 0.42, 0.37], 0.07, 0.012, { k: 0.04, col: c.fur, tip: { col: c.tip, from: 0.35 }, tag: 'tailTip', dtl: fur });
    for (let i = 0; i < 6; i++) {
      const a = (i % 2 ? 1 : -1) * (0.9 + 0.3 * (i % 3)), t = i / 5;
      const y = 0.22 + t * 0.12, z = 0.24 + t * 0.1;
      S.cone(i < 3 ? 'tail2' : 'tail3', [Math.sin(a) * 0.05, y, z], [Math.sin(a) * 0.1, y + 0.02, z + 0.06], 0.03, 0.006, { k: 0.02, col: c.fur, tip: { col: i > 3 ? c.tip : c.fur2, from: 0.5 }, tag: 'tail', dtl: fur });
    }
    // ---- big round head (group 1): cheek fluff, small snout, black nose
    const g1 = { group: 1 };
    S.ell('head', [0, 0.28, -0.14], [0.078, 0.07, 0.07], { ...g1, k: 0.03, col: c.fur, tag: 'head', dtl: furS });
    for (const s of [-1, 1]) {
      S.ell('head', [s * 0.048, 0.245, -0.158], [0.034, 0.028, 0.034], { ...g1, k: 0.02, col: c.cream, tag: 'cheek', dtl: furS });
      S.cone('head', [s * 0.066, 0.242, -0.14], [s * 0.105, 0.228, -0.11], 0.02, 0.005, { ...g1, k: 0.015, col: c.cream, tag: 'cheek', dtl: furS });
    }
    S.cone('head', [0, 0.26, -0.18], [0, 0.248, -0.225], 0.028, 0.017, { ...g1, k: 0.016, col: c.cream, tag: 'snout', dtl: furS });
    S.sph('head', [0, 0.254, -0.238], 0.011, { ...g1, k: 0.006, col: c.nose, tag: 'nose' });
  },
  paint(v, cfg) {
    const c = cfg.pal, [x, y, z] = v.p, [nx, ny, nz] = v.n;
    if (v.group === 0) {
      v.mix(c.fur2, sstep(0.5, 0.95, ny) * 0.3 * (1 - v.t('tailTip')));
      v.mix(c.cream, sstep(-0.3, -0.8, ny) * 0.7 * (1 - v.t('sock')) * (1 - v.t('tail')));
      if (c.tipGlow) { const tt = v.t('tailTip') * sstep(0.34, 0.4, y); v.emis = Math.max(v.emis, tt * c.tipGlow); }
    } else {
      v.mix(c.fur2, sstep(0.6, 0.95, ny) * sstep(-0.12, -0.16, z) * 0.35);
      // tiny mouth "w"
      const mz = z + 0.225, my = y - 0.236;
      const w = Math.abs(my + 0.004 * Math.cos(Math.abs(x) * 260)) < 0.0025 && Math.abs(x) < 0.013 && Math.abs(mz) < 0.02 && nz < -0.3;
      if (w) v.mix(0x3a2020, 0.9);
      v.mix(c.nose, v.t('nose'));
    }
  },
  parts(acc, S, R, cfg) {
    const c = cfg.pal, b = (n) => R.index(n);
    // big glossy eyes on their own bones (blink / squint)
    for (const s of [-1, 1]) cuteEye(acc, S, b(s < 0 ? 'eyeL' : 'eyeR'), [s * 0.032, 0.285, -0.207], [s * 0.3, 0.06, -1], 0.022, { iris: c.iris, rim: 0x120a0a, group: 1, sink: 0.4, glow: cfg.pal.tipGlow ? 0.6 : 0.12, pupilA: 0.6, irisA: 0.96 });
    // huge ears: pale inside, dark tips
    for (const s of [-1, 1]) {
      const g = leafGeo(0.036, 0.1, 0.014, 0.7, -0.05, { nu: 5, nv: 5, pw: 0.85, tipW: 0.002 });
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.08, -s * 0.28, -s * 0.34, 'YXZ')); m.setPosition(s * 0.05, 0.33, -0.115);
      const co = col(c.fur), ci = col(c.earIn), ct = col(c.sock);
      addG(acc, g, { matrix: m, skin: rigidSkin(b(s < 0 ? 'earL' : 'earR')), dtl: [0.2, 0, 0.08, 0],
        color: (p, n, uv) => uv[0] >= 1 ? lerp3(co, ct, sstep(0.62, 0.9, uv[1])) : lerp3(lerp3(ci, co, sstep(0.55, 0.9, (uv[0] % 1) * 2)), ct, sstep(0.75, 0.95, uv[1])) });
    }
  },
  sockets: { head: ['head', [0, 0.36, -0.13]], mouth: ['jaw', [0, 0.24, -0.24]], center: ['body', [0, 0.16, 0]], back: ['body', [0, 0.23, 0.02]], chest: ['chest', [0, 0.15, -0.1]], tail: ['tail3', [0, 0.42, 0.37]] },
  height: 0.45, radius: 0.18,
  controller(inst) { const c = new QuadCtl(inst, SPEC); c.jig = new Jiggle(c, JIG); return c; },
  get actionList() { return ACTIONS; },
};

// ------------------------------------------------------------------------------------------------ animation
const V3 = THREE.Vector3;
const allLegs = (ctl, fn) => { const L = ctl.gait.legs; for (let i = 0; i < L.length; i++) fn(L[i], L[i].id[0] === 'F'); };
const tuck = (ctl, w, up = 0.05) => allLegs(ctl, (L, f) => legTo(L, L.toe.x, L.toe.y + up * (f ? 1 : 0.8), L.toe.z + (f ? 0.02 : -0.02), w, true, -0.8, f ? undefined : 1.0));
const hopArc = (k, a0, a1) => (k > a0 && k < a1 ? Math.sin((k - a0) / (a1 - a0) * Math.PI) : 0);
const ACTIONS = {
  hop: { dur: 0.55, a: 0.02, d: 0.95, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, k = a.k;
    const crouch = sstep(0, 0.18, k) * (1 - sstep(0.18, 0.28, k)) + sstep(0.78, 0.86, k) * (1 - sstep(0.86, 1, k)) * 0.8;
    const h = hopArc(k, 0.22, 0.82);
    P.move(b.body, 0, (0.13 * h - 0.025 * crouch) * w, 0);
    P.rx(b.body, (0.25 * Math.sin(clamp01((k - 0.2) / 0.6) * TAU) * h) * w);
    if (h > 0) tuck(ctl, h * w);
    ctl.ear = mix(ctl.ear, -0.3, h * w);
  } },
  happy: { dur: 1.3, a: 0.02, d: 0.95, fn(ctl, a, w) { // hop, spin in the air, land, wag — eyes ^ ^
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const h = hopArc(k, 0.15, 0.62), spin = sstep(0.18, 0.6, k);
    P.move(b.body, 0, (0.17 * h) * w, 0);
    P.rot(b.body, 0, spin * TAU * w, 0);
    if (h > 0) tuck(ctl, h * w, 0.06);
    ctl.happy = Math.max(ctl.happy || 0, sstep(0.05, 0.2, k) * w);
    ctl.jaw = Math.max(ctl.jaw, 0.4 * sstep(0.6, 0.7, k) * (1 - sstep(0.9, 1, k)) * w);
    const T = b.tail; for (let i = 0; i < T.length; i++) P.rot(T[i], -0.15 * w, Math.sin(t * 20 - i) * 0.35 * sstep(0.55, 0.65, k) * w, 0);
  } },
  sit: { dur: 1, hold: true, rest: true, fadeIn: 0.35, fadeOut: 0.3, fn(ctl, a, w) { // haunches down, chest up, tail curled round the paws
    const P = ctl.pose, b = ctl.b;
    P.move(b.body, 0, -0.045 * w, 0.03 * w); P.rx(b.body, 0.62 * w); P.rx(b.hips, 0.3 * w); P.rx(b.neck, -0.4 * w); P.rx(b.head, -0.2 * w);
    const T = b.tail; P.rot(T[0], 1.0 * w, 0.4 * w, 0); P.rot(T[1], 0.5 * w, 0.7 * w, 0); P.rot(T[2], 0.3 * w, 0.6 * w, 0);
    allLegs(ctl, (L, f) => { if (f) legTo(L, L.toe.x * 0.8, 0, -0.07, w, false, 0); else legTo(L, L.toe.x * 1.2, 0, 0.055, w, false, 0, 1.3); });
  } },
  sleep: { dur: 1, hold: true, rest: true, fadeIn: 0.8, fadeOut: 0.5, fn(ctl, a, w) { // curl up: belly down, head on paws, tail over the nose
    const P = ctl.pose, b = ctl.b, t = a.t, br = Math.sin(t * 1.8) * 0.004;
    P.move(b.body, 0, (-0.085 + br) * w, 0.01 * w); P.rot(b.body, 0.02 * w, 0.25 * w, 0.12 * w);
    P.rot(b.neck, -0.45 * w, 0.5 * w, 0.15 * w); P.rot(b.head, 0.2 * w, 0.35 * w, 0.2 * w);
    const T = b.tail; P.rot(T[0], 0.35 * w, -0.9 * w, 0); P.rot(T[1], 0.2 * w, -0.9 * w, 0); P.rot(T[2], 0.15 * w, -0.8 * w, 0);
    ctl.eyeClose = Math.max(ctl.eyeClose || 0, w); ctl.ear = mix(ctl.ear, 0.7, w);
    allLegs(ctl, (L, f) => legTo(L, L.toe.x * (f ? 0.6 : 1.3) + (f ? 0.02 : 0.03), 0.0, f ? -0.13 : 0.05, w, false, 0, f ? undefined : 1.4));
  } },
  pickup: { dur: 0.8, a: 0.06, d: 0.85, hit: 0.45, fn(ctl, a, w) { // dip & snap up the loot
    const P = ctl.pose, b = ctl.b, k = a.k;
    const dip = sstep(0.05, 0.35, k) * (1 - sstep(0.5, 0.8, k)), snap = sstep(0.4, 0.48, k) * (1 - sstep(0.55, 0.8, k));
    P.rx(b.body, -0.25 * dip * w); P.rx(b.neck, -0.8 * dip * w); P.rx(b.head, (-0.4 * dip + 0.25 * snap) * w);
    P.move(b.body, 0, -0.02 * dip * w, -0.02 * dip * w);
    ctl.jaw = Math.max(ctl.jaw, (0.5 * sstep(0.2, 0.4, k) * (1 - sstep(0.44, 0.48, k)) + 0.1 * snap) * w);
    ctl.happy = Math.max(ctl.happy || 0, sstep(0.55, 0.7, k) * w);
    ctl.ear = mix(ctl.ear, -0.3, w);
  } },
  wave: { dur: 1.5, a: 0.08, d: 0.85, fn(ctl, a, w) { // sit up on the haunches and wave a front paw
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const up = sstep(0, 0.2, k) * (1 - sstep(0.82, 1, k));
    P.move(b.body, 0, 0.02 * up * w, 0.03 * up * w); P.rx(b.body, 0.9 * up * w); P.rx(b.neck, -0.6 * up * w); P.rot(b.head, -0.25 * up * w, 0, Math.sin(t * 6) * 0.15 * up * w);
    const L = ctl.gait.legs, wv = Math.sin(t * 14);
    legTo(L[1], 0.06 + 0.02 * wv, 0.2, -0.12 + 0.02 * wv, up * w, true, -1.2);
    legTo(L[0], -0.04, 0.12, -0.06, up * w, true, -1.4);
    legTo(L[2], L[2].toe.x * 1.2, 0, 0.05, up * w, false, 0, 1.3); legTo(L[3], L[3].toe.x * 1.2, 0, 0.05, up * w, false, 0, 1.3);
    ctl.happy = Math.max(ctl.happy || 0, 0.7 * up * w); ctl.jaw = Math.max(ctl.jaw, 0.3 * up * w);
  } },
  idle_alt: { dur: 2.2, a: 0.1, d: 0.85, start(ctl, a) { a.u.v = Math.random() < 0.5 ? 0 : 1; }, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, t = a.t, k = a.k;
    if (a.u.v === 0) { // scratch behind the ear with a hind paw
      P.move(b.body, 0, -0.03 * w, 0.02 * w); P.rot(b.body, 0.4 * w, 0, -0.12 * w); P.rot(b.neck, -0.1 * w, -0.35 * w, 0.4 * w); P.rot(b.head, 0.1 * w, -0.3 * w, 0.4 * w);
      const L = ctl.gait.legs[3], f = Math.sin(t * 28) * 0.012;
      legTo(L, 0.06, 0.2 + f, -0.08 + f, w, true, -0.9, 0.5);
      legTo(ctl.gait.legs[2], -0.06, 0, 0.06, w, false, 0, 1.3);
      ctl.eyeClose = Math.max(ctl.eyeClose || 0, 0.7 * w);
    } else { // chase its own tail: two quick turns
      const sp = sstep(0.1, 0.9, k);
      P.rot(b.body, 0, sp * TAU * 2 * w, 0); P.rot(b.neck, 0, 0.6 * w, 0); P.rot(b.head, 0, 0.5 * w, 0);
      const T = b.tail; for (let i = 0; i < T.length; i++) P.rot(T[i], 0, -0.4 * w, 0);
      P.move(b.body, 0, 0.02 * Math.abs(Math.sin(t * 16)) * w, 0);
      ctl.happy = Math.max(ctl.happy || 0, 0.5 * w);
      allLegs(ctl, (L) => legTo(L, L.toe.x, 0.02 * Math.max(0, Math.sin(t * 16 + L.toe.z * 40)), L.toe.z, w, true, -0.3));
    }
  } },
  hit: { dur: 0.45, a: 0.04, d: 0.5, hit: 0, fn(ctl, a, w) {
    const P = ctl.pose, b = ctl.b, j = Math.sin(clamp01(a.k * 1.6) * Math.PI) * w;
    P.move(b.body, 0, 0.04 * j, 0.04 * j); P.rx(b.body, 0.2 * j); P.rx(b.neck, 0.3 * j);
    ctl.ear = mix(ctl.ear, 1.2, j); ctl.eyeClose = Math.max(ctl.eyeClose || 0, 0.8 * j); if (j > 0.1) tuck(ctl, j, 0.05);
  } },
  death: { dur: 1.2, hold: true, excl: true, state: true, fadeIn: 0.05, keep: true, fn(ctl, a, w) { // faint: flop onto the back, paws up, eyes shut
    const P = ctl.pose, b = ctl.b, k = a.k, t = a.t;
    const f = sstep(0.1, 0.55, k), bounce = Math.sin(clamp01((k - 0.5) / 0.2) * Math.PI) * 0.03;
    P.move(b.body, 0, (-0.075 * f + bounce + 0.06 * Math.sin(clamp01(k / 0.5) * Math.PI)) * w, 0);
    P.rot(b.body, 0.1 * f * w, 0, 2.6 * f * w);
    P.rot(b.neck, -0.2 * f * w, 0, 0.3 * f * w); P.rot(b.head, 0, 0, 0.4 * f * w);
    const T = b.tail; for (let i = 0; i < T.length; i++) P.rot(T[i], 0.2 * f * w, 0.5 * f * w, 0);
    ctl.eyeClose = Math.max(ctl.eyeClose || 0, sstep(0.3, 0.5, k) * w); ctl.jaw = Math.max(ctl.jaw, 0.25 * f * w);
    allLegs(ctl, (L, fr) => legTo(L, L.toe.x * 1.3, L.toe.y + 0.05 + 0.01 * Math.sin(t * 3 + L.toe.z * 30) * (1 - f), L.toe.z * 0.9, f * w, true, -0.9, fr ? undefined : 0.8));
  } },
  spawn: popIn(0.75, { fn(ctl, a, w) { const h = Math.sin(clamp01((a.k - 0.3) / 0.5) * Math.PI); ctl.pose.move(ctl.b.body, 0, 0.08 * h * w, 0); if (h > 0) tuck(ctl, h * w, 0.05); } }),
};

const JIG = [{ bones: ['tail1', 'tail2', 'tail3'], anchor: 'tail1', k: 60, c: 6, g: 0.006, gi: 0.5, wind: 0.02, idle: 0.04, idleF: 1.4, max: 0.7 }];
const SPEC = {
  bones: { body: 'body', hips: 'hips', chest: 'chest', neck: 'neck', head: 'head', jaw: 'jaw', tail: ['tail1', 'tail2', 'tail3'], ears: ['earL', 'earR'], eyes: ['eyeL', 'eyeR'] },
  gait: {
    legs: [
      { id: 'FL', chain: ['fUL', 'fLL', 'fPL'], toe: [-0.044, 0, -0.09], body: 'chest', scap: 0.5, lift: 0.035, flex: 1.2, heel: 0.4 },
      { id: 'FR', chain: ['fUR', 'fLR', 'fPR'], toe: [0.044, 0, -0.09], body: 'chest', scap: 0.5, lift: 0.035, flex: 1.2, heel: 0.4 },
      { id: 'RL', chain: ['rTL', 'rSL', 'rML', 'rPL'], toe: [-0.052, 0, 0.095], body: 'hips', scap: 0.45, lift: 0.035, flex: 0.9, metaK: 1.4 },
      { id: 'RR', chain: ['rTR', 'rSR', 'rMR', 'rPR'], toe: [0.052, 0, 0.095], body: 'hips', scap: 0.45, lift: 0.035, flex: 0.9, metaK: 1.4 },
    ],
    maxStride: 0.2, fMin: 0.8, actV: 0.15,
    gaits: [
      { v: 0.55, f: 2.8, duty: 0.6, lift: 0.9, off: { RL: 0, FL: 0.25, RR: 0.5, FR: 0.75 }, bob: 0.006, bobF: 2, roll: 0.03, rollF: 1, nod: 0.05, nodF: 2 },
      { v: 1.8, f: 4.4, duty: 0.42, lift: 1.1, off: { FL: 0, RR: 0, FR: 0.5, RL: 0.5 }, bob: 0.01, bobF: 2, roll: 0.02, rollF: 1, nod: 0.04, nodF: 2 },
      { v: 5, f: 5.4, duty: 0.24, lift: 1.4, off: { RL: 0, RR: 0.05, FL: 0.45, FR: 0.5 }, bob: 0.03, bobF: 1, bobPh: 0.75, pitch: 0.22, pitchF: 1, pitchPh: 0.1, flex: 0.2, flexF: 1, flexPh: 0.3, nod: 0.06, nodF: 1 },
    ],
  },
  neck: { pitch: 0.1, run: -0.15, combat: 0, walk: -0.05, comp: 0.6 },
  tail: { wag: 0.3, wagF: 1.1, run: 0.25, combat: 0, base: -0.1 },
  combatCrouch: 0, combatPitch: 0, runDrop: 0.008, breathe: 0.02,
  fidgets: [{ name: 'idle_alt', w: 2 }],
  fidgetGap: 5,
  pose(ctl, dt) {
    ctl.ear = -0.15 + ctl.run * 0.5 + Math.pow(Math.max(0, Math.sin(ctl.t * 1.3 + 1)), 30) * 0.4;
    // head tilts curiously when idle
    const idle = 1 - clamp01(ctl.gait.act * 1.5);
    ctl.pose.rz(ctl.b.head, Math.sin(ctl.t * 0.7) * 0.18 * idle);
    ctl.jig.update(dt);
  },
  post(ctl, dt) { petPost(ctl, dt); },
  actions: ACTIONS,
};
