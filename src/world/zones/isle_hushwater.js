// 'isle_hushwater' — Hushwater Lagoon: a high rocky ring (cliffs, a waterfall) around a lagoon so calm the stars can
// see themselves. A jetty runs from the south beach across the wading shallows (pearl beds bubble there) to Coralie's
// rock. The lagoon glows teal at night. Anchors: spawn, dock:ship, npc:mermaid, npc:diver, bed:0…4, jetty,
// seed:1 (→ seed:islands:9), vista.
import { registerZone } from '../index.js';
import { buildIsle } from '../sea/islezone.js';
import * as S from '../shapes.js';
import * as P from '../props.js';
import * as THREE from 'three';
import { ISLE_TERRAIN } from '../sea/isles.js';
import { G } from '../../engine/materials.js';

const FALLS_VS = /* glsl */`
varying vec2 vUv; varying float vH;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vH = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FALLS_FS = /* glsl */`
uniform float uTime; uniform float uGlow;
varying vec2 vUv; varying float vH;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float y = vUv.y, t = uTime;
  float s1 = noise(vec2(vUv.x * 14.0, y * 2.2 + t * 1.9)), s2 = noise(vec2(vUv.x * 34.0 + 7.0, y * 5.0 + t * 3.3)), s3 = noise(vec2(vUv.x * 70.0, y * 9.0 + t * 5.0));
  float streak = s1 * 0.5 + s2 * 0.35 + s3 * 0.15;
  float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
  float lip = smoothstep(1.0, 0.94, y);
  float a = edge * lip * (0.35 + 0.65 * smoothstep(0.25, 0.75, streak));
  vec3 deep = mix(vec3(0.30, 0.62, 0.68), vec3(0.25, 0.85, 0.80), uGlow), foam = vec3(0.92, 0.98, 1.0);
  vec3 col = mix(deep, foam, smoothstep(0.45, 0.8, streak) * 0.85 + (1.0 - y) * 0.25);
  col *= 0.8 + uGlow * 0.35;
  if (a < 0.02) discard;
  gl_FragColor = vec4(col, a * 0.92);
}`;
const FOAM_FS = /* glsl */`
uniform float uTime; uniform float uGlow;
varying vec2 vUv; varying float vH;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vUv - 0.5; float r = length(p) * 2.0, a = atan(p.y, p.x);
  float n = noise(vec2(a * 5.0, r * 6.0 - uTime * 1.6)) * 0.6 + noise(vec2(a * 11.0, r * 14.0 - uTime * 2.4)) * 0.4;
  float k = smoothstep(1.0, 0.35, r) * smoothstep(0.35, 0.65, n);
  if (k < 0.02) discard;
  gl_FragColor = vec4(vec3(0.9, 0.97, 1.0) * (0.9 + uGlow * 0.5), k * 0.85);
}`;
/** the waterfall in the northern cleft: a sheet that follows the cliff face, scrolling streaks, a foam pool */
function buildFalls(zone, fx, fz) {
  const T = ISLE_TERRAIN.hushwater, H = (x, z) => T.height(x, z);
  let lipZ = fz, top = -1;
  for (let z = fz + 6; z > fz - 12; z -= 0.25) { const h = H(fx, z); if (h > top) { top = h; lipZ = z; } }
  const rows = 18, w0 = 1.5, geo = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  let z = lipZ;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows, y = top + 0.15 - (top + 0.5) * t;
    while (z < lipZ + 20 && H(fx, z) > y - 0.2) z += 0.1;                // stay just in front of the rock face
    const zz = z + 0.35 + t * t * 0.8, w = w0 + t * 0.6;
    pos.push(fx - w, y, zz, fx + w, y, zz); uv.push(0, 1 - t, 1, 1 - t);
    if (j < rows) { const b = j * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const u = { uTime: G.uTime, uGlow: { value: 0 } };
  const sheet = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: FALLS_VS, fragmentShader: FALLS_FS, uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  sheet.renderOrder = 4; sheet.name = 'falls';
  const foam = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), new THREE.ShaderMaterial({ vertexShader: FALLS_VS, fragmentShader: FOAM_FS, uniforms: u, transparent: true, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(fx, 0.06, z + 1.2); foam.renderOrder = 4;
  zone.root.add(sheet, foam);
  zone.onEnv(env => { u.uGlow.value = env.night || 0; });
  return { top, lipZ, baseZ: z };
}

export async function build(zone, o = {}) {
  let spots;
  await buildIsle(zone, 'hushwater', {
    paint(g) {
      g.paint('sand', S.rect(0, 12, 34, 22), { soft: 2, noise: 1.5, nscale: 3 });
      g.paint('gravel', S.line([[-4, 42], [-4, 30], [0, 22]], 2.6), { soft: 1, noise: 0.8, nscale: 2 });
    },
    decorate(c) {
      const { kit, flora, H, rng, dec } = c;
      spots = c.spots;
      // jetty deck to the mermaid's rock
      const J = c.spots.jettyDeck; c.zone.deck(S.rect(J[0], J[2], J[4], J[3]), J[1]);
      for (let i = 0; i < 90; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(28, 40), x = Math.cos(a) * r, z = -4 + Math.sin(a) * r, y = H(x, z); if (y < 2 || z > 20) continue; flora.flower(x, y, z, rng.pick([0xff8ab0, 0xffffff, 0x7ad8ff, 0xf4d040])); }
      for (let i = 0; i < 12; i++) dec.add(rng.pick(['pebbles', 'moss', 'petals']), rng.range(-16, 16), rng.range(14, 28), { size: rng.range(1, 2), alpha: 0.7 });
      P.net(kit, -9, H(-9, 19) + 0.02, 19, 0.3); P.fishBasket(kit, -6.5, H(-6.5, 18), 18, 0.4); P.ropeCoil(kit, 5, H(5, 20), 20, 1);
      c.anchor('npc:mermaid', 2.3, -4.1, Math.PI * 0.85); c.anchors['npc:mermaid'].extra = { free: true };
      c.anchor('npc:diver', -7.5, 17.5, Math.PI * 0.9);
      [[-11, 7], [-5, 11.5], [7, 10], [12, 5], [-14, 2]].forEach(([x, z], i) => c.anchor('bed:' + i, x, z + 1.2, 0));
      c.anchor('jetty', 0, -3, 0);
      c.anchor('seed:1', -31, -2, 0);
      c.anchor('vista', 24, -22, 0);
    },
    nav(nav, c) { const J = c.spots.jettyDeck; nav.walk(S.rect(J[0], J[2], J[4] - 0.6, J[3])); },
    water: { glint: 1.1, glowArea: [0, -4, 27] },
    particles: 'fireflies',
  }, o);
  zone.onEnv(env => { zone.sea.ocean.uniforms.uGlow.value = (env.night || 0) * 0.42 + 0.05; });
  const f = zone.spots?.falls; if (f) zone.falls = buildFalls(zone, f[0], f[2]);
}
registerZone('isle_hushwater', { name: 'Hushwater Lagoon', kind: 'island', size: 200 }, build);
