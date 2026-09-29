// Ship materials. Both are stylized Lambert (src/engine/materials.js → shared fog, wrap lighting, rim) with vertex hooks.
// One material instance per ship (per-instance uniforms); every instance of every ship shares the same GL programs.
//
// WOOD (hull, deck, spars, ropes, cannons, lanterns, props) — attributes:
//   aux  vec4: x emissive strength (> 1.5 flickers like a flame), y plank-texture amount, z metal (gold/iron spec), w anim code
//   piv  vec3: pivot (wheel hub / rudder post / hanging point); also seeds the lantern flicker
//   anim code: 0 static · 1..24 cannon slot (recoil slides the gun inboard along X) · −1 wheel (spins about Z at piv)
//              −2 rudder (swings about Y at piv) · −3 pendulum (hangs from piv, counter-sways the hull's roll/pitch)
// SAIL (sails, flags, clew sheets) — attributes:
//   bOff vec3  billow offset at full belly (sails) | streaming direction (flags)
//   bNrm vec3  normal of the fully bellied sail (sails) | corner rest position (sheet ropes)
//   anc  vec3  furl anchor: where the vertex gathers when the sail is reefed (yard / stay / gaff)
//   sa   vec4  sails: x flutter freedom, y across 0..1, z kind (0 sail, 1 flag, 2 sheet rope), w down 0..1
//              flags: x along 0..1 (hoist → fly), y length (m), z = 1, w phase · ropes: x follow weight, z = 2
import * as THREE from 'three';
import { lambert, G, FOG_GLSL_PARS } from '../../../engine/materials.js';
import { plankTex } from './tex.js';

export const MAX_GUNS = 24;

const WOOD_VPARS = /* glsl */`
attribute vec4 aux; attribute vec3 piv;
uniform float uRecoil[${MAX_GUNS}]; uniform float uWheel; uniform float uRudder; uniform vec2 uSway;
varying vec4 vAux; varying vec3 vPiv; varying float vMetal;
vec3 gP;
vec2 rot2(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
`;
const WOOD_VNORM = /* glsl */`
vec3 objectNormal = vec3( normal );
gP = position;
{
  float code = aux.w;
  if ( code > 0.5 ) {
    int ci = int( code - 0.5 );
    gP.x -= sign( position.x ) * uRecoil[ ci ];
  } else if ( code < -0.5 ) {
    vec3 q = position - piv; vec3 nn = objectNormal;
    if ( code > -1.5 ) { q.xy = rot2( q.xy, uWheel ); nn.xy = rot2( nn.xy, uWheel ); }
    else if ( code > -2.5 ) { q.zx = rot2( q.zx, uRudder ); nn.zx = rot2( nn.zx, uRudder ); }
    else {
      float ph = fract( sin( dot( piv, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ) * 6.2831;
      float ax = uSway.x + sin( uTime * 1.6 + ph ) * 0.05;
      float az = uSway.y + sin( uTime * 1.23 + ph * 1.7 ) * 0.05;
      q.yz = rot2( q.yz, ax ); nn.yz = rot2( nn.yz, ax );
      q.xy = rot2( q.xy, az ); nn.xy = rot2( nn.xy, az );
    }
    gP = piv + q; objectNormal = nn;
  }
  vAux = aux; vPiv = piv; vMetal = aux.z;
}
`;
const WOOD_FPARS = /* glsl */`
varying vec4 vAux; varying vec3 vPiv; uniform float uGlow; uniform float uFlick;
`;

/** Per-ship wood material. o: { rim, rimColor, wrap, glow } */
export function woodMaterial(o = {}) {
  const u = {
    uRecoil: { value: new Float32Array(MAX_GUNS) }, uWheel: { value: 0 }, uRudder: { value: 0 }, uSway: { value: new THREE.Vector2() },
    uGlow: { value: o.glow ?? 1 }, uFlick: { value: o.flick ?? 1 }, uSpecK: { value: o.specK ?? 0.7 }, uWrapU: { value: o.wrap ?? 0.45 },
  };
  const m = lambert({ vertexColors: true, map: plankTex() }, {
    key: 'sevenshard-ship-wood', wrap: o.wrap ?? 0.45, rim: o.rim ?? 0.12, rimColor: o.rimColor ?? 0xfff0d8, spec: 1, shine: o.shine ?? 36, uniforms: u,
    vertex: vs => vs.replace('void main() {', WOOD_VPARS + '\nvoid main() {')
      .replace('#include <beginnormal_vertex>', WOOD_VNORM)
      .replace('#include <begin_vertex>', 'vec3 transformed = gP;'),
    fragment: fs => fs.replace('#include <common>', '#include <common>\n' + WOOD_FPARS)
      .replace('uniform float uWrap; uniform float uSpec;', 'uniform float uWrapU; uniform float uSpecK;\nvarying float vMetal;\n#define uWrap ( uWrapU * ( 1.0 - vMetal * 0.8 ) )\n#define uSpec ( uSpecK * vMetal )\n')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 texelColor = texture2D( map, vMapUv );
        diffuseColor.rgb *= mix( vec3( 1.0 ), texelColor.rgb * 1.18, vAux.y );
      #endif`)
      .replace('#include <emissivemap_fragment>', `{
        float fl = 1.0;
        if ( vAux.x > 1.5 ) {
          float h = fract( sin( dot( vPiv, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ) * 40.0;
          fl = 1.0 - uFlick * ( 0.16 - 0.1 * sin( uTime * 11.0 + h ) - 0.06 * sin( uTime * 23.0 + h * 1.7 ) - 0.05 * sin( uTime * 4.1 + h * 0.3 ) );
        }
        totalEmissiveRadiance += vColor.rgb * vAux.x * fl * uGlow;
        if ( vMetal > 0.0 ) {   // cheap sky reflection so gold / bronze read as metal, not paint
          vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
          vec3 rv = reflect( -normalize( vViewPosition ), normal );
          float sky = dot( rv, upV );
          totalEmissiveRadiance += vColor.rgb * vMetal * ( 0.04 + 0.42 * smoothstep( -0.1, 0.9, sky ) - 0.03 * smoothstep( 0.0, -0.8, sky ) );
        }
      }`)
      .replace('totalEmissiveRadiance + gSpecAcc', 'totalEmissiveRadiance + gSpecAcc * mix( vec3( 1.0 ), diffuseColor.rgb * 1.5 + 0.1, vMetal )'),
  });
  m.userData.ship = u;
  return m;
}

// ------------------------------------------------------------------------------------------------ sails
const SAIL_VPARS = /* glsl */`
attribute vec3 bOff; attribute vec3 bNrm; attribute vec3 anc; attribute vec4 sa;
uniform float uBillow; uniform float uReef; uniform float uLuff; uniform float uFlagT; uniform float uFlagA; uniform float uPhase;
vec3 sP; vec3 sN;
void sailDeform() {
  vec3 p = position; vec3 n = normal;
  float kind = sa.z;
  float t = uTime + uPhase;
  if ( kind < 0.5 ) {
    float R = uReef;
    float B = uBillow * ( 1.0 - R * 0.85 );
    p += bOff * B;
    n = normalize( mix( normal, bNrm, clamp( B, 0.0, 1.0 ) ) );
    // travelling ripples (luffing when slack, a fine shiver when full), free edges move most
    float ph = sa.y * 8.0 + sa.w * 2.5 - t * 5.2 + dot( position, vec3( 0.21, 0.13, 0.17 ) );
    float ph2 = sa.y * 13.0 - sa.w * 4.0 - t * 8.3;
    float amp = uLuff * sa.x * ( 1.0 - R );
    p += normal * ( sin( ph ) * 0.7 + sin( ph2 ) * 0.3 ) * amp;
    vec3 T = cross( normal, vec3( 0.0, 1.0, 0.0 ) );
    T = dot( T, T ) > 1e-4 ? normalize( T ) : vec3( 1.0, 0.0, 0.0 );
    n = normalize( n - T * ( cos( ph ) * 0.7 * 1.3 + cos( ph2 ) * 0.3 * 2.2 ) * amp * 1.6 );
    // reefing: gather toward the yard / stay with folds
    float k = 1.0 - 0.9 * R;
    p = anc + ( p - anc ) * k;
    float fold = sin( sa.w * 34.0 + sa.y * 5.0 );
    p += normal * R * 0.09 * fold;
    n = normalize( n + vec3( 0.0, 1.0, 0.0 ) * R * 0.9 * cos( sa.w * 34.0 + sa.y * 5.0 ) );
  } else if ( kind < 1.5 ) {
    float u = sa.x, len = sa.y;
    float kw = 6.2831 / max( 1.6, len * 0.55 );
    float ph = u * len * kw - uFlagT - uPhase + sa.w * 6.2831;
    float env = pow( u, 1.15 ) * uFlagA * ( 0.35 + len * 0.1 );
    float f = sin( ph ) * env + sin( ph * 2.3 + 1.7 ) * env * 0.25;
    p += normal * f;
    p.y += sin( ph * 0.5 + 0.6 ) * env * 0.35 - u * u * len * 0.03;
    float dfds = cos( ph ) * kw * env + cos( ph * 2.3 + 1.7 ) * kw * 2.3 * env * 0.25;
    n = normalize( normal - bOff * dfds );
  } else {
    vec3 pc = bNrm;
    float R = uReef; float B = uBillow * ( 1.0 - R * 0.85 );
    vec3 q = pc + bOff * B;
    q = anc + ( q - anc ) * ( 1.0 - 0.9 * R );
    p += ( q - pc ) * sa.x;
  }
  sP = p; sN = n;
}
`;
const SAIL_FPARS = /* glsl */`
uniform float uSailGlow; uniform vec3 uGlowCol; uniform float uGlowPulse;
`;

/** Per-ship sail material (double-sided, alpha-tested cloth atlas, translucent when back-lit). o: { tex, trans, glow, glowCol, pulse, rim } */
export function sailMaterial(o) {
  const u = {
    uBillow: { value: 0.6 }, uReef: { value: 0 }, uLuff: { value: 0.05 }, uFlagT: { value: 0 }, uFlagA: { value: 0.35 }, uPhase: { value: 0 },
    uSailGlow: { value: o.glow ?? 0 }, uGlowCol: { value: new THREE.Color(o.glowCol ?? 0xffffff) }, uGlowPulse: { value: o.pulse ?? 0 },
  };
  const m = lambert({ vertexColors: true, map: o.tex, side: THREE.DoubleSide, alphaTest: 0.5 }, {
    key: 'sevenshard-ship-sail', wrap: o.wrap ?? 0.6, trans: o.trans ?? 0.55, rim: o.rim ?? 0.0, rimColor: o.rimColor ?? 0xffffff, uniforms: u,
    vertex: vs => vs.replace('void main() {', SAIL_VPARS + '\nvoid main() {')
      .replace('#include <beginnormal_vertex>', 'sailDeform();\nvec3 objectNormal = sN;')
      .replace('#include <begin_vertex>', 'vec3 transformed = sP;'),
    fragment: fs => fs.replace('#include <common>', '#include <common>\n' + SAIL_FPARS)
      .replace('vec3( 0.9, 1.0, 0.6 )', 'vec3( 1.0, 0.86, 0.62 )')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if ( uSailGlow > 0.0 ) {
          float pl = 1.0 + uGlowPulse * ( 0.22 * sin( uTime * 2.1 + vMapUv.y * 23.0 + vMapUv.x * 7.0 ) + 0.12 * sin( uTime * 5.3 - vMapUv.y * 41.0 ) );
          totalEmissiveRadiance += diffuseColor.rgb * uGlowCol * uSailGlow * pl;
        }`),
  });
  m.alphaToCoverage = true;
  m.userData.ship = u;
  return m;
}

/** Shadow depth material that deforms exactly like the sail (shares the sail material's uniforms). */
export function sailDepthMaterial(sailMat) {
  const su = sailMat.userData.ship;
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: sailMat.map, alphaTest: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, su);
    shader.uniforms.uTime = G.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uTime;\n' + SAIL_VPARS + '\nvoid main() {')
      .replace('#include <begin_vertex>', 'sailDeform();\nvec3 transformed = sP;');
  };
  m.customProgramCacheKey = () => 'sevenshard-ship-sail-depth';
  return m;
}

// ------------------------------------------------------------------------------------------------ waterline foam skirt
// Flat strip around the hull at the waterline (on the ship root, so it stays on the water while the hull rocks).
// uv.x = metres from the bow along each side, uv.y = 0 at the hull → 1 at the outer edge; color.r = strength.
const FOAM_VS = /* glsl */`
varying vec2 vUv; varying vec3 vW; varying float vK;
void main() {
  vUv = uv; vK = color.r;
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FOAM_FS = /* glsl */`
uniform float uTime; uniform float uFoam; uniform float uFlow; uniform float uDesat; uniform vec3 uFoamCol;
varying vec2 vUv; varying vec3 vW; varying float vK;
${FOG_GLSL_PARS}
float h2( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h2( i ), h2( i + vec2( 1.0, 0.0 ) ), f.x ), mix( h2( i + vec2( 0.0, 1.0 ) ), h2( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
void main() {
  float o = vUv.y / max( 0.35, 0.45 + 0.55 * uFoam );
  vec2 p = vec2( vUv.x * 1.6 - uFlow * 1.6, o * 3.2 - uTime * 0.35 );
  float n = vn( p * 1.7 ) * 0.55 + vn( p * 4.1 + 7.3 ) * 0.3 + vn( p * 9.7 - 3.1 ) * 0.15;
  float edge = 1.0 - smoothstep( 0.0, 1.0, o );
  float lace = smoothstep( 0.36, 0.56, n + edge * 0.6 - 0.22 ) * edge;
  float line = smoothstep( 0.3, 0.0, o ) * ( 0.6 + 0.4 * n );             // bright contact line at the hull
  float a = clamp( ( lace * 1.0 + line * 1.3 ) * vK * ( 0.5 + 0.5 * uFoam ), 0.0, 1.0 );
  vec3 col = applyFog( uFoamCol, vW );
  col = mix( col, vec3( dot( col, vec3( 0.3, 0.5, 0.2 ) ) ), uDesat );
  gl_FragColor = vec4( col, a * 0.9 );
}`;
export function foamMaterial(o = {}) {
  const u = { uTime: G.uTime, uDesat: G.uDesat, uFogColor: G.uFogColor, uFogSunColor: G.uFogSunColor, uFogDensity: G.uFogDensity, uFogHeight: G.uFogHeight,
    uFogBase: G.uFogBase, uSunDir: G.uSunDir, uCamPos: G.uCamPos, uFoam: { value: 0.3 }, uFlow: { value: 0 }, uFoamCol: { value: new THREE.Color(o.color ?? 0xeef6fa) } };
  const m = new THREE.ShaderMaterial({ vertexShader: FOAM_VS, fragmentShader: FOAM_FS, uniforms: u, transparent: true, depthWrite: false, vertexColors: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.userData.ship = u;
  return m;
}
