/** On-screen controls for phones / tablets. They drive player 1's virtual input. */
const BUTTONS = [
  { a: 'left', t: '◀', cls: 'dpad l' }, { a: 'right', t: '▶', cls: 'dpad r' },
  { a: 'up', t: '▲', cls: 'dpad u' }, { a: 'down', t: '▼', cls: 'dpad d' },
  { a: 'light', t: 'L', cls: 'act a1' }, { a: 'heavy', t: 'H', cls: 'act a2' },
  { a: 'special', t: 'S', cls: 'act a3' }, { a: 'throw', t: 'R', cls: 'act a6' }, { a: 'block', t: 'B', cls: 'act a4' }, { a: 'ult', t: 'U', cls: 'act a5' },
];

export class TouchControls {
  constructor(root, input) {
    this.root = root; this.input = input;
    root.innerHTML = BUTTONS.map((b) => `<button type="button" class="tb ${b.cls}" data-a="${b.a}" aria-label="${b.a}">${b.t}</button>`).join('');
    root.querySelectorAll('.tb').forEach((el) => {
      const a = el.dataset.a;
      const down = (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } input.setVirtual(0, a, true); el.classList.add('on'); };
      const up = (e) => { e.preventDefault(); input.setVirtual(0, a, false); el.classList.remove('on'); };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  setVisible(v) {
    this.root.classList.toggle('on', v);
    if (!v) for (const b of BUTTONS) this.input.setVirtual(0, b.a, false);
  }
}
