// Boss encounter mode (Guardian Hunts, raid gates, abyss bosses, field bosses): party + boss in an arena, intro
// cinematic, enrage timer, wipe/victory, live meter, results. Other modes compose it.
import { makeBoss } from '../ai/boss.js';
import { refFor } from '../ai/mob.js';
import { Party } from '../party.js';
import { BOSS_DEFS } from '../../data/bosses/index.js';

export class EncounterMode {
  /**
   * o: { boss: id | def, ilvl, partySize, zone (built zone), spawnAnchor, bossAnchor, hard, onEnd(result), seed, intro }
   */
  constructor(game, o) {
    this.kind = 'encounter';
    this.game = game; this.o = o; this.state = 'intro'; this.t = 0; this.result = null;
    this.def = typeof o.boss === 'string' ? BOSS_DEFS[o.boss] : o.boss;
  }
  enter() {
    const g = this.game, L = g.level, o = this.o, z = g.zone;
    const sp = z.anchors?.[o.spawnAnchor || 'spawn'] || { x: 0, z: 10, facing: 0 };
    const bp = z.anchors?.[o.bossAnchor || 'boss'] || { x: 0, z: -10, facing: Math.PI };
    this.party = g.party = g.party?.level === L ? g.party : new Party(g);
    if (!this.party.members.some(m => m.local) && g.hero) this.party.addLocal(g.hero);
    this.party.fill((o.partySize || 4) - (g.net?.count || 0), sp, o.ilvl || 1415, o.seed || 7);
    this.party.bindMeter();
    const ref = refFor(o.ilvl || 1415);
    // one boss, or several (o.bosses: [{ boss: id|def, anchor }]) that must all fall — e.g. the twin hounds
    const list = o.bosses || [{ boss: this.def, anchor: o.bossAnchor || 'boss' }];
    this.bosses = list.map((b, i) => {
      const def = typeof b.boss === 'string' ? BOSS_DEFS[b.boss] : b.boss;
      const at = z.anchors?.[b.anchor] || { x: bp.x + (i - (list.length - 1) / 2) * 8, z: bp.z, facing: bp.facing ?? Math.PI };
      const u = makeBoss(def, { ref, partySize: o.partySize || 4, x: at.x, z: at.z, facing: at.facing ?? Math.PI, mods: { hard: !!o.hard, ...(o.mods || {}) }, hpScale: b.hpScale });
      u.data.encounter = this;
      L.add(u);
      return u;
    });
    this.boss = this.bosses[0];
    this.def = this.boss.data.def;
    // every distinct boss def gets onStart; onBossDeath hooks hear every boss death (twin logic lives in one def)
    this.defs = [...new Set(this.bosses.map(b => b.data.def))];
    for (const d of this.defs) d.onStart?.(this);
    this.offs = [
      L.on('bossBanner', ({ text, kind }) => g.ui?.banner?.(text, { kind })),
      L.on('bossEnrage', ({ unit }) => g.ui?.banner?.(`${unit?.name || this.def.name} is enraged!`, { kind: 'warn' })),
      L.on('death', ({ unit }) => { if (this.bosses.includes(unit)) { for (const d of this.defs) d.onBossDeath?.(this, unit); if (this.bosses.every(b => b.dead)) this.victory(); } }),
    ];
    this.party.noRevive = !!o.noRevive;
    // intro: camera flies to the boss, title card, roar
    this.introT = o.intro === false ? 0 : 3.2;
    if (this.introT > 0) {
      const b = this.boss.pos;
      g.cam.cinematic({ pos: [b.x + 6, b.y + this.def.height * 0.9, b.z + 11], look: [b.x, b.y + this.def.height * 0.55, b.z], dur: 0.9, fov: 30 });
      g.renderer.fx.letterbox = 1;
      g.inputBlocked = true;
      setTimeout(() => this.bosses.forEach(b => b.model?.play?.('intro', { dur: 2.4 })), 200);
      g.ui?.bossIntro?.({ name: this.def.name, title: this.def.title }) || g.ui?.banner?.(`${this.def.name}`, { kind: 'boss', sub: this.def.title, dur: 2.8 });
      g.audio?.stinger?.('boss_intro');
    }
    g.audio?.music?.(this.def.music || 'boss');
    // big bosses need room: Lost Ark pulls the camera out for raids and guardians
    this.camWas = { zoom: g.cam.zoom, max: g.cam.maxDist };
    const far = (o.partySize || 4) >= 8 ? 25 : 23;
    g.cam.maxDist = Math.max(g.cam.maxDist, far + 4); g.cam.zoom = Math.max(g.cam.zoom, far);
  }
  exit() { for (const f of this.offs || []) f(); this.party?.dispose(); this.game.renderer.fx.letterbox = 0; this.game.inputBlocked = false; if (this.camWas) { this.game.cam.zoom = this.camWas.zoom; this.game.cam.maxDist = this.camWas.max; } }
  update(dt) {
    const g = this.game;
    this.t += dt;
    if (this.state === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0) {
        this.state = 'fight'; for (const b of this.bosses) b.ctrl.started = true; this.fightStart = g.level.time;
        g.cam.endCinematic(0.8); g.renderer.fx.letterbox = 0; g.inputBlocked = false;
      }
      return;
    }
    if (this.state !== 'fight') return;
    // a wipe only ends the run where nobody can revive (legion raids); elsewhere the fallen return from the entrance
    if (this.o.noRevive && this.party.members.every(m => m.kit.u.dead)) this.wipe();
    if (g.level.time - this.fightStart > (this.o.timeLimit || 1200)) this.wipe();
    // the local hero revives at the entrance after 6 s (Lost Ark: revive at the gate entrance)
    const me = g.hero?.u;
    if (me?.dead && me.deadT > 6 && !this.o.noRevive) this.party.revive(me);
  }
  victory() {
    if (this.state !== 'fight') return;
    this.state = 'won';
    const L = this.game.level, time = L.time - this.fightStart;
    this.result = { cleared: true, boss: this.def.id, name: this.def.name, time, meter: this.party.meterRows(), deaths: [...this.party.meter.values()].reduce((a, r) => a + r.deaths, 0) };
    this.game.ui?.banner?.(`${this.def.name} defeated`, { kind: 'victory', sub: fmtTime(time) });
    this.game.audio?.stinger?.('raid_clear');
    setTimeout(() => this.o.onEnd?.(this.result), 3500);
  }
  wipe() {
    if (this.state !== 'fight') return;
    this.state = 'lost';
    this.result = { cleared: false, boss: this.def.id, name: this.def.name, time: this.game.level.time - this.fightStart, hpLeft: this.boss.hp / this.boss.hpMax, meter: this.party.meterRows() };
    this.game.ui?.banner?.('Party wiped', { kind: 'fail' });
    this.game.audio?.stinger?.('wipe');
    setTimeout(() => this.o.onEnd?.(this.result), 3000);
  }
  bossHud() {
    const b = (this.bosses || []).find(x => !x.dead) || this.boss; if (!b) return null;
    return { name: b.name, title: b.data.def.title, hp: b.hp, hpMax: b.hpMax, barHp: b.data.barHp, bars: b.data.bars,
      stagger: b.data.stagger ? { v: b.data.stagger.v, max: b.data.stagger.max, left: b.data.stagger.left } : null,
      destruction: b.data.destruction && !b.data.destruction.broken ? { v: b.data.destruction.v, max: b.data.destruction.max } : null,
      enrageLeft: this.def.enrage ? Math.max(0, this.def.enrage - (b.ctrl.fightT || 0)) : null, counter: (b.data.counterWindow || 0) > 0,
      groggy: !!b.data.groggy, enraged: !!b.data.enraged, buffs: b.statuses.map(s => ({ id: s.id, icon: s.icon, name: s.name, left: s.left, debuff: !!s.def.debuff })),
      others: (this.bosses || []).filter(x => x !== b).map(x => ({ name: x.name, hp: x.hp, hpMax: x.hpMax, dead: x.dead })) };
  }
  partyHud() { return this.party?.hud(); }
  timerHud() {
    const b = (this.bosses || []).find(x => !x.dead) || this.boss, en = b?.data.def.enrage;
    return en && this.state === 'fight' ? { label: 'Enrage', left: Math.max(0, en - (b.ctrl.fightT || 0)) } : null;
  }
}
export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`;
