// The game camera: a fixed-yaw, high-pitch perspective camera that looks "north" (−Z) at a follow target,
// exactly like an isometric ARPG. Adds zoom, trauma-based shake, short cinematic moves and screen→ground picking.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const _v = new THREE.Vector3(), _r = new THREE.Raycaster(), _p = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export const ISO = { fov: 38, pitch: 54 * DEG, yaw: 0, dist: 20, minDist: 12, maxDist: 27 };

export class IsoCam {
  constructor(aspect = innerWidth / innerHeight) {
    this.cam = new THREE.PerspectiveCamera(ISO.fov, aspect, 0.5, 400);
    this.target = new THREE.Vector3();
    this.focus = new THREE.Vector3();      // smoothed target
    this.pitch = ISO.pitch; this.yaw = ISO.yaw;
    this.dist = ISO.dist; this.zoom = ISO.dist;
    this.minDist = ISO.minDist; this.maxDist = ISO.maxDist;
    this.follow = 10;                       // follow stiffness
    this.trauma = 0;                        // 0..1, shake = trauma²
    this.kick = new THREE.Vector3();        // directional impulse (decays)
    this.cine = null;                       // active cinematic move
    this.snap(new THREE.Vector3());
  }
  snap(p) { this.target.copy(p); this.focus.copy(p); this.apply(0); }
  /** trauma 0..1 (0.15 light hit, 0.4 heavy, 0.8 awakening/boss slam) */
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  push(dx, dz, amount = 0.3) { this.kick.x += dx * amount; this.kick.z += dz * amount; }
  zoomBy(d) { this.zoom = THREE.MathUtils.clamp(this.zoom + d, this.minDist, this.maxDist); }
  /**
   * Cinematic move: { pos:Vector3|[x,y,z], look:Vector3|[x,y,z], dur, ease, hold } – camera flies there and holds until
   * released with endCinematic(); the gameplay camera eases back.
   */
  cinematic(shot) {
    const v = a => a?.isVector3 ? a.clone() : new THREE.Vector3(...a);
    this.cine = { from: this.cam.position.clone(), fromLook: this._look?.clone() || this.focus.clone(), pos: v(shot.pos), look: v(shot.look), dur: shot.dur ?? 1.2, t: 0, back: false, fov: shot.fov };
  }
  endCinematic(dur = 0.8) { if (this.cine) { this.cine.back = true; this.cine.t = 0; this.cine.dur = dur; this.cine.from = this.cam.position.clone(); this.cine.fromLook = this._look.clone(); } }
  update(dt, t = performance.now() / 1000) {
    if (this.manual) return;                // menu stages drive the camera themselves
    const k = 1 - Math.exp(-this.follow * dt);
    this.focus.lerp(this.target, k);
    this.dist += (this.zoom - this.dist) * (1 - Math.exp(-8 * dt));
    this.kick.multiplyScalar(Math.exp(-10 * dt));
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.apply(t, dt);
  }
  apply(t, dt = 1 / 60) {
    const c = this.cam, f = this.focus;
    const off = _v.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(this.dist);
    const gp = new THREE.Vector3().copy(f).add(off).add(this.kick);
    const look = new THREE.Vector3().copy(f).add(this.kick);
    if (this.cine) {
      const s = this.cine; s.t += dt;
      const e = Math.min(1, s.t / s.dur), ee = e * e * (3 - 2 * e);
      if (!s.back) { c.position.lerpVectors(s.from, s.pos, ee); look.lerpVectors(s.fromLook, s.look, ee); }
      else { c.position.lerpVectors(s.from, gp, ee); look.lerpVectors(s.fromLook, look, ee); if (e >= 1) this.cine = null; }
      if (s.fov && !s.back) { c.fov = THREE.MathUtils.lerp(ISO.fov, s.fov, ee); c.updateProjectionMatrix(); }
      else if (c.fov !== ISO.fov) { c.fov = ISO.fov; c.updateProjectionMatrix(); }
    } else c.position.copy(gp);
    const sh = this.trauma * this.trauma;
    if (sh > 0.0001) {
      const n = (a, b) => Math.sin(t * a + b) * 0.6 + Math.sin(t * a * 2.13 + b * 1.7) * 0.4;
      c.position.x += n(47, 1) * sh * 0.55; c.position.y += n(53, 4) * sh * 0.45; c.position.z += n(41, 7) * sh * 0.3;
    }
    this._look = look;
    c.lookAt(look);
  }
  /** Screen pixel → point on the horizontal plane y = planeY (default: the follow target's height). */
  groundAt(px, py, planeY = this.target.y, out = new THREE.Vector3()) {
    _r.setFromCamera({ x: px / innerWidth * 2 - 1, y: -(py / innerHeight) * 2 + 1 }, this.cam);
    _p.constant = -planeY;
    return _r.ray.intersectPlane(_p, out) || out.copy(this.target);
  }
  /** World point → CSS pixels (for nameplates, damage numbers). Returns null when behind the camera. */
  toScreen(p, out = { x: 0, y: 0 }) {
    _v.copy(p).project(this.cam);
    if (_v.z > 1) return null;
    out.x = (_v.x * 0.5 + 0.5) * innerWidth; out.y = (-_v.y * 0.5 + 0.5) * innerHeight;
    return out;
  }
}
