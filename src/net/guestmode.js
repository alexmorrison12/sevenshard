// What a guest's game runs while in a friend's world: the HUD comes from the host (boss bars, progress, timers,
// party frames); our own hero revives here; results arrive from the host.
export class GuestMode {
  constructor(game, place, net) { this.game = game; this.place = place; this.net = net; this.state = 'play'; }
  enter() { this.game.audio?.music?.(this.place.music || (this.place.kind === 'encounter' ? 'boss' : this.place.kind === 'chaos' ? 'dungeon' : 'city')); }
  exit() {}
  update(dt) {
    const me = this.game.hero?.u; if (!me) return;
    if (me.dead && me.deadT > 6) {
      const sp = this.game.zone?.anchors?.spawn || { x: 0, z: 0 };
      me.dead = false; me.hp = Math.round(me.hpMax * 0.6); me.pos.x = sp.x; me.pos.z = sp.z; me.invuln = 2; me.deadT = 0;
      me.model?.play?.('revive', { dur: 0.8 });
      this.game.level.emit('revive', { unit: me });
    }
  }
  bossHud() { return this.net.hud?.boss || null; }
  progressHud() { return this.net.hud?.progress || null; }
  timerHud() { return this.net.hud?.timer || null; }
  partyHud() {
    const p = this.net.hud?.party; if (!p) return null;
    const me = this.game.hero?.u;
    return p.map(x => x.name === me?.name && x.cls === me?.cls ? { ...x, you: true, hp: me.hp, hpMax: me.hpMax, shield: me.shield, dead: me.dead } : { ...x, you: false });
  }
}
