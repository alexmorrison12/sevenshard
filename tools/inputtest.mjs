// Mouse-state regression: chorded presses/releases must never leave a button "held". node tools/inputtest.mjs
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'], defaultViewport: { width: 1280, height: 720 } });
const p = await b.newPage();
await p.goto((process.argv[2]||'http://localhost:5299/index.html'), { waitUntil: 'load' });
await p.evaluate(() => localStorage.clear());
await p.goto((process.argv[2]||'http://localhost:5299/index.html'), { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await p.evaluate(async () => { await __session.route('title:enter'); await __session.route('create:confirm', { cls: 'starcaller', sex: 'f', look: {}, name: 'Clicker', path: 'powerpass' }); await new Promise(r => setTimeout(r, 2500)); });
const state = () => p.evaluate(() => ({ buttons: __game.input.mouse.buttons, skill: !!__game.hero.u.skill }));
const m = p.mouse, sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = [];
await m.move(700, 420); await sleep(100);
// 1: attack (left), start moving (right) while holding it, let go of left first, then right
await m.down({ button: 'left' }); await sleep(150); await m.down({ button: 'right' }); await sleep(150);
rows.push(['both held', await state()]);
await m.up({ button: 'left' }); await sleep(100); rows.push(['left released (chorded)', await state()]);
await m.move(720, 430); await sleep(100); await m.up({ button: 'right' }); await sleep(150); rows.push(['right released', await state()]);
await sleep(1200); rows.push(['1.2 s later (attack should have stopped)', await state()]);
// 2: move (right) held, click left twice while moving, release right
await m.down({ button: 'right' }); await sleep(100); await m.down({ button: 'left' }); await sleep(80); await m.up({ button: 'left' }); await sleep(80);
await m.down({ button: 'left' }); await sleep(80); await m.up({ button: 'left' }); await sleep(80); await m.up({ button: 'right' }); await sleep(150);
rows.push(['move + two chorded attacks, all released', await state()]);
for (const [k, v] of rows) console.log(k.padEnd(44), JSON.stringify(v));
await b.close();
