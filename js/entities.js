import { GRAVITY, MAX_FALL_SPEED, LUSH_CAVES_AT, DEEP_DARK_AT } from './config.js';
import { AIR, SPAWNER, isSolid, isLiquid } from './blocks.js';
import { MOBS, candidatesFor } from './mobs.js';
import { sweep, collides, lineOfSight } from './physics.js';

const SPAWN_MIN = 18;        // blocks from the player: just off screen
const SPAWN_MAX = 46;
const DESPAWN_AT = 110;
const MAX_MOBS = 34;
const SPAWN_INTERVAL = 1.4;  // seconds between spawn attempts
const SPAWNER_RANGE = 22;    // blocks: how close before a structure spawner runs
const SPAWNER_INTERVAL = 4;  // seconds between spawner activations
const SPAWNER_RETRY = 0.8;   // shorter wait when there was nowhere to put it
const SPAWN_OFFSETS = [1, -1, 2, -2, 3, -3, 0];

let nextId = 1;

// ------------------------------------------------------------------ mobs

export class Mob {
  constructor(def, world, x, y) {
    this.eid = nextId++;
    this.def = def;
    this.world = world;
    this.x = x;
    this.y = y;
    this.w = def.size[0];
    this.h = def.size[1];
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.blockedX = false;

    this.health = def.health;
    this.maxHealth = def.health;
    this.facing = Math.random() < 0.5 ? -1 : 1;

    this.state = 'wander';     // wander | chase | flee
    this.stateTimer = 0;
    this.wanderDir = 0;
    this.attackCooldown = 0;
    this.rangedCooldown = def.ranged ? Math.random() * def.ranged.cooldown : 0;
    this.hurtFlash = 0;
    this.bob = Math.random() * Math.PI * 2;
    this.dead = false;
  }

  get left()   { return this.x - this.w / 2; }
  get right()  { return this.x + this.w / 2; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.h; }
  get centerY() { return this.y + this.h / 2; }

  get inLiquid() {
    return isLiquid(this.world.get(Math.floor(this.x), Math.floor(this.centerY)));
  }

  /** Damage from any source; `fromX` pushes the mob away from the attacker. */
  hurt(amount, fromX = null) {
    if (this.dead) return;
    this.health -= amount;
    this.hurtFlash = 0.25;

    if (fromX !== null) {
      const dir = Math.sign(this.x - fromX) || 1;
      this.vx = dir * 7;
      if (this.onGround) this.vy = -7;
    }

    if (this.health <= 0) {
      this.dead = true;
      return;
    }

    // Passive mobs bolt; neutral ones turn on whoever hit them.
    if (this.def.behavior === 'passive') {
      this.state = 'flee';
      this.stateTimer = 4;
    } else {
      this.state = 'chase';
      this.stateTimer = 12;
    }
  }

  update(dt, ctx) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.rangedCooldown = Math.max(0, this.rangedCooldown - dt);
    this.stateTimer = Math.max(0, this.stateTimer - dt);
    this.bob += dt * 4;

    const player = ctx.player;
    const dx = player.x - this.x;
    const dy = player.centerY - this.centerY;
    const dist = Math.hypot(dx, dy);

    this.think(dt, ctx, dx, dy, dist);
    this.move(dt, ctx);
    this.touchPlayer(ctx, dist);
  }

  think(dt, ctx, dx, dy, dist) {
    const def = this.def;

    // Hostiles pick the player up on sight and keep chasing until they lose them.
    if (def.behavior === 'hostile' && ctx.playerVulnerable) {
      const sight = def.boss ? 60 : 22;
      if (dist < sight && lineOfSight(this.world, this.x, this.centerY, ctx.player.x, ctx.player.centerY, sight)) {
        this.state = 'chase';
        this.stateTimer = 6;
      } else if (this.stateTimer <= 0) {
        this.state = 'wander';
      }
    } else if (this.stateTimer <= 0 && this.state !== 'wander') {
      this.state = 'wander';
    }

    if (this.state === 'chase' && !ctx.playerVulnerable) this.state = 'wander';

    if (this.state === 'chase') {
      this.wanderDir = Math.sign(dx) || 1;

      // A ranged attacker holds its distance and shoots instead of closing in.
      if (def.ranged && dist < def.ranged.range) {
        if (dist < def.ranged.range * 0.45) this.wanderDir = -Math.sign(dx) || 1;
        else if (dist > def.ranged.range * 0.8) this.wanderDir = Math.sign(dx) || 1;
        else this.wanderDir = 0;

        if (this.rangedCooldown <= 0
            && lineOfSight(this.world, this.x, this.centerY, ctx.player.x, ctx.player.centerY, def.ranged.range)) {
          ctx.fire(this, ctx.player);
          this.rangedCooldown = def.ranged.cooldown;
        }
      }
    } else if (this.state === 'flee') {
      this.wanderDir = -(Math.sign(dx) || 1);
    } else if (this.stateTimer <= 0) {
      // Idle wander: pick a direction (or a pause) every few seconds.
      const r = Math.random();
      this.wanderDir = r < 0.34 ? -1 : r < 0.68 ? 1 : 0;
      this.stateTimer = 1.5 + Math.random() * 2.5;
    }

    if (this.wanderDir !== 0) this.facing = this.wanderDir;
  }

  move(dt, ctx) {
    const def = this.def;
    const speed = def.speed * (this.state === 'chase' ? 1.15 : this.state === 'flee' ? 1.3 : 0.55);

    if (def.flying) {
      // Flyers steer freely, drifting toward the player's height when chasing.
      const targetY = this.state === 'chase' ? ctx.player.centerY - 1.5 : this.centerY + Math.sin(this.bob) * 2;
      this.vx += (this.wanderDir * speed - this.vx) * Math.min(1, dt * 3);
      this.vy += ((targetY - this.centerY) * 1.6 - this.vy) * Math.min(1, dt * 3);
      const cap = speed * 1.2;
      this.vy = Math.max(-cap, Math.min(cap, this.vy));
      sweep(this, this.world, this.vx * dt, this.vy * dt);
      return;
    }

    if (def.aquatic) {
      // Swimmers only steer while wet; on land they just flop and fall.
      if (this.inLiquid) {
        this.vx += (this.wanderDir * speed - this.vx) * Math.min(1, dt * 3);
        const targetY = this.state === 'chase' ? ctx.player.centerY : this.centerY + Math.sin(this.bob) * 1.5;
        this.vy += ((targetY - this.centerY) * 1.2 - this.vy) * Math.min(1, dt * 3);
        this.vy = Math.max(-speed, Math.min(speed, this.vy));
      } else {
        this.vx *= Math.pow(0.02, dt);
        this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
      }
      sweep(this, this.world, this.vx * dt, this.vy * dt);
      return;
    }

    // Walkers: accelerate toward the wander direction, hop over what blocks them.
    const target = this.wanderDir * speed;
    this.vx += (target - this.vx) * Math.min(1, dt * 8);

    const floating = def.floatsOnLava && isLiquid(this.world.get(Math.floor(this.x), Math.floor(this.bottom)));
    if (floating) {
      this.vy += ((this.bottom - 0.6 < Math.floor(this.bottom) ? -2 : 2) - this.vy) * dt * 4;
    } else if (this.inLiquid) {
      this.vy = Math.min(3, this.vy + GRAVITY * 0.25 * dt);
      if (this.wanderDir !== 0) this.vy -= 5 * dt;      // paddle upward
    } else {
      this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    }

    if (this.blockedX && this.onGround && this.wanderDir !== 0 && def.jump > 0) {
      this.vy = -def.jump;
    }

    sweep(this, this.world, this.vx * dt, this.vy * dt);

    // Don't let idle wanderers walk off cliffs; chasers commit.
    if (this.onGround && this.state === 'wander' && this.wanderDir !== 0) {
      const ahead = Math.floor(this.x + this.wanderDir * (this.w / 2 + 0.3));
      const below = Math.floor(this.bottom + 1.5);
      if (!isSolid(this.world.get(ahead, below)) && !this.world.isLiquidAt(ahead, below)) {
        this.wanderDir = -this.wanderDir;
      }
    }
  }

  /** Melee: hostiles and provoked neutrals damage the player on contact. */
  touchPlayer(ctx, dist) {
    const def = this.def;
    if (!def.damage || this.attackCooldown > 0 || !ctx.playerVulnerable) return;
    if (def.behavior === 'passive') return;
    if (def.behavior === 'neutral' && this.state !== 'chase') return;
    if (def.ranged && dist > 2.5) return;

    const p = ctx.player;
    const overlaps = this.right > p.left && this.left < p.right
      && this.bottom > p.top && this.top < p.bottom;
    if (!overlaps) return;

    ctx.damagePlayer(def.damage, this.x);
    this.attackCooldown = def.explodes ? 99 : 0.9;
    if (def.explodes) this.dead = true;      // creeper goes off once
  }

  /** What this mob leaves behind. */
  rollDrops() {
    const out = [];
    for (const d of this.def.drops ?? []) {
      if (Math.random() > (d.chance ?? 1)) continue;
      const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      if (n > 0) out.push({ id: d.id, count: n });
    }
    return out;
  }
}

// ------------------------------------------------------------------ projectiles

export class Projectile {
  constructor(kind, world, x, y, vx, vy, opts = {}) {
    this.eid = nextId++;
    this.kind = kind;                  // arrow | fireball | potion
    this.world = world;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.w = kind === 'arrow' ? 0.5 : 0.6;
    this.h = kind === 'arrow' ? 0.15 : 0.6;
    this.damage = opts.damage ?? 4;
    this.fromPlayer = !!opts.fromPlayer;
    this.gravity = kind === 'fireball' ? 0 : (kind === 'potion' ? 22 : 16);
    this.life = 6;
    this.dead = false;
    this.angle = Math.atan2(vy, vx);
  }

  get centerY() { return this.y + this.h / 2; }

  update(dt, ctx) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle = Math.atan2(this.vy, this.vx);

    if (isSolid(this.world.get(Math.floor(this.x), Math.floor(this.centerY)))) {
      this.onImpact(ctx, null);
      return;
    }

    if (this.fromPlayer) {
      for (const m of ctx.mobs) {
        if (m.dead) continue;
        if (this.x > m.left && this.x < m.right && this.centerY > m.top && this.centerY < m.bottom) {
          this.onImpact(ctx, m);
          return;
        }
      }
    } else if (ctx.playerVulnerable) {
      const p = ctx.player;
      if (this.x > p.left && this.x < p.right && this.centerY > p.top && this.centerY < p.bottom) {
        this.onImpact(ctx, 'player');
        return;
      }
    }
  }

  onImpact(ctx, hit) {
    this.dead = true;

    if (this.kind === 'potion') {
      // Splash: everything within a couple of blocks takes the hit.
      for (const m of ctx.mobs) {
        if (!m.dead && Math.hypot(m.x - this.x, m.centerY - this.centerY) < 2.5) {
          m.hurt(this.damage, this.x);
        }
      }
      if (ctx.playerVulnerable && !this.fromPlayer
          && Math.hypot(ctx.player.x - this.x, ctx.player.centerY - this.centerY) < 2.5) {
        ctx.damagePlayer(this.damage, this.x);
      }
      return;
    }

    if (hit === 'player') ctx.damagePlayer(this.damage, this.x);
    else if (hit) ctx.killOrHurt(hit, this.damage, this.x);
  }
}

/**
 * Launch velocity that makes a projectile actually pass through (dx, dy),
 * given its speed and gravity. Without this a shot aimed at a mob's centre
 * arrives at its feet, because the drop is never compensated for.
 *
 * `dy` is in screen space (positive = downward), as everywhere else here.
 * Returns the flatter of the two arcs, or a straight-line aim when the target
 * is out of ballistic range.
 */
export function ballisticVelocity(dx, dy, speed, gravity) {
  const dist = Math.hypot(dx, dy) || 1;
  const direct = { vx: (dx / dist) * speed, vy: (dy / dist) * speed };
  if (gravity <= 0 || Math.abs(dx) < 1e-3) return direct;

  const up = -dy;                         // convert to y-up for the solve
  const v2 = speed * speed;
  const disc = v2 * v2 - gravity * (gravity * dx * dx + 2 * up * v2);
  if (disc < 0) return direct;            // can't reach it at this speed

  const angle = Math.atan2(v2 - Math.sqrt(disc), gravity * Math.abs(dx));
  return {
    vx: Math.cos(angle) * speed * Math.sign(dx),
    vy: -Math.sin(angle) * speed,
  };
}

// ------------------------------------------------------------------ manager

export class Entities {
  constructor() {
    this.mobs = [];
    this.projectiles = [];
    this.spawnTimer = 0;
    this.enabled = true;
  }

  clear() {
    this.mobs.length = 0;
    this.projectiles.length = 0;
  }

  /** Mobs belong to the realm they were spawned in; changing realm clears them. */
  onRealmChange() {
    this.clear();
  }

  spawn(world, defId, x, y) {
    const def = MOBS[defId];
    if (!def) return null;
    const m = new Mob(def, world, x, y);
    this.mobs.push(m);
    return m;
  }

  update(dt, ctx) {
    const { world, player } = ctx;

    for (const m of this.mobs) {
      if (!m.dead) m.update(dt, ctx);
    }
    for (const p of this.projectiles) {
      if (!p.dead) p.update(dt, ctx);
    }

    // Reap the dead, and anything that wandered far out of the world.
    this.mobs = this.mobs.filter((m) => {
      if (m.dead) return false;
      if (m.y > world.height + 4) return false;
      return Math.abs(m.x - player.x) < DESPAWN_AT;
    });
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    if (!this.enabled) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.trySpawn(ctx);
    }
    this.runSpawners(dt, ctx);
  }

  /**
   * Structure spawners tick only while the player is nearby, and keep a small
   * local cap so a dungeon doesn't empty the global mob budget on its own.
   */
  runSpawners(dt, ctx) {
    const { world, player } = ctx;
    if (this.mobs.length >= MAX_MOBS) return;

    for (const [key, data] of world.blockData) {
      if (data.kind !== 'spawner') continue;

      const [sx, sy] = key.split(',').map(Number);
      if (Math.abs(sx - player.x) > SPAWNER_RANGE
          || Math.abs(sy - player.y) > SPAWNER_RANGE) continue;
      if (world.get(sx, sy) !== SPAWNER) continue;        // mined out

      data.cooldown -= dt;
      if (data.cooldown > 0) continue;

      const nearby = this.mobs.filter((m) =>
        m.def.id === data.mob && Math.hypot(m.x - sx, m.y - sy) < 12).length;
      if (nearby >= 4) { data.cooldown = SPAWNER_INTERVAL; continue; }

      const def = MOBS[data.mob];
      if (!def) { data.cooldown = SPAWNER_INTERVAL; continue; }

      // Spawners sit in cramped rooms, so try either side at a few distances
      // rather than one fixed offset that usually lands inside a wall.
      let placed = false;
      for (const dx of SPAWN_OFFSETS) {
        const cx = this.centreFor(sx + dx, def);
        const y = this.spawnerY(world, Math.floor(cx), sy, def);
        if (y === null || !this.fits(world, cx, y, def)) continue;

        const mob = new Mob(def, world, cx, y);
        if (collides(mob, world)) continue;
        this.mobs.push(mob);
        placed = true;
        break;
      }
      // Don't burn the full interval on an attempt that found nowhere to stand.
      data.cooldown = placed ? SPAWNER_INTERVAL : SPAWNER_RETRY;
    }
  }

  /**
   * One spawn attempt: pick a column just off screen, find a floor to stand on,
   * work out which biome and light band that floor sits in, and place a mob
   * that belongs there.
   */
  trySpawn(ctx) {
    const { world, player } = ctx;
    if (this.mobs.length >= MAX_MOBS) return false;

    const dir = Math.random() < 0.5 ? -1 : 1;
    const x = Math.round(player.x + dir * (SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)));
    if (x < 2 || x >= world.width - 2) return false;

    // Spawn where the player actually is. Deep underground, everything comes
    // from the surrounding caves; near the surface it's mostly surface mobs,
    // with a few below so a fresh tunnel isn't empty.
    const col = Math.max(0, Math.min(world.width - 1, player.x | 0));
    const depth = player.y - world.ground[col];
    const underground = depth > 10 ? true : Math.random() < 0.3;

    const floorY = underground
      ? this.pickCaveFloor(world, x, underground && depth > 10 ? player.y : null)
      : this.pickSurfaceFloor(world, x);
    if (floorY === null) return false;

    const biomeId = this.biomeIdAt(world, x, floorY);
    if (!biomeId) return false;

    const options = candidatesFor(biomeId, underground ? 'underground' : 'surface');
    if (!options.length) return false;

    const def = weightedPick(options);
    if (!def) return false;

    const y = def.aquatic ? this.pickWaterY(world, x, def) : floorY - def.size[1];
    if (y === null) return false;

    const cx = this.centreFor(x, def);
    if (!this.fits(world, cx, y, def)) return false;

    const mob = new Mob(def, world, cx, y);
    if (collides(mob, world)) return false;
    this.mobs.push(mob);
    return true;
  }

  /** Run a burst of attempts so a world isn't empty the moment you arrive. */
  populate(ctx, attempts = 90) {
    for (let i = 0; i < attempts && this.mobs.length < MAX_MOBS; i++) this.trySpawn(ctx);
  }

  /**
   * Stand a spawner's mob on the first floor beneath it, rather than at the
   * spawner's own height -- otherwise a tall mob's box ends up in the ceiling
   * of the small room the spawner usually sits in.
   */
  spawnerY(world, x, sy, def) {
    if (def.flying) return sy - def.size[1] / 2;

    for (let y = sy; y < Math.min(world.height - 1, sy + 7); y++) {
      if (isSolid(world.get(x, y))) return y - def.size[1];
    }
    return null;
  }

  /** Which biome id a spawn point falls in: a cave band if deep, else the surface band. */
  biomeIdAt(world, x, y) {
    const col = Math.max(0, Math.min(world.width - 1, x | 0));
    if (y - world.ground[col] > 6) {
      const cave = this.caveIdAt(world, y);
      if (cave) return cave;
    }
    return world.bandAt(col).id;
  }

  caveIdAt(world, y) {
    if (world.realm !== 'overworld') return null;
    if (y < world.height * LUSH_CAVES_AT) return 'caves';
    if (y < world.height * DEEP_DARK_AT) return 'lush_caves';
    return 'deep_dark';
  }

  /** The block a surface mob stands on; the waterline in a flooded column. */
  pickSurfaceFloor(world, x) {
    const top = world.ground[x];
    if (top < 1 || top >= world.height - 2) return null;
    if (world.liquidLevel >= 0 && top > world.liquidLevel) return world.liquidLevel + 1;
    return top;
  }

  /**
   * Cave floors are sparse in a 200-block column, so collect them all and pick
   * one -- sampling at random mostly just hits solid rock.
   */
  pickCaveFloor(world, x, nearY = null) {
    const from = world.ground[x] + 8;
    const to = world.height - 6;
    const spots = [];
    for (let y = from; y < to; y++) {
      if (isSolid(world.get(x, y)) && world.get(x, y - 1) === AIR && world.get(x, y - 2) === AIR) {
        spots.push(y);
      }
    }
    if (!spots.length) return null;

    // Prefer a floor on roughly the player's level, so digging down changes
    // which cave biome you meet rather than spawning mobs a hundred blocks away.
    if (nearY !== null) {
      const near = spots.filter((y) => Math.abs(y - nearY) < 26);
      if (near.length) return near[Math.floor(Math.random() * near.length)];
    }
    return spots[Math.floor(Math.random() * spots.length)];
  }

  /** Somewhere in the middle of a water column, for things that swim. */
  pickWaterY(world, x, def) {
    const surf = world.liquidLevel;
    const bed = world.ground[x];
    const room = bed - surf - 1 - def.size[1];
    if (surf < 0 || room < 0.5) return null;
    return surf + 1 + Math.random() * room;
  }

  /**
   * Centre-x that makes a mob's box cover the fewest whole columns starting at
   * `col`. Centring a 1.1-wide mob on col+0.5 spreads it over three columns and
   * it then fails to fit a two-wide gap it would physically occupy.
   */
  centreFor(col, def) {
    return col + Math.max(1, Math.ceil(def.size[0])) / 2;
  }

  /**
   * The mob's whole footprint must be clear, and standing mobs need something
   * underfoot. `cx` is the centre-x, matching how a Mob is constructed.
   */
  fits(world, cx, y, def) {
    const x0 = Math.floor(cx - def.size[0] / 2 + 1e-6);
    const x1 = Math.floor(cx + def.size[0] / 2 - 1e-6);
    const y0 = Math.floor(y);
    const y1 = Math.floor(y + def.size[1] - 1e-6);

    for (let xx = x0; xx <= x1; xx++) {
      for (let yy = y0; yy <= y1; yy++) {
        const id = world.get(xx, yy);
        if (isSolid(id)) return false;
        if (def.aquatic && !isLiquid(id)) return false;
      }
    }
    if (def.flying || def.aquatic) return true;

    for (let xx = x0; xx <= x1; xx++) {
      const below = world.get(xx, y1 + 1);
      if (isSolid(below) || (def.floatsOnLava && isLiquid(below))) return true;
    }
    return false;
  }
}

function weightedPick(list) {
  const total = list.reduce((s, d) => s + (d.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const d of list) {
    r -= d.weight ?? 1;
    if (r <= 0) return d;
  }
  return list[list.length - 1] ?? null;
}
