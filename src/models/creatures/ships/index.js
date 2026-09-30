// SEVENSHARD ships — procedural, three draw calls per ship (+2 shadow): one merged "wood" mesh (hull, decks, spars,
// rigging, guns, lanterns, props), one animated sail mesh (sails, flags, clew sheets) and a waterline foam skirt.
//
//   import { createShip, SHIPS } from './models/creatures/ships/index.js';   // (re-exported by ../ships.js and ../index.js)
//   const ship = createShip('dawnrunner');     // 'dawnrunner' | 'pirate' | 'ghost' | 'merchant' (unknown → dawnrunner + warn)
//   scene.add(ship.root);                       // game owns root.position / root.rotation.y; bow faces −Z; waterline y = 0
//   ship.update(dt, { speed, turn, sail });     // speed m/s, turn rad/s (+ = turning to port / counter-clockwise from above),
//                                               // sail 0 furled … 1 full. Call every frame; allocates nothing.
//   const { dur, times } = ship.fire('L');      // port broadside ('R' = starboard). Guns fire bow → stern; times[i] (s) is when
//                                               // sockets.cannons{L|R}[i] fires (muzzle flash / smoke there); dur = until the last
//                                               // gun has eased back into battery (~1.4 s merchant … ~1.8 s pirate)
//   ship.setGlow(k);                            // lantern / window emissive multiplier (1 = authored; e.g. 1.6 at night)
//   ship.dispose();                             // removes root, frees per-instance materials (geometry/textures stay cached)
//
// Sockets (Object3D; read with getWorldPosition):
//   helm      where the captain stands at the wheel (feet on the deck, facing −Z) — rides the rocking hull
//   wake      stern waterline (y = 0) on the root, does not bob — spawn the wake trail here
//   cannonsL  port muzzles, bow → stern; each socket's local −Z points out of the muzzle (world dir = getWorldDirection().negate())
//   cannonsR  starboard muzzles, same convention
// ship.hull is the rocking node (bob / pitch / roll / heel); ship.root is never rotated by the ship itself.
// SHIPS[type] = { name, length (hull, m), beam, loa (overall incl. bowsprit / ram), height (truck above water), guns (per side) }
//
// Geometry, the sail atlas and the plank texture are built once per type and cached (preloadShip / shipStats /
// disposeShipCache); every instance owns only its small materials, so all ships share the same GL programs.
import * as THREE from 'three';
import { woodMaterial, sailMaterial, sailDepthMaterial, foamMaterial, MAX_GUNS } from './mats.js';
import { plankTex } from './tex.js';
import { buildDawnrunner } from './dawnrunner.js';
import { buildPirate } from './pirate.js';
import { buildGhost } from './ghost.js';
import { buildMerchant } from './merchant.js';

export const SHIPS = {
  dawnrunner: { name: 'Dawnrunner', length: 18, beam: 5.5, loa: 21.7, height: 17.1, guns: 4 },
  pirate: { name: 'Pirate Brig', length: 17, beam: 5.0, loa: 20.5, height: 13.8, guns: 5 },
  ghost: { name: 'Ghost Ship', length: 19, beam: 5.9, loa: 22.1, height: 15.0, guns: 4 },
  merchant: { name: 'Merchant Cog', length: 16, beam: 6.3, loa: 19.9, height: 15.5, guns: 2 },
};
const BUILDERS = { dawnrunner: buildDawnrunner, pirate: buildPirate, ghost: buildGhost, merchant: buildMerchant };
const CACHE = {};

/** Build (and cache) a ship type's shared geometry; returns build stats. */
export function preloadShip(type) {
  if (CACHE[type]) return CACHE[type];
  const t0 = performance.now();
  plankTex();                                       // shared by every type (first build pays ~20 ms)
  const d = (BUILDERS[type] || BUILDERS.dawnrunner)();
  d.ms = performance.now() - t0;
  d.tris = (d.wood.index.count + d.sails.index.count + (d.foam ? d.foam.index.count : 0)) / 3;
  d.verts = d.wood.attributes.position.count + d.sails.attributes.position.count;
  return (CACHE[type] = d);
}
export function shipStats() { return Object.entries(CACHE).map(([type, d]) => ({ type, ms: d.ms, tris: d.tris, verts: d.verts, drawCalls: d.foam ? 3 : 2, report: d.report })); }
export function disposeShipCache() { for (const k in CACHE) { const d = CACHE[k]; d.wood.dispose(); d.sails.dispose(); d.foam?.dispose(); d.tex.dispose(); delete CACHE[k]; } }

const RECOIL = 0.5, RECOIL_DUR = 1.25, STAGGER = 0.12;
const recoilAt = (t) => (t < 0 ? 0 : t < 0.06 ? RECOIL * (t / 0.06) : t < 0.2 ? RECOIL : t < RECOIL_DUR ? RECOIL * (1 - smooth01((t - 0.2) / (RECOIL_DUR - 0.2))) : 0);
function smooth01(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function createShip(type = 'dawnrunner') {
  if (!SHIPS[type]) { console.warn('createShip: unknown type', type); type = 'dawnrunner'; }
  const def = preloadShip(BUILDERS[type] ? type : 'dawnrunner');
  const root = new THREE.Object3D(); root.name = 'ship:' + type;
  const hull = new THREE.Object3D(); hull.name = 'ship-rock'; root.add(hull);   // bob / pitch / roll live here
  const wmat = woodMaterial(def.look.wood), smat = sailMaterial({ tex: def.tex, ...def.look.sail }), sdep = sailDepthMaterial(smat);
  const wood = new THREE.Mesh(def.wood, wmat); wood.name = 'ship-wood'; wood.castShadow = true; wood.receiveShadow = true;
  const sails = new THREE.Mesh(def.sails, smat); sails.name = 'ship-sails'; sails.castShadow = true; sails.receiveShadow = true; sails.customDepthMaterial = sdep;
  hull.add(wood, sails);
  // waterline foam skirt rides on the root (stays on the water while the hull rocks); drawn after the sea
  const fmat = def.foam ? foamMaterial(def.look.foam) : null;
  const foam = def.foam ? new THREE.Mesh(def.foam, fmat) : null;
  if (foam) { foam.name = 'ship-foam'; foam.renderOrder = 6; foam.castShadow = false; foam.receiveShadow = false; root.add(foam); }
  const fu = fmat?.userData.ship;
  const mk = (parent, p, ry = 0, name = '') => { const o = new THREE.Object3D(); o.name = name; o.position.fromArray(p); o.rotation.y = ry; parent.add(o); return o; };
  const sockets = {
    helm: mk(hull, def.sockets.helm, 0, 'helm'),
    wake: mk(root, def.sockets.wake, 0, 'wake'),
    cannonsL: def.sockets.cannonsL.map((p, i) => mk(hull, p, Math.PI / 2, 'cannonL' + i)),   // local −Z points out of the muzzle
    cannonsR: def.sockets.cannonsR.map((p, i) => mk(hull, p, -Math.PI / 2, 'cannonR' + i)),
  };
  const slotsL = def.sockets.slotsL, slotsR = def.sockets.slotsR;
  const su = smat.userData.ship, wu = wmat.userData.ship, mo = def.motion;
  const rnd = Math.random;
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  su.uPhase.value = rnd() * 20;
  const st = { t: rnd() * 50, reef: 0, billow: 0.5, luff: 0.12, heel: 0, heelV: 0, wheel: 0, rudder: 0, swX: 0, swXV: 0, swZ: 0, swZV: 0, flagT: 0 };
  const fireT = new Float32Array(MAX_GUNS).fill(99);
  let first = true;

  function update(dt, s) {
    dt = Math.min(dt || 0, 0.1);
    const speed = s?.speed || 0, turn = s?.turn || 0, sail = clamp(s?.sail ?? 1, 0, 1);
    st.t += dt;
    const vn = clamp(Math.abs(speed) / 9, 0, 1.25);
    // --- sails: reef toward the yards, belly with speed & sail, luff when slack
    const kReef = first ? 1 : 1 - Math.exp(-dt * 1.6);
    st.reef += (1 - sail - st.reef) * kReef;
    const bT = (0.18 + 0.9 * Math.min(1, vn)) * (0.35 + 0.65 * sail);
    st.billow += (bT - st.billow) * (first ? 1 : 1 - Math.exp(-dt * 1.8));
    const luffT = 0.035 + 0.2 * (1 - Math.min(1, vn * 1.5)) + 0.025 * vn;
    st.luff += (luffT - st.luff) * (first ? 1 : 1 - Math.exp(-dt * 1.5));
    st.flagT += dt * (5.5 + Math.abs(speed) * 0.75);
    su.uBillow.value = st.billow; su.uReef.value = st.reef; su.uLuff.value = st.luff;
    su.uFlagT.value = st.flagT % 6283.1853; su.uFlagA.value = 0.3 + 0.14 * Math.min(1, vn);
    // --- hull motion: swell bob / pitch / roll, heel into turns (+ a little wind heel), broadside kick
    const T = st.t * mo.period;
    const bob = Math.sin(T * 0.83 + ph[0]) * mo.bob + Math.sin(T * 1.91 + ph[1]) * mo.bob * 0.35;
    const pitch = Math.sin(T * 0.61 + ph[2]) * mo.pitch + Math.sin(T * 1.43 + ph[1]) * mo.pitch * 0.4 + Math.min(1, vn) * 0.006;
    const heelT = clamp(turn * Math.abs(speed) * 0.04, -0.15, 0.15) + sail * Math.min(1, vn) * 0.025;
    st.heelV += ((heelT - st.heel) * 5.5 - st.heelV * 2.6) * dt;
    st.heel += st.heelV * dt;
    const roll = st.heel + Math.sin(T * 0.53 + ph[3]) * mo.roll + Math.sin(T * 1.17 + ph[0]) * mo.roll * 0.3;
    hull.position.y = bob;
    hull.rotation.set(pitch, 0, roll);
    // --- helm & rudder follow the turn
    st.wheel += (clamp(turn * 2.4, -2.6, 2.6) - st.wheel) * (1 - Math.exp(-dt * 3));
    st.rudder += (clamp(-turn * 0.8, -0.55, 0.55) - st.rudder) * (1 - Math.exp(-dt * 3));
    wu.uWheel.value = st.wheel; wu.uRudder.value = st.rudder;
    // --- hanging lanterns / chains: damped pendulum that stays roughly plumb
    st.swXV += ((-pitch - st.swX) * 9 - st.swXV * 1.6) * dt; st.swX += st.swXV * dt;
    st.swZV += ((-roll - st.swZ) * 9 - st.swZV * 1.6) * dt; st.swZ += st.swZV * dt;
    wu.uSway.value.set(st.swX, st.swZ);
    // --- waterline foam (thicker with speed; flows aft)
    if (fu) { fu.uFoam.value += (Math.min(1, Math.abs(speed) / 7) - fu.uFoam.value) * (first ? 1 : 1 - Math.exp(-dt * 1.5)); fu.uFlow.value = (fu.uFlow.value + speed * dt * 0.25) % 20000; }
    // --- cannon recoil
    const rc = wu.uRecoil.value;
    for (let i = 0; i < MAX_GUNS; i++) { if (fireT[i] < 50) { fireT[i] += dt; rc[i] = recoilAt(fireT[i]); } }
    first = false;
  }

  function fire(side = 'L') {
    const R = side === 'R' || side === 'r' || side === 1;
    const slots = R ? slotsR : slotsL, times = [];
    for (let k = 0; k < slots.length; k++) { const t = k * STAGGER + (k ? rnd() * 0.04 : 0); fireT[slots[k]] = -t; times.push(t); }
    st.heelV += (R ? 1 : -1) * 0.09;
    return { dur: (slots.length ? times[times.length - 1] : 0) + RECOIL_DUR, times };
  }

  function setGlow(k = 1) { if (typeof k === 'number' && Number.isFinite(k)) wu.uGlow.value = k; }
  function dispose() { root.removeFromParent(); wmat.dispose(); smat.dispose(); sdep.dispose(); fmat?.dispose(); }

  su.uBillow.value = st.billow; su.uLuff.value = st.luff;
  return { type, name: SHIPS[type].name, length: SHIPS[type].length, root, hull, sockets, update, fire, setGlow, dispose, stats: { tris: def.tris, ms: def.ms, drawCalls: foam ? 3 : 2 } };
}
