// Rift Cube — a 10-room wave gauntlet across the three rift islands. Costs a Rift Cube Ticket (3 free every week;
// Inferno boss floors and Chaos Gates drop more). Each room: waves + a champion, 45 s on the clock; room 10 is a
// pit lord. Rewards escalate with every room cleared and are paid from the Cube Chest when the run ends.
// Launch: session.launch({ kind: 'cube', party: 1|4 }). Shares helpers with inferno.js (used inside functions only).
import { registerContent } from '../registry.js';
import { refFor } from '../ai/mob.js';
import { heal, kill } from '../combat.js';
import { CUBE, partyHp, bandOf } from '../../data/inferno.js';
import { weekId } from '../../core/util.js';
import { RNG } from '../../core/noise.js';
import { S, spawnLocal, normalChar, showResults, dpsRows, track, mobFrom, RunParty, loadInstance, mergeRows, clearFoes, fmtTime, AUTO, weighted } from './inferno.js';
import { heroStats } from '../systems/stats.js';

/** weekly free tickets + records: roster.records.cube = { week, best, runs } */
export function cubeState(account, now = Date.now()) {
  const r = account.roster.records ||= {};
  const c = r.cube ||= { week: null, best: 0, runs: 0 };
  const w = weekId(now);
  if (c.week !== w) { c.week = w; account.give(CUBE.ticket, CUBE.weekly); c.granted = (c.granted || 0) + CUBE.weekly; account.save(); }
  return c;
}

class CubeMode {
  constructor(session, c) {
    this.kind = 'cube'; this.s = session; this.g = session.game; this.c = c;
    this.room = 0; this.state = 'intro'; this.t = 0; this.roomT = 0; this.kills = 0; this.cleared = 0;
    this.partySize = c.party || 1; this.rng = new RNG((Date.now() % 1e9) >>> 0); this.offs = [];
  }
  get L() { return this.g.level; }
  get me() { return this.g.hero?.u; }
  enter() {
    const g = this.g, L = this.L;
    this.ref = refFor(CUBE.ilvl);
    const party = this.party = g.party = new RunParty(g, { reviveAt: () => this.roomSpawn(), onDeath: u => this.onHeroDeath(u) });
    party.addLocal(g.hero);
    if (this.partySize > 1) party.fill(this.partySize, this.roomSpawn(1), CUBE.ilvl, this.rng.int(1, 999));
    party.bindMeter();
    this.offs.push(L.on('death', ev => this.onDeath(ev)));
    g.renderer.grade = { ...g.renderer.grade, saturation: 1.15, gain: [1.02, 0.9, 1.12] };
    g.audio?.music?.('dungeon'); g.audio?.ambience?.('void');
    this.nextRoom();
  }
  exit() { for (const f of this.offs) f(); this.offs = []; this.party?.dispose?.(); if (this.state !== 'over') this.save(); }
  roomSpawn(r = this.room) { const i = ((r - 1) % 3 + 3) % 3 + 1; const a = this.g.zone.anchors[`stage${i}:spawn`] || this.g.zone.anchors.spawn || { x: 0, z: 10 }; return { x: a.x, z: a.z - 1, facing: 0 }; }
  island(r = this.room) { return ((r - 1) % 3 + 3) % 3 + 1; }
  nextRoom() {
    const g = this.g, L = this.L;
    this.room++; this.roomT = 0; this.wavesLeft = 0; this.champion = null;
    clearFoes(L);
    const sp = this.roomSpawn();
    for (const m of this.party.members) {
      const u = m.kit.u;
      if (u.dead) { this.party.revive(u, sp); u.hp = Math.round(u.hpMax * 0.4); }
      else heal(L, u, u, u.hpMax * 0.25);
      u.pos.x = sp.x + (m.local ? 0 : (Math.random() - 0.5) * 3); u.pos.z = sp.z + (m.local ? 0 : 1 + Math.random());
      u.skill?.cancel?.('teleport'); u.skill = null; u.cc.down = 0; u.kb.t = 0;
      L.emit('teleport', { unit: u, x: u.pos.x, z: u.pos.z });
    }
    g.cam.snap(this.me.pos); g.player?.stop?.();
    const R = CUBE.rooms_def[this.room - 1];
    g.ui?.banner?.(`Room ${this.room}`, { kind: 'zone', sub: this.room === CUBE.rooms ? 'The Pit Lord' : `Rift Cube · ${CUBE.rooms - this.room + 1} rooms left`, dur: 2 });
    g.audio?.sfx?.('portal_enter', {});
    this.state = 'intro'; this.introT = 1.6;
    this.queue = R.waves.map(([t, n]) => [t, n]);
  }
  spawnRoom() {
    const R = CUBE.rooms_def[this.room - 1];
    this.state = 'fight';
    const i = this.island(), A = this.g.zone.anchors;
    this.points = Object.entries(A).filter(([k]) => k.startsWith(`s${i}:m`)).map(([, v]) => v);
    if (R.boss) { const bp = A['stage3:boss'] || this.roomSpawn(); this.champion = this.spawn(R.boss, { x: bp.x, z: bp.z - 2 }, { hpMul: 2.2, name: 'Gorehide, Lord of the Cube' }); this.champion.data.champion = true; this.g.ui?.banner?.(this.champion.name, { kind: 'boss', sub: 'Master of the Rift Cube', dur: 2.2 }); }
    else if (R.elite) { const ep = A[`s${i}:elite`] || this.pt(); this.champion = this.spawn(R.elite, ep, { elite: true, hpMul: 0.8, name: 'Cube Warden' }); this.champion.data.champion = true; }
    this.wave();
  }
  pt() { const p = this.points?.length ? this.rng.pick(this.points) : this.roomSpawn(); return { x: p.x + this.rng.range(-2, 2), z: p.z + this.rng.range(-2, 2) }; }
  spawn(type, p, o = {}) {
    const n = this.party.members.length, r = this.room;
    const u = mobFrom(type, { x: p.x, z: p.z, ref: this.ref, hpMul: (1.6 + r * 0.22) * partyHp(n) * (o.hpMul ?? 1), atkMul: 0.85 + r * 0.05, elite: o.elite, name: o.name });
    this.L.add(u);
    this.g.presenter?.call?.('portal', { pos: { x: u.pos.x, y: this.L.heightAt(u.pos.x, u.pos.z), z: u.pos.z }, color: 'arcane', dur: 1 });
    return u;
  }
  wave() {
    // spawn the next half of the room's roster
    let budget = 0; for (const [, n] of this.queue) budget += n;
    if (budget <= 0) return false;
    let take = Math.ceil(budget / 2), p = this.pt();
    for (const q of this.queue) { while (q[1] > 0 && take > 0) { const a = this.rng.next() * 6.28, d = this.rng.range(0.5, 3); const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; const s = this.L.nav.nearest(x, z, 4, 0.4) || { x, z }; this.spawn(q[0], s); q[1]--; take--; } if (take <= 0) break; p = this.pt(); }
    return true;
  }
  onDeath({ unit: u }) {
    if (u.kind === 'hero' || this.state !== 'fight') return;
    this.kills++;
  }
  onHeroDeath(u) {
    if (this.state === 'over') return;
    if (this.party.members.every(m => m.kit.u.dead)) return this.finish('wipe');
    // AI allies stand back up after 8 s at the room entrance; you revive from the death screen (or after 6 s)
    if (u !== this.me) this.L.after(8, () => { if (u.dead && this.state !== 'over') this.party.revive(u); });
  }
  roomCleared() {
    this.state = 'cleared'; this.cleared = this.room;
    this.g.ui?.banner?.(`Room ${this.room} cleared`, { kind: 'clear', sub: `${fmtTime(this.roomT)} · the chest grows`, dur: 1.8 });
    this.g.audio?.sfx?.('chest_open', {});
    if (this.room >= CUBE.rooms) setTimeout(() => this.finish('clear'), 1800);
    else this.L.after(2.4, () => { if (this.state === 'cleared') this.nextRoom(); });
  }
  update(dt) {
    const L = this.L, me = this.me; if (!L || !me || this.state === 'over') return;
    this.t += dt;
    if (this.state === 'intro') { this.introT -= dt; if (this.introT <= 0) this.spawnRoom(); return; }
    if (this.state !== 'fight') return;
    this.roomT += dt;
    const alive = L.units.filter(u => u.kind === 'mob' && !u.dead);
    const left = this.queue.reduce((a, q) => a + q[1], 0);
    if (alive.length <= 2 && left > 0) this.wave();
    if (!alive.length && left <= 0) return this.roomCleared();
    if (this.roomT > CUBE.roomTime + (this.room === CUBE.rooms ? 30 : 0)) { this.g.ui?.banner?.('The Cube collapses!', { kind: 'fail', sub: `Room ${this.room}` }); this.finish('time'); return; }
    if (me.dead && me.deadT > 6) this.party.revive(me);
  }
  save() {
    const A = this.s.account, st = cubeState(A);
    st.runs++; st.best = Math.max(st.best || 0, this.cleared); st.last = { rooms: this.cleared, time: Math.round(this.t), t: Date.now() };
    A.save();
  }
  finish(reason) {
    if (this.state === 'over') return;
    this.state = 'over';
    const A = this.s.account, ch = this.s.char, n = this.cleared;
    this.save();
    const bundle = n > 0 ? CUBE.reward(n) : {};
    for (const k of Object.keys(bundle)) if (!bundle[k]) delete bundle[k];
    const rows = n > 0 ? (S.common.grantBundle(A, ch, bundle) || []) : [];
    const cur = { silver: bundle.silver || 0, gold: bundle.gold || 0, xp: 300 * n };
    if (cur.xp) A.addXp(ch, cur.xp);
    if (n > 0) track(this.s, 'clear', { content: 'cube', id: 'cube', rooms: n, time: this.t });
    this.s.bus.emit('clear', { content: { kind: 'cube' }, result: { cleared: n >= CUBE.rooms, rooms: n, time: this.t }, tracked: true });
    const meter = this.party.meterRows();
    setTimeout(() => showResults(this.s, {
      kind: n > 0 ? 'clear' : 'fail', over: 'Rift Cube', title: n >= CUBE.rooms ? 'The Cube Conquered' : `Room ${n} of ${CUBE.rooms}`,
      sub: reason === 'wipe' ? `Your party fell in room ${this.room}` : reason === 'time' ? `The cube collapsed in room ${this.room}` : 'All ten rooms cleared',
      rank: n >= 10 ? (this.t < 300 ? 'S' : 'A') : n >= 7 ? 'B' : n >= 4 ? 'C' : 'D', time: this.t,
      stats: [{ label: 'Rooms Cleared', value: `${n} / ${CUBE.rooms}` }, { label: 'Kills', value: String(this.kills) }, { label: 'Best', value: `${cubeState(A).best} rooms` }, { label: 'Tickets Left', value: String(A.count(CUBE.ticket)) }],
      loot: rows, currencies: cur, retry: A.count(CUBE.ticket) > 0, dps: dpsRows(meter),
    }, n > 0), reason === 'clear' ? 0 : 1600);
  }
  progressHud() { if (this.state === 'over') return null; const R = CUBE.rooms_def[this.room - 1]; const tot = R ? R.waves.reduce((a, w) => a + w[1], 0) + (R.elite || R.boss ? 1 : 0) : 1; const left = (this.queue || []).reduce((a, q) => a + q[1], 0) + this.L.units.filter(u => u.kind === 'mob' && !u.dead).length; return { label: `Rift Cube · Room ${this.room} / ${CUBE.rooms}`, pct: this.state === 'cleared' ? 100 : Math.max(0, (1 - left / tot) * 100) }; }
  timerHud() { return this.state === 'fight' ? { label: 'Cube stability', left: Math.max(0, CUBE.roomTime + (this.room === CUBE.rooms ? 30 : 0) - this.roomT), urgent: CUBE.roomTime - this.roomT < 12 } : null; }
  bossHud() { const b = this.champion; if (!b || b.dead) return null; return { name: b.name, title: this.room === CUBE.rooms ? 'Master of the Rift Cube' : 'Warden of this room', hp: b.hp, hpMax: b.hpMax, barHp: b.hpMax / 20, bars: 20, stagger: null, destruction: null, enrageLeft: null, counter: false }; }
  partyHud() { return this.party?.hud(); }
  questHud() { const st = cubeState(this.s.account); return { id: 'cube', title: `Rift Cube — Room ${this.room}`, kind: 'event', steps: [{ text: 'Clear the room', n: 0, need: 1, done: this.state === 'cleared' }, { text: `Chest: ${this.cleared} room${this.cleared === 1 ? '' : 's'} of rewards · best ${st.best}`, n: 0, need: 0, done: false }] }; }
}

async function launchCube(session, c) {
  const A = session.account; cubeState(A);
  const stay = () => { session.hub = session.game.mode; };
  if (!A.has(CUBE.ticket, 1)) { session.ui.toast('You need a Rift Cube Ticket. Three arrive every week; Inferno guardians and Chaos Gates drop more.', 'error'); return stay(); }
  let party = c.party;
  if (party == null && !AUTO) {
    const pick = await session.ui.dialog({ name: 'Rift Warden Oriel', title: 'Rift Cube' }, [{ text: `Ten rooms, forty-five seconds each. The chest grows with every room you clear. You hold ${A.count(CUBE.ticket)} ticket${A.count(CUBE.ticket) === 1 ? '' : 's'}. Best: ${cubeState(A).best} rooms.`, choices: [{ id: 'solo', text: 'Enter alone (1 ticket).', kind: 'quest' }, { id: 'party', text: 'Enter with an AI party of 4 (1 ticket).', kind: 'quest' }, { id: 'bye', text: 'Not now.', kind: 'leave' }] }]);
    if (pick !== 'solo' && pick !== 'party') return stay();
    party = pick === 'party' ? 4 : 1;
  }
  A.take(CUBE.ticket, 1);
  session.lastContent = { kind: 'cube', party: party || 1 };
  await loadInstance(session, 'chaos_rift', { kind: 'dungeon', region: 'Rift Cube', name: 'The Rift Cube' });
  const g = session.game, sp = g.zone.anchors['stage1:spawn'] || g.zone.anchors.spawn || { x: 0, z: 10 };
  const nc = normalChar(session.heroChar(session.char), { ilvl: CUBE.ilvl, skillLv: 10 });
  spawnLocal(session, sp, { char: nc, stats: heroStats(nc, { rosterLevel: A.roster.level }) });
  g.mode = new CubeMode(session, { ...c, party: party || 1 });
  g.mode.enter();
  session.inWorld();
}
registerContent('cube', launchCube);
