// QA probe: do damage events and spawned numbers match 1:1? node tools/numtest.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
const r = await p.evaluate(async () => {
  await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Numb', path: 'powerpass' });
  await new Promise(r => setTimeout(r, 2000));
  await __session.launch({ kind: 'chaos', tier: 1 });
  const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9;
  const fx = g.fx; const n0 = fx.stats().numbersSpawned; let ev = 0, shown = 0;
  const pr = g.presenter; const orig = pr.call.bind(pr); let calls = 0;
  pr.call = (name, ...a) => { if (name === 'number') calls++; return orig(name, ...a); };
  const origSpawn = fx.numbers.spawn.bind(fx.numbers); let spawns = 0; fx.numbers.spawn = (...a) => { spawns++; return origSpawn(...a); };
  g.level.on('damage', e => { ev++; if (e.src === g.hero.u) shown++; });
  await new Promise(r => setTimeout(r, 8000));
  return { ev, shownByHero: shown, presenterCalls: calls, fxSpawns: spawns, statsDelta: fx.stats().numbersSpawned - n0 };
});
console.log(JSON.stringify(r));
await b.close();
