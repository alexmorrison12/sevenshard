// Terse builders for skill timelines (see runner.js) and hit shapes, so class kits read like design docs.
const DEG = Math.PI / 180;
export const A = (t, name, dur, o = {}) => ({ t, a: 'anim', name, dur, ...o });
export const H = (t, spec) => ({ t, a: 'hit', ...spec });
export const FX = (t, preset, o = {}) => ({ t, a: 'fx', preset, ...o });
export const S = (t, name) => ({ t, a: 'sfx', name });
export const K = (t, v) => ({ t, a: 'shake', v });
export const M = (t, kind, dist, dur, o = {}) => ({ t, a: 'move', kind, dist, dur, ...o });
export const P = (t, spec) => ({ t, a: 'proj', ...spec });
export const Z = (t, spec) => ({ t, a: 'zone', ...spec });
export const B = (t, spec) => ({ t, a: 'buff', ...spec });
export const T = (t, spec) => ({ t, a: 'tele', ...spec });
export const C = (t, fn) => ({ t, a: 'call', fn });
// shapes
export const circle = (r, off = 0) => ({ shape: 'circle', r, off });
export const cone = (r, deg = 90, off = 0) => ({ shape: 'cone', r, angle: deg * DEG, off });
export const rect = (len, width, off = 0) => ({ shape: 'rect', len, width, off });
export const donut = (r, inner, off = 0) => ({ shape: 'donut', r, inner, off });
export const all = () => ({ shape: 'all' });
/** repeat a hit n times every dt starting at t (multi-hit skills) */
export function hits(n, t, dt, spec) { return Array.from({ length: n }, (_, i) => H(t + i * dt, { ...spec, coef: spec.coef / n, stagger: (spec.stagger || 0) / n })); }
