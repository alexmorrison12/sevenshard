// Stronghold — Brightwater Isle, your manor island (zone 'stronghold'). The Manor, Workshop, Research Hall, Crew
// Barracks, Garden and Pet Ranch stand as interactable landmarks (glowing markers on the minimap) wired to the systems
// stronghold (src/game/systems/stronghold.js): build and upgrade, the crafting queue, research, crew dispatch, harvests
// and pet forage — with quick actions in each building's dialog and the full Stronghold window a click away. Your crew
// wander the isle, stationed pets roam by the ranch, the Steward collects everything that is ready, and the
// Dawnrunner at the jetty ferries you home (or out onto the Glass Sea).
// Launch: the Solhaven ferryman (service 'stronghold'), session.launch({ kind: 'stronghold' }), or docking by sea.
import * as THREE from 'three';
import { registerPlugin, registerContent, registerService, registerZoneMode, WINDOWS, LAUNCHERS } from '../registry.js';
import { Unit } from '../unit.js';
import { S, loadInstance, spawnLocal } from './inferno.js';
import { RNG } from '../../core/noise.js';

const BUILDINGS = {
  manor: { anchor: 'building:manor', tab: 'buildings', color: 0xf3c860, verb: 'Enter the manor' },
  workshop: { anchor: 'building:workshop', tab: 'workshop', color: 0xff9a50, verb: 'Work the forge' },
  research_hall: { anchor: 'building:research', tab: 'research', color: 0x8ab8ff, verb: 'Study' },
  barracks: { anchor: 'building:barracks', tab: 'dispatch', color: 0xff7a6a, verb: 'Muster the crew' },
  garden: { anchor: 'building:garden', tab: null, color: 0x8ae070, verb: 'Tend the garden' },
  ranch: { anchor: 'building:ranch', tab: null, color: 0xffc0e0, verb: 'Visit the ranch' },
};
const QUICK_CRAFTS = ['hp_potion', 'destruction_bomb', 'flame_grenade', 'fusion_timber', 'food1'];
const ROLE_OUTFIT = { Sailor: 'sailor', Scout: 'villager', Brawler: 'guard', Scholar: 'priest', Trader: 'merchant', Cook: 'farmer' };
const CREW_LINES = ['The isle’s quieter than Solhaven. I like it.', 'Send us somewhere, Captain. I’m getting soft.', 'Found a Pip in the pantry again.', 'The Dawnrunner’s rigging could use some love.', 'Is it true you honed a weapon to +20? Tell me the tap count.'];
const rowsText = rows => (rows || []).map(r => `${(r.count || 0).toLocaleString('en-US')} × ${r.name}`).join(', ');
const costText = cost => rowsText(S.common.costRows(cost));

/** a floating golden marker (building landmark): satisfies the model contract the visuals use */
function markerModel(color) {
  const root = new THREE.Group();
  const c = new THREE.Color(color);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.8) }));
  gem.scale.set(1, 1.55, 1); root.add(gem);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.02, 40), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.7), transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; root.add(ring);
  let t = Math.random() * 6;
  return {
    root, height: 3.3, radius: 0.5, sockets: {},
    update(dt) { t += dt; gem.rotation.y = t * 1.3; gem.position.y = 2.75 + Math.sin(t * 2) * 0.12; ring.material.opacity = 0.34 + Math.sin(t * 2.4) * 0.14; ring.scale.setScalar(1 + Math.sin(t * 1.2) * 0.04); },
    play() { return { dur: 0, hits: [] }; }, stop() {}, setTint() {}, setGlow() {},
    dispose() { gem.geometry.dispose(); gem.material.dispose(); ring.geometry.dispose(); ring.material.dispose(); },
  };
}

/** wander between idle spots (crew) / around a point (pets) */
class Wander {
  constructor(u, spots, rng) { this.u = u; this.spots = spots; this.rng = rng; this.wait = rng() * 5; this.goal = null; }
  update(dt, L) {
    const u = this.u; u.move.x = u.move.z = 0;
    if (u.data.talking > 0) { u.data.talking -= dt; return; }
    if (this.wait > 0) { this.wait -= dt; return; }
    if (!this.goal) {
      const s = this.spots[Math.floor(this.rng() * this.spots.length)];
      this.goal = L.nav.nearest(s.x + (this.rng() - 0.5) * 3, s.z + (this.rng() - 0.5) * 3, 4, 0.3) || s;
      if (this.rng() < 0.3) u.model?.play?.(['wave', 'think', 'point', 'cheer', 'shrug'][Math.floor(this.rng() * 5)], { dur: 2.2 });
    }
    const dx = this.goal.x - u.pos.x, dz = this.goal.z - u.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.6 || (u.blocked && d < 3)) { this.goal = null; this.wait = 3 + this.rng() * 9; return; }
    const sp = u.st.speed * (u.data.pet ? 0.7 : 0.5); u.move.x = dx / d * sp; u.move.z = dz / d * sp;
  }
}

export class StrongholdMode {
  constructor(session, zone, o = {}) { this.kind = 'stronghold'; this.s = session; this.g = session.game; this.o = o; this.signs = {}; this.npcs = []; this.crew = []; this.pets = []; this.t = 0; }
  get L() { return this.g.level; }
  get A() { return this.s.account; }
  enter() {
    const g = this.g, L = this.L, z = g.zone, A = z.anchors || {};
    const hour = new Date().getHours();
    const envName = hour >= 6 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
    if (z.envs?.[envName] && z.setEnv) g.applyEnv(z.setEnv(envName));
    for (const id of Object.keys(BUILDINGS)) this.placeSign(id);
    // residents: the steward and the shipwright
    this.addNpc('steward', { name: 'Steward Aldith Brightwater', title: 'Keeper of the Isle', npc: 'noble', sex: 'f' }, A['npc:steward'] || { x: 3, z: -25 });
    this.addNpc('shipwright', { name: 'Old Gull Harrow', title: 'Shipwright', npc: 'sailor' }, A['npc:shipwright'] || A['dock:ship'] || { x: 0, z: 30 });
    this.spawnCrew();
    this.spawnPets();
    g.audio?.music?.(z.env?.music || 'stronghold'); g.audio?.ambience?.(z.env?.ambience || 'stronghold');
    g.ui?.banner?.(z.name || 'Brightwater Isle', { kind: 'zone', sub: `Stronghold · Level ${S.stronghold.view(this.A).level}`, dur: 3 });
    this.s.bus.emit('stronghold', { enter: true });
  }
  exit() {}
  placeSign(id) {
    const L = this.L, a = this.g.zone.anchors?.[BUILDINGS[id].anchor]; if (!a) return;
    const old = this.signs[id]; if (old) L.remove(old);
    const info = S.stronghold.buildingInfo(this.A, id);
    const u = new Unit({ kind: 'npc', team: 2, name: info?.name || id, x: a.x, z: a.z, facing: 0, radius: 0.5, height: 3.3, stats: { hpMax: 1 } });
    u.untargetable = true; u.data.immovable = true; u.data.title = info?.level ? `Level ${info.level}` : 'Not built yet';
    u.data.npcDef = { id: 'sh:' + id, name: u.name, title: u.data.title, object: true };
    u.model = markerModel(info?.level ? BUILDINGS[id].color : 0x8a8f9a);
    u.data.lv = info?.level || 0;
    L.add(u);
    this.signs[id] = u;
  }
  addNpc(id, def, a) {
    const L = this.L;
    const u = new Unit({ kind: 'npc', team: 2, name: def.name, x: a.x, z: a.z, facing: a.facing ?? Math.PI, radius: 0.5, height: 1.85, stats: { hpMax: 1, speed: 2 } });
    u.data.npc = def.npc; u.data.look = {}; u.data.sex = def.sex || 'm'; u.data.title = def.title; u.data.immovable = true; u.untargetable = true;
    u.data.npcDef = { id: 'sh:' + id, name: def.name, title: def.title };
    L.add(u); this.npcs.push(u);
    return u;
  }
  spawnCrew() {
    const L = this.L, A = this.g.zone.anchors || {}, v = S.stronghold.view(this.A);
    const spots = Object.entries(A).filter(([k]) => k.startsWith('idle:')).map(([, a]) => a);
    if (!spots.length) spots.push(A.spawn || { x: 0, z: 10 });
    const rng = new RNG(v.crew.length * 97 + 5);
    v.crew.filter(c => !c.busy).slice(0, 8).forEach((c, i) => {
      const s = spots[i % spots.length];
      const u = new Unit({ kind: 'npc', team: 2, name: c.name, x: s.x + (rng.next() - 0.5) * 2, z: s.z + (rng.next() - 0.5) * 2, facing: rng.next() * 6.28, radius: 0.45, height: 1.8, stats: { hpMax: 1, speed: 3.6 } });
      u.data.npc = ROLE_OUTFIT[c.role] || 'villager'; u.data.look = {}; u.data.sex = rng.next() < 0.5 ? 'm' : 'f'; u.data.title = `${c.role} · Power ${c.power}`; u.untargetable = true;
      u.data.npcDef = { id: 'sh:crew', name: c.name, title: `${c.role} · Crew`, crew: c.id };
      u.ctrl = new Wander(u, spots, () => rng.next());
      L.add(u); this.crew.push(u);
    });
  }
  spawnPets() {
    const L = this.L, A = this.g.zone.anchors || {}, v = S.stronghold.view(this.A);
    const at = A['building:ranch']; if (!at || !v.ranch.level) return;
    const rng = new RNG(31);
    const spots = [0, 1, 2, 3].map(i => ({ x: at.x + Math.cos(i * 1.6) * 4, z: at.z + 3 + Math.sin(i * 1.6) * 3 }));
    for (const pet of (v.ranch.pets.length ? v.ranch.pets : (this.A.roster.pets || []).slice(0, 2))) {
      const u = new Unit({ kind: 'npc', team: 2, name: pet.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), x: at.x + rng.range(-3, 3), z: at.z + 3 + rng.range(-2, 2), radius: 0.3, height: 0.6, stats: { hpMax: 1, speed: 3 } });
      u.type = pet; u.data.tpl = { model: pet }; u.data.look = null; u.data.pet = true; u.untargetable = true;
      u.ctrl = new Wander(u, spots, () => rng.next());
      L.add(u); this.pets.push(u);
    }
  }
  update(dt) {
    this.t += dt;
    // refresh the building markers every half minute (upgrades finishing elsewhere, window actions)
    if ((this.signT = (this.signT ?? 30) - dt) <= 0) { this.signT = 30; for (const id of Object.keys(BUILDINGS)) { const lv = S.stronghold.buildingInfo(this.A, id)?.level || 0; if (this.signs[id] && lv !== this.signs[id].data.lv) this.placeSign(id); } }
  }
  interactable() {
    const me = this.g.hero?.u; if (!me) return null;
    let best = null, bd = 3.4;
    for (const u of [...Object.values(this.signs), ...this.npcs, ...this.crew]) { if (!u) continue; const d = me.distTo(u) - (u.data.npcDef?.object ? 0.8 : 0); if (d < bd) { bd = d; best = u; } }
    const dk = this.g.zone.anchors?.['dock:ship'];
    if (dk) { const d = Math.hypot(me.pos.x - dk.x, me.pos.z - dk.z); if (d < 3.2 && d < bd) best = { name: 'The Dawnrunner', portal: 'sh:ferry', shFerry: true }; }
    return best;
  }
  interact(t) {
    if (t?.shFerry) { ferryMenu(this.s); return true; }
    const id = t?.data?.npcDef?.id; if (!id?.startsWith('sh:')) return false;
    const key = id.slice(3);
    this.g.hero?.u?.faceTo(t.pos.x, t.pos.z);
    if (BUILDINGS[key]) buildingMenu(this.s, key, this);
    else if (key === 'steward') stewardMenu(this.s, this);
    else if (key === 'shipwright') ferryMenu(this.s);
    else if (key === 'crew') crewTalk(this.s, t);
    return true;
  }
  questHud() {
    const now = Date.now();
    if (this._q && now - this._q.t < 1000) return this._q.q;
    const v = S.stronghold.view(this.A), steps = [];
    steps.push({ text: `Action energy ${v.energy.toLocaleString('en-US')} / ${v.energyMax.toLocaleString('en-US')}`, n: 0, need: 0, done: false });
    const ready = v.crafts.filter(j => j.done).length;
    if (v.craftSlots) steps.push({ text: ready ? `Workshop: ${ready} craft${ready > 1 ? 's' : ''} ready` : `Workshop: ${v.crafts.length}/${v.craftSlots} slots busy`, n: ready, need: 0, done: ready > 0 });
    if (v.researching) steps.push({ text: `Research: ${v.researching.name} (${Math.ceil(v.researching.left / 60e3)} min)`, n: 0, need: 0, done: false });
    const back = v.dispatch.filter(d => d.done).length;
    if (v.dispatchSlots) steps.push({ text: back ? `Barracks: ${back} crew returned` : `Barracks: ${v.dispatch.length}/${v.dispatchSlots} missions out`, n: back, need: 0, done: back > 0 });
    if (v.garden.level && v.garden.ready.length) steps.push({ text: `Garden: ${rowsText(v.garden.ready.slice(0, 2))} ready`, n: 1, need: 0, done: true });
    const q = { id: 'stronghold', title: `Brightwater Isle — Stronghold Lv. ${v.level}`, kind: 'event', steps };
    this._q = { t: now, q };
    return q;
  }
}

// ================================================================================================ dialogs
function openWindow(s, tab) {
  const data = WINDOWS.stronghold ? WINDOWS.stronghold(s) : null;
  if (!data) { s.ui.toast('The stronghold ledger is being bound.', 'info'); return; }
  const w = s.ui.open('stronghold', data);
  if (w && tab && w.tab !== tab) { w.tab = tab; w.tabs?.set?.(tab); w.render?.(data); }
}
function refresh(s) { s.refreshWindow?.('stronghold'); s.refreshWindow?.('inventory'); }
function result(s, r, okText) {
  if (!r?.ok) { s.ui.toast(r?.msg || 'That can’t be done right now.', 'error'); s.game.audio?.sfx?.('ui_error', {}); return false; }
  if (r.rows?.length) { for (const x of r.rows.slice(0, 5)) s.ui.hud?.loot?.({ name: x.name, grade: x.grade, count: x.count, icon: x.icon, kind: x.kind }); }
  s.ui.toast(typeof okText === 'function' ? okText(r) : okText, r.rows?.length ? 'loot' : 'success');
  refresh(s);
  return true;
}
async function buildingMenu(s, id, mode) {
  const A = s.account, SH = S.stronghold, info = SH.buildingInfo(A, id), v = SH.view(A);
  if (!info) return;
  const B = BUILDINGS[id], choices = [];
  const lines = [info.desc];
  if (info.effect?.text) lines.push(info.effect.text);
  if (!info.level) {
    lines.push(info.next ? `Build it: ${costText(info.next.cost)}.${info.next.why ? ` (${info.next.why})` : ''}` : '');
    choices.push({ id: 'upgrade', text: `Build the ${info.name}${info.next?.can ? '' : ' (not yet)'}`, kind: 'shop' });
  } else {
    if (id === 'workshop') {
      const done = v.crafts.filter(j => j.done).length;
      if (done) choices.push({ id: 'collect', text: `Collect ${done} finished craft${done > 1 ? 's' : ''}`, kind: 'quest' });
      const free = v.craftSlots - v.crafts.length;
      if (free > 0) for (const q of SH.recipes(A).filter(r => QUICK_CRAFTS.includes(r.recipe) && !r.locked).slice(0, 3)) choices.push({ id: 'craft:' + q.recipe, text: `Craft ${q.name} — ${costText(q.cost)} · ${q.mins} min${q.can ? '' : ' (missing materials)'}`, kind: 'shop' });
      lines.push(`${v.crafts.length}/${v.craftSlots} crafting slots busy.`);
    } else if (id === 'research_hall') {
      if (v.researching) lines.push(`Researching ${v.researching.name}: ${Math.ceil(v.researching.left / 60e3)} min left.`);
      else { const next = v.research.find(r => r.available); if (next) choices.push({ id: 'research:' + next.id, text: `Research ${next.name} — ${next.desc} (${costText(next.cost)} · ${next.mins} min)`, kind: 'shop' }); }
    } else if (id === 'barracks') {
      const back = v.dispatch.filter(d => d.done);
      for (const d of back.slice(0, 3)) choices.push({ id: 'claim:' + d.id, text: `Welcome back the crew from “${d.name}”`, kind: 'quest' });
      lines.push(`${v.crew.length}/${v.crewCap} crew · ${v.dispatch.length}/${v.dispatchSlots} missions under way.`);
      if (v.crew.length < v.crewCap) choices.push({ id: 'recruit', text: A.has('crew_contract') ? 'Recruit a crew member (Crew Contract)' : 'Recruit a crew member (30,000 silver)', kind: 'shop' });
    } else if (id === 'garden') {
      if (v.garden.ready.length) choices.push({ id: 'garden', text: `Harvest ${rowsText(v.garden.ready)}`, kind: 'quest' });
      else lines.push('Nothing is ripe yet. The garden grows while you are away (up to a day’s worth).');
    } else if (id === 'ranch') {
      if (v.ranch.pets.length) choices.push({ id: 'ranch', text: 'Collect what the pets foraged', kind: 'quest' });
      const owned = (A.roster.pets || []).filter(p => !v.ranch.pets.includes(p));
      if (owned.length && v.ranch.pets.length < v.ranch.slots) choices.push({ id: 'station:' + owned[0], text: `Station your ${owned[0].replace(/_/g, ' ')} at the ranch`, kind: 'talk' });
      if (!(A.roster.pets || []).length) lines.push('You have no pets yet — Pip Seeds, rapport and the crystal shop bring companions.');
    } else if (id === 'manor') {
      lines.unshift(`Stronghold Level ${v.level} · ${v.xp.toLocaleString('en-US')} / ${v.xpNext.toLocaleString('en-US')} XP · Action Energy ${v.energy.toLocaleString('en-US')}.`);
      choices.push({ id: 'collectall', text: 'Collect everything that is ready', kind: 'quest' });
    }
    if (B.tab) choices.push({ id: 'window', text: `Open the ${B.tab === 'buildings' ? 'Stronghold ledger' : B.tab === 'dispatch' ? 'dispatch board' : B.tab === 'workshop' ? 'crafting queue' : 'research tree'}`, kind: 'talk' });
    if (info.next) choices.push({ id: 'upgrade', text: `Upgrade to Lv.${info.next.level} — ${costText(info.next.cost)}${info.next.can ? '' : ` (${info.next.why || 'not yet'})`}`, kind: 'shop' });
  }
  if (id === 'manor') choices.push({ id: 'ferry', text: 'Take the ferry back to Solhaven', kind: 'talk' });
  choices.push({ id: 'bye', text: 'Leave', kind: 'leave' });
  const pick = await s.ui.dialog({ name: info.name, title: info.level ? `Level ${info.level} / ${info.max}` : 'Brightwater Isle' }, [{ text: lines.filter(Boolean).join('\n'), choices }]);
  if (!pick || pick === 'bye') return;
  const [k, arg] = pick.split(':');
  if (k === 'upgrade') { if (result(s, SH.upgradeBuilding(A, id), r => `${info.name} is now level ${r.level}!${r.levelUps?.length ? ` Stronghold level ${r.levelUps[r.levelUps.length - 1]}!` : ''}`)) { s.game.audio?.sfx?.('honing_success', {}); s.game.fx?.play?.('level_up', { pos: mode.signs[id]?.pos || s.game.hero.u.pos }); mode.placeSign(id); mode._q = null; } }
  else if (k === 'collect') result(s, SH.collectCrafts(A, s.char), r => `Collected ${rowsText(r.rows)}.`);
  else if (k === 'craft') result(s, SH.craft(A, arg, 1), 'The forge roars — crafting started.');
  else if (k === 'research') result(s, SH.startResearch(A, arg), 'Research started.');
  else if (k === 'claim') result(s, SH.collectDispatch(A, s.char, arg), r => `${r.mission}: ${r.success ? 'success' : 'partial success'}${r.rows?.length ? ` — ${rowsText(r.rows)}` : ''}.`);
  else if (k === 'recruit') { if (result(s, SH.recruitCrew(A, { pay: A.has('crew_contract') ? 'contract' : 'silver' }), r => `${r.crew.name} (${r.crew.role}) joined your crew.`)) { mode.crew.forEach(u => mode.L.remove(u)); mode.crew = []; mode.spawnCrew(); } }
  else if (k === 'garden') result(s, SH.collectGarden(A), r => `Harvested ${rowsText(r.rows)}.`);
  else if (k === 'ranch') result(s, SH.collectRanch(A), r => `Your pets brought back ${rowsText(r.rows)}.`);
  else if (k === 'station') { const r = SH.stationPet(A, arg); result(s, r, r.stationed ? 'Your pet settles in at the ranch.' : 'Pet recalled.'); }
  else if (k === 'collectall') collectAll(s);
  else if (k === 'window') openWindow(s, B.tab);
  else if (k === 'ferry') s.returnToHub();
}
/** the steward: one button that collects everything ready */
function collectAll(s) {
  const A = s.account, SH = S.stronghold, got = [];
  const c = SH.collectCrafts(A, s.char); if (c.ok) got.push(...(c.rows || []));
  for (const d of SH.view(A).dispatch.filter(x => x.done)) { const r = SH.collectDispatch(A, s.char, d.id); if (r.ok) got.push(...(r.rows || [])); }
  const gdn = SH.collectGarden(A); if (gdn.ok) got.push(...gdn.rows);
  const rn = SH.collectRanch(A); if (rn.ok) got.push(...rn.rows);
  if (!got.length) { s.ui.toast('Nothing is ready yet.', 'info'); return; }
  for (const x of got.slice(0, 6)) s.ui.hud?.loot?.({ name: x.name, grade: x.grade, count: x.count, icon: x.icon, kind: x.kind });
  s.ui.toast(`Collected: ${rowsText(got.slice(0, 5))}${got.length > 5 ? '…' : ''}`, 'loot');
  s.game.audio?.sfx?.('chest_open', {});
  refresh(s);
}
async function stewardMenu(s, mode) {
  const A = s.account, v = S.stronghold.view(A);
  const ready = v.crafts.filter(j => j.done).length + v.dispatch.filter(d => d.done).length + (v.garden.ready.length ? 1 : 0);
  const built = v.buildings.filter(b => b.level > 0).length;
  const tip = built <= 1 ? 'Every building starts with timber and ore — log and mine in the fields, or buy them at the market.' : v.researching ? `The scholars are deep in ${v.researching.name}.` : 'The Research Hall is idle, if you have a project in mind.';
  const pick = await s.ui.dialog({ name: 'Steward Aldith Brightwater', title: 'Keeper of the Isle' }, [{ text: `Welcome home. Stronghold level ${v.level}, ${built} of ${v.buildings.length} buildings standing. ${ready ? `${ready} thing${ready > 1 ? 's are' : ' is'} ready for you.` : 'Nothing needs you right now.'}\n${tip}`, choices: [
    ...(ready ? [{ id: 'all', text: 'Collect everything that is ready.', kind: 'quest' }] : []),
    { id: 'ledger', text: 'Show me the ledger.', kind: 'talk' }, { id: 'bye', text: 'Carry on.', kind: 'leave' }] }]);
  if (pick === 'all') collectAll(s);
  else if (pick === 'ledger') openWindow(s, 'buildings');
  void mode;
}
async function ferryMenu(s) {
  const sail = !!LAUNCHERS.sail;
  const pick = await s.ui.dialog({ name: 'Old Gull Harrow', title: 'Shipwright' }, [{ text: 'The Dawnrunner’s trimmed and ready. Where to, Captain?', choices: [
    { id: 'home', text: 'Take the ferry to Solhaven.', kind: 'talk' },
    ...(sail ? [{ id: 'sail', text: 'Set sail on the Glass Sea.', kind: 'quest' }] : []),
    { id: 'bye', text: 'Not yet.', kind: 'leave' }] }]);
  if (pick === 'home') { s.game.audio?.sfx?.('ship_bell', {}); s.returnToHub(); }
  else if (pick === 'sail') s.launch({ kind: 'sail', from: 'stronghold' });
}
function crewTalk(s, u) {
  u.data.talking = 3; u.faceTo(s.game.hero.u.pos.x, s.game.hero.u.pos.z);
  u.model?.play?.('wave', { dur: 1.4 });
  s.ui.dialog({ name: u.name, title: u.data.npcDef.title }, [{ text: CREW_LINES[Math.floor(Math.random() * CREW_LINES.length)], choices: [{ id: 'dispatch', text: 'Let’s look at the dispatch board.', kind: 'talk' }, { id: 'bye', text: 'As you were.', kind: 'leave' }] }]).then(p => { if (p === 'dispatch') openWindow(s, 'dispatch'); });
}

// ================================================================================================ travel
async function launchStronghold(session, c = {}) {
  const g = session.game;
  await loadInstance(session, 'stronghold', { kind: 'stronghold', region: 'The Glass Sea', name: 'Brightwater Isle', tip: 'Your stronghold keeps working while you are away: crafts, research, crew missions and the garden.' });
  const A = g.zone.anchors || {}, dk = A['dock:ship'], sp = A.spawn || { x: 0, z: 16, facing: 0 };
  const at = dk ? { x: dk.x - Math.sin((dk.facing || 0) + Math.PI) * 2, z: dk.z - Math.cos((dk.facing || 0) + Math.PI) * 2 - 1.5, facing: (dk.facing || 0) + Math.PI } : sp;
  const p = g.level.nav.nearest(at.x, at.z, 8, 0.4) || sp;
  spawnLocal(session, { x: p.x, z: p.z, facing: at.facing ?? 0 });
  g.mode = session.hub = session.zoneMode('stronghold');
  session.hub.enter();
  session.inWorld();
  session.bus.emit('zone', { id: 'stronghold', kind: 'stronghold' });
}
registerContent('stronghold', launchStronghold);
registerZoneMode('stronghold', (session, zone, o) => new StrongholdMode(session, zone, o));

/** the Solhaven ferryman */
async function ferryman(session) {
  const v = S.stronghold.view(session.account);
  const ready = v.crafts.filter(j => j.done).length + v.dispatch.filter(d => d.done).length;
  const pick = await session.ui.dialog({ id: 'stronghold', name: 'Ferryman Tobin', title: 'Brightwater Ferry' }, [{ text: `Brightwater Isle, Captain — stronghold level ${v.level}.${ready ? ` Word from the isle: ${ready} job${ready > 1 ? 's' : ''} finished.` : ''} The crossing is free for the owner.`, choices: [
    { id: 'go', text: 'Take the ferry to Brightwater Isle.', kind: 'quest' }, { id: 'ledger', text: 'Show me the stronghold ledger.', kind: 'talk' }, { id: 'bye', text: 'Farewell.', kind: 'leave' }] }]);
  if (pick === 'go') { if (session.guestMode) { session.ui.toast('Your host’s stronghold isn’t yours to visit — yet.', 'info'); return; } session.game.audio?.sfx?.('ship_bell', {}); session.launch({ kind: 'stronghold' }); }
  else if (pick === 'ledger') openWindow(session, 'buildings');
}
registerService('stronghold', session => ferryman(session));

registerPlugin({
  id: 'modes:stronghold',
  init(session) { this.s = session; },
  hud(h) { const m = this.s.game.mode; if (m instanceof StrongholdMode) { try { (h.quests ||= []).unshift(m.questHud()); } catch (e) { console.error('[stronghold hud]', e); } } },
});
