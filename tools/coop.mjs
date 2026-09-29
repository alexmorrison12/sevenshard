// Two browsers over real WebRTC: A hosts a boss fight, B joins by room code. Checks puppets, shared damage,
// enemy hits on the guest, and prints both sides' view. usage: node tools/coop.mjs [--boss=rimewing] [--secs=40] [--shots=dir]
import puppeteer from 'puppeteer-core';
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const base = 'http://localhost:5299/index.html';
const boss = arg('boss') || 'rimewing', secs = +(arg('secs') || 40), shots = arg('shots');
const launch = () => puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], defaultViewport: { width: 1280, height: 720 } });
const [ba, bb] = [await launch(), await launch()];
const A = await ba.newPage(), B = await bb.newPage();
const errs = [];
for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', e => errs.push(`${n} ${e.message}`)); p.on('console', m => { const t = m.text(); if (/\[net\]|\[result\]/.test(t)) console.log(n, t.slice(0, 200)); if (m.type() === 'error' && !/Failed to load/.test(t)) errs.push(`${n} ${t.slice(0, 300)}`); }); }
await A.goto(`${base}?dev=boss&boss=${boss}&host=1&auto=1&q=low`, { waitUntil: 'load' });
let code = null;
for (let i = 0; i < 60 && !code; i++) { await new Promise(r => setTimeout(r, 500)); code = await A.evaluate(() => window.__net?.code || null); }
console.log('room code', code);
if (!code) { console.log('host never opened'); process.exit(1); }
await B.goto(`${base}?dev=join&code=${code}&cls=reaver&name=Guesty&auto=1&q=low`, { waitUntil: 'load' });
const t0 = Date.now();
while (Date.now() - t0 < secs * 1000) {
  await new Promise(r => setTimeout(r, 5000));
  const a = await A.evaluate(() => { const g = __game, m = g.mode; return { guests: __net.guests.size, units: g.level.units.length, boss: m.boss ? +(m.boss.hp / m.boss.hpMax).toFixed(3) : null, remote: g.level.units.filter(u => u.remote).map(u => [u.name, Math.round(u.pos.x), Math.round(u.pos.z), Math.round(u.hp)]), meter: g.party?.meterRows().map(r => [r.name, Math.round(r.dps)]) }; });
  const b = await B.evaluate(() => { const g = __game; const me = g.hero?.u; return { units: g.level?.units.length, puppets: [...__net.hostIds.values()].length, me: me && [Math.round(me.pos.x), Math.round(me.pos.z), Math.round(me.hp), me.dead], boss: __net.hud?.boss ? +(__net.hud.boss.hp / __net.hud.boss.hpMax).toFixed(3) : null }; });
  console.log(`t+${Math.round((Date.now() - t0) / 1000)}s A:`, JSON.stringify(a), '\n        B:', JSON.stringify(b));
}
if (shots) { await A.screenshot({ path: `${shots}/coop_A.png` }); await B.screenshot({ path: `${shots}/coop_B.png` }); }
console.log(`${errs.length} errors`); for (const e of [...new Set(errs)].slice(0, 15)) console.log(' ', e);
await ba.close(); await bb.close();
