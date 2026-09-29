// Class DPS balance: each class (AI tryhard rotation, real cooldowns) vs a passive guardian for N game-seconds.
// node tools/balance.mjs [secs=90] [cls,...]
import puppeteer from 'puppeteer-core';
const secs = +(process.argv[2] || 90);
const list = (process.argv[3] || 'reaver,oathkeeper,stormfist,pistoleer,starcaller,songweaver,bladedancer,demonbound').split(',');
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=960,540', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 960, height: 540 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
const rows = [];
for (const cls of list) {
  const r = await p.evaluate(async (cls, secs) => {
    const S = __session;
    if (S.screen !== 'title') { await S.gameMenu('title'); await new Promise(r => setTimeout(r, 1500)); }
    // roster holds 6: start each class from a clean save
    localStorage.clear(); S.account.data.chars = []; S.account.data.lastChar = null;
    await S.route('title:enter');
    if (S.screen === 'charselect') await S.route('select:create');
    await S.route('create:confirm', { cls, sex: 'm', look: {}, name: 'Bal' + cls.slice(0, 6) + Math.floor(Math.random() * 999), path: 'raid' });
    await new Promise(r => setTimeout(r, 1500));
    await S.launch({ kind: 'guardian', boss: 'rimewing' });
    const g = __game, L = g.level, m = g.mode;
    // solo: remove AI allies, pacify the boss
    for (const mm of m.party.members.slice()) if (!mm.local) { mm.kit.u.dead = true; L.remove?.(mm.kit.u); }
    m.party.members = m.party.members.filter(x => x.local);
    const boss = m.boss; boss.ctrl.update = () => {}; boss.hp = boss.hpMax = 1e13;
    g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9;
    while (m.state !== 'fight') await new Promise(r => setTimeout(r, 200));
    g.timeScale = 3;
    let dmg = 0; const t0 = L.time; const by = {};
    const off = L.on('damage', ev => { if (ev.src === g.hero.u && ev.tgt === boss) { dmg += ev.amount; by[ev.skill] = (by[ev.skill] || 0) + ev.amount; } });
    while (L.time - t0 < secs) await new Promise(r => setTimeout(r, 250));
    off(); g.timeScale = 1;
    const t = L.time - t0;
    return { cls, dps: Math.round(dmg / t), top: Object.entries(by).sort((a, c) => c[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${Math.round(v / dmg * 100)}%`) };
  }, cls, secs);
  rows.push(r); console.log(`${r.cls.padEnd(12)} ${String(r.dps).padStart(10)} dps   ${r.top.join(', ')}`);
}
const dpsRows = rows.filter(r => !['oathkeeper', 'songweaver'].includes(r.cls));
const avg = dpsRows.reduce((a, r) => a + r.dps, 0) / dpsRows.length;
console.log('\nDPS-class average', Math.round(avg), '·', dpsRows.map(r => `${r.cls} ${Math.round(r.dps / avg * 100)}%`).join(' '));
console.log('errors', errs.slice(0, 5));
await b.close();
