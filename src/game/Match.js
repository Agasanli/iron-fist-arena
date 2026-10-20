import {
  VIEW_W, VIEW_H, GROUND, WORLD_W, BOUND_L, BOUND_R, MAX_DIST, PUSH_W, MAX_HP, TICK,
} from './config.js';
import { settings } from './settings.js';
import { CHARACTERS } from '../entities/characters.js';
import { Fighter } from '../entities/Fighter.js';
import { Projectile } from '../entities/Projectile.js';
import { createPose, computePose, drawFighter, drawShadow, drawGhosts, drawTag } from '../entities/FighterRenderer.js';
import { Effects } from '../systems/Effects.js';
import { AI } from '../systems/AI.js';
import { createInputState, clearInput } from '../systems/Input.js';
import { encodeInput } from '../net/Session.js';
import { getArena } from './Arenas.js';
import { getSprite } from './Sprites.js';
import { audio } from '../audio/AudioEngine.js';
import { ARENAS } from './config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const START_X = [WORLD_W / 2 - 190, WORLD_W / 2 + 190];

/**
 * One fight session: owns fighters, projectiles, effects, camera and the round/match flow.
 * The Game drives it with fixed 60 Hz tick() calls and one render() per animation frame.
 */
export class Match {
  constructor(game, opts) {
    this.game = game;
    this.opts = opts;
    this.mode = opts.mode;                    // 'ai' | 'versus' | 'training' | 'online'
    this.net = opts.net || null;              // lockstep session for online play
    this.netDead = false; this.localBlocked = false; this.stallFrames = 0;
    this.training = opts.mode === 'training';
    this.hud = game.hud;
    this.input = game.input;
    this.arenaInfo = ARENAS.find((a) => a.id === opts.arena) || ARENAS[0];
    this.arena = getArena(this.arenaInfo.id);

    this.f = [new Fighter(CHARACTERS[opts.p1], 0), new Fighter(CHARACTERS[opts.p2], 1)];
    this.mirror = opts.p1 === opts.p2;
    this.sprites = [getSprite(opts.p1, false), getSprite(opts.p2, this.mirror)];
    this.poses = [createPose(), createPose()];
    this.in = [createInputState(), createInputState()];
    this.ai = (this.mode === 'ai' || this.training) ? new AI(this.training ? 'normal' : opts.difficulty) : null;
    this.projectiles = Array.from({ length: 8 }, () => new Projectile());
    this.fx = new Effects();
    this.rA = { x0: 0, x1: 0, y0: 0, y1: 0 };
    this.rB = { x0: 0, x1: 0, y0: 0, y1: 0 };
    this.pending = [];

    this.round = 1;
    this.roundTime = opts.roundTime || settings.roundTime;
    this.winsNeeded = opts.roundsToWin || settings.roundsToWin;
    this.f[0].wins = 0; this.f[1].wins = 0;
    this.f[0].resetStats(); this.f[1].resetStats();

    this.cam = { cx: WORLD_W / 2, z: 1 };
    this.shake = 0; this.flashA = 0; this.hitstop = 0; this.cine = null;
    this.timeScale = 1; this.time = 0; this.gtick = 0;
    this.paused = false; this.over = false; this.destroyed = false;
    this.comboShow = [null, null];
    this.tr = { infiniteHp: true, infiniteMeter: false, dummy: 'stand', last: 0, lastCombo: 0, lastComboDmg: 0, maxCombo: 0, total: 0, idleTicks: 0 };
    this.result = null;

    this.hud.setup(this);
    this.hud.show(true);
    this.beginRound();
    audio.playMusic(this.arenaInfo.track);
  }

  // ======================================================== flow
  beginRound() {
    this.f[0].reset(START_X[0], 1); this.f[1].reset(START_X[1], -1);
    for (const p of this.projectiles) p.active = false;
    this.fx.clear();
    this.timeLeft = this.training ? 99 : this.roundTime;
    this.phase = 'intro'; this.phaseTick = 0;
    this.timeScale = 1; this.hitstop = 0; this.cine = null; this.shake = 0; this.flashA = 0;
    this.comboShow[0] = this.comboShow[1] = null;
    this.hud.clearCombo(0); this.hud.clearCombo(1);
    if (this.ai) this.ai.reset();
    this.cam.cx = WORLD_W / 2; this.cam.z = 1;
    this.perfect = false;
    this.input.flush();
    this.hud.update(this, true);
  }

  startFight() {
    this.phase = 'fight'; this.phaseTick = 0;
    this.input.flush();
  }

  /** Training: put both fighters back at the starting positions. */
  resetPositions() {
    for (let i = 0; i < 2; i++) {
      const f = this.f[i], hp = f.hp, meter = f.meter;
      f.reset(START_X[i], i === 0 ? 1 : -1);
      f.hp = hp; f.meter = meter;
    }
    for (const p of this.projectiles) p.active = false;
    this.hitstop = 0; this.cine = null;
    this.comboShow[0] = this.comboShow[1] = null;
    this.hud.clearCombo(0); this.hud.clearCombo(1);
    this.hud.announce('RESET', 'small');
  }

  endRound(winnerIdx, timeUp) {
    // winnerIdx: 0 / 1 / -1 draw
    this.phase = 'roundEnd'; this.phaseTick = 0; this.timeScale = 1;
    this.roundWinner = winnerIdx;
    if (winnerIdx >= 0) {
      this.f[winnerIdx].wins++;
      const loser = this.f[1 - winnerIdx];
      this.perfect = this.f[winnerIdx].hp >= MAX_HP && !timeUp;
      void loser;
    } else if (!this.training) {
      // draw: both fighters get a point (a final round is played if that ties a won match)
      this.f[0].wins++; this.f[1].wins++;
    }
    const name = (i) => (i === 0 ? 'PLAYER 1' : (this.mode === 'ai' ? 'CPU' : 'PLAYER 2'));
    let text, voice;
    if (winnerIdx < 0) { text = 'DRAW'; voice = 'Draw'; }
    else { text = `${name(winnerIdx)} WINS`; voice = winnerIdx === 0 ? 'Player one wins' : (this.mode === 'ai' ? 'C P U wins' : 'Player two wins'); }
    if (timeUp) this.hud.announce('TIME UP', 'small');
    setTimeout(() => { if (!this.destroyed && this.phase === 'roundEnd') { this.hud.announce(text, 'win'); audio.voice(voice); } }, timeUp ? 900 : 350);
    if (this.perfect) setTimeout(() => { if (!this.destroyed && this.phase === 'roundEnd') { this.hud.announce('PERFECT', 'perfect'); audio.voice('Perfect'); } }, 1700);
    audio.sfx(winnerIdx === 0 || winnerIdx === 1 ? 'win' : 'bell');
    this.hud.update(this, true);
  }

  finishRoundEnd() {
    const [a, b] = [this.f[0].wins, this.f[1].wins], need = this.winsNeeded;
    if ((a >= need || b >= need) && a !== b) { this.endMatch(a > b ? 0 : 1); return; }
    this.round++;
    this.beginRound();
  }

  endMatch(winnerIdx) {
    this.phase = 'matchEnd'; this.phaseTick = 0; this.over = true;
    this.result = { winner: winnerIdx, stats: [this.f[0].stats, this.f[1].stats] };
    audio.stopMusic();
    audio.sfx(this.mode === 'ai' && winnerIdx === 1 ? 'lose' : 'win');
    this.game.onMatchEnd(this);
  }

  // ======================================================== callbacks used by Fighter
  sfx(n) { audio.sfx(n); }
  dust(x, y, n) { this.fx.dust(x, y, n); }
  ghost(f) {
    const p = computePose(f, this.poses[f.index]);
    this.fx.ghost(f, p, f.cfg.color);
  }

  onUltStart(f, mv) {
    this.cine = { t: 0, len: settings.reducedFx ? 26 : 44, owner: f, name: mv.name, color: f.cfg.color, color2: f.cfg.color2 };
    audio.sfx('ult');
    this.flashA = 0.5;
  }

  onMoveActive(f, mv) {
    const x = f.x + f.facing * 40, y = f.y - 120;
    if (mv.sfx === 'light' || mv.sfx === 'heavy' || mv.sfx === 'kick') audio.sfx('whoosh');
    if (mv.sfx === 'rush') { audio.sfx('rush'); this.fx.ring(f.x, GROUND, 120, f.cfg.color, 20); this.fx.burst(f.x - f.facing * 30, f.y - 60, 14, f.cfg.color, 7, 24); }
    if (mv.projectile) {
      const p = this.projectiles.find((q) => !q.active);
      if (p) p.spawn(f, mv.projectile);
      audio.sfx('orb');
      this.fx.burst(f.x + f.facing * 70, f.y - 150, 12, '#8fe8ff', 6, 20);
      this.fx.add(5, f.x + f.facing * 70, f.y - 150, 0, 0, 12, 70, '#9ff');
    }
    if (mv.quake) {
      audio.sfx('quake'); this.addShake(18);
      for (let i = 0; i < 3; i++) this.fx.ring(f.x, GROUND, 160 + i * 150, i ? '#ffcf4a' : '#fff', 26 + i * 6);
      this.fx.burst(f.x, GROUND - 20, 40, '#ffcf4a', 12, 40, 5);
      this.fx.dust(f.x - 100, GROUND, 8); this.fx.dust(f.x + 100, GROUND, 8);
      this.flashA = 0.6;
    }
    if (mv.fx === 'burst') {
      audio.sfx('ultBoom'); this.addShake(18); this.flashA = 0.6;
      for (let i = 0; i < 4; i++) this.fx.ring(f.x, f.y - 120, 120 + i * 90, i % 2 ? '#ffffff' : (mv.fxColor || '#ffb347'), 26 + i * 5);
      this.fx.burst(f.x, f.y - 120, 36, mv.fxColor || '#ffb347', 13, 36, 5);
    }
    if (mv.fx === 'flurry') { audio.sfx('rush'); this.addShake(5); }
    if (mv.fx === 'storm') { audio.sfx('beam'); this.addShake(5); this.fx.burst(f.x + f.facing * 60, f.y - 200, 24, mv.fxItem === 'pizza' ? '#ffcf4a' : '#ff6fb5', 8, 30, 4); }
    if (mv.beam) {
      audio.sfx('beam'); this.addShake(6); this.beamTick = 0;
      this.fx.add(5, x, y - 40, 0, 0, 14, 120, '#9ff');
    }
    void x; void y;
  }

  onKnockdownLand(f, impact) {
    audio.sfx('thud');
    this.addShake(Math.min(10, impact * 0.6));
    this.fx.dust(f.x, f.y, 10);
    this.fx.ring(f.x, GROUND, 70, 'rgba(255,255,255,.7)', 16);
  }

  applyThrow(a, d) {
    const dmg = 95;
    d.hp = Math.max(0, d.hp - dmg);
    d.comboTaken = 1; d.comboDmg = dmg;
    d.state = 'airhit'; d.stateTick = 0; d.vy = -9; d.vx = a.facing * 5.5; d.y -= 2; d.juggle = 2; d.flash = 6;
    a.meter = Math.min(100, a.meter + dmg * 0.18); d.meter = Math.min(100, d.meter + dmg * 0.12);
    a.stats.damage += dmg; a.stats.hits++; a.stats.throws++; d.stats.taken += dmg;
    this.afterHit(a, d, dmg, 1, d.x, d.y - 110, 1.3, 'heavy', 8, 8);
    this.fx.text(d.x, d.y - 230, 'THROW', '#ffd84a', 32);
  }

  // ======================================================== hit resolution
  addShake(v) { if (settings.screenShake) this.shake = Math.max(this.shake, v); }

  afterHit(a, d, dmg, n, cx, cy, power, sfx, hitstop, shake) {
    audio.sfx(sfx);
    this.fx.spark(cx, cy, a.cfg.color, power, a.facing);
    this.hitstop = Math.max(this.hitstop, hitstop);
    this.addShake(shake);
    if (settings.screenShake && power > 1.2 && !settings.reducedFx) this.flashA = Math.max(this.flashA, 0.22);
    if (settings.damageNumbers || this.training) this.fx.text(d.x + (Math.random() - 0.5) * 30, d.y - d.cfg.body.hurtH - 10, String(dmg), n > 3 ? '#ff7a3a' : '#fff', 24 + Math.min(14, dmg / 8));
    this.comboShow[a.index] = { hits: n, dmg: d.comboDmg, t: 0 };
    if (n >= 2 && settings.comboCounter) this.hud.setCombo(a.index, n, d.comboDmg);
    a.stats.maxCombo = Math.max(a.stats.maxCombo, n);
    if (this.training) {
      const t = this.tr;
      if (a.index === 0) { t.last = dmg; t.lastCombo = n; t.lastComboDmg = d.comboDmg; t.maxCombo = Math.max(t.maxCombo, n); t.total += dmg; }
      t.idleTicks = 0;
    }
  }

  resolveHit(a, d, mv, rect, rectB, dir, final) {
    if (d.invuln > 0 || d.state === 'down' || d.state === 'getup' || d.state === 'grabbed' || d.state === 'win') return false;
    if (d.state === 'airhit' && d.juggle >= 2) return false;
    if (mv.groundOnly && !d.grounded) return false;
    const cx = (Math.max(rect.x0, rectB.x0) + Math.min(rect.x1, rectB.x1)) / 2;
    const cy = (Math.max(rect.y0, rectB.y0) + Math.min(rect.y1, rectB.y1)) / 2;
    // counter stance (Zaur): the incoming hit is negated and his strike fires immediately
    const dm = d.move;
    if (d.state === 'attack' && dm && dm.counter && d.moveTick >= dm.counter.from && d.moveTick <= dm.counter.to && d.grounded) {
      d.moveTick = dm.startup;                  // next tick = first active frame
      d.invuln = Math.max(d.invuln, 10);
      this.hitstop = Math.max(this.hitstop, 10); this.addShake(6); this.flashA = Math.max(this.flashA, 0.3);
      this.fx.ring(d.x, GROUND, 150, '#ffd54a', 20);
      this.fx.spark(cx, cy, '#ffd54a', 1.5, d.facing);
      this.fx.text(d.x, d.y - 260, 'COUNTER!', '#ffd54a', 34);
      audio.sfx('block'); audio.sfx('heavy');
      return 'counter';
    }
    const atWall = (d.x <= BOUND_L + 3 && dir < 0) || (d.x >= BOUND_R - 3 && dir > 0);

    const blocking = d.state === 'block' && d.grounded &&
      !(mv.level === 'low' && !d.crouchBlock) && !(mv.level === 'high' && d.crouchBlock);
    if (blocking) {
      const chip = mv.damage > 0 ? Math.max(1, Math.round(mv.damage * 0.1)) : 0;
      d.hp = Math.max(1, d.hp - chip);
      d.blockstun = mv.blockstun; d.state = 'block'; d.stateTick = 0;
      d.vx = dir * mv.knock * 0.8;
      if (atWall && a.state === 'attack') a.vx = -dir * mv.knock * 0.9;
      a.meter = Math.min(100, a.meter + mv.damage * 0.05); d.meter = Math.min(100, d.meter + mv.damage * 0.08);
      d.stats.blocks++;
      this.fx.blockSpark(cx, cy);
      audio.sfx('block');
      this.hitstop = Math.max(this.hitstop, 4);
      this.addShake(mv.shake > 4 ? 3 : 0);
      if (chip && (settings.damageNumbers || this.training)) this.fx.text(d.x, d.y - 230, String(chip), '#8fd8ff', 20);
      return 'block';
    }

    const wasAir = d.state === 'airhit';
    const inCombo = d.state === 'hit' || wasAir;
    d.comboTaken = inCombo ? d.comboTaken + 1 : 1;
    const n = d.comboTaken;
    const scale = mv.scaleExempt ? 1 : Math.max(0.35, 1 - 0.12 * (n - 1));
    let dmg = Math.round(mv.damage * scale);
    if (d.cfg.stats.defMul) dmg = Math.max(1, Math.round(dmg * d.cfg.stats.defMul));
    const counter = d.state === 'attack' && d.phase === 'startup' && !mv.multi;
    if (counter) dmg = Math.round(dmg * 1.15);
    if (final && mv.multi) dmg += mv.multi.finalBonus;
    d.hp = Math.max(0, d.hp - dmg);
    d.comboDmg = (inCombo ? d.comboDmg : 0) + dmg;
    const ko = d.hp <= 0;

    if (d.state === 'attack') { d.move = null; d.moveId = null; }
    if (d.state === 'throw' && d.throwTarget) { d.throwTarget.state = 'idle'; d.throwTarget.stateTick = 0; d.throwTarget = null; }   // a hit breaks a throw
    d.running = false; d.crouchBlock = false; d.buffer.ttl = 0; d.jumpBuf = 0;
    const launchV = final && mv.multi ? mv.multi.finalLaunch : mv.launch;
    const forced = (n >= 6 && !mv.multi) || ko;
    if (launchV || forced) {
      const v = launchV || 10;
      d.vy = wasAir ? -Math.max(6, v * 0.6) : -v;
      d.vx = dir * (mv.knock + 1.5);
      d.state = 'airhit'; d.stateTick = 0; d.y -= 2;
      d.juggle = wasAir ? d.juggle + 1 : 0;
    } else if (!d.grounded) {
      d.state = 'airhit'; d.stateTick = 0; d.vy = -5.5; d.vx = dir * mv.knock;
      d.juggle = wasAir ? d.juggle + 1 : 1;
    } else {
      d.state = 'hit'; d.stateTick = 0;
      d.hitstun = Math.round(mv.hitstun * Math.max(0.55, 1 - 0.07 * (n - 1)));
      d.vx = dir * mv.knock;
    }
    if (atWall && d.state === 'hit' && a.state === 'attack') a.vx = -dir * mv.knock * 0.9;
    d.flash = 6;
    a.meter = Math.min(100, a.meter + dmg * 0.18 * (a.cfg.stats.meterMul || 1)); d.meter = Math.min(100, d.meter + dmg * 0.12 * (d.cfg.stats.meterMul || 1));
    a.stats.damage += dmg; a.stats.hits++; d.stats.taken += dmg;
    const power = clamp(mv.hitstop / 7, 0.6, 2);
    const SFX = { orb: 'orbHit', ult: 'ultBoom', rush: 'heavy', light: 'light', heavy: 'heavy', kick: 'kick' };
    const sfxName = mv.style ? 'orbHit' : (SFX[mv.sfx] || 'light');
    this.afterHit(a, d, dmg, n, cx, cy, power, sfxName, mv.hitstop, mv.shake);
    if (counter) this.fx.text(d.x, d.y - 250, 'COUNTER', '#ffd84a', 26);
    return 'hit';
  }

  checkHits() {
    const pend = this.pending; pend.length = 0;
    for (let i = 0; i < 2; i++) {
      const a = this.f[i], d = this.f[1 - i];
      if (a.state !== 'attack' || a.phase !== 'active' || !a.move.hitbox) continue;
      const mv = a.move;
      if (mv.multi) {
        const k = a.moveTick - mv.startup - 1;
        if (k % mv.multi.interval !== 0 || a.multiCount >= mv.multi.hits) continue;
      } else if (a.hitDone) continue;
      a.hitRect(this.rA);
      d.hurtRect(this.rB);
      if (this.rA.x0 < this.rB.x1 && this.rA.x1 > this.rB.x0 && this.rA.y0 < this.rB.y1 && this.rA.y1 > this.rB.y0) {
        pend.push({ a, d, mv, ra: { ...this.rA }, rb: { ...this.rB } });
      } else if (mv.multi) {
        a.multiCount++;
      }
    }
    for (const h of pend) {
      const final = h.mv.multi ? h.a.multiCount === h.mv.multi.hits - 1 : false;
      const r = this.resolveHit(h.a, h.d, h.mv, h.ra, h.rb, h.a.facing, final);
      if (r) { h.a.moveConnected = true; if (h.mv.multi) h.a.multiCount++; else h.a.hitDone = true; }
    }
    // projectiles
    for (const p of this.projectiles) {
      if (!p.active) continue;
      const owner = p.owner, d = this.f[1 - owner.index];
      p.getRect();
      for (const q of this.projectiles) {
        if (q === p || !q.active || q.owner === owner) continue;
        q.getRect();
        if (p.rect.x0 < q.rect.x1 && p.rect.x1 > q.rect.x0 && p.rect.y0 < q.rect.y1 && p.rect.y1 > q.rect.y0) {
          p.active = false; q.active = false;
          this.fx.spark((p.x + q.x) / 2, p.y, '#ffffff', 1.2, 1); audio.sfx('block');
        }
      }
      if (!p.active) continue;
      d.hurtRect(this.rB);
      const r = p.rect;
      if (r.x0 < this.rB.x1 && r.x1 > this.rB.x0 && r.y0 < this.rB.y1 && r.y1 > this.rB.y0) {
        const res = this.resolveHit(owner, d, p.def, r, this.rB, p.dir, false);
        if (res) { p.active = false; owner.stats.hits += 0; }
      }
    }
  }

  pushApart() {
    const a = this.f[0], b = this.f[1];
    const skip = (f) => f.state === 'grabbed' || f.state === 'down' || f.state === 'airhit';
    if (skip(a) || skip(b) || a.state === 'throw' || b.state === 'throw') return;
    if (Math.abs(a.y - b.y) > 125) return;
    const dx = b.x - a.x, ov = PUSH_W - Math.abs(dx);
    if (ov <= 0) return;
    const s = dx === 0 ? (a.facing || 1) : Math.sign(dx);
    a.x = clamp(a.x - s * ov / 2, BOUND_L, BOUND_R);
    b.x = clamp(b.x + s * ov / 2, BOUND_L, BOUND_R);
    // anything left over (someone is against a wall) is pushed onto the other fighter
    const ov2 = PUSH_W - Math.abs(b.x - a.x);
    if (ov2 > 0) {
      if (a.x <= BOUND_L || a.x >= BOUND_R) b.x = clamp(b.x + s * ov2, BOUND_L, BOUND_R);
      else a.x = clamp(a.x - s * ov2, BOUND_L, BOUND_R);
    }
  }

  limitDistance() {
    const a = this.f[0], b = this.f[1];
    const d = b.x - a.x;
    if (Math.abs(d) > MAX_DIST) {
      const ex = (Math.abs(d) - MAX_DIST) / 2, s = Math.sign(d);
      a.x += s * ex; b.x -= s * ex;
    }
  }

  // ======================================================== simulation
  // ---- online lockstep -------------------------------------------------------
  sampleLocal() {
    if (this.over || this.localBlocked) { this.input.poll(0, this.netTmp = this.netTmp || createInputState()); return 0; }
    this.netTmp = this.netTmp || createInputState();
    return encodeInput(this.input.poll(0, this.netTmp));
  }

  /** A cheap fingerprint of the simulation, compared between the two machines once per second. */
  stateHash() {
    let h = 17;
    const mix = (v) => { h = (Math.imul(h, 31) + (v | 0)) | 0; };
    for (const f of this.f) {
      mix(f.x * 100); mix(f.y * 100); mix(f.vx * 100); mix(f.vy * 100); mix(f.hp); mix(f.meter * 100);
      mix(f.stateTick); mix(f.moveTick); mix(f.state.length); mix(f.wins); mix(f.cdSpecial);
    }
    mix(this.timeLeft * 1000); mix(this.round);
    return h;
  }

  /** Returns false when the remote input for the next tick has not arrived yet (the sim waits). */
  netStep() {
    const n = this.net, nt = this.gtick + 1;
    n.ensureLocal(nt + n.delay, () => this.sampleLocal());
    if (!n.fill(nt, this.in)) { this.stallFrames++; return false; }
    this.stallFrames = 0;
    if (nt % 60 === 0) n.sendHash(nt, this.stateHash());
    return true;
  }

  pollInputs() {
    if (this.net) return;                     // online inputs were already filled in by netStep()
    const inp = this.in;
    this.input.poll(0, inp[0]);
    if (this.mode === 'versus') this.input.poll(1, inp[1]);
    else if (this.mode === 'ai') { /* filled by AI */ }
    else if (this.training) this.dummyInput();
  }

  dummyInput() {
    const o = this.in[1], m = this.tr.dummy;
    if (m === 'cpu') return; // AI fills it in update
    clearInput(o);
    if (m === 'crouch') o.down = true;
    else if (m === 'block') o.block = true;
    else if (m === 'cblock') { o.block = true; o.down = true; }
    else if (m === 'jump' && this.gtick % 75 === 0) { o.pUp = o.up = true; }
  }

  tick() {
    if (this.destroyed || this.paused) return;
    if (this.net) {
      if (this.netDead) return;
      if (!this.netStep()) return false;
    }
    this.gtick++;
    this.time += TICK;
    this.phaseTick++;
    this.fx.update();
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - 0.03);
    this.shake *= 0.86; if (this.shake < 0.2) this.shake = 0;
    this.updateCamera();

    if (this.cine) {
      if (++this.cine.t >= this.cine.len) this.cine = null;
      return;
    }
    switch (this.phase) {
      case 'intro': this.tickIntro(); break;
      case 'fight': this.tickFight(); break;
      case 'ko': this.tickKO(); break;
      case 'roundEnd': this.tickRoundEnd(); break;
      case 'matchEnd': this.tickIdle(); break;
      default:
    }
    this.tickCombo();
  }

  tickIdle() {
    const e = this.in[0], o = this.in[1];
    clearInput(e); clearInput(o);
    for (let i = 0; i < 2; i++) this.f[i].update(this.in[i], this.f[1 - i], this);
    for (const p of this.projectiles) if (p.active) p.update();
    this.pushApart();
  }

  tickIntro() {
    if (this.phaseTick === 1) {
      const fin = this.round > 1 && this.f[0].wins >= this.winsNeeded - 1 && this.f[1].wins >= this.winsNeeded - 1 && !this.training;
      const txt = this.training ? 'TRAINING' : (fin ? 'FINAL ROUND' : `ROUND ${this.round}`);
      this.hud.announce(txt, 'round');
      audio.sfx('bell');
      audio.voice(this.training ? 'Training' : (fin ? 'Final round' : `Round ${this.round}`));
    }
    if (this.phaseTick === 78) { this.hud.announce('FIGHT!', 'fight'); audio.sfx('fight'); audio.voice('Fight'); }
    if (this.phaseTick >= 100) { this.startFight(); return; }
    this.tickIdle();
  }

  tickFight() {
    this.pollInputs();
    if (this.ai && (this.mode === 'ai' || this.tr.dummy === 'cpu')) this.ai.update(this.f[1], this.f[0], this, this.in[1]);
    this.f[0].readInput(this.in[0]); this.f[1].readInput(this.in[1]);
    if (this.hitstop > 0) { this.hitstop--; return; }

    this.f[0].update(this.in[0], this.f[1], this);
    this.f[1].update(this.in[1], this.f[0], this);
    for (const p of this.projectiles) if (p.active) p.update();
    this.pushApart();
    this.limitDistance();
    this.checkHits();
    this.dummyMaintenance();

    // training upkeep
    if (this.training) this.trainingTick();
    else {
      this.timeLeft -= TICK;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.timeUp(); return; }
    }
    const k0 = this.f[0].hp <= 0, k1 = this.f[1].hp <= 0;
    if (k0 || k1) this.startKO(k0, k1);
  }

  dummyMaintenance() { /* placeholder for future dummy behaviours */ }

  trainingTick() {
    const t = this.tr;
    const busy = this.f.some((f) => !f.neutral && f.state !== 'win');
    if (!busy) t.idleTicks++; else t.idleTicks = 0;
    for (const f of this.f) {
      if (t.infiniteHp) {
        if (f.hp < 1) f.hp = 1;
        if (t.idleTicks > 80 && f.hp < MAX_HP) f.hp = Math.min(MAX_HP, f.hp + 12);
      } else if (f.hp <= 0) {
        this.resetPositions(); for (const g of this.f) g.hp = MAX_HP;
      }
      if (t.infiniteMeter) f.meter = 100;
    }
    if (t.idleTicks > 150) { t.lastCombo = t.lastCombo; }
  }

  timeUp() {
    const a = this.f[0].hp, b = this.f[1].hp;
    this.endRound(a > b ? 0 : b > a ? 1 : -1, true);
    for (const f of this.f) if (f.state !== 'attack') { /* idle */ }
  }

  startKO(k0, k1) {
    this.phase = 'ko'; this.phaseTick = 0; this.timeScale = 0.35;
    this.f[0].ko = k0; this.f[1].ko = k1;
    this.hud.announce('K.O.', 'ko');
    audio.sfx('ko'); audio.voice('K O');
    this.addShake(14); this.flashA = 0.7;
    this.winnerOnKO = k0 && k1 ? -1 : (k0 ? 1 : 0);
  }

  tickKO() {
    clearInput(this.in[0]); clearInput(this.in[1]);
    if (this.hitstop > 0) this.hitstop--;
    else {
      this.f[0].update(this.in[0], this.f[1], this);
      this.f[1].update(this.in[1], this.f[0], this);
      for (const p of this.projectiles) if (p.active) p.update();
    }
    if (this.phaseTick === 40) this.timeScale = 1;
    if (this.phaseTick >= 78) {
      this.endRound(this.winnerOnKO, false);
    }
  }

  tickRoundEnd() {
    clearInput(this.in[0]); clearInput(this.in[1]);
    for (let i = 0; i < 2; i++) {
      const f = this.f[i];
      f.update(this.in[i], this.f[1 - i], this);
      if (this.roundWinner === i && f.grounded && f.neutral) { f.state = 'win'; f.stateTick = 0; f.vx = 0; }
      if (this.roundWinner === i && f.state === 'win' && f.t % 9 === 0) {
        this.fx.burst(f.x + (Math.random() - 0.5) * 120, f.y - 150 - Math.random() * 110, 3, f.cfg.color, 2.5, 34, 3.5);
      }
    }
    for (const p of this.projectiles) if (p.active) p.update();
    this.pushApart();
    if (this.phaseTick > 220) this.finishRoundEnd();
  }

  tickCombo() {
    for (let i = 0; i < 2; i++) {
      const c = this.comboShow[i];
      if (!c) continue;
      const d = this.f[1 - i];
      if (d.neutral || d.state === 'getup' || d.state === 'down') {
        if (++c.t > 55) { this.comboShow[i] = null; this.hud.clearCombo(i); }
      } else c.t = 0;
    }
  }

  updateCamera() {
    const a = this.f[0], b = this.f[1];
    const cam = this.cam;
    let tx = (a.x + b.x) / 2, tz = clamp(VIEW_W / (Math.abs(a.x - b.x) + 640), 1, 1.18);
    if (this.cine) { tx = this.cine.owner.x + this.cine.owner.facing * 80; tz = 1.42; }
    cam.z += (tz - cam.z) * (this.cine ? 0.18 : 0.07);
    cam.cx += (tx - cam.cx) * (this.cine ? 0.2 : 0.12);
    const half = VIEW_W / 2 / cam.z;
    cam.cx = clamp(cam.cx, half, WORLD_W - half);
  }

  // ======================================================== pause / lifecycle
  setPaused(v) {
    this.paused = v;
    audio.setDuck(v ? 0.3 : 1);
  }

  destroy() {
    this.destroyed = true;
    audio.stopMusic();
    audio.setDuck(1);
    this.hud.show(false);
  }

  // ======================================================== rendering
  render(ctx, k, realDt) {
    const cam = this.cam, z = cam.z;
    const sh = this.shake;
    const ox = sh ? (Math.random() - 0.5) * sh * 2 : 0, oy = sh ? (Math.random() - 0.5) * sh * 1.4 : 0;
    const camL = Math.max(0, cam.cx - VIEW_W / 2);
    const dy = -(z - 1) * 100;
    ctx.save();
    ctx.translate(ox, oy);
    this.arena.drawBack(ctx, camL, z, this.time, dy);
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H);
    ctx.scale(z, z);
    ctx.translate(-cam.cx, -VIEW_H);
    this.arena.drawFloor(ctx, this.time);
    this.drawWorld(ctx);
    ctx.restore();
    this.arena.drawFront(ctx, camL, this.time, realDt);
    ctx.restore();

    // vignette to keep fighters readable
    this.drawVignette(ctx);
    if (this.flashA > 0 && !settings.reducedFx) { ctx.fillStyle = `rgba(255,255,255,${this.flashA})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.cine) this.drawCinematic(ctx);
  }

  drawWorld(ctx) {
    const f = this.f;
    for (let i = 0; i < 2; i++) drawShadow(ctx, f[i]);
    drawGhosts(ctx, this.fx, (fi) => this.sprites[fi.index]);
    // the fighter that is attacking is drawn on top
    const order = (f[0].state === 'attack' || f[0].state === 'throw') && !(f[1].state === 'attack') ? [1, 0] : [0, 1];
    for (const i of order) {
      const fi = f[i];
      const pose = computePose(fi, this.poses[i]);
      if (fi.state === 'hit' || fi.state === 'block') { pose.ox += (this.hitstop > 0 ? (Math.random() - 0.5) * 5 : 0); }
      drawFighter(ctx, fi, this.sprites[i], pose, 1, fi.cfg.color);
      this.drawMoveFx(ctx, fi);
    }
    for (const p of this.projectiles) if (p.active) p.draw(ctx, this.time);
    this.fx.draw(ctx);
    if (this.phase === 'fight' || this.phase === 'intro') {
      if (this.net) {
        const me = this.net.role;
        drawTag(ctx, f[0], me === 0 ? 'YOU' : 'FRIEND', '#4aa8ff');
        drawTag(ctx, f[1], me === 1 ? 'YOU' : 'FRIEND', '#ff5a5a');
      } else {
        drawTag(ctx, f[0], 'P1', '#4aa8ff');
        drawTag(ctx, f[1], this.mode === 'ai' ? 'CPU' : (this.training ? 'DUMMY' : 'P2'), '#ff5a5a');
      }
    }
  }

  /** Move-specific visuals (beam, quake charge) */
  drawMoveFx(ctx, f) {
    if (f.state !== 'attack' || !f.move) return;
    const mv = f.move, ph = f.phase, t = f.moveTick;
    if (mv.beam && (ph === 'active')) {
      const len = mv.hitbox.w, hy = f.y - mv.hitbox.y + mv.hitbox.h / 2, h = mv.hitbox.h;
      ctx.save();
      ctx.translate(f.x + f.facing * 40, hy); ctx.scale(f.facing, 1);
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.75 + 0.25 * Math.sin(t * 1.7);
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, 'rgba(60,140,255,0)'); g.addColorStop(0.5, 'rgba(180,240,255,' + pulse + ')'); g.addColorStop(1, 'rgba(60,140,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, -h / 2, len, h);
      ctx.fillStyle = `rgba(255,255,255,${0.8 * pulse})`; ctx.fillRect(0, -h * 0.09, len, h * 0.18);
      // paper pages streaming along the beam
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#f5fbff';
      for (let i = 0; i < 10; i++) {
        const px = ((t * 38 + i * 83) % len), py = Math.sin(i * 2.3 + t * 0.4) * h * 0.38;
        ctx.save(); ctx.translate(px, py); ctx.rotate(t * 0.3 + i); ctx.fillRect(-7, -9, 14, 18); ctx.restore();
      }
      ctx.restore();
    }
    if (mv.quake && ph === 'startup') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const p = t / mv.startup;
      const g = ctx.createRadialGradient(f.x, f.y - 100, 5, f.x, f.y - 100, 120 + 80 * p);
      g.addColorStop(0, 'rgba(255,220,100,.7)'); g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y - 100, 120 + 80 * p, 0, 7); ctx.fill();
      ctx.restore();
    }
    if (mv.quake && ph === 'active') {
      ctx.save();
      const p = (t - mv.startup) / mv.active;
      ctx.fillStyle = '#6b5a3a';
      for (let i = -5; i <= 5; i++) {
        if (i === 0) continue;
        const x = f.x + i * 58, hgt = (70 + 30 * Math.sin(i * 1.7)) * (1 - Math.abs(i) * 0.08) * Math.sin(Math.min(1, p * 2 + 0.2) * Math.PI * 0.9);
        ctx.beginPath(); ctx.moveTo(x - 16, GROUND); ctx.lineTo(x - 5, GROUND - hgt); ctx.lineTo(x + 6, GROUND - hgt * 0.8); ctx.lineTo(x + 16, GROUND); ctx.fill();
      }
      ctx.restore();
    }
    if (mv.counter && ph !== 'recovery' && f.moveTick <= mv.counter.to + 2) {
      // counter stance: pulsing golden guard in front of him
      const pulse = 0.55 + 0.45 * Math.sin(f.moveTick * 0.5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,213,74,' + (0.7 * pulse) + ')'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(f.x + f.facing * 34, f.y - 120, 56, 128, 0, -1.2, 1.2); ctx.stroke();
      ctx.restore();
    }
    if (mv.fx === 'burst' && ph === 'startup') {
      const p = t / mv.startup;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(f.x, f.y - 120, 5, f.x, f.y - 120, 60 + 120 * p);
      const c = mv.fxRGB || [255, 200, 90];
      g.addColorStop(0, 'rgba(255,245,220,.8)'); g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y - 120, 60 + 120 * p, 0, 7); ctx.fill();
      ctx.restore();
    }
    if (mv.fx === 'burst' && ph === 'active') {
      const p = (t - mv.startup) / mv.active;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 8;
      for (let i = 0; i < 3; i++) {
        const r = 60 + (p * 1.2 + i * 0.3) * 260;
        const c = mv.fxRGB || [255, 200, 90];
        ctx.strokeStyle = 'rgba(' + c[0] + ',' + Math.min(255, c[1] + i * 20) + ',' + c[2] + ',' + Math.max(0, 0.9 - r / 420) + ')';
        ctx.beginPath(); ctx.ellipse(f.x, f.y - 120, r, r * 0.9, 0, 0, 7); ctx.stroke();
      }
      ctx.restore();
    }
    if (mv.fx === 'flurry' && ph === 'active') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const y = f.y - 215 + ((t * 37 + i * 53) % 130) - 40, x0 = f.x + f.facing * (40 + (i * 17) % 40), len = 90 + (i * 29) % 70;
        ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,.9)' : 'rgba(155,225,93,.9)'; ctx.lineWidth = 4 + (i % 3) * 2;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + f.facing * len, y + ((i % 2) ? -6 : 6)); ctx.stroke();
      }
      ctx.restore();
    }
    if (mv.fx === 'storm' && (ph === 'active' || ph === 'startup')) {
      const k = ph === 'active' ? 1 : t / mv.startup;
      ctx.save();
      for (let i = 0; i < 26; i++) {
        const x = f.x + f.facing * (30 + (i * 61) % 500), fall = ((t * (9 + (i % 4) * 2) + i * 47) % 330);
        const y = f.y - 340 + fall, s = (7 + (i % 3) * 3) * k;
        ctx.globalAlpha = (0.55 + 0.45 * Math.sin(i + t * 0.2)) * k;
        if (mv.fxItem === 'pizza') {          // falling pizza slices
          const sz = s * 2.2;
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(i + t * 0.1) * 0.6);
          ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.7); ctx.lineTo(sz, -sz * 0.7); ctx.lineTo(0, sz); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#c9702a'; ctx.fillRect(-sz, -sz * 0.9, sz * 2, sz * 0.3);
          ctx.fillStyle = '#d23a2a'; ctx.beginPath(); ctx.arc(-sz * 0.25, -sz * 0.2, sz * 0.2, 0, 7); ctx.arc(sz * 0.2, sz * 0.15, sz * 0.18, 0, 7); ctx.fill();
          ctx.restore();
          continue;
        }
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : (i % 3 === 1 ? '#ff6fb5' : '#c46bff');
        ctx.beginPath();                      // little hearts
        ctx.moveTo(x, y + s * 0.6); ctx.bezierCurveTo(x - s * 1.3, y - s * 0.4, x - s * 0.5, y - s * 1.3, x, y - s * 0.4);
        ctx.bezierCurveTo(x + s * 0.5, y - s * 1.3, x + s * 1.3, y - s * 0.4, x, y + s * 0.6); ctx.fill();
      }
      ctx.restore();
    }
    if (f.cfg.id === 'delegate' && mv.projectile && ph === 'startup') {
      // charging contract orb in hand
      const p = f.moveTick / mv.startup;
      const x = f.x + f.facing * 70, y = f.y - 150;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12 + 40 * p);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.4, 'rgba(110,210,255,.7)'); g.addColorStop(1, 'rgba(60,120,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 12 + 40 * p, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  drawVignette(ctx) {
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.55, VIEW_H * 0.35, VIEW_W / 2, VIEW_H * 0.55, VIEW_W * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawCinematic(ctx) {
    const c = this.cine, p = c.t / c.len;
    const a = Math.min(1, c.t / 8) * (p > 0.85 ? (1 - p) / 0.15 : 1);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,12,${0.62 * a})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // letterbox bars
    const bar = 70 * a;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VIEW_W, bar); ctx.fillRect(0, VIEW_H - bar, VIEW_W, bar);
    if (!settings.reducedFx) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const y = ((i * 97 + c.t * 38) % (VIEW_H - 140)) + 70, w = 160 + (i * 53) % 420;
        const x = ((c.t * (30 + (i % 5) * 14) + i * 211) % (VIEW_W + 400)) - 200;
        ctx.fillStyle = i % 2 ? c.color + '44' : c.color2 + '44';
        ctx.fillRect(c.owner.facing > 0 ? x : VIEW_W - x - w, y, w, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // banner
    const slide = Math.min(1, c.t / 10);
    const bx = (1 - slide) * -VIEW_W * 0.4;
    ctx.translate(VIEW_W / 2 + bx, VIEW_H * 0.32);
    ctx.rotate(-0.045);
    ctx.globalAlpha = a;
    ctx.fillStyle = c.color2; ctx.fillRect(-520, -58, 1040, 92);
    ctx.fillStyle = '#000'; ctx.fillRect(-520, 34, 1040, 8);
    ctx.font = 'italic 900 78px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = '#000';
    ctx.strokeText(c.name, 0, 20); ctx.fillStyle = '#fff'; ctx.fillText(c.name, 0, 20);
    ctx.restore();
    // redraw the attacker above the dimming
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H); ctx.scale(this.cam.z, this.cam.z); ctx.translate(-this.cam.cx, -VIEW_H);
    const o = c.owner, pose = computePose(o, this.poses[o.index]);
    pose.aura = 1;
    drawFighter(ctx, o, this.sprites[o.index], pose, 1, o.cfg.color);
    ctx.restore();
  }

  /** Mirror pose update for attract mode (menus) */
  renderAttract(ctx) { this.render(ctx, 1, 0); }
}
