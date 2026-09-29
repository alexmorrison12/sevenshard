// Small procedural props for open-world interactables the zones don't draw themselves: trade-skill nodes (herbs, logs,
// ore, tracks, fishing ripples, dig mounds), floating lore tomes, vista viewpoints and triport attunement glows.
// Shared geometry/materials; each prop is a THREE.Group with an optional update(dt) for its idle motion.
import * as THREE from 'three';
import { lambert } from '../../engine/materials.js';

const G = {}, M = {};
const geo = (k, f) => G[k] || (G[k] = f());
const mat = (k, f) => M[k] || (M[k] = f());
const lam = (hex, o = {}) => lambert({ color: hex, ...(o.emissive ? { emissive: o.emissive } : {}) }, { rim: o.rim ?? 0.25, key: 'qprop-' + hex.toString(16) + (o.emissive ? '-e' : '') });
const glow = (hex, k = 2.6) => mat('glow:' + hex + ':' + k, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) }));
const addMat = hex => mat('add:' + hex, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.4), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));

function sparkle(root, hex, y = 1.3) {
  const s = new THREE.Mesh(geo('spark', () => new THREE.OctahedronGeometry(0.11, 0)), glow(hex, 3.2));
  s.position.y = y; root.add(s);
  const ring = new THREE.Mesh(geo('pring', () => { const g = new THREE.RingGeometry(0.5, 0.62, 32); g.rotateX(-Math.PI / 2); return g; }), addMat(hex));
  ring.position.y = 0.04; root.add(ring);
  return { s, ring };
}
function shadow(o) { o.traverse(m => { if (m.isMesh && !m.material.transparent && !(m.material.isMeshBasicMaterial)) { m.castShadow = true; m.receiveShadow = true; } }); }

const BUILD = {
  forage(root) {
    const stem = geo('herbStem', () => new THREE.ConeGeometry(0.05, 0.7, 5)), leaf = geo('herbLeaf', () => { const g = new THREE.SphereGeometry(0.16, 7, 5); g.scale(1, 0.35, 0.6); return g; });
    const bloom = geo('herbBloom', () => new THREE.IcosahedronGeometry(0.07, 0));
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.3, r = 0.18 + (i % 3) * 0.12;
      const st = new THREE.Mesh(stem, lam(0x4f8a34)); st.position.set(Math.cos(a) * r, 0.3 + (i % 2) * 0.08, Math.sin(a) * r); st.rotation.set(Math.sin(a) * 0.25, 0, Math.cos(a) * 0.25); root.add(st);
      const lf = new THREE.Mesh(leaf, lam(0x6fb046)); lf.position.set(Math.cos(a) * (r + 0.12), 0.16, Math.sin(a) * (r + 0.12)); lf.rotation.y = -a; root.add(lf);
      if (i % 2 === 0) { const b = new THREE.Mesh(bloom, glow(0xfff0a0, 1.6)); b.position.set(st.position.x, 0.68 + (i % 2) * 0.08, st.position.z); root.add(b); }
    }
    return sparkle(root, 0x9ae06a, 1.05);
  },
  log(root) {
    const log = new THREE.Mesh(geo('log', () => { const g = new THREE.CylinderGeometry(0.34, 0.38, 2.4, 10); g.rotateZ(Math.PI / 2); return g; }), lam(0x7a5434));
    log.position.y = 0.34; log.rotation.y = 0.5; root.add(log);
    const cut = new THREE.Mesh(geo('logCut', () => { const g = new THREE.CircleGeometry(0.34, 12); return g; }), lam(0xd8b07a));
    cut.position.set(Math.cos(0.5) * 1.21, 0.34, -Math.sin(0.5) * 1.21); cut.rotation.y = 0.5 + Math.PI / 2; root.add(cut);
    const axe = new THREE.Mesh(geo('axeHandle', () => new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5)), lam(0x5a3a22)); axe.position.set(0.2, 0.9, 0); axe.rotation.z = 0.5; root.add(axe);
    const head = new THREE.Mesh(geo('axeHead', () => new THREE.BoxGeometry(0.22, 0.14, 0.04)), lam(0xb8c0c8, { rim: 0.6 })); head.position.set(0.06, 0.62, 0); head.rotation.z = 0.5; root.add(head);
    return sparkle(root, 0xe8b070, 1.3);
  },
  mine(root) {
    const rock = new THREE.Mesh(geo('ore', () => { const g = new THREE.DodecahedronGeometry(0.7, 0); g.scale(1.2, 0.8, 1); return g; }), lam(0x6a6a72));
    rock.position.y = 0.45; rock.rotation.y = 0.7; root.add(rock);
    const cry = geo('oreCry', () => new THREE.OctahedronGeometry(0.16, 0));
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(cry, glow(0x9ad0ff, 1.8)); const a = i * 1.3; c.position.set(Math.cos(a) * 0.55, 0.5 + (i % 2) * 0.25, Math.sin(a) * 0.45); c.scale.set(1, 1.8, 1); c.rotation.set(a, a * 0.5, 0.3); root.add(c); }
    return sparkle(root, 0x9ab8ff, 1.5);
  },
  hunt(root) {
    const print = geo('paw', () => { const g = new THREE.CircleGeometry(0.1, 8); g.rotateX(-Math.PI / 2); return g; });
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(print, mat('pawm', () => new THREE.MeshBasicMaterial({ color: 0x3a2a1a, transparent: true, opacity: 0.75, depthWrite: false }))); p.position.set(-0.9 + i * 0.36, 0.03, (i % 2) * 0.22 - 0.1); root.add(p); }
    const bush = new THREE.Mesh(geo('bush', () => new THREE.IcosahedronGeometry(0.45, 1)), lam(0x4a7a36)); bush.position.set(0.9, 0.35, -0.2); bush.scale.set(1.2, 0.8, 1); root.add(bush);
    return sparkle(root, 0xe0906a, 1.0);
  },
  fish(root) {
    const ring = geo('ripple', () => { const g = new THREE.RingGeometry(0.3, 0.38, 28); g.rotateX(-Math.PI / 2); return g; });
    const rs = [];
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(ring, addMat(0x9ad8ff)); r.position.y = 0.05; root.add(r); rs.push(r); }
    root.userData.ripples = rs;
    return sparkle(root, 0x6ac0ff, 0.8);
  },
  dig(root) {
    const mound = new THREE.Mesh(geo('mound', () => { const g = new THREE.SphereGeometry(0.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.45, 0.85); return g; }), lam(0x7a5a3a));
    root.add(mound);
    const handle = new THREE.Mesh(geo('shovelH', () => new THREE.CylinderGeometry(0.03, 0.03, 1.0, 5)), lam(0x6a4a2a)); handle.position.set(0.25, 0.75, 0); handle.rotation.z = -0.3; root.add(handle);
    const blade = new THREE.Mesh(geo('shovelB', () => new THREE.BoxGeometry(0.22, 0.28, 0.03)), lam(0x9aa0a8, { rim: 0.5 })); blade.position.set(0.1, 0.3, 0); blade.rotation.z = -0.3; root.add(blade);
    return sparkle(root, 0xe8d08a, 1.3);
  },
  lore(root) {
    const book = new THREE.Group();
    const cover = new THREE.Mesh(geo('bookCover', () => new THREE.BoxGeometry(0.46, 0.06, 0.34)), lam(0x6a2a2a, { rim: 0.4 }));
    const pages = new THREE.Mesh(geo('bookPages', () => new THREE.BoxGeometry(0.42, 0.05, 0.3)), glow(0xfff4d8, 1.3)); pages.position.y = 0.05;
    book.add(cover, pages); book.position.y = 1.25; book.rotation.x = -0.5; root.add(book);
    root.userData.book = book;
    const halo = new THREE.Mesh(geo('bookHalo', () => { const g = new THREE.RingGeometry(0.28, 0.36, 24); return g; }), addMat(0xffd88a)); halo.position.y = 1.25; root.add(halo); root.userData.halo = halo;
    return sparkle(root, 0xffd88a, 1.7);
  },
  vista(root) {
    const legs = geo('tripod', () => new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5));
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(legs, lam(0x5a4028)); const a = i / 3 * Math.PI * 2; l.position.set(Math.cos(a) * 0.18, 0.52, Math.sin(a) * 0.18); l.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); root.add(l); }
    const tube = new THREE.Mesh(geo('scope', () => { const g = new THREE.CylinderGeometry(0.06, 0.09, 0.8, 10); g.rotateX(Math.PI / 2 - 0.35); return g; }), lam(0xc9a45a, { rim: 0.6 })); tube.position.y = 1.12; root.add(tube);
    return sparkle(root, 0x7fd0ff, 1.7);
  },
  triport(root) { return sparkle(root, 0x5fe0e8, 2.6); },
};

/** a prop for kind ('forage'|'log'|'mine'|'hunt'|'fish'|'dig'|'lore'|'vista'|'triport') at (x, y, z) */
export function makeFieldProp(kind, x, y, z, facing = 0) {
  const root = new THREE.Group(); root.position.set(x, y, z); root.rotation.y = facing;
  const b = (BUILD[kind] || BUILD.forage)(root);
  shadow(root);
  let t = Math.random() * 6;
  root.userData.update = dt => {
    t += dt;
    if (b?.s) { b.s.position.y += Math.sin(t * 2) * 0.002; b.s.rotation.y += dt * 1.5; }
    if (b?.ring) b.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 2.4));
    const rs = root.userData.ripples; if (rs) rs.forEach((r, i) => { const k = ((t * 0.5 + i / 3) % 1); r.scale.setScalar(0.5 + k * 2.2); r.material.opacity = 0.6 * (1 - k); });
    const bk = root.userData.book; if (bk) { bk.position.y = 1.25 + Math.sin(t * 1.6) * 0.06; bk.rotation.y += dt * 0.6; }
    const h = root.userData.halo; if (h) { h.position.y = 1.25 + Math.sin(t * 1.6) * 0.06; h.lookAt(h.position.x, h.position.y + 10, h.position.z + 30); }
  };
  root.userData.setActive = on => { if (b?.s) b.s.visible = on; if (b?.ring) b.ring.visible = on; root.traverse(m => { if (m.isMesh && m !== b?.s && m !== b?.ring && m.material?.color && !m.material.transparent) m.visible = on || kind === 'mine' || kind === 'log'; }); };
  return root;
}
