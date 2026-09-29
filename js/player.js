import {
  GRAVITY, MOVE_ACCEL, MOVE_SPEED, AIR_ACCEL_SCALE, GROUND_FRICTION, AIR_FRICTION,
  JUMP_SPEED, MAX_FALL_SPEED, COYOTE_TIME, JUMP_BUFFER, PLAYER_W, PLAYER_H,
  LIQUID_DRAG, LIQUID_SINK, SWIM_SPEED, FLY_ACCEL, FLY_SPEED, FLY_DAMP,
  WATER_JUMP_TIME, MAX_AIR, AIR_REFILL, DROWN_DAMAGE, DROWN_INTERVAL, CLIMB_SPEED,
} from './config.js';
import { block, isLiquid, LAVA, WATER, FIRE } from './blocks.js';

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
    this.climbing = false;   // on a ladder
    this.flying = false;
    this.noclip = false;     // spectator: drift straight through the world

    this.maxHealth = 20;
    this.health = 20;
    this.invuln = 0;         // i-frames, so one mob can't chain-hit
    this.hurtFlash = 0;
    this.effects = {};       // name -> { value, time }
    this.fallFrom = null;    // y where the current fall started
    this.lavaBurn = 0;
    this.waterJump = 0;      // > 0 while rising out of water on a jump
    this.air = MAX_AIR;      // seconds of breath left
    this.drownTimer = 0;
    this.deathCause = null;  // set when something other than a hit kills
    this.effectTick = 0;     // poison and wither bite on a timer
    this.onFire = 0;         // seconds left alight
    this.burnTick = 0;
    this.onLethal = null;    // () => true if something (a totem) cheats this death
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
      if (this.onLethal?.()) {
        this.health = 1;
      } else {
        this.health = 0;
        this.dead = true;
      }
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
    this.air = MAX_AIR;
    this.deathCause = null;
    this.onFire = 0;
  }

  /** Set alight for at least `secs`. */
  ignite(secs) {
    this.onFire = Math.max(this.onFire, secs);
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

    // Poison wears you down but never finishes you; wither can.
    const poison = this.effect('poison');
    const wither = this.effect('wither');
    if ((poison || wither) && !invulnerable) {
      this.effectTick -= dt;
      if (this.effectTick <= 0) {
        this.effectTick = wither ? 2 : 1.25;
        if (wither) {
          if (this.hurt(wither, null, true) && this.dead) this.deathCause = 'Withered away';
        } else if (this.health > 1) {
          this.hurt(Math.min(poison, this.health - 1), null, true);
        }
      }
    }

    if (invulnerable || this.flying) {
      this.fallFrom = null;
      this.air = MAX_AIR;
      this.onFire = 0;
      return;
    }

    // Fall damage: measured from wherever the fall began, forgiving three
    // blocks. Catching a ladder breaks the fall, as in Minecraft.
    if (this.climbing) {
      this.fallFrom = null;
    } else if (this.onGround || this.inLiquid) {
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

    // Lava and fire burn on a tick and leave you alight for a while after.
    // Water puts you out; fire resistance shrugs all of it off.
    const occupied = this.occupied();
    const inLava = occupied.has(LAVA);
    const inFire = occupied.has(FIRE);
    const fireproof = !!this.effect('fireResist');
    if (inLava || inFire) this.ignite(inLava ? 8 : 5);
    else if (this.inLiquid) this.onFire = 0;

    if ((inLava || inFire) && !fireproof) {
      this.lavaBurn -= dt;
      if (this.lavaBurn <= 0) {
        this.lavaBurn = 0.5;
        if (this.hurt(inLava ? 4 : 1, null, true) && this.dead) {
          this.deathCause = inLava ? 'Tried to swim in lava' : 'Burned to death';
        }
      }
    } else {
      this.lavaBurn = 0;
    }

    if (this.onFire > 0) {
      this.onFire = Math.max(0, this.onFire - dt);
      this.burnTick -= dt;
      if (this.burnTick <= 0 && !inLava && !inFire && !fireproof) {
        this.burnTick = 1;
        if (this.hurt(1, null, true) && this.dead) this.deathCause = 'Burned to death';
      }
    }

    // Breath runs down with the head under water; once it's gone, drowning bites.
    if (this.headIn(WATER)) {
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) {
        this.drownTimer -= dt;
        if (this.drownTimer <= 0) {
          this.drownTimer = DROWN_INTERVAL;
          if (this.hurt(DROWN_DAMAGE, null, true) && this.dead) this.deathCause = 'Drowned';
        }
      }
    } else {
      this.air = Math.min(MAX_AIR, this.air + AIR_REFILL * dt);
      this.drownTimer = 0;
    }
  }

  /** Whether the player's head is in `id` (or in any liquid, if `id` is omitted). */
  headIn(id = null) {
    const here = this.world.get(Math.floor(this.x), Math.floor(this.y + 0.25));
    return id === null ? isLiquid(here) : here === id;
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
    this.climbing = !this.flying && this.onLadder();

    if (this.flying) {
      this.fly(dt, intent);
      return;
    }
    if (this.climbing) {
      this.climb(dt, intent);
      return;
    }

    this.walk(dt, intent);

    // --- jump, with coyote time + input buffering so it feels forgiving ---
    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    this.jumpBuffer = intent.jumpPressed ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);
    this.waterJump = Math.max(0, this.waterJump - dt);

    // In water a jump still works with something to push off: the bottom
    // underfoot, or the surface once your head is out -- that's how you climb
    // out onto a ledge. For a moment after, drag doesn't smother the jump.
    if (this.inLiquid && this.jumpBuffer > 0 && (this.onGround || !this.headIn())) {
      this.vy = -JUMP_SPEED;
      this.jumpBuffer = 0;
      this.onGround = false;
      this.waterJump = WATER_JUMP_TIME;
    }

    if (this.inLiquid && this.waterJump <= 0) {
      // Swimming: holding jump paddles upward, otherwise sink slowly.
      if (intent.jumpHeld) this.vy -= JUMP_SPEED * 2.2 * dt;
      this.vy += GRAVITY * LIQUID_SINK * dt;
      this.vy *= Math.pow(LIQUID_DRAG, dt * 8);
      this.vx *= Math.pow(LIQUID_DRAG, dt * 4);
    } else {
      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vy = -JUMP_SPEED;
        this.jumpBuffer = 0;
        this.coyote = 0;
        this.onGround = false;
      }

      // Releasing jump early cuts the arc short (variable-height jump).
      if (!intent.jumpHeld && this.vy < 0 && !this.effect('levitation')) this.vy *= 0.86;

      if (this.effect('levitation')) {
        // A shulker bullet floats you upward until it wears off -- then you fall.
        this.vy += (-3 - this.vy) * Math.min(1, dt * 4);
      } else {
        this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
      }
    }

    this.moveAndCollide(this.vx * dt, this.vy * dt);
  }

  /**
   * Run (or swim) sideways, slowing to a stop when there's no input. With
   * `grip` -- footing, or a ladder -- that stop is quick; in the air it isn't.
   */
  walk(dt, intent, grip = this.onGround) {
    const accel = MOVE_ACCEL * (grip ? 1 : AIR_ACCEL_SCALE);
    if (intent.move !== 0) {
      this.vx += intent.move * accel * dt;
      this.facing = intent.move;
    } else {
      const friction = grip ? GROUND_FRICTION : AIR_FRICTION;
      const drop = friction * dt * Math.abs(this.vx);
      this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx), drop + friction * dt * 0.5);
    }
    const boost = (this.effect('speed') ?? 1) * (this.effect('slowness') ?? 1);
    const topSpeed = (this.inLiquid ? SWIM_SPEED : MOVE_SPEED) * boost;
    this.vx = Math.max(-topSpeed, Math.min(topSpeed, this.vx));
  }

  /**
   * On a ladder, up climbs and down descends, and with neither you hold on.
   * That goes for a ladder in water too: climbing wins over swimming. The
   * ladder counts as footing -- you don't slide off it sideways, and a jump
   * pressed just as you clear the top still fires.
   */
  climb(dt, intent) {
    this.walk(dt, intent, true);
    this.vy = ((intent.down ? 1 : 0) - (intent.jumpHeld ? 1 : 0)) * CLIMB_SPEED;
    this.coyote = COYOTE_TIME;
    this.jumpBuffer = 0;
    this.waterJump = 0;
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
        if (this.world.blocksMovementAt(x, y)) return true;
      }
    }
    return false;
  }

  /** True while any part of the hitbox is on something climbable. */
  onLadder() {
    for (const id of this.occupied()) if (block(id).climbable) return true;
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
