import { MAX_HP } from '../game/config.js';
import { getPortrait } from '../game/Sprites.js';
import { CHARACTERS } from '../entities/characters.js';
import { settings } from '../game/settings.js';

const $ = (el, sel) => el.querySelector(sel);

function fighterBlock(side) {
  return `
  <div class="fh ${side}">
    <div class="portrait"><img alt=""></div>
    <div class="bars">
      <div class="name-row"><span class="pname"></span><span class="tag"></span><span class="pips"></span></div>
      <div class="hp"><div class="trail"></div><div class="fill"></div><div class="shine"></div></div>
      <div class="meter-row">
        <div class="meter"><div class="mfill"></div><span class="mlabel">SUPER</span></div>
        <div class="spec"><div class="sfill"></div><span class="slabel">SPECIAL</span></div>
      </div>
    </div>
  </div>`;
}

/** DOM heads-up display layered on top of the canvas. */
export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-top">
        ${fighterBlock('p1')}
        <div class="hud-center"><div class="timer">60</div><div class="roundlabel">ROUND 1</div></div>
        ${fighterBlock('p2')}
      </div>
      <div class="combo c0"></div><div class="combo c1"></div>
      <div class="announce"></div>
      <div class="pause-ind">PAUSED</div>
      <div class="train-panel">
        <div class="tp-title">TRAINING</div>
        <label>Dummy
          <select data-k="dummy">
            <option value="stand">Stand</option><option value="crouch">Crouch</option>
            <option value="block">Block (stand)</option><option value="cblock">Block (crouch)</option>
            <option value="jump">Jump</option><option value="cpu">CPU fights back</option>
          </select>
        </label>
        <label class="chk"><input type="checkbox" data-k="infiniteHp"> Infinite health</label>
        <label class="chk"><input type="checkbox" data-k="infiniteMeter"> Infinite meter</label>
        <div class="tp-stats">
          <div>Last hit <b data-s="last">0</b></div>
          <div>Combo <b data-s="combo">0</b> hits · <b data-s="cdmg">0</b> dmg</div>
          <div>Best combo <b data-s="max">0</b></div>
          <div>Total dmg <b data-s="total">0</b></div>
        </div>
        <button class="tp-reset" type="button">Reset positions (Backspace)</button>
      </div>`;
    this.el = {
      timer: $(root, '.timer'), round: $(root, '.roundlabel'), announce: $(root, '.announce'),
      combo: [$(root, '.c0'), $(root, '.c1')], pause: $(root, '.pause-ind'), train: $(root, '.train-panel'),
    };
    this.side = ['p1', 'p2'].map((s) => {
      const b = $(root, '.fh.' + s);
      return {
        b, img: $(b, 'img'), name: $(b, '.pname'), tag: $(b, '.tag'), pips: $(b, '.pips'), fill: $(b, '.fill'), trail: $(b, '.trail'),
        mfill: $(b, '.mfill'), meter: $(b, '.meter'), sfill: $(b, '.sfill'), spec: $(b, '.spec'), trailV: MAX_HP, last: {},
      };
    });
    this.match = null;
    this.trainBound = false;
    $(root, '.tp-reset').addEventListener('click', () => this.match && this.match.resetPositions());
    this.hide();
  }

  show(v) { this.root.classList.toggle('hidden', !v); if (!v) this.match = null; }
  hide() { this.root.classList.add('hidden'); }

  setup(match) {
    this.match = match;
    const names = [match.f[0].cfg.name, match.f[1].cfg.name];
    const tags = ['P1', match.mode === 'ai' ? 'CPU' : (match.training ? 'DUMMY' : 'P2')];
    this.side.forEach((s, i) => {
      s.img.src = getPortrait(match.f[i].cfg.id);
      s.name.textContent = names[i];
      s.tag.textContent = tags[i];
      s.trailV = MAX_HP;
      s.b.style.setProperty('--c1', match.f[i].cfg.color);
      s.b.style.setProperty('--c2', match.f[i].cfg.color2);
      s.last = {};
    });
    this.el.train.classList.toggle('on', match.training);
    this.el.pause.classList.remove('on');
    if (match.training) {
      const tr = match.tr;
      this.el.train.querySelectorAll('[data-k]').forEach((inp) => {
        const k = inp.dataset.k;
        if (inp.type === 'checkbox') { inp.checked = !!tr[k]; inp.onchange = () => { tr[k] = inp.checked; inp.blur(); }; }
        else { inp.value = tr[k]; inp.onchange = () => { tr[k] = inp.value; inp.blur(); }; }
      });
    }
    this.clearCombo(0); this.clearCombo(1);
    this.el.announce.className = 'announce';
    this.el.announce.textContent = '';
  }

  announce(text, cls = '') {
    const a = this.el.announce;
    a.textContent = text;
    a.className = 'announce';
    void a.offsetWidth;                // restart CSS animation
    a.className = 'announce show ' + cls;
  }

  setCombo(side, hits, dmg) {
    const el = this.el.combo[side];
    if (el.dataset.h !== String(hits)) {
      el.innerHTML = `<span class="n">${hits}</span><span class="t">HIT${hits > 1 ? 'S' : ''}</span><span class="d">${dmg} dmg</span>`;
      el.dataset.h = String(hits);
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    } else {
      el.querySelector('.d').textContent = dmg + ' dmg';
    }
    el.classList.add('on');
  }
  clearCombo(side) { const el = this.el.combo[side]; el.classList.remove('on', 'pop'); el.dataset.h = ''; }

  setPaused(v) { this.el.pause.classList.toggle('on', v); }

  update(match, force) {
    if (!match) return;
    const el = this.el;
    // timer / round
    const t = match.training ? '∞' : String(Math.ceil(match.timeLeft));
    if (el.timer.textContent !== t) el.timer.textContent = t;
    el.timer.classList.toggle('low', !match.training && match.timeLeft <= 10 && match.phase === 'fight');
    const rl = match.training ? 'TRAINING' : `ROUND ${match.round}`;
    if (el.round.textContent !== rl) el.round.textContent = rl;
    el.combo[0].style.display = el.combo[1].style.display = settings.comboCounter ? '' : 'none';

    for (let i = 0; i < 2; i++) {
      const f = match.f[i], s = this.side[i];
      const hp = Math.max(0, f.hp);
      s.fill.style.transform = `scaleX(${hp / MAX_HP})`;
      // trailing damage bar
      if (s.trailV > hp) s.trailV = Math.max(hp, s.trailV - (force ? 999 : 2.4)); else s.trailV = hp;
      s.trail.style.transform = `scaleX(${s.trailV / MAX_HP})`;
      s.b.classList.toggle('low', hp < MAX_HP * 0.25);
      const m = Math.round(f.meter);
      s.mfill.style.transform = `scaleX(${m / 100})`;
      s.meter.classList.toggle('full', m >= 100);
      const cd = f.cfg.moves.special.cooldown || 1;
      const ready = f.cdSpecial <= 0;
      s.sfill.style.transform = `scaleX(${ready ? 1 : 1 - f.cdSpecial / cd})`;
      s.spec.classList.toggle('ready', ready);
      if (s.last.wins !== f.wins || s.last.need !== match.winsNeeded) {
        s.last.wins = f.wins; s.last.need = match.winsNeeded;
        let h = '';
        for (let k = 0; k < match.winsNeeded; k++) h += `<i class="${k < f.wins ? 'on' : ''}"></i>`;
        s.pips.innerHTML = match.training ? '' : h;
      }
    }
    if (match.training) {
      const tr = match.tr, q = (s) => el.train.querySelector(`[data-s="${s}"]`);
      q('last').textContent = tr.last; q('combo').textContent = tr.lastCombo; q('cdmg').textContent = tr.lastComboDmg;
      q('max').textContent = tr.maxCombo; q('total').textContent = tr.total;
    }
  }
}
