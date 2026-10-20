import { VIEW_W, VIEW_H, WORLD_W } from './config.js';
import { CHARACTERS } from '../entities/characters.js';
import { Fighter } from '../entities/Fighter.js';
import { createPose, computePose, drawFighter, drawShadow } from '../entities/FighterRenderer.js';
import { clearInput, createInputState } from '../systems/Input.js';
import { getArena } from './Arenas.js';
import { getSprite } from './Sprites.js';

const NOOP = { sfx() {}, dust() {}, ghost() {} };

/** Idle fighters in front of an arena, shown behind the menus. */
export class Backdrop {
  constructor() {
    this.time = 0;
    this.empty = clearInput(createInputState());
    this.poses = [createPose(), createPose()];
    this.f = null;
    this.set('papakha', 'delegate', 'neon');
  }

  set(p1, p2, arena) {
    if (this.key === p1 + p2 + arena) return;
    this.key = p1 + p2 + arena;
    this.f = [new Fighter(CHARACTERS[p1], 0), new Fighter(CHARACTERS[p2], 1)];
    this.f[0].reset(WORLD_W / 2 + 130, 1);
    this.f[1].reset(WORLD_W / 2 + 430, -1);
    this.mirror = p1 === p2;
    this.sprites = [getSprite(p1, false), getSprite(p2, this.mirror)];
    this.arena = getArena(arena);
  }

  update(dt) {
    this.time += dt;
    this.acc = (this.acc || 0) + dt;
    while (this.acc >= 1 / 60) {
      this.acc -= 1 / 60;
      this.f[0].update(this.empty, this.f[1], NOOP);
      this.f[1].update(this.empty, this.f[0], NOOP);
    }
  }

  render(ctx) {
    const z = 1.1, cx = WORLD_W / 2, camL = Math.max(0, cx - VIEW_W / 2);
    this.arena.drawBack(ctx, camL, z, this.time, -(z - 1) * 100);
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H); ctx.scale(z, z); ctx.translate(-cx, -VIEW_H);
    this.arena.drawFloor(ctx, this.time);
    for (let i = 0; i < 2; i++) {
      drawShadow(ctx, this.f[i]);
      const pose = computePose(this.f[i], this.poses[i]);
      drawFighter(ctx, this.f[i], this.sprites[i], pose, 1, null);
    }
    ctx.restore();
    this.arena.drawFront(ctx, camL, this.time, 0);
    const g = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    g.addColorStop(0, 'rgba(0,0,0,.72)'); g.addColorStop(0.55, 'rgba(0,0,0,.15)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
