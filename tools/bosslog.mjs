// Long boss fight log: node tools/bosslog.mjs <raid:gate|guardian:id> [seconds] [timeScale]
import puppeteer from 'puppeteer-core';
const [what = 'raid:gorrath:1', secs = 180, ts = 2] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], defaultViewport: { width: 1280, height: 720 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async (what, ts) => {
  await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Logger', path: what.includes('trial') ? 'powerpass' : 'raid' }); await new Promise(r => setTimeout(r, 2500));
  const [k, a, gt] = what.split(':');
  await __session.launch(k === 'raid' ? { kind: 'raid', raid: a, gate: +gt, trial: what.includes('trial') } : { kind: 'guardian', boss: a });
  const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard');
  g.timeScale = ts;
}, what, +ts);
const t0 = Date.now();
while ((Date.now() - t0) / 1000 < +secs) {
  await new Promise(r => setTimeout(r, 10000));
  const s = await p.evaluate(() => {
    const g = __game, m = g.mode, L = g.level; if (!m?.bosses) return { state: m?.state };
    const bs = m.bosses.map(b => ({ n: b.name, hp: +(b.hp / b.hpMax * 100).toFixed(2), busy: b.ctrl.busy, phase: b.ctrl.phase, grog: !!b.data.groggy, untarg: !!b.untargetable, inv: +(b.invuln || 0).toFixed(1), floor: b.data.hpFloor ? +(b.data.hpFloor / b.hpMax * 100).toFixed(1) : 0, pos: [+b.pos.x.toFixed(1), +b.pos.z.toFixed(1)], mech: [...b.ctrl.mechDone] }));
    const party = m.party.members.map(x => x.kit.u).map(u => (u.dead ? 'x' : Math.round(u.hp / u.hpMax * 100)));
    return { t: Math.round(L.time), state: m.state, bs, party, adds: L.units.filter(u => u.team === 1 && !u.dead && u.kind !== 'boss').length };
  });
  console.log(JSON.stringify(s));
  if (s.state === 'won' || s.state === 'lost') break;
}
console.log('errors', errs.slice(0, 5));
await b.close();
