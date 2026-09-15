import {
  GRAVITY, MOVE_ACCEL, MOVE_SPEED, AIR_ACCEL_SCALE, GROUND_FRICTION, AIR_FRICTION,
  JUMP_SPEED, MAX_FALL_SPEED, COYOTE_TIME, JUMP_BUFFER, PLAYER_W, PLAYER_H,
  LIQUID_DRAG, LIQUID_SINK, SWIM_SPEED, FLY_ACCEL, FLY_SPEED, FLY_DAMP,
} from './config.js';
import { isLiquid, LAVA } from './blocks.js';

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
    this.inLiquid = false;
    this.flying = false;
    this.noclip = false;     // spectator: drift straight through the world

    this.maxHealth = 20;
    this.health = 20;
    this.invuln = 0;         // i-frames, so one mob can't chain-hit
    this.hurtFlash = 0;
    this.effects = {};       // name -> { value, time }
    this.fallFrom = null;    // y where the current fall started
    this.lavaBurn = 0;
    this.dead = false;
  }

  get centerY() { return this.y + this.h / 2; }

  get alive() { return !this.dead; }

  /** Multiplier or bonus from an active potion effect. */
  effect(name) {
    return this.effects[name]?.value ?? null;
  }

  applyEffect(name, value, duration) {
    this.effects[name] = { value, time: duration };
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  /** Returns true if the hit landed (i-frames can swallow it). */
  hurt(amount, fromX = null, ignoreInvuln = false) {
    if (this.dead || (!ignoreInvuln && this.invuln > 0)) return false;

    this.health -= amount;
    this.invuln = 0.55;
    this.hurtFlash = 0.3;

    if (fromX !== null && !this.flying) {
      const dir = Math.sign(this.x - fromX) || 1;
      this.vx = dir * 8;
      this.vy = Math.min(this.vy, -7);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    return true;
  }

  respawn(world, spawn) {
    this.enter(world, spawn);
    this.health = this.maxHealth;
    this.dead = false;
    this.invuln = 1.5;
    this.effects = {};
    this.fallFrom = null;
  }

  /** Timers, fall damage and lava: everything that hurts without a mob attached. */
  updateVitals(dt, invulnerable) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    for (const [name, e] of Object.entries(this.effects)) {
      e.time -= dt;
      if (e.time <= 0) delete this.effects[name];
    }

    const regen = this.effect('regen');
    if (regen) this.heal(regen * dt);

    if (invulnerable || this.flying) {
      this.fallFrom = null;
      return;
    }

    // Fall damage: measured from wherever the fall began, forgiving three blocks.
    if (this.onGround || this.inLiquid) {
      if (this.fallFrom !== null) {
        const drop = this.y - this.fallFrom;
        if (drop > 3 && !this.inLiquid) this.hurt(Math.floor(drop - 3), null, true);
        this.fallFrom = null;
      }
    } else if (this.vy > 0) {
      if (this.fallFrom === null) this.fallFrom = this.y;
    } else {
      this.fallFrom = null;
    }

    // Lava burns on a tick, unless fire resistance is up.
    const inLava = [...this.occupied()].includes(LAVA);
    if (inLava && !this.effect('fireResist')) {
      this.lavaBurn -= dt;
      if (this.lavaBurn <= 0) {
        this.lavaBurn = 0.5;
        this.hurt(4, null, true);
      }
    } else {
      this.lavaBurn = 0;
    }
  }

  /** Move to a new realm's world without losing momentum bookkeeping. */
  enter(world, spawn) {
    this.world = world;
    this.x = spawn.x;
    this.y = spawn.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
  }

  get left()   { return this.x - this.w / 2; }
  get right()  { return this.x + this.w / 2; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.h; }

  update(dt, intent) {
    this.inLiquid = this.submerged();

    if (this.flying) {
      this.fly(dt, intent);
      return;
    }

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
    const boost = this.effect('speed') ?? 1;
    const topSpeed = (this.inLiquid ? SWIM_SPEED : MOVE_SPEED) * boost;
    this.vx = Math.max(-topSpeed, Math.min(topSpeed, this.vx));

    // --- jump, with coyote time + input buffering so it feels forgiving ---
    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    this.jumpBuffer = intent.jumpPressed ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);

    if (this.inLiquid) {
      // Swimming: holding jump paddles upward, otherwise sink slowly.
      if (intent.jumpHeld) this.vy -= JUMP_SPEED * 2.2 * dt;
      this.vy += GRAVITY * LIQUID_SINK * dt;
      this.vy *= Math.pow(LIQUID_DRAG, dt * 8);
      this.vx *= Math.pow(LIQUID_DRAG, dt * 4);
      this.jumpBuffer = 0;
    } else {
      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vy = -JUMP_SPEED;
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.onGround = false;
      }

      // Releasing jump early cuts the arc short (variable-height jump).
      if (!intent.jumpHeld && this.vy < 0) this.vy *= 0.86;

      this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    }

    this.moveAndCollide(this.vx * dt, this.vy * dt);
  }

  /**
   * Creative flight: gravity off, both axes under direct control, still solid
   * against the world so you can land on things and dig your way through.
   */
  fly(dt, intent) {
    const vert = (intent.down ? 1 : 0) - (intent.jumpHeld ? 1 : 0);
    if (intent.move !== 0) this.facing = intent.move;

    this.vx += intent.move * FLY_ACCEL * dt;
    this.vy += vert * FLY_ACCEL * dt;

    // Damp whichever axis has no input, so the player stops where they let go.
    const damp = Math.pow(FLY_DAMP, dt);
    if (intent.move === 0) this.vx *= damp;
    if (vert === 0) this.vy *= damp;

    this.vx = Math.max(-FLY_SPEED, Math.min(FLY_SPEED, this.vx));
    this.vy = Math.max(-FLY_SPEED, Math.min(FLY_SPEED, this.vy));

    this.moveAndCollide(this.vx * dt, this.vy * dt);
    this.coyote = 0;
    this.jumpBuffer = 0;
  }

  /** Axis-separated sweep so corners resolve predictably. */
  moveAndCollide(dx, dy) {
    if (this.noclip) {
      this.x += dx;
      this.y += dy;
      this.onGround = false;
      return;
    }

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

  /** True while any part of the hitbox is inside water or lava. */
  submerged() {
    const x0 = Math.floor(this.left);
    const x1 = Math.floor(this.right - 1e-9);
    const y0 = Math.floor(this.top);
    const y1 = Math.floor(this.bottom - 1e-9);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (isLiquid(this.world.get(x, y))) return true;
      }
    }
    return false;
  }

  /** Every distinct block id the hitbox currently overlaps. */
  occupied() {
    const ids = new Set();
    const x0 = Math.floor(this.left);
    const x1 = Math.floor(this.right - 1e-9);
    const y0 = Math.floor(this.top);
    const y1 = Math.floor(this.bottom - 1e-9);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) ids.add(this.world.get(x, y));
    }
    return ids;
  }

  /** True if the player's hitbox overlaps block cell (bx, by). */
  overlapsCell(bx, by) {
    return this.right > bx && this.left < bx + 1 && this.bottom > by && this.top < by + 1;
  }
}
