// Open-world companions and songs: mount up (T), a pet that follows you (and picks up loot), and Songs (B) played on
// your instrument — Hymn of Homeward returns you to Solhaven, the rapport songs charm the nearest NPC.
import { registerPlugin } from './registry.js';
import { PROVIDERS } from './visuals.js';
import { LAUNCHERS } from './registry.js';
import { applyStatus, removeStatus } from './combat.js';

const SONGS = {
  homeward: { name: 'Hymn of Homeward', desc: 'Return to Solhaven.', cd: 60 },
  tides: { name: 'Serenade of Tides', desc: 'Call the Dawnrunner to the nearest shore.', cd: 30 },
  rest: { name: 'Lullaby of Rest', desc: 'A gentle song. NPCs find it soothing (rapport).', cd: 5 },
  valor: { name: 'Ballad of Valor', desc: 'A rousing ballad (rapport).', cd: 5 },
  sunrise: { name: 'Song of Sunrise', desc: 'Greets the dawn (rapport).', cd: 5 },
};
const OPEN_WORLD = new Set(['city', 'field', 'island', 'stronghold']);

class Companions {
  constructor() { this.id = 'companions'; this.mount = null; this.pet = null; this.songT = {}; }
  init(s) { this.s = s; }
  get g() { return this.s.game; }
  openWorld() { const k = this.g.mode?.kind; return OPEN_WORLD.has(k) || k === undefined && this.s.screen === 'game'; }
  update(dt) {
    const s = this.s, g = this.g, me = g.hero?.u;
    if (!me || s.screen !== 'game') { this.dismount(); this.dropPet(); return; }
    if (g.input.hit('mount') && !s.ui.wantsKeyboard) this.toggleMount();
    if (g.input.hit('songs') && !s.ui.wantsKeyboard) this.songMenu();
    // mount follows the hero; any skill or hit throws you off
    if (this.mount) {
      if (me.skill || me.dead || me.combatT > 7.5 || !this.openWorld() || me.level !== this.mountLevel) this.dismount();
      else {
        const m = this.mount; m.root.position.set(me.pos.x, me.pos.y - (me.lift || 0), me.pos.z); m.root.rotation.y = me.facing;
        m.update?.(dt, { speed: me.anim.speed, turn: me.anim.turn || 0 });
      }
    }
    // pet trots after you
    const want = this.openWorld() && !!(s.char?.pet || s.account.roster.pets?.length);
    if (want && !this.pet) this.spawnPet();
    if (!want && this.pet) this.dropPet();
    if (this.pet) {
      const p = this.pet, tx = me.pos.x - me.fx * 1.6 + 1.1, tz = me.pos.z - me.fz * 1.6;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      const sp = d > 12 ? 60 : Math.min(9, d * 3);
      if (d > 0.3) { p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; p.f = Math.atan2(-dx, -dz); }
      p.m.root.position.set(p.x, g.level.heightAt(p.x, p.z), p.z); p.m.root.rotation.y = p.f;
      p.m.update?.(dt, { speed: d > 0.3 ? sp : 0 });
    }
  }
  toggleMount() {
    const s = this.s, g = this.g, me = g.hero.u;
    if (this.mount) return this.dismount();
    if (!this.openWorld()) { s.ui.toast('Mounts can’t be summoned here.', 'warn'); return; }
    if (me.combatT > 0) { s.ui.toast('You can’t mount while in combat.', 'warn'); return; }
    const type = s.char?.mount || 'horse';
    const m = PROVIDERS.creature?.(type, { variant: s.char?.mountVariant || 'brown' });
    if (!m) { s.ui.toast('No mount available.', 'warn'); return; }
    g.scene.add(m.root);
    this.mount = m; this.mountLevel = me.level;
    const saddle = m.sockets?.rider ? m.sockets.rider.position.y : 1.1;
    me.lift = saddle; me.data.mounted = true;
    applyStatus(g.level, me, 'mounted', { dur: 1e6, mods: { moveSpd: 0.7 }, name: 'Mounted', icon: 'ui:mounts' });
    g.audio?.sfx?.('mount_summon', { pos: me.pos });
    g.fx?.play?.('portal_flash', { pos: me.pos, x: me.pos.x, z: me.pos.z, color: 'gold' });
  }
  dismount() {
    if (!this.mount) return;
    const me = this.g.hero?.u;
    this.g.scene.remove(this.mount.root); this.mount.dispose?.(); this.mount = null;
    if (me) { me.lift = 0; me.data.mounted = false; if (me.level) removeStatus(me.level, me, 'mounted'); }
  }
  spawnPet() {
    const s = this.s, me = this.g.hero.u;
    const type = s.char?.pet || s.account.roster.pets?.[0] || 'foxling';
    const m = PROVIDERS.creature?.(type, {}); if (!m) return;
    this.g.scene.add(m.root);
    this.pet = { m, x: me.pos.x + 1, z: me.pos.z + 1, f: 0 };
  }
  dropPet() { if (!this.pet) return; this.g.scene.remove(this.pet.m.root); this.pet.m.dispose?.(); this.pet = null; }
  get songs() { return SONGS; }
  async songMenu() {
    const s = this.s, learned = s.account.roster.songs || ['homeward'];
    // the radial song wheel (UI); the dialog below is the fallback
    if (s.windowData && s.ui.open) { const d = s.windowData('songs'); if (d) { s.ui.open('songs', d); if (s.ui.isOpen?.('songs')) return; } }
    const choices = learned.filter(id => SONGS[id]).map(id => ({ id, text: `${SONGS[id].name} — ${SONGS[id].desc}`, kind: 'talk' }));
    choices.push({ id: 'bye', text: 'Put the instrument away.', kind: 'leave' });
    const pick = await s.ui.dialog({ name: 'Songs', title: 'Your instrument' }, [{ text: 'Which song will you play?', choices }]);
    if (pick && SONGS[pick]) this.play(pick);
  }
  play(id) {
    const s = this.s, g = this.g, me = g.hero.u, now = g.level.time;
    if ((this.songT[id] || 0) > now) { s.ui.toast(`${SONGS[id].name} is recovering (${Math.ceil(this.songT[id] - now)} s).`, 'warn'); return; }
    this.dismount();
    const secs = g.audio?.song?.(id, { pos: me.pos }) || 7;
    me.model?.play?.('play_instrument', { loop: true, dur: 2 });
    g.fx?.play?.('song_notes', { pos: me.pos, x: me.pos.x, z: me.pos.z, dur: secs, unit: me.model?.root });
    this.songT[id] = now + SONGS[id].cd;
    const npc = g.level.units.filter(u => u.kind === 'npc' && u.distTo(me) < 8).sort((a, b) => a.distTo(me) - b.distTo(me))[0];
    s.bus.emit('song', { id, npc: npc?.data.npcDef?.id || null });
    const start = { x: me.pos.x, z: me.pos.z };
    setTimeout(() => {
      me.model?.stop?.();
      if (Math.hypot(me.pos.x - start.x, me.pos.z - start.z) > 1 || me.dead) { s.ui.toast('The song was interrupted.', 'warn'); return; }
      // on an island, songs are for its people and statues (the pier is the way off); elsewhere they carry you
      const onIsland = g.mode?.kind === 'island';
      if (id === 'homeward' && !onIsland) { if (g.mode?.kind !== 'city' || g.zone?.id !== 'solhaven') s.returnToHub(); else s.ui.toast('You are already in Solhaven.', 'info'); }
      if (id === 'tides' && !onIsland) { if (LAUNCHERS.sail) s.launch({ kind: 'sail' }); else s.ui.toast('The Dawnrunner waits for you at the harbour.', 'info'); }
      if (npc && ['rest', 'valor', 'sunrise'].includes(id)) s.ui.toast(`${npc.name} enjoyed your ${SONGS[id].name}.`, 'success');
    }, Math.min(secs, 8) * 1000);
  }
}
registerPlugin(new Companions());
export { SONGS };
