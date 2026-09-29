// META — leaderboards, share cards, challenge links, the combat meter and personal records (src/game/meta/README.md).
// Plugs into the session through the registry; module top level only declares + registers.
//
//   Windows: registerWindow('meter') (UI owner's compact meter, Y) · registerWindow('leaderboards') (UI owner's window)
//   Actions: 'results:share' · 'title:leaderboards' · 'share:*' · 'meter:reset' · 'lb:board' · chat /meter /lb /share /profile /challenge /records
//   Keys:    Backquote (input action 'meter') toggles the detailed Combat Meter panel
//   Bus:     clear (boards, records, challenge result, post-fight log) · hone · facet · collect · pvp · zone
//   Debug:   window.__meta (this plugin: meter, boards panel, share modal, lastCard …)
import { registerPlugin, registerWindow, registerAction, ACTIONS, LAUNCHERS } from '../registry.js';
import { Meter, MeterPanel } from './meter.js';
import { MetaUI, BoardsPanel, challengeWhat } from './ui.js';
import { ShareModal, clearData, infernoData, honeData, stoneData, profileData, copyText } from './share.js';
import * as B from './boards.js';
import { recordPB, pbLine, legionRaceNews } from './records.js';
import { readChallengeFromUrl, clearChallengeFromUrl, challengeFromClear, challengeLink, challengeText, contentFor, matches, recordAttempt, shareBase } from './challenge.js';
import { db, saveDb } from './store.js';
import { RAIDS } from '../../data/raids.js';
import { CLASSES } from '../../data/classes/index.js';
import { weekId } from '../../core/util.js';
import { itemLevel } from '../systems/stats.js';
import { clock, clockS, dur, short, pct, int, stoneLabel, pvpTier } from './fmt.js';

const isSupport = c => CLASSES[c]?.role === 'support';
const ROMAN = ['I', 'II', 'III', 'IV'];

class MetaPlugin {
  constructor() { this.id = 'meta'; this.s = null; this.lastClear = null; this.lastHone = null; this.lastStone = null; this.lb = { board: 'legion_first', variant: '' }; this.t2 = 0; this.tick2 = 0; }

  // ------------------------------------------------------------------------------------------------ setup
  init(s) {
    this.s = s;
    this.meter = new Meter(s);
    this.ui = new MetaUI(this);
    this.panel = new MeterPanel(this);
    this.boardsPanel = new BoardsPanel(this);
    this.shareModal = new ShareModal(this);
    this.claim();
    const on = (t, fn) => s.bus?.on?.(t, e => { try { fn(e || {}); } catch (err) { console.warn('[meta]', t, err); } });
    on('clear', e => this.onClear(e));
    on('hone', e => this.onHone(e));
    on('facet', e => this.onFacet(e));
    on('collect', () => { this.seedsDirty = 3; });
    on('pvp', () => { this.pvpDirty = 3; });
    on('zone', e => this.onZone(e));
    s.ui?.on?.('screen', p => this.onScreen(p?.name));
    s.game?.hooks?.frame?.push(dt => { try { this.frame(dt); } catch (e) { console.warn('[meta frame]', e); } });
    if (typeof addEventListener === 'function') addEventListener('keydown', e => this.onKey(e), true);
    const ch = readChallengeFromUrl();
    if (ch) { db().challenge = { ...ch, state: 'pending', got: Date.now() }; saveDb(true); clearChallengeFromUrl(); }
    if (typeof window !== 'undefined') window.__meta = this;
  }
  /** Own the leaderboards / meter windows and our actions. Runs at init, i.e. after every feature module registered
   *  (systems/hooks.js registers its own local 'leaderboards' window, 'lb:' and 'title:leaderboards' after us). */
  claim() {
    registerWindow('meter', () => this.meter.windowData(0));
    registerWindow('leaderboards', () => this.boardsWindow());
    const own = (key, fn) => { const prev = ACTIONS[key]; registerAction(key, (s, t, p) => fn(t, p || {}) || (prev ? prev(s, t, p) : false)); };
    own('results:', t => (t === 'results:share' ? (this.shareLastClear(), true) : false));
    own('title:', t => (t === 'title:leaderboards' ? (this.openBoards(), true) : false));
    registerAction('title:leaderboards', () => { this.openBoards(); return true; });
    own('share:', (t, p) => this.onShareAction(t, p));
    own('meter:', t => (t === 'meter:reset' ? (this.meter.reset(), this.s.ui?.update?.('meter', this.meter.windowData(0)), true) : false));
    own('lb:', (t, p) => {
      if (t !== 'lb:board') return false;
      const { board, variant } = B.parseBoardId(p.board, p.sub); this.lb = { board, variant };
      this.s.ui?.update?.('leaderboards', this.boardsWindow());
      return true;
    });
    own('chat:command', (t, p) => this.command(String(p.cmd || '').toLowerCase(), p));
  }

  // ------------------------------------------------------------------------------------------------ frame
  update(dt) {
    const s = this.s, inp = s.game?.input;
    this.meter.update(dt);
    if (inp?.hit?.('meter') && !s.ui?.wantsKeyboard) this.toggleMeter();
    if (this.seedsDirty && --this.seedsDirty === 0) this.postSeeds();
    if (this.pvpDirty && --this.pvpDirty === 0) this.postPvp();
  }
  /** every frame, any screen: panel refresh and the UI meter window feed (the results screen keeps session.screen
   *  'game', so update() — and Backquote — keep working there) */
  frame(dt) {
    const s = this.s;
    this.t2 -= dt;
    if (this.t2 <= 0) {
      this.t2 = 0.25; this.tick2++;
      this.panel.render();
      if (this.tick2 % 2 === 0 && s.ui?.isOpen?.('meter')) s.ui.update('meter', this.meter.windowData(0));
    }
    // systems' stone window: 'stone:share' leaves the card on session.shareCard
    if (s.shareCard && s.shareCard !== this.seenCard) {
      this.seenCard = s.shareCard;
      if (s.shareCard.kind === 'stone') this.share('stone', stoneData(this, s.shareCard));
      else if (s.shareCard.kind === 'hone') this.share('hone', honeData(this, s.shareCard));
    }
  }
  toggleMeter() { const t = this.s.game?.time; if (this.toggledAt === t) return; this.toggledAt = t; this.panel.toggle(); }
  onKey(e) {
    if (!this.ui) return;
    const tag = e.target?.tagName;
    if (this.ui.modalOpen) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.ui.escape(); return; }
      // a meta modal is up: don't let the screen behind it (title menu, results "Continue", combat keys) act
      if (!/INPUT|TEXTAREA/.test(tag || '') && !(e.key === 'Enter' && tag === 'BUTTON')) e.stopImmediatePropagation();
    }
  }
  onScreen(name) {
    if (name === 'title') this.showTitleChallenge(); else this.ui.hideTitleChallenge();
    const menus = name === 'title' || name === 'charselect' || name === 'create';
    if (menus) this.panel.close();
    if (this.boardsPanel.isOpen && name !== 'title' && name !== 'game') this.boardsPanel.close();
    if (this.shareModal.isOpen && (menus || name === 'loading')) this.shareModal.close();
  }

  // ------------------------------------------------------------------------------------------------ clears
  base(extra = {}) {
    const s = this.s, ch = s.char;
    return { name: ch.name, cls: ch.cls, guild: s.account?.roster?.guild?.name || null, premade: !!ch.premade, coop: !!(s.game?.net || s.guestMode), ...extra };
  }
  onClear(e) {
    const s = this.s, c = e.content || {}, r = e.result || {}, ch = s.char;
    const seg = this.meter.onClear(c, r);
    if (!ch) return;
    const now = Date.now();
    const clear = this.lastClear = { content: c, result: r, char: ch, t: now, board: null, badges: [] };
    const notes = [];
    const act = db().challenge;
    if (!r.cleared) {
      if (act && act.state !== 'beaten' && act.state !== 'declined' && matches(act, c)) { recordAttempt(act, c, r); notes.push({ over: 'Challenge', text: `${act.name}’s ${challengeWhat(act).value} still stands`, sub: 'Regroup and try again.', kind: 'bad', glyph: 'sword' }); }
      return this.flush(notes);
    }
    const party = (r.meter || []).map(m => m.cls), me = (r.meter || []).find(m => m.you) || null;
    const chal = challengeFromClear(c, r, ch);
    const trial = !!c.trial;
    const post = (board, variant, value, sub) => B.submit({ ...this.base({ trial, party }), board, variant, value, sub, extra: { ch: chal } });
    const pb = (key, label, v, better, unit, sub, icon) => {
      const res = recordPB(s.account, key, v, better, { name: ch.name, cls: ch.cls, sub, label, unit });
      if (res.improved) { notes.push({ over: res.first ? 'First clear' : 'New personal best', text: pbLine(label, unit, v, res.prev), sub: sub || '', kind: 'gold', icon }); if (!clear.badges.includes('Personal best')) clear.badges.push(res.first ? 'First clear' : 'Personal best'); }
      return res;
    };
    const deathsTxt = r.deaths === 0 ? 'Deathless' : r.deaths != null ? `${r.deaths} death${r.deaths === 1 ? '' : 's'}` : '';
    if (c.kind === 'guardian' && c.boss) {
      const name = B.bossName(c.boss);
      pb(`guardian:${c.boss}`, name, r.time, 'lower', 'time', deathsTxt, `boss:${c.boss}`);
      if (c.boss === B.todaysGuardian(now)) {
        const res = post('guardian', '', r.time, deathsTxt);
        if (res?.rank) { clear.board = { label: 'today', rank: res.rank, total: res.total }; notes.push({ over: 'Daily Guardian', text: `#${int(res.rank)} of ${int(res.total)} today`, sub: `${name} · ${clock(r.time)}${res.improved ? '' : ' · your best stands'}`, kind: 'info', icon: `boss:${c.boss}` }); }
      }
    } else if (c.kind === 'raid' && RAIDS[c.raid]) {
      const R = RAIDS[c.raid], gate = c.gate ?? 0, mode = c.hard ? 'hm' : 'nm', modeName = c.hard ? 'Hard' : 'Normal';
      const bossIcon = `boss:${R.gates[gate]?.bosses?.slice(-1)[0]?.boss}`;
      pb(`raid:${c.raid}:g${gate + 1}:${mode}`, `${R.kind === 'legion' ? 'Gorrath' : R.name} G${gate + 1}${R.kind === 'legion' ? ` ${modeName}` : ''}`, r.time, 'lower', 'time', deathsTxt, bossIcon);
      if (R.kind === 'legion') {
        const wk = 'w' + weekId(now), D0 = db();
        let prog = D0.raids[ch.id]; if (!prog || prog.week !== wk) prog = D0.raids[ch.id] = { week: wk };
        const g = prog[mode] ||= {};
        g['g' + gate] = Math.min(g['g' + gate] ?? Infinity, r.time); saveDb();
        const il = Math.floor(itemLevel(ch));
        const res = post(`legion_${mode}`, `g${gate + 1}`, r.time, `${deathsTxt || 'Cleared'} · iLvl ${int(il)}${trial ? ' (trial)' : ''}`);
        if (res?.rank) { clear.board = { label: 'this week', rank: res.rank, total: res.total }; notes.push({ over: 'Weekly Legion Race', text: `#${int(res.rank)} · Gate ${gate + 1} ${modeName}`, sub: `${clock(r.time)} of ${int(res.total)} clears this week`, kind: 'info', icon: bossIcon }); }
        if (g.g0 != null && g.g1 != null) {
          const full = g.g0 + g.g1;
          post(`legion_${mode}`, 'full', full, `${modeName} · G1 ${clock(g.g0)} + G2 ${clock(g.g1)}`);
          pb(`raid:${c.raid}:full:${mode}`, `Gorrath ${modeName} full raid`, full, 'lower', 'time', 'best gate times this week');
          if (gate === R.gates.length - 1 && !prog.first) {
            prog.first = now; saveDb();
            const after = now - B.weekStart(now), wf = post('legion_first', '', after, `${modeName} · ${clock(full)}`);
            if (wf?.rank) { clear.badges.push(`World First #${wf.rank}`); notes.push({ over: 'World First race', text: `#${int(wf.rank)} full clear of the week`, sub: `${dur(after)} after the reset`, kind: 'gold', glyph: 'crown' }); }
          }
        }
        if (me && !isSupport(ch.cls)) { const d = post('legion_dps', ch.cls, me.dps, `Gate ${gate + 1} · ${modeName}`); pb(`dps:legion:${ch.cls}`, `${CLASSES[ch.cls]?.name} raid DPS`, me.dps, 'higher', 'dps', `Gate ${gate + 1} · ${modeName}`); if (d?.rank && d.rank <= 10) notes.push({ over: `Top DPS · ${CLASSES[ch.cls]?.name}`, text: `#${d.rank} this week — ${short(me.dps)} DPS`, kind: 'gold', glyph: 'bolt' }); }
        if (me && isSupport(ch.cls)) { const sc = this.supportScore(me, r); const d = post('legion_support', '', sc.score, sc.sub); if (d?.rank && d.rank <= 10) notes.push({ over: 'Top Support', text: `#${d.rank} this week — score ${sc.score}`, sub: sc.sub, kind: 'gold', glyph: 'shield' }); }
        if (r.deaths === 0) post('legion_deathless', '', r.time, `Gate ${gate + 1} · ${modeName}`);
      }
    } else if (c.kind === 'chaos') {
      pb(`chaos:${c.tier || 1}`, `Demon Rift ${ROMAN[(c.tier || 1) - 1] || ''}`.trim(), r.time, 'lower', 'time', r.kills ? `${r.kills} kills` : '', 'boss:gatekeeper');
    } else if (c.kind === 'inferno') {
      const fl = r.floor || 0;
      if (fl > 0) {
        const res = post('inferno', 'deepest', fl, `in ${clockS(r.time || 0)}${c.start > 1 ? ` · from floor ${c.start}` : ''}`);
        if (res?.rank) clear.board = { label: 'this week', rank: res.rank, total: res.total };
        pb('inferno:deepest', 'Inferno depth', fl, 'higher', 'floor', `in ${clockS(r.time || 0)}`, 'boss:gatekeeper');
        if (fl >= 100 && (c.start || 1) === 1) { post('inferno', 'fastest100', r.time, `${r.kills || 0} kills`); pb('inferno:100', 'Inferno 1→100', r.time, 'lower', 'time', '', 'boss:gatekeeper'); }
      }
    }
    if (r.deaths === 0 && (r.meter || []).length > 1) clear.badges.push('Deathless');
    if (ch.premade) clear.badges.push('Premade');
    if (trial) clear.badges.push('Trial');
    // a challenge accepted through a link
    if (act && act.state !== 'beaten' && act.state !== 'declined' && matches(act, c)) {
      const o = recordAttempt(act, c, r);
      const fmtv = v => (act.kind === 'inferno' ? `floor ${v}` : clock(v || 0));
      if (o.beaten) { clear.badges.push(`Beat ${act.name}`); notes.unshift({ over: 'Challenge beaten!', text: `You beat ${act.name}’s ${fmtv(o.theirs)}`, sub: `Your ${act.kind === 'inferno' ? 'depth' : 'time'}: ${fmtv(o.mine)}`, kind: 'good', glyph: 'sword', action: { label: 'Send it back', fn: () => this.shareLastClear() } }); }
      else notes.unshift({ over: 'Challenge', text: `Not this time — ${fmtv(o.mine)} vs ${fmtv(o.theirs)}`, sub: `${act.name} still leads. Retry from the results screen.`, kind: 'bad', glyph: 'sword' });
    }
    this.flush(notes);
  }
  flush(notes) { notes.slice(0, 4).forEach((n, i) => setTimeout(() => this.ui.ribbon({ dur: 9, ...n }), 1100 + i * 500)); }
  supportScore(me, r) {
    const sup = this.meter.supportOf(me.name) || {};
    const taken = (r.meter || []).reduce((a, m) => a + (m.taken || 0), 0) || sup.taken || 0;
    const shield = me.shield || sup.shield || 0, heal = me.heal || sup.heal || 0;
    const prot = Math.min(1, (shield + heal) / Math.max(1, taken));
    const up = sup.uptime;
    const score = Math.round(100 * (up != null ? 0.6 * up + 0.4 * prot : 0.8 * prot));
    return { score, sub: `${up != null ? `Uptime ${pct(up)} · ` : ''}${short(shield)} shields · ${short(heal)} heals` };
  }

  // ------------------------------------------------------------------------------------------------ honing, stones, seeds, pvp
  onHone(e) {
    const it = e.item, s = this.s; if (!it || !s.char) return;
    const key = it.uid || `${it.slot}:${it.set}`, D0 = db(), tr = D0.hone[key] ||= { to: null, taps: 0, surv: 1, energy: 0, base: null };
    if (!e.success) {
      const to = (it.hone || 0) + 1;
      if (tr.to !== to) Object.assign(tr, { to, taps: 0, surv: 1, energy: 0, base: e.chance ?? null });
      tr.taps++; tr.surv *= 1 - Math.min(1, e.chance || 0); tr.energy = e.energy || 0; saveDb();
      return;
    }
    const to = it.hone || 0, same = tr.to === to;
    const sh = s.account?.roster?.stats?.honing?.history?.[0];
    const fresh = sh && sh.to === to && Math.abs(Date.now() - (sh.t || 0)) < 15000 ? sh : null;
    let taps = same ? tr.taps + 1 : 1;
    if (it.honeLog?.to === to && it.honeLog.taps) taps = it.honeLog.taps;
    if (fresh?.taps) taps = fresh.taps;
    const guaranteed = fresh ? !!fresh.guaranteed : (same && tr.energy >= 1) || (e.chance ?? 0) >= 1;
    const odds = fresh && fresh.luck != null && !fresh.guaranteed ? Math.max(0.0005, 1 - fresh.luck) : Math.max(0.0005, 1 - (same ? tr.surv : 1) * (1 - Math.min(1, e.chance || 0)));
    delete D0.hone[key]; saveDb();
    const rec = this.lastHone = { item: { name: it.name, icon: it.icon, grade: it.grade, slot: it.slot, iLvl: it.iLvl }, to, taps, chance: e.chance, base: fresh?.base ?? (same ? tr.base : e.chance) ?? e.chance,
      energy: fresh?.energy ?? (same ? tr.energy : 0), luck: fresh?.luck ?? (guaranteed ? null : 1 - odds), odds, guaranteed, t: Date.now() };
    if (!guaranteed && to >= 10 && odds < 0.999) {
      B.submit({ ...this.base(), board: 'honing', value: odds, sub: `+${to} in ${taps} tap${taps > 1 ? 's' : ''}${it.name ? ` · ${it.name}` : ''}` });
      const res = recordPB(s.account, 'hone:luck', odds, 'lower', { name: s.char.name, cls: s.char.cls, label: 'Luckiest honing', unit: 'luck', sub: `+${to} in ${taps} tap${taps > 1 ? 's' : ''}` });
      if (res.improved && !res.first) this.ui.note(`Luckiest honing yet: +${to} in ${taps} tap${taps > 1 ? 's' : ''} (1 in ${int(1 / odds)})`, 'success');
    }
    if (to >= 15 || (odds < 0.3 && to >= 8)) setTimeout(() => this.ui.pill({ text: `+${to} in ${taps} tap${taps > 1 ? 's' : ''}!`, sub: guaranteed ? 'Artisan’s Energy came through' : `1-in-${int(Math.max(1, 1 / odds))} luck · ${it.name || ''}`, icon: it.icon, fn: () => this.share('hone', honeData(this, rec)) }), 1400);
  }
  onFacet(e) {
    const v = e.stone, s = this.s; if (!v?.done || !s.char) return;
    const sc = v.score || (v.lines || []).map(l => l.nodes || 0);
    const [a, b] = [sc[0] || 0, sc[1] || 0].sort((x, y) => y - x), neg = sc[2] || 0;
    const value = B.stoneValue(a, b, neg), label = stoneLabel(a, b);
    this.lastStone = v;
    const names = (v.lines || []).map(l => l.name);
    B.submit({ ...this.base(), board: 'stone', value, sub: `${names[0] || ''} ${sc[0]} · ${names[1] || ''} ${sc[1]} · −${neg}` });
    const res = recordPB(s.account, 'stone:best', value, 'higher', { name: s.char.name, cls: s.char.cls, label: 'Best ability stone', unit: 'stone', sub: `${names[0] || ''} ${sc[0]} · ${names[1] || ''} ${sc[1]}` });
    if (res.improved && !res.first) this.ui.note(`Best stone yet: ${label}`, 'success');
    if ((a >= 9 && b >= 7) || a + b >= 14) setTimeout(() => this.ui.pill({ text: `${label} stone!`, sub: `${names[0] || ''} ${sc[0]} · ${names[1] || ''} ${sc[1]} · −${neg}`, icon: 'item:stone', fn: () => this.share('stone', stoneData(this, v)) }), 900);
  }
  postSeeds() {
    const A = this.s.account, n = A?.roster?.collect?.seeds?.length || 0; if (!n || !this.s.char) return;
    B.submit({ ...this.base(), board: 'seeds', value: n, sub: `${pct(n / B.SEED_TOTAL)} of Solmara` });
  }
  postPvp() {
    const p = this.s.account?.roster?.pvp; if (!p || !this.s.char || !(p.wins + p.losses > 0)) return;
    B.submit({ ...this.base(), board: 'pvp', value: p.rating, sub: `${pvpTier(p.rating)} · ${p.wins}W ${p.losses}L` });
  }

  // ------------------------------------------------------------------------------------------------ challenges
  showTitleChallenge() {
    const ch = db().challenge;
    if (!ch || !['pending', 'accepted', 'later'].includes(ch.state)) return this.ui.hideTitleChallenge();
    this.ui.titleChallenge(ch, {
      onAccept: () => { ch.state = 'accepted'; saveDb(); },
      onDismiss: () => { ch.state = 'declined'; saveDb(); },
    });
  }
  onZone(e) {
    const s = this.s; if (!s.char) return;
    if (!this.synced) { this.synced = true; this.postSeeds(); this.postPvp(); }
    const ch = db().challenge;
    if (!ch || !['pending', 'accepted', 'later'].includes(ch.state) || this.offered || s.guestMode) return;
    if (e.kind !== 'city' && s.game?.mode?.kind !== 'city') return;
    this.offered = true;
    setTimeout(() => this.offerChallenge(), 1600);
  }
  async offerChallenge() {
    const s = this.s, ch = db().challenge; if (!ch || s.screen !== 'game' || !s.char) return;
    const w = challengeWhat(ch), f = contentFor(ch, s.char);
    const ok = await s.ui.confirm({ title: `${ch.name} challenges you`, text: `${ch.name} (${CLASSES[ch.cls]?.name || 'Shardbearer'}) — ${w.title}: ${w.value}${w.sub ? ` · ${w.sub}` : ''}.\n\n${f.ok ? (f.trial ? 'Your item level is below the raid’s, so you will enter as a Trial (stats raised to the minimum).\n\n' : '') + 'Open the rift and try to beat it?' : `This needs item level ${f.need}. Hone your gear first — the challenge will wait.`}`, ok: f.ok ? 'Take the challenge' : 'Understood', cancel: 'Later' });
    if (!ok || !f.ok || !f.c) { ch.state = 'later'; saveDb(); return; }
    if (f.c.kind === 'inferno' && !LAUNCHERS.inferno) { s.ui.toast('The Inferno is sealed in this build.', 'warn'); return; }
    ch.state = 'accepted'; ch.launchedAt = Date.now(); saveDb();
    await s.launch(f.c);
  }
  challengeFromBoard(board, variant) {
    const best = B.myBest(board, variant);
    const ch = best?.extra?.ch;
    const say = m => this.ui.ribbon({ text: m, kind: 'info', glyph: 'send', dur: 5 });
    if (ch) copyText(`${challengeText(ch)} ${challengeLink(ch)}`, say);
    else { const def = B.defOf(board, variant); copyText(`Can you beat my ${def?.label || 'record'}${best ? ` (${B.fmtValue(def.unit, best.value)})` : ''} on SEVENSHARD? ${shareBase()}`, say); }
  }
  playBoard(board) {
    const s = this.s; if (!s.char || s.screen !== 'game' || s.guestMode) return;
    this.boardsPanel.close();
    if (board === 'guardian') return s.launch({ kind: 'guardian', boss: B.todaysGuardian() });
    if (board === 'inferno' && LAUNCHERS.inferno) return s.launch({ kind: 'inferno', start: 1, party: 1 });
    return s.contentMenu?.('raid');
  }

  // ------------------------------------------------------------------------------------------------ sharing
  share(kind, data, o = {}) { return this.shareModal.open(kind, data, o); }
  shareLastClear() {
    const lc = this.lastClear;
    if (!lc) { this.ui.ribbon({ text: 'Nothing to share yet — clear something first!', kind: 'info', glyph: 'share', dur: 4 }); return null; }
    const inferno = lc.content?.kind === 'inferno';
    return this.share(inferno ? 'inferno' : 'clear', inferno ? infernoData(this, lc) : clearData(this, lc), { challenge: challengeFromClear(lc.content, lc.result, lc.char) });
  }
  shareProfile() { if (!this.s.char) return null; return this.share('profile', profileData(this)); }
  onShareAction(t, p) {
    switch (t) {
      case 'share:clear': return !!(p.content ? this.share(p.content.kind === 'inferno' ? 'inferno' : 'clear', clearData(this, { t: Date.now(), badges: [], ...p })) : this.shareLastClear()) || true;
      case 'share:hone': { const h = p.to ? p : this.lastHone; if (h) this.share('hone', honeData(this, h)); return true; }
      case 'share:stone': { const v = p.lines ? p : p.stone || this.lastStone; if (v) this.share('stone', stoneData(this, v)); return true; }
      case 'share:profile': this.shareProfile(); return true;
      case 'share:inferno': { const lc = p.result ? p : this.lastClear; if (lc) this.share('inferno', infernoData(this, lc)); return true; }
      case 'share:card': if (p.kind) this.share(p.kind, p.data || {}, p.opts || {}); return true;
      case 'share:boards': this.openBoards(p.board, p.variant); return true;
      case 'share:meter': this.toggleMeter(); return true;
      case 'share:challenge': { const lc = this.lastClear, ch = lc && challengeFromClear(lc.content, lc.result, lc.char); if (ch) copyText(`${challengeText(ch)} ${challengeLink(ch)}`, m => this.ui.note(m, 'info', { force: true })); return true; }
    }
    return false;
  }
  command(cmd) {
    if (cmd === 'meter' || cmd === 'dps' || cmd === 'log') { this.toggleMeter(); return true; }
    if (cmd === 'lb' || cmd === 'boards' || cmd === 'leaderboards' || cmd === 'race') { this.openBoards(); return true; }
    if (cmd === 'records' || cmd === 'pb') { this.openBoards('records'); return true; }
    if (cmd === 'share') { if (this.lastClear) this.shareLastClear(); else this.shareProfile(); return true; }
    if (cmd === 'profile' || cmd === 'card') { this.shareProfile(); return true; }
    if (cmd === 'challenge') { if (db().challenge && ['pending', 'accepted', 'later'].includes(db().challenge.state)) this.offerChallenge(); else this.onShareAction('share:challenge', {}); return true; }
    return false;
  }

  // ------------------------------------------------------------------------------------------------ boards
  openBoards(board, variant) { this.boardsPanel.open(board, variant); }
  boardsWindow() { return B.windowData(this.lb.board, this.lb.variant); }
}

export const meta = registerPlugin(new MetaPlugin());
// Registered here as well (the plugin re-claims them at init, after modules that register the same keys).
registerWindow('meter', () => meta.meter?.windowData(0) || null);
registerWindow('leaderboards', () => meta.boardsWindow());
registerAction('results:', (s, t) => (t === 'results:share' ? (meta.shareLastClear(), true) : false));
registerAction('title:', (s, t) => (t === 'title:leaderboards' ? (meta.openBoards(), true) : false));

/** For the lead: title news, board access, cards. */
export { legionRaceNews };
export const openBoards = (board, variant) => meta.openBoards(board, variant);
export const shareCard = (kind, data, o) => meta.share(kind, data, o);
export { renderCard } from './cards.js';
export { boardView, submit as submitBoardEntry, addFriendEntries, shareableEntries, todaysGuardian, BOARDS } from './boards.js';
