// Guardian bosses lab: boss / action pickers, state toggles, glow panel, part breaking, 1.85 m hero capsule for
// scale, game iso camera + low cinematic camera, hit-moment markers and root-motion preview for moving attacks.
// URL: ?boss=rimewing &act=bite (play on load) &loop=1 (repeat) &at=0.6 (simulate to t seconds, then freeze)
//      &view=iso|cine|orbit|close|front|side|top &face=3.14 (boss facing) &speed=3 &turn=0.5 &fly=1 &groggy=1
//      &enraged=1 &burrowed=1 &ghost=1 &dead=1 &counter=1 &enrage=1 &ghostGlow=1 &break=crest &hero=0 &dur=2
//      &light=day|dusk|dungeon|night &panel=0 &zoom=24 &clone=1
// Automation: window.__g = { boss, lab, play(name, dur), set(state), setBoss(id), sim(seconds), view(name) }
import * as THREE from 'three';
import { createLab } from './kit.js';
import { lambert } from '../engine/materials.js';
import { createBoss, BOSSES, bossStats } from '../models/bosses/guardians/index.js';

const Q = new URLSearchParams(location.search);
const num = (k, d) => Q.has(k) ? parseFloat(Q.get(k)) : d;
const lab = createLab({ title: 'Guardians', view: Q.get('view') === 'cine' ? 'orbit' : (Q.get('view') || 'iso'), ground: 'stone', light: Q.get('light') || 'day', size: 110 });
if (Q.get('panel') === '0') lab.panel.hide();

// ---------------- hero capsule for scale (1.85 m)
const heroMat = lambert({ color: 0xc8a060 }, { rim: 0.4, key: 'lab-hero' });
const hero = new THREE.Group();
const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.85 - 0.64, 6, 14), heroMat); cap.position.y = 0.925; hero.add(cap);
const heroHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lambert({ color: 0xe8c8a0 }, { key: 'lab-hero-h' })); heroHead.position.set(0, 1.62, -0.2); hero.add(heroHead);
hero.position.set(num('hx', 3.2), 0, num('hz', 7.5)); hero.rotation.y = Math.PI * 0.95;
lab.add(hero);
hero.visible = Q.get('hero') !== '0';

// ---------------- hit marker ring
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2), transparent: true, depthWrite: false, side: THREE.DoubleSide });
const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 48).rotateX(-Math.PI / 2), ringMat);
ring.visible = false; lab.scene.add(ring);
let ringT = 0;

// ---------------- boss
let boss = null, bossId = BOSSES[Q.get('boss')] ? Q.get('boss') : 'rimewing';
const state = { speed: undefined, turn: undefined, fly: num('fly', 0), groggy: Q.get('groggy') === '1', enraged: Q.get('enraged') === '1', burrowed: num('burrowed', 0), ghost: Q.get('ghost') === '1', dead: Q.get('dead') === '1' };
if (Q.has('speed')) state.speed = num('speed', 0);
if (Q.has('turn')) state.turn = num('turn', 0);
const facing = num('face', Math.PI * 0.82);
let cur = null;          // { name, t, dur, hits, fired, move, loop }
let origin = new THREE.Vector3();
const info = lab.panel.text('');
const actRow = { el: null };
const partRow = { el: null };

function setBoss(id) {
  if (boss) boss.dispose();
  bossId = id;
  const t0 = performance.now();
  boss = createBoss(id, { clone: Q.get('clone') === '1' });
  const ms = performance.now() - t0;
  boss.root.rotation.y = facing;
  boss.root.position.set(0, 0, 0);
  lab.add(boss.root);
  const st = bossStats().find(s => s.key.startsWith(id)) || {};
  info.set(`${BOSSES[id].name} — ${BOSSES[id].title}\nbuild ${st.ms} ms (sdf ${st.sdfMs}, parts ${st.partsMs}) · create ${ms.toFixed(0)} ms\n${(st.tris / 1000).toFixed(1)}k tris · ${st.verts} verts · ${st.bones} bones`);
  console.log(`[guardians] ${id} built`, JSON.stringify(st), `create ${ms.toFixed(1)} ms`);
  // action buttons
  if (actRow.el) actRow.el.remove();
  actRow.el = lab.panel.buttons(Object.keys(BOSSES[id].actions), (name) => play(name));
  if (partRow.el) partRow.el.remove();
  partRow.el = lab.panel.buttons(['break: ' + (BOSSES[id].parts.join(', ') || '—')], () => { for (const p of BOSSES[id].parts) boss.breakPart(p); });
  if (Q.get('break')) for (const p of Q.get('break').split(',')) boss.breakPart(p);
  for (const k of ['counter', 'enrage']) if (Q.has(k)) boss.setGlow(k, num(k, 1));
  if (Q.has('ghostGlow')) boss.setGlow('ghost', num('ghostGlow', 1));
  if (Q.get('nomem') === '1' && boss.meshes.membrane) boss.meshes.membrane.visible = false;
  boss.update(1 / 60, state);
}

function play(name, dur) {
  const a = BOSSES[bossId].actions[name];
  const r = boss.play(name, dur ? { dur } : {});
  cur = { name, t: 0, dur: r.dur, hits: r.hits, fired: new Set(), move: a.move, scale: r.dur / a.dur, loop: !!a.loop };
  origin.copy(boss.root.position);
  if (a.move) origin.set(0, 0, 0);
  return r;
}

// ---------------- panel
lab.panel.label('Boss');
lab.panel.select('boss', Object.keys(BOSSES), bossId, (v) => { setBoss(v); });
lab.panel.label('Actions');
setBoss(bossId);
lab.panel.label('State');
lab.panel.check('groggy', state.groggy, v => { state.groggy = v; });
lab.panel.check('enraged', state.enraged, v => { state.enraged = v; });
lab.panel.check('ghost', state.ghost, v => { state.ghost = v; });
lab.panel.check('dead', state.dead, v => { state.dead = v; });
lab.panel.slider('fly', 0, 1, state.fly, v => { state.fly = v; });
lab.panel.slider('burrowed', 0, 1, state.burrowed, v => { state.burrowed = v; });
lab.panel.slider('speed', -2, 9, state.speed ?? 0, v => { state.speed = v; });
lab.panel.slider('turn', -1.5, 1.5, state.turn ?? 0, v => { state.turn = v; });
lab.panel.label('Glow');
lab.panel.slider('counter', 0, 1, 0, v => boss.setGlow('counter', v));
lab.panel.slider('enrage', 0, 1, 0, v => boss.setGlow('enrage', v));
lab.panel.slider('ghost', 0, 1, 0, v => boss.setGlow('ghost', v));
lab.panel.button('hit flash', () => boss.setTint(0xffffff, 0.6, 0.2));
lab.panel.button('freeze tint', () => boss.setTint(0x9fdcff, boss.U.uTintAmt.value > 0 ? 0 : 0.45));
lab.panel.label('Camera');
lab.panel.buttons(['iso', 'cine', 'orbit', 'close', 'side', 'front'], v => view(v));
lab.panel.check('hero', hero.visible, v => { hero.visible = v; });
const hitText = lab.panel.text('');

function view(name) {
  const h = BOSSES[bossId].height;
  if (name === 'cine') {
    lab.setView('orbit');
    // low, close, looking up at the head from in front / beside the boss
    const f = boss.root.rotation.y, fw = new THREE.Vector3(-Math.sin(f), 0, -Math.cos(f)), side = new THREE.Vector3(Math.cos(f), 0, -Math.sin(f));
    const d = num('cd', h * 2.4 + 3), sd = num('cs', h * 0.9);
    const p = boss.root.position.clone().addScaledVector(fw, d).addScaledVector(side, sd); p.y = num('cy', 1.3);
    lab.camera.position.copy(p); lab.camera.fov = 34; lab.camera.updateProjectionMatrix();
    lab.controls.target.set(boss.root.position.x + fw.x * h * 0.3, h * num('ct', 0.62), boss.root.position.z + fw.z * h * 0.3);
    lab.controls.update();
  } else if (name === 'iso') {
    lab.setView('iso', new THREE.Vector3(num('fx', 0.5), 0, num('fz', 2.0)));
    if (Q.has('zoom')) { lab.iso.zoom = lab.iso.dist = num('zoom', 21); lab.iso.snap(new THREE.Vector3(num('fx', 0.5), 0, num('fz', 2.0))); }
  } else {
    lab.setView(name, new THREE.Vector3(0, h * 0.5, 0));
    const k = h / 1.85 * 0.9;
    if (name !== 'top') { const p = lab.camera.position.clone().sub(lab.controls.target).multiplyScalar(k); lab.camera.position.copy(lab.controls.target).add(p); }
  }
}

// ---------------- frame
lab.onFrame((dt, t) => {
  if (!boss) return;
  if (cur) {
    cur.t += dt;
    for (let i = 0; i < cur.hits.length; i++) if (!cur.fired.has(i) && cur.t >= cur.hits[i]) {
      cur.fired.add(i);
      const p = boss.socketPos('mouth'); ring.position.set(p.x, 0.05, p.z); ring.visible = true; ringT = 0.45;
      hitText.set(`HIT ${cur.name} #${i + 1} @ ${cur.hits[i].toFixed(2)} s`);
    }
    if (cur.move) {
      const m = cur.move, s = cur.scale;
      const k = Math.min(1, Math.max(0, (cur.t - m.t0 * s) / ((m.t1 - m.t0) * s)));
      const e = k * k * (3 - 2 * k);
      const f = boss.root.rotation.y;
      boss.root.position.set(origin.x - Math.sin(f) * m.dist * e, 0, origin.z - Math.cos(f) * m.dist * e);
    }
    if (cur.t >= cur.dur && !cur.loop) {
      if (Q.get('loop') === '1') { boss.root.position.copy(origin); if (cur.move) boss.root.position.set(0, 0, 0); play(cur.name, cur.dur !== BOSSES[bossId].actions[cur.name].dur ? cur.dur : undefined); }
      else { if (cur.move) setTimeout(() => boss.root.position.set(0, 0, 0), 600); cur = null; }
    }
  }
  if (ringT > 0) { ringT -= dt; ring.scale.setScalar(1 + (0.45 - ringT) * 5); ringMat.opacity = Math.max(0, ringT / 0.45); if (ringT <= 0) ring.visible = false; }
  boss.update(dt, state);
});

// ---------------- boot: optional action, simulate to a time, freeze
view(Q.get('view') || 'iso');
function sim(seconds) { const n = Math.round(seconds * 60); lab.step(n, 1 / 60); }
if (Q.get('act')) play(Q.get('act'), Q.has('dur') ? num('dur', 0) : undefined);
if (Q.has('pre')) sim(num('pre', 0));
if (Q.has('at')) { sim(num('at', 0)); lab.paused = true; }
if (Q.get('view') === 'cine') view('cine');
if (Q.has('cp')) { // explicit camera: &cp=x,y,z&ctg=x,y,z (&fov=)
  lab.setView('orbit'); const cp = Q.get('cp').split(',').map(Number), ct = (Q.get('ctg') || '0,3,0').split(',').map(Number);
  lab.camera.position.set(...cp); lab.controls.target.set(...ct); lab.camera.fov = num('fov', 35); lab.camera.updateProjectionMatrix(); lab.controls.update();
}
window.__g = { get boss() { return boss; }, lab, play, set: (s) => Object.assign(state, s), setBoss, sim, view, BOSSES };
