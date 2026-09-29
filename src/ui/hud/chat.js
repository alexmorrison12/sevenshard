// Chat (bottom-left): tabs All / Area / Party / Guild / Whisper / System, a scrolling log, and an input with
// slash commands. ui.chat.add({ channel, from, text, you?, cls?, item? }).
// Sending emits 'chat:send' { channel, text, to? }; other slash commands emit 'chat:command' { cmd, args, raw }.
//   /s /say → area   /y /shout → shout   /p /party → party   /ra /raid → raid   /g /guild → guild
//   /w /whisper <name> <text> → whisper   /r /reply → last whisper   /help → local help
import { h, setCls, esc, btn } from '../core/util.js';
import { glyph } from '../core/glyphs.js';
import { grade } from '../core/data.js';

export const CHANNELS = {
  area: { name: 'Area', c: '#e8ebf3' },
  shout: { name: 'Shout', c: '#ffb49a' },
  party: { name: 'Party', c: '#72c8ff' },
  raid: { name: 'Raid', c: '#ff9a4a' },
  guild: { name: 'Guild', c: '#86e070' },
  whisper: { name: 'Whisper', c: '#e28cff' },
  system: { name: 'System', c: '#ffd35a' },
  loot: { name: 'Loot', c: '#bcc4d6' },
  npc: { name: 'NPC', c: '#f5e2b0' },
  world: { name: 'World', c: '#9fe0d8' },
};
const TABS = [
  { id: 'all', name: 'All', show: null },
  { id: 'area', name: 'Area', show: ['area', 'shout', 'npc', 'world'] },
  { id: 'party', name: 'Party', show: ['party', 'raid'] },
  { id: 'guild', name: 'Guild', show: ['guild'] },
  { id: 'whisper', name: 'Whisper', show: ['whisper'] },
  { id: 'system', name: 'System', show: ['system', 'loot'] },
];
const CMD = { s: 'area', say: 'area', y: 'shout', shout: 'shout', p: 'party', party: 'party', ra: 'raid', raid: 'raid', g: 'guild', guild: 'guild', world: 'world', '1': 'world' };
const MAX = 200;

export class Chat {
  constructor(ui, parent) {
    this.ui = ui;
    const el = this.el = h('div', 'ss-chat ss-ptr', parent);
    el.dataset.tab = 'all';
    const tabs = h('div', 'ss-chat-tabs', el);
    tabs.setAttribute('role', 'tablist');
    this.tabs = {};
    for (const t of TABS) {
      const b = btn('ss-chat-tab', tabs, t.name, () => this.setTab(t.id));
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', t.id === 'all');
      this.tabs[t.id] = b;
    }
    this.log = h('div', 'ss-chat-log ss-scroll', el);
    this.log.setAttribute('role', 'log');
    this.log.setAttribute('aria-live', 'polite');
    const row = h('div', 'ss-chat-in', el);
    this.chan = h('button', 'ss-chat-ch', row);
    this.chan.type = 'button';
    this.chan.setAttribute('aria-label', 'Chat channel');
    this.chan.addEventListener('click', () => this.cycle());
    this.input = h('input', 'ss-chat-input', row);
    this.input.type = 'text'; this.input.maxLength = 200; this.input.placeholder = 'Press Enter to chat';
    this.input.setAttribute('aria-label', 'Chat message');
    this.input.spellcheck = false; this.input.autocomplete = 'off';
    const send = btn('ss-chat-send', row, null, () => this.submit(), 'Send');
    send.innerHTML = glyph('send');
    this.channel = 'area'; this.lastWhisper = null; this.history = []; this.hi = -1;
    this.setChannel('area');
    this.input.addEventListener('keydown', e => this.key(e));
    this.input.addEventListener('input', () => this.sniff());
    this.input.addEventListener('focus', () => { setCls(el, 'is-typing', true); ui._typing(true); });
    this.input.addEventListener('blur', () => { setCls(el, 'is-typing', false); ui._typing(false); });
    this.stick = true;
    this.log.addEventListener('scroll', () => { this.stick = this.log.scrollTop + this.log.clientHeight >= this.log.scrollHeight - 8; });
  }
  setTab(id) {
    this.el.dataset.tab = id;
    for (const [k, b] of Object.entries(this.tabs)) { b.setAttribute('aria-selected', k === id); if (k === id) setCls(b, 'is-unread', false); }
    if (id === 'party') this.setChannel('party'); else if (id === 'guild') this.setChannel('guild'); else if (id === 'whisper' && this.lastWhisper) this.setChannel('whisper', this.lastWhisper); else if (id === 'area' || id === 'all') this.setChannel('area');
    this.log.scrollTop = this.log.scrollHeight;
  }
  setChannel(ch, to) {
    this.channel = ch; this.to = to || null;
    const c = CHANNELS[ch] || CHANNELS.area;
    this.chan.textContent = ch === 'whisper' && to ? `To ${to}` : c.name;
    this.chan.style.color = c.c;
    this.input.style.color = c.c;
  }
  cycle() {
    const order = ['area', 'party', 'guild', 'shout'];
    const i = order.indexOf(this.channel);
    this.setChannel(order[(i + 1) % order.length]);
  }
  /** Turn a typed "/p " prefix into a sticky channel switch (and strip it). */
  sniff() {
    const v = this.input.value;
    const m = v.match(/^\/(\w+)\s(.*)$/s);
    if (!m) return;
    const cmd = m[1].toLowerCase();
    if (CMD[cmd]) { this.setChannel(CMD[cmd]); this.input.value = m[2]; }
    else if ((cmd === 'w' || cmd === 'whisper' || cmd === 't' || cmd === 'tell')) {
      const w = m[2].match(/^(\S+)\s(.*)$/s);
      if (w) { this.setChannel('whisper', w[1]); this.input.value = w[2]; }
    } else if ((cmd === 'r' || cmd === 'reply') && this.lastWhisper) { this.setChannel('whisper', this.lastWhisper); this.input.value = m[2]; }
  }
  key(e) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
    else if (e.key === 'Escape') { e.preventDefault(); this.input.value = ''; this.input.blur(); }
    else if (e.key === 'ArrowUp' && this.history.length) { e.preventDefault(); this.hi = Math.min(this.history.length - 1, this.hi + 1); this.input.value = this.history[this.history.length - 1 - this.hi]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); this.hi = Math.max(-1, this.hi - 1); this.input.value = this.hi >= 0 ? this.history[this.history.length - 1 - this.hi] : ''; }
    else if (e.key === 'Tab') { e.preventDefault(); this.cycle(); }
  }
  submit() {
    const raw = this.input.value.trim();
    this.input.value = ''; this.hi = -1;
    if (!raw) { this.input.blur(); return; }
    this.history.push(raw); if (this.history.length > 40) this.history.shift();
    if (raw.startsWith('/')) {
      const [cmd0, ...rest] = raw.slice(1).split(/\s+/);
      const cmd = (cmd0 || '').toLowerCase();
      if (cmd === 'help' || cmd === '?') { this.help(); return; }
      if (CMD[cmd] && rest.length) { this.ui.emit('chat:send', { channel: CMD[cmd], text: rest.join(' ') }); return; }
      if ((cmd === 'w' || cmd === 'whisper') && rest.length > 1) { this.lastWhisper = rest[0]; this.ui.emit('chat:send', { channel: 'whisper', to: rest[0], text: rest.slice(1).join(' ') }); return; }
      this.ui.emit('chat:command', { cmd, args: rest, raw });
      return;
    }
    this.ui.emit('chat:send', { channel: this.channel, text: raw, ...(this.to ? { to: this.to } : {}) });
  }
  help() {
    this.add({ channel: 'system', text: 'Chat: /s say · /y shout · /p party · /ra raid · /g guild · /w <name> whisper · /r reply. Tab cycles channels, ↑ recalls.' });
  }
  focus(prefill = '') {
    this.input.focus();
    if (prefill) { this.input.value = prefill; this.input.setSelectionRange(prefill.length, prefill.length); }
  }
  get typing() { return document.activeElement === this.input; }
  /** msg: { channel, from?, text, you?, cls?, item?: Item, time? } */
  add(msg) {
    if (typeof msg === 'string') msg = { channel: 'system', text: msg };
    const ch = CHANNELS[msg.channel] ? msg.channel : 'area';
    const c = CHANNELS[ch];
    const row = document.createElement('div');
    row.className = 'ss-cm';
    row.dataset.ch = ch;
    row.style.color = c.c;
    let html = '';
    if (ch !== 'area' && ch !== 'system' && ch !== 'loot') html += `<span class="ss-cm-ch">[${c.name}]</span> `;
    if (msg.from) {
      if (ch === 'whisper') html += msg.you ? `<span class="ss-cm-from">To ${esc(msg.to || msg.from)}:</span> ` : `<span class="ss-cm-from">${esc(msg.from)} whispers:</span> `;
      else html += `<span class="ss-cm-from${msg.you ? ' is-you' : ''}">${esc(msg.from)}:</span> `;
    }
    html += esc(msg.text || '');
    if (msg.item) { const g = grade(msg.item.grade); html += ` <span class="ss-cm-item" style="color:${g.c}">[${esc(msg.item.name)}]</span>${msg.item.count > 1 ? ' ×' + msg.item.count : ''}`; }
    row.innerHTML = html;
    if (msg.item) { const it = row.querySelector('.ss-cm-item'); it._tip = { kind: 'item', item: msg.item }; }
    if (ch === 'whisper' && msg.from && !msg.you) this.lastWhisper = msg.from;
    this.log.appendChild(row);
    while (this.log.childElementCount > MAX) this.log.firstElementChild.remove();
    if (this.stick) this.log.scrollTop = this.log.scrollHeight;
    // unread dot on tabs that would show it but are not active
    const tab = this.el.dataset.tab;
    if (ch === 'whisper' && tab !== 'whisper' && !msg.you) setCls(this.tabs.whisper, 'is-unread', true);
    return row;
  }
  clear() { this.log.textContent = ''; }
}
