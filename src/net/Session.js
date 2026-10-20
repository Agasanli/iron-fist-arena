import Peer from 'peerjs';
import { ACTIONS } from '../game/config.js';

// Peer-to-peer online play over WebRTC (PeerJS). The free public PeerJS cloud is only used for the
// initial handshake (matching the room code); game data then flows directly between the browsers.
//
// Topology: a star. The room creator is the host; every other player connects to the host only.
// The game uses deterministic lockstep: every machine simulates every 60 Hz tick from the same inputs
// (one per fighter slot), so only inputs are sent. The host relays inputs between the guests and also
// produces the inputs of CPU-controlled slots. A state hash is compared every second to detect desyncs.

const PREFIX = 'ironfist-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';     // no 0/O/1/I to avoid typos
const PRESSED = ['pLeft', 'pRight', 'pUp', 'pDown', 'pLight', 'pHeavy', 'pSpecial', 'pBlock', 'pUlt'];

export const makeCode = () => Array.from({ length: 5 }, () => ALPHA[(Math.random() * ALPHA.length) | 0]).join('');

export function encodeInput(o) {
  let m = 0;
  for (let i = 0; i < 9; i++) {
    if (o[ACTIONS[i]]) m |= 1 << i;
    if (o[PRESSED[i]]) m |= 1 << (9 + i);
  }
  return m;
}
export function decodeInput(m, o) {
  for (let i = 0; i < 9; i++) {
    o[ACTIONS[i]] = !!((m >> i) & 1);
    o[PRESSED[i]] = !!((m >> (9 + i)) & 1);
  }
  return o;
}

export function describeNetError(e) {
  const t = e && (e.type || e.message);
  switch (t) {
    case 'peer-unavailable': return 'Room not found. Check the code and make sure your friend created the room.';
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed': case 'disconnected':
      return 'Could not reach the matchmaking server. Check your internet connection and try again.';
    case 'timeout': return 'Connection timed out. Ask your friend to create a new room.';
    case 'webrtc': return 'A direct connection could not be established (strict firewall / network). Try another network.';
    case 'full': return 'This room is full.';
    default: return 'Connection problem: ' + (e && (e.message || e.type) || 'unknown error');
  }
}

export class Session {
  /** size: 2 (1v1) or 4 (2v2) fighters. Only meaningful for the host; guests learn it from the roster. */
  constructor() {
    this.handlers = {};
    this.peer = null;
    this.isHost = false;
    this.size = 2;
    this.conns = [];              // host: [{ conn, slot, info, ping }]
    this.conn = null;             // guest: connection to the host
    this.role = 0;                // own fighter slot
    this.hostInfo = null;         // host's own { char, weapon, team }
    this.code = '';
    this.open = false;
    this.started = false;
    this.ping = 0;
    this.pingTimer = 0;
    this.bots = [];               // host: CPU slots of the running match
    this.humans = [];             // all human slots of the running match
    this.rematch = new Set();
    this.cfg = null;
    this.resetLock(0, 2);
  }

  get delay() { return this.size === 4 ? 6 : 4; }

  on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return this; }
  emit(evt, ...a) { (this.handlers[evt] || []).forEach((f) => f(...a)); }

  // ---------------------------------------------------------------- connecting
  /** Create a room. `info` = { char, weapon, team } of the host; size 2 or 4. */
  host(size, info) {
    this.isHost = true; this.size = size; this.hostInfo = info;
    this.role = size === 4 ? 2 * (info.team | 0) : 0;
    return new Promise((resolve, reject) => {
      const attempt = (n) => {
        const code = makeCode();
        const peer = new Peer(PREFIX + code, { debug: 0 });
        this.peer = peer;
        peer.on('open', () => { this.code = code; resolve(code); });
        peer.on('connection', (conn) => this.acceptGuest(conn));
        peer.on('error', (e) => {
          if (e.type === 'unavailable-id' && n < 5) { try { peer.destroy(); } catch (x) { /* ignore */ } attempt(n + 1); return; }
          reject(e); this.emit('error', e);
        });
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
      };
      attempt(0);
    });
  }

  /** Join a room. `info` = { char, weapon, team } (team = preferred side in 2v2). */
  join(code, info) {
    this.isHost = false; this.code = code;
    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 0 });
      this.peer = peer;
      const timer = setTimeout(() => reject(new Error('timeout')), 15000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true });
        this.conn = conn;
        conn.on('open', () => {
          clearTimeout(timer);
          this.open = true;
          this.pingTimer = setInterval(() => this.send({ t: 'p', ts: performance.now() }), 1500);
          conn.send({ t: 'hello', char: info.char, weapon: info.weapon, team: info.team | 0 });
          resolve();
        });
        conn.on('data', (d) => this.onData(d, null));
        conn.on('close', () => { this.open = false; this.emit('close'); });
        conn.on('error', () => { this.open = false; this.emit('close'); });
      });
      peer.on('error', (e) => { clearTimeout(timer); reject(e); this.emit('error', e); });
    });
  }

  // ---------------------------------------------------------------- host side
  occupied() { return new Set([this.role, ...this.conns.map((c) => c.slot)]); }

  freeSlotFor(pref) {
    const used = this.occupied();
    if (this.size === 2) return used.has(1) ? -1 : 1;
    const order = pref === 1 ? [2, 3, 0, 1] : [0, 1, 2, 3];
    for (const s of order) if (!used.has(s)) return s;
    return -1;
  }

  acceptGuest(conn) {
    const entry = { conn, slot: -1, info: null, ping: 0, open: false };
    conn.on('open', () => {
      entry.open = true;
      if (!this.pingTimer) this.pingTimer = setInterval(() => this.send({ t: 'p', ts: performance.now() }), 1500);
    });
    conn.on('data', (d) => this.onData(d, entry));
    const gone = () => {
      if (!this.conns.includes(entry)) return;
      this.conns = this.conns.filter((c) => c !== entry);
      if (this.started) { this.broadcast({ t: 'bye', slot: entry.slot }); this.emit('close'); }
      else { this.broadcastRoster(); this.emit('roster'); }
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  /** The public list of everybody in the room. */
  roster() {
    const list = [{ slot: this.role, host: true, ...this.hostInfo }];
    for (const c of this.conns) if (c.info) list.push({ slot: c.slot, ...c.info });
    return list.sort((a, b) => a.slot - b.slot);
  }

  broadcastRoster() {
    for (const c of this.conns) this.sendTo(c.conn, { t: 'roster', size: this.size, you: c.slot, players: this.roster() });
  }

  broadcast(obj, except) {
    for (const c of this.conns) if (c.conn !== except && c.open) this.sendTo(c.conn, obj);
  }

  sendTo(conn, obj) { try { conn.send(obj); } catch (e) { /* connection dying */ } }

  /** Guest -> host, or host -> everybody. */
  send(obj) {
    if (this.isHost) this.broadcast(obj);
    else if (this.conn && this.open) this.sendTo(this.conn, obj);
  }

  close() {
    this.handlers = {};
    clearInterval(this.pingTimer);
    this.open = false;
    for (const c of this.conns) { try { c.conn.close(); } catch (e) { /* ignore */ } }
    try { if (this.conn) this.conn.close(); } catch (e) { /* ignore */ }
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
    this.conns = []; this.conn = null; this.peer = null;
  }

  onData(d, entry) {
    if (!d || typeof d !== 'object') return;
    switch (d.t) {
      case 'hello':
        if (this.isHost && entry && !entry.info) {
          const slot = this.freeSlotFor(d.team | 0);
          if (slot < 0 || this.started) { this.sendTo(entry.conn, { t: 'full' }); setTimeout(() => { try { entry.conn.close(); } catch (e) { /* ignore */ } }, 300); this.conns = this.conns.filter((c) => c !== entry); return; }
          entry.slot = slot; entry.info = { char: d.char, weapon: d.weapon, team: slot < 2 && this.size === 4 ? 0 : (this.size === 4 ? 1 : slot) };
          this.conns.push(entry);
          this.broadcastRoster();
          this.emit('roster');
        }
        break;
      case 'i':
        if (d.e !== this.epoch) break;
        this.inputs[d.s].set(d.k, d.m);
        if (this.isHost) this.broadcast(d, entry && entry.conn);       // relay to the other guests
        break;
      case 'h': if (d.e === this.epoch) this.onHash(d.k, d.v, d.s); break;
      case 'p': this.send({ t: 'q', ts: d.ts }); break;
      case 'q': { const r = Math.round(performance.now() - d.ts); if (entry) entry.ping = r; this.ping = this.isHost ? Math.max(0, ...this.conns.map((c) => c.ping)) : r; break; }
      default: this.emit('msg', d, entry);
    }
  }

  // ---------------------------------------------------------------- lockstep
  /** Called when a match (re)starts. `size` = number of fighter slots. */
  resetLock(epoch, size) {
    this.epoch = epoch;
    this.size = size;
    this.inputs = Array.from({ length: size }, () => new Map());
    this.localN = 0; this.botN = {};
    this.hashes = new Map(); this.desync = false;
  }

  /** Make sure our own inputs exist (and have been sent) up to tick `upTo`. */
  ensureLocal(upTo, sample) {
    while (this.localN < upTo) {
      const k = ++this.localN;
      const m = k <= this.delay ? 0 : sample();
      this.inputs[this.role].set(k, m);
      this.send({ t: 'i', e: this.epoch, k, s: this.role, m });
    }
  }

  /** Host only: same for the CPU slots. */
  ensureBots(upTo, sample) {
    for (const s of this.bots) {
      let n = this.botN[s] || 0;
      while (n < upTo) {
        const k = ++n;
        const m = k <= this.delay ? 0 : sample(s);
        this.inputs[s].set(k, m);
        this.broadcast({ t: 'i', e: this.epoch, k, s, m });
      }
      this.botN[s] = n;
    }
  }

  /** Fill every slot's input object for tick nt. Returns false while any input has not arrived yet. */
  fill(nt, inArr) {
    for (let s = 0; s < this.size; s++) if (this.inputs[s].get(nt) === undefined) return false;
    for (let s = 0; s < this.size; s++) { decodeInput(this.inputs[s].get(nt), inArr[s]); this.inputs[s].delete(nt - 40); }
    return true;
  }

  sendHash(k, v) {
    if (this.isHost) this.onHash(k, v, this.role);
    else this.send({ t: 'h', e: this.epoch, k, v, s: this.role });
  }

  /** Host compares every guest's hash against its own. */
  onHash(k, v, slot) {
    if (!this.isHost) return;
    const h = this.hashes.get(k) || { others: {} };
    if (slot === this.role) h.own = v; else h.others[slot] = v;
    this.hashes.set(k, h);
    if (h.own === undefined) return;
    for (const s in h.others) {
      if (h.others[s] !== h.own && !this.desync) { this.desync = true; this.emit('desync', k); this.broadcast({ t: 'desync', k }); }
    }
    if (Object.keys(h.others).length >= this.humans.length - 1) this.hashes.delete(k);
    if (this.hashes.size > 20) this.hashes.delete(this.hashes.keys().next().value);
  }
}
