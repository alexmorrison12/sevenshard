// World-space quest markers: the floating "!" / "?" over quest NPCs (gold = main story, blue = side, green = guide,
// "?" = ready to turn in) and objective beacons (a bobbing glow with a light pillar and a ground ring) for things to
// use, reach or defend. Owns its meshes (shared geometry/materials) and rebuilds itself when the level changes.
import * as THREE from 'three';

const COLORS = { msq: '#ffb43c', side: '#7fd0ff', guide: '#9be07a', event: '#ff8ad8', daily: '#7fd0ff', done: '#ffd35a', locked: '#8a8f9a' };
const TEX = {};
function markTex(kind) {
  const key = kind;
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = 96; c.height = 128;
  const x = c.getContext('2d');
  const col = COLORS[kind === 'done' ? 'done' : kind] || COLORS.msq;
  const glyph = kind === 'done' ? '?' : '!';
  // soft glow
  const g = x.createRadialGradient(48, 60, 4, 48, 60, 46); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
  x.fillStyle = g; x.fillRect(0, 0, 96, 128);
  // diamond plate
  x.save(); x.translate(48, 60); x.rotate(Math.PI / 4);
  x.fillStyle = 'rgba(20,12,4,.88)'; x.fillRect(-26, -26, 52, 52);
  x.strokeStyle = col; x.lineWidth = 4; x.strokeRect(-24, -24, 48, 48);
  x.restore();
  x.font = 'bold 58px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.9)'; x.strokeText(glyph, 48, 63);
  const lg = x.createLinearGradient(0, 30, 0, 95); lg.addColorStop(0, '#fffbe8'); lg.addColorStop(0.5, col); lg.addColorStop(1, '#8a4a10');
  x.fillStyle = lg; x.fillText(glyph, 48, 63);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (TEX[key] = t);
}
const MATS = {};
function spriteMat(kind) {
  if (MATS[kind]) return MATS[kind];
  const m = new THREE.SpriteMaterial({ map: markTex(kind), depthTest: false, depthWrite: false, transparent: true });
  m.color.setScalar(1.35);
  return (MATS[kind] = m);
}
// beacon parts (shared)
let BEACON = null;
function beaconParts() {
  if (BEACON) return BEACON;
  const pillarGeo = new THREE.CylinderGeometry(0.06, 0.34, 7, 12, 1, true); pillarGeo.translate(0, 3.5, 0);
  // vertex alpha: bright at the base, fading up
  const pos = pillarGeo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const a = 1 - pos.getY(i) / 7; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a * a; }
  pillarGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ringGeo = new THREE.RingGeometry(0.82, 1, 48); ringGeo.rotateX(-Math.PI / 2);
  const coreGeo = new THREE.OctahedronGeometry(0.2, 0);
  const add = (hex, k, o = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, ...o });
  BEACON = {
    pillarGeo, ringGeo, coreGeo,
    mats: {
      gold: { pillar: add('#ffcf6a', 1.1, { vertexColors: true, opacity: 0.55 }), ring: add('#ffcf6a', 1.6, { opacity: 0.7 }), core: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd98a').multiplyScalar(3) }) },
      blue: { pillar: add('#7fd0ff', 1.1, { vertexColors: true, opacity: 0.5 }), ring: add('#7fd0ff', 1.6, { opacity: 0.7 }), core: new THREE.MeshBasicMaterial({ color: new THREE.Color('#aee4ff').multiplyScalar(3) }) },
      red: { pillar: add('#ff6a4a', 1.1, { vertexColors: true, opacity: 0.45 }), ring: add('#ff6a4a', 1.6, { opacity: 0.7 }), core: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a7a').multiplyScalar(3) }) },
    },
  };
  return BEACON;
}

export class QuestMarkers {
  constructor(game) { this.g = game; this.level = null; this.npc = new Map(); this.beacons = new Map(); this.t = 0; }
  get scene() { return this.g.scene; }
  /** drop everything when the level changed */
  sync() {
    const L = this.g.level;
    if (L === this.level) return;
    this.clear(); this.level = L;
  }
  clear() {
    for (const s of this.npc.values()) s.sprite.removeFromParent();
    for (const b of this.beacons.values()) b.root.removeFromParent();
    this.npc.clear(); this.beacons.clear();
  }
  /** overhead marker for a unit: kind 'msq'|'side'|'guide'|'done'|null */
  setNpc(u, kind) {
    let m = this.npc.get(u);
    if (!kind) { if (m) { m.sprite.removeFromParent(); this.npc.delete(u); } return; }
    if (m && m.kind === kind) return;
    if (!m) { const sprite = new THREE.Sprite(spriteMat(kind)); sprite.renderOrder = 998; sprite.scale.set(0.72, 0.96, 1); this.scene.add(sprite); m = { sprite, kind, ph: Math.random() * 6 }; this.npc.set(u, m); }
    m.kind = kind; m.sprite.material = spriteMat(kind);
  }
  /** beacon at a world point: key (stable id), { x, z, r (ring radius), color 'gold'|'blue'|'red', pillar, core } | null */
  setBeacon(key, o) {
    let b = this.beacons.get(key);
    if (!o) { if (b) { b.root.removeFromParent(); this.beacons.delete(key); } return; }
    const P = beaconParts(), M = P.mats[o.color || 'gold'];
    if (!b) {
      const root = new THREE.Group();
      const pillar = new THREE.Mesh(P.pillarGeo, M.pillar), ring = new THREE.Mesh(P.ringGeo, M.ring), core = new THREE.Mesh(P.coreGeo, M.core);
      pillar.renderOrder = ring.renderOrder = 5; root.add(pillar, ring, core);
      this.scene.add(root);
      b = { root, pillar, ring, core, ph: Math.random() * 6 };
      this.beacons.set(key, b);
    }
    b.pillar.visible = o.pillar !== false; b.core.visible = o.core !== false;
    const y = this.g.level?.heightAt?.(o.x, o.z) ?? 0;
    b.root.position.set(o.x, y + 0.03, o.z); b.r = o.r || 0.9; b.coreY = o.coreY ?? 1.1;
    return b;
  }
  /** keep only these beacon keys */
  pruneBeacons(keep) { for (const k of [...this.beacons.keys()]) if (!keep.has(k)) this.setBeacon(k, null); }
  update(dt) {
    this.t += dt;
    const me = this.g.hero?.u;
    for (const [u, m] of this.npc) {
      if (!u.level || u.dead) { m.sprite.removeFromParent(); this.npc.delete(u); continue; }
      const h = (u.model?.height || u.height || 1.85);
      const bob = Math.sin(this.t * 2.6 + m.ph) * 0.08;
      m.sprite.position.set(u.pos.x, u.pos.y + h + 1.5 + bob, u.pos.z);
      const d = me ? Math.hypot(u.pos.x - me.pos.x, u.pos.z - me.pos.z) : 0;
      m.sprite.visible = d < 45 && !u.data.hidden;
      const s = 0.95 * (u.data.markerScale || 1); m.sprite.scale.set(s, s * 1.333, 1);
    }
    for (const b of this.beacons.values()) {
      const k = 0.5 + 0.5 * Math.sin(this.t * 2.2 + b.ph);
      b.ring.scale.setScalar(b.r * (0.92 + 0.1 * k));
      b.ring.material.opacity = 0.45 + 0.35 * k;
      b.core.position.y = b.coreY + Math.sin(this.t * 2 + b.ph) * 0.12;
      b.core.rotation.y += dt * 1.6;
    }
  }
  dispose() { this.clear(); }
}
