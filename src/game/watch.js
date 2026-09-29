// "Watch the Raid": spectate an all-AI legion raid gate from the title screen. Eight AI raiders fight the boss while a
// director camera cuts between the boss, the raiders and the mechanics. Leave with Esc or the badge button.
import { makeSim } from './social/names.js';
import { simChar } from './party.js';
import { heroStats } from './systems/stats.js';
import { AllyAI } from './ai/ally.js';
import { EncounterMode } from './modes/encounter.js';
import { RAIDS } from '../data/raids.js';
import { BOSS_DEFS } from '../data/bosses/index.js';

const CSS = `.ss-watch{position:fixed;left:50%;top:calc(max(8px,env(safe-area-inset-top,0px)) + 96px);transform:translateX(-50%);z-index:31;display:flex;align-items:center;gap:12px;padding:7px 8px 7px 14px;border-radius:4px;background:rgba(9,12,22,.9);border:1px solid #3a4560;box-shadow:0 4px 16px rgba(0,0,0,.5);font:600 12.5px "Segoe UI",Roboto,sans-serif;color:#e7e3d8;white-space:nowrap}
.ss-watch b{color:#ff5a4a;letter-spacing:.14em;text-transform:uppercase;font-size:11px}.ss-watch b::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff4a3a;box-shadow:0 0 8px #ff4a3a;margin-right:6px;vertical-align:1px;animation:ssrec 1.2s infinite}
@keyframes ssrec{50%{opacity:.35}}.ss-watch button{font:600 11.5px "Segoe UI",Roboto,sans-serif;padding:5px 10px;border-radius:3px;border:1px solid #3a4560;background:#141b2e;color:#e7e3d8;cursor:pointer}`;

export async function watchRaid(session, { raid = 'gorrath', gate = 1 } = {}) {
  const s = session, g = s.game;
  const R = RAIDS[raid], gt = R?.gates[gate];
  if (!gt || !gt.bosses.every(b => BOSS_DEFS[b.boss])) { s.ui.toast('That fight isn’t ready to watch yet.', 'warn'); return; }
  s.stage.leave();
  const zone = await s.loadZone(gt.zone, { kind: 'raid', region: `${R.name} · Gate ${gate + 1}` });
  // the "local hero" is just another AI raider, so the HUD shows a real kit in action
  const dps = ['reaver', 'stormfist', 'pistoleer', 'starcaller', 'bladedancer', 'demonbound'];
  const sim = makeSim(Math.floor(Math.random() * 1e6), { cls: dps[Math.floor(Math.random() * dps.length)], persona: 'tryhard' });
  const char = simChar(sim, R.ilvl.normal + 20);
  const kit = g.spawnHero({ ...char, gear: { tier: 2 } }, heroStats(char), zone.anchors.spawn);
  kit.u.data.look = sim.look; kit.u.data.gear = { tier: 2 }; kit.u.data.sex = sim.sex;
  g.player.input = () => {};
  kit.u.ctrl = new AllyAI(kit, 'tryhard');
  s.watching = true; s.char = null;
  g.mode = new EncounterMode(g, { boss: gt.bosses[0].boss, bosses: gt.bosses, ilvl: R.ilvl.normal, partySize: R.players, seed: Date.now() % 997,
    onEnd: r => { s.ui.banner(r.cleared ? 'The raid is victorious' : 'The raid has fallen', { kind: r.cleared ? 'victory' : 'fail', sub: 'Your turn next?' }); setTimeout(() => stop(), 5000); } });
  g.mode.enter();
  s.screen = 'game'; s.ui.screen('game');
  g.onHud = () => { const h = s.hud(); if (h) { h.quests = []; } s.ui.hud.update(h); };
  // badge
  if (!document.getElementById('ss-watch-css')) { const st = document.createElement('style'); st.id = 'ss-watch-css'; st.textContent = CSS; document.head.appendChild(st); }
  const badge = document.createElement('div'); badge.className = 'ss-watch';
  badge.innerHTML = `<b>Live</b><span>${BOSS_DEFS[gt.bosses[0].boss].name} · 8 AI raiders</span><button type="button">Leave</button>`;
  document.body.appendChild(badge);
  // director camera: boss wides, raider close-ups, snap to the boss when a mechanic is called
  let shotT = 0, focus = null, wide = true;
  const L = g.level;
  const offBanner = L.on('bossBanner', () => { shotT = 5; wide = true; focus = null; });
  const director = dt => {
    if (!s.watching) return;
    shotT -= dt;
    const boss = g.mode?.bosses?.find(b => !b.dead) || g.mode?.boss;
    const raiders = L.units.filter(u => u.kind === 'hero' && !u.dead);
    if (shotT <= 0) {
      shotT = 5 + Math.random() * 3;
      wide = !wide || !raiders.length;
      focus = wide ? null : raiders[Math.floor(Math.random() * raiders.length)];
      g.cam.maxDist = 30; g.cam.zoom = wide ? 29 : 19;
    }
    const t = focus && !focus.dead ? focus.pos : boss ? { x: boss.pos.x, y: boss.pos.y, z: boss.pos.z + 4.5 } : null;
    g.camFocus = t;
  };
  g.hooks.frame.push(director);
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stop(); } };
  addEventListener('keydown', key, true);
  let stopped = false;
  function stop() {
    if (stopped) return; stopped = true;
    s.watching = false; offBanner();
    removeEventListener('keydown', key, true);
    g.hooks.frame = g.hooks.frame.filter(f => f !== director);
    badge.remove(); g.camFocus = null; g.cam.maxDist = 27;
    s.leaveWorld(); s.backdrop().then(() => s.title());
  }
  badge.querySelector('button').addEventListener('click', stop);
  return { stop };
}
