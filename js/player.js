import {
  GRAVITY, MOVE_ACCEL, MOVE_SPEED, AIR_ACCEL_SCALE, GROUND_FRICTION, AIR_FRICTION,
  JUMP_SPEED, MAX_FALL_SPEED, COYOTE_TIME, JUMP_BUFFER, PLAYER_W, PLAYER_H,
} from './config.js';

export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.x = spawn.x;          // centre-x, in blocks
    this.y = spawn.y;          // top-y, in blocks
    this.vx = 0;
    this.vy = 0;
    this.w = PLAYER_W;
    this.h = PLAYER_H;
    this.onGround = false;
    this.facing = 1;
    this.coyote = 0;
    this.jumpBuffer = 0;
  }

  get left()   { return this.x - this.w / 2; }
  get right()  { return this.x + this.w / 2; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.h; }

  update(dt, intent) {
    // --- horizontal ---
    const accel = MOVE_ACCEL * (this.onGround ? 1 : AIR_ACCEL_SCALE);
    if (intent.move !== 0) {
      this.vx += intent.move * accel * dt;
      this.facing = intent.move;
    } else {
      const friction = this.onGround ? GROUND_FRICTION : AIR_FRICTION;
      const drop = friction * dt * Math.abs(this.vx);
      this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), drop + friction * dt * 0.5);
    }
    this.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, this.vx));

    // --- jump, with coyote time + input buffering so it feels forgiving ---
    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    this.jumpBuffer = intent.jumpPressed ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_SPEED;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
    }

    // Releasing jump early cuts the arc short (variable-height jump).
    if (!intent.jumpHeld && this.vy < 0) this.vy *= 0.86;

    // --- gravity ---
    this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);

    this.moveAndCollide(this.vx * dt, this.vy * dt);
  }

  /** Axis-separated sweep so corners resolve predictably. */
  moveAndCollide(dx, dy) {
    this.x += dx;
    if (this.collides()) {
      const dir = Math.sign(dx);
      if (dir > 0) this.x = Math.floor(this.right) - this.w / 2 - 1e-6;
      else if (dir < 0) this.x = Math.ceil(this.left) + this.w / 2 + 1e-6;
      this.vx = 0;
    }

    this.y += dy;
    this.onGround = false;
    if (this.collides()) {
      const dir = Math.sign(dy);
      if (dir > 0) {
        this.y = Math.floor(this.bottom) - this.h - 1e-6;
        this.onGround = true;
      } else if (dir < 0) {
        this.y = Math.ceil(this.top) + 1e-6;
      }
      this.vy = 0;
    }

    // A block placed on the ground we're standing on still counts as grounded.
    if (!this.onGround && this.vy >= 0) {
      this.y += 0.02;
      if (this.collides()) this.onGround = true;
      this.y -= 0.02;
    }
  }

  collides() {
    const x0 = Math.floor(this.left);
    const x1 = Math.floor(this.right - 1e-9);
    const y0 = Math.floor(this.top);
    const y1 = Math.floor(this.bottom - 1e-9);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (this.world.isSolidAt(x, y)) return true;
      }
    }
    return false;
  }

  /** True if the player's hitbox overlaps block cell (bx, by). */
  overlapsCell(bx, by) {
    return this.right > bx && this.left < bx + 1 && this.bottom > by && this.top < by + 1;
  }
}
