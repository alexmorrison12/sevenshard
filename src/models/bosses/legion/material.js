// Boss material: the kit's stylised lambert creature look (vertex colours, baked AO, rest-space triplanar painted
// detail) plus boss-only channels driven by the `ext` vertex attribute (see acc.js) and per-instance uniforms:
//   - molten cracks: rest-space 3D Voronoi fissures (mask ext.z) glowing in uGlowCol, pulsing
//   - per-vertex specular (ext.x), emissive classes (ext.w): eyes, weapon edge (uCharge), flames (flicker), runes
//   - counter shimmer (uCounter): electric-blue fresnel rim + rising interference bands — the blue windup read
//   - enrage (uEnrage): hotter emissive shifted to crimson + red rim
//   - ghost (uGhost): spectral blue-violet, fresnel alpha (transparent variant + depth prepass), gentle surface drift
//   - hidden parts (uHide.xyzw ↔ part ids 1..4): vertices collapse (broken horns); the shadow depth material matches
//   - hit tint (uTint / uTintAmt), dissolve (uDissolve) for corpse clean-up
// One GL program per variant (opaque / ghost / depth) shared by every boss; uniforms are per instance.
import * as THREE from 'three';
import { lambert, G } from '../../../engine/materials.js';
import { detailTexture } from '../../kit/material.js';

const VERT_PARS = /* glsl */`
attribute vec4 dtl; attribute vec2 aux; attribute vec4 ext;
varying vec4 vDtl; varying float vEmis; varying vec3 vRP; varying vec3 vRN; varying vec4 vExt;
uniform vec4 uHide; uniform float uGhost; uniform float uUnit;
`;
const HIDE_GLSL = /* glsl */`
{
  float pid = floor( ext.y + 0.5 );
  float hid = pid < 0.5 ? 0.0 : pid < 1.5 ? uHide.x : pid < 2.5 ? uHide.y : pid < 3.5 ? uHide.z : uHide.w;
  if ( hid > 0.5 ) transformed = vec3( 0.0 );
}
`;
// vertex displacement shared by the body passes and the ghost depth prepass (they must match exactly, or the
// translucent ghost pass fails its LessEqual depth test in bands)
const DISPLACE_GLSL = /* glsl */`
{
  float gcls = floor( ext.w + 0.5 );
  if ( gcls > 2.5 && gcls < 3.5 ) {
    float f = aux.y * uUnit;
    float t = uTime;
    transformed.x += ( sin( t * 9.0 + position.y * 40.0 / uUnit + position.z * 13.0 / uUnit ) * 0.6 + sin( t * 17.3 + position.x * 20.0 / uUnit ) * 0.4 ) * 0.02 * f;
    transformed.z += cos( t * 11.0 + position.y * 35.0 / uUnit ) * 0.016 * f;
    transformed.y += ( sin( t * 13.0 + position.x * 30.0 / uUnit ) * 0.5 + 0.5 ) * 0.025 * f;
  }
  if ( uGhost > 0.001 ) transformed += normal * sin( uTime * 2.7 + position.y * 9.0 / uUnit + position.x * 5.0 / uUnit ) * 0.006 * uUnit * uGhost;
}
`;
const VERT_BODY = /* glsl */`
vRP = position; vRN = normal; vDtl = dtl; vEmis = aux.x; vExt = ext;
${DISPLACE_GLSL}
${HIDE_GLSL}
`;

const FRAG_PARS = /* glsl */`
varying vec4 vDtl; varying float vEmis; varying vec3 vRP; varying vec3 vRN; varying vec4 vExt;
uniform sampler2D uDetail; uniform float uDFreq; uniform float uFurAxis; uniform vec3 uTint; uniform float uTintAmt;
uniform float uEmisK; uniform vec3 uColorMul; uniform vec3 uGlowCol; uniform float uCrackFreq; uniform float uCrackK;
uniform float uCounter; uniform float uEnrage; uniform float uGhost; uniform vec3 uCounterCol; uniform vec3 uEnrageCol; uniform vec3 uGhostCol;
uniform float uCharge; uniform float uBodyGlow; uniform float uEyeK; uniform float uDissolve; uniform float uUnit; uniform float uSpecK;
uniform vec3 uSilCol; uniform float uSil;
float gSpecMask = 0.0; vec3 gEmis = vec3( 0.0 );
vec3 bvH3( vec3 p ) {
  p = vec3( dot( p, vec3( 127.1, 311.7, 74.7 ) ), dot( p, vec3( 269.5, 183.3, 246.1 ) ), dot( p, vec3( 113.5, 271.9, 124.6 ) ) );
  return fract( sin( p ) * 43758.5453 );
}
vec3 bvVoro( vec3 x ) {
  vec3 p = floor( x ), f = fract( x );
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for ( int k = -1; k <= 1; k++ ) for ( int j = -1; j <= 1; j++ ) for ( int i = -1; i <= 1; i++ ) {
    vec3 b = vec3( float( i ), float( j ), float( k ) );
    vec3 h = bvH3( p + b );
    vec3 r = b - f + h * 0.8 + 0.1;
    float d = dot( r, r );
    if ( d < d1 ) { d2 = d1; d1 = d; id = h.x; } else if ( d < d2 ) d2 = d;
  }
  return vec3( sqrt( d1 ), sqrt( d2 ), id );
}
float bvN3( vec3 p ) {
  vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  float n = dot( i, vec3( 1.0, 57.0, 113.0 ) );
  vec4 a = fract( sin( vec4( n, n + 1.0, n + 57.0, n + 58.0 ) ) * 43758.5453 );
  vec4 b = fract( sin( vec4( n + 113.0, n + 114.0, n + 170.0, n + 171.0 ) ) * 43758.5453 );
  vec4 m = mix( a, b, f.z );
  vec2 q = mix( m.xy, m.zw, f.y );
  return mix( q.x, q.y, f.x );
}
`;
const FRAG_COLOR = /* glsl */`
#include <color_fragment>
{
  if ( uDissolve > 0.001 ) {
    float dn = bvN3( vRP * 9.0 / uUnit ) * 0.6 + bvN3( vRP * 23.0 / uUnit ) * 0.4;
    float cut = uDissolve * 1.1 - 0.05 + ( vRP.y / uUnit ) * 0.0;
    if ( dn < cut ) discard;
    gEmis += uGlowCol * ( 1.0 - smoothstep( 0.0, 0.06, dn - cut ) ) * 4.0 * step( 0.001, uDissolve );
  }
  vec3 an = abs( normalize( vRN ) ); vec3 bw = an * an; bw *= bw; bw /= ( bw.x + bw.y + bw.z );
  vec3 P = vRP * uDFreq;
  vec4 tX = texture2D( uDetail, mix( P.zy, P.yz, uFurAxis ) );
  vec4 tY = texture2D( uDetail, P.zx );
  vec4 tZ = texture2D( uDetail, P.yx );
  vec4 tt = tX * bw.x + tY * bw.y + tZ * bw.z;
  diffuseColor.rgb *= max( 0.0, 1.0 + dot( tt - 0.5, vDtl ) * 2.0 ) * uColorMul;
  gSpecMask = vExt.x;
  if ( vExt.z > 0.02 ) {
    // molten fissures: domain-warped Voronoi edges, kept only where a low-frequency noise opens them (veins)
    vec3 cp = vRP * uCrackFreq;
    cp += vec3( bvN3( cp * 0.55 + 1.7 ), bvN3( cp * 0.55 + 9.2 ), bvN3( cp * 0.55 + 4.4 ) ) * 1.1;
    vec3 vr = bvVoro( cp );
    float edge = vr.y - vr.x;
    float aa = fwidth( edge ) * 1.2;
    float fade = 1.0 - smoothstep( 0.3, 0.8, length( fwidth( cp ) ) );
    float vPat = bvN3( vRP * uCrackFreq * 0.3 + 7.1 ) * 0.7 + bvN3( vRP * uCrackFreq * 0.8 + 3.3 ) * 0.3;
    float vOpen = smoothstep( 0.6 - vExt.z * 0.12, 0.72 - vExt.z * 0.1, vPat );
    float w = ( 0.006 + 0.016 * vExt.z ) * ( 0.5 + vOpen );
    float line = ( 1.0 - smoothstep( w * 0.3, w + aa, edge ) ) * vOpen;
    float halo = ( 1.0 - smoothstep( 0.0, w * 6.0 + aa, edge ) ) * vOpen;
    float mask = smoothstep( 0.05, 0.4, vExt.z );
    float pulse = 0.7 + 0.3 * sin( uTime * 2.1 - vRP.y * 5.0 / uUnit + vr.z * 6.28 );
    diffuseColor.rgb *= 1.0 - halo * mask * 0.45;
    gEmis += uGlowCol * ( line * mix( 0.3, 1.0, fade ) + halo * 0.08 ) * mask * pulse * uCrackK * ( 1.0 + uBodyGlow * 1.4 + uEnrage * 1.1 );
  }
}
`;
const FRAG_EMIS = /* glsl */`
#include <emissivemap_fragment>
{
  float gcls = floor( vExt.w + 0.5 );
  float k = uEmisK;
  if ( gcls > 0.5 && gcls < 1.5 ) k *= uEyeK * ( 1.0 + uEnrage * 0.8 );
  else if ( gcls > 1.5 && gcls < 2.5 ) k *= ( 1.0 + uCharge * 2.2 + uEnrage * 0.5 ) * ( 0.9 + 0.1 * sin( uTime * 5.0 + vRP.y * 8.0 / uUnit ) );
  else if ( gcls > 2.5 && gcls < 3.5 ) k *= ( 0.8 + 0.2 * sin( uTime * 23.0 + vRP.x * 40.0 / uUnit ) * sin( uTime * 7.3 + 1.0 ) ) * ( 1.0 + uEnrage * 0.6 + uBodyGlow );
  else if ( gcls > 3.5 ) k *= ( 0.55 + 0.45 * sin( uTime * 2.4 - vRP.y * 6.0 / uUnit ) ) * ( 1.0 + uBodyGlow * 1.3 + uEnrage * 1.0 + uCharge * 0.8 );
  vec3 ec = vColor.rgb * vEmis * k;
  ec = mix( ec, uEnrageCol * dot( ec, vec3( 0.4, 0.4, 0.2 ) ) * 1.4, uEnrage * 0.3 );
  totalEmissiveRadiance += ec + gEmis;
}
`;
const FRAG_FINAL = /* glsl */`
{
  float ndv = saturate( dot( geometryNormal, geometryViewDir ) );
  float fres = pow( 1.0 - ndv, 2.2 );
  // silhouette rim: a thin cool/pale edge that separates the boss from strongly tinted arenas
  outgoingLight += uSilCol * uSil * pow( 1.0 - ndv, 4.0 ) * ( 0.6 + 0.4 * saturate( geometryNormal.y * 0.5 + 0.5 ) );
  if ( uCounter > 0.001 ) {
    // electric-blue windup: crisp fresnel rim + a bright band sweeping up the body, base colours stay readable
    float band = pow( 0.5 + 0.5 * sin( vRP.y * 9.0 / uUnit - uTime * 7.0 ), 10.0 );
    float shimmer = 0.65 + 0.35 * sin( uTime * 23.0 + vRP.y * 31.0 / uUnit + vRP.x * 13.0 / uUnit );
    float rimC = pow( 1.0 - ndv, 3.0 );
    outgoingLight = mix( outgoingLight, outgoingLight * vec3( 0.55, 0.7, 1.0 ), uCounter * 0.5 );
    outgoingLight += uCounterCol * uCounter * ( rimC * 2.6 * shimmer + band * 0.28 * ( 0.3 + rimC ) + 0.02 );
  }
  if ( uEnrage > 0.001 ) outgoingLight += uEnrageCol * uEnrage * pow( 1.0 - ndv, 3.0 ) * 0.55;
  if ( uGhost > 0.001 ) {
    float l = dot( outgoingLight, vec3( 0.3, 0.5, 0.2 ) );
    float swirl = bvN3( vRP * 6.0 / uUnit + vec3( 0.0, -uTime * 0.9, uTime * 0.3 ) );
    vec3 gcol = uGhostCol * ( 0.18 + l * 1.3 + swirl * 0.35 ) + uGhostCol * fres * 2.6 + totalEmissiveRadiance * vec3( 0.55, 0.65, 1.2 ) * 0.9;
    outgoingLight = mix( outgoingLight, gcol, uGhost * 0.9 );
    diffuseColor.a = mix( 1.0, 0.3 + 0.55 * fres + swirl * 0.15, uGhost );
  }
  outgoingLight = mix( outgoingLight, uTint, uTintAmt );
}
#include <opaque_fragment>
`;

/** Shared per-instance uniform block; every material of one boss instance references the same objects. */
export function bossUniforms(cfg = {}) {
  return {
    uDetail: { value: detailTexture() }, uDFreq: { value: cfg.dfreq ?? 3.0 }, uFurAxis: { value: cfg.furAxis ?? 1 },
    uTint: { value: new THREE.Color(1, 1, 1) }, uTintAmt: { value: 0 },
    uEmisK: { value: 1 }, uColorMul: { value: new THREE.Color(1, 1, 1) },
    uGlowCol: { value: new THREE.Color(cfg.glow ?? 0xff5a18).multiplyScalar(cfg.glowK ?? 3.2) },
    uCrackFreq: { value: cfg.crackFreq ?? 9 }, uCrackK: { value: cfg.crackK ?? 1 },
    uCounter: { value: 0 }, uEnrage: { value: 0 }, uGhost: { value: 0 },
    uCounterCol: { value: new THREE.Color(0x46b4ff).multiplyScalar(2.6) },
    uEnrageCol: { value: new THREE.Color(cfg.enrageCol ?? 0xff1e0a).multiplyScalar(2.2) },
    uGhostCol: { value: new THREE.Color(cfg.ghostCol ?? 0x7a6cff).multiplyScalar(1.6) },
    uCharge: { value: 0 }, uBodyGlow: { value: 0 }, uEyeK: { value: 1 }, uDissolve: { value: 0 },
    uHide: { value: new THREE.Vector4(0, 0, 0, 0) }, uUnit: { value: cfg.unit ?? 1 }, uSpecK: { value: 1 },
    uSilCol: { value: new THREE.Color(cfg.silCol ?? 0x8fa8ff) }, uSil: { value: cfg.sil ?? 0.3 },
  };
}

function makeLambert(U, cfg, variant) {
  const m = lambert({ vertexColors: true, transparent: variant === 'ghost', depthWrite: true }, {
    key: 'legion-boss-' + variant, wrap: cfg.wrap ?? 0.45, rim: cfg.rim ?? 0.3, rimColor: cfg.rimColor ?? 0xffe6cc,
    spec: cfg.spec ?? 0.9, shine: cfg.shine ?? 30, uniforms: U,
    vertex: vs => vs.replace('#include <common>', '#include <common>\n' + VERT_PARS).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY),
    fragment: fs => fs.replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <color_fragment>', FRAG_COLOR)
      .replace('#include <emissivemap_fragment>', FRAG_EMIS)
      .replace('* uSpec * saturate( nl * 4.0 )', '* uSpec * gSpecMask * saturate( nl * 4.0 )')
      .replace('#include <opaque_fragment>', FRAG_FINAL),
  });
  if (variant === 'ghost') { m.depthFunc = THREE.LessEqualDepth; }
  return m;
}

/** Depth-only prepass for the ghost look (so the translucent body shows one clean layer). */
function makePrepass(U) {
  const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
  m.customProgramCacheKey = () => 'legion-prepass';
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uHide: U.uHide, uGhost: U.uGhost, uUnit: U.uUnit, uTime: G.uTime });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 ext; attribute vec2 aux; uniform vec4 uHide; uniform float uGhost; uniform float uUnit; uniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + DISPLACE_GLSL + HIDE_GLSL);
  };
  return m;
}

/** Shadow depth material honouring hidden parts. */
function makeDepth(U) {
  const m = new THREE.MeshDepthMaterial();
  m.customProgramCacheKey = () => 'legion-depth';
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHide = U.uHide;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 ext; uniform vec4 uHide;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + HIDE_GLSL);
  };
  return m;
}

/** Materials for one boss instance: { body, ghost, prepass, depth, U } */
export function bossMaterials(cfg = {}) {
  const U = bossUniforms(cfg);
  return { U, body: makeLambert(U, cfg, 'opaque'), ghost: makeLambert(U, cfg, 'ghost'), prepass: makePrepass(U), depth: makeDepth(U) };
}
