// Movement stress test: random click-to-move trips in a zone; reports trips where the hero stops short of the target.
// node tools/stuck.mjs [zones=solhaven,brighthold] [trips=150]
import puppeteer from 'puppeteer-core';
const zones = (process.argv[2] || 'solhaven,brighthold').split(',');
const trips = +(process.argv[3] || 150);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 960, height: 540 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Walker', path: 'powerpass' }); await new Promise(r => setTimeout(r, 2500)); });
for (const zone of zones) {
  const r = await p.evaluate(async (zone, trips) => {
    const S = __session, sleep = ms => new Promise(r => setTimeout(r, ms));
    if (__game.zone?.id !== zone) { const z = await S.loadZone(zone, { kind: window.__ZONES[zone]?.kind || 'field' }); S.spawnMe(z.anchors.spawn); S.game.mode = null; S.inWorld(); await sleep(800); }
    const g = __game, L = g.level, nav = L.nav, u = g.hero.u, pc = g.player;
    // keep the real input from touching the path; nothing else in the world moves the hero
    pc.input = () => {};
    for (const x of L.units.slice()) if (x !== u && (x.kind === 'mob' || x.kind === 'boss')) L.remove?.(x);
    u.invuln = 1e9;
    // walkable cells to sample from
    const cells = []; for (let k = 0; k < nav.w * nav.h; k++) if (nav.data[k]) cells.push(k);
    const rnd = () => nav.center(cells[Math.floor(Math.random() * cells.length)]);
    const out = []; let unreachable = 0; g.timeScale = 4;
    for (let t = 0; t < trips; t++) {
      let a = rnd(); let tries = 0; while (!nav.okR(a.x, a.z, u.radius * 0.6) && tries++ < 50) a = rnd();
      u.pos.x = a.x; u.pos.z = a.z; pc.stop();
      // a destination 5–18 m away that is reachable in a straight line or around a few props
      let dest = null;
      for (let k = 0; k < 40 && !dest; k++) { const ang = Math.random() * 6.283, d = 5 + Math.random() * 13, x = a.x + Math.cos(ang) * d, z = a.z + Math.sin(ang) * d; if (nav.okR(x, z, 0.3)) dest = { x, z }; }
      if (!dest) continue;
      pc.setDest(dest.x, dest.z, true);
      const goal = pc.dest; if (!goal) continue;
      const plan = nav.path(u.pos.x, u.pos.z, goal.x, goal.z, 0.34) || [], lastP = plan[plan.length - 1];
      const reachable = !!lastP && Math.hypot(lastP.x - goal.x, lastP.z - goal.z) < 0.6;
      let planLen = 0, px = u.pos.x, pz = u.pos.z; for (const q of plan) { planLen += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
      const limit = planLen / Math.max(1, u.st.speed) * 1.6 + 3;
      let last = { x: u.pos.x, z: u.pos.z }, still = 0, t0 = L.time, stuck = null;
      let ended = 'timeout';
      while (L.time - t0 < limit) {
        await sleep(40);
        const moved = Math.hypot(u.pos.x - last.x, u.pos.z - last.z); last = { x: u.pos.x, z: u.pos.z };
        if (!pc.path || !pc.path.length) { ended = 'path-ended'; break; }
        still = moved < 0.01 ? still + 1 : 0;
        if (still >= 12) { stuck = { at: [+u.pos.x.toFixed(2), +u.pos.z.toFixed(2)], goal: [+goal.x.toFixed(2), +goal.z.toFixed(2)], next: pc.path[0] && [+pc.path[0].x.toFixed(2), +pc.path[0].z.toFixed(2)], left: +Math.hypot(goal.x - u.pos.x, goal.z - u.pos.z).toFixed(2), blocked: u.blocked }; break; }
      }
      const endD = Math.hypot(goal.x - u.pos.x, goal.z - u.pos.z);
      if (stuck) out.push({ kind: 'stuck', ...stuck });
      else if (endD > 1.2 && reachable) out.push({ kind: 'short', at: [+u.pos.x.toFixed(2), +u.pos.z.toFixed(2)], goal: [+goal.x.toFixed(2), +goal.z.toFixed(2)], left: +endD.toFixed(2), replans: pc.replans, ended, planLen: +planLen.toFixed(1) });
      else if (endD > 1.2) unreachable++;
    }
    g.timeScale = 1;
    return { zone, trips, fails: out.length, unreachable, samples: out.slice(0, 12) };
  }, zone, trips);
  console.log(`${r.zone}: ${r.fails}/${r.trips} trips failed (${r.unreachable} targets were unreachable — walked as close as possible)`);
  for (const s of r.samples) console.log('  ', JSON.stringify(s));
}
console.log('errors', errs.slice(0, 5));
await b.close();
