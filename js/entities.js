import { GRAVITY, MAX_FALL_SPEED, LUSH_CAVES_AT, DEEP_DARK_AT } from './config.js';
import { AIR, SPAWNER, SNOW_LAYER, FIRE, LAVA, WATER, isLiquid, isSolid } from './blocks.js';
import { MOBS, PROFESSIONS, BARTERS, candidatesFor } from './mobs.js';
import { sweep, collides, lineOfSight, occupiedBlocks } from './physics.js';
import * as I from './items.js';

const SPAWN_MIN = 18;        // blocks from the player: just off screen
const SPAWN_MAX = 46;
const DESPAWN_AT = 110;
const MAX_MOBS = 34;
const SPAWN_INTERVAL = 1.4;  // seconds between spawn attempts
const SPAWNER_RANGE = 22;    // blocks: how close before a structure spawner runs
const SPAWNER_INTERVAL = 4;  // seconds between spawner activations
const SPAWNER_RETRY = 0.8;   // shorter wait when there was nowhere to put it
const SPAWN_OFFSETS = [1, -1, 2, -2, 3, -3, 0];
const RESIDENT_RANGE = 56;   // blocks: how close before a structure's residents appear
const SIGHT = 20;            // how far an ordinary mob notices a target
const MEMORY = 6;            // seconds a chaser keeps after a target it can't see
const SMALLEST = 0.3;        // a split slime below this scale stops splitting

// Seconds each visual effect lasts; renderer.js draws them.
const EFFECT_LIFE = {
  explosion: 0.6, teleport: 0.5, fang: 0.9, sonic: 0.45, ink: 1.4,
  hearts: 1.2, smoke: 0.8, sparkle: 0.8, puff: 0.35, totem: 1.4,
};

let nextId = 1;

/** Whether `mob` is one of `list`: its own id, or any of its tags. */
function matches(mob, list) {
  if (!list || !mob.def) return false;
  return list.includes(mob.def.id) || mob.def.tags.some((t) => list.includes(t));
}

/** Mobs on one team never hurt each other with stray shots or fangs. */
function sameTeam(a, b) {
  return !!a?.def?.team && a.def.team === b?.def?.team;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.centerY - b.centerY);

/** Whether a w-by-h box with centre-x `cx` and top `y` sits clear of anything a mob can't pass. */
function boxFits(world, cx, y, w, h) {
  const x0 = Math.floor(cx - w / 2 + 1e-6);
  const x1 = Math.floor(cx + w / 2 - 1e-6);
  const y0 = Math.floor(y);
  const y1 = Math.floor(y + h - 1e-6);
  for (let xx = x0; xx <= x1; xx++) {
    for (let yy = y0; yy <= y1; yy++) {
      if (world.blocksMobAt(xx, yy)) return false;
    }
  }
  return true;
}

/** A villager's profession: its name, robe colours and trades. */
function villagerLook() {
  const keys = Object.keys(PROFESSIONS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const p = PROFESSIONS[key];
  return {
    profession: key,
    name: p.name,
    palette: { body: p.robe, head: '#c9a07a', legs: '#4a3a2a', accent: p.hat },
  };
}

// ------------------------------------------------------------------ mobs

export class Mob {
  constructor(def, world, x, y, opts = {}) {
    this.eid = nextId++;
    this.def = def;
    this.world = world;
    this.scale = opts.scale ?? 1;          // split slimes are smaller copies
    this.x = x;
    this.y = y;
    this.w = def.size[0] * this.scale;
    this.h = def.size[1] * this.scale;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.blockedX = false;

    this.maxHealth = Math.max(1, Math.round(def.health * this.scale * this.scale));
    this.health = this.maxHealth;
    this.damage = this.scale < SMALLEST ? 0 : Math.round((def.damage ?? 0) * this.scale);
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.name = opts.name ?? def.name;
    this.palette = opts.palette ?? def.palette;
    this.profession = opts.profession ?? null;

    this.state = 'wander';     // wander | chase | flee | follow
    this.stateTimer = 0;
    this.wanderDir = 0;
    this.target = null;        // the player or a Mob it's fighting
    this.anger = null;         // whoever provoked it; outranks anything it merely sees
    this.angerTimer = 0;
    this.memory = 0;
    this.threat = null;        // what it's running from
    this.fleeTimer = 0;
    this.scanTimer = Math.random() * 0.4;

    this.attackCooldown = 0;
    this.rangedCooldown = def.ranged ? Math.random() * def.ranged.cooldown : 0;
    this.burstLeft = 0;
    this.burstTimer = 0;
    this.hurtFlash = 0;
    this.bob = Math.random() * Math.PI * 2;
    this.dead = false;         // killed (burning, a hit, its own fuse)
    this.gone = false;         // despawned without dying

    this.fuse = 0;             // creeper: seconds lit
    this.ignited = false;      // creeper: lit with flint and steel, no going back
    this.onFire = 0;           // seconds of flame left to draw
    this.burnTick = 0;
    this.teleportTimer = 6 + Math.random() * 20;
    this.teleportCooldown = 0;
    this.hopTimer = Math.random();
    this.spellCooldown = 3;    // evoker
    this.vexCooldown = 0;
    this.casting = 0;
    this.life = def.lifespan
      ? def.lifespan[0] + Math.random() * (def.lifespan[1] - def.lifespan[0]) : Infinity;
    this.stingTimer = Infinity;
    this.swoop = false;        // phantom: diving rather than circling
    this.swoopTimer = 3;
    this.potionCooldown = 0;   // witch
    this.barter = 0;           // piglin: seconds left admiring a gold ingot

    this.owner = opts.owner ?? null;          // tamed pets follow and defend the player
    this.summoner = opts.summoner ?? null;    // vexes belong to an evoker
    this.home = opts.home ?? null;            // residents stay inside { x0, x1 }
    this.playerBuilt = !!opts.playerBuilt;    // a golem you built never turns on you unprovoked
  }

  get left()   { return this.x - this.w / 2; }
  get right()  { return this.x + this.w / 2; }
  get top()    { return this.y; }
  get bottom() { return this.y + this.h; }
  get centerY() { return this.y + this.h / 2; }

  get inLiquid() {
    return isLiquid(this.world.get(Math.floor(this.x), Math.floor(this.centerY)));
  }

  /** Nothing overhead: daylight reaches it. Leaves count as shade. */
  get underSky() {
    const col = Math.floor(this.x);
    if (col < 0 || col >= this.world.width) return false;
    return this.world.surface[col] >= Math.floor(this.y);
  }

  get underground() {
    const col = Math.max(0, Math.min(this.world.width - 1, Math.floor(this.x)));
    return this.y - this.world.ground[col] > 6;
  }

  /** Damage from any source; `fromX` shoves it away. Returns false if already dead. */
  hurt(amount, fromX = null) {
    if (this.dead) return false;
    this.health -= amount;
    this.hurtFlash = 0.25;

    if (fromX !== null) {
      const k = 1 - (this.def.knockbackResist ?? 0);
      const dir = Math.sign(this.x - fromX) || 1;
      this.vx = dir * 7 * k;
      if (this.onGround && k > 0) this.vy = -7 * k;
    }

    if (this.health <= 0) this.dead = true;
    return true;
  }

  /** Someone hit it: passive mobs bolt, the rest turn on whoever it was. */
  provoke(attacker, ctx) {
    if (!attacker || attacker === this || attacker === this.owner) return;
    if (attacker instanceof Mob && (sameTeam(this, attacker) || (this.owner && attacker.owner === this.owner))) return;
    if (attacker === ctx.player && this.def.behavior === 'guard') return;

    if (this.def.behavior === 'passive') {
      this.threat = attacker;
      this.fleeTimer = 4;
      return;
    }
    this.anger = attacker;
    this.angerTimer = attacker === ctx.player ? 20 : 12;
    this.target = attacker;
    this.memory = MEMORY;
  }

  update(dt, ctx) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.rangedCooldown = Math.max(0, this.rangedCooldown - dt);
    this.burstTimer = Math.max(0, this.burstTimer - dt);
    this.stateTimer = Math.max(0, this.stateTimer - dt);
    this.angerTimer = Math.max(0, this.angerTimer - dt);
    this.memory = Math.max(0, this.memory - dt);
    this.fleeTimer = Math.max(0, this.fleeTimer - dt);
    this.teleportCooldown = Math.max(0, this.teleportCooldown - dt);
    this.spellCooldown = Math.max(0, this.spellCooldown - dt);
    this.vexCooldown = Math.max(0, this.vexCooldown - dt);
    this.casting = Math.max(0, this.casting - dt);
    this.potionCooldown = Math.max(0, this.potionCooldown - dt);
    this.bob += dt * 4;

    this.environment(dt, ctx);
    if (this.dead) return;
    this.think(dt, ctx);
    this.act(dt, ctx);
    if (this.dead) return;
    this.move(dt, ctx);
    this.melee(ctx);
  }

  // ---- surroundings ----

  /** What the world does to it: sunlight, water, heat, and running out of time. */
  environment(dt, ctx) {
    const def = this.def;
    const world = this.world;

    if (def.burnsInDay && world.realm === 'overworld' && ctx.daylight > 0.5
        && !this.inLiquid && this.underSky) {
      this.onFire = Math.max(this.onFire, 0.6);
    }
    // Fire and lava set it alight (Nether mobs don't care); water puts it out.
    if (!def.lavaProof) {
      const touching = occupiedBlocks(this, world);
      if (touching.has(FIRE) || touching.has(LAVA)) this.onFire = Math.max(this.onFire, 5);
    }
    if (world.get(Math.floor(this.x), Math.floor(this.centerY)) === WATER) this.onFire = 0;

    // Endermen can't stand water; snow golems melt in heat and water.
    const melting = def.meltsIn && (world.realm === 'nether' || this.inLiquid
      || def.meltsIn.includes(world.bandAt(this.x).id));
    const soaked = def.teleports && this.inLiquid;

    if (this.onFire > 0 || melting || soaked) {
      this.onFire = Math.max(0, this.onFire - dt);
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = soaked ? 0.5 : 1;
        this.hurt(1);
        if (soaked) this.teleport(ctx, this.x, 12);
      }
    }

    if (def.snowTrail && this.onGround && !melting) this.leaveSnow();

    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    if (this.stingTimer !== Infinity) {
      this.stingTimer -= dt;
      if (this.stingTimer <= 0) this.dead = true;
    }

    // A dolphin nearby lends a swimming player some speed.
    if (def.grace && ctx.player.inLiquid && dist(this, ctx.player) < 7) {
      ctx.player.applyEffect('speed', 1.4, 1.5);
    }

    // Idle endermen blink about.
    if (def.teleports && this.state === 'wander') {
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this.teleportTimer = 8 + Math.random() * 20;
        this.teleport(ctx, this.x, 16);
      }
    }
  }

  /** Snow golems leave a layer of snow on whatever they walk over. */
  leaveSnow() {
    const x = Math.floor(this.x);
    const feet = Math.floor(this.bottom - 0.01);
    const below = this.world.get(x, feet + 1);
    if (this.world.get(x, feet) === AIR && isSolid(below) && this.world.blocksMobAt(x, feet + 1)) {
      this.world.set(x, feet, SNOW_LAYER);
    }
  }

  // ---- targeting ----

  /** Whether it goes after the player without being provoked first. */
  huntsPlayer(ctx) {
    const def = this.def;
    if (!ctx.playerVulnerable || this.owner) return false;
    if (def.behavior === 'hostile') return true;
    if (def.hatesUngilded) return !ctx.holdingGold && this.barter <= 0;
    if (def.hostileInDark) return ctx.night || this.underground;
    return false;
  }

  /** Can it tell the player is there? Wardens are blind but hear movement through walls. */
  senses(p, d, ctx) {
    if (this.def.senses === 'vibration') {
      return d < 16 && (ctx.playerNoise || Math.abs(p.vx) > 1 || Math.abs(p.vy) > 1);
    }
    return lineOfSight(this.world, this.x, this.centerY, p.x, p.centerY, SIGHT * (this.def.boss ? 3 : 1));
  }

  /** The nearest thing it wants to fight right now, if any. */
  scan(ctx) {
    const def = this.def;
    const sight = def.boss ? SIGHT * 3 : SIGHT;
    let best = null;
    let bestD = Infinity;

    if (this.huntsPlayer(ctx)) {
      const d = dist(this, ctx.player);
      if (d < sight && this.senses(ctx.player, d, ctx)) { best = ctx.player; bestD = d; }
    }

    const preys = this.owner ? null : def.preys;
    if (preys) {
      for (const m of ctx.mobs) {
        if (m === this || m.dead || m.owner || !matches(m, preys) || sameTeam(this, m)) continue;
        const d = dist(this, m);
        if (d >= bestD || d > sight) continue;
        if (!lineOfSight(this.world, this.x, this.centerY, m.x, m.centerY, sight)) continue;
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  nearestFeared(ctx) {
    let best = null;
    let bestD = 8;
    for (const m of ctx.mobs) {
      if (m === this || m.dead || !matches(m, this.def.fears)) continue;
      const d = dist(this, m);
      if (d < bestD) { best = m; bestD = d; }
    }
    return best;
  }

  stillThere(t, ctx) {
    if (!t) return false;
    if (t === ctx.player) return ctx.playerVulnerable && !this.owner;
    return !t.dead && !t.gone && dist(this, t) < SIGHT * 3;
  }

  think(dt, ctx) {
    const def = this.def;
    const player = ctx.player;

    // Endermen treat the cursor resting on them as being stared at.
    if (def.stareProvoked && ctx.lookedAt === this && ctx.playerVulnerable
        && dist(this, player) < 32 && this.anger !== player) {
      this.provoke(player, ctx);
    }

    if (this.anger && (this.angerTimer <= 0 || !this.stillThere(this.anger, ctx))) this.anger = null;
    if (this.threat && (this.fleeTimer <= 0 || this.threat.dead || this.threat.gone)) this.threat = null;

    this.scanTimer -= dt;
    if (this.scanTimer <= 0) {
      this.scanTimer = 0.3 + Math.random() * 0.3;
      const seen = this.anger ?? this.scan(ctx);
      if (seen) { this.target = seen; this.memory = MEMORY; }
      else if (this.memory <= 0) this.target = null;

      if (def.fears) {
        const f = this.nearestFeared(ctx);
        if (f) { this.threat = f; this.fleeTimer = 3; }
      }
    }
    if (this.target && !this.stillThere(this.target, ctx)) this.target = null;

    // A pet that's fallen far behind catches up the way an enderman would.
    if (this.owner && dist(this, player) > 20 && this.teleportCooldown <= 0) {
      this.teleportCooldown = 1;
      this.teleport(ctx, player.x, 3);
    }

    if (this.threat) {
      this.state = 'flee';
      this.wanderDir = -(Math.sign(this.threat.x - this.x) || 1);
    } else if (this.target) {
      this.state = 'chase';
      const dx = this.target.x - this.x;
      this.wanderDir = Math.sign(dx) || 1;

      // Ranged attackers and casters hold their distance instead of closing in.
      const range = def.ranged?.range ?? (def.caster ? 12 : 0);
      if (range && def.ranged?.kind !== 'sonic') {
        const d = dist(this, this.target);
        if (d < range * 0.45) this.wanderDir = -Math.sign(dx) || 1;
        else if (d < range * 0.8) this.wanderDir = 0;
      }
      if (this.fuse > 0 || this.barter > 0) this.wanderDir = 0;
    } else if (this.owner && dist(this, player) > 4) {
      this.state = 'follow';
      this.wanderDir = Math.sign(player.x - this.x) || 1;
    } else {
      if (this.state !== 'wander') this.stateTimer = 0;
      this.state = 'wander';
      if (this.stateTimer <= 0) {
        // Idle wander: pick a direction (or a pause) every few seconds.
        const r = Math.random();
        this.wanderDir = r < 0.34 ? -1 : r < 0.68 ? 1 : 0;
        this.stateTimer = 1.5 + Math.random() * 2.5;
      }
      // Residents drift back toward home rather than wandering off.
      if (this.home) {
        if (this.x < this.home.x0 + 1) this.wanderDir = 1;
        else if (this.x > this.home.x1 - 1) this.wanderDir = -1;
      }
      if (this.barter > 0) this.wanderDir = 0;
    }

    if (this.wanderDir !== 0) this.facing = this.wanderDir;
    else if (this.target) this.facing = Math.sign(this.target.x - this.x) || this.facing;
  }

  // ---- special moves ----

  act(dt, ctx) {
    const def = this.def;
    const t = this.state === 'chase' ? this.target : null;
    const d = t ? dist(this, t) : Infinity;

    if (def.fuse) {
      const f = def.fuse;
      const lit = this.ignited || (t && (d < f.trigger || (this.fuse > 0 && d < f.cancel))
        && lineOfSight(this.world, this.x, this.centerY, t.x, t.centerY, f.cancel));
      this.fuse = lit ? this.fuse + dt : Math.max(0, this.fuse - dt * 0.5);
      if (this.fuse >= f.time) {
        this.dead = true;
        this.exploded = true;
        ctx.explode(this.x, this.centerY, f.power, this);
      }
      return;
    }

    if (def.drinksPotions && this.health < this.maxHealth * 0.5 && this.potionCooldown <= 0) {
      this.health = Math.min(this.maxHealth, this.health + 6);
      this.potionCooldown = 10;
      ctx.entities.addEffect('sparkle', this.x, this.centerY, { colour: '#f0447a' });
    }

    if (this.barter > 0) {
      this.barter -= dt;
      if (this.barter <= 0) ctx.entities.finishBarter(this, ctx);
      return;
    }

    if (!t) return;

    // A chasing enderman blinks next to its target when it's far off or out of sight.
    if (def.teleports && this.teleportCooldown <= 0
        && (d > 10 || !lineOfSight(this.world, this.x, this.centerY, t.x, t.centerY, 40))) {
      this.teleportCooldown = 3;
      this.teleport(ctx, t.x, 3);
    }

    if (def.caster && d < 14) this.cast(ctx, t);
    if (def.ranged && d < def.ranged.range) this.shoot(ctx, t);
  }

  /** Evoker: a ring of vexes when it has none, snapping fangs otherwise. */
  cast(ctx, t) {
    if (this.spellCooldown > 0) return;
    if (!lineOfSight(this.world, this.x, this.centerY, t.x, t.centerY, 14)) return;

    const vexes = ctx.mobs.filter((m) => m.summoner === this && !m.dead).length;
    if (vexes === 0 && this.vexCooldown <= 0) {
      for (let i = 0; i < 3; i++) {
        const vex = ctx.entities.spawn(this.world, 'vex', this.x + (i - 1) * 0.8, this.y - 0.6,
          { summoner: this });
        if (vex) { vex.anger = t; vex.angerTimer = 60; vex.target = t; }
      }
      this.vexCooldown = 17;
      this.spellCooldown = 2;
    } else {
      ctx.entities.fangs(this, t);
      this.spellCooldown = 4;
    }
    this.casting = 1;
  }

  shoot(ctx, t) {
    const r = this.def.ranged;
    const sees = r.kind === 'sonic'
      || lineOfSight(this.world, this.x, this.centerY, t.x, t.centerY, r.range);
    if (!sees) return;

    // A burst (blazes) finishes its volley before the cooldown starts over.
    if (this.burstLeft > 0) {
      if (this.burstTimer <= 0) {
        this.fireAt(ctx, t);
        this.burstLeft--;
        this.burstTimer = r.gap;
      }
      return;
    }
    if (this.rangedCooldown > 0) return;

    this.fireAt(ctx, t);
    this.rangedCooldown = r.cooldown;
    if (r.burst) { this.burstLeft = r.burst - 1; this.burstTimer = r.gap; }
  }

  fireAt(ctx, t) {
    const r = this.def.ranged;
    // The warden's sonic boom is instant and goes straight through walls.
    if (r.kind === 'sonic') {
      ctx.entities.addEffect('sonic', this.x, this.centerY, { x2: t.x, y2: t.centerY });
      this.strike(t, ctx, r.damage, { knockback: 12 });
      return;
    }

    const gravity = PROJECTILE_GRAVITY[r.kind] ?? 16;
    const { vx, vy } = ballisticVelocity(t.x - this.x, t.centerY - this.centerY, r.speed, gravity);
    ctx.entities.projectiles.push(new Projectile(r.kind, this.world, this.x, this.centerY, vx, vy, {
      damage: r.damage, owner: this, effect: r.effect, explode: r.explode, vs: r.vs,
      target: r.kind === 'bullet' ? t : null,
    }));
  }

  /** Land a hit on `target`, with whatever extra the mob's attack carries. */
  strike(target, ctx, damage = this.damage, onHit = this.def.onHit) {
    const dir = Math.sign(target.x - this.x) || 1;
    if (target === ctx.player) {
      if (!ctx.playerVulnerable) return;
      ctx.damagePlayer(damage, this.x, this);
      if (onHit?.effect) target.applyEffect(onHit.effect, onHit.value, onHit.duration);
      if (onHit?.launch) target.vy = -onHit.launch;
      if (onHit?.knockback) { target.vx = dir * onHit.knockback; target.vy = Math.min(target.vy, -6); }
    } else {
      ctx.entities.hurtMob(target, damage, this.x, this, ctx);
      const k = 1 - (target.def.knockbackResist ?? 0);
      if (onHit?.launch) target.vy = -onHit.launch * k;
      if (onHit?.knockback) target.vx = dir * onHit.knockback * k;
    }
    // A bee loses its sting, and doesn't last long after.
    if (this.def.stingsOnce && this.stingTimer === Infinity) this.stingTimer = 6;
  }

  melee(ctx) {
    const def = this.def;
    const t = this.target;
    if (!t || this.state !== 'chase' || !this.damage || this.attackCooldown > 0) return;
    if (def.fuse || def.caster || this.stingTimer !== Infinity) return;
    if (def.ranged && def.ranged.kind !== 'sonic' && dist(this, t) > 2.5) return;

    const reach = 0.25;
    const touching = this.right + reach > t.left && this.left - reach < t.right
      && this.bottom > t.top && this.top < t.bottom;
    if (!touching) return;

    this.strike(t, ctx);
    this.attackCooldown = def.id === 'iron_golem' ? 1.25 : 0.9;
  }

  /**
   * Blink to a standable spot within `range` columns of `cx`, near its own
   * height. Returns false if nowhere suitable turned up.
   */
  teleport(ctx, cx, range) {
    const world = this.world;
    for (let attempt = 0; attempt < 20; attempt++) {
      const col = Math.floor(cx + (Math.random() * 2 - 1) * range);
      const from = Math.floor(this.y) - 8;
      for (let y = from; y < from + 18; y++) {
        if (!world.blocksMobAt(col, y) || world.isLiquidAt(col, y - 1)) continue;
        const top = y - this.h - 1e-3;
        if (!boxFits(world, col + 0.5, top, this.w, this.h)) continue;

        ctx.entities.addEffect('teleport', this.x, this.centerY);
        this.x = col + 0.5;
        this.y = top;
        this.vx = 0;
        this.vy = 0;
        ctx.entities.addEffect('teleport', this.x, this.centerY);
        return true;
      }
    }
    return false;
  }

  // ---- movement ----

  move(dt, ctx) {
    const def = this.def;
    const speed = def.speed * (this.state === 'chase' ? 1.15
      : this.state === 'flee' ? 1.3 : this.state === 'follow' ? 1.2 : 0.55);
    const t = this.state === 'chase' ? this.target : null;

    if (def.flying) {
      let targetY = t ? t.centerY - 1.5 : this.centerY + Math.sin(this.bob) * 2;
      let steer = this.wanderDir * speed;

      // Swoopers circle high above, then dive straight at their target.
      if (def.swoops && t) {
        this.swoopTimer -= dt;
        if (this.swoopTimer <= 0) {
          this.swoop = !this.swoop;
          this.swoopTimer = this.swoop ? 1.4 : 3 + Math.random() * 2;
        }
        if (this.swoop) {
          const d = dist(this, t) || 1;
          steer = ((t.x - this.x) / d) * speed * 1.8;
          targetY = t.centerY;
        } else {
          targetY = t.centerY - 7;
        }
      }

      this.vx += (steer - this.vx) * Math.min(1, dt * 3);
      this.vy += ((targetY - this.centerY) * 1.6 - this.vy) * Math.min(1, dt * 3);
      const cap = speed * (this.swoop ? 2 : 1.2);
      this.vy = Math.max(-cap, Math.min(cap, this.vy));

      if (def.noclip) {
        // Vexes drift straight through walls.
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      } else {
        sweep(this, this.world, this.vx * dt, this.vy * dt);
      }
      return;
    }

    if (def.aquatic) {
      // Swimmers only steer while wet; on land they just flop and fall.
      if (this.inLiquid) {
        this.vx += (this.wanderDir * speed - this.vx) * Math.min(1, dt * 3);
        const targetY = t ? t.centerY : this.centerY + Math.sin(this.bob) * 1.5;
        this.vy += ((targetY - this.centerY) * 1.2 - this.vy) * Math.min(1, dt * 3);
        this.vy = Math.max(-speed, Math.min(speed, this.vy));
      } else {
        this.vx *= Math.pow(0.02, dt);
        this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
      }
      sweep(this, this.world, this.vx * dt, this.vy * dt);
      return;
    }

    if (def.hops) {
      // Hoppers only move in the air: sit, gather, leap.
      if (this.onGround) {
        this.vx *= Math.pow(0.0005, dt);
        this.hopTimer -= dt;
        if (this.hopTimer <= 0 && this.wanderDir !== 0) {
          this.vy = -def.jump * (0.75 + 0.25 * this.scale);
          this.vx = this.wanderDir * speed * 1.5;
          this.hopTimer = (this.state === 'chase' ? 0.4 : 1.1) + Math.random() * 0.6;
        }
      }
    } else {
      // Walkers: accelerate toward the wander direction, hop over what blocks them.
      const target = this.wanderDir * speed;
      this.vx += (target - this.vx) * Math.min(1, dt * 8);
    }

    const floating = def.floatsOnLava && isLiquid(this.world.get(Math.floor(this.x), Math.floor(this.bottom)));
    if (floating) {
      this.vy += ((this.bottom - 0.6 < Math.floor(this.bottom) ? -2 : 2) - this.vy) * dt * 4;
    } else if (this.inLiquid) {
      this.vy = Math.min(3, this.vy + GRAVITY * 0.25 * dt);
      if (this.wanderDir !== 0) this.vy -= 5 * dt;      // paddle upward
    } else {
      this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    }

    if (def.climbs && this.blockedX && this.wanderDir !== 0) {
      this.vy = -3.5;                                    // spiders walk up walls
    } else if (this.blockedX && this.onGround && this.wanderDir !== 0 && def.jump > 0 && !def.hops) {
      this.vy = -def.jump;
    }

    sweep(this, this.world, this.vx * dt, this.vy * dt);

    // Don't let idle wanderers walk off cliffs; chasers commit.
    if (this.onGround && this.state === 'wander' && this.wanderDir !== 0) {
      const ahead = Math.floor(this.x + this.wanderDir * (this.w / 2 + 0.3));
      const below = Math.floor(this.bottom + 1.5);
      if (!this.world.blocksMobAt(ahead, below) && !this.world.isLiquidAt(ahead, below)) {
        this.wanderDir = -this.wanderDir;
      }
    }
  }

  /** What this mob leaves behind. Only the smallest slimes drop anything. */
  rollDrops() {
    if (this.def.splits && this.scale > SMALLEST) return [];
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

const PROJECTILE_GRAVITY = { arrow: 16, potion: 22, fireball: 0, snowball: 16, spit: 10, bullet: 0 };

export class Projectile {
  constructor(kind, world, x, y, vx, vy, opts = {}) {
    this.eid = nextId++;
    this.kind = kind;                  // arrow | fireball | potion | snowball | spit | bullet
    this.world = world;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.w = kind === 'arrow' ? 0.5 : 0.6;
    this.h = kind === 'arrow' ? 0.15 : 0.6;
    this.damage = opts.damage ?? 4;
    this.fromPlayer = !!opts.fromPlayer;
    this.owner = opts.owner ?? null;   // the mob that fired it
    this.effect = opts.effect ?? null; // applied to the player on a hit
    this.explode = opts.explode ?? 0;  // blast power on impact
    this.vs = opts.vs ?? null;         // per-mob damage overrides (snowballs vs blazes)
    this.homing = opts.target ?? null; // shulker bullets chase their target
    this.speed = Math.hypot(vx, vy);
    this.gravity = PROJECTILE_GRAVITY[kind] ?? 16;
    this.life = kind === 'bullet' ? 8 : 6;
    this.dead = false;
    this.angle = Math.atan2(vy, vx);
  }

  get centerY() { return this.y + this.h / 2; }

  update(dt, ctx) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    const h = this.homing;
    if (h && !h.dead && !h.gone) {
      const dx = h.x - this.x;
      const dy = h.centerY - this.centerY;
      const d = Math.hypot(dx, dy) || 1;
      this.vx += ((dx / d) * this.speed - this.vx) * Math.min(1, dt * 1.8);
      this.vy += ((dy / d) * this.speed - this.vy) * Math.min(1, dt * 1.8);
    }

    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle = Math.atan2(this.vy, this.vx);

    if (this.world.blocksMovementAt(Math.floor(this.x), Math.floor(this.centerY))) {
      this.onImpact(ctx, null);
      return;
    }

    const cy = this.centerY;
    for (const m of ctx.mobs) {
      if (m.dead || m === this.owner || sameTeam(m, this.owner)) continue;
      if (this.x <= m.left || this.x >= m.right || cy <= m.top || cy >= m.bottom) continue;
      // Endermen see it coming and blink out of the way.
      if (m.def.teleports && this.kind !== 'potion') {
        m.teleport(ctx, m.x, 10);
        continue;
      }
      this.onImpact(ctx, m);
      return;
    }

    // Golems and pets are on the player's side; their shots pass harmlessly.
    const p = ctx.player;
    if (!this.fromPlayer && ctx.playerVulnerable && this.owner?.def?.team !== 'village'
        && this.x > p.left && this.x < p.right && cy > p.top && cy < p.bottom) {
      this.onImpact(ctx, 'player');
    }
  }

  onImpact(ctx, hit) {
    this.dead = true;
    const attacker = this.fromPlayer ? ctx.player : this.owner;

    if (this.explode) {
      ctx.explode(this.x, this.centerY, this.explode, attacker, this.kind === 'fireball');
      return;
    }

    // A small fireball sets alight whatever it hits, or the spot where it lands.
    if (this.kind === 'fireball') {
      if (hit === 'player') ctx.player.ignite(5);
      else if (hit && !hit.def.lavaProof) hit.onFire = Math.max(hit.onFire, 5);
      else if (!hit) ctx.ignite(Math.floor(this.x - this.vx * 0.03), Math.floor(this.centerY - this.vy * 0.03));
    }

    if (this.kind === 'potion') {
      // Splash: everything within a couple of blocks takes the hit.
      for (const m of ctx.mobs) {
        if (!m.dead && !sameTeam(m, this.owner) && Math.hypot(m.x - this.x, m.centerY - this.centerY) < 2.5) {
          ctx.killOrHurt(m, this.damage, this.x, attacker);
        }
      }
      if (ctx.playerVulnerable && !this.fromPlayer
          && Math.hypot(ctx.player.x - this.x, ctx.player.centerY - this.centerY) < 2.5) {
        ctx.damagePlayer(this.damage, this.x, attacker);
      }
      ctx.entities.addEffect('sparkle', this.x, this.centerY, { colour: '#8a3a9a' });
      return;
    }

    if (this.kind === 'snowball') ctx.entities.addEffect('puff', this.x, this.centerY);

    const damage = hit && hit !== 'player' ? (this.vs?.[hit.def.id] ?? this.damage) : this.damage;
    if (hit === 'player') {
      ctx.damagePlayer(damage, this.x, attacker);
      if (this.effect) ctx.player.applyEffect(this.effect.name, this.effect.value, this.effect.duration);
    } else if (hit) {
      ctx.killOrHurt(hit, damage, this.x, attacker);
    }
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
    this.effects = [];       // short-lived visuals: explosions, teleports, fangs...
    this.spawnTimer = 0;
    this.enabled = true;
    this.epoch = 0;          // bumped on clear, so structures know to repopulate
  }

  clear() {
    this.mobs.length = 0;
    this.projectiles.length = 0;
    this.effects.length = 0;
    this.epoch++;
  }

  /** Mobs belong to the realm they were spawned in; changing realm clears them. */
  onRealmChange() {
    this.clear();
  }

  spawn(world, defId, x, y, opts = {}) {
    const def = MOBS[defId];
    if (!def) return null;
    const m = new Mob(def, world, x, y, opts);
    this.mobs.push(m);
    return m;
  }

  addEffect(kind, x, y, extra = {}) {
    this.effects.push({ kind, x, y, t: 0, life: EFFECT_LIFE[kind] ?? 0.6, ...extra });
  }

  update(dt, ctx) {
    const { world, player } = ctx;
    ctx.entities = this;

    for (const m of this.mobs) {
      if (!m.dead) m.update(dt, ctx);
    }
    for (const p of this.projectiles) {
      if (!p.dead) p.update(dt, ctx);
    }
    this.updateEffects(dt, ctx);

    // Reap the dead (slimes split as they go), and anything that wandered off.
    const kept = [];
    for (const m of this.mobs) {
      if (m.dead) {
        if (m.def.splits && m.scale > SMALLEST) this.split(m, kept);
        continue;
      }
      const lost = m.y > world.height + 4 || world.inVoid(m)
        || (!m.owner && Math.abs(m.x - player.x) >= DESPAWN_AT);
      if (lost) { m.gone = true; continue; }
      kept.push(m);
    }
    this.mobs = kept;
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    if (!this.enabled) return;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      this.trySpawn(ctx);
    }
    this.runSpawners(dt, ctx);
    this.runResidents(ctx);
  }

  updateEffects(dt, ctx) {
    for (const e of this.effects) {
      e.t += dt;
      // Fangs snap shut a moment after they rise, biting whatever stands on them.
      if (e.kind === 'fang' && !e.snapped && e.t >= 0.25) {
        e.snapped = true;
        this.fangBite(e, ctx);
      }
    }
    this.effects = this.effects.filter((e) => e.t < e.life);
  }

  fangBite(e, ctx) {
    const hit = (b) => b.right > e.x - 0.5 && b.left < e.x + 0.5 && b.bottom > e.y - 1.2 && b.top < e.y;
    if (ctx.playerVulnerable && hit(ctx.player)) ctx.damagePlayer(6, e.x, e.owner);
    for (const m of this.mobs) {
      if (!m.dead && m !== e.owner && !sameTeam(m, e.owner) && hit(m)) ctx.killOrHurt(m, 6, e.x, e.owner);
    }
  }

  /** A line of evoker fangs running along the ground toward the target. */
  fangs(caster, target) {
    const world = caster.world;
    const dir = Math.sign(target.x - caster.x) || 1;
    let floor = Math.floor(caster.bottom + 0.01);      // the row it's standing on
    for (let i = 0; i < 10; i++) {
      const fx = Math.floor(caster.x) + dir * (i + 1);
      // Follow the ground a block up or down; stop at a wall or a drop.
      if (world.blocksMobAt(fx, floor - 1)) floor--;
      else if (!world.blocksMobAt(fx, floor)) floor++;
      if (world.blocksMobAt(fx, floor - 1) || !world.blocksMobAt(fx, floor)) break;
      this.effects.push({
        kind: 'fang', x: fx + 0.5, y: floor, t: -i * 0.07, life: EFFECT_LIFE.fang, owner: caster,
      });
    }
  }

  split(m, into) {
    const n = 2 + Math.floor(Math.random() * 3);
    const scale = m.scale / 2;
    for (let i = 0; i < n; i++) {
      const child = new Mob(m.def, m.world, m.x + (i - (n - 1) / 2) * 0.35,
        m.bottom - m.def.size[1] * scale - 1e-3, { scale });
      child.vx = (Math.random() * 2 - 1) * 3;
      child.vy = -4;
      into.push(child);
    }
  }

  /**
   * Everything that follows from a mob being hit: its own health, whether it
   * turns on the attacker, and who else joins in. Returns true if it died.
   */
  hurtMob(mob, amount, fromX, attacker, ctx) {
    if (!mob.hurt(amount, fromX)) return false;
    if (mob.def.inks) this.addEffect('ink', mob.x, mob.centerY, { colour: mob.def.inks });
    if (!mob.dead && mob.def.teleports && Math.random() < 0.35) mob.teleport(ctx, mob.x, 8);
    if (!attacker) return mob.dead;

    mob.provoke(attacker, ctx);

    // Wolves, bees and piglins answer for each other.
    if (mob.def.groupAnger) {
      for (const m of this.mobs) {
        if (m !== mob && !m.dead && !m.owner && m.def.id === mob.def.id && Math.abs(m.x - mob.x) < 16) {
          m.provoke(attacker, ctx);
        }
      }
    }

    if (attacker === ctx.player) {
      // Hurting a villager turns the village's golems on you.
      if (matches(mob, ['villager'])) {
        for (const g of this.mobs) {
          if (g.def.id === 'iron_golem' && !g.dead && !g.playerBuilt && Math.abs(g.x - mob.x) < 24) {
            g.provoke(ctx.player, ctx);
          }
        }
      }
      // Pets join in on whatever their owner is fighting.
      if (!mob.owner) {
        for (const pet of this.mobs) {
          if (pet.owner === ctx.player && !pet.dead) pet.provoke(mob, ctx);
        }
      }
    }
    return mob.dead;
  }

  /** Whatever hurts the player has its pets to answer to. */
  onPlayerHurt(attacker, ctx) {
    if (!(attacker instanceof Mob)) return;
    for (const pet of this.mobs) {
      if (pet.owner === ctx.player && !pet.dead && pet !== attacker) pet.provoke(attacker, ctx);
    }
  }

  tame(mob, owner) {
    mob.owner = owner;
    mob.anger = null;
    mob.target = null;
    mob.home = null;
    mob.maxHealth = Math.max(mob.maxHealth, 20);
    mob.health = mob.maxHealth;
    this.addEffect('hearts', mob.x, mob.y);
  }

  /** A piglin that's done admiring its gold hands something back. */
  finishBarter(piglin, ctx) {
    const total = BARTERS.reduce((s, b) => s + b.weight, 0);
    let r = Math.random() * total;
    let pick = BARTERS[BARTERS.length - 1];
    for (const b of BARTERS) {
      r -= b.weight;
      if (r <= 0) { pick = b; break; }
    }
    const n = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
    ctx.giveItem(pick.id, n, `Piglin traded ${I.nameOf(pick.id)} x${n}`);
    this.addEffect('sparkle', piglin.x, piglin.centerY, { colour: '#e8c43a' });
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
   * Villages, outposts and mansions come with the people who live there. They
   * appear as the player approaches, and come back once the player has been
   * far enough away for them to despawn.
   */
  runResidents(ctx) {
    const { world, player } = ctx;
    for (const s of world.structures) {
      if (!s.residents?.length) continue;
      const d = Math.abs((s.x0 + s.x1) / 2 - player.x);

      if (s.populated === this.epoch) {
        if (d > DESPAWN_AT) s.populated = -1;
        continue;
      }
      if (d > RESIDENT_RANGE) continue;
      s.populated = this.epoch;

      for (const r of s.residents) {
        const def = MOBS[r.mob];
        if (!def) continue;
        const opts = { home: { x0: s.x0, x1: s.x1 }, ...(def.trades ? villagerLook() : {}) };
        const mob = new Mob(def, world, r.x, r.feetY - def.size[1] - 1e-3, opts);
        if (!collides(mob, world)) this.mobs.push(mob);
      }
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

    // After dark the open surface takes cave mobs too; in daylight nothing
    // hostile spawns out in the open at all, which is what makes a night
    // different from a noon rather than just darker.
    const allowed = underground ? ['underground']
      : (ctx.night ? ['surface', 'underground'] : ['surface']);
    let options = candidatesFor(biomeId, allowed);
    if (!underground && !ctx.night) {
      options = options.filter((m) => m.behavior !== 'hostile' || m.sunProof);
    }
    if (!options.length) return false;

    const def = weightedPick(options);
    if (!def) return false;

    if (!this.placeAt(world, def, x, floorY)) return false;

    // Patrols travel together, sometimes with something big in tow.
    if (def.group && !underground) {
      const extra = def.group[0] - 1 + Math.floor(Math.random() * (def.group[1] - def.group[0] + 1));
      for (let i = 1; i <= extra; i++) {
        const cx = x - dir * i * 2;
        if (cx > 1 && cx < world.width - 2) this.placeAt(world, def, cx, this.pickSurfaceFloor(world, cx));
      }
      const escort = def.escort && MOBS[def.escort.id];
      const ex = x - dir * (extra + 1) * 2;
      if (escort && Math.random() < def.escort.chance && ex > 1 && ex < world.width - 2) {
        this.placeAt(world, escort, ex, this.pickSurfaceFloor(world, ex));
      }
    }
    return true;
  }

  /** Stand `def` on the floor at (x, floorY) if it fits there. */
  placeAt(world, def, x, floorY) {
    if (floorY === null) return null;
    const y = def.aquatic ? this.pickWaterY(world, x, def) : floorY - def.size[1];
    if (y === null) return null;

    const cx = this.centreFor(x, def);
    if (!this.fits(world, cx, y, def)) return null;

    const mob = new Mob(def, world, cx, y);
    if (collides(mob, world)) return null;
    this.mobs.push(mob);
    return mob;
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
      if (world.blocksMobAt(x, y)) return y - def.size[1];
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
      if (world.blocksMobAt(x, y) && world.get(x, y - 1) === AIR && world.get(x, y - 2) === AIR) {
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
    if (!boxFits(world, cx, y, def.size[0], def.size[1])) return false;

    const x0 = Math.floor(cx - def.size[0] / 2 + 1e-6);
    const x1 = Math.floor(cx + def.size[0] / 2 - 1e-6);
    const y1 = Math.floor(y + def.size[1] - 1e-6);
    if (def.aquatic) {
      for (let xx = x0; xx <= x1; xx++) {
        for (let yy = Math.floor(y); yy <= y1; yy++) {
          if (!isLiquid(world.get(xx, yy))) return false;
        }
      }
      return true;
    }
    if (def.flying) return true;

    for (let xx = x0; xx <= x1; xx++) {
      if (world.blocksMobAt(xx, y1 + 1) || (def.floatsOnLava && isLiquid(world.get(xx, y1 + 1)))) return true;
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
