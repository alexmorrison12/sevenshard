// Headless-Chrome screenshot helper for visual QA (real GPU through ANGLE/Metal).
// usage: node tools/shot.mjs <url> <out.png> [--w=1600] [--h=900] [--wait=3000] [--eval="js"] [--evalAfter="js"]
//                            [--shots=N --every=ms]   N screenshots, out_0.png … out_{N-1}.png, --every ms apart
//                            [--mobile]               375×812 touch phone (use --w/--h to override)
// The page's console output is printed. Evaluated JS may return a value (printed as JSON) or a Promise.
import puppeteer from 'puppeteer-core';
const args = Object.fromEntries(process.argv.slice(4).map(a => { const m = a.match(/^--([^=]+)=(.*)$/s); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const [url, out] = process.argv.slice(2);
if (!url || !out) { console.error('usage: node tools/shot.mjs <url> <out.png> [options]'); process.exit(1); }
const mobile = !!args.mobile;
const W = +(args.w || (mobile ? 812 : 1600)), H = +(args.h || (mobile ? 375 : 900));
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', `--window-size=${W},${H}`, '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: +(args.dpr || 1), isMobile: mobile, hasTouch: mobile },
});
const page = await browser.newPage();
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(1, 5).join('\n')}`));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
if (args.eval) { try { const r = await page.evaluate(args.eval); if (r !== undefined) logs.push('[eval] ' + JSON.stringify(r)); } catch (e) { logs.push('[eval-error] ' + e.message); } }
await new Promise(r => setTimeout(r, +(args.wait || 3000)));
if (args.evalAfter) { try { const r = await page.evaluate(args.evalAfter); if (r !== undefined) logs.push('[evalAfter] ' + JSON.stringify(r).slice(0, 4000)); } catch (e) { logs.push('[evalAfter-error] ' + e.message); } }
const n = +(args.shots || 1);
for (let i = 0; i < n; i++) {
  if (i) await new Promise(r => setTimeout(r, +(args.every || 1000)));
  await page.screenshot({ path: n > 1 ? out.replace(/\.png$/, `_${i}.png`) : out });
}
logs.push(`[shot] ${n} image(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(logs.slice(-60).join('\n'));
await browser.close();
