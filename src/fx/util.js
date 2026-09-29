// Shared helpers for the FX module: colour parsing (always LINEAR rgb, HDR allowed), direction / position parsing,
// the gameplay palettes (telegraph colours, item grades, elements) and scratch objects.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const NO = Object.freeze({});
export const UP = new THREE.Vector3(0, 1, 0);

const _c = new THREE.Color();

/** Any colour → linear [r,g,b] × k. Accepts hex number, css string, THREE.Color, [r,g,b] (taken as linear, may be HDR). */
export function col(c, k = 1, out = [0, 0, 0]) {
  if (c == null || c === 'auto' || c === '') { out[0] = out[1] = out[2] = k; return out; }
  if (Array.isArray(c) || ArrayBuffer.isView(c)) { out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k; return out; }
  if (c.isColor) { out[0] = c.r * k; out[1] = c.g * k; out[2] = c.b * k; return out; }
  if (typeof c === 'string' && PAL[c]) return col(PAL[c], k, out);
  _c.set(c); out[0] = _c.r * k; out[1] = _c.g * k; out[2] = _c.b * k; return out;
}
/** true when a colour param is really given ('auto' / null / undefined mean "use the effect's own palette") */
export const hasCol = c => c !== undefined && c !== null && c !== 'auto' && c !== '';
/** Linear rgb from hex (sRGB). */
export const lin = (hex, k = 1) => col(hex, k, [0, 0, 0]);
export function lum(c) { return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722; }
/** Normalise a colour to unit luminance-ish (keeps hue, max channel = 1). */
export function hue(c, out = [0, 0, 0]) { const m = Math.max(c[0], c[1], c[2], 1e-4); out[0] = c[0] / m; out[1] = c[1] / m; out[2] = c[2] / m; return out; }

// Named colours usable anywhere a colour is accepted ('crimson', 'holy', …). Values are sRGB hex.
export const PAL = {
  crimson: 0xff2a3a, blood: 0xb0101a, fire: 0xff7a1e, ember: 0xffa040, lava: 0xff5a10, gold: 0xffc84a, holy: 0xffd97a,
  light: 0xfff2c8, frost: 0x8fd8ff, ice: 0xbdeaff, lightning: 0x9ab8ff, storm: 0x7aa6ff, chi: 0x7fe0ff, arcane: 0xc070ff,
  dark: 0x8a3cff, void: 0x5a1ab0, demon: 0xd0204a, poison: 0x8ae83a, nature: 0x7cff6a, heal: 0x6aff8a, water: 0x4ab8ff,
  music: 0xff8ad8, sand: 0xd8b070, wind: 0xd8f0ff, white: 0xffffff, shadow: 0x6a2ad0, foxfire: 0x6a8aff, rift: 0xa040ff,
  // names used by the game data (DESIGN / skills README): brass, rose, teal, silver, cyan, green + plain colour words
  brass: 0xe0b060, rose: 0xff6a9a, teal: 0x2ad8c0, silver: 0xd8e0f0, cyan: 0x5ae8ff, green: 0x5ae86a, red: 0xff3a2a,
  orange: 0xff8a2a, brown: 0x9a6a3a, yellow: 0xffe04a, blue: 0x4a8aff, purple: 0xa05aff, pink: 0xff7ad0, black: 0x1a1020, phys: 0xffd8a0, physical: 0xffd8a0,
};

// Telegraph colour language (see DESIGN §5): fill (dark translucent zone), rim (bright HDR edge).
export const TELE = {
  red: { fill: [0.95, 0.06, 0.035], rim: [3.4, 0.42, 0.18] },
  orange: { fill: [1.0, 0.32, 0.02], rim: [3.6, 1.35, 0.22] },
  blue: { fill: [0.06, 0.32, 1.0], rim: [0.55, 1.7, 4.2] },
  purple: { fill: [0.46, 0.06, 1.0], rim: [2.1, 0.6, 4.0] },
  yellow: { fill: [1.0, 0.78, 0.08], rim: [3.4, 2.7, 0.7] },
  white: { fill: [0.75, 0.78, 0.85], rim: [2.8, 2.9, 3.1] },
};

// Item grades (DESIGN §6): common … primal. Ancient is a cream→gold gradient (second colour).
export const GRADES = [
  { name: 'common', c: 0xe8e8e8 }, { name: 'uncommon', c: 0x8bd96b }, { name: 'rare', c: 0x4fa3ff }, { name: 'epic', c: 0xb86bff },
  { name: 'legendary', c: 0xffae3a }, { name: 'relic', c: 0xff6a2a }, { name: 'ancient', c: 0xe9d2a6, c2: 0xffb84a }, { name: 'primal', c: 0x39e6d8 },
];
export function gradeOf(g) {
  if (typeof g === 'string') { const i = GRADES.findIndex(x => x.name === g); return Math.max(0, i); }
  return Math.max(0, Math.min(7, g | 0));
}

// Elements used by hit()/burst(): main colour, hot core colour and the particle "family".
export const ELEM = {
  physical: { c: [1.0, 0.82, 0.55], core: [1.6, 1.45, 1.2], fam: 'spark' },
  slash: { c: [1.0, 0.85, 0.6], core: [1.6, 1.5, 1.3], fam: 'spark' },
  crimson: { c: [1.0, 0.1, 0.12], core: [1.8, 0.7, 0.55], fam: 'spark' },
  blood: { c: [0.7, 0.03, 0.04], core: [1.4, 0.3, 0.25], fam: 'blood' },
  fire: { c: [1.0, 0.42, 0.08], core: [1.8, 1.25, 0.6], fam: 'fire' },
  frost: { c: [0.35, 0.72, 1.0], core: [1.2, 1.6, 1.9], fam: 'frost' },
  ice: { c: [0.35, 0.72, 1.0], core: [1.2, 1.6, 1.9], fam: 'frost' },
  lightning: { c: [0.45, 0.62, 1.0], core: [1.4, 1.6, 2.0], fam: 'lightning' },
  holy: { c: [1.0, 0.78, 0.32], core: [1.8, 1.65, 1.2], fam: 'holy' },
  light: { c: [1.0, 0.85, 0.5], core: [1.8, 1.7, 1.4], fam: 'holy' },
  dark: { c: [0.55, 0.16, 1.0], core: [1.3, 0.8, 1.8], fam: 'dark' },
  shadow: { c: [0.55, 0.16, 1.0], core: [1.3, 0.8, 1.8], fam: 'dark' },
  demon: { c: [0.9, 0.08, 0.2], core: [1.6, 0.55, 0.9], fam: 'dark' },
  arcane: { c: [0.78, 0.3, 1.0], core: [1.5, 1.1, 1.9], fam: 'arcane' },
  chi: { c: [0.35, 0.85, 1.0], core: [1.4, 1.8, 1.9], fam: 'lightning' },
  water: { c: [0.25, 0.65, 1.0], core: [1.2, 1.6, 1.9], fam: 'water' },
  poison: { c: [0.45, 1.0, 0.15], core: [1.3, 1.8, 0.8], fam: 'poison' },
  nature: { c: [0.4, 1.0, 0.35], core: [1.4, 1.9, 1.2], fam: 'holy' },
  music: { c: [1.0, 0.45, 0.85], core: [1.9, 1.5, 1.8], fam: 'arcane' },
  earth: { c: [0.75, 0.55, 0.32], core: [1.4, 1.2, 0.9], fam: 'spark' },
  sand: { c: [0.85, 0.66, 0.38], core: [1.5, 1.3, 1.0], fam: 'spark' },
  wind: { c: [0.8, 0.95, 1.0], core: [1.6, 1.8, 1.9], fam: 'spark' },
};
export function elemOf(e) { return ELEM[e] || ELEM.physical; }

// ------------------------------------------------------------------ parsing
const _o = new THREE.Vector3();
/** Position-ish → Vector3 (Vector3, [x,y,z], {x,y,z}, Object3D = its world position). */
export function v3(p, out = new THREE.Vector3()) {
  if (!p) return out.set(0, 0, 0);
  if (p.isObject3D) return p.getWorldPosition(out);
  if (Array.isArray(p)) return out.set(p[0] || 0, p[1] || 0, p[2] || 0);
  return out.set(p.x || 0, p.y || 0, p.z || 0);
}
/**
 * Direction-ish → unit HORIZONTAL Vector3. Accepts Vector3 / {x,z} / [x,z] / [x,y,z] / number (facing yaw:
 * forward = (−sin f, 0, −cos f), the model convention). Falls back to north (−Z).
 */
export function dirOf(d, out = new THREE.Vector3()) {
  if (d == null) return out.set(0, 0, -1);
  if (typeof d === 'number') return out.set(-Math.sin(d), 0, -Math.cos(d));
  if (Array.isArray(d)) { if (d.length === 2) out.set(d[0], 0, d[1]); else out.set(d[0], 0, d[2]); }
  else if (d.isObject3D) { d.getWorldDirection(_o); out.set(-_o.x, 0, -_o.z); }
  else out.set(d.x || 0, 0, d.z || 0);
  const l = Math.hypot(out.x, out.z);
  if (l < 1e-6) return out.set(0, 0, -1);
  return out.multiplyScalar(1 / l);
}
/** Full 3D direction (not flattened). */
export function dir3(d, out = new THREE.Vector3()) {
  if (d == null) return out.set(0, 0, -1);
  if (typeof d === 'number') return out.set(-Math.sin(d), 0, -Math.cos(d));
  if (Array.isArray(d)) out.set(d[0], d.length === 2 ? 0 : d[1], d.length === 2 ? d[1] : d[2]);
  else out.set(d.x || 0, d.y || 0, d.z || 0);
  const l = out.length();
  return l < 1e-6 ? out.set(0, 0, -1) : out.multiplyScalar(1 / l);
}
export const yawOf = d => Math.atan2(-d.x, -d.z);

// seeded-ish fast random (Math.random is fine for visuals; kept in one place for reproducible labs)
let _seed = 1234567;
export function rnd() { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; }
export function seedRnd(s) { _seed = s >>> 0; }
export const rr = (a, b) => a + (b - a) * rnd();
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// premultiplied-alpha blending: rgb added, alpha occludes (one draw call can mix additive + alpha-blended content)
export const PREMUL = {
  transparent: true, depthWrite: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
};

// shared GLSL snippets
export const GLSL_NOISE = /* glsl */`
float sq(float x){ return x * x; }
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float h11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float fbm3o(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { s += a * vn2(p); p = p * 2.07 + 11.3; a *= 0.5; } return s; }
`;
// ground height: terrain height texture when the world provides one (G.uHeightTex), else a flat plane
export const GLSL_GROUND = /* glsl */`
uniform sampler2D uHeightTex; uniform vec4 uHeightInfo; uniform float uHasHeight; uniform float uGroundY;
float groundH(vec2 xz, float fallback) {
  if (uHasHeight > 0.5) return texture2D(uHeightTex, (xz - uHeightInfo.zw + 0.5) / uHeightInfo.xy).r;
  return fallback;
}
`;
