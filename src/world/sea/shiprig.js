// A ship afloat: wraps a createShip() model so it rides the shared swell (heave, pitch and roll sampled from the
// Gerstner waves under bow/stern/port/starboard), drags a wake and wears hull foam. Used by the player's Dawnrunner,
// pirate brigs, the ghost ship and moored ships at island piers.
//
//   const rig = new ShipRig('dawnrunner', { waves });   parent.add(rig.root)
//   rig.update(dt, t, { x, z, heading, speed, turn, sail })   // heading = model facing (bow = (−sin h, −cos h))
//   rig.ship (the model: sockets, fire(side)…)  rig.body (Object3D carrying the floating transform)  rig.dispose()
import * as THREE from 'three';
import * as REAL from '../../models/creatures/ships/index.js';
import { createShip as contractShip, SHIPS as CONTRACT_SHIPS } from '../../models/creatures/index.js';
import { Wake, HullFoam } from './wake.js';

/** the richest available ship builder (the real ship module, else the creatures contract / placeholder) */
export function makeShip(type = 'dawnrunner') {
  const f = REAL.createShip || contractShip;
  return f(type);
}
export const SHIP_TYPES = REAL.SHIPS || CONTRACT_SHIPS || { dawnrunner: { name: 'Dawnrunner', length: 18 } };

const _t = { y: 0, pitch: 0, roll: 0 };
const _v = new THREE.Vector3();

export class ShipRig {
  /** o: { waves, wake: true, foam: true, len, beam, draft (sink below the waterline, m), scale } */
  constructor(type = 'dawnrunner', o = {}) {
    this.type = type; this.waves = o.waves;
    this.ship = o.ship || makeShip(type);
    const L = this.len = o.len ?? (this.ship.length || SHIP_TYPES[type]?.length || 18) * 0.82;
    this.beam = o.beam ?? L * 0.31;
    this.draft = o.draft ?? 0;
    this.root = new THREE.Group(); this.root.name = 'shiprig:' + type;
    this.body = new THREE.Group(); this.body.rotation.order = 'YXZ';
    this.body.add(this.ship.root);
    if (o.scale) this.ship.root.scale.setScalar(o.scale);
    this.root.add(this.body);
    this.foamNode = new THREE.Group(); this.root.add(this.foamNode);
    if (o.foam !== false && this.waves) { this.foam = new HullFoam({ waves: this.waves, len: L * 1.02, beam: this.beam * 1.05 }); this.foamNode.add(this.foam.mesh); }
    if (o.wake !== false && this.waves) { this.wake = new Wake({ waves: this.waves, beam: this.beam, life: o.wakeLife ?? 9 }); this.root.add(this.wake.mesh); }
    this.y = 0; this.pitch = 0; this.roll = 0; this.sink = 0; this.list = 0;
    this.state = { x: 0, z: 0, heading: 0, speed: 0, turn: 0, sail: 1 };
  }
  place(x, z, heading) {
    const s = this.state; s.x = x; s.z = z; s.heading = heading;
    this.body.position.set(x, 0, z); this.body.rotation.set(0, heading, 0);
    this.foamNode.position.set(x, 0, z); this.foamNode.rotation.y = heading;
    this.wake?.reset();
  }
  /** s: { x, z, heading, speed (m/s), turn (rad/s), sail 0..1 } */
  update(dt, t, s) {
    const st = this.state; Object.assign(st, s);
    const W = this.waves;
    if (W) W.tilt(st.x, st.z, t, st.heading, this.len, this.beam * 1.6, _t); else { _t.y = 0; _t.pitch = 0; _t.roll = 0; }
    const k = 1 - Math.exp(-dt * 5);
    this.y += (_t.y - this.y) * k; this.pitch += (_t.pitch * 0.85 - this.pitch) * k; this.roll += (_t.roll * 0.8 - this.roll) * k;
    const b = this.body;
    b.position.set(st.x, this.y - this.draft - this.sink, st.z);
    b.rotation.set(this.pitch + this.sink * 0.05, st.heading, this.roll + this.list);
    this.foamNode.position.set(st.x, 0, st.z); this.foamNode.rotation.y = st.heading;
    this.ship.update?.(dt, { speed: st.speed, turn: st.turn, sail: st.sail });
    if (this.foam) { this.foam.speed = Math.abs(st.speed) / 11; this.foam.amount = 1 - Math.min(1, this.sink / 3); }
    if (this.wake) {
      const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading);
      this.wake.update(dt, st.x - fx * this.len * 0.5, st.z - fz * this.len * 0.5, st.heading, this.sink > 1 ? 0 : st.speed);
    }
  }
  /** world position of a socket (helm, wake…) or a hull-local point */
  world(socketOrLocal, out = new THREE.Vector3()) {
    this.body.updateMatrixWorld(true);
    if (socketOrLocal?.isObject3D) return socketOrLocal.getWorldPosition(out);
    return out.copy(socketOrLocal).applyMatrix4(this.body.matrixWorld);
  }
  bowPoint(out = _v) { const h = this.state.heading; return out.set(this.state.x - Math.sin(h) * this.len * 0.55, 0.6, this.state.z - Math.cos(h) * this.len * 0.55); }
  setNight(n) { this.wake?.setNight(n); }
  dispose() {
    this.root.removeFromParent();
    this.ship.dispose?.();
    this.wake?.dispose(); this.foam?.dispose();
  }
}
