// Ships (placeholder hull until the real ship models land). createShip(type) → { root, sockets, update, fire, dispose }
import * as THREE from 'three';
import { lambert } from '../../engine/materials.js';

export const SHIPS = {
  dawnrunner: { name: 'Dawnrunner', length: 18 }, pirate: { name: 'Pirate Brig', length: 17 },
  ghost: { name: 'Ghost Ship', length: 19 }, merchant: { name: 'Merchant Cog', length: 16 },
};

export function createShip(type = 'dawnrunner') {
  const L = SHIPS[type]?.length ?? 18;
  const root = new THREE.Object3D(); root.name = 'ship:' + type;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(L * 0.28, L * 0.18, L), lambert({ color: 0x6a4a2a }));
  hull.position.y = L * 0.04; hull.castShadow = true; root.add(hull);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, L * 0.8), lambert({ color: 0x4a3420 }));
  mast.position.y = L * 0.45; mast.castShadow = true; root.add(mast);
  const mk = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); root.add(o); return o; };
  const sockets = { helm: mk(0, L * 0.16, L * 0.38), wake: mk(0, 0, L * 0.5), cannonsL: [], cannonsR: [] };
  for (let i = 0; i < 3; i++) { sockets.cannonsL.push(mk(-L * 0.15, L * 0.1, -L * 0.2 + i * L * 0.18)); sockets.cannonsR.push(mk(L * 0.15, L * 0.1, -L * 0.2 + i * L * 0.18)); }
  return { root, sockets, type, length: L, update() {}, fire() { return { dur: 0.5 }; }, dispose() { root.removeFromParent(); } };
}
