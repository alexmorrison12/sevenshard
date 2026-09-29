// Drive the real game flow headlessly: fresh save → title → create (class/path) → Solhaven → optional content.
// usage: node tools/flow.mjs [--cls=reaver] [--path=powerpass] [--content=chaos:1|guardian:rimewing|raid:gorrath:1] [--secs=20] [--shots=dir]
import puppeteer from 'puppeteer-core';
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d ?? ''}`).split('=').slice(1).join('=');
const shots = arg('shots'), cls = arg('cls', 'reaver'), path = arg('path', 'powerpass'), content = arg('content'), secs = +arg('secs', 15);
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900', '--autoplay-policy=no-user-gesture-required'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('[pageerror] ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('[error] ' + m.text().slice(0, 300)); });
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
const step = async (name, fn, a) => { const t = Date.now(); try { const r = await p.evaluate(fn, a); console.log(`✔ ${name} (${Date.now() - t}ms)`, r === undefined ? '' : JSON.stringify(r).slice(0, 240)); return r; } catch (e) { console.log(`✘ ${name}: ${e.message.split('\n')[0]}`); errs.push(`[step ${name}] ${e.message}`); } };
const shot = async n => { if (shots) await p.screenshot({ path: `${shots}/flow_${n}.png` }); };
await shot('title');
await step('create screen', async () => { await __session.route('title:enter'); return __session.screen; });
await shot('create');
await step('create + enter world', async ([cls, path]) => { await __session.route('create:confirm', { cls, sex: 'f', look: { face: 1, hair: 2, hairColor: 0x6a4424, skin: 1, eyes: 0x4a8a5a, height: 1, build: 0.5, marks: 0 }, name: 'Flowtest', path }); await new Promise(r => setTimeout(r, 2500)); const g = __game; return { screen: __session.screen, zone: g.zone?.id, units: g.level.units.length, ilvl: Math.floor(g.hero.u.st.ilvl) }; }, [cls, path]);
await shot('world');
await step('open windows', async () => { const out = {}; for (const id of ['character', 'inventory', 'skills', 'engravings', 'map']) { __session.menu(id); await new Promise(r => setTimeout(r, 250)); out[id] = __session.ui.isOpen?.(id); __session.ui.close(id); } return out; });
if (content) {
  const [kind, a, g] = content.split(':');
  const c = kind === 'chaos' ? { kind, tier: +a } : kind === 'guardian' ? { kind, boss: a } : { kind: 'raid', raid: a, gate: +(g || 0), trial: true };
  await step('launch ' + content, async c => { await __session.launch(c); const { AllyAI } = await import('./nothing.js').catch(() => ({})); return { screen: __session.screen, zone: __game.zone?.id, mode: __game.mode?.kind }; }, c);
  await step('autopilot', async () => { const g = __game; const mod = await Promise.resolve(); g.player.input = () => {}; const AI = window.__AllyAI; if (AI) { g.hero.u.ctrl = new AI(g.hero, 'tryhard'); } return !!AI; });
  await new Promise(r => setTimeout(r, secs * 1000));
  await shot('content');
  await step('content state', async () => { const m = __game.mode; return { kind: m?.kind, state: m?.state, pct: m?.pct, stage: m?.stage, boss: m?.boss ? +(m.boss.hp / m.boss.hpMax).toFixed(3) : null }; });
}
console.log(`\n${errs.length} error(s)`); for (const e of [...new Set(errs)].slice(0, 20)) console.log(e);
await b.close();
