// Social card (1200×630) from the live title scene: node tools/og.mjs <out.jpg-or-png>
import puppeteer from 'puppeteer-core';
const out = process.argv[2] || 'public/og.png';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1200, height: 630 } });
const p = await b.newPage();
await p.goto('http://localhost:5299/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__session?.screen === 'title', { timeout: 60000 });
await new Promise(r => setTimeout(r, 4500));
await p.addStyleTag({ content: `.ss-ti-menu,.ss-ti-srv,.ss-ti-news,.ss-ti-hint,.ss-ti-ver,.ss-ti-cont{display:none!important}
.og-tag{position:fixed;z-index:99999;left:0;right:0;bottom:58px;text-align:center;font:500 25px Georgia,"Times New Roman",serif;letter-spacing:.14em;color:#f4e3bf;text-shadow:0 2px 12px #000,0 0 30px rgba(0,0,0,.8);text-transform:uppercase}
.og-sub{position:fixed;z-index:99999;left:0;right:0;bottom:24px;text-align:center;font:600 16px "Segoe UI",Roboto,sans-serif;letter-spacing:.08em;color:#c9b88f;text-shadow:0 2px 8px #000}` });
await p.evaluate(() => {
  const a = document.createElement('div'); a.className = 'og-tag'; a.textContent = 'A Lost Ark–inspired action MMO in your browser'; document.body.appendChild(a);
  const s = document.createElement('div'); s.className = 'og-sub'; s.textContent = '8 classes · chaos dungeons · guardian raids · legion raid · sailing · co-op with friends'; document.body.appendChild(s);
});
await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: out, ...(out.endsWith('.jpg') ? { type: 'jpeg', quality: 90 } : {}) });
await b.close();
