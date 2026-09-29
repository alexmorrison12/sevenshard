// SEVENSHARD audio lab: buttons for every track / sfx / stinger / ambience / song, volume sliders, live meters
// (waveform, spectrum, L/R peak+RMS, limiter GR), CPU/voice readout, 3D placement pad, and offline render +
// objective analysis (LUFS, peak, spectral balance, loop seams, spectrogram PNG, piano roll).
// Build: node tools/lab.mjs src/lab/audio.js → http://localhost:5299/lab/audio.html
// Automation (headless): window.__lab.* — see the bottom of this file.
import { createAudio, TRACK_NAMES, STINGER_NAMES, SONG_NAMES, SFX_NAMES, LOOP_NAMES, AMBIENCE_NAMES } from '../audio/index.js';
import { SFX, CATEGORIES } from '../audio/sfx/index.js';
import { TARGETS } from '../audio/sfx/levels.js';
import { TRACKS, STINGERS, SONGS } from '../audio/music/index.js';
import { Engine } from '../audio/engine.js';
import { Track } from '../audio/music/track.js';
import * as INSTR from '../audio/music/instruments.js';
import { bakeStats } from '../audio/music/bake.js';
import * as PATCHES from '../audio/music/patches.js';
import { MIX, TRACK_GAIN } from '../audio/music/mix.js';
import { mel } from '../audio/music/theory.js';
import { renderSound, renderEvents, renderMusic, renderAmbience, renderLoop, renderPiece, analyze, timeline, toWav, spectrogram, blockPower } from '../audio/analysis.js';

const audio = createAudio();
window.audio = audio;
const E = audio.engine;

// ---------------------------------------------------------------- DOM
const css = `
#alab{position:fixed;inset:0;overflow:auto;background:#0a0d16;color:#dfe6f5;font:13px/1.35 "Segoe UI",Roboto,system-ui,sans-serif}
#alab h1{font:700 19px Georgia,serif;color:#f3dca0;margin:0;letter-spacing:.14em;font-variant:small-caps}
#alab h2{font:600 11px system-ui;text-transform:uppercase;letter-spacing:.14em;color:#c9a45a;margin:14px 0 6px}
#alab .top{position:sticky;top:0;z-index:5;display:flex;gap:14px;align-items:center;padding:10px 16px;background:#0e1322;border-bottom:1px solid #2a3450}
#alab .wrap{display:grid;grid-template-columns:minmax(320px,440px) 1fr;gap:18px;padding:12px 16px 40px}
@media (max-width:900px){#alab .wrap{grid-template-columns:1fr}}
#alab button{background:#161d33;color:#e6ebff;border:1px solid #33406a;border-radius:4px;padding:4px 8px;margin:2px;cursor:pointer;font:12px system-ui}
#alab button:hover{background:#222c4c;border-color:#c9a45a}
#alab button.on{background:#5a4318;border-color:#e0b04a;color:#fff}
#alab button.big{background:#6a4a14;border-color:#e0b04a;font-weight:700}
#alab .row{display:flex;align-items:center;gap:8px;margin:3px 0}
#alab .row label{width:78px;color:#9fb0d8}
#alab input[type=range]{flex:1;accent-color:#e0b04a}
#alab canvas{background:#04060c;border:1px solid #242c44;border-radius:4px;display:block;max-width:100%}
#alab pre{background:#05070e;border:1px solid #242c44;border-radius:4px;padding:8px;white-space:pre-wrap;font:11px/1.35 ui-monospace,monospace;color:#c8d2ea;max-height:340px;overflow:auto}
#alab select,#alab input[type=number]{background:#141a2e;color:#eee;border:1px solid #33406a;border-radius:3px;padding:3px}
#alab .muted{color:#7d8bb0}
#alab .cat{display:inline-block;width:92px;color:#7d8bb0}
#shot{position:fixed;inset:0;z-index:50;background:#000;display:none;overflow:auto}
#shot img{display:block;max-width:100%}
`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
const root = document.createElement('div'); root.id = 'alab'; document.body.appendChild(root);
const shot = document.createElement('div'); shot.id = 'shot'; document.body.appendChild(shot);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v); } for (const c of kids) e.append(c); return e; };

const status = el('span', { class: 'muted' }, 'audio locked — click anything');
root.append(el('div', { class: 'top' }, el('h1', {}, 'Sevenshard · Audio Lab'), el('button', { class: 'big', onclick: () => start() }, 'Unlock / Resume'), status));
const left = el('div'), right = el('div');
root.append(el('div', { class: 'wrap' }, left, right));
function start() { audio.unlock(); if (E.ctx && !meters.on) meters.start(); }

// ---------------------------------------------------------------- music
left.append(el('h2', {}, 'Music'));
const fadeIn = el('input', { type: 'number', value: '3', step: '0.5', min: '0', style: 'width:56px' });
const trackBtns = {};
const mrow = el('div');
for (const n of TRACK_NAMES) { const b = el('button', { onclick: () => { start(); audio.music(n, { fade: +fadeIn.value }); refreshTracks(); } }, n); trackBtns[n] = b; mrow.append(b); }
mrow.append(el('button', { onclick: () => { audio.music(null, { fade: +fadeIn.value }); refreshTracks(); } }, '■ stop'));
left.append(mrow, el('div', { class: 'row' }, el('label', {}, 'fade (s)'), fadeIn));
left.append(el('h2', {}, 'Stingers'), el('div', {}, ...STINGER_NAMES.map((n) => el('button', { onclick: () => { start(); audio.stinger(n); } }, n))));
left.append(el('h2', {}, 'Songs (in-world performance)'), el('div', {}, ...SONG_NAMES.map((n) => el('button', { onclick: () => { start(); const s = audio.song(n); status.textContent = `song ${n}: ${s.toFixed(2)} s`; } }, n))));
const schedPre = el('pre', {}, '');
left.append(schedPre);
function refreshTracks() { for (const [n, b] of Object.entries(trackBtns)) b.classList.toggle('on', audio.currentMusic === n); }

// ---------------------------------------------------------------- volumes / ambience
left.append(el('h2', {}, 'Volumes'));
for (const bus of ['master', 'music', 'sfx', 'ambience']) {
  const r = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '1' });
  const v = el('span', { class: 'muted', style: 'width:34px' }, '1.00');
  r.addEventListener('input', () => { audio.setVolumes({ [bus]: +r.value }); v.textContent = (+r.value).toFixed(2); });
  left.append(el('div', { class: 'row' }, el('label', {}, bus), r, v));
}
left.append(el('div', {}, el('button', { onclick: () => audio.duck(0.6, 2.5) }, 'duck 0.6 / 2.5 s')));
left.append(el('h2', {}, 'Ambience'));
const ambBtns = {};
left.append(el('div', {}, ...AMBIENCE_NAMES.map((n) => (ambBtns[n] = el('button', { onclick: () => { start(); audio.ambience(n); for (const [k, b] of Object.entries(ambBtns)) b.classList.toggle('on', k === n); } }, n))),
  el('button', { onclick: () => { audio.ambience(null); for (const b of Object.values(ambBtns)) b.classList.remove('on'); } }, '■ silence')));

// ---------------------------------------------------------------- loops + 3D pad
left.append(el('h2', {}, 'Loops (at pad position)'));
const loopHandles = {};
left.append(el('div', {}, ...LOOP_NAMES.map((n) => { const b = el('button', { onclick: () => { start(); if (loopHandles[n]) { loopHandles[n].stop(0.4); delete loopHandles[n]; b.classList.remove('on'); } else { loopHandles[n] = audio.loop(n, { pos: pad.world() }); b.classList.add('on'); } } }, n); return b; })));
left.append(el('h2', {}, 'Position (listener at centre, north up, ±40 m; screen-right = +X)'));
const padCv = el('canvas', { width: '240', height: '240' });
const use3d = el('input', { type: 'checkbox' });
left.append(padCv, el('div', { class: 'row' }, use3d, el('span', {}, 'play SFX at this position')));
const pad = {
  x: 6, z: -6,
  world() { return { x: E.L.x + this.x, y: 0, z: E.L.z + this.z }; },
  draw() {
    const g = padCv.getContext('2d'); g.fillStyle = '#04060c'; g.fillRect(0, 0, 240, 240);
    g.strokeStyle = '#1c2440'; for (const r of [10, 20, 30, 40]) { g.beginPath(); g.arc(120, 120, r * 3, 0, 7); g.stroke(); }
    g.fillStyle = '#e0b04a'; g.beginPath(); g.moveTo(120, 110); g.lineTo(114, 126); g.lineTo(126, 126); g.fill();
    g.fillStyle = '#6cf'; g.beginPath(); g.arc(120 + this.x * 3, 120 + this.z * 3, 5, 0, 7); g.fill();
    g.fillStyle = '#7d8bb0'; g.font = '11px monospace'; g.fillText(`x ${this.x.toFixed(0)}  z ${this.z.toFixed(0)}  d ${Math.hypot(this.x, this.z).toFixed(1)} m`, 6, 234);
  },
};
padCv.addEventListener('pointerdown', (e) => {
  const move = (ev) => { const r = padCv.getBoundingClientRect(); pad.x = ((ev.clientX - r.left) / r.width * 240 - 120) / 3; pad.z = ((ev.clientY - r.top) / r.height * 240 - 120) / 3; pad.draw(); for (const h of Object.values(loopHandles)) h.setPos(pad.world()); };
  move(e); const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); }; addEventListener('pointermove', move); addEventListener('pointerup', up);
});
pad.draw();

// ---------------------------------------------------------------- meters + CPU readout
right.append(el('h2', {}, 'Output'));
const meterCv = el('canvas', { width: '900', height: '220', style: 'width:100%' });
right.append(meterCv);
const meters = {
  on: false,
  start() {
    const ctx = E.ctx; this.on = true;
    this.an = ctx.createAnalyser(); this.an.fftSize = 4096; this.an.smoothingTimeConstant = 0.6;
    const sp = ctx.createChannelSplitter(2); this.l = ctx.createAnalyser(); this.r = ctx.createAnalyser(); this.l.fftSize = this.r.fftSize = 2048;
    E.output.connect(this.an); E.output.connect(sp); sp.connect(this.l, 0); sp.connect(this.r, 1);
    this.td = new Float32Array(4096); this.fd = new Float32Array(2048); this.cl = new Float32Array(2048); this.cr = new Float32Array(2048);
    this.hold = [-90, -90]; this.peakMax = -90;
    // render-capacity readout (Chrome, when available): real audio-thread load
    try { if (ctx.renderCapacity) { ctx.renderCapacity.start({ updateInterval: 1 }); ctx.renderCapacity.addEventListener('update', (e) => { this.cap = e; }); } } catch (e) { /* not supported */ }
    const loop = () => { requestAnimationFrame(loop); this.draw(); };
    loop();
  },
  draw() {
    const g = meterCv.getContext('2d'), W = meterCv.width, H = meterCv.height;
    g.fillStyle = '#04060c'; g.fillRect(0, 0, W, H);
    this.an.getFloatTimeDomainData(this.td); this.an.getFloatFrequencyData(this.fd);
    g.strokeStyle = '#6cf'; g.beginPath();
    for (let i = 0; i < 1024; i++) { const x = i / 1024 * 380, y = 110 - this.td[i] * 100; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.strokeStyle = '#223'; g.strokeRect(0, 10, 380, 200);
    g.fillStyle = '#e0b04a';
    const sr = E.ctx.sampleRate;
    for (let x = 0; x < 380; x++) { const f = 30 * Math.pow(18000 / 30, x / 380), k = Math.round(f / (sr / 2) * 2048), v = Math.max(0, (this.fd[k] + 110) / 100); g.fillRect(400 + x, 210 - v * 200, 1, v * 200); }
    const lvl = (an, buf) => { an.getFloatTimeDomainData(buf); let pk = 0, s = 0; for (const v of buf) { pk = Math.max(pk, Math.abs(v)); s += v * v; } return [20 * Math.log10(pk || 1e-9), 20 * Math.log10(Math.sqrt(s / buf.length) || 1e-9)]; };
    [[this.l, this.cl], [this.r, this.cr]].forEach(([an, b], i) => {
      const [pk, rms] = lvl(an, b); this.hold[i] = Math.max(pk, this.hold[i] - 0.4); this.peakMax = Math.max(this.peakMax, pk);
      const X = 800 + i * 40, hh = (d) => Math.max(0, (d + 60) / 60) * 200;
      g.fillStyle = '#132'; g.fillRect(X, 10, 30, 200);
      g.fillStyle = '#4c8'; g.fillRect(X, 210 - hh(rms), 30, hh(rms));
      g.fillStyle = pk > -1 ? '#f44' : '#cfa'; g.fillRect(X, 210 - hh(this.hold[i]), 30, 2);
    });
    const s = audio.stats();
    g.fillStyle = '#aab'; g.font = '11px monospace';
    g.fillText(`peak max ${this.peakMax.toFixed(1)} dBFS · limiter GR ${s.limiterGR} dB · voices ${s.voices} (max ${s.maxVoices}) · loops ${s.loops}`, 404, 22);
    const cap = this.cap ? ` · audio thread load avg ${(this.cap.averageLoad * 100).toFixed(1)}% peak ${(this.cap.peakLoad * 100).toFixed(1)}% underruns ${(this.cap.underrunRatio * 100).toFixed(2)}%` : '';
    status.textContent = `ctx ${s.state} · ${E.ctx.sampleRate} Hz · latency ${s.latency} ms · tick ${s.tickMs} ms (max ${s.tickMax})${cap}`;
    if (E.mu) {
      const m = E.mu.stats;
      schedPre.textContent = `music: ${audio.currentMusic} · ambience: ${audio.currentAmbience}\ntracks: ${E.mu.tracks.map((t) => t.name + (t.stopping ? '(fading)' : '') + (t.overlay ? '(overlay)' : '')).join(', ')}\nbars ${m.bars} · skipped ${m.skipped} · min lead ${isFinite(m.minLead) ? m.minLead.toFixed(3) : '-'} s · horizon ${m.horizon.toFixed(2)} s · max timer gap ${m.maxTimerGap.toFixed(3)} s`;
    }
  },
};

// ---------------------------------------------------------------- SFX
right.append(el('h2', {}, 'Sound effects'));
for (const [cat, names] of Object.entries(CATEGORIES)) {
  const row = el('div', {}, el('span', { class: 'cat' }, cat));
  for (const n of names) row.append(el('button', { onclick: () => { start(); audio.sfx(n, { pos: use3d.checked ? pad.world() : undefined }); } }, n));
  right.append(row);
}
right.append(el('div', {}, el('button', { onclick: () => stressLive(24) }, 'stress: 24 overlapping'), el('button', { onclick: () => hitchTest(20).then((r) => { schedPre.textContent = JSON.stringify(r, null, 1); }) }, 'hitch test (20 s, 400 ms stalls)')));

// ---------------------------------------------------------------- offline analysis
right.append(el('h2', {}, 'Offline render + analysis'));
const kind = el('select', {}, ...['sfx', 'music', 'stinger', 'song', 'ambience', 'loop'].map((k) => el('option', { value: k }, k)));
const nameSel = el('select');
const durIn = el('input', { type: 'number', value: '6', step: '1', min: '1', style: 'width:60px' });
const LISTS = { sfx: SFX_NAMES, music: TRACK_NAMES, stinger: STINGER_NAMES, song: SONG_NAMES, ambience: AMBIENCE_NAMES, loop: LOOP_NAMES };
const fillNames = () => { nameSel.innerHTML = ''; for (const n of LISTS[kind.value]) nameSel.append(el('option', { value: n }, n)); durIn.value = { music: 60, sfx: 6, stinger: 12, song: 14, ambience: 20, loop: 12 }[kind.value]; };
kind.addEventListener('change', fillNames); fillNames();
const out = el('pre', {}, 'render a sound to see peak / RMS / LUFS / DC / band energies');
const specHolder = el('div');
right.append(el('div', { class: 'row' }, kind, nameSel, el('span', {}, 'dur'), durIn,
  el('button', { onclick: () => doRender(false) }, 'Render + analyze'), el('button', { onclick: () => doRender(true) }, 'Render → WAV')), out, specHolder);
async function render(k, n, dur, o = {}) {
  if (k === 'sfx') return renderSound(n, { dur, ...o });
  if (k === 'music') return (await renderMusic(n, dur, o)).buf;
  if (k === 'stinger' || k === 'song') return (await renderPiece(k, n, dur, o)).buf;
  if (k === 'ambience') return renderAmbience(n, dur, o);
  return renderLoop(n, dur, o);
}
async function doRender(wav) {
  out.textContent = 'rendering…';
  const t0 = performance.now();
  const buf = await render(kind.value, nameSel.value, +durIn.value);
  const a = analyze(buf);
  out.textContent = `${kind.value} "${nameSel.value}" rendered in ${(performance.now() - t0).toFixed(0)} ms\n` + JSON.stringify(a, null, 1);
  specHolder.innerHTML = ''; specHolder.append(spectrogram(buf, { w: 900, h: 300, title: nameSel.value }));
  if (wav) { const blob = new Blob([toWav(buf)], { type: 'audio/wav' }); const u = URL.createObjectURL(blob); const link = el('a', { href: u, download: `${nameSel.value}.wav` }); document.body.append(link); link.click(); link.remove(); }
}

// ---------------------------------------------------------------- tests
function stressLive(n = 24) {
  start();
  const names = SFX_NAMES.filter((x) => SFX[x].bus !== 'ui' && !SFX[x].loop);
  for (let i = 0; i < n; i++) audio.sfx(names[i % names.length], { pos: { x: E.L.x + (Math.random() - 0.5) * 16, y: 0, z: E.L.z - 2 - Math.random() * 10 } });
}
// Realtime: run a track and stall the main thread periodically; the scheduler must never skip or go late.
async function hitchTest(seconds = 20, { track = 'title', stall = 400, every = 2000 } = {}) {
  start(); audio.music(track, { fade: 0.5 });
  const mu = E._mus(); const s0 = { ...mu.stats };
  const t0 = performance.now(); let stalls = 0;
  await new Promise((res) => {
    const iv = setInterval(() => {
      const t = performance.now(); while (performance.now() - t < stall) { /* busy: simulated hitch */ } stalls++;
      if (performance.now() - t0 > seconds * 1000) { clearInterval(iv); res(); }
    }, every);
  });
  const s = mu.stats;
  return { track, seconds, stalls, stallMs: stall, barsScheduled: s.bars - s0.bars, skippedBars: s.skipped - s0.skipped, minLeadSec: +s.minLead.toFixed(3), horizon: +s.horizon.toFixed(2), maxTimerGap: +s.maxTimerGap.toFixed(3) };
}

// ---------------------------------------------------------------- automation API (headless analysis)
const b64 = (ab) => { let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const SFX_DUR = (n) => SFX[n]?.labDur || 3.5;
window.__lab = {
  ready: true, audio, E, SFX, TRACKS, STINGERS, SONGS, SFX_NAMES, LOOP_NAMES, TRACK_NAMES, STINGER_NAMES, SONG_NAMES, AMBIENCE_NAMES, CATEGORIES,
  analyze, timeline, render, renderSound, renderMusic, renderAmbience, renderLoop, renderEvents, renderPiece, blockPower, spectrogram, toWav, b64,
  // show a data-URL image full screen (for screenshots)
  show(url) { shot.innerHTML = ''; const img = new Image(); img.src = url; shot.append(img); shot.style.display = 'block'; return new Promise((r) => { img.onload = () => r(true); }); },
  hide() { shot.style.display = 'none'; },
  async sfxReport(names = SFX_NAMES, o = {}) {
    const res = [];
    for (const n of names) { const buf = await renderSound(n, { dur: o.dur || SFX_DUR(n), raw: !!o.raw, seed: o.seed ?? 1, opts: o.opts || {} }); const a = analyze(buf); res.push({ name: n, lufs: a.lufs, mMax: a.mMax, peak: a.peakDb, active: a.active, tail: a.tailDb, cen: a.centroid, bands: Object.values(a.bands).join('/'), clip: a.clip }); }
    return res;
  },
  async spec(k, n, dur, o = {}) { const buf = await render(k, n, dur, o); return spectrogram(buf, { w: o.w || 1200, h: o.h || 360, title: n, fmax: o.fmax || 16000 }).toDataURL('image/png'); },
  async wav(k, n, dur, o = {}) { return b64(toWav(await render(k, n, dur, o))); },
  async music(n, seconds, o = {}) {
    const t0 = performance.now();
    const r = await renderMusic(n, seconds, o);
    const res = { name: n, seconds, renderMs: Math.round(performance.now() - t0), stats: r.stats, analysis: analyze(r.buf), tl: timeline(r.buf, o.win || 5).map((x) => x.m), notes: r.log.length };
    if (o.png) res.png = spectrogram(r.buf, { w: o.w || 1600, h: o.h || 380, title: n, fmax: 12000 }).toDataURL('image/png');
    if (o.log) res.log = r.log;
    if (o.wav) res.wav = b64(toWav(r.buf));
    return res;
  },
  // pure DSP cost of a track: schedule `seconds` of bars up-front (no suspends) and time the offline render.
  async cpu(n, seconds = 30, o = {}) {
    const SR = 48000, oac = new OfflineAudioContext(2, SR * (seconds + 1), SR), a = new Engine(); a.init({ context: oac, seed: o.seed ?? 7 });
    const mu = a._mus(); mu.solo = o.solo || null; await mu.prepare(n); mu.play(n, { fade: 0.05, seed: o.seed ?? 7 });
    const tr = mu.cur; const tb = performance.now(); tr.schedule(seconds); const schedMs = performance.now() - tb;
    const nodes = tr.srcs.length;
    const t0 = performance.now(); const buf = await oac.startRendering(); const ms = performance.now() - t0;
    return { name: n, seconds, renderMs: Math.round(ms), cpuPct: +(ms / (seconds * 10)).toFixed(2), schedMs: Math.round(schedMs), sources: nodes, srcPerSec: +(nodes / seconds).toFixed(1), lufs: analyze(buf).lufs };
  },
  // piano roll of the notes a track schedules (from the scheduler log)
  async roll(name, seconds = 60, o = {}) {
    const r = await renderMusic(name, seconds, { seed: o.seed ?? 7, log: true, actions: o.actions || [] });
    const W = o.w || 1600, H = o.h || 520, lo = o.lo || 24, hi = o.hi || 100, from = o.from || 0, to = o.to || seconds;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H + 40; const g = cv.getContext('2d');
    g.fillStyle = '#0b0a0e'; g.fillRect(0, 0, W, H + 40);
    const X = (t) => (t - from) / (to - from) * W, Y = (m) => H - (m - lo) / (hi - lo) * H;
    for (let m = lo; m <= hi; m++) if (m % 12 === 0) { g.fillStyle = '#222'; g.fillRect(0, Y(m), W, 1); g.fillStyle = '#555'; g.font = '10px monospace'; g.fillText('C' + (m / 12 - 1), 2, Y(m) - 2); }
    for (let s = Math.ceil(from); s < to; s += 5) { g.fillStyle = '#1a1a1a'; g.fillRect(X(s), 0, 1, H); g.fillStyle = '#444'; g.fillText(s + 's', X(s) + 2, H + 12); }
    const insts = [...new Set(r.log.map((e) => e[1]))];
    const col = (i) => `hsl(${(i * 137) % 360} 70% 60%)`;
    for (const [, inst, t, m, d, v] of r.log) {
      if (t + d < from || t > to) continue;
      g.fillStyle = col(insts.indexOf(inst)); g.globalAlpha = 0.35 + 0.65 * Math.min(1, v * 1.4);
      g.fillRect(X(t), Y(m) - 2, Math.max(2, X(t + d) - X(t)), 4);
    }
    g.globalAlpha = 1; g.font = '12px monospace';
    insts.forEach((n, i) => { g.fillStyle = col(i); g.fillText(n, 8 + i * 80, H + 30); });
    return cv.toDataURL('image/png');
  },
  // contact sheet of spectrograms: items [{ k, n, dur, o }]
  async sheet(items, { cols = 3, w = 520, h = 170 } = {}) {
    const rows = Math.ceil(items.length / cols), cv = document.createElement('canvas');
    cv.width = cols * (w + 6); cv.height = rows * (h + 76); const g = cv.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < items.length; i++) {
      const it = items[i], buf = await render(it.k || 'sfx', it.n, it.dur || SFX_DUR(it.n), it.o || {});
      g.drawImage(spectrogram(buf, { w, h, title: it.n, fmax: it.fmax || 16000 }), (i % cols) * (w + 6), Math.floor(i / cols) * (h + 76));
    }
    return cv.toDataURL('image/png');
  },
  hitchTest, INSTR, mel, bakeStats, PATCHES, TARGETS,
  // Harmony sanity: seconds per melody-minute where a melody note overlaps (>0.2 s) a sustained harmony note a
  // semitone / maj7 away. Passing tones are normal; large values mean chord/melody mismatch.
  async clashes(name, seconds = 120, o = {}) {
    const MEL = o.mel || ['flute', 'oboe', 'clar', 'vln', 'horn', 'rec', 'lute2', 'fid', 'tpt', 'whistle', 'cello', 'lead', 'solo', 'piccolo', 'bsn', 'acc'];
    const HAR = o.har || ['str', 'choir', 'oo', 'pad', 'low', 'drone', 'horns', 'brass'];
    const r = await renderMusic(name, seconds, { seed: o.seed ?? 7, log: true });
    const mel = r.log.filter((e) => MEL.includes(e[1])), har = r.log.filter((e) => HAR.includes(e[1]));
    let clash = 0, melSec = 0; const worst = [];
    for (const [, mi, mt, mm, md] of mel) {
      melSec += md;
      for (const [, hi, ht, hm, hd] of har) {
        const ov = Math.min(mt + md, ht + hd) - Math.max(mt, ht);
        if (ov < 0.2) continue;
        const ic = ((mm - hm) % 12 + 12) % 12;
        if (ic === 1 || ic === 11) { clash += ov; if (worst.length < 12) worst.push([+mt.toFixed(1), mi, mm, hi, hm, +ov.toFixed(2)]); }
      }
    }
    return { name, melodySeconds: +melSec.toFixed(1), clashSeconds: +clash.toFixed(2), perMin: +(clash / Math.max(1, melSec) * 60).toFixed(2), worst };
  },
  // Stem balancing: move each stem toward targets[name] (dB relative to the full mix while it plays) → MIX row.
  async autoMix(name, targets, seconds = 90, o = {}) {
    const st = await this.stems(name, seconds, o), cur = MIX[name] || {}, gains = {};
    for (const [n, s] of Object.entries(st.stems)) {
      if (s.rel == null) { gains[n] = cur[n] ?? 1; continue; }
      const t = targets[n] ?? targets._default ?? -10;
      gains[n] = +((cur[n] ?? 1) * Math.pow(10, Math.max(-9, Math.min(9, t - s.rel)) / 20)).toFixed(3);
    }
    return { gains, rel: Object.fromEntries(Object.entries(st.stems).map(([k, v]) => [k, v.rel])), mix: st.mix };
  },
  // track loudness: integrated LUFS over `seconds` (music bus, volume 1) → TRACK_GAIN entry for `target`
  async trackGain(name, target = -20, seconds = 90, o = {}) {
    const r = await renderMusic(name, seconds, { seed: o.seed ?? 7, log: false });
    const a = analyze(r.buf), cur = TRACK_GAIN[name] ?? 1;
    return { name, lufs: a.lufs, peak: a.peakDb, gain: +(cur * Math.pow(10, (target - a.lufs) / 20)).toFixed(3) };
  },
  MIX, TRACK_GAIN,
  // per-instrument stems: loudness of each instrument alone relative to the full mix while it plays
  async stems(name, seconds = 40, o = {}) {
    const oac = new OfflineAudioContext(2, 4800, 48000), a = new Engine(); a.init({ context: oac });
    const mu = a._mus(); await mu.prepare(name);
    const tr = TRACKS[name].make(mu, name, 0, o.seed ?? 7), names = Object.keys(tr.inst); tr.dispose();
    const full = await renderMusic(name, seconds, { seed: o.seed ?? 7, log: false });
    const fa = analyze(full.buf), pm = blockPower(full.buf);
    const res = { mix: { lufs: fa.lufs, peak: fa.peakDb, bands: Object.values(fa.bands).join('/') }, stems: {} };
    for (const n of names) {
      const r = await renderMusic(name, seconds, { seed: o.seed ?? 7, log: false, solo: [n] });
      const an = analyze(r.buf), ps = blockPower(r.buf), mx = Math.max(...ps);
      let es = 0, em = 0, k = 0; ps.forEach((p, i) => { if (p > mx * 0.01) { es += p; em += pm[i]; k++; } });
      res.stems[n] = { lufs: an.lufs, rel: k ? +(10 * Math.log10(es / em)).toFixed(1) : null, active: +(k / ps.length).toFixed(2), bands: Object.values(an.bands).join('/') };
    }
    return res;
  },
  // Loudness calibration: momentary-max loudness (raw path, limiter bypassed) averaged over seeds → gain table.
  async calibrate(targets, { seeds = [1, 2, 3] } = {}) {
    const out = {}, meas = {};
    for (const [n, target] of Object.entries(targets)) {
      if (!SFX[n]) continue;
      let p = 0;
      for (const seed of seeds) { const a = analyze(await renderSound(n, { dur: SFX_DUR(n), raw: true, seed })); p += Math.pow(10, a.mMax / 10); }
      const m = 10 * Math.log10(p / seeds.length);
      out[n] = +((SFX[n].gain ?? 1) * Math.pow(10, (target - m) / 20)).toFixed(3); meas[n] = +m.toFixed(1);
    }
    return { gains: out, measured: meas };
  },
  // Instrument bench: render notes on one instrument. play(tr, inst) schedules notes relative to t0 (tr.t0).
  //   await L.bench('Ens', { patch: 'strings' }, (tr, i, t) => i.note(t, 57, 2, 0.6), 4)
  async bench(cls, opts, play, seconds = 4, o = {}) {
    const SR = 48000, oac = new OfflineAudioContext(2, SR * (seconds + 0.6), SR), a = new Engine(); a.init({ context: oac, seed: 3, raw: !!o.raw });
    const mu = a._mus(), tr = new Track(mu, 'bench', 0.6, o.seed ?? 5);
    tr.tempo(o.bpm || 60, 4);
    const inst = tr.I('x', INSTR[cls], opts);
    await Promise.all(tr.pending);
    tr.restart(0.6); tr.fadeIn(0.6, 0.01);
    play(tr, inst, 0.6);
    const t0 = performance.now(); const buf = await oac.startRendering(); const ms = performance.now() - t0;
    const out = new AudioBuffer({ numberOfChannels: 2, length: buf.length - SR * 0.6, sampleRate: SR });
    for (let c = 0; c < 2; c++) out.copyToChannel(buf.getChannelData(c).subarray(SR * 0.6), c);
    const res = { cls, cpuPct: +(ms / (seconds * 10)).toFixed(2), ...analyze(out) };
    if (o.png) res.png = spectrogram(out, { w: o.w || 1000, h: o.h || 300, title: cls + ' ' + (opts.patch || opts.kind || ''), fmax: 16000 }).toDataURL('image/png');
    if (o.wav) res.wav = b64(toWav(out));
    return res;
  },
};
