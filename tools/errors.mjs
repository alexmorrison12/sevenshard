// Load a page in headless Chrome and print unique console errors, page errors and shader compile logs.
// usage: node tools/errors.mjs <url> [waitMs=6000]
import puppeteer from 'puppeteer-core';
const url = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,900'], defaultViewport: { width: 1600, height: 900 } });
const p = await b.newPage();
const out = [];
p.on('console', m => { const t = m.text(); if (m.type() === 'error' || /Shader|ERROR|program not valid/i.test(t)) out.push(`[${m.type()}] ${t.slice(0, 2500)}`); });
p.on('pageerror', e => out.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
await p.goto(url, { waitUntil: 'load', timeout: 60000 });
await new Promise(r => setTimeout(r, +(process.argv[3] || 6000)));
const uniq = [...new Set(out)];
console.log(uniq.slice(0, 12).join('\n---\n'));
console.log(`(${out.length} messages, ${uniq.length} unique)`);
await b.close();
