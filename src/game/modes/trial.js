// Trial Guardian — this week's guardian (seeded by weekId) with two affixes (Volcanic floors, Frenzied, Mirror Guard,
// Storm-Warded, Haunted, Glass Guardian, Bulwark) and a weekly first-clear reward. A 4-player Guardian Hunt at
// iLvl 1415 (weaker heroes are synced up), launched from the Rift Nexus: session.launch({ kind: 'trial' }).
// Shares helpers with inferno.js (only used inside functions — the two modules import each other).
import { registerContent } from '../registry.js';
import { EncounterMode } from './encounter.js';
import { applyStatus, dealDamage, addShield } from '../combat.js';
import { itemLevel } from '../systems/stats.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';
import { TRIAL, AFFIXES } from '../../data/inferno.js';
import { weekId } from '../../core/util.js';
import { trialOfWeek, S, spawnLocal, normalChar, showResults, dpsRows, emitClear, eruption, mobFrom, fmtTime, loadInstance } from './inferno.js';

/** weekly trial state on the character: { week, cleared, best, tries } */
export function trialState(char, now = Date.now()) {
  const w = weekId(now); char.weekly ||= {};
  let s = char.weekly.trial; if (!s || s.week !== w) s = char.weekly.trial = { week: w, cleared: false, best: null, tries: 0 };
  return s;
}

class TrialMode extends EncounterMode {
  constructor(game, o) {
    super(game, o);
    this.kind = 'trial'; this.affixes = o.affixes || []; this.timers = []; this.affixOff = [];
  }
  enter() {
    super.enter();
    const L = this.game.level;
    for (const b of this.bosses) { b.hpMax = b.st.hpMax = Math.round(b.hpMax * TRIAL.hpMul); b.hp = b.hpMax; b.data.barHp = b.hpMax / (b.data.bars || 100); }
    const has = id => this.affixes.includes(id);
    const every = (t, fn) => { const tm = L.every(t, () => { if (this.state === 'fight') fn(); }); this.timers.push(tm); };
    const heroes = () => this.party.members.map(m => m.kit.u).filter(u => !u.dead);
    if (has('glass')) for (const b of this.bosses) { b.data.dmgTakenFn = (() => { const prev = b.data.dmgTakenFn; return (s, o) => (prev ? prev(s, o) : 1) * 1.4; })(); b.st.atk *= 1.6; b._statDirty = true; }
    if (has('frenzied')) {
      for (const b of this.bosses) b.ctrl.flags.haste = (b.ctrl.flags.haste || 1) * 0.84;
      every(2, () => { for (const b of this.bosses) { if (b.dead) continue; const tier = Math.floor((1 - b.hp / b.hpMax) * 10); if (tier !== b.data.frenzyTier) { b.data.frenzyTier = tier; applyStatus(L, b, 'frenzy', { dur: 1e7, force: true, mods: { dmgMul: 0.025 * tier }, name: `Frenzy ${tier}`, icon: 'status:enrage' }); } } });
    }
    if (has('volcanic')) every(9, () => { const hs = heroes(); for (let i = 0; i < Math.min(3, hs.length); i++) { const h = hs[Math.floor(Math.random() * hs.length)]; eruption(L, { x: h.pos.x + (Math.random() - 0.5) * 2, z: h.pos.z + (Math.random() - 0.5) * 2, r: 3, delay: 1.4, pct: 0.08, pool: { dur: 7, pct: 0.02 } }); } });
    if (has('storm')) every(7, () => {
      const rows = this.party.meterRows(); const top = rows.map(r => this.party.members.find(m => m.kit.u.id === r.id)?.kit.u).find(u => u && !u.dead) || heroes()[0];
      if (top) eruption(L, { x: top.pos.x, z: top.pos.z, r: 3, delay: 1.2, pct: 0.1, fx: 'lightning_strike', color: 'lightning', sfx: 'thunder', knock: true });
    });
    if (has('bulwark')) every(35, () => { for (const b of this.bosses) if (!b.dead) { addShield(L, null, b, b.hpMax * 0.08, 14, 'bulwark'); L.emit('fx', { unit: b, preset: 'shield_bubble', x: b.pos.x, z: b.pos.z, ev: { color: 'gold', r: b.radius * 1.4 } }); } this.game.ui?.banner?.('The guardian raises a bulwark!', { kind: 'warn' }); });
    if (has('mirror')) {
      every(22, () => {
        const b = this.bosses.find(x => !x.dead); if (!b || b.data.groggy || b.data.mirror) return;
        b.data.mirrorPending = true;
        b.ctrl.counterWindow(1.4, 3.5);
        this.game.ui?.banner?.('Mirror Guard — counter it!', { kind: 'warn' });
        L.after(1.5, () => { if (!b.data.mirrorPending || b.dead) return; b.data.mirrorPending = false; b.data.mirror = L.time + 4; applyStatus(L, b, 'mirror', { dur: 4, force: true, name: 'Mirror Guard', icon: 'status:def_up' }); this.game.ui?.banner?.('The guardian reflects damage!', { kind: 'fail' }); });
      });
      this.affixOff.push(L.on('bossCountered', ({ unit }) => { if (unit.data.mirrorPending) { unit.data.mirrorPending = false; this.game.ui?.toast?.('Mirror Guard shattered!', 'success'); } }));
      this.affixOff.push(L.on('damage', ev => { const b = ev.tgt; if (b?.kind !== 'boss' || !(b.data.mirror > L.time) || !ev.src || ev.src.kind !== 'hero' || ev.amount <= 0 || ev.dot || ev.skill === 'mirror') return; dealDamage(L, null, ev.src, 0, { fixed: Math.round(Math.min(ev.src.hpMax * 0.012, ev.amount * 0.02)), skill: 'mirror', kind: 'hazard' }); }));
    }
    if (has('haunted')) {
      const marks = [0.75, 0.5, 0.25]; this.haunt = new Set();
      every(0.5, () => { for (const b of this.bosses) for (const m of marks) if (!this.haunt.has(m) && !b.dead && b.hp / b.hpMax <= m) { this.haunt.add(m); for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28; const u = mobFrom('wraith', { x: b.pos.x + Math.cos(a) * 6, z: b.pos.z + Math.sin(a) * 6, ref: b.ctrl.o.ref, hpMul: 4 }); L.add(u); } this.game.ui?.banner?.('Cinder Wraiths rise from the ash!', { kind: 'warn' }); } });
    }
    const names = this.affixes.map(a => AFFIXES[a]?.name).filter(Boolean).join(' · ');
    setTimeout(() => this.game.ui?.toast?.(`Trial affixes: ${names}`, 'warn'), 3600);
    this.game.session?.ui?.chat?.add?.({ channel: 'system', text: `Trial Guardian — ${this.def.name}. ${this.affixes.map(a => `${AFFIXES[a].name}: ${AFFIXES[a].desc}`).join(' ')}` });
  }
  exit() { for (const tm of this.timers) this.game.level?.cancelTimer(tm); for (const f of this.affixOff) f(); super.exit(); }
  questHud() {
    const s = this.game.session, st = s?.char ? trialState(s.char) : null;
    return { id: 'trial', title: `Trial Guardian — ${this.def.name}`, kind: 'event', steps: [{ text: `Defeat ${this.def.name}`, n: this.state === 'won' ? 1 : 0, need: 1, done: this.state === 'won' }, ...this.affixes.map(a => ({ text: `${AFFIXES[a].name}: ${AFFIXES[a].desc}`, n: 0, need: 0, done: false })), { text: st?.cleared ? `Cleared this week${st.best ? ` · best ${fmtTime(st.best)}` : ''}` : 'Weekly first-clear reward available', n: 0, need: 0, done: !!st?.cleared }] };
  }
}

async function launchTrial(session, c) {
  const g = session.game, t = trialOfWeek();
  const def = BOSS_DEFS[c.boss || t.guardian] || BOSS_DEFS.rimewing;
  const affixes = c.affixes || t.affixes;
  await loadInstance(session, def.arena || 'frostmere', { kind: 'arena', region: 'Trial Guardian', name: `${def.name} — Trial` });
  const sp = g.zone.anchors.spawn || { x: 0, z: 10, facing: 0 };
  const synced = itemLevel(session.char) < TRIAL.ilvl;
  if (synced) spawnLocal(session, sp, { char: normalChar(session.heroChar(session.char), { ilvl: TRIAL.ilvl, skillLv: 10 }) });
  else spawnLocal(session, sp);
  const st = trialState(session.char); st.tries++;
  const t0 = Date.now();
  g.mode = new TrialMode(g, { boss: def, ilvl: TRIAL.ilvl, partySize: TRIAL.partySize, seed: Date.now() % 1000, affixes, onEnd: r => trialDone(session, { def, affixes, synced, t0 }, r) });
  g.mode.enter();
  session.inWorld();
  if (synced) setTimeout(() => session.ui.toast(`Item level synced to ${TRIAL.ilvl} for the Trial.`, 'info'), 2500);
}
registerContent('trial', launchTrial);

function trialDone(session, ctx, r) {
  const A = session.account, ch = session.char, st = trialState(ch);
  const loot = [], cur = { silver: 0, gold: 0, xp: 0 };
  let first = false;
  if (r.cleared) {
    first = !st.cleared;
    const bundle = first ? TRIAL.firstClear : TRIAL.repeat;
    const rows = S.common.grantBundle(A, ch, bundle) || [];
    loot.push(...rows);
    for (const k of ['silver', 'gold']) cur[k] = bundle[k] || 0;
    cur.xp = 2400; const ups = A.addXp(ch, cur.xp);
    if (ups?.length) setTimeout(() => session.ui.banner('Level Up', { kind: 'levelup', level: ups[ups.length - 1] }), 900);
    st.cleared = true; st.best = st.best == null ? r.time : Math.min(st.best, r.time);
    A.save();
  }
  emitClear(session, { kind: 'guardian', boss: ctx.def.id, trial: true, affixes: ctx.affixes }, r);
  const me = r.meter?.find(x => x.you);
  showResults(session, {
    kind: r.cleared ? 'clear' : 'fail', over: 'Trial Guardian', title: ctx.def.name,
    sub: (r.cleared ? (first ? 'Weekly first clear!' : 'Cleared') : 'Defeated') + ' · ' + ctx.affixes.map(a => AFFIXES[a].name).join(' & '),
    rank: !r.cleared ? null : r.time < 180 ? 'S' : r.time < 270 ? 'A' : r.time < 360 ? 'B' : 'C', time: r.time, best: st.best ?? undefined,
    stats: [{ label: 'Deaths', value: String(r.deaths ?? 0) }, { label: 'Your DPS', value: me ? Math.round(me.dps).toLocaleString('en-US') : '—' }, { label: 'Counters', value: String(me?.counters ?? 0) }, ...(ctx.synced ? [{ label: 'Item Level', value: `Synced ${TRIAL.ilvl}` }] : [])],
    loot, currencies: cur, retry: true, dps: dpsRows(r.meter),
  }, r.cleared);
}
