// SEVENSHARD icons — procedurally painted, cached as data URLs. Pure 2D canvas, no image files, fonts or emoji.
//
//   icon(id, size = 64, opts?) → 'data:image/png;base64,…'   (cached by id + size + opts)
//   iconCanvas(id, size = 64, opts?) → HTMLCanvasElement      (fresh, uncached)
//   hasIcon(id) → boolean      ICON_IDS → every canonical id
//   gradeFrame(grade) → CSS background string for item slots    gradeColor(grade) → '#hex'
//
// opts (items): a grade number 0–7, or { grade, bare }. Also accepted as id suffixes: 'item:necklace@4', 'item:ring@bare'.
//   no grade → neutral dark slot background; grade → Lost Ark style grade gradient + grade glow;
//   bare → transparent background (object + soft shadow only) to layer over your own slot / `grade:<n>` background.
// See README.md for the full id list and conventions.
import { mk, downscale, setK, rng, hashStr, finishSquare, finishRound, norm, noBlur, rgba, mix } from './core.js';
import { buildIds, GRADES, CLASS_COLORS, CLASSES, SKILLS, DEBUFFS, ENGR_CLASS } from './ids.js';
import {
  gradeBack, itemNeutral, GRADE_BG, genericSkill, genericItem, genericRound, genericClass, genericCurrency, genericStatus,
  genericUI, genericBoss, genericNpc, genericTripod,
} from './generic.js';
import { SKILL_PAINT } from './skills.js';
import { ITEM_PAINT } from './items.js';
import { EMBLEM_PAINT } from './emblems.js';
import { MISC_PAINT } from './misc.js';
import { PORTRAIT_PAINT } from './portraits.js';
import { NPC_CARD_PAINT, genericCard } from './npcs_cards.js';

export { GRADES, CLASS_COLORS, CLASSES };
/** Skill keys per class (DESIGN.md §4 order), e.g. SKILL_KEYS.reaver[0] = 'whirlwind_edge'. */
export const SKILL_KEYS = SKILLS;

const ALL = buildIds();
/** Every canonical icon id (≈450), in gallery order. */
export const ICON_IDS = Object.freeze(ALL.slice());
const KNOWN = new Set(ALL);

const PAINT = new Map();
for (const table of [SKILL_PAINT, ITEM_PAINT, EMBLEM_PAINT, MISC_PAINT, PORTRAIT_PAINT, NPC_CARD_PAINT]) for (const k in table) PAINT.set(k, table[k]);

/**
 * Aliases: ids the game data produces that share art with a canonical id — awakening / identity skills by their kit
 * def ids (skill:<cls>:<def.id>), and ITEMS ids like food1 / gift1.
 */
const ALIAS = {};
const AWAKEN_ID = { reaver: 'worldsplitter', oathkeeper: 'radiant_judgment', stormfist: 'heavens_fury', pistoleer: 'last_rites', starcaller: 'stellar_collapse', songweaver: 'grand_finale', bladedancer: 'thousand_cuts', demonbound: 'abyssal_rupture' };
for (const c in AWAKEN_ID) ALIAS[`skill:${c}:${AWAKEN_ID[c]}`] = `skill:${c}:awakening`;
const IDENTITY_ID = {
  reaver: { burst_mode: 'z', crimson_finale: 'x', bloodlust: 'z' }, oathkeeper: { aegis_of_dawn: 'z', sacred_punishment: 'x', sanctified: 'x' },
  stormfist: { dragon_ascent: 'z', thunder_tiger: 'x' }, pistoleer: { swap_stance: 'z', stance: 'z', quickdraw: 'z', deadeye_focus: 'x', deadeye: 'x' },
  starcaller: { overload: 'z', arcane_surge: 'x' }, songweaver: { anthem_of_courage: 'z', hymn_of_mending: 'x' },
  bladedancer: { surge: 'z', surge_orbs: 'x' }, demonbound: { demonform: 'z', demon_form: 'z', revert: 'x' },
};
for (const c in IDENTITY_ID) for (const k in IDENTITY_ID[c]) ALIAS[`skill:${c}:${k}`] = `skill:${c}:identity_${IDENTITY_ID[c][k]}`;
for (let i = 1; i <= 4; i++) { ALIAS[`item:food${i}`] = `item:food:${i}`; ALIAS[`item:gift${i}`] = `item:gift:${i}`; }
Object.assign(ALIAS, { 'status:identity_mode': 'status:atk_up', 'status:haste': 'status:speed_up', 'status:protection': 'status:def_up', 'item:acc:necklace': 'item:necklace', 'item:acc:earring': 'item:earring', 'item:acc:ring': 'item:ring', 'item:gem': 'item:gem:ruin:5' });
/** Every alias id → canonical id. */
export const ICON_ALIASES = Object.freeze({ ...ALIAS });

/** Unknown tripod / status ids pick the closest generic art by keyword (unique tripods, custom buffs). */
const KEYWORDS = {
  tripod: [[/fire|burn|flame|inferno|hell|scorch|blaze|ember|solar|pyre|ignit/, 'burn'], [/frost|ice|glacial|perma|freez|shatter|cold|hail|rime/, 'freeze'], [/storm|thunder|lightning|bolt|static|shock|spark|volt|tempest/, 'shock'], [/blood|bleed|crimson|lacerat|gore|reap|massacre/, 'bleed'], [/chain|pull|reel|gravity|singular|horizon|bind|shackle|vortex/, 'pull'], [/wave|wide|gale|sweep|tide|far|reach|breadth|wind/, 'wide'], [/pierc|lance|penetrat|impal|thrust/, 'pierce'], [/zone|field|ground|sanct|rune|pillar|pool|ring/, 'zone'], [/charge|overcharge|focus|aim|steady|hold/, 'charge'], [/quick|swift|tempo|allegro|rapid|haste|step|fourth/, 'swift'], [/back|shadow|ambush|assassin/, 'back'], [/head|skyfall|leap|descent/, 'head'], [/armor|guard|bulwark|shield|bastion|steadfast|stance/, 'stance'], [/nova|burst|explo|bomb|super|cataclysm|finale|verdict|judg|double|twin|echo|encore|triple|third|extra|second/, 'extra_hit'], [/weak|break|crush|earth|quake|split|shock/, 'crushing'], [/after|shock|tremor/, 'aftershock'], [/vital|execut|finish|hunt|predator|kill/, 'vital'], [/keen|crit|eye|sight|gaze|deadeye/, 'keen'], [/mana|thrift|saver|spirit/, 'mana_saver'], [/unstopp|titan|colossus|immov|rage/, 'unstoppable']],
  status: [[/shield|guard|bulwark|aegis|bastion|barrier|ward/, 'shield'], [/heal|mend|regen|renew|hymn|restor|life/, 'regen'], [/haste|speed|swift|wind|tempo|allegro|quick/, 'speed_up'], [/crit|keen|focus|deadeye|precis/, 'crit_up'], [/invuln|immun|grand_finale|radiant/, 'invuln'], [/super|unstopp|stance|armor_up/, 'super_armor'], [/protect|def_up|sanct|fortif|stone/, 'def_up'], [/atk|attack|might|bless|anthem|courage|zeal|fury|burst|power|trance|demon|surge|overload|mode|judg/, 'atk_up'], [/burn|fire|ignit/, 'burn'], [/bleed|blood/, 'bleed'], [/poison|venom|toxic/, 'poison'], [/frost|chill|freez|ice/, 'freeze'], [/slow|snare|root/, 'slow'], [/brand|mark|stigma|expose/, 'brand'], [/weak|curse|hex/, 'weaken'], [/break|shred|sunder/, 'armor_break']],
};
function keywordFallback(fam, key) {
  for (const [re, id] of KEYWORDS[fam] || []) if (re.test(key)) return `${fam}:${id}`;
  return null;
}

const FALLBACK = {
  card: genericCard, skill: genericSkill, item: genericItem, tripod: genericTripod, engr: genericRound, class: genericClass, currency: genericCurrency,
  status: genericStatus, ui: genericUI, boss: genericBoss, npc: genericNpc,
};
/** Frame per family: square (bevelled tile), round (circular emblem, transparent corners), glyph (transparent). */
const FRAME = { skill: 'square', item: 'item', status: 'status', npc: 'square', card: 'square', grade: 'grade', tripod: 'round', engr: 'round', boss: 'round', class: 'glyph', ui: 'glyph', currency: 'glyph' };

/** Tolerate display names: 'skill:reaver:Whirlwind Edge', 'engr:All-Out Attack' → lower_snake_case. */
const normId = id => (/[A-Z\s'’\-]/.test(id) ? id.trim().toLowerCase().replace(/['’]/g, '').replace(/[\s\-]+/g, '_') : id);
function parse(id, opts) {
  id = String(id || '');
  let grade = null, bare = false;
  const at = id.indexOf('@');
  if (at >= 0) {
    for (const t of id.slice(at + 1).split('@')) { if (t === 'bare') bare = true; else if (/^\d$/.test(t)) grade = +t; }
    id = id.slice(0, at);
  }
  if (typeof opts === 'number') grade = opts;
  else if (opts && typeof opts === 'object') { if (opts.grade != null) grade = opts.grade; if (opts.bare) bare = true; }
  if (grade != null) grade = Math.max(0, Math.min(7, grade | 0));
  id = normId(id);
  if (ALIAS[id]) id = ALIAS[id];
  else if (!PAINT.has(id) && id.indexOf(':') > 0) { const f = id.slice(0, id.indexOf(':')); if (KEYWORDS[f]) id = keywordFallback(f, id.slice(f.length + 1)) || id; }
  const parts = id.split(':');
  return { base: id, parts, fam: parts[0], grade, bare, key: id + '|' + (grade ?? '') + (bare ? 'b' : '') };
}

/** True when `id` (ignoring @grade / @bare suffixes) has dedicated art: a canonical id or an alias of one. */
export function hasIcon(id) { const s = normId(String(id || '').split('@')[0]); return KNOWN.has(s) || !!ALIAS[s]; }

let warned = 0;
/** Paint an icon into a fresh canvas of `size` px (painted at 2× and downsampled). */
export function iconCanvas(id, size = 64, opts) {
  size = Math.max(8, Math.round(size));
  const o = parse(id, opts);
  const M = size <= 128 ? Math.max(64, size * 2) : size;
  const [c, x] = mk(M);
  setK(M / 100);
  const R = rng(hashStr(o.base) ^ 0x5eed);
  const frame = FRAME[o.fam] || 'square';
  o.debuff = o.fam === 'status' && DEBUFFS.has(o.parts[1]);
  const fn = PAINT.get(o.base) || FALLBACK[o.fam] || genericItem;
  x.save();
  try {
    if (frame === 'item') {
      if (!o.bare) { if (o.grade != null) gradeBack(x, R, o.grade); else itemNeutral(x, R); }
      if (o.grade != null && o.grade >= 2) itemGlow(x, o.grade, o.bare);
      // the object is painted on its own layer and composited with a soft drop shadow
      const [lc, lx] = mk(M);
      fn(lx, R, o);
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.shadowColor = 'rgba(0,0,0,.72)'; x.shadowBlur = M * 0.045; x.shadowOffsetX = M * 0.012; x.shadowOffsetY = M * 0.022;
      x.drawImage(lc, 0, 0);
      noBlur(x); x.shadowOffsetX = x.shadowOffsetY = 0;
    }
    else if (frame === 'grade') gradeBack(x, R, Math.max(0, Math.min(7, +o.parts[1] || 0)));
    else fn(x, R, o);
  } catch (e) {
    if (warned++ < 5) console.warn('[icons] painter failed for', o.base, e);
    x.restore(); x.save(); norm(x); noBlur(x); x.clearRect(0, 0, 100, 100);
    (FALLBACK[o.fam] || genericItem)(x, R, o);
  }
  x.restore();
  x.setTransform(M / 100, 0, 0, M / 100, 0, 0);
  norm(x); noBlur(x); x.lineJoin = 'round'; x.lineCap = 'round';
  finish(x, frame, o);
  return downscale(c, size);
}

function itemGlow(x, g, bare) {
  const col = GRADES[g].color;
  const pc = x.globalCompositeOperation; x.globalCompositeOperation = 'lighter';
  const gr = x.createRadialGradient(50, 52, 0, 50, 52, 46);
  gr.addColorStop(0, rgba(mix(col, '#ffffff', 0.2), bare ? 0.22 : 0.16)); gr.addColorStop(0.55, rgba(col, bare ? 0.08 : 0.06)); gr.addColorStop(1, rgba(col, 0));
  x.fillStyle = gr; x.fillRect(0, 0, 100, 100);
  x.globalCompositeOperation = pc;
}

function finish(x, frame, o) {
  if (frame === 'square') finishSquare(x, { vignette: o.fam === 'npc' ? 0.5 : 0.62 });
  else if (frame === 'item') { if (!o.bare) finishSquare(x, { vignette: o.grade != null ? 0.22 : 0.42, accent: o.grade != null && o.grade >= 1 ? rgba(GRADES[o.grade].color, 0.35) : null }); }
  else if (frame === 'grade') finishSquare(x, { vignette: 0.25, grain: 0.35 });
  else if (frame === 'status') finishSquare(x, { vignette: 0.35, grain: 0.3, border: o.debuff ? 'rgba(40,4,4,.95)' : 'rgba(4,10,20,.95)', accent: o.debuff ? 'rgba(255,90,70,.75)' : 'rgba(120,200,255,.6)' });
  else if (frame === 'round') finishRound(x, roundStyle(o));
}
function roundStyle(o) {
  if (o.fam === 'boss') return { ring: 'obsidian', ringW: 4.6, vignette: 0.5, accent: 'rgba(255,90,60,.55)' };
  if (o.fam === 'tripod') return { ring: 'bronze', ringW: 3.6, vignette: 0.45 };
  const id = o.parts[1] || '';
  if (id.startsWith('neg_')) return { ring: 'crimson', ringW: 4, vignette: 0.5 };
  if (CLASS_ENGR.has(id)) return { ring: 'gold', ringW: 4.6, vignette: 0.5 };
  return { ring: 'silver', ringW: 4, vignette: 0.5 };
}
const CLASS_ENGR = new Set(Object.values(ENGR_CLASS).flat());

const cache = new Map();
/** Cached data URL for an icon. Paint happens lazily on first request (typically 1–3 ms at 64 px). */
export function icon(id, size = 64, opts) {
  const o = parse(id, opts);
  const key = o.key + '|' + (size | 0);
  let u = cache.get(key);
  if (u === undefined) {
    if (typeof document === 'undefined') return '';
    u = iconCanvas(id, size, opts).toDataURL('image/png');
    cache.set(key, u);
  }
  return u;
}
/** Alias kept for code ported from Everdawn. */
export const iconURL = icon;

/**
 * Paint icons ahead of time in small idle slices (never blocks a frame for more than ~`budget` ms).
 * Returns a Promise that resolves when all are cached.
 */
export function preloadIcons(ids, size = 64, budget = 4) {
  const list = ids.slice();
  return new Promise(res => {
    const step = () => {
      const t0 = performance.now();
      while (list.length && performance.now() - t0 < budget) icon(list.shift(), size);
      if (!list.length) return res();
      (window.requestIdleCallback || (f => setTimeout(f, 16)))(step);
    };
    step();
  });
}

/** Grade colour ('#hex'). */
export function gradeColor(g) { return (GRADES[g] || GRADES[0]).color; }
/**
 * CSS `background` value for an item slot of a grade (dark top-left → grade colour bottom-right; Ancient beige,
 * Primal teal glow). Same look as the `grade:<n>` icons.
 */
export function gradeFrame(g) {
  g = Math.max(0, Math.min(7, g | 0));
  const p = GRADE_BG[g], col = GRADES[g].color;
  const hi = `radial-gradient(circle at 92% 96%, ${rgba(mix(col, '#ffffff', 0.25), g >= 6 ? 0.55 : 0.4)}, ${rgba(col, 0)} 70%)`;
  const glowL = g === 7 ? `radial-gradient(circle at 78% 80%, ${rgba('#39e6d8', 0.45)}, ${rgba('#39e6d8', 0)} 55%), ` : '';
  return `${glowL}${hi}, linear-gradient(135deg, ${p[0]} 0%, ${p[1]} 55%, ${p[2]} 100%)`;
}
/** CSS border colour for an item slot of a grade. */
export function gradeBorder(g) { return rgba(gradeColor(g), 0.75); }

/** Drop cached data URLs (e.g. after a device-pixel-ratio change). */
export function clearIconCache() { cache.clear(); }
