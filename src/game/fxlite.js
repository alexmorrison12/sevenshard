// Minimal FX implementation of the FX contract (telegraphs, projectiles, slashes, rings, numbers) used until the
// full FX module is wired, and as a safety net for any preset the FX module does not know.
import * as THREE from 'three';

const COLORS = { red: [2.2, 0.25, 0.15], orange: [2.4, 1.0, 0.1], blue: [0.3, 1.1, 3], purple: [1.4, 0.3, 2.6], yellow: [2.4, 2.0, 0.4], white: [2, 2, 2],
  crimson: [3.2, 0.35, 0.3], gold: [3, 2.2, 0.8], holy: [3, 2.6, 1.4], lightning: [1.2, 2.4, 4], fire: [3.5, 1.2, 0.2], ice: [1.2, 2.6, 3.4], arcane: [2.2, 0.8, 3.6], dark: [1.4, 0.3, 2.4], brass: [3, 1.8, 0.6], rose: [3, 1.2, 2.2], teal: [0.4, 2.8, 2.4], demon: [2.4, 0.3, 2.8], silver: [2, 2.2, 2.6], cyan: [0.6, 2.6, 3], green: [0.6, 2.8, 0.8] };
export const col = c => { const a = typeof c === 'string' ? COLORS[c] || COLORS.white : Array.isArray(c) ? c : [2, 2, 2]; return new THREE.Color(a[0], a[1], a[2]); };

const ringGeo = new THREE.RingGeometry(0.94, 1, 64, 1);
const discGeo = new THREE.CircleGeometry(1, 64);

function shapeGeo(o) {
  const s = o.shape;
  if (s === 'circle') return [discGeo, ringGeo, [o.r, o.r]];
  if (s === 'donut') { const g = new THREE.RingGeometry((o.inner || 1) / o.r, 1, 64); return [g, ringGeo, [o.r, o.r]]; }
  if (s === 'cone') { const a = o.angle || Math.PI / 2; const g = new THREE.CircleGeometry(1, 40, Math.PI / 2 - a / 2, a); return [g, g, [o.r, o.r]]; }
  if (s === 'rect' || s === 'line') { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); return [g, g, [o.width || 1.5, o.len || 4]]; }
  return [discGeo, ringGeo, [2, 2]];
}

export class FXLite {
  constructor(scene) {
    this.scene = scene; this.live = [];
    this.numLayer = document.createElement('div');
    this.numLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;overflow:hidden';
    document.body.appendChild(this.numLayer);
    this.camera = null;
  }
  add(obj, life, upd) { this.scene.add(obj); const h = { obj, life, t: 0, upd, stop: () => { h.t = h.life; } }; this.live.push(h); return h; }
  update(dt, t, camera) {
    this.camera = camera;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const h = this.live[i]; h.t += dt;
      h.upd?.(h, dt);
      if (h.t >= h.life) { this.scene.remove(h.obj); h.obj.traverse(o => { if (o.material) o.material.dispose(); }); this.live.splice(i, 1); }
    }
    for (const n of this.nums || []) { }
  }
  telegraph(o) {
    const [fillG, rimG, sc] = shapeGeo(o);
    const g = new THREE.Group();
    const c = col(o.color || 'red');
    const fillM = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.35), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const growM = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.6), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    const rimM = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const fill = new THREE.Mesh(fillG, fillM), grow = new THREE.Mesh(fillG, growM), rim = new THREE.Mesh(rimG, rimM);
    for (const m of [fill, grow, rim]) { m.rotation.x = -Math.PI / 2; m.scale.set(sc[0], sc[1], 1); g.add(m); }
    if (o.shape === 'rect' || o.shape === 'line') { rim.scale.set(sc[0], sc[1], 1); rimM.opacity = 0.25; }
    g.position.set(o.pos?.x ?? o.x, (o.pos?.y ?? 0) + 0.06, o.pos?.z ?? o.z);
    const dir = o.dir || { x: o.dx || 0, z: o.dz ?? -1 };
    g.rotation.y = Math.atan2(-dir.x, -dir.z);
    if (o.shape === 'rect' || o.shape === 'line') for (const m of [fill, grow, rim]) m.rotation.z = 0, m.rotation.x = -Math.PI / 2;
    const dur = o.dur || 1;
    return this.add(g, dur, h => {
      const k = Math.min(1, h.t / dur);
      if (o.shape === 'rect' || o.shape === 'line') grow.scale.set(sc[0], sc[1] * k, 1); else grow.scale.set(sc[0] * k, sc[1] * k, 1);
      if (o.follow) g.position.set(o.follow.pos.x, o.follow.pos.y + 0.06, o.follow.pos.z);
      rimM.opacity = 0.6 + Math.sin(h.t * 20) * 0.2;
    });
  }
  projectile(o) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(o.size || 0.25, 10, 8), new THREE.MeshBasicMaterial({ color: col(o.color || 'orange') }));
    m.position.set(o.from.x, o.from.y ?? 1.1, o.from.z);
    const h = this.add(m, 30, hh => { if (o.track) { m.position.set(o.track.x, o.track.y ?? 1.1, o.track.z); } });
    h.pos = m.position;
    return h;
  }
  slash(o) {
    const r = o.radius || o.r || 2.5, arc = o.arc ? o.arc * Math.PI / 180 : Math.PI * 0.9;
    const g = new THREE.RingGeometry(r * 0.55, r, 32, 1, Math.PI / 2 - arc / 2, arc);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col(o.color || 'white'), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    const grp = new THREE.Group(); grp.add(m);
    grp.position.set(o.pos.x, (o.pos.y || 0) + 1.0, o.pos.z);
    grp.rotation.y = Math.atan2(-(o.dir?.x || 0), -(o.dir?.z ?? -1));
    const dur = o.dur || 0.25;
    return this.add(grp, dur, h => { const k = h.t / dur; m.material.opacity = 0.9 * (1 - k); m.rotation.z = (o.flip ? -1 : 1) * k * 0.6; });
  }
  shockwave(o) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col(o.color || 'white'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(o.pos.x, (o.pos.y || 0) + 0.1, o.pos.z);
    const R = o.radius || o.r || 3, dur = o.dur || 0.4;
    return this.add(m, dur, h => { const k = h.t / dur; const s = R * (0.3 + 0.7 * k); m.scale.set(s, s, 1); m.material.opacity = 1 - k; });
  }
  burst(o) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: col(o.color || 'orange'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(o.pos.x, (o.pos.y || 0) + 0.8, o.pos.z);
    const R = o.radius || o.r || 1, dur = o.life || 0.35;
    return this.add(m, dur, h => { const k = h.t / dur; m.scale.setScalar(R * (0.4 + k)); m.material.opacity = 1 - k; });
  }
  hit(o) { return this.burst({ pos: { x: o.pos.x, y: (o.pos.y || 0) + 0.2, z: o.pos.z }, color: o.crit ? 'yellow' : 'white', radius: o.crit ? 0.5 : 0.3, life: 0.15 }); }
  number(pos, value, o = {}) {
    if (!this.camera) return;
    const v = new THREE.Vector3(pos.x, (pos.y || 0) + 2, pos.z).project(this.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    const style = o.style || 'normal';
    const color = { crit: '#ffd23a', heal: '#5cff7a', shield: '#7ae8ff', counter: '#5ab4ff', miss: '#aaa', back: '#ff9a3a', head: '#ff9a3a' }[style] || '#fff';
    el.textContent = typeof value === 'number' ? Math.round(value).toLocaleString('en-US') : value;
    const x = (v.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 30, y = (-v.y * 0.5 + 0.5) * innerHeight;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);font:800 ${style === 'crit' ? 26 : 19}px/1 "Segoe UI",system-ui,sans-serif;color:${color};text-shadow:0 2px 3px #000,0 0 6px #000;transition:transform .7s cubic-bezier(.2,.8,.3,1),opacity .7s .25s;white-space:nowrap`;
    this.numLayer.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-150%)'; el.style.opacity = '0'; });
    setTimeout(() => el.remove(), 1000);
  }
  play(name, p = {}) {
    const pos = p.pos || { x: p.x, y: 0, z: p.z };
    if (/wave|slash|cleave|finale/.test(name)) return this.slash({ ...p, pos, radius: p.r || 3 });
    if (/crater|shock|ring|nova|quake|stomp|explo|burst|meteor|split/.test(name)) return this.shockwave({ ...p, pos, radius: p.r || 3 });
    return this.burst({ ...p, pos, radius: (p.r || 1.2) * 0.5 });
  }
  decal() { return { stop() {} }; }
  aura() { return { stop() {} }; }
  trail() { return { stop() {} }; }
  death(o) { return this.burst({ pos: o.pos, color: 'dark', radius: 0.8, life: 0.4 }); }
  beam(o) { return this.burst({ pos: o.to, color: o.color, radius: 0.6 }); }
  lightning(o) { return this.burst({ pos: o.to, color: 'lightning', radius: 0.8 }); }
  portal(o) { return this.shockwave({ pos: o.pos, color: o.color || 'arcane', radius: 2, dur: 99 }); }
  lootBeam() { return { stop() {} }; }
  pickup() {}
  counterWindow(o) { return this.burst({ pos: o.attach?.position || o.pos, color: 'blue', radius: 2, life: o.dur || 0.6 }); }
}
