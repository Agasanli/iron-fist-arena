import { settings, setSetting, saveSettings, resetBindings, prettyKey } from '../game/settings.js';
import { ARENAS, ACTIONS, ACTION_LABELS, DIFFICULTIES, LAPTOP_P2, DEFAULT_BINDINGS } from '../game/config.js';
import { CHARACTERS, CHARACTER_IDS } from '../entities/characters.js';
import { getPortrait } from '../game/Sprites.js';
import { audio } from '../audio/AudioEngine.js';
import { WEAPONS, WEAPON_IDS, weaponIcon, weaponBars } from '../entities/weapons.js';
import { SHIELDS, SHIELD_IDS, shieldIcon, shieldBars } from '../entities/shields.js';
import { RANGED, RANGED_IDS, rangedIcon, rangedBars } from '../entities/ranged.js';
import { buildOffline, teamSlots } from '../game/matchSetup.js';
import { checkNetwork } from '../net/Session.js';

// the three pieces of gear every fighter can carry
const GEAR = {
  weapon: { label: 'WEAPON', ids: WEAPON_IDS, data: WEAPONS, key: 'Weapon', none: 'fists', icon: weaponIcon,
    bars: (id) => { const b = weaponBars(id); return [['REACH', b.range], ['POWER', b.damage], ['SPEED', b.speed]]; } },
  shield: { label: 'SHIELD', ids: SHIELD_IDS, data: SHIELDS, key: 'Shield', none: 'none', icon: shieldIcon, bars: shieldBars },
  ranged: { label: 'RANGED', ids: RANGED_IDS, data: RANGED, key: 'Ranged', none: 'none', icon: rangedIcon, bars: rangedBars },
};
const gearKey = (kind, p) => (p ? 'p2' : 'p1') + GEAR[kind].key;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled])';
const RESERVED = new Set(['Escape', 'Enter', 'Backspace', 'F5', 'F11', 'F12']);

const MODE_TITLES = {
  ai: 'FIGHT AGAINST AI', versus: 'LOCAL MULTIPLAYER', training: 'TRAINING MODE', pick: 'CHARACTER SELECTION',
};

/** Menu / overlay screens (DOM). One visible at a time; a small history stack gives Back behaviour. */
export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.stack = [];
    this.current = null;
    this.rebinding = null;
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('input', (e) => this.onInput(e));
    root.addEventListener('change', (e) => this.onInput(e));
    root.addEventListener('mouseover', (e) => {
      const b = e.target.closest && e.target.closest('.btn');
      if (b && document.activeElement !== b && !this.rebinding) b.focus({ preventScroll: true });
    });
    this._key = (e) => this.onKey(e);
    window.addEventListener('keydown', this._key);
  }

  destroy() { window.removeEventListener('keydown', this._key); }

  get open() { return !!this.current; }

  // ------------------------------------------------------------ navigation
  show(name, params = {}, push = true) {
    if (this.current && push) this.stack.push(this.current);
    this.current = { name, params };
    this.render();
  }

  replace(name, params = {}) { this.current = { name, params }; this.render(); }

  back() {
    if (this.rebinding) return;
    const prev = this.stack.pop();
    audio.sfx('menuBack');
    if (prev) { this.current = prev; this.render(); } else if (this.current && this.current.name !== 'main' && !this.game.match) this.show('main', {}, false);
  }

  hide() {
    this.current = null; this.stack.length = 0;
    this.root.innerHTML = '';
    this.root.className = 'hidden';
    this.game.input.gameActive = !!this.game.match;
  }

  clearStack() { this.stack.length = 0; }

  render() {
    const { name, params } = this.current;
    const fn = this['screen_' + name];
    this.root.className = `screen-${name}` + (this.game.match ? ' in-match' : '');
    this.root.innerHTML = fn.call(this, params);
    this.game.input.gameActive = false;
    const first = this.root.querySelector('[data-autofocus]') || this.root.querySelector(FOCUSABLE);
    if (first) first.focus({ preventScroll: true });
    if (this['after_' + name]) this['after_' + name](params);
  }

  // ------------------------------------------------------------ events
  onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    audio.unlock();
    const act = t.dataset.act;
    if (act === 'rebind') { this.startRebind(t); return; }
    audio.sfx('menuSelect');
    const fn = this['do_' + act];
    if (fn) fn.call(this, t);
  }

  onInput(e) {
    const t = e.target;
    const key = t.dataset && t.dataset.set;
    if (!key) return;
    let v = t.type === 'checkbox' ? t.checked : (t.type === 'range' ? parseFloat(t.value) : t.value);
    if (t.type === 'range') {
      const out = t.parentElement.querySelector('output');
      if (out) out.textContent = Math.round(v * 100) + '%';
    }
    setSetting(key, v);
    if (key === 'musicVol' || key === 'sfxVol') { if (e.type === 'change') audio.sfx('menuMove'); }
  }

  onKey(e) {
    if (!this.current || this.rebinding) return;
    audio.unlock();
    const tag = e.target.tagName;
    const items = [...this.root.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    const idx = items.indexOf(document.activeElement);
    const move = (d) => {
      if (!items.length) return;
      const n = items[(idx + d + items.length) % items.length];
      n.focus({ preventScroll: false });
      audio.sfx('menuMove');
    };
    switch (e.code) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'ArrowRight': if (tag !== 'INPUT' && tag !== 'SELECT') { e.preventDefault(); move(1); } break;
      case 'ArrowLeft': if (tag !== 'INPUT' && tag !== 'SELECT') { e.preventDefault(); move(-1); } break;
      case 'Escape':
        e.preventDefault();
        if (this.current.name !== 'main' && this.current.name !== 'matchend' && this.current.name !== 'pause') {
          e._uiHandled = true;
          this.back();
        }
        break;
      case 'Enter':
        if (tag === 'INPUT' && e.target.type === 'checkbox') { e.target.click(); e.preventDefault(); }
        else if (tag === 'INPUT' && e.target.id === 'roomcode') { e.preventDefault(); this.do_join(); }
        break;
      default:
    }
  }

  // ------------------------------------------------------------ MAIN
  screen_main() {
    const touch = matchMedia('(pointer:coarse)').matches;
    return `
      <div class="panel main-panel">
        <div class="logo"><span>IRON FIST</span><b>ARENA</b></div>
        <nav class="menu-list">
          <button class="btn primary" data-act="play" data-autofocus>PLAY <small>Quick fight vs AI</small></button>
          <button class="btn" data-act="mode" data-mode="versus">LOCAL MULTIPLAYER</button>
          <button class="btn" data-act="goto" data-to="team">TEAM BATTLE <small>2 vs 2 on one stage</small></button>
          <button class="btn" data-act="goto" data-to="online" data-size="2">ONLINE 1 VS 1 <small>Room code</small></button>
          <button class="btn" data-act="goto" data-to="online" data-size="4">ONLINE 2 VS 2 <small>Team battle with friends</small></button>
          <button class="btn" data-act="mode" data-mode="ai">FIGHT AGAINST AI</button>
          <button class="btn" data-act="mode" data-mode="pick">CHARACTER SELECTION</button>
          <button class="btn" data-act="mode" data-mode="training">TRAINING MODE</button>
          <button class="btn" data-act="goto" data-to="settings">SETTINGS</button>
          <button class="btn" data-act="goto" data-to="howto">HOW TO PLAY</button>
          <button class="btn" data-act="goto" data-to="credits">CREDITS</button>
        </nav>
        <div class="hint">${touch ? 'Touch controls are available during fights. Two-player keyboard mode needs a physical keyboard.' : '↑ ↓ to navigate · Enter to confirm · Esc to go back'}</div>
      </div>`;
  }

  do_play() {
    this.hide();
    this.game.startMatch(buildOffline('ai'));
  }
  do_mode(t) { this.show('select', { mode: t.dataset.mode }); }
  do_goto(t) {
    if (t.dataset.size) setSetting('onlineSize', +t.dataset.size);
    this.show(t.dataset.to);
  }

  // ------------------------------------------------------------ SELECT
  /** One picker (picture cards + detail box) for weapon / shield / ranged item of fighter p. */
  gearChips(kind, p, allowRandom) {
    const G = GEAR[kind], cur = settings[gearKey(kind, p)];
    const ids = allowRandom ? [...G.ids, 'random'] : G.ids;
    const cards = ids.map((id) => {
      const d = G.data[id];
      const name = d ? d.name : 'RANDOM';
      return `<button class="btn wcard ${cur === id ? 'sel' : ''}" data-act="pickgear" data-kind="${kind}" data-p="${p}" data-id="${id}" title="${esc(name)}"><img src="${G.icon(id)}" alt=""><span>${name}</span></button>`;
    }).join('');
    return `<div class="wrow" data-kind="${kind}" data-wp="${p}"><div class="wlabel">${G.label}</div><div class="wgrid">${cards}</div><div class="wdetail"></div></div>`;
  }

  gearRows(p, allowRandom) { return ['weapon', 'shield', 'ranged'].map((k) => this.gearChips(k, p, allowRandom)).join(''); }

  /** Marks the chosen cards and fills each detail box (picture, description, stat bars). */
  refreshGear() {
    this.root.querySelectorAll('.wrow').forEach((row) => {
      const kind = row.dataset.kind, p = +row.dataset.wp, G = GEAR[kind], cur = settings[gearKey(kind, p)];
      row.querySelectorAll('.wcard').forEach((b) => b.classList.toggle('sel', b.dataset.id === cur));
      const d = row.querySelector('.wdetail');
      if (!d) return;
      if (cur === 'random') { d.innerHTML = `<img class="wbig" src="${G.icon('random')}" alt=""><div class="wtxt"><b>RANDOM</b><div class="wtext">A random ${G.label.toLowerCase()} is picked for every match.</div></div>`; return; }
      const w = G.data[cur] || G.data[G.none];
      const bars = (G.bars(w.id) || []).map(([l, v]) => `<div class="wbar"><span>${l}</span><i style="--v:${v}"></i></div>`).join('');
      d.innerHTML = `<img class="wbig" src="${G.icon(w.id)}" alt=""><div class="wtxt"><b>${w.name}</b><div class="wtext">${esc(w.desc)}</div>${bars}</div>`;
    });
  }

  do_pickgear(t) {
    setSetting(gearKey(t.dataset.kind, +t.dataset.p), t.dataset.id);
    this.refreshGear();
  }

  screen_select({ mode }) {
    const p2Label = mode === 'ai' ? 'CPU' : (mode === 'training' ? 'DUMMY' : 'PLAYER 2');
    const tiles = (p) => CHARACTER_IDS.map((id) => {
      const c = CHARACTERS[id];
      return `<button class="btn tile" data-act="pickchar" data-p="${p}" data-id="${id}" style="--c1:${c.color};--c2:${c.color2}" title="${esc(c.name)}">
        <img src="${getPortrait(id)}" alt=""><span>${c.name}</span></button>`;
    }).join('');
    const arenas = ARENAS.map((a) => `<button class="btn chip ${settings.arena === a.id ? 'sel' : ''}" data-act="pickarena" data-id="${a.id}" title="${esc(a.desc)}">${a.name}</button>`).join('');
    const diffs = DIFFICULTIES.map((d) => `<button class="btn chip ${settings.difficulty === d ? 'sel' : ''}" data-act="pickdiff" data-id="${d}">${d.toUpperCase()}</button>`).join('');
    const touchNote = mode === 'versus' && matchMedia('(pointer:coarse)').matches
      ? '<div class="note warn">Two players on one device need a physical keyboard (or two gamepads). On touch devices, use Fight Against AI or Training.</div>' : '';
    return `
      <div class="panel select-panel">
        <h2>${MODE_TITLES[mode]}</h2>
        ${touchNote}
        <div class="sel-grid">
          <div class="sel-col"><h3>PLAYER 1</h3><div class="tiles">${tiles(0)}</div>${this.gearRows(0, true)}<div class="cdetail" data-info="0"></div></div>
          <div class="vs">VS</div>
          <div class="sel-col"><h3>${p2Label}</h3><div class="tiles">${tiles(1)}</div>${this.gearRows(1, true)}<div class="cdetail" data-info="1"></div></div>
        </div>
        <div class="row"><span class="lbl">ARENA</span>${arenas}</div>
        ${mode === 'ai' ? `<div class="row"><span class="lbl">DIFFICULTY</span>${diffs}</div>` : ''}
        <div class="actions">
          ${mode === 'pick' ? '' : `<button class="btn primary" data-act="fight" data-mode="${mode}">${mode === 'training' ? 'START TRAINING' : 'FIGHT!'}</button>`}
          ${mode === 'pick' ? `<button class="btn primary" data-act="back">SAVE &amp; BACK</button>` : `<button class="btn" data-act="back">BACK</button>`}
        </div>
      </div>`;
  }

  after_select() { this.refreshSelect(); }

  refreshSelect() {
    this.root.querySelectorAll('.tile').forEach((b) => {
      const p = +b.dataset.p;
      b.classList.toggle('sel', settings[p ? 'p2Char' : 'p1Char'] === b.dataset.id);
    });
    [0, 1].forEach((p) => {
      const el = this.root.querySelector(`[data-info="${p}"]`);
      if (!el) return;
      const c = CHARACTERS[settings[p ? 'p2Char' : 'p1Char']];
      const m = c.moves, r = c.rating;
      const bar = (k, label) => `<div class="stat"><span>${label}</span><i style="--v:${r[k] / 5}"></i></div>`;
      el.style.setProperty('--c1', c.color);
      el.innerHTML = `
        <img class="big" src="${getPortrait(c.id)}" alt="">
        <div class="dtxt">
          <div class="cname">${c.name}</div><div class="ctitle">${esc(c.title)}</div>
          ${bar('power', 'POW')}${bar('speed', 'SPD')}${bar('range', 'RNG')}${bar('defense', 'DEF')}
        </div>
        <p>${esc(c.blurb)}</p>
        <ul><li><b>Light</b> ${m.light.name}</li><li><b>Heavy</b> ${m.heavy.name}</li><li><b>Special</b> ${m.special.name}</li><li><b>Ultimate</b> ${m.ultimate.name}</li></ul>`;
    });
    this.refreshGear();
    this.game.backdrop.set(settings.p1Char, settings.p2Char, settings.arena);
  }

  do_pickchar(t) {
    setSetting(+t.dataset.p ? 'p2Char' : 'p1Char', t.dataset.id);
    this.refreshSelect();
  }
  do_pickarena(t) {
    setSetting('arena', t.dataset.id);
    this.root.querySelectorAll('[data-act="pickarena"]').forEach((b) => b.classList.toggle('sel', b.dataset.id === settings.arena));
    if (this.current && this.current.name !== 'team') this.refreshSelect();
  }
  do_pickdiff(t) {
    setSetting('difficulty', t.dataset.id);
    this.root.querySelectorAll('[data-act="pickdiff"]').forEach((b) => b.classList.toggle('sel', b.dataset.id === settings.difficulty));
  }
  do_fight(t) {
    const mode = t.dataset.mode;
    this.hide();
    this.game.startMatch(buildOffline(mode));
  }
  do_back() { this.back(); }

  // ------------------------------------------------------------ TEAM BATTLE (offline 2v2)
  screen_team() {
    const arenas = ARENAS.map((a) => `<button class="btn chip ${settings.arena === a.id ? 'sel' : ''}" data-act="pickarena" data-id="${a.id}">${a.name}</button>`).join('');
    const diffs = DIFFICULTIES.map((d) => `<button class="btn chip ${settings.difficulty === d ? 'sel' : ''}" data-act="pickdiff" data-id="${d}">${d.toUpperCase()}</button>`).join('');
    const names = ['BLUE 1', 'BLUE 2', 'RED 1', 'RED 2'];
    const card = (i) => `
      <div class="tslot t${i < 2 ? 0 : 1}" data-slot="${i}">
        <div class="tslot-head">${names[i]}</div>
        <img class="tslot-img" alt="">
        <div class="tslot-name"></div>
        <div class="tslot-gear"><img class="tg-w" alt=""><img class="tg-s" alt=""><img class="tg-r" alt=""></div>
        <div class="cyc"><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="char" data-d="-1">◀</button><span class="cycv" data-v="char"></span><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="char" data-d="1">▶</button></div>
        <div class="cyc"><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="weapon" data-d="-1">◀</button><span class="cycv" data-v="weapon"></span><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="weapon" data-d="1">▶</button></div>
        <div class="cyc"><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="shield" data-d="-1">◀</button><span class="cycv" data-v="shield"></span><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="shield" data-d="1">▶</button></div>
        <div class="cyc"><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="ranged" data-d="-1">◀</button><span class="cycv" data-v="ranged"></span><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="ranged" data-d="1">▶</button></div>
        <div class="cyc"><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="ctrl" data-d="-1">◀</button><span class="cycv" data-v="ctrl"></span><button class="btn chip" data-act="cyc" data-slot="${i}" data-what="ctrl" data-d="1">▶</button></div>
      </div>`;
    return `
      <div class="panel team-panel">
        <h2>TEAM BATTLE · 2 vs 2</h2>
        <p class="note">Four fighters on one stage. A team wins the round when both opponents are knocked out. Give each fighter a controller: <b>P1 KEYS</b>, <b>P2 KEYS</b> (second player on the same keyboard) or <b>CPU</b>.</p>
        <div class="team-grid">
          <div class="team-col"><h3 class="blue">TEAM BLUE</h3><div class="team-row">${card(0)}${card(1)}</div></div>
          <div class="vs">VS</div>
          <div class="team-col"><h3 class="red">TEAM RED</h3><div class="team-row">${card(2)}${card(3)}</div></div>
        </div>
        <div class="row"><span class="lbl">ARENA</span>${arenas}</div>
        <div class="row"><span class="lbl">CPU LEVEL</span>${diffs}</div>
        <div class="actions"><button class="btn primary" data-act="fightteam">FIGHT!</button><button class="btn" data-act="back">BACK</button></div>
      </div>`;
  }

  after_team() { this.refreshTeam(); }

  refreshTeam() {
    const slots = teamSlots();
    settings.team = slots; saveSettings();
    const label = { p1: 'P1 KEYS', p2: 'P2 KEYS', cpu: 'CPU' };
    slots.forEach((s, i) => {
      const el = this.root.querySelector(`.tslot[data-slot="${i}"]`);
      if (!el) return;
      const c = CHARACTERS[s.char];
      el.style.setProperty('--c1', c.color);
      el.querySelector('.tslot-img').src = getPortrait(s.char);
      el.querySelector('.tslot-name').textContent = c.name;
      el.querySelector('[data-v="char"]').textContent = c.name;
      el.querySelector('[data-v="weapon"]').textContent = s.weapon === 'random' ? 'RANDOM' : WEAPONS[s.weapon].name;
      const nm = (G, v) => (v === 'random' ? 'RANDOM' : G.data[v].name);
      el.querySelector('[data-v="shield"]').textContent = nm(GEAR.shield, s.shield);
      el.querySelector('[data-v="ranged"]').textContent = nm(GEAR.ranged, s.ranged);
      el.querySelector('.tg-w').src = weaponIcon(s.weapon);
      el.querySelector('.tg-s').src = shieldIcon(s.shield);
      el.querySelector('.tg-r').src = rangedIcon(s.ranged);
      el.querySelector('[data-v="ctrl"]').textContent = label[s.ctrl];
      el.classList.toggle('human', s.ctrl !== 'cpu');
    });
  }

  do_cyc(t) {
    const i = +t.dataset.slot, d = +t.dataset.d, what = t.dataset.what;
    const slots = teamSlots();
    const s = slots[i];
    const cycle = (list, cur) => list[(list.indexOf(cur) + d + list.length) % list.length];
    if (what === 'char') s.char = cycle(CHARACTER_IDS, s.char);
    else if (what === 'weapon') s.weapon = cycle([...WEAPON_IDS, 'random'], s.weapon);
    else if (what === 'shield') s.shield = cycle([...SHIELD_IDS, 'random'], s.shield);
    else if (what === 'ranged') s.ranged = cycle([...RANGED_IDS, 'random'], s.ranged);
    else {
      s.ctrl = cycle(['cpu', 'p1', 'p2'], s.ctrl);
      // a keyboard can only be used once: the previous owner becomes a CPU
      if (s.ctrl !== 'cpu') slots.forEach((o, j) => { if (j !== i && o.ctrl === s.ctrl) o.ctrl = 'cpu'; });
    }
    settings.team = slots; saveSettings();
    this.refreshTeam();
  }

  do_fightteam() {
    this.hide();
    this.game.startMatch(buildOffline('team'));
  }

  // ------------------------------------------------------------ ONLINE
  screen_online({ room, msg } = {}) {
    const tiles = CHARACTER_IDS.map((id) => {
      const c = CHARACTERS[id];
      return `<button class="btn tile" data-act="pickchar" data-p="0" data-id="${id}" style="--c1:${c.color};--c2:${c.color2}" title="${esc(c.name)}">
        <img src="${getPortrait(id)}" alt=""><span>${c.name}</span></button>`;
    }).join('');
    const arenas = ARENAS.map((a) => `<button class="btn chip ${settings.arena === a.id ? 'sel' : ''}" data-act="pickarena" data-id="${a.id}">${a.name}</button>`).join('');
    const sizes = [[2, '1 vs 1'], [4, '2 vs 2 TEAMS']].map(([v, l]) => `<button class="btn chip ${settings.onlineSize === v ? 'sel' : ''}" data-act="onlinesize" data-v="${v}">${l}</button>`).join('');
    const teams = [[0, 'BLUE'], [1, 'RED']].map(([v, l]) => `<button class="btn chip ${settings.onlineTeam === v ? 'sel' : ''}" data-act="onlineteam" data-v="${v}">${l}</button>`).join('');
    return `
      <div class="panel online-panel">
        <h2>ONLINE · PLAY WITH FRIENDS</h2>
        <p class="note">One player creates a room and shares the code (or the invite link). Friends join with it. The match runs directly between your browsers. In 2 vs 2 you can play with up to 4 people, empty places are filled by CPU fighters.</p>
        <h3>YOUR FIGHTER</h3>
        <div class="tiles">${tiles}</div>
        ${this.gearRows(0, false)}
        <div class="row"><span class="lbl">ROOM</span>${sizes}<span class="lbl" style="width:auto;margin-left:10px">YOUR TEAM</span>${teams}</div>
        <div class="row"><span class="lbl">ARENA</span>${arenas}<span class="note">(room creator's choice)</span></div>
        <div class="row online-actions">
          <button class="btn primary" data-act="create" data-autofocus>CREATE ROOM</button>
          <span class="or">or</span>
          <input id="roomcode" class="codeinput" maxlength="8" autocomplete="off" spellcheck="false" placeholder="ROOM CODE" value="${esc(room || '')}">
          <button class="btn primary" data-act="join">JOIN ROOM</button>
          <button class="btn chip" data-act="checknet">CHECK NETWORK</button>
        </div>
        <div id="netmsg" class="note netmsg">${esc(msg || '')}</div>
        <div class="actions"><button class="btn" data-act="back">BACK</button></div>
      </div>`;
  }
  after_online({ room }) {
    this.refreshSelect();
    if (room) { const j = this.root.querySelector('[data-act="join"]'); if (j) j.focus(); }
  }
  setNetMsg(txt) { const n = this.root.querySelector('#netmsg'); if (n) n.textContent = txt; }

  async do_checknet() {
    this.setNetMsg('Checking your network (6 seconds)…');
    const r = await checkNetwork();
    if (!this.current || this.current.name !== 'online') return;
    let txt;
    if (r.error) txt = 'Network check failed: ' + r.error;
    else if (r.relay) txt = 'Network OK: a relay (TURN) server works, so you can connect to players on any network.';
    else if (r.turnConfigured) txt = 'A relay server is configured but did not answer (wrong credentials or blocked). Direct connections ' + (r.direct ? 'are still possible.' : 'are also unavailable.');
    else if (r.direct) txt = 'Direct connections work, but no relay server is configured: playing with friends on strict / different networks may time out. See README → "Playing across different networks".';
    else txt = 'No usable connection found. Check your internet / firewall.';
    this.setNetMsg(txt);
  }

  do_onlinesize(t) {
    setSetting('onlineSize', +t.dataset.v);
    this.root.querySelectorAll('[data-act="onlinesize"]').forEach((b) => b.classList.toggle('sel', +b.dataset.v === settings.onlineSize));
  }
  do_onlineteam(t) {
    setSetting('onlineTeam', +t.dataset.v);
    this.root.querySelectorAll('[data-act="onlineteam"]').forEach((b) => b.classList.toggle('sel', +b.dataset.v === settings.onlineTeam));
  }

  myOnlineInfo() {
    const fix = (v, dflt) => (v === 'random' ? dflt : v);
    return { char: settings.p1Char, weapon: fix(settings.p1Weapon, 'fists'), shield: fix(settings.p1Shield, 'none'), ranged: fix(settings.p1Ranged, 'none'), team: settings.onlineTeam };
  }

  do_create() {
    const s = this.game.newSession();
    this.setNetMsg('Creating room…');
    s.host(settings.onlineSize, this.myOnlineInfo()).then((code) => {
      if (this.current && this.current.name === 'online') this.replace('lobby', { code });
    }).catch((e) => { this.game.closeSession(); this.setNetMsg(this.game.netErrorText(e)); });
  }

  do_join() {
    const input = this.root.querySelector('#roomcode');
    const code = (input ? input.value : '').trim().toUpperCase();
    if (code.length < 4) { this.setNetMsg('Enter the room code first.'); return; }
    const s = this.game.newSession();
    this.setNetMsg('Connecting to ' + code + '…');
    s.join(code, this.myOnlineInfo()).then(() => {
      if (this.current && this.current.name === 'online') this.replace('lobby', { code, guest: true });
    }).catch((e) => { this.game.closeSession(); this.setNetMsg(this.game.netErrorText(e)); });
  }

  screen_lobby({ code, guest }) {
    const s = this.game.session;
    const link = location.origin + location.pathname + '?room=' + code;
    const size = guest ? ((s && s.guestRoster && s.guestRoster.size) || 2) : s.size;
    const players = guest ? ((s && s.guestRoster && s.guestRoster.players) || []) : s.roster();
    const you = guest ? ((s && s.guestRoster && s.guestRoster.you) ?? -1) : s.role;
    const by = {}; players.forEach((p) => { by[p.slot] = p; });
    const card = (i) => {
      const p = by[i];
      if (!p) return `<div class="lslot empty"><div class="lname">${size === 4 ? 'CPU (auto-fill)' : 'waiting…'}</div></div>`;
      const c = CHARACTERS[p.char] || CHARACTERS.delegate, w = WEAPONS[p.weapon] || WEAPONS.fists;
      const who = p.slot === you ? 'YOU' : (p.host ? 'HOST' : 'PLAYER');
      return `<div class="lslot" style="--c1:${c.color}"><img src="${getPortrait(c.id)}" alt=""><div><div class="lname">${c.name}</div><div class="lsub">${w.name} · ${who}</div></div><div class="lgear"><img src="${weaponIcon(w.id)}" alt="">${p.shield && p.shield !== 'none' ? `<img src="${shieldIcon(p.shield)}" alt="">` : ''}${p.ranged && p.ranged !== 'none' ? `<img src="${rangedIcon(p.ranged)}" alt="">` : ''}</div></div>`;
    };
    const teamsHtml = size === 4
      ? `<div class="lteams"><div><h3 class="blue">TEAM BLUE</h3>${card(0)}${card(1)}</div><div class="vs">VS</div><div><h3 class="red">TEAM RED</h3>${card(2)}${card(3)}</div></div>`
      : `<div class="lteams"><div><h3 class="blue">PLAYER 1</h3>${card(0)}</div><div class="vs">VS</div><div><h3 class="red">PLAYER 2</h3>${card(1)}</div></div>`;
    const humans = players.length;
    const canStart = !guest && size === 4 && humans >= 2;
    return `
      <div class="panel lobby-panel">
        <h2>${guest ? 'IN THE ROOM' : 'ROOM READY'}</h2>
        <div class="bigcode">${code}</div>
        ${guest ? '' : `<input class="linkbox" readonly value="${esc(link)}" id="invitelink"><p class="note">Share the code or this link. Friends choose <b>ONLINE → JOIN ROOM</b>.</p>`}
        ${teamsHtml}
        <div class="actions">
          ${guest ? '' : (size === 4 ? `<button class="btn primary" data-act="startroom" ${canStart ? '' : 'disabled'} data-autofocus>START MATCH</button>` : '')}
          ${guest ? '' : '<button class="btn" data-act="copylink">COPY LINK</button>'}
          <button class="btn" data-act="cancelroom">${guest ? 'LEAVE' : 'CANCEL'}</button>
        </div>
        <div id="netmsg" class="note netmsg">${guest ? 'Waiting for the host to start the match…' : (size === 4 ? (canStart ? 'Press START MATCH when everybody is in. Empty places are filled by CPU fighters.' : 'Waiting for at least one friend…') : 'Waiting for your friend…')}</div>
      </div>`;
  }
  do_copylink() {
    const el = this.root.querySelector('#invitelink');
    if (!el) return;
    const v = el.value;
    const done = () => this.setNetMsg('Link copied!');
    try { navigator.clipboard.writeText(v).then(done, () => this.setNetMsg('Copy failed, select the link manually.')); } catch (e) { this.setNetMsg('Copy failed, select the link manually.'); }
  }
  do_startroom() { this.game.hostStart(); }
  do_cancelroom() { this.game.closeSession(); this.back(); }

  refreshLobby() { if (this.current && this.current.name === 'lobby') this.render(); }

  screen_netmenu() {
    return `
      <div class="panel pause-panel">
        <h2>MENU</h2>
        <p class="note">Online matches cannot be paused: the fight keeps running while this menu is open and your fighter stands still.</p>
        <nav class="menu-list">
          <button class="btn primary" data-act="resume" data-autofocus>BACK TO THE FIGHT</button>
          <button class="btn" data-act="quit">LEAVE MATCH</button>
        </nav>
      </div>`;
  }
  screen_netlost({ reason } = {}) {
    return `
      <div class="panel pause-panel">
        <h2>DISCONNECTED</h2>
        <p class="note">${esc(reason || 'A player left the match or the connection was lost.')}</p>
        <nav class="menu-list"><button class="btn primary" data-act="quit" data-autofocus>MAIN MENU</button></nav>
      </div>`;
  }

  // ------------------------------------------------------------ SETTINGS
  screen_settings() {
    const s = settings;
    const range = (k, label) => `<label class="srow"><span>${label}</span><span class="rng"><input type="range" min="0" max="1" step="0.05" value="${s[k]}" data-set="${k}"><output>${Math.round(s[k] * 100)}%</output></span></label>`;
    const chk = (k, label) => `<label class="srow chk"><span>${label}</span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}></label>`;
    const seg = (k, label, opts) => `<div class="srow"><span>${label}</span><span class="seg" data-key="${k}">${opts.map(([v, l]) => `<button class="btn chip ${String(s[k]) === String(v) ? 'sel' : ''}" data-act="seg" data-key="${k}" data-val="${v}">${l}</button>`).join('')}</span></div>`;
    const rows = ACTIONS.map((a) => `
      <tr><td>${ACTION_LABELS[a]}</td>
        ${[0, 1].map((p) => `<td><button class="btn keybtn" data-act="rebind" data-p="${p}" data-a="${a}">${esc(prettyKey(s.bindings[p][a]))}</button></td>`).join('')}
      </tr>`).join('');
    return `
      <div class="panel settings-panel">
        <h2>SETTINGS</h2>
        <div class="cols">
          <section>
            <h3>AUDIO</h3>
            ${range('musicVol', 'Music volume')}${range('sfxVol', 'Sound effects volume')}
            ${chk('muted', 'Mute all audio')}${chk('announcer', 'Announcer voice')}
            <h3>GAMEPLAY</h3>
            ${seg('difficulty', 'AI difficulty', DIFFICULTIES.map((d) => [d, d[0].toUpperCase() + d.slice(1)]))}
            ${seg('roundTime', 'Round time', [[30, '30s'], [60, '60s'], [90, '90s'], [99, '99s']])}
            ${seg('roundsToWin', 'Match length', [[1, 'Best of 1'], [2, 'Best of 3'], [3, 'Best of 5']])}
            <h3>VISUALS &amp; ACCESSIBILITY</h3>
            ${chk('screenShake', 'Screen shake')}${chk('reducedFx', 'Reduced visual effects')}
            ${chk('damageNumbers', 'Damage numbers')}${chk('comboCounter', 'Combo counter')}
            ${seg('touchControls', 'Touch controls', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']])}
            <div class="srow"><span>Fullscreen</span><button class="btn chip" data-act="fullscreen">TOGGLE FULLSCREEN</button></div>
          </section>
          <section>
            <h3>KEY BINDINGS</h3>
            <table class="keys"><thead><tr><th></th><th>PLAYER 1</th><th>PLAYER 2</th></tr></thead><tbody>${rows}</tbody></table>
            <div class="note" id="bindmsg">Click a key, then press the new key. Esc cancels. Gamepads: stick/D-pad move, A jump, X light, Y heavy, B special, bumpers block, trigger ultimate.</div>
            <div class="row left">
              <button class="btn chip" data-act="laptop">P2 LAPTOP LAYOUT</button>
              <button class="btn chip" data-act="resetkeys">RESET CONTROLS</button>
            </div>
          </section>
        </div>
        <div class="actions"><button class="btn primary" data-act="back">BACK</button></div>
      </div>`;
  }

  do_seg(t) {
    let v = t.dataset.val;
    if (/^\d+$/.test(v)) v = parseInt(v, 10);
    setSetting(t.dataset.key, v);
    t.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.toggle('sel', b === t));
  }

  do_fullscreen() { this.game.toggleFullscreen(); }

  do_laptop() {
    settings.bindings[1] = { ...LAPTOP_P2 };
    saveSettings(); this.render();
    this.say('Player 2 now uses: arrows to move, , . / for attacks, Right Shift to block, \' for ultimate.');
  }
  do_resetkeys() { resetBindings(); this.render(); }

  say(msg) { const n = this.root.querySelector('#bindmsg'); if (n) n.textContent = msg; }

  startRebind(btn) {
    const p = +btn.dataset.p, a = btn.dataset.a;
    this.rebinding = btn;
    btn.textContent = 'Press a key…';
    btn.classList.add('listening');
    this.game.input.capture = (code) => {
      this.rebinding = null;
      btn.classList.remove('listening');
      if (code === 'Escape') { btn.textContent = prettyKey(settings.bindings[p][a]); return; }
      if (RESERVED.has(code)) { this.say(`${prettyKey(code)} is reserved by the game.`); btn.textContent = prettyKey(settings.bindings[p][a]); return; }
      const b = settings.bindings[p];
      const other = ACTIONS.find((x) => x !== a && b[x] === code);
      if (other) { b[other] = b[a]; }       // swap so nothing is left unbound
      b[a] = code;
      // warn if the other player uses the same key
      const clash = settings.bindings[1 - p];
      const dup = ACTIONS.find((x) => clash[x] === code);
      saveSettings();
      this.render();
      if (dup) this.say(`Note: Player ${2 - p} also uses ${prettyKey(code)} for ${ACTION_LABELS[dup]}.`);
    };
  }

  // ------------------------------------------------------------ HOW TO PLAY
  screen_howto() {
    const b = settings.bindings;
    const table = (p) => ACTIONS.map((a) => `<tr><td>${ACTION_LABELS[a]}</td><td><kbd>${esc(prettyKey(b[p][a]))}</kbd></td></tr>`).join('');
    return `
      <div class="panel howto-panel">
        <h2>HOW TO PLAY</h2>
        <div class="cols">
          <section><h3>PLAYER 1</h3><table class="keys">${table(0)}</table></section>
          <section><h3>PLAYER 2</h3><table class="keys">${table(1)}</table></section>
          <section class="text">
            <h3>GENERAL</h3>
            <p><kbd>Esc</kbd> pause · <kbd>Enter</kbd> confirm · <kbd>Backspace</kbd> reset positions (Training). Key bindings can be changed in Settings. Gamepads are supported.</p>
            <h3>MECHANICS</h3>
            <ul>
              <li><b>Combos:</b> Light → Light → Heavy → Special. Hits that connect (or are blocked) can be cancelled into stronger moves.</li>
              <li><b>Block:</b> hold Block. Hold Crouch too to block <i>low</i> attacks. Jumping attacks are overheads: block them standing.</li>
              <li><b>Throw:</b> Block + Light up close. Beats blocking. Whiffs leave you open.</li>
              <li><b>Crouch + Light</b> low attack · <b>Crouch + Heavy</b> launching uppercut · <b>Jump + attack</b> air attacks.</li>
              <li><b>Run:</b> double-tap forward. <b>Back-dash:</b> double-tap back.</li>
              <li><b>Special:</b> unique per character, limited by a cooldown.</li>
              <li><b>Ultimate:</b> fill the SUPER meter (damage dealt and taken) and press the Ultimate key.</li>
              <li>Long combos lose damage and end in a knockdown, so they cannot go on forever.</li>
              <li><b>Weapons:</b> pick one before the fight (katana, bat, hammer, nunchaku, spear, knuckles). It changes reach, damage and speed of your <i>punch</i> attacks; kicks, specials and ultimates stay the same.</li>
              <li><b>Shields:</b> hold Block to raise it. Buckler: block just as a hit lands to <i>parry</i>. Round: little chip damage. Tower: covers high and low, but slow. Spiked: hurts melee attackers.</li>
              <li><b>Throw / Shoot:</b> press the Throw key to use your ranged item (bow, knives, throwing axe, shuriken, bomb). Each has a cooldown; hold Down for a low shot.</li>
              <li><b>Team Battle (2 vs 2):</b> four fighters share the stage. A team wins the round when both enemies are knocked out. Teammates can walk through each other.</li>
              <li><b>Online:</b> create a room and share the code. In 2 vs 2 rooms up to 4 friends can play, empty places are filled by CPU fighters.</li>
            </ul>
          </section>
        </div>
        <div class="actions"><button class="btn primary" data-act="back">BACK</button></div>
      </div>`;
  }

  // ------------------------------------------------------------ CREDITS
  screen_credits() {
    return `
      <div class="panel credits-panel">
        <h2>CREDITS</h2>
        <div class="text center">
          <p><b>IRON FIST ARENA</b> — a browser fighting game.</p>
          <p>Characters: built from the two supplied character images. Backgrounds were cut out with an offline model once at build time; animation is procedural.</p>
          <p>Engine: custom Canvas 2D engine with a fixed 60&nbsp;Hz simulation. Bundled with Vite.</p>
          <p>Audio: all music and sound effects are synthesized live with the Web Audio API — no audio files, no licences to worry about.</p>
          <p>Arenas: drawn procedurally with Canvas gradients and shapes.</p>
        </div>
        <div class="actions"><button class="btn primary" data-act="back">BACK</button></div>
      </div>`;
  }

  // ------------------------------------------------------------ PAUSE
  screen_pause() {
    const training = this.game.match && this.game.match.training;
    return `
      <div class="panel pause-panel">
        <h2>PAUSED</h2>
        <nav class="menu-list">
          <button class="btn primary" data-act="resume" data-autofocus>RESUME</button>
          ${training ? '<button class="btn" data-act="resetpos">RESET POSITIONS</button>' : '<button class="btn" data-act="restart">RESTART MATCH</button>'}
          <button class="btn" data-act="goto" data-to="settings">SETTINGS</button>
          <button class="btn" data-act="goto" data-to="howto">CONTROLS</button>
          <button class="btn" data-act="quit">QUIT TO MENU</button>
        </nav>
      </div>`;
  }
  do_resume() { this.game.resume(); }
  do_restart() { this.game.rematch(); }
  do_resetpos() { this.game.match.resetPositions(); this.game.resume(); }
  do_quit() { this.game.quitToMenu(); }

  // ------------------------------------------------------------ MATCH END
  screen_matchend({ result, mode }) {
    const cm = this.game.match;
    const w = result.winner;                                  // winning TEAM (0 / 1)
    const role = this.game.session ? this.game.session.role : 0;
    const myTeam = cm.teamOf(role);
    const teamMode = cm.teamMode;
    let title;
    if (mode === 'online') title = w === myTeam ? 'VICTORY' : 'DEFEAT';
    else if (mode === 'ai') title = w === 0 ? 'VICTORY' : 'DEFEAT';
    else title = `${cm.teamName(w)} WINS`;
    const good = mode === 'online' ? w === myTeam : (mode === 'ai' ? w === 0 : true);
    const stats = result.stats;
    let table;
    if (!teamMode) {
      const [a, b] = stats;
      const row = (l, x, y) => `<tr><td>${x}</td><th>${l}</th><td>${y}</td></tr>`;
      table = `<table class="stats">
          <thead><tr><td>${cm.f[0].cfg.name}</td><th></th><td>${cm.f[1].cfg.name}</td></tr></thead>
          ${row('Damage dealt', a.damage, b.damage)}${row('Hits landed', a.hits, b.hits)}${row('Best combo', a.maxCombo, b.maxCombo)}
          ${row('Blocks', a.blocks, b.blocks)}${row('Specials', a.specials, b.specials)}${row('Ultimates', a.ultimates, b.ultimates)}${row('Throws', a.throws, b.throws)}
        </table>`;
    } else {
      const rows = cm.f.map((f, i) => {
        const st = stats[i];
        return `<tr class="tm${f.team}"><td class="who">${f.cfg.name} <small>${cm.tagFor(i)}</small></td><td>${st.damage}</td><td>${st.hits}</td><td>${st.maxCombo}</td><td>${st.ultimates}</td></tr>`;
      }).join('');
      table = `<table class="stats team"><thead><tr><th>FIGHTER</th><th>DAMAGE</th><th>HITS</th><th>COMBO</th><th>ULTS</th></tr></thead>${rows}</table>`;
    }
    return `
      <div class="panel end-panel ${good ? 'win' : 'lose'}">
        <h1>${title}</h1>
        <div class="sub">${cm.teamName(w)} takes the match ${result.wins[w]} – ${result.wins[1 - w]}</div>
        ${table}
        <div class="actions">
          <button class="btn primary" data-act="rematch" data-autofocus>REMATCH</button>
          ${mode === 'online' ? '' : '<button class="btn" data-act="reselect">CHARACTER SELECT</button>'}
          <button class="btn" data-act="quit">MAIN MENU</button>
        </div>
      </div>`;
  }
  do_rematch(t) {
    this.game.rematch();
    if (this.game.session && this.game.match && this.game.match.net && t) { t.textContent = 'WAITING FOR FRIEND…'; t.disabled = true; }
  }
  do_reselect() {
    const mode = this.game.match.mode;
    this.game.quitToMenu(false);
    if (mode === 'team') this.show('team'); else this.show('select', { mode });
  }
}

export { DEFAULT_BINDINGS };
