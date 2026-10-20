import { GROUND } from '../game/config.js';
import { clearInput } from './Input.js';

// Difficulty profiles. `react` is the delay (in 60Hz ticks) between something happening and
// the AI being able to see it: the AI never reads inputs early, it only reacts to visible state.
const LEVELS = {
  easy:   { react: 26, think: 40, aggr: 0.3,  defend: 0.2,  skill: 0.2,  punish: 0.15, special: 0.2,  ult: 0.3, antiair: 0.1,  combo: 0.12, lull: 0.45 },
  normal: { react: 15, think: 18, aggr: 0.55, defend: 0.5,  skill: 0.6,  punish: 0.5,  special: 0.5,  ult: 0.8, antiair: 0.42, combo: 0.55, lull: 0.2 },
  hard:   { react: 8,  think: 9,  aggr: 0.74, defend: 0.74, skill: 0.92, punish: 0.85, special: 0.72, ult: 1,   antiair: 0.72, combo: 0.9,  lull: 0.05 },
};

const RING = 48;
const reach = (mv) => (mv && mv.hitbox ? mv.hitbox.x + mv.hitbox.w : 0);

export class AI {
  constructor(level = 'normal') {
    this.setLevel(level);
    this.ring = Array.from({ length: RING }, () => ({
      atk: false, low: false, reach: 0, recov: false, air: false, stunned: false, blocking: false, dist: 999, proj: 999,
    }));
    this.reset();
  }
  setLevel(l) { this.level = l; this.p = LEVELS[l] || LEVELS.normal; }

  reset() {
    this.head = 0; this.state = 'idle'; this.timer = 20; this.stime = 0; this.seq = null; this.seqIdx = 0;
    this.prevAtk = false; this.low = false; this.dir = 0; this.cool = 0; this.prevProj = false;
    for (const r of this.ring) { r.atk = false; r.dist = 999; r.proj = 999; r.recov = false; r.stunned = false; r.air = false; }
  }

  record(me, opp, m) {
    const r = this.ring[this.head = (this.head + 1) % RING];
    const ph = opp.phase;
    r.atk = ph === 'startup' || ph === 'active';
    r.low = !!(opp.move && opp.move.level === 'low');
    r.reach = opp.move && opp.move.hitbox ? reach(opp.move) : 0;
    r.recov = ph === 'recovery';
    r.air = opp.y < GROUND - 45;
    r.stunned = opp.state === 'hit' || opp.state === 'airhit' || opp.state === 'down';
    r.blocking = opp.state === 'block';
    r.dist = Math.abs(opp.x - me.x);
    r.proj = 999;
    for (const pr of m.projectiles) {
      if (!pr.active || pr.owner.team === me.team) continue;
      const d = (me.x - pr.x) * pr.dir;
      if (d > 0 && d < r.proj) r.proj = d;
    }
  }

  delayed() { return this.ring[(this.head - this.p.react + RING * 2) % RING]; }

  start(state, dur, seq) {
    this.state = state; this.timer = dur; this.stime = 0; this.seq = seq || null; this.seqIdx = 0;
  }

  update(me, opp, m, out) {
    clearInput(out);
    this.record(me, opp, m);
    const p = this.p, R = Math.random;
    const busy = me.state === 'attack' || me.state === 'jump';
    if (!me.neutral && !busy) { this.start('idle', 4); return out; }

    const o = this.delayed();
    const toward = opp.x >= me.x ? 1 : -1;
    const dist = Math.abs(opp.x - me.x);

    // --- reactions (based on delayed observation only)
    if (me.neutral && this.state !== 'defend') {
      const sp = me.moves.special;
      if (sp.counter && o.atk && !this.prevAtk && o.dist < o.reach + 90 && me.cdSpecial <= 0 && R() < 0.2 + 0.5 * p.skill) {
        out.pSpecial = out.special = true;          // Executive Stance: wait for the hit
        this.start('idle', 26);
      } else if (o.atk && !this.prevAtk && o.dist < o.reach + 70 && R() < p.defend) {
        this.low = o.low;
        this.start('defend', 22 + (R() * 10 | 0));
      } else if (o.proj < 280 && o.proj > 40 && !this.prevProj) {
        const r = R();
        if (r < p.defend * 0.8) { this.low = false; this.start('defend', 26); }
        else if (r < p.defend * 0.8 + 0.25 * p.skill) this.start('jump', 40);
      }
    }
    this.prevAtk = o.atk;
    this.prevProj = o.proj < 280;

    this.stime++;
    if (--this.timer <= 0) this.decide(me, opp, m, dist, o, toward);
    this.act(me, opp, out, toward, dist);
    return out;
  }

  decide(me, opp, m, dist, o, toward) {
    const p = this.p, R = Math.random, mv = me.moves;
    const reachL = reach(mv.light), reachH = reach(mv.heavy);
    const think = p.think + (R() * p.think * 0.5 | 0);
    if (!me.neutral && me.state !== 'jump') { this.start('idle', 5); return; }
    // lower difficulties hesitate: they sometimes just stand there
    if (R() < p.lull && !(o.recov && R() < p.punish)) { this.start('idle', think); return; }

    // 1. ultimate when full and opponent is in range / vulnerable
    if (me.meter >= 100 && R() < p.ult * 0.4) {
      const rng = mv.ultimate.projectile ? 700 : reach(mv.ultimate);
      if (dist < Math.max(rng, 300) && (mv.ultimate.groundOnly ? !o.air : true)) {
        this.start('attack', 70, [{ at: 0, a: 'ult' }]); return;
      }
    }
    // 2. punish visible recovery
    if (o.recov && !o.stunned && dist < reachH + 25 && R() < p.punish) {
      this.start('attack', 50, R() < p.skill ? [{ at: 0, a: 'light' }, { at: 8, a: 'heavy' }] : [{ at: 0, a: 'heavy' }]);
      return;
    }
    // 3. anti-air
    if (o.air && dist < 200 && dist > 40 && R() < p.antiair) {
      this.start('attack', 40, [{ at: 0, a: 'heavy', down: true }]); return;
    }
    // 4. opponent knocked down: set up
    if (o.stunned && opp.state === 'down') {
      if (dist > 130) this.start('approach', think); else this.start('idle', think);
      return;
    }
    const proj = mv.special && mv.special.projectile;
    // 5. distance zones
    if (dist < reachL + 30) {
      const r = R();
      if (opp.state === 'block' && R() < p.skill * 0.55) {
        this.start('attack', 40, [{ at: 0, a: 'light', block: true }]);
      } else if (r < p.aggr) {
        const c = R();
        let seq;
        if (c < 0.2 + 0.2 * p.skill) seq = [{ at: 0, a: 'light', down: true }, { at: 9, a: 'heavy', down: true }];
        else if (c < 0.6) seq = [{ at: 0, a: 'light' }, { at: 8, a: 'light' }, { at: 17, a: 'heavy' }];
        else seq = [{ at: 0, a: 'light' }, { at: 9, a: 'special' }];
        if (!(mv.special && !mv.special.counter && me.cdSpecial <= 0)) seq = seq.filter((s) => s.a !== 'special');
        if (R() > p.combo) seq = [seq[0]];
        this.start('attack', 45, seq);
      } else if (r < p.aggr + 0.16) {
        this.start('retreat', 14 + (R() * 14 | 0));
      } else if (r < p.aggr + 0.22) {
        this.start('jump', 40);
      } else {
        this.low = R() < 0.3; this.start('defend', 16 + (R() * 12 | 0));
      }
    } else if (dist < reachH + 25) {
      if (R() < p.aggr * 0.7) this.start('attack', 40, [{ at: 0, a: 'heavy' }]);
      else this.start(R() < 0.5 ? 'approach' : 'idle', think * 0.6);
    } else if (dist < 330) {
      if (mv.special && !mv.special.counter && me.cdSpecial <= 0 && R() < p.special) {
        this.start('attack', 55, [{ at: 0, a: 'special' }]);
      } else if (proj && p.skill > 0.8 && dist < 240) {
        this.start('retreat', 18);
      } else if (R() < 0.12 * p.skill) {
        this.start('jump', 40);
      } else {
        this.start('approach', think);
      }
    } else {
      if (mv.special && !mv.special.counter && me.cdSpecial <= 0 && R() < p.special * (proj ? 1 : 0.5)) {
        this.start('attack', 55, [{ at: 0, a: 'special' }]);
      } else if (R() < 0.1) {
        this.start('idle', think);
      } else {
        this.start('approach', think + 10);
      }
    }
  }

  act(me, opp, out, toward, dist) {
    const side = (d) => { if (d > 0) out.right = true; else out.left = true; };
    switch (this.state) {
      case 'approach':
        side(toward);
        if (dist < 70) this.timer = 0;
        break;
      case 'retreat': {
        side(-toward);
        // can't retreat through a wall: turn it into something else
        if ((me.x < 140 && toward > 0) || (me.x > 1660 && toward < 0)) this.timer = 0;
        break;
      }
      case 'defend':
        out.block = true; out.down = this.low;
        break;
      case 'jump':
        if (this.stime === 1) {
          out.pUp = true; out.up = true;
          side(dist > 140 ? toward : (Math.random() < 0.5 ? toward : -toward));
        }
        if (me.state === 'jump' && this.stime > 14 && dist < 170 && !me.airAttackUsed && Math.random() < this.p.skill * 0.18) {
          out.pHeavy = true; out.heavy = true;
        }
        if (me.state !== 'jump' && this.stime > 6) this.timer = 0;
        break;
      case 'attack':
        if (this.seq) {
          while (this.seqIdx < this.seq.length && this.stime >= this.seq[this.seqIdx].at) {
            const s = this.seq[this.seqIdx];
            // chained follow-ups only continue if the previous attack connected
            if (this.seqIdx > 0 && me.state === 'attack' && !me.moveConnected && me.phase === 'recovery') { this.seq = null; this.timer = 6; break; }
            this.press(out, s);
            this.seqIdx++;
          }
          if (this.seq && this.seqIdx > 0 && this.seqIdx <= this.seq.length) {
            const s = this.seq[this.seqIdx - 1];
            if (s.down) out.down = true;
            if (s.block) out.block = true;
          }
        }
        break;
      default:
    }
  }

  press(out, s) {
    switch (s.a) {
      case 'light': out.pLight = out.light = true; break;
      case 'heavy': out.pHeavy = out.heavy = true; break;
      case 'special': out.pSpecial = out.special = true; break;
      case 'ult': out.pUlt = out.ult = true; break;
      default:
    }
    if (s.down) out.down = true;
    if (s.block) out.block = true;
  }
}
