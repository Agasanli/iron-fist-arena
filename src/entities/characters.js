// Character definitions. Everything about a fighter's look, feel and moves is data here.
// Frame values are in 1/60 s ticks. Hitbox: x = forward offset from body centre,
// y = height of the TOP of the box above the feet, w/h = size. Negative x reaches behind.
//
// To add a character: add a new entry, drop a transparent PNG into public/assets/characters/
// (see README), and the select screen / HUD pick it up automatically.
//
// sprite.flip: set true when the photo's body is turned to the LEFT (the game draws every
// character facing right, so such images are mirrored at load time; pivotX stays in
// un-mirrored image pixels).

/** Move factory: sensible defaults so each move only lists what is special about it. */
const mv = (o) => ({
  level: 'mid', limb: 'arm', knock: 3, hitstop: 5, shake: 0, hitstun: 14, blockstun: 8, sfx: 'light', ...o,
});

export const CHARACTERS = {
  delegate: {
    id: 'delegate',
    name: 'DELEGATE',
    title: 'The Executive',
    blurb: 'Sharp-suited zoner. Fast pokes, long range, deadly contracts.',
    color: '#4ac8ff',
    color2: '#2f6bff',
    sprite: {
      src: 'assets/characters/delegate.png',
      scale: 0.27,
      pivotX: 296, pivotY: 640,
      shoulderX: 27, shoulderH: 112,
      face: { x: 215, y: 5, w: 170, h: 200 },
    },
    body: {
      legLen: 84, thigh: 15, shin: 13,
      legColor: '#17171d', legDark: '#0c0c10', shorts: '#17171d', shoe: '#0a0a0c',
      shortsLen: 1,
      arm: { skin: '#d9a98d', dark: '#120d0b', hi: '#43332b', width: 27, hand: 13, sleeve: '#33251f', cuff: '#f4f4f4' },
      hurtW: 70, hurtH: 244, crouchH: 152,
    },
    stats: { walk: 3.9, back: 3.3, run: 7.0, jump: 17.2, gravity: 0.84, throwRange: 80 },
    rating: { power: 3, speed: 5, range: 4, defense: 3 },
    moves: {
      light: mv({ name: 'Quick Jab', startup: 4, active: 3, recovery: 8, damage: 35, hitstun: 13, blockstun: 7, knock: 2.8, hitstop: 4, hitbox: { x: 30, y: 178, w: 92, h: 32 }, meter: 1 }),
      heavy: mv({ name: 'Oxford Kick', startup: 10, active: 4, recovery: 18, damage: 88, hitstun: 20, blockstun: 12, knock: 8.5, hitstop: 8, shake: 3, hitbox: { x: 26, y: 150, w: 130, h: 48 }, limb: 'leg', sfx: 'kick' }),
      crouchLight: mv({ name: 'Shin Tap', startup: 4, active: 3, recovery: 9, damage: 32, hitstun: 12, blockstun: 7, knock: 2.5, hitstop: 4, hitbox: { x: 24, y: 44, w: 108, h: 30 }, level: 'low', limb: 'leg', sfx: 'kick', crouch: true }),
      crouchHeavy: mv({ name: 'Briefcase Rise', startup: 8, active: 5, recovery: 23, damage: 72, hitstun: 20, blockstun: 11, launch: 11.5, hitstop: 8, shake: 4, hitbox: { x: 8, y: 238, w: 76, h: 175 }, sfx: 'heavy', crouch: true, upward: true }),
      jumpLight: mv({ name: 'Air Jab', startup: 3, active: 9, recovery: 0, damage: 40, hitstun: 15, hitstop: 4, hitbox: { x: 10, y: 125, w: 86, h: 52 }, level: 'high', air: true }),
      jumpHeavy: mv({ name: 'Dive Kick', startup: 6, active: 11, recovery: 0, damage: 75, hitstun: 18, blockstun: 10, knock: 5, hitstop: 7, shake: 3, hitbox: { x: 8, y: 100, w: 100, h: 82 }, level: 'high', limb: 'leg', sfx: 'kick', air: true }),
      special: mv({
        name: 'Contract Blast', startup: 16, active: 2, recovery: 20, damage: 0, hitstun: 0, blockstun: 0, knock: 0, hitstop: 0, hitbox: null, sfx: 'orb', cooldown: 75,
        projectile: { x: 70, y: 150, vx: 11.5, w: 64, h: 46, damage: 90, hitstun: 22, blockstun: 13, knock: 7, hitstop: 8, shake: 3, life: 110, style: 'contract', level: 'mid' },
      }),
      ultimate: mv({ name: 'FINAL AUDIT', startup: 22, active: 31, recovery: 32, damage: 40, hitstun: 14, knock: 0.4, hitstop: 5, shake: 6, hitbox: { x: 20, y: 200, w: 720, h: 150 }, sfx: 'ult', cinematic: true, scaleExempt: true, beam: true, multi: { interval: 6, hits: 5, finalLaunch: 11, finalBonus: 70 } }),
    },
  },

  vusal: {
    id: 'vusal',
    name: 'VUSAL',
    title: 'The Speaker',
    blurb: 'Stage presence as a weapon. Big sonic waves control the whole screen.',
    color: '#ffb347',
    color2: '#e0562a',
    sprite: {
      src: 'assets/characters/vusal.png',
      flip: true,
      scale: 0.36,
      pivotX: 150, pivotY: 458,
      shoulderX: 35, shoulderH: 107,
      face: { x: 50, y: 0, w: 140, h: 150 },
    },
    body: {
      legLen: 86, thigh: 15, shin: 13,
      legColor: '#1b2132', legDark: '#0d111c', shorts: '#1b2132', shoe: '#14141a',
      shortsLen: 1,
      arm: { skin: '#c79a7e', dark: '#2a2d30', hi: '#8a8f92', width: 28, hand: 13, sleeve: '#5a5f62', sleeveDark: '#3b3f42', sleeveHi: '#7d8386', cuff: '#f1f1f1' },
      hurtW: 70, hurtH: 242, crouchH: 152,
    },
    stats: { walk: 3.3, back: 2.8, run: 6.0, jump: 16.5, gravity: 0.82, throwRange: 82 },
    rating: { power: 4, speed: 3, range: 5, defense: 3 },
    moves: {
      light: mv({ name: 'Mic Jab', startup: 5, active: 3, recovery: 9, damage: 40, hitstun: 14, knock: 3, hitbox: { x: 28, y: 178, w: 86, h: 36 }, meter: 1 }),
      heavy: mv({ name: 'Podium Smash', startup: 11, active: 4, recovery: 19, damage: 95, hitstun: 21, blockstun: 12, knock: 8, hitstop: 8, shake: 4, hitbox: { x: 24, y: 182, w: 108, h: 54 }, sfx: 'heavy' }),
      crouchLight: mv({ name: 'Stage Kick', startup: 5, active: 3, recovery: 10, damage: 36, hitstun: 12, knock: 2.8, hitbox: { x: 24, y: 48, w: 100, h: 34 }, level: 'low', limb: 'leg', sfx: 'kick', crouch: true }),
      crouchHeavy: mv({ name: 'Rising Pitch', startup: 8, active: 5, recovery: 24, damage: 80, hitstun: 20, blockstun: 12, launch: 12, hitstop: 8, shake: 4, hitbox: { x: 8, y: 236, w: 76, h: 172 }, sfx: 'heavy', crouch: true, upward: true }),
      jumpLight: mv({ name: 'Air Point', startup: 4, active: 9, recovery: 0, damage: 44, hitstun: 15, hitbox: { x: 10, y: 122, w: 84, h: 56 }, level: 'high', air: true }),
      jumpHeavy: mv({ name: 'Flying Knee', startup: 7, active: 10, recovery: 0, damage: 80, hitstun: 19, blockstun: 10, knock: 5, hitstop: 7, shake: 3, hitbox: { x: 8, y: 102, w: 96, h: 80 }, level: 'high', limb: 'leg', sfx: 'kick', air: true }),
      special: mv({
        name: 'Sound Wave', startup: 18, active: 2, recovery: 24, damage: 0, hitstun: 0, blockstun: 0, knock: 0, hitstop: 0, hitbox: null, sfx: 'orb', cooldown: 110,
        projectile: { x: 60, y: 160, vx: 8.5, w: 90, h: 120, damage: 100, hitstun: 22, blockstun: 13, knock: 8, hitstop: 9, shake: 4, life: 130, style: 'wave', level: 'mid' },
      }),
      ultimate: mv({ name: 'BASS DROP', startup: 24, active: 6, recovery: 44, damage: 285, hitstun: 30, blockstun: 20, knock: 11, launch: 14, hitstop: 16, shake: 16, hitbox: { x: -280, y: 320, w: 560, h: 320 }, sfx: 'ult', cinematic: true, scaleExempt: true, fx: 'burst' }),
    },
  },

  murad: {
    id: 'murad',
    name: 'MURAD',
    title: 'The Closer',
    blurb: 'Fastest hands in the office. Rushes down and never stops swinging.',
    color: '#9be15d',
    color2: '#2aa84a',
    sprite: {
      src: 'assets/characters/murad.png',
      scale: 0.30,
      pivotX: 200, pivotY: 395,
      shoulderX: 36, shoulderH: 84,
      face: { x: 105, y: 0, w: 190, h: 240 },
      // the photo is a head-and-shoulders portrait: draw a shirt-and-tie torso underneath it
      extend: { h: 52, w: 116, w2: 92, color: '#f1f1f5', shade: '#c9c9d4', tie: '#17171f', belt: '#1a1a22' },
    },
    body: {
      legLen: 84, thigh: 15, shin: 13,
      legColor: '#15151b', legDark: '#0a0a0e', shorts: '#15151b', shoe: '#0b0b0e',
      shortsLen: 1,
      arm: { skin: '#d9ab90', dark: '#bdbdc8', hi: '#ffffff', width: 27, hand: 13, sleeve: '#f1f1f5', sleeveDark: '#c3c3ce', sleeveHi: '#ffffff', cuff: '#f1f1f5' },
      hurtW: 66, hurtH: 238, crouchH: 150,
    },
    stats: { walk: 4.2, back: 3.5, run: 7.4, jump: 17.5, gravity: 0.85, throwRange: 78 },
    rating: { power: 3, speed: 5, range: 2, defense: 2 },
    moves: {
      light: mv({ name: 'Rapid Jab', startup: 3, active: 3, recovery: 7, damage: 32, hitstun: 12, blockstun: 6, knock: 2.5, hitstop: 4, hitbox: { x: 26, y: 176, w: 78, h: 34 }, meter: 1 }),
      heavy: mv({ name: 'Spin Kick', startup: 9, active: 4, recovery: 17, damage: 82, hitstun: 19, blockstun: 11, knock: 8, hitstop: 8, shake: 3, hitbox: { x: 24, y: 152, w: 112, h: 50 }, limb: 'leg', sfx: 'kick' }),
      crouchLight: mv({ name: 'Sweep Tap', startup: 4, active: 3, recovery: 8, damage: 30, hitstun: 12, blockstun: 7, knock: 2.5, hitstop: 4, hitbox: { x: 22, y: 44, w: 96, h: 30 }, level: 'low', limb: 'leg', sfx: 'kick', crouch: true }),
      crouchHeavy: mv({ name: 'Dragon Rise', startup: 7, active: 5, recovery: 22, damage: 70, hitstun: 20, blockstun: 11, launch: 11.5, hitstop: 8, shake: 4, hitbox: { x: 8, y: 236, w: 72, h: 172 }, sfx: 'heavy', crouch: true, upward: true }),
      jumpLight: mv({ name: 'Air Jab', startup: 3, active: 9, recovery: 0, damage: 38, hitstun: 15, hitstop: 4, hitbox: { x: 10, y: 124, w: 80, h: 52 }, level: 'high', air: true }),
      jumpHeavy: mv({ name: 'Drop Kick', startup: 6, active: 11, recovery: 0, damage: 76, hitstun: 18, blockstun: 10, knock: 5, hitstop: 7, shake: 3, hitbox: { x: 8, y: 100, w: 98, h: 82 }, level: 'high', limb: 'leg', sfx: 'kick', air: true }),
      special: mv({ name: 'Power Tie Dash', startup: 10, active: 14, recovery: 22, damage: 95, hitstun: 22, blockstun: 12, knock: 8, launch: 0, hitstop: 8, shake: 4, hitbox: { x: 10, y: 190, w: 100, h: 100 }, sfx: 'rush', moveVx: 12.5, cooldown: 100, aura: true }),
      ultimate: mv({ name: 'OVERTIME', startup: 18, active: 29, recovery: 30, damage: 30, hitstun: 12, blockstun: 8, knock: 0.3, hitstop: 4, shake: 5, hitbox: { x: 10, y: 215, w: 175, h: 150 }, sfx: 'ult', cinematic: true, scaleExempt: true, fx: 'flurry', multi: { interval: 4, hits: 7, finalLaunch: 11, finalBonus: 55 } }),
    },
  },

  fatima: {
    id: 'fatima',
    name: 'FATIMA',
    title: 'The Trendsetter',
    blurb: 'Always one step ahead. Flashes from range and goes viral up close.',
    color: '#ff6fb5',
    color2: '#b03aff',
    sprite: {
      src: 'assets/characters/fatima.png',
      flip: true,
      scale: 0.31,
      pivotX: 158, pivotY: 548,
      shoulderX: 38, shoulderH: 100,
      face: { x: 0, y: 0, w: 190, h: 190 },
      altFilter: 'sepia(1) saturate(3) hue-rotate(250deg)',
    },
    body: {
      legLen: 86, thigh: 14, shin: 11,
      legColor: '#aeb4bc', legDark: '#4a4f57', shorts: '#aeb4bc', shoe: '#1d1d22',
      shortsLen: 1,
      arm: { skin: '#cfcfcf', dark: '#3d3d3d', hi: '#f4f4f4', width: 21, hand: 11, sleeve: null },
      hurtW: 62, hurtH: 240, crouchH: 150,
    },
    stats: { walk: 4.0, back: 3.4, run: 7.2, jump: 18.0, gravity: 0.84, throwRange: 76 },
    rating: { power: 2, speed: 5, range: 4, defense: 2 },
    moves: {
      light: mv({ name: 'Slap', startup: 4, active: 3, recovery: 8, damage: 34, hitstun: 13, blockstun: 7, knock: 2.6, hitstop: 4, hitbox: { x: 24, y: 176, w: 82, h: 34 }, meter: 1 }),
      heavy: mv({ name: 'Heel Kick', startup: 10, active: 4, recovery: 18, damage: 84, hitstun: 20, blockstun: 12, knock: 8, hitstop: 8, shake: 3, hitbox: { x: 24, y: 160, w: 124, h: 48 }, limb: 'leg', sfx: 'kick' }),
      crouchLight: mv({ name: 'Ankle Tap', startup: 4, active: 3, recovery: 9, damage: 30, hitstun: 12, blockstun: 7, knock: 2.5, hitstop: 4, hitbox: { x: 22, y: 44, w: 100, h: 30 }, level: 'low', limb: 'leg', sfx: 'kick', crouch: true }),
      crouchHeavy: mv({ name: 'Cartwheel Kick', startup: 8, active: 5, recovery: 23, damage: 68, hitstun: 20, blockstun: 11, launch: 11.5, hitstop: 8, shake: 4, hitbox: { x: 8, y: 236, w: 74, h: 172 }, limb: 'leg', sfx: 'kick', crouch: true, upward: true }),
      jumpLight: mv({ name: 'Air Slap', startup: 3, active: 9, recovery: 0, damage: 38, hitstun: 15, hitstop: 4, hitbox: { x: 10, y: 124, w: 80, h: 52 }, level: 'high', air: true }),
      jumpHeavy: mv({ name: 'Flying Heel', startup: 6, active: 11, recovery: 0, damage: 72, hitstun: 18, blockstun: 10, knock: 5, hitstop: 7, shake: 3, hitbox: { x: 8, y: 100, w: 100, h: 82 }, level: 'high', limb: 'leg', sfx: 'kick', air: true }),
      special: mv({
        name: 'Flash Selfie', startup: 12, active: 2, recovery: 16, damage: 0, hitstun: 0, blockstun: 0, knock: 0, hitstop: 0, hitbox: null, sfx: 'orb', cooldown: 50,
        projectile: { x: 56, y: 170, vx: 17, w: 54, h: 54, damage: 68, hitstun: 18, blockstun: 10, knock: 6, hitstop: 7, shake: 2, life: 80, style: 'flash', level: 'mid' },
      }),
      ultimate: mv({ name: 'VIRAL STORM', startup: 22, active: 28, recovery: 32, damage: 42, hitstun: 14, blockstun: 9, knock: 0.4, hitstop: 5, shake: 6, hitbox: { x: 20, y: 340, w: 520, h: 340 }, sfx: 'ult', cinematic: true, scaleExempt: true, fx: 'storm', multi: { interval: 7, hits: 4, finalLaunch: 11, finalBonus: 60 } }),
    },
  },

  zaur: {
    id: 'zaur',
    name: 'ZAUR',
    title: 'The Boss',
    blurb: 'Immovable. Crosses his arms, waits for you to swing, then ends it.',
    color: '#c9a2ff',
    color2: '#3b3fd6',
    sprite: {
      src: 'assets/characters/zaur.png',
      scale: 0.27,
      pivotX: 232, pivotY: 626,
      shoulderX: 34, shoulderH: 101,
      face: { x: 85, y: 0, w: 190, h: 210 },
    },
    body: {
      legLen: 86, thigh: 16, shin: 14,
      legColor: '#141c33', legDark: '#0a0f1e', shorts: '#141c33', shoe: '#0b0b0e',
      shortsLen: 1,
      arm: { skin: '#d2a184', dark: '#0c1224', hi: '#3a4a7a', width: 30, hand: 14, sleeve: '#1b2542', sleeveDark: '#0c1224', sleeveHi: '#3a4a7a', cuff: '#f4f4f4' },
      hurtW: 76, hurtH: 246, crouchH: 154,
    },
    stats: { walk: 2.9, back: 2.4, run: 5.4, jump: 15.8, gravity: 0.82, throwRange: 90 },
    rating: { power: 5, speed: 1, range: 2, defense: 5 },
    moves: {
      light: mv({ name: 'Heavy Jab', startup: 6, active: 3, recovery: 10, damage: 48, hitstun: 15, blockstun: 9, knock: 3.4, hitstop: 5, hitbox: { x: 30, y: 180, w: 80, h: 40 }, meter: 1 }),
      heavy: mv({ name: 'Boardroom Hook', startup: 13, active: 4, recovery: 22, damage: 112, hitstun: 23, blockstun: 14, knock: 8, hitstop: 10, shake: 5, hitbox: { x: 26, y: 184, w: 104, h: 58 }, sfx: 'heavy', moveVx: 2.2 }),
      crouchLight: mv({ name: 'Low Boot', startup: 6, active: 3, recovery: 11, damage: 42, hitstun: 13, knock: 3, hitbox: { x: 24, y: 54, w: 96, h: 38 }, level: 'low', limb: 'leg', sfx: 'kick', crouch: true }),
      crouchHeavy: mv({ name: 'Hostile Uppercut', startup: 8, active: 5, recovery: 26, damage: 95, hitstun: 21, blockstun: 12, launch: 12.5, hitstop: 9, shake: 5, hitbox: { x: 10, y: 240, w: 78, h: 175 }, sfx: 'heavy', crouch: true, upward: true }),
      jumpLight: mv({ name: 'Jump Cross', startup: 4, active: 9, recovery: 0, damage: 52, hitstun: 16, blockstun: 9, hitbox: { x: 10, y: 122, w: 78, h: 60 }, level: 'high', air: true }),
      jumpHeavy: mv({ name: 'Jump Stomp', startup: 7, active: 10, recovery: 0, damage: 88, hitstun: 20, blockstun: 11, knock: 5, hitstop: 8, shake: 3, hitbox: { x: 8, y: 106, w: 94, h: 80 }, level: 'high', limb: 'leg', sfx: 'kick', air: true }),
      // Counter stance: if he is hit during the stance window, the attack is cancelled and he strikes back.
      special: mv({ name: 'Executive Stance', startup: 22, active: 6, recovery: 24, damage: 135, hitstun: 24, blockstun: 14, knock: 9, launch: 10, hitstop: 12, shake: 8, hitbox: { x: 8, y: 205, w: 140, h: 150 }, sfx: 'heavy', cooldown: 120, counter: { from: 3, to: 22 } }),
      ultimate: mv({
        name: 'EXECUTIVE ORDER', startup: 24, active: 2, recovery: 38, damage: 0, hitstun: 0, blockstun: 0, knock: 0, hitstop: 0, hitbox: null, sfx: 'ult', cinematic: true, scaleExempt: true,
        projectile: { x: 100, y: 150, vx: 7.5, w: 150, h: 150, damage: 300, hitstun: 30, blockstun: 20, knock: 12, launch: 13, hitstop: 16, shake: 14, life: 150, style: 'sphere', level: 'mid', scaleExempt: true },
      }),
    },
  },
};

// -- appended roster ------------------------------------------------------------
Object.assign(CHARACTERS, {
  emin: {
    id: 'emin',
    name: 'EMIN',
    title: 'The Big Head',
    blurb: 'Tiny body, giant head, zero shame. Slippery pest with a laser stare.',
    color: '#5ec8ff',
    color2: '#3b6cff',
    sprite: {
      src: 'assets/characters/emin.png',
      scale: 0.095,
      pivotX: 520, pivotY: 1013,
      shoulderX: 36, shoulderH: 66,
      face: { x: 100, y: 90, w: 860, h: 880 },
      // head-only photo: a small shirt torso is drawn under the (oversized) head
      extend: { h: 84, w: 100, w2: 84, color: '#1d2c5e', shade: '#121c40', tie: '#1d2c5e', belt: '#14141a' },
    },
    body: {
      legLen: 80, thigh: 14, shin: 12,
      legColor: '#262c44', legDark: '#12162a', shorts: '#262c44', shoe: '#e6e6ea',
      shortsLen: 1,
      arm: { skin: '#d8b6a6', dark: '#101a3a', hi: '#3a4f9a', width: 24, hand: 12, sleeve: '#1d2c5e', sleeveDark: '#101a3a', sleeveHi: '#3a4f9a', cuff: '#1d2c5e' },
      hurtW: 64, hurtH: 244, crouchH: 150,
    },
    stats: { walk: 4.1, back: 3.5, run: 7.3, jump: 17.6, gravity: 0.85, throwRange: 74 },
    rating: { power: 3, speed: 5, range: 3, defense: 2 },
    moves: {
      light: mv({ name: 'Glasses Poke', startup: 4, active: 3, recovery: 8, damage: 34, hitstun: 13, blockstun: 7, knock: 2.6, hitstop: 4, hitbox: { x: 26, y: 190, w: 84, h: 36 }, meter: 1 }),
      heavy: mv({ name: 'Head Butt', startup: 10, active: 4, recovery: 18, damage: 90, hitstun: 20, blockstun: 12, knock: 8, hitstop: 8, shake: 4, hitbox: { x: 24, y: 214, w: 100, h: 70 }, sfx: 'heavy', moveVx: 3 }),
      crouchLight: mv({ name: 'Shin Nibble', startup: 4, active: 3, recovery: 9, damage: 30, hitstun: 12, blockstun: 7, knock: 2.5, hitstop: 4, hitbox: { x: 22, y: 44, w: 96, h: 30 }, level: 'low', limb: 'leg', sfx: 'kick', crouch: true }),
      crouchHeavy: mv({ name: 'Rising Chomp', startup: 8, active: 5, recovery: 23, damage: 72, hitstun: 20, blockstun: 11, launch: 11.5, hitstop: 8, shake: 4, hitbox: { x: 8, y: 238, w: 76, h: 172 }, sfx: 'heavy', crouch: true, upward: true }),
      jumpLight: mv({ name: 'Air Poke', startup: 3, active: 9, recovery: 0, damage: 38, hitstun: 15, hitstop: 4, hitbox: { x: 10, y: 124, w: 80, h: 52 }, level: 'high', air: true }),
      jumpHeavy: mv({ name: 'Dive Bomb', startup: 6, active: 11, recovery: 0, damage: 76, hitstun: 18, blockstun: 10, knock: 5, hitstop: 7, shake: 3, hitbox: { x: 8, y: 100, w: 98, h: 82 }, level: 'high', limb: 'leg', sfx: 'kick', air: true }),
      special: mv({
        name: 'Glasses Laser', startup: 14, active: 2, recovery: 18, damage: 0, hitstun: 0, blockstun: 0, knock: 0, hitstop: 0, hitbox: null, sfx: 'orb', cooldown: 65,
        projectile: { x: 70, y: 200, vx: 22, w: 130, h: 22, damage: 78, hitstun: 18, blockstun: 10, knock: 6, hitstop: 7, shake: 3, life: 60, style: 'laser', level: 'mid' },
      }),
      ultimate: mv({ name: 'SUPERNOVA', startup: 24, active: 6, recovery: 44, damage: 275, hitstun: 30, blockstun: 20, knock: 11, launch: 14, hitstop: 16, shake: 16, hitbox: { x: -280, y: 320, w: 560, h: 320 }, sfx: 'ult', cinematic: true, scaleExempt: true, fx: 'burst', fxColor: '#8fd8ff', fxRGB: [143, 216, 255] }),
    },
  },

  vakil: {
    id: 'vakil',
    name: 'VAKIL',
    title: 'The Chief',
    blurb: 'The strongest fighter on the roster. Hits hardest, takes less damage, builds meter fast.',
    color: '#ff4a3a',
    color2: '#ffd54a',
    sprite: {
      src: 'assets/characters/vakil.png',
      scale: 0.30,
      pivotX: 316, pivotY: 593,
      shoulderX: 36, shoulderH: 113,
      face: { x: 195, y: 0, w: 170, h: 200 },
    },
    body: {
      legLen: 86, thigh: 16, shin: 14,
      legColor: '#1b1b22', legDark: '#0c0c10', shorts: '#1b1b22', shoe: '#e4e4e8',
      shortsLen: 1,
      arm: { skin: '#c79b80', dark: '#5a0f0b', hi: '#ff7a6a', width: 29, hand: 14, sleeve: '#c9281d', sleeveDark: '#7a1410', sleeveHi: '#ff6a5a', cuff: '#f4f4f4' },
      hurtW: 74, hurtH: 244, crouchH: 152,
    },
    // defMul < 1: takes less damage; meterMul > 1: fills the SUPER meter faster
    stats: { walk: 3.8, back: 3.2, run: 6.8, jump: 17, gravity: 0.83, throwRange: 90, defMul: 0.8, meterMul: 1.3 },
    rating: { power: 5, speed: 4, range: 4, defense: 5 },
    moves: {
      light: mv({ name: 'Chiefs Jab', startup: 3, active: 3, recovery: 7, damage: 52, hitstun: 14, blockstun: 7, knock: 3.4, hitstop: 5, hitbox: { x: 28, y: 178, w: 94, h: 38 }, meter: 1 }),
      heavy: mv({ name: 'Menu Smash', startup: 9, active: 4, recovery: 16, damage: 122, hitstun: 22, blockstun: 13, knock: 9, hitstop: 10, shake: 5, hitbox: { x: 24, y: 184, w: 120, h: 58 }, sfx: 'heavy', moveVx: 2.6 }),
      crouchLight: mv({ name: 'Low Tackle', startup: 5, active: 3, recovery: 9, damage: 46, hitstun: 13, knock: 3, hitbox: { x: 24, y: 52, w: 100, h: 38 }, level: 'low', limb: 'leg', sfx: 'kick', crouch: true }),
      crouchHeavy: mv({ name: 'Touchdown Rise', startup: 7, active: 5, recovery: 22, damage: 105, hitstun: 21, blockstun: 12, launch: 13, hitstop: 9, shake: 5, hitbox: { x: 10, y: 240, w: 80, h: 176 }, sfx: 'heavy', crouch: true, upward: true }),
      jumpLight: mv({ name: 'Air Jab', startup: 3, active: 9, recovery: 0, damage: 58, hitstun: 16, blockstun: 9, hitbox: { x: 10, y: 122, w: 82, h: 60 }, level: 'high', air: true }),
      jumpHeavy: mv({ name: 'Flying Cleat', startup: 6, active: 10, recovery: 0, damage: 96, hitstun: 20, blockstun: 11, knock: 5, hitstop: 8, shake: 3, hitbox: { x: 8, y: 106, w: 100, h: 82 }, level: 'high', limb: 'leg', sfx: 'kick', air: true }),
      special: mv({
        name: 'Pizza Toss', startup: 12, active: 2, recovery: 18, damage: 0, hitstun: 0, blockstun: 0, knock: 0, hitstop: 0, hitbox: null, sfx: 'orb', cooldown: 55,
        projectile: { x: 70, y: 160, vx: 13, w: 84, h: 84, damage: 120, hitstun: 24, blockstun: 14, knock: 8, hitstop: 9, shake: 4, life: 100, style: 'pizza', level: 'mid' },
      }),
      ultimate: mv({ name: 'PIZZA STORM', startup: 20, active: 36, recovery: 28, damage: 50, hitstun: 14, blockstun: 9, knock: 0.4, hitstop: 5, shake: 7, hitbox: { x: 10, y: 360, w: 640, h: 360 }, sfx: 'ult', cinematic: true, scaleExempt: true, fx: 'storm', fxItem: 'pizza', multi: { interval: 6, hits: 6, finalLaunch: 12, finalBonus: 100 } }),
    },
  },
});

export const CHARACTER_IDS = Object.keys(CHARACTERS);
