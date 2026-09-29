// Pipeline smoke test: lit primitives, bloom, shadows, iso camera.
import * as THREE from 'three';
import { createLab } from './kit.js';
import { lambert } from '../engine/materials.js';
const lab = createLab({ title: 'Smoke', view: 'iso', ground: 'stone' });
const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.6), lambert({ color: 0x8a5a3a }, { rim: 0.4 }));
box.position.y = 0.9; lab.add(box);
const orb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2, 0.6) }));
orb.position.set(2, 1.2, 0); lab.add(orb);
for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 12), lambert({ color: 0x9a9080 })); c.position.set(Math.cos(i / 12 * 6.28) * 9, 1.5, Math.sin(i / 12 * 6.28) * 9); lab.add(c); }
lab.onFrame((dt, t) => { box.rotation.y = t; orb.position.y = 1.2 + Math.sin(t * 2) * 0.3; });
