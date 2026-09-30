// WebGL2 renderer + post chain: MSAA HDR scene → bloom → final pass (tone map, grade, vignette, screen FX).
// One instance for the whole game. Zones set `renderer.grade` (see GRADE_DEFAULT) to give each place its own look.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const GRADE_DEFAULT = {
  exposure: 1.0, saturation: 1.08, contrast: 1.07, vignette: 0.34,
  lift: [0.0, 0.0, 0.0], gain: [1, 1, 1], // shadows offset / highlights multiplier (linear-ish, applied after tone map)
  warm: 0.02, cool: 0.02,                  // split toning strength
  bloom: 0.55, bloomRadius: 0.5, bloomThreshold: 0.86,
};

/** Replace non-finite HDR values (NaN / Inf) with black and cap extreme highlights before bloom. */
const ScrubShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      bool bad = any(isnan(c)) || any(isinf(c)) || c.r != c.r || c.g != c.g || c.b != c.b;
      gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(min(c.rgb, vec3(64.0)), c.a);
    }`,
};

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1 }, uSat: { value: 1.08 }, uContrast: { value: 1.07 }, uVignette: { value: 0.34 },
    uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uWarm: { value: 0.02 }, uCool: { value: 0.02 },
    uHurt: { value: 0 },            // red edge pulse (low health / heavy hit)
    uFlash: { value: 0 },           // additive flash
    uFlashCol: { value: new THREE.Vector3(1, 0.9, 0.6) },
    uDesat: { value: 0 },           // death / ghost / cinematic pause
    uAberration: { value: 0 },      // chromatic split on impacts (0..1)
    uRadial: { value: 0 },          // radial blur on dashes / awakenings (0..1)
    uRadialCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uLetterbox: { value: 0 },       // cinematic bars (0..1 of 12% height)
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uExposure, uSat, uContrast, uVignette, uWarm, uCool, uHurt, uFlash, uDesat, uAberration, uRadial, uLetterbox, uTime;
    uniform vec3 uLift, uGain, uFlashCol; uniform vec2 uRes, uRadialCenter;
    varying vec2 vUv;
    // Khronos PBR Neutral: keeps hues honest (skills stay the colour they were designed in) while compressing highlights
    vec3 neutral(vec3 color) {
      const float S = 0.76; const float D = 0.15;
      float x = min(color.r, min(color.g, color.b));
      float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
      color -= off;
      float peak = max(color.r, max(color.g, color.b));
      if (peak < S) return color;
      float d = 1.0 - S;
      float np = 1.0 - d * d / (peak + d - S);
      color *= np / peak;
      float g = 1.0 - 1.0 / (D * (peak - np) + 1.0);
      return mix(color, vec3(np), g);
    }
    vec3 toSRGB(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    float h12(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 sampleScene(vec2 uv) {
      if (uAberration > 0.001) {
        vec2 d = (uv - 0.5) * uAberration * 0.012;
        return vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b);
      }
      return texture2D(tDiffuse, uv).rgb;
    }
    void main() {
      vec2 uv = vUv;
      vec3 c;
      if (uRadial > 0.001) {
        vec2 dir = uv - uRadialCenter; c = vec3(0.0);
        for (int i = 0; i < 8; i++) c += sampleScene(uv - dir * uRadial * 0.06 * float(i) / 8.0);
        c /= 8.0;
      } else c = sampleScene(uv);
      c *= uExposure;
      c = neutral(c);
      c = toSRGB(c);
      c = c * uGain + uLift * (1.0 - c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContrast + 0.5;
      c += vec3(1.0, 0.5, -0.6) * uWarm * smoothstep(0.45, 1.0, l) + vec3(-0.5, 0.0, 1.0) * uCool * smoothstep(0.55, 0.0, l);
      vec2 q = uv - 0.5; q.x *= uRes.x / uRes.y;
      float v = smoothstep(1.0, 0.28, length(q));
      c *= mix(1.0 - uVignette, 1.0, v);
      c = mix(c, vec3(dot(c, vec3(0.3, 0.5, 0.2))) * vec3(0.86, 0.94, 1.1), uDesat);
      c = mix(c, vec3(0.7, 0.04, 0.03), uHurt * (1.0 - v) * 0.85);
      c += uFlashCol * uFlash;
      float bar = uLetterbox * 0.12;
      if (uv.y < bar || uv.y > 1.0 - bar) c = vec3(0.0);
      c += (h12(uv * uRes + fract(uTime) * 91.0) - 0.5) / 200.0;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export const QUALITY = {
  low: { pr: 0.7, shadow: 1024, bloom: false, msaa: 0, props: 0.5, grass: 0.35, particles: 0.5 },
  medium: { pr: 1.0, shadow: 2048, bloom: true, msaa: 2, props: 0.8, grass: 0.7, particles: 0.8 },
  high: { pr: 1.5, shadow: 2048, bloom: true, msaa: 4, props: 1, grass: 1, particles: 1 },
  ultra: { pr: 2.0, shadow: 4096, bloom: true, msaa: 4, props: 1, grass: 1.3, particles: 1 },
};

export class Renderer {
  constructor(container = document.body, { quality = 'high', preserve = false } = {}) {
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true, preserveDrawingBuffer: preserve });
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.info.autoReset = false;
    r.domElement.id = 'game-canvas';
    r.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none';
    container.appendChild(r.domElement);
    this.r = r;
    this.scale = 1;          // dynamic resolution scale
    this.fps = 60;
    this.grade = { ...GRADE_DEFAULT };
    this.fx = { hurt: 0, flash: 0, aberration: 0, radial: 0, letterbox: 0, desat: 0 }; // decays handled by owners
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(null, null);
    this.composer.addPass(this.renderPass);
    // one bad pixel (NaN / Inf from any shader) would be smeared by bloom into black squares across the screen
    this.scrub = new ShaderPass(ScrubShader);
    this.composer.addPass(this.scrub);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.86);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.F = this.final.uniforms;
    this.setQuality(quality);
    window.addEventListener('resize', () => this.resize());
  }
  get canvas() { return this.r.domElement; }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = this.pixelRatio * this.scale;
    this.r.setPixelRatio(pr); this.r.setSize(w, h, false);
    this.composer.setPixelRatio(pr); this.composer.setSize(w, h);
    this.F.uRes.value.set(w * pr, h * pr);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }
  setScene(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.renderPass.scene = scene; this.renderPass.camera = camera;
    this.resize();
  }
  setQuality(q) {
    this.quality = QUALITY[q] ? q : 'high';
    const Q = this.Q = QUALITY[this.quality];
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, Q.pr);
    this.bloom.enabled = Q.bloom;
    this.composer.renderTarget1.samples = this.composer.renderTarget2.samples = Q.msaa;
    this.resize();
  }
  /** Keep ~55+ fps by nudging the render scale (never below 0.55). */
  /** forget recent frame timings (call after loading a zone so its hitch doesn't downscale the image) */
  resetAdapt() { this._acc = 0; this._n = 0; this._grace = 2; }
  adapt(dt) {
    if (this._grace > 0) { this._grace -= dt; return; }
    if (dt > 0.1) return;                       // a hitch (shader compile, zone build) is not sustained load
    this._acc = (this._acc || 0) + dt; this._n = (this._n || 0) + 1;
    if (this._acc < 1.5) return;
    const fps = this._n / this._acc; this._acc = 0; this._n = 0; this.fps = fps;
    if (this.fixedScale) return;
    const old = this.scale;
    if (fps < 50 && this.scale > 0.55) this.scale = Math.max(0.55, this.scale - 0.1);
    else if (fps > 57 && this.scale < 1) this.scale = Math.min(1, this.scale + 0.1);
    if (old !== this.scale) this.resize();
  }
  render(dt, time) {
    this.adapt(dt);
    const g = this.grade, F = this.F, fx = this.fx;
    F.uExposure.value = g.exposure; F.uSat.value = g.saturation; F.uContrast.value = g.contrast; F.uVignette.value = g.vignette;
    F.uLift.value.fromArray(g.lift); F.uGain.value.fromArray(g.gain); F.uWarm.value = g.warm; F.uCool.value = g.cool;
    this.bloom.strength = g.bloom; this.bloom.radius = g.bloomRadius; this.bloom.threshold = g.bloomThreshold;
    F.uHurt.value = fx.hurt; F.uFlash.value = fx.flash; F.uAberration.value = fx.aberration; F.uRadial.value = fx.radial;
    F.uLetterbox.value = fx.letterbox; F.uDesat.value = fx.desat;
    F.uTime.value = time % 1000;
    this.r.info.reset();
    this.composer.render(dt);
  }
  /** Render straight to a canvas-sized image without post (icons, share cards). */
  snapshot(scene, camera, w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
    const old = this.r.getRenderTarget();
    this.r.setRenderTarget(rt); this.r.render(scene, camera); this.r.setRenderTarget(old);
    const px = new Uint8Array(w * h * 4); this.r.readRenderTargetPixels(rt, 0, 0, w, h, px); rt.dispose();
    return px;
  }
}
