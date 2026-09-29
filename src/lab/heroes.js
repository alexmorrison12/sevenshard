// Heroes lab: single hero / 8-class lineup / NPC lineup / crowd; class, sex, tier, look pickers; every action;
// locomotion driver. URL params: ?view=iso|close|orbit &mode=single|lineup|npcs|crowd|tiers &cls= &sex= &tier= &act=
// &at=<0..1 freeze the action at this fraction> &speed= &combat=1 &rot=<deg facing> &face= &hair= ...
// Automation: window.__hero = { lab, heroes, hero, set(opts), play(name, o), at(name, u), stats() }
import * as THREE from 'three';
import { createLab } from './kit.js';
import { createHero, CLASSES, NPCS, HAIR_STYLES, SKIN_TONES, HAIR_COLORS, EYE_COLORS, MARK_COLORS, FACE_PRESETS } from '../models/hero/index.js';
import { MOVE_NAMES } from '../models/hero/moves.js';

const Q = Object.fromEntries(new URLSearchParams(location.search));
const lab = createLab({ title: 'Heroes', view: Q.view || 'iso', ground: 'stone', light: Q.light || 'day' });
const num = (k, d) => (Q[k] != null ? Number(Q[k]) : d);

const state = {
  mode: Q.mode || 'single',
  cls: Q.cls || 'reaver', sex: Q.sex || 'm', tier: num('tier', 1), wtier: num('wtier', num('tier', 1)), hone: num('hone', 0),
  npc: Q.npc || null, lod: Q.lod || 'full',
  look: {},
  speed: num('speed', 0), combat: Q.combat === '1', turn: num('turn', 0), circle: Q.circle === '1',
  rot: num('rot', 180), down: false, dead: false, stunned: false, sit: false, mounted: false,
};
for (const k of ['face', 'hair', 'skin', 'marks']) if (Q[k] != null) state.look[k] = Number(Q[k]);
for (const k of ['height', 'build']) if (Q[k] != null) state.look[k] = Number(Q[k]);
for (const k of ['hairColor', 'eyes', 'markColor']) if (Q[k] != null) state.look[k] = parseInt(Q[k], 16);

let heroes = [];
let curCam = null;
const info = lab.panel.text('');
function clear() { for (const h of heroes) h.dispose(); heroes = []; }
function spawn(opts, x = 0, z = 0) {
  const t0 = performance.now();
  const h = createHero(opts);
  const ms = performance.now() - t0;
  h.root.position.set(x, 0, z);
  h.root.rotation.y = state.rot * Math.PI / 180;
  lab.add(h.root);
  h._ms = ms;
  heroes.push(h);
  return h;
}
function rebuild() {
  clear();
  const base = { sex: state.sex, gear: { tier: state.tier }, weapon: { tier: state.wtier, hone: state.hone }, look: { ...state.look }, lod: state.lod };
  if (state.mode === 'lineup') {
    const cls = Object.keys(CLASSES);
    cls.forEach((c, i) => spawn({ ...base, cls: c, look: {} }, (i - 3.5) * 1.7, 0));
  } else if (state.mode === 'lineup2') { // both sexes, 2 rows
    const cls = Object.keys(CLASSES);
    cls.forEach((c, i) => { spawn({ ...base, cls: c, sex: 'm', look: {} }, (i - 3.5) * 1.7, -1.2); spawn({ ...base, cls: c, sex: 'f', look: {} }, (i - 3.5) * 1.7, 1.2); });
  } else if (state.mode === 'tiers') {
    for (let t = 0; t < 3; t++) { spawn({ ...base, cls: state.cls, sex: 'm', gear: { tier: t }, weapon: { tier: t, hone: t === 2 ? 20 : 0 } }, (t - 2.5) * 1.8, 0); spawn({ ...base, cls: state.cls, sex: 'f', gear: { tier: t }, weapon: { tier: t, hone: t === 2 ? 20 : 0 } }, (t + 0.5) * 1.8, 0); }
  } else if (state.mode === 'npcs') {
    NPCS.forEach((n, i) => spawn({ npc: n, sex: i % 3 === 1 ? 'f' : 'm', look: { hair: i % 8, face: i % 6, skin: i % 8 }, lod: state.lod }, ((i % 9) - 4) * 1.5, Math.floor(i / 9) * 2.2 - 1));
  } else if (state.mode === 'crowd') {
    const cls = Object.keys(CLASSES);
    for (let i = 0; i < 40; i++) spawn({ cls: cls[i % 8], sex: i % 2 ? 'f' : 'm', lod: 'crowd', gear: { tier: i % 3 }, look: { hair: i % 8, face: i % 6, skin: (i * 3) % 8 } }, ((i % 10) - 4.5) * 1.5, Math.floor(i / 10) * 2 - 3);
  } else {
    spawn({ ...base, cls: state.npc ? null : state.cls, npc: state.npc });
  }
  if (curCam) setCam(curCam); else lab.focus(new THREE.Vector3(0, 1, 0));
  showStats();
}
function showStats() {
  const h = heroes[0]; if (!h) return;
  const tris = heroes.reduce((a, x) => a + x.stats.tris, 0);
  info.set(`${heroes.length} hero(es) · first ${h._ms.toFixed(0)} ms · ${h.stats.tris | 0} tris · ${h.stats.drawCalls} draws${heroes.length > 1 ? ` · total ${(tris / 1000).toFixed(1)}k tris` : ''}\nheight ${h.height.toFixed(2)} m`);
}

// ---- panel ----
const P = lab.panel;
P.label('Hero');
P.select('mode', ['single', 'lineup', 'lineup2', 'tiers', 'npcs', 'crowd'], state.mode, v => { state.mode = v; rebuild(); });
P.select('class', Object.keys(CLASSES), state.cls, v => { state.cls = v; state.npc = null; state.look = {}; rebuild(); });
P.select('npc', ['-', ...NPCS], state.npc || '-', v => { state.npc = v === '-' ? null : v; rebuild(); });
P.buttons(['m', 'f'], v => { state.sex = v; state.look = {}; rebuild(); });
P.buttons(['tier 0', 'tier 1', 'tier 2'], v => { state.tier = +v.slice(5); state.wtier = state.tier; for (const h of heroes) h.setGear({ tier: state.tier }); showStats(); });
P.slider('hone', 0, 25, state.hone, v => { state.hone = Math.round(v); for (const h of heroes) h.setWeapon({ hone: state.hone }); }, 1);
P.select('lod', ['full', 'crowd'], state.lod, v => { state.lod = v; rebuild(); });
P.label('Look');
const lk = (k, v) => { state.look[k] = v; for (const h of heroes) h.setLook({ [k]: v }); showStats(); };
P.slider('face', 0, 5, state.look.face ?? 0, v => lk('face', Math.round(v)), 1);
P.slider('hair', 0, 7, state.look.hair ?? 0, v => lk('hair', Math.round(v)), 1);
P.slider('skin', 0, 7, state.look.skin ?? 2, v => lk('skin', Math.round(v)), 1);
P.buttons(HAIR_COLORS.map((c, i) => 'h' + i), v => lk('hairColor', HAIR_COLORS[+v.slice(1)]));
P.buttons(EYE_COLORS.map((c, i) => 'e' + i), v => lk('eyes', EYE_COLORS[+v.slice(1)]));
P.slider('height', 0.94, 1.06, state.look.height ?? 1, v => lk('height', v), 0.01);
P.slider('build', 0, 1, state.look.build ?? 0.5, v => lk('build', v), 0.25);
P.slider('marks', 0, 3, state.look.marks ?? 0, v => lk('marks', Math.round(v)), 1);
P.buttons(MARK_COLORS.map((c, i) => 'm' + i), v => lk('markColor', MARK_COLORS[+v.slice(1)]));
P.label('Motion');
P.slider('speed', 0, 7, state.speed, v => { state.speed = v; }, 0.1);
P.slider('turn', -4, 4, state.turn, v => { state.turn = v; }, 0.1);
P.check('combat', state.combat, v => { state.combat = v; });
P.check('run in a circle', state.circle, v => { state.circle = v; });
P.check('dead', false, v => { state.dead = v; });
P.check('down', false, v => { state.down = v; });
P.check('stunned', false, v => { state.stunned = v; });
P.check('sit', false, v => { state.sit = v; });
P.buttons(['pistol', 'shotgun', 'rifle'], v => { for (const h of heroes) h.setStance(v); });
P.buttons(['demon on', 'demon off'], v => { for (const h of heroes) h.setDemonForm(v === 'demon on'); });
P.buttons(['glow', 'no glow', 'tint'], v => { for (const h of heroes) { if (v === 'glow') h.setGlow(0xff2020, 1.2); else if (v === 'no glow') h.setGlow(0, 0); else { h.setTint(0xffffff, 0.8); setTimeout(() => h.setTint(0xffffff, 0), 90); } } });
P.label('Actions');
P.buttons(MOVE_NAMES(), v => { for (const h of heroes) h.play(v); });
P.button('stop loop', () => { for (const h of heroes) h.stop(); });

// ---- frame loop ----
let circleA = 0;
lab.onFrame((dt) => {
  for (const h of heroes) {
    let speed = state.speed, turn = state.turn;
    if (state.circle && state.mode === 'single') {
      speed = state.speed || 5; turn = speed / 3.2; circleA += turn * dt;
      h.root.rotation.y += turn * dt;
      const fx = -Math.sin(h.root.rotation.y), fz = -Math.cos(h.root.rotation.y);
      h.root.position.x += fx * speed * dt; h.root.position.z += fz * speed * dt;
      lab.focus(h.root.position);
    }
    h.update(dt, { speed, turn, combat: state.combat, dead: state.dead, down: state.down, stunned: state.stunned, sit: state.sit, mounted: state.mounted });
  }
});

// ---- extra cameras: full body / face / 3-quarter (close-up quality checks) ----
const CAMS = {
  full: { pos: [0, 1.25, 5.4], at: [0, 0.93, 0], fov: 30 },
  face: { pos: [0.0, 1.68, 1.05], at: [0, 1.62, 0], fov: 30 },
  tq: { pos: [3.2, 2.2, 4.2], at: [0, 0.95, 0], fov: 30 },
  wide: { pos: [0, 2.6, 13], at: [0, 0.9, 0], fov: 38 },
  row: { pos: [0, 1.5, 11.8], at: [0, 0.95, 0], fov: 40 },
  side: { pos: [5.6, 1.35, 0.4], at: [0, 1.0, -0.4], fov: 30 },
  // exact creation-screen framings (src/game/stage.js MenuStage.preview)
  cbody: { pos: [0.6, 1.3, 6.2], at: [0.3, 0.95, 0], fov: 32 },
  cface: { pos: [0.6, 1.66, 1.3], at: [0.3, 1.62, 0], fov: 28 },
  top: { pos: [0.01, 7.5, 0.6], at: [0, 0.8, -0.2], fov: 32 },
  iso2: { pos: [0, 5.85, 3.3], at: [0, 0.9, -0.3], fov: 34 },
};
function setCam(name) {
  const c = CAMS[name]; if (!c) return;
  curCam = name;
  lab.setView('orbit'); lab.view = 'cam';
  lab.camera.position.set(...c.pos); lab.controls.target.set(...c.at); lab.camera.fov = c.fov; lab.camera.updateProjectionMatrix(); lab.controls.update();
}
P.buttons(Object.keys(CAMS), v => setCam(v));
if (Q.cam) setCam(Q.cam);

// ---- automation ----
window.__hero = {
  lab, get heroes() { return heroes; }, get hero() { return heroes[0]; },
  set(o) { Object.assign(state, o); if (o.look) state.look = { ...o.look }; rebuild(); return heroes.length; },
  play(name, o) { return heroes.map(h => h.play(name, o)); },
  /** play `name` on every hero and advance to fraction u of its duration (lab paused) */
  at(name, u, o = {}) {
    lab.paused = true;
    const res = heroes.map(h => h.play(name, o));
    const dur = res[0]?.dur || 1, dt = 1 / 120;
    const n = Math.round(u * dur / dt);
    for (let i = 0; i < n; i++) lab.step(1, dt);
    return { dur, frames: n };
  },
  steps(n, dt = 1 / 60) { lab.paused = true; lab.step(n, dt); },
  cam: setCam,
  stats() { return heroes.map(h => ({ ms: +h._ms.toFixed(1), tris: h.stats.tris, draws: h.stats.drawCalls, height: +h.height.toFixed(3) })); },
};
if (Q.nopanel) lab.panel.hide();
// creation-screen lights (key + rim point lights, as in MenuStage.preview)
if (Q.studio) { const key = new THREE.PointLight(0xffe8c8, 25, 12); key.position.set(2.2, 2.6, 3); const rim = new THREE.PointLight(0x8ab4ff, 30, 12); rim.position.set(-2.5, 2.4, -2); lab.scene.add(key, rim); }
rebuild();
if (Q.act) setTimeout(() => { if (Q.at != null) window.__hero.at(Q.act, Number(Q.at)); else window.__hero.play(Q.act, { loop: Q.loop === '1' }); }, 50);
