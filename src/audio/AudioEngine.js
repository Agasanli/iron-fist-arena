import { settings, onSettingsChange } from '../game/settings.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- procedural music ----------
// Each bar is 16 steps. bass / lead values are semitone offsets above the chord root (null = rest).
const T = null;
const TRACKS = {
  menu: {
    bpm: 84, root: 45, prog: [0, -4, -2, -5], swing: 0, pad: true,
    bass: [0, T, T, T, T, T, T, T, 7, T, T, T, T, T, T, T],
    lead: [12, T, T, 7, T, T, 15, T, T, 10, T, T, 7, T, T, T],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  },
  fight1: {
    bpm: 144, root: 40, prog: [0, 0, -4, -2], saw: true,
    bass: [0, T, 0, 12, T, 0, T, 0, 0, T, 0, 12, T, 7, T, 10],
    lead: [12, T, 15, T, 19, T, 15, T, 12, T, 15, T, 22, T, 19, 15],
    kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], hat: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1],
  },
  fight2: {
    bpm: 112, root: 38, prog: [0, 0, 3, -2], saw: false,
    bass: [0, 0, T, 0, T, 12, T, 0, 0, T, 0, T, 10, T, 7, T],
    lead: [T, T, 12, T, T, T, 15, T, T, T, 14, T, T, 12, T, T],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
  },
  fight3: {
    bpm: 132, root: 43, prog: [0, -2, -4, -5], saw: true, arp: true,
    bass: [0, T, T, 0, T, T, 0, T, 12, T, T, 12, T, T, 7, T],
    lead: [0, 7, 12, 7, 15, 12, 7, 12, 0, 7, 12, 7, 14, 12, 7, 12],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
  },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.timer = null;
    this.track = null;
    this.duck = 1;
    this.noiseBuf = null;
    onSettingsChange(() => this.apply());
  }

  /** Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createGain();
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        this.musicGain = c.createGain();
        this.sfxGain = c.createGain();
        this.musicGain.connect(this.master); this.sfxGain.connect(this.master);
        this.master.connect(comp); comp.connect(c.destination);
        const len = c.sampleRate;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.apply();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.pendingTrack && !this.track) this.playMusic(this.pendingTrack);
    } catch (e) { console.warn('Audio unavailable', e); this.ctx = null; }
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(settings.muted ? 0 : settings.musicVol * 0.55 * this.duck, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(settings.muted ? 0 : settings.sfxVol, t, 0.05);
    if (settings.muted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  setDuck(v) { this.duck = v; this.apply(); }

  // ---------- synth primitives ----------
  tone(freq, type, dur, vol, slideTo, delay = 0, dest) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.03);
  }

  noise(dur, vol, ftype, f0, f1, delay = 0, q = 1, dest) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // ---------- sound effects ----------
  sfx(name) {
    if (!this.ctx || settings.muted || this.ctx.state !== 'running') return;
    switch (name) {
      case 'light': this.noise(0.08, 0.5, 'bandpass', 2400, 700, 0, 1.2); this.tone(170, 'sine', 0.1, 0.55, 70); break;
      case 'heavy': this.noise(0.16, 0.7, 'lowpass', 3500, 250); this.tone(110, 'sine', 0.22, 0.8, 38); this.tone(240, 'square', 0.08, 0.18, 60); break;
      case 'kick': this.noise(0.12, 0.6, 'bandpass', 1500, 400, 0, 0.8); this.tone(130, 'triangle', 0.16, 0.7, 45); break;
      case 'block': this.tone(1300, 'square', 0.05, 0.16, 900); this.tone(820, 'sine', 0.14, 0.3, 700); this.noise(0.06, 0.3, 'highpass', 4000, 2000); break;
      case 'twang': this.tone(720, 'triangle', 0.14, 0.35, 240); this.noise(0.09, 0.2, 'bandpass', 1600, 500); break;
      case 'whoosh': this.noise(0.14, 0.2, 'bandpass', 500, 2200, 0, 0.7); break;
      case 'jump': this.tone(240, 'sine', 0.13, 0.22, 560); break;
      case 'land': this.noise(0.09, 0.3, 'lowpass', 600, 120); this.tone(90, 'sine', 0.1, 0.4, 50); break;
      case 'rush': this.tone(120, 'sawtooth', 0.45, 0.28, 520); this.noise(0.45, 0.3, 'bandpass', 300, 2600, 0, 0.6); this.tone(60, 'sine', 0.3, 0.5, 30); break;
      case 'orb': this.tone(320, 'sine', 0.3, 0.35, 1000); this.tone(640, 'triangle', 0.26, 0.2, 1500, 0.04); this.noise(0.18, 0.15, 'highpass', 3000, 6000); break;
      case 'orbHit': this.tone(900, 'sine', 0.2, 0.4, 200); this.noise(0.2, 0.4, 'bandpass', 2500, 500); this.tone(100, 'sine', 0.2, 0.6, 40); break;
      case 'ult': this.tone(70, 'sawtooth', 0.9, 0.3, 880); this.noise(0.9, 0.35, 'bandpass', 200, 4000, 0, 0.5); this.tone(110, 'square', 0.6, 0.15, 440, 0.1); break;
      case 'ultBoom': this.tone(70, 'sine', 1.1, 1.0, 22); this.noise(1.0, 0.9, 'lowpass', 2200, 80); this.tone(40, 'square', 0.5, 0.3, 20); break;
      case 'quake': this.tone(55, 'sine', 0.9, 1.0, 20); this.noise(0.9, 0.7, 'lowpass', 900, 60); break;
      case 'beam': this.tone(300, 'sawtooth', 0.5, 0.25, 700); this.tone(450, 'square', 0.4, 0.12, 900); break;
      case 'ko': this.tone(200, 'sawtooth', 0.9, 0.4, 40); this.noise(0.8, 0.8, 'lowpass', 3000, 100); this.tone(60, 'sine', 1, 1, 25); break;
      case 'grab': this.noise(0.1, 0.3, 'bandpass', 800, 300); this.tone(180, 'triangle', 0.1, 0.4, 100); break;
      case 'thud': this.tone(70, 'sine', 0.2, 0.8, 35); this.noise(0.12, 0.4, 'lowpass', 500, 80); break;
      case 'deny': this.tone(160, 'square', 0.08, 0.1, 110); break;
      case 'menuMove': this.tone(740, 'sine', 0.04, 0.12, 900); break;
      case 'menuSelect': this.tone(520, 'square', 0.07, 0.14, 1040); this.tone(780, 'sine', 0.12, 0.18, 1170, 0.05); break;
      case 'menuBack': this.tone(520, 'square', 0.07, 0.12, 300); break;
      case 'bell': this.tone(880, 'sine', 0.8, 0.35, 870); this.tone(1320, 'sine', 0.6, 0.15, 1300); this.tone(440, 'sine', 1, 0.2, 430); break;
      case 'fight': this.tone(220, 'sawtooth', 0.4, 0.3, 440); this.noise(0.3, 0.4, 'bandpass', 400, 3000); this.tone(110, 'sine', 0.5, 0.6, 50); break;
      case 'win': [60, 64, 67, 72, 76].forEach((n, i) => this.tone(mtof(n), 'square', 0.28, 0.16, 0, i * 0.11)); this.tone(mtof(79), 'triangle', 0.9, 0.2, 0, 0.55); break;
      case 'lose': [67, 63, 60, 55].forEach((n, i) => this.tone(mtof(n), 'triangle', 0.4, 0.25, mtof(n - 2), i * 0.2)); break;
      default:
    }
  }

  voice(text) {
    if (!settings.announcer || settings.muted || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.85; u.pitch = 0.45; u.volume = Math.min(1, settings.sfxVol);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  // ---------- music ----------
  playMusic(name) {
    this.pendingTrack = name;
    if (!this.ctx) return;
    if (this.track === name && this.timer) return;
    this.stopMusic(true);
    const tr = TRACKS[name];
    if (!tr) return;
    this.track = name; this.pendingTrack = name;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    const sched = () => {
      if (!this.ctx) return;
      const spb = 60 / tr.bpm / 4;
      while (this.nextTime < this.ctx.currentTime + 0.18) {
        this.musicStep(tr, this.step, this.nextTime, spb);
        this.nextTime += spb; this.step++;
      }
    };
    sched();
    this.timer = setInterval(sched, 40);
  }

  stopMusic(keepPending) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.track = null;
    if (!keepPending) this.pendingTrack = null;
  }

  musicStep(tr, step, time, spb) {
    const c = this.ctx, s16 = step % 16, bar = Math.floor(step / 16) % tr.prog.length;
    const root = tr.root + tr.prog[bar];
    const out = this.musicGain;
    const note = (type, freq, dur, vol, cutoff) => {
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = type; o.frequency.value = freq;
      f.type = 'lowpass'; f.frequency.value = cutoff;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(vol, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(f); f.connect(g); g.connect(out);
      o.start(time); o.stop(time + dur + 0.05);
    };
    const drum = (kind) => {
      if (kind === 'k') {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(150, time); o.frequency.exponentialRampToValueAtTime(40, time + 0.12);
        g.gain.setValueAtTime(0.9, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
        o.connect(g); g.connect(out); o.start(time); o.stop(time + 0.22);
      } else {
        const s = c.createBufferSource(); s.buffer = this.noiseBuf;
        const f = c.createBiquadFilter(), g = c.createGain();
        f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
        const d = kind === 's' ? 0.16 : 0.04;
        g.gain.setValueAtTime(kind === 's' ? 0.5 : 0.18, time); g.gain.exponentialRampToValueAtTime(0.0001, time + d);
        s.connect(f); f.connect(g); g.connect(out); s.start(time, Math.random() * 0.4); s.stop(time + d + 0.02);
      }
    };
    if (tr.kick[s16]) drum('k');
    if (tr.snare[s16]) drum('s');
    if (tr.hat[s16]) drum('h');
    const b = tr.bass[s16];
    if (b !== null && b !== undefined) note(tr.saw ? 'sawtooth' : 'square', mtof(root + b), spb * 1.7, 0.26, 700);
    const l = tr.lead[s16];
    if (l !== null && l !== undefined) note(tr.arp ? 'triangle' : 'square', mtof(root + 24 + l), spb * (tr.arp ? 1.6 : 2.5), tr.arp ? 0.2 : 0.09, 3200);
    if (tr.pad && s16 === 0) {
      [0, 7, 12, 15].forEach((iv) => {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(root + 12 + iv); o.detune.value = (Math.random() - 0.5) * 14;
        f.type = 'lowpass'; f.frequency.value = 900;
        const dur = spb * 16;
        g.gain.setValueAtTime(0.0001, time); g.gain.linearRampToValueAtTime(0.05, time + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, time + dur);
        o.connect(f); f.connect(g); g.connect(out); o.start(time); o.stop(time + dur + 0.1);
      });
    }
  }
}

export const audio = new AudioEngine();
