// 3D backdrops for the menu screens: an animated title vista, the character-select lineup and the creation
// preview. Uses the running Game's scene with a dedicated camera path; everything is removed on leave().
import * as THREE from 'three';
import { makeModel } from './visuals.js';

export class MenuStage {
  constructor(game) { this.game = game; this.models = []; this.t = 0; this.kind = null; this.root = new THREE.Group(); game.scene.add(this.root); this.lights = []; }
  clear() {
    for (const m of this.models) { this.root.remove(m.root); m.dispose?.(); }
    this.models = []; this.hero = null;
    for (const l of this.lights) this.root.remove(l);
    this.lights = [];
  }
  leave() { this.clear(); this.game.scene.remove(this.root); this.game.camFocus = null; this.game.cam.cine = null; this.game.cam.manual = false; this.game.cam.cam.fov = 38; this.game.cam.cam.updateProjectionMatrix(); this.kind = null; this.game.hooks.frame = this.game.hooks.frame.filter(f => f !== this._tick); this._tick = null; }
  start() { this.game.cam.manual = true; if (this._tick) return; this._tick = dt => this.update(dt); this.game.hooks.frame.push(this._tick); }
  /** slow cinematic drift over the loaded zone (title screen) */
  title(center = { x: 0, z: 0 }) {
    this.clear(); this.kind = 'title'; this.center = center; this.start();
  }
  /** roster lineup: chars = [{ id, cls, sex, look, gear, level }] */
  lineup(chars, selectedId, at = { x: 0, z: 0 }) {
    this.clear(); this.kind = 'lineup'; this.at = at; this.start();
    const n = chars.length;
    chars.forEach((c, i) => {
      const m = makeModel({ kind: 'hero', cls: c.cls, data: { sex: c.sex, look: c.look, gear: c.gear || { tier: c.level >= 50 ? 1 : 0 }, weapon: c.weapon, lod: 'full' } });
      const x = at.x + (i - (n - 1) / 2) * 2.6;
      m.root.position.set(x, 0, at.z); m.root.rotation.y = Math.PI;
      m.charId = c.id; m.baseX = x;
      this.root.add(m.root); this.models.push(m);
    });
    this.select(selectedId);
    const spot = new THREE.SpotLight(0xffe2b0, 60, 30, 0.45, 0.6, 1.5); spot.position.set(at.x, 9, at.z + 6); spot.target.position.set(at.x, 0, at.z); spot.castShadow = false;
    this.root.add(spot, spot.target); this.lights.push(spot, spot.target); this.spot = spot;
  }
  select(id) {
    this.sel = id;
    const m = this.models.find(x => x.charId === id);
    if (m) { m.play?.('victory', { dur: 1.6 }); this.spot?.target.position.set(m.baseX, 0, this.at.z); this.spot?.position.set(m.baseX, 9, this.at.z + 6); }
  }
  /** creation preview: one hero, rebuilt when class/sex change, setLook for cosmetics */
  preview(o, at = { x: 0, z: 0 }) {
    const same = this.kind === 'create' && this.hero && this.hero.cls === o.cls && this.hero.sex === o.sex;
    this.kind = 'create'; this.at = at; this.start();
    if (same) { this.hero.setLook?.(o.look); return; }
    this.clear();
    const m = makeModel({ kind: 'hero', cls: o.cls, data: { sex: o.sex, look: o.look, gear: { tier: 1 }, lod: 'full' } });
    m.root.position.set(at.x, 0, at.z); m.root.rotation.y = Math.PI; m.cls = o.cls; m.sex = o.sex;
    this.root.add(m.root); this.models.push(m); this.hero = m;
    m.play?.('identity', { dur: 1.2 });
    const key = new THREE.PointLight(0xffe8c8, 25, 12); key.position.set(at.x + 2.2, 2.6, at.z + 3);
    const rim = new THREE.PointLight(0x8ab4ff, 30, 12); rim.position.set(at.x - 2.5, 2.4, at.z - 2);
    this.root.add(key, rim); this.lights.push(key, rim);
  }
  update(dt) {
    this.t += dt;
    const c = this.game.cam, t = this.t;
    for (const m of this.models) m.update?.(dt, { speed: 0, combat: false });
    if (this.kind === 'title') {
      const p = this.center, r = 24, a = t * 0.035;
      c.cine = null;
      c.cam.position.set(p.x + Math.sin(a) * r, 11 + Math.sin(t * 0.07) * 1.5, p.z + Math.cos(a) * r);
      c.cam.lookAt(p.x, 2, p.z); c.cam.fov = 42; c.cam.updateProjectionMatrix();
      this.game.camFocus = { x: p.x, y: 0, z: p.z };
    } else if (this.kind === 'lineup') {
      const m = this.models.find(x => x.charId === this.sel) || this.models[0];
      const fx = m ? m.baseX : this.at.x;
      c.cam.position.lerp(new THREE.Vector3(fx * 0.6, 2.4, this.at.z + 8.5), 1 - Math.exp(-3 * dt));
      c.cam.lookAt(fx * 0.8, 1.2, this.at.z); c.cam.fov = 35; c.cam.updateProjectionMatrix();
      this.game.camFocus = { x: fx, y: 0, z: this.at.z };
      for (const x of this.models) { const sel = x === m; x.root.position.z += ((sel ? this.at.z + 0.9 : this.at.z) - x.root.position.z) * (1 - Math.exp(-6 * dt)); }
    } else if (this.kind === 'create' && this.hero) {
      const face = this.view === 'face';
      const target = new THREE.Vector3(this.at.x + 0.3, face ? 1.62 : 0.95, this.at.z);
      const pos = new THREE.Vector3(this.at.x + 0.6, face ? 1.66 : 1.3, this.at.z + (face ? 1.3 : 6.2));
      c.cam.position.lerp(pos, 1 - Math.exp(-5 * dt)); c.cam.lookAt(target); c.cam.fov = face ? 28 : 32; c.cam.updateProjectionMatrix();
      this.hero.root.rotation.y = Math.PI + (this.spin || 0) + Math.sin(t * 0.4) * 0.25;
      this.game.camFocus = { x: this.at.x, y: 0, z: this.at.z };
    }
  }
}
