# IRON FIST ARENA

A complete 2D fighting game for the browser, built around supplied character photos: eight fighters
(**Delegate, Vusal, Murad, Fatima, Zaur, Emin, Vakil**). Plain Canvas 2D + Web Audio, bundled with Vite. No backend, no
external services, no audio/art files to license: music, sound effects and arenas are generated in code.

## Quick start

Requirements: Node.js 18+ (developed on Node 24).

```bash
npm install
npm run dev
```

Open the address Vite prints (this project uses **http://localhost:5180**).

### Production build

```bash
npm run build      # outputs ./dist
npm run preview    # serve the build locally (optional check)
```

`dist/` is fully static (relative paths), so it can be dropped on any static host or opened from a
sub-folder. Note that browsers will not load ES modules from `file://`, so serve it over HTTP.

## Game modes

| Menu item | What it does |
|---|---|
| **Play** | Quick fight against the AI using your saved characters / arena / difficulty |
| **Team Battle** | 2 vs 2 on one stage, each fighter assigned to P1 keys / P2 keys / CPU |
| **Online** | Play a friend over the internet with a room code or invite link (peer-to-peer, free, no account) |
| **Local Multiplayer** | Two players, same keyboard (or gamepads) |
| **Fight Against AI** | Choose both fighters, arena and **Easy / Normal / Hard** |
| **Character Selection** | Browse the roster (stats, move names), pick defaults, preview arenas |
| **Training Mode** | No timer, infinite health / meter options, damage + combo readout, dummy behaviours (stand, crouch, block, jump, CPU), reset positions |
| **Settings** | Volumes, mute, announcer, difficulty, round time, match length, screen shake, reduced effects, damage numbers, combo counter, touch controls, fullscreen, key rebinding |
| **How to Play** | Live control tables (reflect your bindings) and mechanics |
| **Credits** | |

Matches are best-of-3 by default (best of 1 / 3 / 5 in Settings), with a configurable round timer
(30 / 60 / 90 / 99 s), draws, time-up by health, "PERFECT" detection, a final tie-break round,
rematch and return-to-menu.

## Controls

Rebindable in **Settings**. Defaults:

| Action | Player 1 | Player 2 |
|---|---|---|
| Move | `A` / `D` | `←` / `→` |
| Jump | `W` | `↑` |
| Crouch | `S` | `↓` |
| Light attack | `F` | `Numpad 1` |
| Heavy attack | `G` | `Numpad 2` |
| Special | `H` | `Numpad 3` |
| Block | `R` | `Numpad 0` |
| **Ultimate** (needs full SUPER meter) | `T` | `Numpad 4` |
| **Throw / shoot** your ranged item | `Y` | `Numpad 5` |

In single-player modes (Fight vs AI, Play, Training) the **arrow keys and numpad also control Player 1**, so `A`/`D` *or* `←`/`→` both work.

Global: `Esc` pause / back, `Enter` confirm, `Backspace` reset positions (Training), arrow keys +
Enter navigate the menus.

No numpad? Settings → **P2 LAPTOP LAYOUT** switches Player 2 to `, . /` (attacks), `Right Shift` (block) and `'` (ultimate).

Moves and tech:

* **Combos**: Light → Light → Heavy → Special. Moves that hit *or are blocked* can be cancelled into a stronger move. Damage scales down per hit and long combos force a knockdown, so there are no infinite loops.
* **Crouch + Light** low attack (must be blocked crouching) · **Crouch + Heavy** launching uppercut · **Jump + attack** air attacks (overheads: block standing).
* **Throw**: Block + Light up close (beats blocking, whiffs are punishable).
* **Run**: double-tap forward. **Back-dash**: double-tap back (brief invulnerability).
* **Special**: unique per character, limited by a cooldown shown under the health bar.
* **Ultimate**: SUPER meter fills from damage dealt / taken / blocked; resets each round. Triggers a short cinematic.

Gamepad (Gamepad API, pad 1 = P1, pad 2 = P2): stick / D-pad move, `A` jump, `X` light, `Y` heavy,
`B` special, bumpers or left trigger block, right trigger ultimate, `Start` pause.

Touch: on touch devices a virtual pad appears during fights (Settings → Touch controls: Auto / On / Off). It controls Player 1.
Two-player keyboard mode shows a warning on touch devices.

## The characters

| Fighter | Style | Special | Ultimate |
|---|---|---|---|
| **Delegate** | Fast zoner | **Contract Blast** – thrown paper-contract projectile | **Final Audit** – long multi-hit beam of documents |
| **Vusal** | Long-range speaker | **Sound Wave** – big, slow sonic arcs | **Bass Drop** – huge sonic burst around him, also hits jumpers |
| **Murad** | Fast rushdown | **Power Tie Dash** – quick forward dash strike | **Overtime** – close-range 7-hit flurry |
| **Fatima** | Agile, projectile pressure | **Flash Selfie** – very fast camera-flash shot | **Viral Storm** – falling hearts rain over a wide area, 4 hits |
| **Emin** | Small body, giant head, fast pest | **Glasses Laser** – very fast thin laser | **Supernova** – blue-white burst around him, also hits jumpers |
| **Vakil** | The strongest: top damage, takes 20% less damage, fills SUPER 30% faster | **Pizza Toss** – spinning pizza projectile, short cooldown | **Pizza Storm** – 6-hit pizza rain over a wide area |
| **Zaur** | Slow, tanky counter-fighter | **Executive Stance** – if hit during the stance, the hit is cancelled and he strikes back | **Executive Order** – giant slow sphere that launches |

Everything about a character (frame data, damage, hitboxes, knockback, cooldowns, speed, jump height,
colours) lives in `src/entities/characters.js`. Retuning a move is a one-line change.

### How the artwork is animated (and the limitation)

The images you supplied are single static poses, not sprite sheets. Instead of replacing them with generic fighters:

1. Each image was background-removed once (offline, `scripts/remove-background.mjs`) into `public/assets/characters/*.png`.
2. At runtime the torso is posed with lean / squash / bob transforms; **legs and attacking limbs are procedural** (2-bone IK) and drawn in matching colours: sleeves, cuffs and hands in matching colours (e.g. jacket sleeve + white cuff + watch + hand for Delegate). Hits flash white/red; knockdowns rotate the whole body.
3. Facing left is a mirrored draw call (no stretching). Photos whose body is turned to the left are mirrored once at load (`sprite.flip: true`) so torso and legs always point the same way.
4. Murad's photo is a head-and-shoulders portrait, so a shirt-and-tie torso is drawn under it (`sprite.extend`).

The attacking arms are overlays on top of the photo, and the photo already contains the arms hanging at the sides, so during punches you may see the original arm plus the extended one. That is a limit of working from still photos.

Limitation: because the source art has no extra frames, faces/torsos do not change expression or pose; the procedural
limbs approximate that. Replacing the PNG with real sprite sheets would require extending `FighterRenderer.js`.
Both images were cut off at the waist/thigh, so the lower body is drawn procedurally.

If both players pick the same character, the second one is automatically recoloured.

## Features implemented

* Fixed 60 Hz simulation with accumulator (frame-rate independent), single `requestAnimationFrame` loop, hit-stop, slow-motion K.O., screen shake, hit sparks, dust, rings, afterimages, damage numbers
* Real hitboxes / hurtboxes, one hit per attack (no per-frame damage), swept projectile boxes, push-box separation so fighters never get stuck inside each other, corner pushback, arena + max-distance clamping
* Light / heavy / special / ultimate / jump attacks / crouch attacks / throw, block with chip damage and block-stun, low & overhead rules, input buffering, cancels, counter-hit bonus, invulnerability frames (wake-up, back-dash, ultimate startup)
* State-based AI (idle / approach / retreat / attack / defend / jump / special / punish / recover) with human-like **reaction delay** (it only sees delayed *visible* state, never your inputs), per-difficulty aggression, defence, combo use, hesitation
* HUD: animated health bars with damage trail, names, portraits (cut from the artwork), timer, round + round-win pips, combo counter, SUPER meter, special cooldown, pause indicator, announcements (ROUND n, FIGHT!, K.O., PLAYER n WINS, DRAW, TIME UP, PERFECT)
* 3 procedurally drawn arenas with parallax and animation: **Neon City** (rain, flickering signs), **The Pit** (swaying lamps, animated crowd, steam), **Orbital Dojo** (planet, rotating rings, light pulses)
* Web Audio: synthesized music (menu + 3 fight tracks), hits / blocks / specials / ultimate / KO / win / lose sound effects, optional announcer voice (browser speech synthesis), independent music + SFX volume, mute, audio starts only after a user gesture, music stops when leaving a match and ducks on pause
* Settings persisted in `localStorage` (with graceful fallback if storage is unavailable)
* Auto-pause when the tab loses focus / is hidden; clean teardown of loops and listeners (also on Vite hot reload)
* Missing character images fall back to a placeholder instead of crashing

## Testing status (honest notes)

What was actually run during development, in a real browser:

* The game boots, all menu screens render and navigate, matches start from every mode
* Scripted simulation of: hits and damage values, combos, blocking (incl. low vs standing block), throws, both ultimates, projectile, P2 keyboard input, pause / resume / Esc handling, training mode, round → KO → match-end → stats screen flow (AI-vs-AI over thousands of ticks), AI difficulty behaviour, audio engine calls (no errors), touch layout at 812×375
* Production build with `vite build`

Not verified: real gamepad hardware, real touch devices, and how the audio *sounds* (only that it runs without errors), plus long sessions on low-end machines. Frame rate was not benchmarked; the render path avoids per-frame allocations in the hot loops, but treat 60 FPS as a design target rather than a measurement.

## Replacing or adding characters

1. Get a **transparent PNG** of your character (a standing pose facing right, feet or waist cut anywhere). If your image has a plain background you can cut it out with
   `scripts/remove-background.mjs` (uses `@imgly/background-removal-node`; install it in a scratch folder, it is not a game dependency):
   ```bash
   npm i @imgly/background-removal-node   # in a temporary folder
   node remove-background.mjs input.png output.png
   ```
   (The game also flood-fills plain, flat backgrounds automatically if the PNG has no transparency.)
2. Put it in `public/assets/characters/`.
3. Add an entry to `CHARACTERS` in `src/entities/characters.js` (copy `delegate` as a template) and set:
   * `sprite.flip` (true if the body in the photo faces left), `sprite.extend` (optional, for portrait-only photos),
   * `sprite.src`, `sprite.scale` (so the torso is ~170–200 px tall),
   * `sprite.pivotX/pivotY` – the hip anchor in **source-image pixels** (bottom centre of the visible torso),
   * `sprite.shoulderX/shoulderH` – where punches originate, in screen pixels relative to the hip,
   * `sprite.face` – crop rectangle for the HUD portrait,
   * `body` (leg length, colours, hurtbox sizes, `arm` look) and `moves`.
4. Done: the select screen, HUD and match code pick it up automatically. To replace an existing character, just overwrite its PNG and adjust the pivot/scale.

Tip: while running `npm run dev`, open the console and call `sheet('yourId','moves')` or `sheet('yourId','states')` to see every pose and hit/hurt box on one contact sheet (`unsheet()` removes it).

## Project structure

```
index.html
package.json / vite.config.js
public/assets/characters/   one transparent cut-out PNG per fighter
source-images/              the two original uploads
scripts/remove-background.mjs
src/
  main.js                   entry (+ hot-reload cleanup)
  debug.js                  dev-only console helpers (not in production builds)
  game/                     Game (loop), Match (rules, rounds, hits), Arenas, Backdrop, Sprites, settings, config
  entities/                 Fighter (state machine), Projectile, FighterRenderer (procedural animation), characters (data)
  systems/                  Input (keyboard / gamepad / touch), AI, Effects (pooled particles)
  audio/                    AudioEngine (SFX + procedural music)
  ui/                       Hud, Screens (menus), Touch
  styles/main.css
```

Gameplay logic (`Fighter`, `Match`, `AI`) is separate from drawing (`FighterRenderer`, `Arenas`, `Effects`), input, audio and UI.

## Online play (room code)

Main menu → **ONLINE**. One player picks a fighter and presses **CREATE ROOM**; the screen shows a 5-letter code and an
invite link (`?room=CODE`). The friend opens the game, picks a fighter, and enters the code (or just opens the link) and presses **JOIN ROOM**.
The room creator's arena and match settings (round time, best-of) are used. After a match both players must press **REMATCH**.

How it works:

* **Peer-to-peer (WebRTC via PeerJS).** The free public PeerJS cloud server is used only to match the room code; the game data goes straight between the two browsers, so there is no server of your own to run or pay for.
* **Deterministic lockstep.** Both browsers simulate every 60 Hz tick from the same two inputs, so only inputs are sent (a few bytes per tick). A 4-tick (~67 ms) input delay hides latency; if the opponent's input is late the game briefly waits and shows "WAITING FOR OPPONENT". A state checksum is compared every second to detect desyncs.
* The online match cannot be paused (Esc opens a menu while the fight continues). If one player leaves, the other sees a "Disconnected" screen.

Limitations: connections between two very strict networks (symmetric NAT, some corporate or mobile networks) can fail because no TURN relay is included; try another network or a hotspot. Online play was verified with a simulated high-latency link (identical results on both sides over thousands of ticks) and with a real PeerJS handshake inside one browser; it has not yet been tried between two physical machines.

## Weapons

Pick a weapon before each fight from the picture cards (every select screen, each Team Battle slot and the Online screen; the room lobby shows everybody's weapon). A weapon modifies the character's
**punch-type normal attacks** (jab, heavy, crouch / jump punches); kicks, specials and ultimates are unchanged. Data lives in `src/entities/weapons.js`.

| Weapon | Effect |
|---|---|
| Fists | Balanced, no change |
| Katana | +30% reach, +8% damage, slightly slower |
| Bat | +18% reach, +18% damage, more knock-back, a little slow |
| Hammer | +40% damage, big knock-back, very slow to swing |
| Nunchaku | Faster strikes, -5% damage |
| Spear | +55% reach, a bit slower to recover |
| Knuckles | Faster and +14% damage, shorter reach |
| Axe | +30% damage, slow swing |
| Frying pan | Solid damage, strong knock-back |
| Guitar | +20% reach, +12% damage |
| Trident | +45% reach |
| Whip | +70% reach, -15% damage |
| Boxing gloves | +20% damage, big knock-back, short reach |

"Random" picks a weapon for every match (offline modes).

## Team battles (2 vs 2)

Four fighters on one stage: slots 1-2 are **Team Blue**, slots 3-4 **Team Red**. A team wins the round when both opponents are
knocked out (the timer compares the teams' total health). Teammates can walk through each other, there is no friendly fire,
and every fighter has their own SUPER meter. Offline (Main menu → TEAM BATTLE) each slot is set to **P1 KEYS**, **P2 KEYS** (a second
player on the same keyboard) or **CPU**.

Online team play: in the Online screen choose **2 vs 2 TEAMS** and your team before creating / joining. The room creator presses **START MATCH** in the lobby once the
friends are in (at least 2 people); empty places are filled by CPU fighters whose inputs are computed on the creator's machine and sent to everybody.
The network model is a star: friends connect to the creator, who relays inputs (4-player rooms use a slightly larger 6-tick input delay).
If anybody leaves during a match it ends for everyone.

## Playing across different networks (TURN relay)

Two players on different home / mobile networks often cannot connect directly (strict NAT). WebRTC then needs a **TURN relay**, otherwise the join ends in a timeout.
The game ships with free public STUN servers only. To add a relay (free, takes ~5 minutes):

1. Create a free account at <https://www.metered.ca> (TURN server) and copy the ICE server list from the dashboard (a JSON array of `{ urls, username, credential }`).
2. **Vercel:** Project → Settings → Environment Variables → add `VITE_ICE_SERVERS` with that JSON on **one line**, then redeploy.
   **Local:** create a `.env.local` file with `VITE_ICE_SERVERS=[{"urls":"turn:...","username":"...","credential":"..."}]`.
   (Alternatively use `VITE_TURN_URLS` (comma separated), `VITE_TURN_USER`, `VITE_TURN_PASS`.)
3. In the game, Online → **CHECK NETWORK** tells you whether the relay answered.

Only encrypted game inputs pass through the relay (a few KB/s per player). Note that Vite variables are embedded in the public page, so use a relay account you do not mind sharing.

## Shields and ranged items

Besides a weapon every fighter can carry a **shield** and a **ranged item** (picture cards in all select screens, Team Battle slots and the Online screen).

**Shields** (hold Block to raise them): *Buckler* - raise it right as a hit lands to **parry** (the attacker is stunned, no damage); *Round shield* - much less chip damage and faster recovery from blocks;
*Tower shield* - blocks high and low attacks and takes no chip damage, but you walk slower; *Spiked shield* - blocked melee hits hurt the attacker. (Data: `src/entities/shields.js`.)

**Ranged items** (press **Throw / Shoot**, each has a cooldown shown by the RANGED bar; hold Down for a low shot): *Bow* (fast arrows), *Throwing knives* (quick), *Throwing axe* (arcing, hits hard),
*Shuriken* (three stars in a fan), *Bomb* (arcs and explodes, area damage). Projectiles can be blocked, they cancel each other out, and shields work against them. (Data: `src/entities/ranged.js`.)

CPU fighters use their ranged item from a distance. Online, shield and ranged choices are part of each player's setup and every machine simulates them identically (the extra input is just one more bit per tick).
