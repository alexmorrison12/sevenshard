// README screenshots → docs/img: node tools/readme_shots.mjs [only,...]
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const only = process.argv[2] ? process.argv[2].split(',') : null;
const out = 'docs/img'; fs.mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900', '--disable-background-timer-throttling'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
const fresh = async () => {
  await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
};
const make = async (cls, path, sex = 'f') => p.evaluate(async (cls, path, sex) => { await __session.route('title:enter'); if (__session.screen === 'charselect') await __session.route('select:create'); await __session.route('create:confirm', { cls, sex, look: { face: 2, hair: 3, hairColor: 0x2a1a10, skin: 1, eyes: 0x3a8ac0, height: 1, build: 0.5, marks: 0 }, name: 'Shot' + Math.floor(Math.random() * 9999), path }); await new Promise(r => setTimeout(r, 3500)); }, cls, path, sex);
const auto = () => p.evaluate(() => { const g = __game; g.player.input = () => {}; g.hero.u.ctrl = new window.__AllyAI(g.hero, 'tryhard'); g.hero.u.invuln = 1e9; });
const hideUi = on => p.evaluate(on => { document.querySelectorAll('.ss-chat, .ss-menu').forEach(e => e.style.visibility = on ? 'hidden' : ''); }, on);
const shot = async name => { await p.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 86 }); console.log('shot', name); };
const want = n => !only || only.includes(n);

await fresh();
if (want('title')) { await new Promise(r => setTimeout(r, 4500)); await shot('title'); }
if (want('create')) { await p.evaluate(() => __session.route('title:enter')); await new Promise(r => setTimeout(r, 5000)); await shot('create'); await fresh(); }
if (want('hero') || want('raid')) {
  await make('reaver', 'raid', 'm');
  await p.evaluate(() => __session.launch({ kind: 'raid', raid: 'gorrath', gate: 1 }));
  await new Promise(r => setTimeout(r, 1900)); if (want('hero')) await shot('hero');
  await auto(); await hideUi(true);
  await new Promise(r => setTimeout(r, 14000)); if (want('raid')) await shot('raid');
  await hideUi(false); await fresh();
}
if (want('city') || want('nexus') || want('guardian') || want('chaos')) {
  await make('songweaver', 'powerpass');
  if (want('city')) { await new Promise(r => setTimeout(r, 1500)); await shot('city'); }
  if (want('nexus')) { await p.evaluate(() => __session.contentMenu('chaos')); await new Promise(r => setTimeout(r, 900)); await shot('nexus'); await p.evaluate(() => __session.ui.close('nexus')); }
  if (want('chaos')) { await p.evaluate(() => __session.launch({ kind: 'chaos', tier: 1 })); await auto(); await new Promise(r => setTimeout(r, 9000)); await shot('chaos'); await p.evaluate(() => __session.returnToHub()); await new Promise(r => setTimeout(r, 2500)); }
  if (want('guardian')) { await p.evaluate(() => __session.launch({ kind: 'guardian', boss: 'kurai' })); await auto(); await new Promise(r => setTimeout(r, 12000)); await shot('guardian'); }
  await fresh();
}
if (want('prologue')) {
  await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'bladedancer', sex: 'f', look: {}, name: 'Prologue', path: 'story' }); });
  await new Promise(r => setTimeout(r, 7000)); await shot('prologue');
  await fresh();
}
if (want('sea')) {
  await make('pistoleer', 'powerpass', 'm');
  await p.evaluate(async () => { await __session.launch({ kind: 'sail' }); await new Promise(r => setTimeout(r, 6000)); });
  await shot('sea');
}
console.log('errors', errs.slice(0, 5));
await b.close();
