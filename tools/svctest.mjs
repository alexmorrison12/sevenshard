// Stablemaster + Roster Storage smoke test: node tools/svctest.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'], defaultViewport: { width: 1280, height: 720 } });
const p = await b.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
const r = await p.evaluate(async () => {
  const S = __session, sleep = ms => new Promise(r => setTimeout(r, ms));
  const key = k => dispatchEvent(new KeyboardEvent('keydown', { key: k, code: 'Digit' + k, bubbles: true }));
  await S.route('title:enter'); await S.route('create:confirm', { cls: 'reaver', sex: 'm', look: {}, name: 'Stabler', path: 'powerpass' }); await sleep(2500);
  S.account.give('silver', 50000);
  const s0 = S.account.count('silver');
  S.service('mounts', { name: 'Gregor Hay', title: 'Stablemaster' }); await sleep(700); S.ui.npc.finish('m1'); await sleep(900);
  const mount = [S.char.mount, S.char.mountVariant, s0 - S.account.count('silver')];
  S.char.inv.push({ uid: 'test-ring-1', id: 'ring', kind: 'accessory', name: 'Test Ring', grade: 4 });
  S.service('storage', { name: 'Petra Coin', title: 'Roster Storage' }); await sleep(700); S.ui.npc.finish('dep'); await sleep(700); S.ui.npc.finish('i0'); await sleep(700); S.ui.npc.finish('bye'); await sleep(600);
  return { mount, stored: S.account.roster.storage.map(x => x.name), bag: S.char.inv.filter(x => x.uid === 'test-ring-1').length };
});
console.log(JSON.stringify(r)); console.log('errors', errs);
await b.close();
