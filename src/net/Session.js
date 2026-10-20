import Peer from 'peerjs';
import { ACTIONS } from '../game/config.js';

// Peer-to-peer online play over WebRTC (PeerJS). The free public PeerJS cloud is only used for the
// initial handshake (matching the room code); game data then flows directly between the two browsers.
//
// The game uses deterministic lockstep: both machines simulate every 60 Hz tick from the same two
// inputs. Only inputs are sent (plus a small state hash every second to detect desyncs).

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
    default: return 'Connection problem: ' + (e && (e.message || e.type) || 'unknown error');
  }
}

export class Session {
  constructor() {
    this.handlers = {};
    this.peer = null; this.conn = null;
    this.role = 0;                // 0 = host (left fighter), 1 = guest (right fighter)
    this.code = '';
    this.delay = 4;               // input delay in ticks (4 ticks = 67 ms)
    this.epoch = 0;
    this.open = false;
    this.ping = 0;
    this.rematchLocal = false; this.rematchRemote = false;
    this.cfg = null; this.peerChar = null;
    this.pingTimer = 0;
    this.resetLock(0);
  }

  on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); return this; }
  emit(evt, ...a) { (this.handlers[evt] || []).forEach((f) => f(...a)); }

  // ---------------------------------------------------------------- connecting
  host() {
    return new Promise((resolve, reject) => {
      const attempt = (n) => {
        const code = makeCode();
        const peer = new Peer(PREFIX + code, { debug: 0 });
        this.peer = peer;
        peer.on('open', () => { this.role = 0; this.code = code; resolve(code); });
        peer.on('connection', (conn) => {
          if (this.conn) { try { conn.close(); } catch (e) { /* room is full */ } return; }
          this.setupConn(conn);
        });
        peer.on('error', (e) => {
          if (e.type === 'unavailable-id' && n < 5) { try { peer.destroy(); } catch (x) { /* ignore */ } attempt(n + 1); return; }
          reject(e); this.emit('error', e);
        });
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
      };
      attempt(0);
    });
  }

  join(code) {
    return new Promise((resolve, reject) => {
      const peer = new Peer({ debug: 0 });
      this.peer = peer; this.role = 1; this.code = code;
      const timer = setTimeout(() => reject(new Error('timeout')), 15000);
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true });
        this.setupConn(conn);
        conn.on('open', () => { clearTimeout(timer); resolve(); });
      });
      peer.on('error', (e) => { clearTimeout(timer); reject(e); this.emit('error', e); });
    });
  }

  setupConn(conn) {
    this.conn = conn;
    conn.on('open', () => {
      this.open = true;
      this.pingTimer = setInterval(() => this.send({ t: 'p', ts: performance.now() }), 1500);
      this.emit('connected');
    });
    conn.on('data', (d) => this.onData(d));
    conn.on('close', () => { this.open = false; this.emit('close'); });
    conn.on('error', () => { this.open = false; this.emit('close'); });
  }

  send(obj) {
    if (this.conn && this.open) { try { this.conn.send(obj); } catch (e) { /* connection dying */ } }
  }

  close() {
    this.handlers = {};
    clearInterval(this.pingTimer);
    this.open = false;
    try { if (this.conn) this.conn.close(); } catch (e) { /* ignore */ }
    try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
    this.conn = null; this.peer = null;
  }

  onData(d) {
    if (!d || typeof d !== 'object') return;
    switch (d.t) {
      case 'i': if (d.e === this.epoch) this.remote.set(d.k, d.m); break;
      case 'h': if (d.e === this.epoch) this.onHash(d.k, d.v, false); break;
      case 'p': this.send({ t: 'q', ts: d.ts }); break;
      case 'q': this.ping = Math.round(performance.now() - d.ts); break;
      default: this.emit('msg', d);
    }
  }

  // ---------------------------------------------------------------- lockstep
  resetLock(epoch) {
    this.epoch = epoch;
    this.local = new Map(); this.remote = new Map();
    this.localN = 0; this.hashes = new Map(); this.stalled = 0; this.desync = false;
  }

  /** Make sure local inputs exist (and have been sent) up to tick `upTo`. */
  ensureLocal(upTo, sample) {
    while (this.localN < upTo) {
      const k = ++this.localN;
      const m = k <= this.delay ? 0 : sample();
      this.local.set(k, m);
      this.send({ t: 'i', e: this.epoch, k, m });
    }
  }

  /** Fill the two input objects for tick nt. Returns false while the remote input has not arrived. */
  fill(nt, inArr) {
    const l = this.local.get(nt), r = this.remote.get(nt);
    if (l === undefined || r === undefined) return false;
    decodeInput(l, inArr[this.role]);
    decodeInput(r, inArr[1 - this.role]);
    this.local.delete(nt - 40); this.remote.delete(nt - 40);
    return true;
  }

  sendHash(k, v) {
    this.send({ t: 'h', e: this.epoch, k, v });
    this.onHash(k, v, true);
  }
  onHash(k, v, mine) {
    const h = this.hashes.get(k) || {};
    if (mine) h.l = v; else h.r = v;
    this.hashes.set(k, h);
    if (h.l !== undefined && h.r !== undefined) {
      if (h.l !== h.r && !this.desync) { this.desync = true; this.emit('desync', k); }
      this.hashes.delete(k);
    }
  }
}
