import { GROUND, BOUND_L, BOUND_R, MAX_HP } from '../game/config.js';
import { applyWeapon } from './weapons.js';

const RANK = { light: 1, crouchLight: 1, heavy: 2, crouchHeavy: 2, special: 3, ultimate: 4 };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * Pure gameplay entity: state machine, physics, move execution.
 * No drawing here (see FighterRenderer) and no input reading (see Input / AI).
 */
export class Fighter {
  constructor(cfg, index, weapon = 'fists', team = index) {
    this.cfg = cfg;
    this.index = index;
    this.team = team;
    this.weapon = weapon;
    this.moves = applyWeapon(cfg.moves, weapon);      // character moves with the weapon's modifiers
    this.wins = 0;
    this.stats = null;
    this.buffer = { action: null, ttl: 0 };
    this.lastTap = [-99, -99];
    this.move = null;
    this.reset(900, 1);
    this.resetStats();
  }

  resetStats() {
    this.stats = { damage: 0, hits: 0, blocks: 0, maxCombo: 0, specials: 0, throws: 0, ultimates: 0, taken: 0 };
  }

  reset(x, facing) {
    this.x = x; this.y = GROUND; this.vx = 0; this.vy = 0;
    this.facing = facing;
    this.hp = MAX_HP; this.shownHp = MAX_HP;
    this.meter = 0;
    this.state = 'idle'; this.stateTick = 0; this.t = 0;
    this.move = null; this.moveId = null; this.moveTick = 0;
    this.hitDone = false; this.hitMask = 0; this.moveConnected = false; this.multiCount = 0; this.chain = 0;
    this.hitstun = 0; this.blockstun = 0; this.invuln = 0; this.lag = 0;
    this.comboTaken = 0; this.comboDmg = 0; this.juggle = 0; this.flash = 0;
    this.cdSpecial = 0; this.jumpBuf = 0;
    this.buffer.action = null; this.buffer.ttl = 0;
    this.running = false; this.runDir = 0; this.dashReq = false; this.crouchBlock = false;
    this.airAttackUsed = false; this.walkPhase = 0; this.throwTarget = null;
    this.vyLand = 0; this.ko = false; this.lastLaunch = false; this.hitShake = 0;
  }

  // ---------- helpers ----------
  get crouching() {
    return this.state === 'crouch' || (this.state === 'block' && this.crouchBlock) ||
      (this.state === 'attack' && this.move && this.move.crouch);
  }
  get grounded() { return this.y >= GROUND; }
  get neutral() {
    const s = this.state;
    return s === 'idle' || s === 'walk' || s === 'run' || s === 'crouch' || s === 'block';
  }
  get phase() {
    if (this.state !== 'attack' || !this.move) return null;
    const mv = this.move, t = this.moveTick;
    if (t <= mv.startup) return 'startup';
    if (t <= mv.startup + mv.active) return 'active';
    return 'recovery';
  }
  /** true when the fighter is committed to something the opponent can punish */
  get vulnerableRecovery() { return this.phase === 'recovery'; }

  hurtRect(out) {
    const b = this.cfg.body;
    let h = b.hurtH;
    if (this.crouching) h = b.crouchH;
    if (this.state === 'down' || this.state === 'getup') h = 55;
    else if (this.state === 'airhit') h = 120;
    const w = (this.state === 'down' ? b.hurtW + 70 : b.hurtW);
    out.x0 = this.x - w / 2; out.x1 = this.x + w / 2;
    out.y1 = this.y; out.y0 = this.y - h;
    return out;
  }

  hitRect(out) {
    const hb = this.move && this.move.hitbox;
    if (!hb) return null;
    out.x0 = this.facing > 0 ? this.x + hb.x : this.x - hb.x - hb.w;
    out.x1 = out.x0 + hb.w;
    out.y0 = this.y - hb.y; out.y1 = out.y0 + hb.h;
    return out;
  }

  // ---------- input ----------
  readInput(inp) {
    if (inp.pLight) this.setBuf('light');
    else if (inp.pHeavy) this.setBuf('heavy');
    else if (inp.pSpecial) this.setBuf('special');
    else if (inp.pUlt) this.setBuf('ult');
    if (inp.pUp) this.jumpBuf = 6;
    if (inp.pLeft) this.tapDir(-1);
    if (inp.pRight) this.tapDir(1);
  }
  setBuf(a) { this.buffer.action = a; this.buffer.ttl = 9; }
  tapDir(dir) {
    const i = dir > 0 ? 1 : 0;
    if (this.t - this.lastTap[i] < 14) {
      if (dir * this.facing > 0) { this.runDir = dir; } else { this.dashReq = true; }
      this.lastTap[i] = -99;
    } else {
      this.lastTap[i] = this.t;
    }
  }

  // ---------- main update ----------
  update(inp, opp, m) {
    this.t++; this.stateTick++;
    if (this.cdSpecial > 0) this.cdSpecial--;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.buffer.ttl > 0) this.buffer.ttl--;
    if (this.jumpBuf > 0) this.jumpBuf--;

    switch (this.state) {
      case 'attack': this.updateAttack(inp, opp, m); break;
      case 'jump': this.updateJump(inp, opp, m); break;
      case 'hit':
        this.vx *= 0.86;
        if (--this.hitstun <= 0) this.toNeutral();
        break;
      case 'airhit': break;
      case 'down':
        this.vx *= 0.8;
        if (!this.ko && this.stateTick > 36) { this.state = 'getup'; this.stateTick = 0; this.invuln = 24; this.comboTaken = 0; }
        break;
      case 'getup':
        if (this.stateTick > 16) this.toNeutral();
        break;
      case 'grabbed':
        this.vx = 0;
        if (this.stateTick > 40) this.toNeutral();
        break;
      case 'throw': this.updateThrow(opp, m); break;
      case 'dashback':
        this.vx = -this.facing * 8.5 * Math.max(0, 1 - this.stateTick / 15);
        if (this.stateTick === 3) m.dust(this.x, this.y, 5);
        if (this.stateTick > 17) this.toNeutral();
        break;
      case 'win': this.vx *= 0.8; break;
      default: this.updateNeutral(inp, opp, m);
    }
    this.integrate(m);
  }

  toNeutral() {
    this.state = 'idle'; this.stateTick = 0;
    this.comboTaken = 0; this.comboDmg = 0; this.juggle = 0; this.chain = 0;
    this.move = null; this.moveId = null; this.crouchBlock = false;
  }

  updateNeutral(inp, opp, m) {
    if (opp) this.facing = opp.x >= this.x ? 1 : -1;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    this.chain = 0;

    if (this.state === 'block' && this.blockstun > 0) {
      this.blockstun--; this.vx *= 0.8;
      return;
    }
    if (this.lag > 0) { this.lag--; this.vx *= 0.7; this.state = 'idle'; return; }

    if (this.buffer.ttl > 0 && this.consumeBuffer(inp, opp, m)) return;
    if (this.jumpBuf > 0 && this.grounded) { this.doJump(dir, m); return; }
    if (this.dashReq) {
      this.dashReq = false;
      this.state = 'dashback'; this.stateTick = 0; this.invuln = 7; this.running = false;
      m.sfx('whoosh');
      m.ghost(this);
      return;
    }
    const st = this.cfg.stats;
    if (inp.block) {
      this.state = 'block'; this.crouchBlock = !!inp.down; this.vx = 0; this.running = false;
      return;
    }
    this.crouchBlock = false;
    if (inp.down) { this.state = 'crouch'; this.vx = 0; this.running = false; return; }

    if (dir === 0) {
      this.state = 'idle'; this.vx = 0; this.running = false; this.runDir = 0;
      return;
    }
    if (this.runDir === dir && dir * this.facing > 0) this.running = true;
    if (this.running && (this.runDir !== dir)) this.running = false;
    if (this.running) {
      this.state = 'run';
      this.vx = dir * st.run;
      if (this.t % 6 === 0) m.dust(this.x - dir * 20, this.y, 1);
      if (this.t % 7 === 0) m.ghost(this);
    } else {
      this.state = 'walk';
      this.vx = dir * (dir * this.facing > 0 ? st.walk : st.back);
    }
    this.walkPhase += Math.abs(this.vx) * (this.running ? 0.075 : 0.09);
  }

  consumeBuffer(inp, opp, m) {
    const a = this.buffer.action;
    this.buffer.ttl = 0;
    if (a === 'ult') {
      if (this.meter >= 100 && this.grounded) { this.meter = 0; this.startMove('ultimate', m); this.stats.ultimates++; return true; }
      m.sfx('deny');
      return false;
    }
    if (a === 'special') {
      if (this.cdSpecial <= 0 && this.grounded) { this.startMove('special', m); this.stats.specials++; return true; }
      m.sfx('deny');
      return false;
    }
    if (a === 'light' && inp.block && this.grounded) {
      this.startThrow(opp, m);
      return true;
    }
    const id = !this.grounded ? 'jump' + cap(a) : (inp.down ? 'crouch' + cap(a) : a);
    this.startMove(id, m);
    return true;
  }

  doJump(dir, m) {
    this.state = 'jump'; this.stateTick = 0;
    this.vy = -this.cfg.stats.jump;
    const st = this.cfg.stats;
    this.vx = dir * (this.running ? st.run * 0.85 : st.walk * 1.05);
    this.jumpBuf = 0; this.airAttackUsed = false; this.running = false; this.y -= 1;
    m.sfx('jump'); m.dust(this.x, this.y, 4);
  }

  updateJump(inp, opp, m) {
    if (this.buffer.ttl > 0 && !this.airAttackUsed) {
      const a = this.buffer.action;
      if (a === 'light' || a === 'heavy') {
        this.buffer.ttl = 0; this.airAttackUsed = true;
        this.startMove('jump' + cap(a), m);
      }
    }
  }

  startMove(id, m) {
    const mv = this.moves[id];
    if (!mv) return;
    this.move = mv; this.moveId = id; this.moveTick = 0;
    this.state = 'attack'; this.stateTick = 0;
    this.hitDone = false; this.hitMask = 0; this.moveConnected = false; this.multiCount = 0;
    this.buffer.ttl = 0; this.running = false;
    if (id === 'special' && mv.cooldown) this.cdSpecial = mv.cooldown;
    if (!mv.air) this.vx *= 0.3;
    if (mv.cinematic) m.onUltStart(this, mv);
  }

  updateAttack(inp, opp, m) {
    const mv = this.move;
    const t = ++this.moveTick, su = mv.startup, ac = mv.active;
    const total = su + ac + mv.recovery;
    if (mv.cinematic && t <= su) this.invuln = Math.max(this.invuln, 2);
    if (t === su + 1) m.onMoveActive(this, mv);

    if (mv.moveVx && t > su * 0.4 && t <= su + ac) {
      this.vx = this.facing * mv.moveVx;
      if (mv.aura && t % 3 === 0) m.ghost(this);
      if (mv.aura && t % 4 === 0) m.dust(this.x - this.facing * 30, this.y, 1);
    } else if (!mv.air) {
      this.vx *= 0.82;
    }

    const canCancel = this.moveConnected && this.buffer.ttl > 0 && t > su && !mv.air && !mv.cinematic &&
      t <= su + ac + Math.floor(mv.recovery * 0.65);
    if (canCancel && this.tryCancel(inp, m)) return;

    if (mv.air) {
      if (t >= su + ac) this.endMove();
    } else if (t >= total) {
      this.endMove();
    }
  }

  endMove() {
    this.move = null; this.moveId = null;
    if (!this.grounded) { this.state = 'jump'; this.stateTick = 0; }
    else { this.state = 'idle'; this.stateTick = 0; }
  }

  tryCancel(inp, m) {
    const a = this.buffer.action;
    let id = null;
    if (a === 'light' || a === 'heavy') id = inp.down ? 'crouch' + cap(a) : a;
    else if (a === 'special') { if (this.cdSpecial <= 0) id = 'special'; }
    else if (a === 'ult') { if (this.meter >= 100) id = 'ultimate'; }
    if (!id) return false;
    const from = RANK[this.moveId], to = RANK[id];
    const rep = (from === to) && (id === 'light' || id === 'crouchLight') && this.chain < 2 && id !== this.moveId;
    const chainLight = (from === to) && id === this.moveId && (id === 'light') && this.chain < 2;
    if (!(to > from || rep || chainLight)) return false;
    this.chain++;
    if (id === 'ultimate') { this.meter = 0; this.stats.ultimates++; }
    if (id === 'special') this.stats.specials++;
    this.buffer.ttl = 0;
    this.startMove(id, m);
    return true;
  }

  startThrow(opp, m) {
    this.state = 'throw'; this.stateTick = 0; this.throwTarget = null; this.vx = 0;
    const ok = opp && opp.grounded && opp.invuln <= 0 &&
      (opp.neutral || opp.state === 'hit') && opp.state !== 'grabbed' &&
      Math.abs(opp.x - this.x) <= this.cfg.stats.throwRange + 20;
    if (ok) {
      this.throwTarget = opp;
      opp.state = 'grabbed'; opp.stateTick = 0; opp.vx = 0; opp.move = null; opp.moveId = null;
      opp.running = false;
      m.sfx('grab');
    } else {
      m.sfx('whoosh');
    }
  }

  updateThrow(opp, m) {
    this.vx = 0;
    const tgt = this.throwTarget;
    if (tgt) {
      tgt.x = this.x + this.facing * 46; tgt.vx = 0;
      if (this.stateTick === 10) { m.applyThrow(this, tgt); }
      if (this.stateTick > 28) { this.throwTarget = null; this.state = 'idle'; this.stateTick = 0; }
    } else if (this.stateTick > 20) { this.state = 'idle'; this.stateTick = 0; this.lag = 4; }
  }

  // ---------- physics ----------
  integrate(m) {
    if (this.state === 'grabbed') return;
    this.x += this.vx;
    const wasAir = this.y < GROUND;
    if (this.y < GROUND || this.vy < 0) {
      this.y += this.vy;
      this.vy += this.cfg.stats.gravity * (this.state === 'airhit' ? 0.9 : 1);
    }
    if (this.x < BOUND_L) { this.x = BOUND_L; if (this.state === 'airhit') this.vx = 0; }
    if (this.x > BOUND_R) { this.x = BOUND_R; if (this.state === 'airhit') this.vx = 0; }
    if (this.y >= GROUND) {
      this.y = GROUND;
      if (wasAir || this.vy > 0) this.land(m);
      this.vy = 0;
    }
  }

  land(m) {
    const impact = this.vy;
    switch (this.state) {
      case 'jump':
        this.state = 'idle'; this.stateTick = 0; this.lag = 3; this.vx = 0; this.airAttackUsed = false;
        m.dust(this.x, this.y, 5); m.sfx('land');
        break;
      case 'attack':
        if (this.move && this.move.air) {
          this.move = null; this.moveId = null; this.state = 'idle'; this.stateTick = 0; this.lag = 5; this.vx = 0;
          m.dust(this.x, this.y, 5); m.sfx('land');
        }
        break;
      case 'airhit':
        this.state = 'down'; this.stateTick = 0; this.vx *= 0.5;
        this.comboTaken = 0; this.comboDmg = 0; this.juggle = 0;
        m.onKnockdownLand(this, impact);
        break;
      default:
    }
  }
}
