// Global constants and defaults. Gameplay is simulated on a fixed 60 Hz step.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const GROUND = 620;        // y coordinate of the floor (feet position)
export const WORLD_W = 1800;      // total arena width
export const BOUND_L = 70;
export const BOUND_R = WORLD_W - 70;
export const MAX_DIST = 1100;     // max distance between fighters (keeps both on screen)
export const TICK = 1 / 60;
export const MAX_HP = 1000;
export const PUSH_W = 62;         // body push box width

export const ACTIONS = ['left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'block', 'ult', 'throw'];
export const ACTION_LABELS = {
  left: 'Move Left', right: 'Move Right', up: 'Jump', down: 'Crouch',
  light: 'Light Attack', heavy: 'Heavy Attack', special: 'Special', block: 'Block', ult: 'Ultimate', throw: 'Throw / Shoot',
};

export const DEFAULT_BINDINGS = [
  {
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    light: 'KeyF', heavy: 'KeyG', special: 'KeyH', block: 'KeyR', ult: 'KeyT', throw: 'KeyY',
  },
  {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    light: 'Numpad1', heavy: 'Numpad2', special: 'Numpad3', block: 'Numpad0', ult: 'Numpad4', throw: 'Numpad5',
  },
];

// Alternative Player 2 layout for keyboards without a numpad.
export const LAPTOP_P2 = {
  left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
  light: 'Comma', heavy: 'Period', special: 'Slash', block: 'ShiftRight', ult: 'Quote', throw: 'Semicolon',
};

export const DEFAULT_SETTINGS = {
  musicVol: 0.55,
  sfxVol: 0.8,
  muted: false,
  announcer: true,
  screenShake: true,
  reducedFx: false,
  damageNumbers: true,
  comboCounter: true,
  difficulty: 'normal',
  roundTime: 60,
  roundsToWin: 2,
  touchControls: 'auto',   // auto | on | off
  p1Char: 'delegate',
  p2Char: 'zaur',
  p1Weapon: 'fists',
  p2Weapon: 'fists',
  p1Shield: 'none',
  p2Shield: 'none',
  p1Ranged: 'none',
  p2Ranged: 'none',
  team: null,
  onlineSize: 2,           // online room: 2 (1v1) or 4 (2v2)
  onlineTeam: 0,           // preferred team in 2v2 rooms
  arena: 'neon',
  bindings: null,
};

export const ARENAS = [
  { id: 'neon', name: 'Neon City', desc: 'Rain-soaked rooftops under a violet sky', track: 'fight1' },
  { id: 'underground', name: 'The Pit', desc: 'A caged underground fight club', track: 'fight2' },
  { id: 'future', name: 'Orbital Dojo', desc: 'A holographic combat deck above a planet', track: 'fight3' },
];

export const DIFFICULTIES = ['easy', 'normal', 'hard'];
