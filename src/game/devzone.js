// A plain test arena (flat stone floor + a few pillars) that satisfies the zone contract. Used by dev modes and as a
// fallback whenever a real zone is missing.
import * as THREE from 'three';
import { lambert } from '../engine/materials.js';
import { NavGrid } from './nav.js';

export function devZone({ size = 70, pillars = 8, theme = 'stone' } = {}) {
  const root = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const x = cv.getContext('2d');
  const base = theme === 'void' ? '#2a2233' : '#6f675c';
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    const s = 26 + Math.random() * 44, px = Math.random() * 512, py = Math.random() * 512;
    x.fillStyle = theme === 'void' ? `hsl(${270 + Math.random() * 20},${10 + Math.random() * 12}%,${16 + Math.random() * 10}%)` : `hsl(${28 + Math.random() * 16},${7 + Math.random() * 9}%,${34 + Math.random() * 14}%)`;
    x.beginPath(); x.roundRect(px - s / 2, py - s / 2, s, s * (0.7 + Math.random() * 0.5), 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; x.stroke();
  }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(size / 8, size / 8); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size + 40, size + 40), lambert({ map: tex }, { key: 'devground' }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  tex.repeat.set((size + 40) / 8, (size + 40) / 8);
  // border wall
  const wallMat = lambert({ color: theme === 'void' ? 0x2a1f35 : 0x5d564d }, { rim: 0.2, key: 'devwall' });
  const blocks = [];
  const half = size / 2;
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(size + 4, 3, 2), wallMat);
    const a = i * Math.PI / 2; w.position.set(Math.sin(a) * (half + 1), 1.5, Math.cos(a) * (half + 1)); w.rotation.y = a; w.castShadow = true; w.receiveShadow = true; root.add(w);
  }
  const pillarGeo = new THREE.CylinderGeometry(0.9, 1.1, 5, 12);
  for (let i = 0; i < pillars; i++) {
    const a = i / pillars * Math.PI * 2 + 0.3, r = half * 0.62;
    const p = new THREE.Mesh(pillarGeo, wallMat); p.position.set(Math.cos(a) * r, 2.5, Math.sin(a) * r); p.castShadow = p.receiveShadow = true; root.add(p);
    blocks.push({ x: p.position.x, z: p.position.z, r: 1.2 });
  }
  const nav = NavGrid.open(size, 0.5);
  for (let j = 0; j < nav.h; j++) for (let i = 0; i < nav.w; i++) {
    const cx = nav.x0 + (i + 0.5) * nav.cell, cz = nav.z0 + (j + 0.5) * nav.cell;
    for (const b of blocks) if ((cx - b.x) ** 2 + (cz - b.z) ** 2 < b.r * b.r) nav.data[j * nav.w + i] = 0;
  }
  return {
    root, nav, heightAt: () => 0, walkable: (x, z) => nav.ok(x, z),
    anchors: { spawn: { x: 0, z: 8, facing: 0 }, boss: { x: 0, z: -10, facing: Math.PI } },
    env: theme === 'void'
      ? { hemiSky: 0x6a64b8, hemiGround: 0x2a1c2a, hemiIntensity: 0.9, sunColor: 0xd8c8ff, sunIntensity: 2.0, fogColor: 0x1a1030, background: 0x0c0714, grade: { saturation: 1.12, vignette: 0.45 } }
      : { background: 0x1a1d24 },
    update() {}, dispose() { tex.dispose(); },
  };
}
