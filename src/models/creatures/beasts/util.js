// Small shared helpers for the field beasts (allocation-free in the per-frame paths).
import * as THREE from 'three';

/** deterministic 0..1 hash */
export const hsh = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Leg override: target (x,y,z) in body-local (local=true, carried by the leg's body bone) or model space; paw pitch; weight. */
export function ov(L, x, y, z, w, local = true, paw = -0.4, meta) {
  if (!L.override) L.override = new THREE.Vector3(); // first use only
  L.override.set(x, y, z); L.overrideLocal = local; L.overridePaw = paw;
  if (meta !== undefined) L.overrideMeta = meta;
  if (w > L.overrideW) L.overrideW = w;
}

/** Resting holds (sit / sleep / root…) end by themselves once the creature is asked to move. */
export function cancelRestOnMove(ctl) {
  if (Math.abs(ctl._speed) < 0.3 && Math.abs(ctl._turn) < 0.6) return;
  const L = ctl.acts.list;
  for (let i = 0; i < L.length; i++) if (L[i].d.rest && !L[i].out) L[i].out = true;
}

/** pre-create the override vectors so no action allocates on its first frame */
export function prepLegs(gait) { const L = gait.legs; for (let i = 0; i < L.length; i++) if (!L[i].override) L[i].override = new THREE.Vector3(); }

/**
 * Knockdown / getup / death that agree on which side the body lies on (the generic qGetup / qDeath roll a fresh random
 * side from their own seed, so a creature lying on its left would snap to its right when getting up / dying).
 */
export function sidePair(KD, GU, DE) {
  const sideOf = (a) => (Math.sin(a.seed * 7.13) > 0 ? 1 : -1);
  const kd = { ...KD, start(ctl, a) { ctl.kdSide = sideOf(a); KD.start?.(ctl, a); } };
  const gu = { ...GU, start(ctl, a) { a.u.side = ctl.kdSide ?? 1; GU.start?.(ctl, a); } };
  const de = { ...DE, start(ctl, a) { DE.start?.(ctl, a); if (ctl.kdSide && ctl.acts.weight('knockdown') > 0.3) a.u.side = ctl.kdSide; } };
  return { knockdown: kd, getup: gu, death: de };
}
