// Real-flow co-op: A creates a character and hosts from Solhaven; B creates one and joins by room code; A launches
// content and B must follow. usage: node tools/coopflow.mjs [--content=chaos:1|guardian:rimewing] [--secs=20] [--shots=dir]
import puppeteer from 'puppeteer-core';
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d ?? ''}`).split('=').slice(1).join('=');
const shots = arg('shots'), content = arg('content', 'chaos:1'), secs = +arg('secs', 20);
const launch = () => puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], defaultViewport: { width: 1280, height: 720 } });
const [ba, bb] = [await launch(), await launch()];
const A = await ba.newPage(), B = await bb.newPage();
const errs = [];
for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', e => errs.push(`${n} ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load/.test(m.text())) errs.push(`${n} ${m.text().slice(0, 240)}`); }); }
const fresh = async p => { await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 }); };
await fresh(A); await fresh(B);
const mk = (name, cls) => `(async()=>{ await __session.route('title:enter'); __session.hostMode = ${name === 'Hosty'}; await __session.route('create:confirm',{cls:'${cls}',sex:'m',look:{},name:'${name}',path:'powerpass'}); return __session.screen })()`;
console.log('A', await A.evaluate(mk('Hosty', 'reaver')));
let code = null; for (let i = 0; i < 40 && !code; i++) { await new Promise(r => setTimeout(r, 500)); code = await A.evaluate(() => __game.net?.code || null); }
console.log('room', code); if (!code) process.exit(1);
console.log('B', await B.evaluate(`(async()=>{ __session.joinCode='${code}'; await __session.route('title:enter'); await __session.route('create:confirm',{cls:'songweaver',sex:'f',look:{},name:'Guesty',path:'powerpass'}); return __session.screen })()`));
await new Promise(r => setTimeout(r, 8000));
const peek = async () => ({
  A: await A.evaluate(() => ({ zone: __game.zone?.id, mode: __game.mode?.kind, guests: __game.net?.guests?.size, remote: __game.level.units.filter(u => u.remote).map(u => u.name) })),
  B: await B.evaluate(() => ({ zone: __game.zone?.id, mode: __game.mode?.constructor?.name, puppets: __game.net?.hostIds?.size, hosty: [...(__game.net?.hostIds?.values() || [])].some(u => u.name === 'Hosty'), me: __game.hero?.u?.name })),
});
console.log('city', JSON.stringify(await peek()));
if (shots) { await A.screenshot({ path: `${shots}/cf_A_city.png` }); await B.screenshot({ path: `${shots}/cf_B_city.png` }); }
const [kind, a] = content.split(':');
await A.evaluate(c => __session.launch(c), kind === 'chaos' ? { kind, tier: +a } : { kind, boss: a });
await A.evaluate(() => { __game.player.input = () => {}; __game.hero.u.ctrl = new window.__AllyAI(__game.hero, 'tryhard'); });
await new Promise(r => setTimeout(r, 7000));
await B.evaluate(() => { if (__game.hero) { __game.player.input = () => {}; __game.hero.u.ctrl = new window.__AllyAI(__game.hero, 'tryhard'); } });
await new Promise(r => setTimeout(r, secs * 1000));
console.log('content', JSON.stringify(await peek()));
console.log('B view', await B.evaluate(() => { const g = __game, c = g.cam; return { cam: [c.cam.position.x, c.cam.position.y, c.cam.position.z].map(v => +v.toFixed(1)), tgt: [c.target.x, c.target.y, c.target.z].map(v => +v.toFixed(1)), hero: g.hero && [g.hero.u.pos.x, g.hero.u.pos.y, g.hero.u.pos.z].map(v => +v.toFixed(1)), manual: c.manual, cine: !!c.cine, focus: !!g.camFocus, rootIn: g.scene.children.includes(g.zone?.root), kids: g.scene.children.length, lb: g.renderer.fx.letterbox, desat: g.renderer.fx.desat, exp: g.renderer.grade.exposure, bg: g.scene.background?.getHexString?.() }; }));
console.log('B hits', await B.evaluate(() => ({ hp: __game.hero?.u.hp, hud: __game.net?.hud?.progress || __game.net?.hud?.boss?.name })));
console.log('A meter', await A.evaluate(() => JSON.stringify(__game.party?.meterRows().map(r => [r.name, Math.round(r.dps)]))));
if (shots) { await A.screenshot({ path: `${shots}/cf_A_content.png` }); await B.screenshot({ path: `${shots}/cf_B_content.png` }); }
console.log(`${errs.length} errors`); for (const e of [...new Set(errs)].slice(0, 12)) console.log(' ', e);
await ba.close(); await bb.close();
