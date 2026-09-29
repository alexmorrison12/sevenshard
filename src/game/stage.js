// 3D backdrops for the menu screens: an animated title vista, the character-select lineup and the creation
// preview. Uses the running Game's scene with a dedicated camera path; everything is removed on leave().
import * as THREE from 'three';
import { makeModel } from './visuals.js';
import { Unit } from './unit.js';
import { SkillRun } from './skills/runner.js';
import { buildSkill } from './skills/tripods.js';
import { CLASSES } from '../data/classes/index.js';

export class MenuStage {
  constructor(game) { this.game = game; this.models = []; this.t = 0; this.kind = null; this.root = new THREE.Group(); game.scene.add(this.root); this.lights = []; }
  clear() {
    for (const m of this.models) { this.root.remove(m.root); m.dispose?.(); }
    this.models = []; this.hero = null;
    if (this.heroUnit) { this.heroUnit.skill?.cancel?.('stage'); this.game.level?.remove(this.heroUnit); this.heroUnit = null; }
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
  /** creation preview: a real hero unit on the stage that demonstrates its class's skills (with FX) in a loop */
  preview(o, at = this.at || { x: 0, z: 0 }) {
    const same = this.kind === 'create' && this.heroUnit && this.heroUnit.cls === o.cls && this.heroUnit.data.sex === o.sex;
    this.kind = 'create'; this.at = at; this.start();
    if (same) { this.heroUnit.data.look = o.look; this.heroUnit.model?.setLook?.(o.look); return; }
    this.clear();
    const L = this.game.level; if (!L) return;
    const u = new Unit({ kind: 'hero', team: 0, name: 'Preview', cls: o.cls, x: at.x, z: at.z, facing: Math.PI, stats: { hpMax: 1, mpMax: 0 } });
    Object.assign(u.data, { sex: o.sex, look: o.look, gear: { tier: 1 }, weapon: { tier: 1, hone: 15 }, lod: 'full', noAutoFace: true });
    u.untargetable = true; u.ctrl = null;
    L.add(u); u.pos.x = at.x; u.pos.z = at.z;
    this.heroUnit = u; this.hero = u.model;
    this.demoT = 1.2; this.demoIdx = 0;
    const kit = CLASSES[o.cls];
    this.demos = kit ? [...kit.defaultBar.map(id => kit.skills.find(sk => sk.id === id)).filter(Boolean), kit.awakening] : [];
    u.model?.play?.('identity', { dur: 1.2 });
    const key = new THREE.PointLight(0xffe8c8, 25, 12); key.position.set(at.x + 2.2, 2.6, at.z + 3);
    const rim = new THREE.PointLight(0x8ab4ff, 30, 12); rim.position.set(at.x - 2.5, 2.4, at.z - 2);
    this.root.add(key, rim); this.lights.push(key, rim);
  }
  /** play one skill of the preview hero (index into the demo list, or by name) */
  demo(i) {
    const u = this.heroUnit, L = this.game.level; if (!u || !L || !this.demos?.length) return;
    const k = this.demos[((i % this.demos.length) + this.demos.length) % this.demos.length]; if (!k) return;
    u.skill?.cancel?.('demo');
    const def = buildSkill(k, 10, [0, 0, 0]);
    const side = this.demoIdx % 2 ? 1 : -1;
    u.facing = Math.PI + side * 0.55;
    const ax = u.pos.x + side * -3.2, az = u.pos.z + 3.2;
    u.skill = new SkillRun(L, u, def, { aimX: ax, aimZ: az }, { visualOnly: true, kind: def.id === CLASSES[u.cls]?.awakening?.id ? 'awaken' : 'skill' });
    this.game.ui?.toast?.(`${def.name}`, 'info');
    this.demoT = Math.max(2.8, (def.dur || def.stages?.reduce((a, st) => a + st.dur, 0) || 1.2) + 1.8);
  }
  demoByName(name) { const i = this.demos?.findIndex(d => d.name === name); if (i >= 0) { this.demoIdx = i; this.demo(i); this.demoIdx++; this.demoT = Math.max(this.demoT, 4); } }
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
    } else if (this.kind === 'create' && this.heroUnit) {
      const face = this.view === 'face';
      // face view is centred on the hero (the side panels would cover an off-centre face)
      const target = new THREE.Vector3(this.at.x + (face ? 0 : 0.3), face ? 1.62 : 0.95, this.at.z);
      const pos = new THREE.Vector3(this.at.x + (face ? 0.15 : 0.6), face ? 1.66 : 1.3, this.at.z + (face ? 1.3 : 6.2));
      c.cam.position.lerp(pos, 1 - Math.exp(-5 * dt)); c.cam.lookAt(target); c.cam.fov = face ? 28 : 32; c.cam.updateProjectionMatrix();
      const u = this.heroUnit;
      if (face && u.skill) { u.skill.cancel?.('stage'); u.skill = null; }   // a demo mid-swing would leave the hero turned away
      u.pos.x = this.at.x; u.pos.z = this.at.z; u.lift = 0;
      if (!u.skill) u.facing += (Math.PI + (this.spin || 0) + Math.sin(t * 0.4) * 0.2 - u.facing) * (1 - Math.exp(-4 * dt));
      if (!face) { this.demoT -= dt; if (this.demoT <= 0) { this.demo(this.demoIdx++); } }
      this.game.camFocus = { x: this.at.x, y: 0, z: this.at.z };
    }
  }
}
