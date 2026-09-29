// Regression sweep: every class fights in the dev arena with a scripted rotation (all slots, identity, awakening).
// usage: node tools/classes.mjs [--secs=10] [--cls=reaver,starcaller]
import puppeteer from 'puppeteer-core';
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d ?? ''}`).split('=').slice(1).join('=');
const secs = +arg('secs', 10);
const list = (arg('cls') || 'reaver,oathkeeper,stormfist,pistoleer,starcaller,songweaver,bladedancer,demonbound').split(',');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720'], defaultViewport: { width: 1280, height: 720 } });
for (const cls of list) {
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  await p.goto(`http://localhost:5299/index.html?dev=arena&cls=${cls}&mobs=20&q=low`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__game?.hero, { timeout: 60000 });
  const r = await p.evaluate(async secs => {
    const g = __game, L = g.level, kit = g.hero, u = kit.u; u.invuln = 1e9;
    const used = new Set(), dmg = {}; let total = 0;
    L.on('skillStart', ev => { if (ev.unit === u) used.add(ev.def.id); });
    L.on('damage', ev => { if (ev.src === u) { total += ev.amount; dmg[ev.skill] = (dmg[ev.skill] || 0) + ev.amount; } });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const t0 = performance.now(); let i = 0;
    while (performance.now() - t0 < secs * 1000) {
      const t = L.nearestEnemy(u, 40); if (t) { g.player.aim.x = t.pos.x; g.player.aim.z = t.pos.z; }
      const s = i++ % 8; u.cd.clear(); u.mp = u.mpMax;
      if (kit.press(s, g.player.aim)) { await sleep(350); kit.release(s); await sleep(250); } else { kit.basic(g.player.aim); await sleep(200); }
      if (i % 9 === 0) { kit.identity.state && (kit.identity.state.v = 999, kit.identity.state.orbs = 3); kit.identityKey('z', g.player.aim); await sleep(400); kit.identityKey('x', g.player.aim); await sleep(300); }
      if (i === 12) { kit.awakenCast(g.player.aim); await sleep(1500); }
    }
    const bar = kit.bar.filter(Boolean);
    return { used: [...used].length, bar: bar.length, missing: bar.filter(id => !used.has(id)), awaken: used.has(kit.awaken.id), total: Math.round(total / 1e6) + 'M', top: Object.entries(dmg).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([k]) => k) };
  }, secs);
  console.log(`${cls.padEnd(12)} ${JSON.stringify(r)} errors=${errs.length}${errs.length ? ' ' + errs.slice(0, 2).join(' | ') : ''}`);
  await p.close();
}
await b.close();
