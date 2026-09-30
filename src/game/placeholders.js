// Stand-in models that honour the model contracts (hero / creature / boss) until the real ones are wired, and
// whenever a type has no real model yet. Simple, readable shapes with a hint of animation.
import * as THREE from 'three';
import { lambert } from '../engine/materials.js';

const G = {};
const geo = (k, f) => G[k] || (G[k] = f());
const M = {};
const mat = (hex, emis = 0) => M[hex + ':' + emis] || (M[hex + ':' + emis] = lambert({ color: hex, emissive: emis ? new THREE.Color(hex).multiplyScalar(emis) : 0x000000 }, { rim: 0.35 }));

function basic(root, height, radius, parts) {
  const sockets = { head: new THREE.Object3D(), handR: new THREE.Object3D(), handL: new THREE.Object3D(), weapon: new THREE.Object3D(), weaponTip: new THREE.Object3D(), back: new THREE.Object3D(), chest: new THREE.Object3D(), overhead: new THREE.Object3D(), center: new THREE.Object3D(), mouth: new THREE.Object3D() };
  sockets.head.position.y = height * 0.9; sockets.overhead.position.y = height + 0.4; sockets.chest.position.y = height * 0.65; sockets.center.position.y = height * 0.5;
  sockets.handR.position.set(-radius, height * 0.5, -0.2); sockets.handL.position.set(radius, height * 0.5, -0.2); sockets.weapon.position.copy(sockets.handR.position);
  sockets.weaponTip.position.set(-radius, height * 0.9, -0.8); sockets.mouth.position.set(0, height * 0.8, -radius);
  for (const s of Object.values(sockets)) root.add(s);
  const pivot = parts.pivot;
  let act = null, actT = 0, actDur = 0, tint = 0, tintCol = new THREE.Color(), glow = 0, loop = false;
  const mats = []; root.traverse(o => { if (o.material) mats.push(o.material); });
  return {
    placeholder: true,   // tests count these: a real game unit should never end up with one
    root, height, radius, sockets,
    update(dt, st = {}) {
      const t = performance.now() / 1000;
      if (st.dead) { pivot.rotation.x = THREE.MathUtils.lerp(pivot.rotation.x, -Math.PI / 2, 1 - Math.exp(-8 * dt)); pivot.position.y = THREE.MathUtils.lerp(pivot.position.y, radius * 0.6, 1 - Math.exp(-8 * dt)); return; }
      const down = st.down;
      pivot.rotation.x = THREE.MathUtils.lerp(pivot.rotation.x, down ? -1.3 : 0, 1 - Math.exp(-14 * dt));
      pivot.position.y = (st.speed > 0.3 ? Math.abs(Math.sin(t * 11)) * 0.08 : Math.sin(t * 2) * 0.02);
      pivot.rotation.z = st.speed > 0.3 ? Math.sin(t * 11) * 0.05 : 0;
      if (act) {
        actT += dt; const k = Math.min(1, actT / actDur);
        const s = Math.sin(k * Math.PI);
        if (/spin/.test(act)) pivot.rotation.y = k * Math.PI * 2 * (act === 'spin_loop' ? 3 : 1);
        else if (/leap/.test(act)) pivot.position.y += s * 0.3;
        else if (/death/.test(act)) {}
        else { pivot.rotation.x = -s * 0.35; pivot.position.z = -s * 0.25; }
        if (k >= 1) { if (loop) actT = 0; else { act = null; pivot.rotation.y = 0; pivot.position.z = 0; } }
      }
      if (tint > 0) { tint = Math.max(0, tint - dt * 5); }
      for (const m of mats) if (m.emissive) m.emissive.copy(m.userData.baseEm || (m.userData.baseEm = m.emissive.clone())).lerp(tintCol, tint).addScalar(glow * 0.05);
    },
    play(a, o = {}) { act = a; actT = 0; actDur = o.dur || 0.6; loop = !!o.loop; return { dur: actDur, hits: [actDur * 0.5] }; },
    stop() { act = null; pivot.rotation.y = 0; },
    setTint(hex, amount) { tintCol.set(hex); tint = amount; },
    setGlow(hex, v) { glow = v; },
    setStance() {}, setDemonForm(on) { root.scale.setScalar(on ? 1.25 : 1); }, setLook() {}, setGear() {}, breakPart() {},
    dispose() {},
  };
}
const CLASS_COL = { reaver: 0x9a2020, oathkeeper: 0xe8d8a0, stormfist: 0x3a70c8, pistoleer: 0x8a6030, starcaller: 0x6a3aa8, songweaver: 0xd070a0, bladedancer: 0x505870, demonbound: 0x402050 };

export function placeholderHero(o = {}) {
  const root = new THREE.Group(), pivot = new THREE.Group(); root.add(pivot);
  const col = CLASS_COL[o.cls] || (o.npc ? 0x8a7a5a : 0x707070);
  const body = new THREE.Mesh(geo('hbody', () => new THREE.CapsuleGeometry(0.32, 0.9, 4, 12)), mat(col)); body.position.y = 0.95; pivot.add(body);
  const head = new THREE.Mesh(geo('hhead', () => new THREE.SphereGeometry(0.2, 16, 12)), mat(0xe0b890)); head.position.y = 1.68; pivot.add(head);
  const sword = new THREE.Mesh(geo('hsword', () => new THREE.BoxGeometry(0.1, 0.1, 1.5)), mat(0xd0d8e0, 0)); sword.position.set(-0.4, 1.0, -0.6); pivot.add(sword);
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; } });
  return basic(root, 1.85, 0.45, { pivot });
}
export function placeholderCreature(type, o = {}) {
  const root = new THREE.Group(), pivot = new THREE.Group(); root.add(pivot);
  const s = o.scale || 1, h = (o.height || 1.2) * s, r = (o.radius || 0.5) * s;
  const col = { imp: 0x8a2a2a, hellhound: 0x5a1a10, legionnaire: 0x3a2a3a, brute: 0x4a2020, abyss_caster: 0x3a1a5a, crystal_golem: 0x6ab0d0, wisp: 0x9ad8ff }[type] || 0x6a5a4a;
  const body = new THREE.Mesh(geo('cbody', () => new THREE.SphereGeometry(1, 14, 10)), mat(col)); body.scale.set(r, h * 0.45, r); body.position.y = h * 0.5; pivot.add(body);
  for (const sx of [-1, 1]) { const eye = new THREE.Mesh(geo('ceye', () => new THREE.SphereGeometry(0.07, 8, 6)), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.2, 0.3) })); eye.position.set(sx * r * 0.35, h * 0.72, -r * 0.85); pivot.add(eye); }
  root.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return basic(root, h, r, { pivot });
}
export function placeholderBoss(id, o = {}) {
  const c = placeholderCreature(id, { height: o.height || 6, radius: o.radius || 2.5 });
  return c;
}
