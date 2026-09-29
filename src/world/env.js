// Lighting presets (zone.env) and a helper that applies an env to the game's lights, fog uniforms and post grade.
// Sun directions point TOWARD the sun. The game camera looks north (−Z), so a sun in the south-west throws readable
// shadows up and to the right while lighting the faces that look at the camera.
import * as THREE from 'three';
import { G } from '../engine/materials.js';
import { GRADE_DEFAULT } from '../engine/renderer.js';

const n3 = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };

export const PRESETS = {
  // warm golden afternoon: the capital's signature look
  day: {
    sunColor: 0xffeed2, sunIntensity: 3.3, sunDir: n3(-0.55, 0.66, 0.5),
    hemiSky: 0xb8d0f0, hemiGround: 0x7a6448, hemiIntensity: 1.05,
    fogColor: 0xc6d4e2, fogSunColor: 0xffe2b0, fogDensity: 0.0042, fogHeight: 0.035, fogBase: 0,
    background: 0x9fb8d4,
    grade: { exposure: 1.02, saturation: 1.12, contrast: 1.08, vignette: 0.3, warm: 0.05, cool: 0.03, lift: [0.01, 0.008, 0.02], gain: [1.02, 1.0, 0.97], bloom: 0.5, bloomRadius: 0.55, bloomThreshold: 0.9 },
    weather: 'clear', night: 0,
  },
  dusk: {
    sunColor: 0xffa45c, sunIntensity: 2.7, sunDir: n3(-0.85, 0.34, 0.25),
    hemiSky: 0x9c8ec8, hemiGround: 0x5a3a30, hemiIntensity: 0.95,
    fogColor: 0xd89a86, fogSunColor: 0xffb070, fogDensity: 0.006, fogHeight: 0.04, fogBase: 0,
    background: 0x6a4a5e,
    grade: { exposure: 1.02, saturation: 1.14, contrast: 1.1, vignette: 0.36, warm: 0.09, cool: 0.06, lift: [0.02, 0.0, 0.03], gain: [1.04, 0.98, 0.92], bloom: 0.65, bloomRadius: 0.6, bloomThreshold: 0.85 },
    weather: 'clear', night: 0.35,
  },
  night: {
    sunColor: 0x8ea2c8, sunIntensity: 1.1, sunDir: n3(0.35, 0.78, 0.5),
    hemiSky: 0x3c4a68, hemiGround: 0x221e24, hemiIntensity: 0.8,
    fogColor: 0x1a2232, fogSunColor: 0x3a4660, fogDensity: 0.007, fogHeight: 0.05, fogBase: 0,
    background: 0x0a0e18,
    grade: { exposure: 1.1, saturation: 0.94, contrast: 1.1, vignette: 0.42, warm: 0.07, cool: 0.04, lift: [0.0, 0.006, 0.02], gain: [1.0, 1.0, 1.03], bloom: 0.85, bloomRadius: 0.6, bloomThreshold: 0.8 },
    weather: 'clear', night: 1,
  },
  dungeon: {
    sunColor: 0xb8b0ff, sunIntensity: 1.5, sunDir: n3(-0.3, 0.9, 0.35),
    hemiSky: 0x5a64a8, hemiGround: 0x2a1c2a, hemiIntensity: 0.8,
    fogColor: 0x1a1830, fogSunColor: 0x4a3a6a, fogDensity: 0.01, fogHeight: 0.06, fogBase: -4,
    background: 0x0c0a16,
    grade: { exposure: 1.05, saturation: 1.1, contrast: 1.1, vignette: 0.45, warm: 0.02, cool: 0.08, lift: [0.01, 0.0, 0.03], gain: [1, 1, 1.04], bloom: 0.8, bloomRadius: 0.6, bloomThreshold: 0.8 },
    weather: 'none', night: 0.7,
  },
  // the Demon Rift: magenta-violet void light, crimson rim, black abyssal fog below the islands
  void: {
    sunColor: 0xd4c8ea, sunIntensity: 2.35, sunDir: n3(-0.45, 0.8, 0.4),
    hemiSky: 0x5a4c86, hemiGround: 0x1c1016, hemiIntensity: 0.75,
    fogColor: 0x1c0c26, fogSunColor: 0x6a2a6a, fogDensity: 0.011, fogHeight: 0.05, fogBase: -6,
    background: 0x0c0412,
    grade: { exposure: 1.12, saturation: 1.04, contrast: 1.12, vignette: 0.44, warm: 0.03, cool: 0.08, lift: [0.015, 0.0, 0.03], gain: [1.03, 0.97, 1.03], bloom: 0.9, bloomRadius: 0.62, bloomThreshold: 0.8 },
    weather: 'embers', night: 0.8,
  },
  frost: {
    sunColor: 0xf2f6ff, sunIntensity: 2.7, sunDir: n3(-0.5, 0.6, 0.55),
    hemiSky: 0x88acdc, hemiGround: 0x56668a, hemiIntensity: 1.0,
    fogColor: 0x9ab4d4, fogSunColor: 0xe0ecff, fogDensity: 0.006, fogHeight: 0.04, fogBase: 0,
    background: 0x5a7aa8,
    grade: { exposure: 0.95, saturation: 1.06, contrast: 1.13, vignette: 0.36, warm: 0.0, cool: 0.08, lift: [0.0, 0.01, 0.03], gain: [0.96, 1.0, 1.06], bloom: 0.55, bloomRadius: 0.55, bloomThreshold: 0.9 },
    weather: 'snow', night: 0.15,
  },
  volcanic: {
    sunColor: 0xff9a60, sunIntensity: 2.4, sunDir: n3(-0.5, 0.75, 0.4),
    hemiSky: 0x9a4a3a, hemiGround: 0x3a1208, hemiIntensity: 0.9,
    fogColor: 0x4a1a12, fogSunColor: 0xff7030, fogDensity: 0.01, fogHeight: 0.05, fogBase: -2,
    background: 0x1a0806,
    grade: { exposure: 1.04, saturation: 1.15, contrast: 1.12, vignette: 0.44, warm: 0.1, cool: 0.03, lift: [0.03, 0.0, 0.0], gain: [1.05, 0.97, 0.9], bloom: 0.9, bloomRadius: 0.62, bloomThreshold: 0.78 },
    weather: 'ash', night: 0.6,
  },
  // the Legion colosseum under a blood-red sky
  blood: {
    sunColor: 0xff8a6a, sunIntensity: 2.3, sunDir: n3(-0.55, 0.62, 0.45),
    hemiSky: 0xa04a5a, hemiGround: 0x2a0c0c, hemiIntensity: 0.95,
    fogColor: 0x5a1418, fogSunColor: 0xff5030, fogDensity: 0.009, fogHeight: 0.045, fogBase: -2,
    background: 0x220608,
    grade: { exposure: 1.04, saturation: 1.14, contrast: 1.14, vignette: 0.46, warm: 0.08, cool: 0.04, lift: [0.035, 0.0, 0.01], gain: [1.05, 0.95, 0.92], bloom: 0.85, bloomRadius: 0.6, bloomThreshold: 0.8 },
    weather: 'embers', night: 0.6,
  },
};

/** Build an env from a preset name plus overrides (grade merged over the preset's grade over GRADE_DEFAULT). */
export function makeEnv(preset = 'day', over = {}) {
  const P = PRESETS[preset] || PRESETS.day;
  const env = { preset, music: 'none', ambience: 'none', ...P, ...over };
  env.grade = { ...GRADE_DEFAULT, ...P.grade, ...(over.grade || {}) };
  return env;
}

const _c = new THREE.Color();
/**
 * Apply an env: { sun: DirectionalLight, hemi: HemisphereLight, scene, renderer, focus?: Vector3 }.
 * Sets light colours/intensities, the sun direction (relative to focus), the shared fog uniforms, the scene
 * background and the renderer grade. Safe to call every time the env changes (or blended by the game itself).
 */
export function applyEnv(env, { sun, hemi, scene, renderer, focus } = {}) {
  if (sun) {
    sun.color.set(env.sunColor); sun.intensity = env.sunIntensity;
    const f = focus || sun.target?.position || new THREE.Vector3();
    sun.position.set(f.x + env.sunDir[0] * 60, f.y + env.sunDir[1] * 60, f.z + env.sunDir[2] * 60);
    if (sun.target) { sun.target.position.copy(f); sun.target.updateMatrixWorld(); }
  }
  if (hemi) { hemi.color.set(env.hemiSky); hemi.groundColor.set(env.hemiGround); hemi.intensity = env.hemiIntensity; }
  G.uSunDir.value.set(env.sunDir[0], env.sunDir[1], env.sunDir[2]).normalize();
  G.uFogColor.value.set(env.fogColor);
  G.uFogSunColor.value.set(env.fogSunColor ?? env.sunColor);
  G.uFogDensity.value = env.fogDensity; G.uFogHeight.value = env.fogHeight; G.uFogBase.value = env.fogBase ?? 0;
  if (scene) scene.background = _c.set(env.background).clone();
  if (renderer) renderer.grade = { ...GRADE_DEFAULT, ...env.grade };
}
