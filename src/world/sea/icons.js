// Painted icons for ship skills, sea supplies and crew roles (the HUD accepts data: URLs as icon ids).
//   seaIcon('full_sail') → 'data:image/png;base64,…' (128 px, cached)
const CACHE = new Map();
const TAU = Math.PI * 2;

function bg(x, c1, c2) {
  const g = x.createRadialGradient(40, 34, 6, 64, 64, 92); g.addColorStop(0, c1); g.addColorStop(1, c2);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  // bevel
  const b = x.createLinearGradient(0, 0, 0, 128); b.addColorStop(0, 'rgba(255,255,255,0.18)'); b.addColorStop(0.5, 'rgba(255,255,255,0)'); b.addColorStop(1, 'rgba(0,0,0,0.35)');
  x.fillStyle = b; x.fillRect(0, 0, 128, 128);
}
function vignette(x) { const g = x.createRadialGradient(64, 64, 40, 64, 64, 92); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
function glow(x, c, b = 14) { x.shadowColor = c; x.shadowBlur = b; }
function noGlow(x) { x.shadowBlur = 0; }
function metal(x, a, b) { const g = x.createLinearGradient(20, 20, 108, 108); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, a); g.addColorStop(1, b); return g; }
function waves(x, y, col = 'rgba(160,220,255,0.8)', w = 4) {
  x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round';
  for (let k = 0; k < 2; k++) { x.beginPath(); for (let i = 0; i <= 128; i += 4) { const yy = y + k * 12 + Math.sin(i * 0.12 + k) * 4; i ? x.lineTo(i, yy) : x.moveTo(i, yy); } x.stroke(); }
}
function sail(x, cx, cy, s, belly = 1, col = '#f6ecd0') {
  x.fillStyle = col; x.strokeStyle = '#5a3a1a'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(cx - 26 * s, cy - 30 * s); x.quadraticCurveTo(cx - 8 * s + 22 * belly * s, cy, cx - 26 * s, cy + 30 * s); x.lineTo(cx + 22 * s, cy + 30 * s); x.quadraticCurveTo(cx + 36 * s + 18 * belly * s, cy, cx + 22 * s, cy - 30 * s); x.closePath(); x.fill(); x.stroke();
}
function hull(x, cx, cy, s = 1) {
  x.fillStyle = '#7a4a24'; x.strokeStyle = '#2a1608'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(cx - 44 * s, cy - 6 * s); x.lineTo(cx + 44 * s, cy - 6 * s); x.lineTo(cx + 32 * s, cy + 14 * s); x.lineTo(cx - 34 * s, cy + 14 * s); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#2a4a86'; x.fillRect(cx - 40 * s, cy - 4 * s, 80 * s, 5 * s);
}
const P = {
  full_sail(x) { bg(x, '#4a8ad0', '#0a1a3a'); waves(x, 100); glow(x, '#ffe6a0', 16); x.fillStyle = '#6a4a2a'; x.fillRect(60, 14, 7, 90); sail(x, 64, 56, 1, 1.4); noGlow(x); x.fillStyle = '#e8b030'; x.beginPath(); x.arc(64, 56, 10, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(8, 36 + i * 18); x.lineTo(30, 36 + i * 18); x.stroke(); } },
  repair(x) { bg(x, '#c08a4a', '#2a1406'); x.save(); x.translate(64, 64); x.rotate(-0.6);
    x.fillStyle = metal(x, '#d8a060', '#7a4a1a'); x.fillRect(-42, -12, 84, 24); x.strokeStyle = '#3a2008'; x.lineWidth = 3; x.strokeRect(-42, -12, 84, 24); for (let i = -30; i <= 30; i += 20) { x.fillStyle = '#2a2a2a'; x.beginPath(); x.arc(i, 0, 3.4, 0, TAU); x.fill(); } x.restore();
    x.save(); x.translate(70, 58); x.rotate(0.7); glow(x, 'rgba(255,220,150,0.8)', 10); x.fillStyle = '#6a4424'; x.fillRect(-5, -8, 10, 56); x.fillStyle = metal(x, '#c8ccd4', '#4a4e58'); x.fillRect(-20, -22, 40, 16); noGlow(x); x.restore();
    x.fillStyle = 'rgba(140,255,160,0.9)'; x.font = 'bold 34px Georgia'; x.fillText('+', 16, 42); },
  volley(x) { bg(x, '#c85a2a', '#240804'); glow(x, '#ffb040', 20); x.fillStyle = '#ffd070'; x.beginPath(); x.arc(92, 44, 16, 0, TAU); x.fill(); noGlow(x);
    x.save(); x.translate(56, 72); x.rotate(-0.45); x.fillStyle = metal(x, '#8a8e98', '#1a1c22'); x.fillRect(-36, -12, 60, 24); x.beginPath(); x.arc(24, 0, 14, 0, TAU); x.fill(); x.restore();
    x.fillStyle = '#5a3a1e'; x.beginPath(); x.arc(38, 96, 14, 0, TAU); x.fill(); x.strokeStyle = '#2a1408'; x.lineWidth = 3; x.stroke();
    x.fillStyle = 'rgba(200,200,200,0.6)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(100 + i * 4, 30 - i * 5, 6 + i * 2, 0, TAU); x.fill(); } },
  brace(x) { bg(x, '#3a8a9a', '#04161c'); glow(x, '#80e8ff', 18); x.fillStyle = 'rgba(120,230,255,0.35)'; x.beginPath(); x.arc(64, 70, 48, Math.PI, 0); x.fill(); x.strokeStyle = '#bff4ff'; x.lineWidth = 5; x.beginPath(); x.arc(64, 70, 48, Math.PI, 0); x.stroke(); noGlow(x); hull(x, 64, 84, 0.9); waves(x, 104, 'rgba(160,230,255,0.7)', 3); },
  harpoon(x) { bg(x, '#5a7a9a', '#0a141e'); x.save(); x.translate(64, 64); x.rotate(-0.78); x.fillStyle = '#7a5a36'; x.fillRect(-4, -46, 8, 80); x.fillStyle = metal(x, '#e8eaf0', '#5a5e68'); x.beginPath(); x.moveTo(0, -60); x.lineTo(12, -38); x.lineTo(0, -44); x.lineTo(-12, -38); x.closePath(); x.fill(); x.restore(); x.strokeStyle = '#d8c89a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(40, 88); x.bezierCurveTo(20, 110, 70, 118, 96, 104); x.stroke(); },
  spyglass(x) { bg(x, '#7a6aa8', '#120a22'); x.save(); x.translate(64, 64); x.rotate(-0.5); x.fillStyle = metal(x, '#f0c870', '#6a4a14'); x.fillRect(-46, -9, 40, 18); x.fillRect(-10, -12, 30, 24); x.fillRect(18, -15, 26, 30); x.restore(); glow(x, '#ffffff', 16); x.fillStyle = '#e8f4ff'; x.beginPath(); x.arc(96, 38, 7, 0, TAU); x.fill(); noGlow(x); },
  chainshot(x) { bg(x, '#8a4a5a', '#1a060a'); x.fillStyle = metal(x, '#9aa0a8', '#23262c'); x.beginPath(); x.arc(34, 70, 16, 0, TAU); x.fill(); x.beginPath(); x.arc(94, 54, 16, 0, TAU); x.fill(); x.strokeStyle = '#c8ccd4'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { const t = i / 6, cx = 46 + t * 36, cy = 66 - t * 10; x.beginPath(); x.ellipse(cx, cy, 6, 3.5, -0.3, 0, TAU); x.stroke(); } },
  salvage(x) { bg(x, '#4a9a7a', '#04160e'); x.strokeStyle = metal(x, '#e0e4ea', '#50545c'); x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(64, 12); x.lineTo(64, 70); x.arc(46, 70, 18, 0, Math.PI * 0.9); x.stroke(); x.fillStyle = '#b8864a'; x.fillRect(58, 88, 40, 26); x.strokeStyle = '#3a200a'; x.lineWidth = 3; x.strokeRect(58, 88, 40, 26); },
  stew(x) { bg(x, '#c8903a', '#241404'); x.fillStyle = '#3a3a3e'; x.beginPath(); x.ellipse(64, 76, 40, 26, 0, 0, Math.PI); x.fill(); x.fillStyle = '#c86a2a'; x.beginPath(); x.ellipse(64, 74, 38, 10, 0, 0, TAU); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(46 + i * 18, 60); x.bezierCurveTo(40 + i * 18, 46, 54 + i * 18, 40, 46 + i * 18, 24); x.stroke(); } },
  starfix(x) { bg(x, '#3a4a9a', '#040616'); glow(x, '#ffffff', 14); x.fillStyle = '#fff6d0'; for (const [cx, cy, r] of [[40, 40, 5], [80, 30, 4], [96, 62, 5], [58, 76, 4]]) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill(); } noGlow(x); x.strokeStyle = 'rgba(255,240,200,0.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(40, 40); x.lineTo(80, 30); x.lineTo(96, 62); x.lineTo(58, 76); x.stroke(); x.strokeStyle = '#e8c060'; x.lineWidth = 4; x.beginPath(); x.arc(64, 64, 50, 0.4, 2.8); x.stroke(); },
  sunfire(x) { bg(x, '#ffb040', '#3a0c02'); glow(x, '#ffe080', 24); x.fillStyle = '#fff0b0'; x.beginPath(); x.arc(64, 60, 20, 0, TAU); x.fill(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.beginPath(); x.moveTo(64 + Math.cos(a) * 24, 60 + Math.sin(a) * 24); x.lineTo(64 + Math.cos(a + 0.12) * 44, 60 + Math.sin(a + 0.12) * 44); x.lineTo(64 + Math.cos(a - 0.12) * 44, 60 + Math.sin(a - 0.12) * 44); x.fill(); } noGlow(x); hull(x, 64, 104, 0.8); },
  gale(x) { bg(x, '#6ac8e8', '#062030'); x.strokeStyle = '#ffffff'; x.lineCap = 'round'; for (let i = 0; i < 3; i++) { x.lineWidth = 6 - i * 1.5; x.beginPath(); for (let t = 0; t < 1; t += 0.02) { const a = t * TAU * 1.3 + i * 2, r = 8 + t * 40; const X = 64 + Math.cos(a) * r, Y = 64 + Math.sin(a) * r * 0.6; t ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); } },
  repair_kit(x) { bg(x, '#6a8a4a', '#0e1606'); x.fillStyle = '#c89a5a'; x.fillRect(26, 44, 76, 50); x.strokeStyle = '#3a220a'; x.lineWidth = 4; x.strokeRect(26, 44, 76, 50); x.fillStyle = '#e04a3a'; x.fillRect(58, 52, 12, 34); x.fillRect(47, 63, 34, 12); x.fillStyle = '#5a3a1a'; x.fillRect(50, 32, 28, 12); },
  powder_keg(x) { bg(x, '#8a5a3a', '#1a0a04'); x.fillStyle = '#9a6a3a'; x.beginPath(); x.ellipse(64, 70, 30, 38, 0, 0, TAU); x.fill(); x.strokeStyle = '#2a2a2e'; x.lineWidth = 5; for (const y of [48, 92]) { x.beginPath(); x.ellipse(64, y, 28, 6, 0, 0, TAU); x.stroke(); } x.fillStyle = '#1a1a1a'; x.font = 'bold 22px Georgia'; x.textAlign = 'center'; x.fillText('XXX', 64, 78); glow(x, '#ffb040', 14); x.strokeStyle = '#ffd070'; x.lineWidth = 3; x.beginPath(); x.moveTo(64, 32); x.quadraticCurveTo(76, 18, 88, 22); x.stroke(); noGlow(x); },
  flare(x) { bg(x, '#c84a6a', '#1a0410'); glow(x, '#ff6a8a', 24); x.fillStyle = '#ffe0e8'; x.beginPath(); x.arc(64, 34, 14, 0, TAU); x.fill(); noGlow(x); x.strokeStyle = 'rgba(255,180,200,0.7)'; x.lineWidth = 4; x.beginPath(); x.moveTo(64, 110); x.quadraticCurveTo(52, 80, 64, 48); x.stroke(); },
  dock(x) { bg(x, '#5a8ab0', '#0a1624'); x.fillStyle = '#8a6a4a'; x.fillRect(20, 60, 88, 12); for (let i = 0; i < 5; i++) x.fillRect(24 + i * 20, 72, 6, 30); waves(x, 100); },
  crew(x) { bg(x, '#8a7a5a', '#140e06'); x.fillStyle = '#f0d8b0'; x.beginPath(); x.arc(64, 46, 18, 0, TAU); x.fill(); x.fillStyle = '#2a4a86'; x.fillRect(38, 66, 52, 40); x.fillStyle = '#c03a3a'; x.fillRect(40, 30, 48, 10); },
};
/** icon for a ship skill / supply / role id (unknown ids get a generic sail) */
export function seaIcon(id) {
  if (CACHE.has(id)) return CACHE.get(id);
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  try { (P[id] || P.full_sail)(x); } catch { P.full_sail(x); }
  vignette(x);
  x.strokeStyle = 'rgba(255, 230, 170, 0.55)'; x.lineWidth = 2; x.strokeRect(1, 1, 126, 126);
  const url = cv.toDataURL();
  CACHE.set(id, url);
  return url;
}
