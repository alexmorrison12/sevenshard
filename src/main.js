// SEVENSHARD boot. Dev entry points (?dev=arena&cls=reaver) jump straight into a test arena.
import { Game } from './game/game.js';
import { devZone } from './game/devzone.js';
import { heroStats } from './game/systems/stats.js';
import { makeMob, refFor } from './game/ai/mob.js';
import { DebugHud } from './game/debughud.js';
import { buildHud } from './game/hudstate.js';
import { CLASSES } from './data/classes/index.js';
import { buildZone, equip } from './game/providers.js';

const q = Object.fromEntries(new URLSearchParams(location.search));
const bootMsg = t => { const m = document.getElementById('boot-msg'); if (m) m.textContent = t; };
const bootDone = () => { const b = document.getElementById('boot'); if (b) { b.style.transition = 'opacity .5s'; b.style.opacity = '0'; setTimeout(() => b.remove(), 600); } };

async function devArena() {
  bootMsg('Opening the arena…');
  const game = window.__game = new Game({ quality: q.q || 'high' });
  const zone = q.zone ? await buildZone(q.zone) : devZone({ theme: q.theme || 'stone' });
  game.setZone(zone);
  const cls = CLASSES[q.cls] ? q.cls : 'reaver';
  const ilvl = +(q.ilvl || 1415);
  const char = { name: 'Tester', cls, sex: q.sex || 'm', level: 60, skills: {}, engr: [], look: {}, gear: { tier: 1 } };
  for (const s of CLASSES[cls].skills) char.skills[s.id] = { lv: 10, tri: [0, 0, 0] };
  char.equip = { weapon: { iLvl: ilvl, quality: 90 }, head: { iLvl: ilvl }, shoulder: { iLvl: ilvl }, chest: { iLvl: ilvl }, pants: { iLvl: ilvl }, gloves: { iLvl: ilvl } };
  const st = heroStats(char);
  const kit = game.spawnHero(char, st, zone.anchors.spawn);
  devUI(game);
  const ref = refFor(ilvl);
  const wave = () => {
    const L = game.level, n = +(q.mobs || 24);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 14;
      const type = i % 8 === 0 ? 'legionnaire' : i % 5 === 0 ? 'hellhound' : i % 11 === 0 ? 'abyss_caster' : 'imp';
      L.add(makeMob(type, { x: Math.cos(a) * r, z: Math.sin(a) * r - 4, ref, alert: true }));
    }
    if (q.brute !== '0') L.add(makeMob('brute', { x: 0, z: -18, ref, alert: true }));
  };
  wave();
  game.level.every(2, () => { if (game.level.units.filter(u => u.kind === 'mob' && !u.dead).length < 4) wave(); });
  game.start();
  bootDone();
  return game;
}

async function devBoss() {
  bootMsg('Tracking the guardian…');
  const { EncounterMode } = await import('./game/modes/encounter.js');
  const { BOSS_DEFS } = await import('./data/bosses/index.js');
  const game = window.__game = new Game({ quality: q.q || 'high' });
  let def = BOSS_DEFS[q.boss] || BOSS_DEFS.rimewing, zoneId = q.zone || def.arena || 'frostmere';
  if (q.raid) { const { RAIDS } = await import('./data/raids.js'); const gt = RAIDS[q.raid].gates[(+q.gate || 1) - 1]; def = BOSS_DEFS[gt.bosses[0].boss] || def; zoneId = q.zone || gt.zone; }
  const zone = await buildZone(zoneId);
  game.setZone(zone);
  const cls = CLASSES[q.cls] ? q.cls : 'reaver', ilvl = +(q.ilvl || 1415);
  const char = { name: 'Tester', cls, sex: q.sex || 'm', level: 60, skills: {}, engr: [], look: {}, gear: { tier: 1 } };
  for (const s of CLASSES[cls].skills) char.skills[s.id] = { lv: 10, tri: [0, 0, 0] };
  char.equip = { weapon: { iLvl: ilvl, quality: 90 }, head: { iLvl: ilvl }, shoulder: { iLvl: ilvl }, chest: { iLvl: ilvl }, pants: { iLvl: ilvl }, gloves: { iLvl: ilvl } };
  game.spawnHero(char, heroStats(char), zone.anchors.spawn);
  devUI(game);
  let gateOpts = {};
  if (q.raid) { const { RAIDS } = await import('./data/raids.js'); const r = RAIDS[q.raid], gt = r.gates[(+q.gate || 1) - 1]; gateOpts = { bosses: gt.bosses, partySize: r.players, hard: q.hard === '1' }; }
  game.mode = new EncounterMode(game, { boss: def, ilvl, partySize: +(q.party || 4), ...gateOpts, onEnd: r => { console.log('[result]', JSON.stringify({ cleared: r.cleared, time: r.time, meter: r.meter.map(m => [m.name, m.cls, Math.round(m.dps)]) })); window.__result = r; } });
  game.mode.enter();
  game.placeInfo = () => ({ zone: zoneId, kind: 'encounter', boss: def.id });
  if (q.auto) autopilot(game);
  if (q.host) { const { NetHost } = await import('./net/host.js'); window.__net = new NetHost(game, { name: 'Host', onStatus: s => console.log('[net]', JSON.stringify(s)) }); }
  game.start(); bootDone();
  return game;
}

/** Join a friend's world by room code (?dev=join&code=ABC123&cls=starcaller). */
async function devJoin() {
  bootMsg('Joining your friend…');
  const { NetGuest } = await import('./net/guest.js');
  const { GuestMode } = await import('./net/guestmode.js');
  const game = window.__game = new Game({ quality: q.q || 'high' });
  devUI(game);
  const cls = CLASSES[q.cls] ? q.cls : 'reaver', ilvl = +(q.ilvl || 1415);
  const char = devChar(cls, ilvl); char.name = q.name || 'Guest';
  let started = false;
  const net = window.__net = new NetGuest(game, q.code, char, {
    onStatus: s => console.log('[net]', JSON.stringify(s)),
    onClose: r => console.log('[net] closed', r),
    onResult: r => { console.log('[result]', JSON.stringify(r).slice(0, 300)); window.__result = r; },
    onPlace: async place => {
      const zone = await buildZone(place.zone || 'test');
      game.setZone(zone);
      game.spawnHero(char, heroStats(char), zone.anchors.spawn);
      game.mode = new GuestMode(game, place, net); game.mode.enter();
      if (q.auto) autopilot(game);
      if (!started) { started = true; game.start(); bootDone(); }
    },
  });
  return game;
}

async function devChaos() {
  bootMsg('Opening the rift…');
  const { ChaosMode } = await import('./game/modes/chaos.js');
  const game = window.__game = new Game({ quality: q.q || 'high' });
  const zone = await buildZone('chaos_rift');
  game.setZone(zone);
  const cls = CLASSES[q.cls] ? q.cls : 'reaver', ilvl = +(q.ilvl || 1415);
  const char = devChar(cls, ilvl);
  game.spawnHero(char, heroStats(char), zone.anchors['stage1:spawn'] || zone.anchors.spawn);
  devUI(game);
  game.mode = new ChaosMode(game, { ilvl, tier: 3, allies: +(q.allies || 0), rested: true, onEnd: r => { console.log('[result]', JSON.stringify({ cleared: r.cleared, time: r.time, kills: r.kills })); window.__result = r; } });
  game.mode.enter();
  if (q.auto) autopilot(game);
  game.start(); bootDone();
  return game;
}
function devChar(cls, ilvl) {
  const char = { name: 'Tester', cls, sex: q.sex || 'm', level: 60, skills: {}, engr: [], look: {}, gear: { tier: 1 } };
  for (const s of CLASSES[cls].skills) char.skills[s.id] = { lv: 10, tri: [0, 0, 0] };
  char.equip = { weapon: { iLvl: ilvl, quality: 90 }, head: { iLvl: ilvl }, shoulder: { iLvl: ilvl }, chest: { iLvl: ilvl }, pants: { iLvl: ilvl }, gloves: { iLvl: ilvl } };
  return char;
}
/** Let the AI play the local hero (testing & attract mode). */
async function autopilot(game) {
  const { AllyAI } = await import('./game/ai/ally.js');
  const ai = new AllyAI(game.hero, 'tryhard');
  game.player.input = () => {};
  game.hero.u.ctrl = ai;
  // portals: walk into them
  game.hooks.frame.push(() => { const m = game.mode; if (m?.portal) { ai.moveTo(m.portal.x, m.portal.z); } });
}

function devUI(game) {
  equip(game, { ui: !q.debughud, onAction: (t, p) => console.log('[ui action]', t, JSON.stringify(p || {}).slice(0, 200)) });
  if (q.debughud || !game.ui) {
    const hud = new DebugHud();
    game.ui = { banner: (t, o) => console.log('[banner]', t, o?.sub || ''), toast: t => console.log('[toast]', t) };
    game.onHud = () => hud.update(buildHud(game));
  } else {
    game.ui.screen('game');
    const bn = game.ui.banner.bind(game.ui);
    game.ui.banner = (t, o) => { console.log('[banner]', t, o?.sub || ''); return bn(t, o); };
    game.onHud = () => game.ui.hud.update(buildHud(game));
  }
}

/** WebGL2 is required; say so plainly instead of failing on a black page */
function webgl2() { try { const gl = document.createElement('canvas').getContext('webgl2'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; } catch { return false; } }
async function boot() {
  if (!webgl2()) { bootMsg('SEVENSHARD needs WebGL 2. Please use a current Chrome, Edge, Firefox or Safari, and make sure hardware acceleration is on.'); return; }
  // field zones register themselves one microtask after the bundle evaluates (import cycle with world/index.js)
  await new Promise(r => setTimeout(r, 0));
  if (!q.dev) { const { Session } = await import('./game/session.js'); const s = new Session(); return s.boot(); }
  if (q.dev === 'join') return devJoin();
  if (q.dev === 'chaos') return devChaos();
  if (q.dev === 'boss') return devBoss();
  if (q.dev === 'arena') return devArena();
}
boot().catch(e => { console.error(e); bootMsg('Something went wrong: ' + e.message); });
