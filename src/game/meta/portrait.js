// Character portrait for the profile share card: the hero model rendered in a small, separate WebGL context with a
// studio light rig (key, class-coloured rim, fill, sky/ground), transparent background, then copied to a 2D canvas
// and the context released. The game's shared material uniforms (height fog, camera position) are neutralised for
// the one synchronous render and restored right after, so the running game is untouched.
import * as THREE from 'three';
import { createHero } from '../../models/hero/index.js';
import { G } from '../../engine/materials.js';
import { cls as clsInfo } from '../../ui/core/data.js';

export const portraitDebug = {};
const gearTier = c => { const s = c?.equip?.chest?.set || c?.equip?.weapon?.set; return s === 'horned' ? 2 : s === 'vanguard' ? 1 : 0; };

/**
 * heroPortrait(char, { w, h, pose, turn }) → Promise<HTMLCanvasElement | null>
 * char: a character record (cls, sex, look, equip, gear.lookTier/dye) — null when WebGL is unavailable or it fails.
 */
export async function heroPortrait(char, { w = 520, h = 760, pose = null, turn = 0.5, fill = 0.9 } = {}) {
  if (typeof document === 'undefined' || !char) return null;
  let r = null, hero = null;
  const fog = G.uFogDensity.value, cam = G.uCamPos.value.clone(), desat = G.uDesat?.value;
  try {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    r.setPixelRatio(1); r.setSize(w, h, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const tier = char.gear?.lookTier ?? gearTier(char);
    hero = createHero({ cls: char.cls, sex: char.sex || 'm', look: char.look || {}, gear: { tier, dye: char.gear?.dye || null }, weapon: { tier: gearTier(char), hone: char.equip?.weapon?.hone || 0 }, lod: 'full', seed: 3 });
    scene.add(hero.root);
    hero.root.rotation.y = Math.PI - turn;      // models face −Z: turn toward the camera, three-quarter view
    const col = new THREE.Color(clsInfo(char.cls).color || '#c9a45a');
    scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2230, 1.05));
    const key = new THREE.DirectionalLight(0xfff0dc, 3.0); key.position.set(-2.2, 3.4, 4.2); scene.add(key);
    const rim = new THREE.DirectionalLight(col, 5.5); rim.position.set(2.6, 2.4, -3.4); scene.add(rim);
    const rim2 = new THREE.DirectionalLight(0x9ab8ff, 2.2); rim2.position.set(-3, 1.6, -2.8); scene.add(rim2);
    const lamp = new THREE.PointLight(0xffd8b0, 6, 8); lamp.position.set(0.6, 0.7, 2.6); scene.add(lamp);
    // pose: settle into the weapon-drawn combat stance (optionally play an action and hold a good frame)
    const st = { speed: 0, turn: 0, combat: true };
    for (let i = 0; i < 45; i++) hero.update(1 / 30, st);
    if (pose) { const p = hero.play?.(pose, { dur: 1.6 }); const hold = p?.dur ? p.dur * 0.62 : 0.8; for (let t = 0; t < hold; t += 1 / 30) hero.update(1 / 30, st); }
    // frame the posed silhouette (weapon included): fit its height to `fill` of the frame
    hero.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(hero.root, true);
    const H0 = hero.height || 1.85;
    if (!isFinite(box.min.y) || box.max.y - box.min.y < 0.5) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, H0, 0.5));
    box.min.y = Math.min(box.min.y, 0);
    portraitDebug.box = [box.min.toArray(), box.max.toArray()];
    const fov = 24, camera = new THREE.PerspectiveCamera(fov, w / h, 0.1, 60);
    const ch = box.max.y - box.min.y, cw = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    const vfit = ch / fill / 2 / Math.tan(fov * Math.PI / 360), hfit = cw / fill / 2 / Math.tan(fov * Math.PI / 360) / (w / h);
    const dist = Math.max(vfit, hfit) + cw * 0.3, cy = (box.min.y + box.max.y) / 2;
    const cx = (box.min.x + box.max.x) / 2;
    camera.position.set(cx + dist * 0.08, cy + ch * 0.06, dist);
    camera.lookAt(cx, cy, 0);
    G.uFogDensity.value = 0; G.uCamPos.value.copy(camera.position); if (G.uDesat) G.uDesat.value = 0;
    r.render(scene, camera);
    portraitDebug.cam = camera.position.toArray(); portraitDebug.tris = r.info.render.triangles; portraitDebug.calls = r.info.render.calls;
    let nm = 0; hero.root.traverse(o => { if (o.isMesh) nm++; }); portraitDebug.meshes = nm;
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    out.getContext('2d').drawImage(canvas, 0, 0);
    return out;
  } catch (e) {
    console.warn('[meta portrait]', e);
    return null;
  } finally {
    G.uFogDensity.value = fog; G.uCamPos.value.copy(cam); if (G.uDesat && desat != null) G.uDesat.value = desat;
    try { hero?.dispose?.(); } catch { /* */ }
    try { r?.dispose(); r?.forceContextLoss?.(); } catch { /* */ }
  }
}
