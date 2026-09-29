// Class palettes and background helpers shared by the icon painters.
import { shade, mix, sat } from './core.js';

/** Per-class skill palette. bg = [light, mid, dark] backdrop; main = dominant hue; hot = white-hot tint; alt = accent. */
export const PAL = {
  reaver: { bg: ['#8e1c22', '#3a070b', '#080102'], main: '#ff2e3e', hot: '#ffc0b0', alt: '#c8d4e2', ember: '#ff7a2a', metal: 'steel' },
  oathkeeper: { bg: ['#b8903c', '#3a2a10', '#060508'], main: '#ffd25a', hot: '#fffbe8', alt: '#8ecaff', ember: '#ffe9a8', metal: 'silver' },
  stormfist: { bg: ['#2a6cb4', '#0c2448', '#02050c'], main: '#46b6ff', hot: '#e8f8ff', alt: '#ffae2e', ember: '#ffe08a', metal: 'steel' },
  pistoleer: { bg: ['#8e5c2c', '#2e1c0e', '#060403'], main: '#ff8a1e', hot: '#fff0c0', alt: '#d8a24a', ember: '#ffcc60', metal: 'brass', smoke: '#8a8a90' },
  starcaller: { bg: ['#6c3cb4', '#221044', '#04020c'], main: '#a86aff', hot: '#f4e8ff', alt: '#7ad8ff', ember: '#ff6a20', metal: 'silver' },
  songweaver: { bg: ['#b86e70', '#3a1a2a', '#070309'], main: '#f5a890', hot: '#fff4ec', alt: '#36d8c6', ember: '#ffd0a0', metal: 'rose' },
  bladedancer: { bg: ['#5c4c8e', '#1c1236', '#04030b'], main: '#b072ff', hot: '#f4f0ff', alt: '#dce4f0', ember: '#e0b0ff', metal: 'silver' },
  demonbound: { bg: ['#4e1c50', '#180818', '#030103'], main: '#b232ff', hot: '#ffd0f0', alt: '#ff2a3a', ember: '#ff5040', metal: 'obsidian' },
  any: { bg: ['#4a5670', '#161c2c', '#040508'], main: '#9fc4ff', hot: '#ffffff', alt: '#ffd070', ember: '#ffe0a0', metal: 'steel' },
};
export const palOf = cls => PAL[cls] || PAL.any;

/** Backdrop palette [light, mid, dark] built from one hue. k = lightness (0.6 dark … 1.2 bright). */
export function hueBg(col, k = 1) {
  return [shade(sat(col, 0.85), -0.18 - (1 - k) * 0.4), shade(sat(col, 0.9), -0.7 - (1 - k) * 0.15), shade(col, -0.95)];
}
/** Mix a backdrop palette toward a hue. */
export function tintBg(pal, col, t) { return pal.map((c, i) => mix(c, shade(col, [-0.25, -0.7, -0.95][i]), t)); }
