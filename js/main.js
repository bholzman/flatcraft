import {
  FIXED_DT, MAX_FRAME_DT, REACH, CREATIVE_REACH, REALMS, START_REALM, PORTAL_DWELL,
  PORTAL_LINK_RANGE, DAY_LENGTH, START_PHASE, AUTOSAVE_INTERVAL, dayLightAt, phaseName, clockAt,
} from './config.js';
import {
  AIR, CHEST, CRAFTING_TABLE, FURNACE, GRAVEL, OBSIDIAN, NETHER_PORTAL, END_PORTAL,
  CARVED_PUMPKIN, SNOW_BLOCK, IRON_BLOCK, TNT, block, isBreakable, isSolid, dropOf,
} from './blocks.js';
import { ignite, primeTnt, tickFires, tickTnt } from './fire.js';
import { rollLoot } from './loot.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { Inventory } from './inventory.js';
import { HUD } from './hud.js';
import { bakeAll } from './textures.js';
import { BIOMES } from './biomes.js';
import { Entities, Projectile, ballisticVelocity } from './entities.js';
import { PROFESSIONS } from './mobs.js';
import { portalOnSurface } from './worldgen.js';
import { Minimap } from './minimap.js';
import { RECIPES, fuelValue } from './recipes.js';
import { loadSave, writeSave, clearSave, setAsideSave, restoreGame } from './save.js';
import * as I from './items.js';

const PORTAL_IDS = new Set([NETHER_PORTAL, END_PORTAL]);
// Holding any of these keeps piglins friendly.
const GOLD_ITEMS = new Set([I.GOLD_INGOT, I.GOLDEN_SWORD]);

// survival -> creative -> spectator, cycled with G.
export const MODES = ['survival', 'creative', 'spectator'];

class Game {
  constructor(seed = (Math.random() * 0xffffffff) >>> 0) {
    bakeAll();

    this.seed = seed >>> 0;
    this.canvas = document.getElementById('canvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new Input(this.canvas);

    // Realms are generated lazily and then cached, so a round trip through a
    // portal comes back to the world you left, blocks and all.
    this.worlds = {};
    this.realm = START_REALM;
    this.world = this.getWorld(START_REALM);

    this.player = new Player(this.world, this.world.spawnPoint(this.world.spawnX));
    this.player.onLethal = () => this.useTotem();
    this.inventory = new Inventory();
    this.inventory.giveStarter();
    this.mode = 'survival';
    this.entities = new Entities();
    this.minimap = new Minimap(document.getElementById('minimap'));
    this.hud = new HUD(this);

    this.mining = null;          // { x, y, id, progress }
    this.hover = null;           // block cell under the cursor, if in reach
    this.target = null;          // mob under the cursor, if in reach
    this.inspect = null;         // what the cursor is over, for the tooltip
    this.trading = null;         // the villager whose trades are open
    this.structureCursor = new Map();   // realm:id -> which instance to visit next
    this.worldTime = START_PHASE * DAY_LENGTH;   // seconds into the current day
    this.timeFrozen = false;                     // hold the clock where it is
    this.intent = { move: 0, down: false, jumpHeld: false, jumpPressed: false };
    this.placeCooldown = 0;
    this.portalDwell = 0;
    this.travelLock = false;     // stops the arrival portal re-triggering
    this.bowDraw = 0;            // seconds the bow has been held
    this.attackCooldown = 0;
    this.useCooldown = 0;
    this.respawnTimer = 0;
    this.saveTimer = 0;
    this.persist = true;         // false once the save is being thrown away
    this.saveFailed = false;
    this.running = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.fps = 0;

    this.renderer.snapTo(this.player);
    this.frame = this.frame.bind(this);
  }

  /** Save to localStorage, and say so once if the browser won't take it. */
  save() {
    this.saveTimer = 0;
    if (!this.persist) return;
    const ok = writeSave(this);
    if (!ok && !this.saveFailed) this.hud.announce("Couldn't save: browser storage is full or off");
    this.saveFailed = !ok;
  }

  /** 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight. */
  get timeOfDay() { return (this.worldTime / DAY_LENGTH) % 1; }

  /** Sky light, 0 at night to 1 in full day. Other realms are always lit. */
  get dayLight() {
    return this.realm === 'overworld' ? dayLightAt(this.timeOfDay) : 1;
  }

  /** Jump the clock to a phase: 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight. */
  setTimeOfDay(phase) {
    this.worldTime = (((phase % 1) + 1) % 1) * DAY_LENGTH;
    // Resample immediately so the map doesn't lag a quarter second behind.
    this.minimap.timer = 0;
    this.hud.refreshTime(this);
  }

  /** Dark enough for hostile mobs to spawn out in the open. */
  get isNight() { return this.dayLight < 0.25; }

  get creative() { return this.mode === 'creative'; }

  get spectator() { return this.mode === 'spectator'; }

  /** Spectators only look; they don't reach into the world. */
  get canInteract() { return this.mode !== 'spectator'; }

  getWorld(realm) {
    if (!this.worlds[realm]) this.worlds[realm] = new World(realm, this.seed);
    return this.worlds[realm];
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.entities.populate(this.entityContext());
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (!this.running) return;

    const dt = Math.min(MAX_FRAME_DT, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.fps = this.fps * 0.9 + (1 / Math.max(dt, 1e-6)) * 0.1;

    this.handleInput(dt);

    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_INTERVAL) this.save();

    this.renderer.follow(this.player, dt);
    this.renderer.draw(this);
    this.minimap.update(dt, this);
    this.hud.renderMinimapLabel(this);
    this.hud.refreshTime(this);
    this.hud.renderTooltip(this.inspect);
    this.hud.renderHealth(this.player, this.mode === 'survival');
    this.hud.renderAir(this.player, this.mode === 'survival');
    this.hud.renderEffects(this.player);
    this.renderDebug();

    this.input.endFrame();
    requestAnimationFrame(this.frame);
  }

  step(dt) {
    if (!this.timeFrozen) this.worldTime = (this.worldTime + dt) % DAY_LENGTH;
    this.player.update(dt, this.intent);
    this.intent.jumpPressed = false;      // a buffered jump only fires once
    tickFires(this.world, dt);
    tickTnt(this.world, dt, (x, y, power) => this.explode(x, y, power));
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.useCooldown = Math.max(0, this.useCooldown - dt);

    const alive = !this.player.dead;
    this.player.updateVitals(dt, !this.vulnerable);
    // Falls, lava and drowning kill from inside the player's own update.
    if (alive && this.player.dead) this.onPlayerDeath(this.player.deathCause ?? undefined);

    // The void kills in every mode, spectator included.
    if (!this.player.dead && this.world.inVoid(this.player)) {
      this.player.health = 0;
      this.player.dead = true;
      this.onPlayerDeath('Fell into the void');
    }
    this.entities.enabled = this.mode !== 'spectator';
    this.entities.update(dt, this.entityContext());

    // A trade ends if the villager does.
    const v = this.trading;
    if (this.hud.tradeOpen && (!v || v.dead || v.gone)) this.hud.toggleTrade(false);

    if (this.player.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.respawnPlayer();
    }

    this.updatePortals(dt);
  }

  /** Spectators and creative players can't be hurt. */
  get vulnerable() {
    return this.mode === 'survival' && !this.player.dead;
  }

  entityContext() {
    return {
      world: this.world,
      player: this.player,
      mobs: this.entities.mobs,
      playerVulnerable: this.vulnerable,
      night: this.isNight,
      daylight: this.dayLight,
      lookedAt: this.inspect?.mob ?? null,          // an enderman reads this as a stare
      holdingGold: GOLD_ITEMS.has(this.inventory.held.count > 0 ? this.inventory.held.id : AIR),
      playerNoise: this.input.mouse.left || this.input.mouse.right,   // wardens hear digging
      damagePlayer: (amount, fromX, attacker) => this.damagePlayer(amount, fromX, attacker),
      killOrHurt: (mob, amount, fromX, attacker) => this.hitMob(mob, amount, fromX, attacker),
      explode: (x, y, power, source, fiery) => this.explode(x, y, power, source, fiery),
      ignite: (x, y) => ignite(this.world, x, y),
      giveItem: (id, count, message) => {
        this.inventory.add(id, count);
        if (message) this.hud.announce(message);
      },
    };
  }

  damagePlayer(amount, fromX = null, attacker = null) {
    if (!this.vulnerable) return;
    if (!this.player.hurt(amount, fromX)) return;
    if (this.player.dead) this.onPlayerDeath();
    else this.entities.onPlayerHurt(attacker, this.entityContext());
  }

  /**
   * A blast: breaks what it can within `power` blocks, then hurts and shoves
   * everything within twice that, harder the closer it was. Obsidian and
   * anything unbreakable shrug it off, chests keep their loot, and TNT caught
   * in it goes off a moment later. A `fiery` blast (a ghast's) leaves fire.
   */
  explode(x, y, power, source = null, fiery = false) {
    const world = this.world;
    const r = Math.ceil(power);
    for (let dy = -r - 1; dy <= r + 1; dy++) {
      for (let dx = -r - 1; dx <= r + 1; dx++) {
        const cx = Math.floor(x) + dx;
        const cy = Math.floor(y) + dy;
        if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) > power * (0.75 + Math.random() * 0.4)) continue;
        const id = world.get(cx, cy);
        if (id === TNT) { primeTnt(world, cx, cy, 0.4 + Math.random() * 0.8); continue; }
        if (id === AIR || id === CHEST || !isBreakable(id) || block(id).hardness >= 5) continue;
        world.set(cx, cy, AIR);
      }
    }
    if (fiery) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.random() < 0.35) ignite(world, Math.floor(x) + dx, Math.floor(y) + dy);
        }
      }
    }

    const reach = power * 2;
    const p = this.player;
    const dp = Math.hypot(p.x - x, p.centerY - y);
    if (dp < reach && !p.noclip) {
      const f = 1 - dp / reach;
      this.damagePlayer(Math.max(1, Math.round(power * 6 * f * f)), x, source);
      p.vx += (Math.sign(p.x - x) || 1) * 14 * f;
      p.vy = Math.min(p.vy, -10 * f);
    }
    for (const m of [...this.entities.mobs]) {
      if (m.dead || m === source) continue;
      const d = Math.hypot(m.x - x, m.centerY - y);
      if (d >= reach) continue;
      const f = 1 - d / reach;
      this.hitMob(m, Math.max(1, Math.round(power * 6 * f * f)), x, source);
      const k = 1 - (m.def.knockbackResist ?? 0);
      m.vx += (Math.sign(m.x - x) || 1) * 12 * f * k;
      m.vy = Math.min(m.vy, -9 * f * k);
    }
    this.entities.addEffect('explosion', x, y, { r: power });
  }

  /** A totem anywhere in the hotbar is used up to cheat death. */
  useTotem() {
    const slot = this.inventory.slots.find((s) => s.count > 0 && s.id === I.TOTEM_OF_UNDYING);
    if (!slot) return false;
    slot.count -= 1;
    if (slot.count === 0) slot.id = AIR;
    this.inventory.changed();
    this.player.effects = {};
    this.player.applyEffect('regen', 1.5, 10);
    this.player.applyEffect('fireResist', true, 40);
    this.entities.addEffect('totem', this.player.x, this.player.centerY);
    this.hud.announce('Totem of Undying');
    return true;
  }

  handleInput(dt) {
    const input = this.input;

    if (input.consumePress('KeyG')) this.cycleMode();
    if (input.consumePress('F3')) this.hud.toggleDebug();
    if (input.consumePress('KeyM')) this.minimap.toggle();
    // Travel is for exploring, so spectators get it too; the block palette is
    // only useful to someone who can actually place a block.
    if (this.mode !== 'survival' && input.consumePress('KeyB')) this.hud.toggleBiomes();
    if (this.creative && input.consumePress('KeyE')) this.hud.togglePalette();
    if (input.consumePress('KeyI')) this.hud.togglePack();
    if (input.consumePress('KeyC')) this.hud.toggleCrafting();
    if (input.consumePress('Escape')) {
      this.hud.toggleBiomes(false);
      this.hud.togglePalette(false);
      this.hud.togglePack(false);
      this.hud.toggleCrafting(false);
      this.hud.toggleTrade(false);
    }

    // While a creative panel is open the world shouldn't react to input.
    if (this.hud.anyPanelOpen()) {
      this.intent.move = 0;
      this.intent.down = false;
      this.intent.jumpHeld = false;
      this.hover = null;
      this.mining = null;
      this.target = null;
      this.inspect = null;
      this.bowDraw = 0;
      return;
    }

    const move = (input.isDown('KeyD', 'ArrowRight') ? 1 : 0)
      - (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const jumpHeld = input.isDown('Space', 'KeyW', 'ArrowUp');
    const jumpPressed = input.consumePress('Space', 'KeyW', 'ArrowUp');

    this.intent.move = move;
    this.intent.down = input.isDown('KeyS', 'ArrowDown', 'ShiftLeft', 'ShiftRight');
    this.intent.jumpHeld = jumpHeld;
    this.intent.jumpPressed = this.intent.jumpPressed || jumpPressed;

    for (let i = 0; i < 9; i++) {
      if (input.consumePress(`Digit${i + 1}`)) this.inventory.select(i);
    }
    const wheel = input.consumeWheel();
    if (wheel) this.inventory.scroll(wheel);

    this.updateHover();
    this.updateInspect();
    this.updateCombat(dt);
    this.updateMining(dt);
    this.updatePlacing();
  }

  /**
   * What the cursor is pointing at, for the tooltip. Unlike targeting this
   * ignores reach and works in every mode -- it only names things.
   */
  updateInspect() {
    const m = this.input.mouse;
    const w = this.renderer.screenToWorld(m.x, m.y);
    const bx = Math.floor(w.x);
    const by = Math.floor(w.y);

    const mob = this.entities.mobs.find((mo) => !mo.dead
      && w.x > mo.left && w.x < mo.right && w.y > mo.top && w.y < mo.bottom);

    if (!mob && !this.world.inBounds(bx, by)) {
      this.inspect = null;
      return;
    }

    const blockId = this.world.inBounds(bx, by) ? this.world.get(bx, by) : AIR;
    const structure = this.world.structureAt(bx, by);

    // Nothing worth naming: empty sky that isn't part of anything built.
    if (!mob && blockId === AIR && !structure) {
      this.inspect = null;
      return;
    }

    this.inspect = {
      mob, blockId, bx, by, structure,
      data: this.world.dataAt(bx, by),
      screenX: m.x, screenY: m.y,
    };
  }

  /** Left click hits a mob if one is under the cursor; otherwise it mines. */
  updateCombat(dt) {
    if (!this.canInteract) {
      // Note: `inspect` is deliberately left alone. Spectators can't attack,
      // but the tooltip only names things, and naming things is the whole
      // point of spectator mode.
      this.target = null;
      this.bowDraw = 0;
      return;
    }

    this.target = this.mobUnderCursor();
    if (this.input.mouse.left && this.target) {
      this.attack(this.target);
      this.mining = null;
    }

    const held = this.inventory.held;
    const it = held.count > 0 ? I.item(held.id) : null;

    // Holding a bow or a potion replaces block placement on the right button.
    if (it?.kind === 'bow') {
      if (this.input.mouse.right) this.bowDraw += dt;
      else if (this.bowDraw > 0) this.fireArrow();
    } else {
      this.bowDraw = 0;
      if (it?.kind === 'potion' && this.input.mouse.right && this.useCooldown <= 0) {
        this.drinkPotion(held.id);
      }
    }
  }

  // ---- creative ----

  cycleMode() {
    this.setMode(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]);
  }

  setMode(mode) {
    this.mode = mode;
    this.player.flying = mode !== 'survival';
    this.player.noclip = mode === 'spectator';
    this.inventory.infinite = mode === 'creative';

    if (mode === 'survival') this.hud.toggleBiomes(false);
    if (mode !== 'creative') this.hud.togglePalette(false);
    if (mode === 'spectator') this.hud.togglePack(false);
    if (mode === 'spectator') this.hud.toggleTrade(false);

    // Leaving spectator inside solid rock would trap the player.
    if (mode !== 'spectator' && this.player.collides()) {
      this.player.enter(this.world, this.world.viewpointAt(this.player.x));
      this.renderer.snapTo(this.player);
    }

    this.mining = null;
    this.hover = null;
    this.hud.renderMode();
    this.hud.announce(`${mode[0].toUpperCase()}${mode.slice(1)} mode`);
  }

  /**
   * Drop the player into the middle of a named biome's band, switching realm
   * if needed. Cave biomes have no band, so aim at their depth instead and
   * look for an existing opening near the centre of the world.
   */
  jumpToBiome(realm, biomeId) {
    const prevRealm = this.realm;
    const world = this.getWorld(realm);
    if (realm !== this.realm) {
      this.realm = realm;
      this.world = world;
    }

    const bi = BIOMES[biomeId];
    let at;

    if (bi?.underground) {
      const [yMin, yMax] = this.depthRangeOf(world, biomeId);
      at = this.findOpening(world, yMin, yMax, Math.floor(world.width / 2))
        ?? { x: Math.floor(world.width / 2) + 0.5, y: (yMin + yMax) / 2 };
    } else {
      const band = world.bands.find((b) => b.id === biomeId);
      at = world.viewpointAt(band ? band.mid : Math.floor(world.width / 2));
    }

    // Teleporting across the world leaves every existing mob irrelevant, and
    // keeping them would use up the population cap before the new biome fills.
    this.entities.clear();
    this.player.enter(world, at);
    this.renderer.snapTo(this.player);
    this.entities.populate(this.entityContext());
    this.travelLock = true;
    this.mining = null;
    this.hud.announce(bi?.name ?? biomeId);
  }

  /**
   * Every structure in every realm, grouped by kind. Generating the other
   * realms here is what makes their structures listable before you've been to
   * them; it costs one pass and only happens when the panel is opened.
   */
  structureGroups() {
    return Object.keys(REALMS).map((realm) => {
      const world = this.getWorld(realm);
      const groups = new Map();

      for (const s of world.structures) {
        if (!groups.has(s.id)) groups.set(s.id, { id: s.id, name: s.name, count: 0 });
        groups.get(s.id).count += 1;
      }
      return { realm, groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)) };
    }).filter((r) => r.groups.length);
  }

  /**
   * Travel to a structure of the given kind. Repeated calls walk through every
   * instance of it in turn, so a kind with seven dungeons is all reachable
   * from one chip.
   */
  jumpToStructure(realm, structureId) {
    const world = this.getWorld(realm);
    const all = world.structures
      .filter((s) => s.id === structureId)
      .sort((a, b) => a.x - b.x);
    if (!all.length) return;

    const key = `${realm}:${structureId}`;
    const next = ((this.structureCursor.get(key) ?? -1) + 1) % all.length;
    this.structureCursor.set(key, next);
    const target = all[next];

    if (realm !== this.realm) {
      this.realm = realm;
      this.world = world;
    }
    this.entities.clear();

    // A structure can be solid through -- buried treasure is a chest inside a
    // block of sand -- so fall back to standing on the surface above it, which
    // is where you'd start digging from anyway.
    const cx = Math.round((target.x0 + target.x1) / 2);
    const at = world.findClearSpot(target.x0, target.x1, target.y0, target.y1)
      ?? world.viewpointAt(cx);

    this.player.enter(world, at);
    this.renderer.snapTo(this.player);
    this.entities.populate(this.entityContext());
    this.travelLock = true;
    this.mining = null;
    this.hud.announce(all.length > 1
      ? `${target.name} (${next + 1} of ${all.length})`
      : target.name);
  }

  depthRangeOf(world, biomeId) {
    const h = world.height;
    if (biomeId === 'caves') return [world.spec.surfaceLevel + 12, h * 0.55];
    if (biomeId === 'lush_caves') return [h * 0.55, h * 0.74];
    return [h * 0.74, h - 6];
  }

  /** Nearest air cell in a depth window with solid ground under it. */
  findOpening(world, yMin, yMax, nearX) {
    for (let d = 0; d < world.width / 2; d++) {
      for (const x of d === 0 ? [nearX] : [nearX - d, nearX + d]) {
        if (x < 1 || x >= world.width - 1) continue;
        for (let y = Math.ceil(yMin) + 2; y < Math.floor(yMax); y++) {
          if (world.get(x, y) !== AIR || world.get(x, y - 1) !== AIR) continue;
          if (!world.blocksMovementAt(x, y + 1)) continue;
          return { x: x + 0.5, y: y - 1 };
        }
      }
    }
    return null;
  }

  // ---- realms ----

  /** Standing in a portal for PORTAL_DWELL seconds travels to its destination. */
  updatePortals(dt) {
    const inPortal = [...this.player.occupied()].find((id) => PORTAL_IDS.has(id));

    if (!inPortal) {
      this.portalDwell = 0;
      this.travelLock = false;
      return;
    }
    if (this.travelLock) return;

    this.portalDwell += dt;
    if (this.portalDwell < PORTAL_DWELL) return;

    const target = inPortal === NETHER_PORTAL
      ? (this.realm === 'nether' ? 'overworld' : 'nether')
      : (this.realm === 'end' ? 'overworld' : 'end');

    this.travelTo(target, this.player.x);
  }

  travelTo(realm, fromX = null) {
    if (!REALMS[realm]) return;

    const from = this.world;
    const cameFrom = this.realm;
    const world = this.getWorld(realm);

    // Map the crossing point into the destination's coordinates, so a portal
    // you built somewhere specific lands you somewhere corresponding.
    const mapped = fromX === null
      ? world.spawnX
      : Math.round(fromX * (world.width / from.width));

    // Which portal did the player step into? If it already has a counterpart,
    // go straight there -- otherwise a round trip drifts a little each way and
    // eventually strands a second portal beside the first.
    const source = fromX === null ? null : this.nearestPortalTo(from, fromX);
    let portal = source?.link && world.portals.includes(source.link)
      ? source.link
      : this.nearestPortal(world, cameFrom, mapped);

    // Nothing to arrive at nearby? Build the matching portal, the way
    // Minecraft carves one out for you on the far side.
    if (realm !== 'end' && cameFrom !== 'end'
        && (!portal || Math.abs(portal.x - mapped) > PORTAL_LINK_RANGE)) {
      portal = this.buildLinkedPortal(world, mapped, cameFrom);
    }

    // Pair them so the journey back lands where it started.
    if (source && portal) {
      source.link = portal;
      portal.link = source;
    }

    this.realm = realm;
    this.world = world;

    const at = portal
      ? { x: portal.x, y: portal.y - 1 }
      : world.spawnPoint(world.spawnX);

    this.entities.onRealmChange();
    this.player.enter(world, at);
    this.renderer.snapTo(this.player);
    this.entities.populate(this.entityContext());
    this.portalDwell = 0;
    this.travelLock = true;
    this.mining = null;
    this.hud.announce(`Entered ${realm === 'end' ? 'The End' : realm[0].toUpperCase() + realm.slice(1)}`);
  }

  // ---- crafting ----

  /**
   * Which crafting stations are in reach. A 2x2 recipe needs nothing; a 3x3
   * needs a crafting table; smelting needs a furnace, as in Minecraft.
   */
  stationsNearby() {
    const reach = 4;
    const p = this.player;
    const found = { table: false, furnace: null };

    for (let y = Math.floor(p.y - reach); y <= Math.floor(p.y + p.h + reach); y++) {
      for (let x = Math.floor(p.x - reach); x <= Math.floor(p.x + reach); x++) {
        const id = this.world.get(x, y);
        if (id === CRAFTING_TABLE) found.table = true;
        else if (id === FURNACE && !found.furnace) found.furnace = { x, y };
      }
    }
    return found;
  }

  /** Everything blocking a recipe right now, or an empty list if it's ready. */
  recipeBlockers(recipe, stations = this.stationsNearby()) {
    const out = [];
    if (recipe.station === 'furnace' && !stations.furnace) out.push('needs a furnace');
    if (recipe.grid === 3 && !stations.table && recipe.station !== 'furnace') {
      out.push('needs a crafting table');
    }
    if (!this.creative) {
      for (const ing of recipe.in) {
        if (this.inventory.total(ing.id) < ing.count) {
          out.push('missing materials');
          break;
        }
      }
    }
    if (recipe.station === 'furnace' && stations.furnace && !this.furnaceHasFuel(stations.furnace)) {
      out.push('needs fuel');
    }
    if (!this.inventory.fits(recipe.out.id, recipe.out.count)) out.push('inventory full');
    return out;
  }

  canCraft(recipe, stations) {
    return this.recipeBlockers(recipe, stations).length === 0;
  }

  /** A furnace keeps a burn buffer, topped up from fuel in the inventory. */
  furnaceData(at) {
    let data = this.world.dataAt(at.x, at.y);
    if (!data || data.kind !== 'furnace') {
      data = { kind: 'furnace', fuel: 0 };
      this.world.setData(at.x, at.y, data);
    }
    return data;
  }

  furnaceHasFuel(at) {
    if (this.creative) return true;
    if (this.furnaceData(at).fuel >= 1) return true;
    return this.inventory.everySlot.some((s) => s.count > 0 && fuelValue(s.id) > 0);
  }

  /** Burn one unit, lighting a fresh piece of fuel if the buffer has run out. */
  consumeFuel(at) {
    if (this.creative) return true;
    const data = this.furnaceData(at);

    if (data.fuel < 1) {
      const slot = this.inventory.everySlot
        .filter((s) => s.count > 0 && fuelValue(s.id) > 0)
        .sort((a, b) => fuelValue(a.id) - fuelValue(b.id))[0];   // cheapest first
      if (!slot) return false;
      data.fuel += fuelValue(slot.id);
      this.inventory.remove(slot.id, 1);
    }
    data.fuel -= 1;
    return true;
  }

  /** Craft `times` batches, stopping as soon as one can't be made. */
  craft(recipe, times = 1) {
    const stations = this.stationsNearby();
    let made = 0;

    for (let i = 0; i < times; i++) {
      if (!this.canCraft(recipe, stations)) break;
      if (recipe.station === 'furnace' && !this.consumeFuel(stations.furnace)) break;

      if (!this.creative) {
        for (const ing of recipe.in) this.inventory.remove(ing.id, ing.count);
      }
      this.inventory.add(recipe.out.id, recipe.out.count);
      made++;
    }

    if (made > 0) {
      this.hud.announce(`${I.nameOf(recipe.out.id)} x${made * recipe.out.count}`);
      this.hud.refreshCrafting(this);
    }
    return made;
  }

  // ---- combat ----

  /** The mob under the cursor, if any is in reach. */
  mobUnderCursor() {
    const m = this.input.mouse;
    const w = this.renderer.screenToWorld(m.x, m.y);
    const reach = this.creative ? CREATIVE_REACH : REACH;

    let best = null;
    let bestDist = Infinity;
    for (const mob of this.entities.mobs) {
      if (mob.dead) continue;
      if (w.x < mob.left || w.x > mob.right || w.y < mob.top || w.y > mob.bottom) continue;
      const d = Math.hypot(mob.x - this.player.x, mob.centerY - this.player.centerY);
      if (d <= reach && d < bestDist) { best = mob; bestDist = d; }
    }
    return best;
  }

  /** Damage dealt by the held item, plus any strength effect. */
  get attackDamage() {
    const held = this.inventory.held;
    const it = I.item(held.count > 0 ? held.id : -1);
    const base = it?.kind === 'sword' ? it.damage : 1;
    return base + (this.player.effect('strength') ?? 0);
  }

  /** Hit a mob; `attacker` is the player or another mob. Only the player's kills drop loot. */
  hitMob(mob, amount, fromX, attacker = this.player) {
    const killed = this.entities.hurtMob(mob, amount, fromX, attacker, this.entityContext());
    if (!killed || attacker !== this.player) return;
    // Drops go straight to the inventory; there are no ground items yet.
    for (const d of mob.rollDrops()) this.inventory.add(d.id, d.count);
  }

  attack(mob) {
    if (this.attackCooldown > 0) return;
    this.attackCooldown = 0.45;
    this.hitMob(mob, this.attackDamage, this.player.x);
  }

  /**
   * Right-click on a mob: trade with a villager, tame a wolf with a bone,
   * barter gold with a piglin, or light a creeper. False if nothing applies,
   * so the click falls through to placing a block.
   */
  interactMob(mob) {
    const def = mob.def;
    const held = this.inventory.held;
    const id = held.count > 0 ? held.id : AIR;

    if (def.trades && mob.profession) {
      const offers = PROFESSIONS[mob.profession].trades
        .filter((o) => o.get.id !== undefined && o.give.every((g) => g.id !== undefined));
      this.trading = mob;
      this.hud.openTrade(mob.name, offers, (o) => this.trade(o));
      return true;
    }
    if (def.tameWith && id === def.tameWith && !mob.owner && mob.anger !== this.player) {
      this.inventory.remove(id, 1);
      if (Math.random() < 1 / 3) {
        this.entities.tame(mob, this.player);
        this.hud.announce(`Tamed the ${mob.name.toLowerCase()}`);
      } else {
        this.entities.addEffect('smoke', mob.x, mob.y);
      }
      return true;
    }
    if (def.barters && id === I.GOLD_INGOT && mob.barter <= 0 && mob.anger !== this.player) {
      this.inventory.remove(id, 1);
      mob.barter = 3;
      mob.target = null;
      return true;
    }
    if (def.fuse && I.item(id)?.kind === 'igniter') {
      mob.ignited = true;
      return true;
    }
    return false;
  }

  trade(offer) {
    const inv = this.inventory;
    if (!inv.infinite && offer.give.some((g) => inv.total(g.id) < g.count)) return;
    if (inv.roomFor(offer.get.id) < offer.get.count) return;
    for (const g of offer.give) inv.remove(g.id, g.count);
    inv.add(offer.get.id, offer.get.count);
  }

  /**
   * A carved pumpkin set on the right blocks wakes up: two snow blocks make a
   * snow golem, a T of four iron blocks an iron golem.
   */
  tryBuildGolem(x, y) {
    const w = this.world;
    const at = (dx, dy) => w.get(x + dx, y + dy);
    let kind = null;
    let cells = null;
    if (at(0, 1) === SNOW_BLOCK && at(0, 2) === SNOW_BLOCK) {
      kind = 'snow_golem';
      cells = [[0, 0], [0, 1], [0, 2]];
    } else if (at(0, 1) === IRON_BLOCK && at(0, 2) === IRON_BLOCK
        && at(-1, 1) === IRON_BLOCK && at(1, 1) === IRON_BLOCK) {
      kind = 'iron_golem';
      cells = [[0, 0], [0, 1], [0, 2], [-1, 1], [1, 1]];
    }
    if (!kind) return;

    for (const [dx, dy] of cells) w.set(x + dx, y + dy, AIR);
    const golem = this.entities.spawn(w, kind, x + 0.5, 0, { playerBuilt: true });
    golem.y = y + 3 - golem.h - 1e-3;
    this.entities.addEffect('sparkle', golem.x, golem.centerY, { colour: '#ffffff' });
    this.hud.announce(`${golem.name} built`);
  }

  /** Release a drawn bow toward the cursor. */
  fireArrow() {
    const power = Math.min(1, this.bowDraw / (I.item(I.BOW).drawTime));
    this.bowDraw = 0;
    if (power < 0.25) return;
    if (!this.creative && !this.inventory.remove(I.ARROW, 1)) return;

    const m = this.input.mouse;
    const w = this.renderer.screenToWorld(m.x, m.y);
    const speed = 16 + power * 24;
    const { vx, vy } = ballisticVelocity(
      w.x - this.player.x, w.y - this.player.centerY, speed, 16);

    this.entities.projectiles.push(new Projectile(
      'arrow', this.world, this.player.x, this.player.centerY, vx, vy,
      { damage: Math.max(1, Math.round(I.item(I.BOW).damage * power)), fromPlayer: true }));
  }

  drinkPotion(id) {
    const it = I.item(id);
    if (!it || it.kind !== 'potion') return;

    if (it.splash) {
      // Splash potions get thrown at the cursor rather than drunk.
      const m = this.input.mouse;
      const w = this.renderer.screenToWorld(m.x, m.y);
      const dx = w.x - this.player.x;
      const dy = w.y - this.player.centerY;
      const { vx, vy } = ballisticVelocity(dx, dy, 15, 22);
      this.entities.projectiles.push(new Projectile(
        'potion', this.world, this.player.x, this.player.centerY, vx, vy,
        { damage: it.effect.damage ?? 6, fromPlayer: true }));
    } else {
      const e = it.effect;
      if (e.heal) this.player.heal(e.heal);
      if (e.regen) this.player.applyEffect('regen', e.regen, e.duration);
      if (e.strength) this.player.applyEffect('strength', e.strength, e.duration);
      if (e.speed) this.player.applyEffect('speed', e.speed, e.duration);
      if (e.fireResist) this.player.applyEffect('fireResist', true, e.duration);
    }

    if (!this.creative) this.inventory.remove(id, 1);
    this.useCooldown = 0.6;
    this.hud.announce(it.name);
  }

  onPlayerDeath(message = 'You died') {
    this.respawnTimer = 2.2;
    this.entities.projectiles.length = 0;
    this.hud.announce(message);
  }

  respawnPlayer() {
    if (this.realm !== START_REALM) {
      this.realm = START_REALM;
      this.world = this.getWorld(START_REALM);
      this.entities.onRealmChange();
    }
    this.player.respawn(this.world, this.world.spawnPoint(this.world.spawnX));
    this.renderer.snapTo(this.player);
    this.travelLock = true;
    this.hud.announce('Respawned');
  }

  /** The nearest portal in `world` to `x`, whatever it leads to. */
  nearestPortalTo(world, x) {
    let best = null;
    for (const p of world.portals) {
      if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    }
    return best && Math.abs(best.x - x) < 4 ? best : null;
  }

  /** The portal in `world` leading back to `cameFrom`, nearest to `x`. */
  nearestPortal(world, cameFrom, x) {
    let best = null;
    for (const p of world.portals) {
      if (p.to !== cameFrom) continue;
      if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    }
    return best;
  }

  buildLinkedPortal(world, nearX, backTo) {
    const x = portalOnSurface(world, nearX, OBSIDIAN, NETHER_PORTAL, backTo);
    // portalOnSurface writes with put(), which skips the surface bookkeeping.
    for (let dx = -2; dx <= 3; dx++) world.recalcSurface(x + dx);
    return world.portals[world.portals.length - 1] ?? null;
  }

  // ---- interaction ----

  updateHover() {
    if (!this.canInteract) {
      this.hover = null;
      return;
    }

    const m = this.input.mouse;
    const w = this.renderer.screenToWorld(m.x, m.y);
    const bx = Math.floor(w.x);
    const by = Math.floor(w.y);

    const dx = bx + 0.5 - this.player.x;
    const dy = by + 0.5 - (this.player.y + this.player.h / 2);
    const inReach = Math.hypot(dx, dy) <= (this.creative ? CREATIVE_REACH : REACH);

    this.hover = inReach && this.world.inBounds(bx, by) ? { x: bx, y: by } : null;
  }

  updateMining(dt) {
    const target = this.hover;

    if (this.target) { this.mining = null; return; }
    if (!this.input.mouse.left || !target) {
      this.mining = null;
      return;
    }

    const id = this.world.get(target.x, target.y);
    if (!isBreakable(id)) {
      this.mining = null;
      return;
    }

    // Restart progress whenever the cursor moves to a different block.
    if (!this.mining || this.mining.x !== target.x || this.mining.y !== target.y || this.mining.id !== id) {
      this.mining = { x: target.x, y: target.y, id, progress: 0 };
    }

    this.mining.progress += this.creative ? 1 : dt / block(id).hardness;

    if (this.mining.progress >= 1) {
      this.world.set(target.x, target.y, AIR);
      // Gravel sometimes yields flint, so flint and steel stays renewable.
      const drop = id === GRAVEL && Math.random() < 0.15 ? I.FLINT : dropOf(id);
      this.inventory.add(drop, 1);
      this.mining = null;
    }
  }

  updatePlacing() {
    if (!this.canInteract) return;
    if (!this.input.mouse.right || this.placeCooldown > 0) return;

    const mob = this.mobUnderCursor();
    if (mob && this.interactMob(mob)) {
      this.placeCooldown = 0.35;
      return;
    }
    if (!this.hover) return;

    const { x, y } = this.hover;

    // Opening a chest takes priority over placing anything into its cell.
    if (this.openChest(x, y)) return;

    const held = this.inventory.held;
    if (held.count > 0 && I.item(held.id)?.kind === 'igniter') {
      if (!this.lightPortal(x, y)) this.useFlintAndSteel(x, y);
      return;
    }

    // Swords, bows and potions are used, not placed.
    if (held.count > 0 && I.isItem(held.id)) return;

    if (!this.world.isReplaceable(x, y)) return;
    if (this.player.overlapsCell(x, y)) return;

    // Survival needs something to build off of; creative can place in mid-air.
    if (!this.creative) {
      const touching = isSolid(this.world.get(x + 1, y)) || isSolid(this.world.get(x - 1, y))
        || isSolid(this.world.get(x, y + 1)) || isSolid(this.world.get(x, y - 1));
      if (!touching) return;
    }

    const id = this.inventory.takeSelected();
    if (id === AIR) return;

    this.world.set(x, y, id);
    this.placeCooldown = this.creative ? 0.08 : 0.15;
    if (id === CARVED_PUMPKIN) this.tryBuildGolem(x, y);
  }

  /**
   * Flint and steel on anything but a portal frame: light TNT, or set fire to
   * the clicked cell -- or, if that's a solid block, to the air on top of it.
   */
  useFlintAndSteel(x, y) {
    const w = this.world;
    const id = w.get(x, y);
    if (id === TNT) {
      primeTnt(w, x, y);
    } else if (!ignite(w, x, y) && isSolid(id)) {
      ignite(w, x, y - 1);
    }
    this.placeCooldown = 0.3;
  }

  /**
   * Light an obsidian frame around (x, y), the way flint and steel does.
   * The clicked cell has to sit inside a rectangle of air completely ringed
   * by obsidian, at least 2 wide and 3 tall.
   */
  lightPortal(x, y) {
    const w = this.world;
    if (w.get(x, y) !== AIR) return false;

    // Grow to the extent of the open space through the clicked cell. Bounded
    // in every direction: above the world every cell reads as air, so an
    // unbounded upward walk never terminates.
    const MAX = 22;
    let x0 = x;
    let x1 = x;
    let y0 = y;
    let y1 = y;
    while (x - x0 < MAX && w.get(x0 - 1, y) === AIR) x0--;
    while (x1 - x < MAX && w.get(x1 + 1, y) === AIR) x1++;
    while (y - y0 < MAX && y0 > 0 && w.get(x, y0 - 1) === AIR) y0--;
    while (y1 - y < MAX && w.get(x, y1 + 1) === AIR) y1++;

    const width = x1 - x0 + 1;
    const height = y1 - y0 + 1;
    if (width < 2 || height < 3 || width > 21 || height > 21) return false;

    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        if (w.get(xx, yy) !== AIR) return false;          // not a clean rectangle
      }
    }
    for (let xx = x0; xx <= x1; xx++) {
      if (w.get(xx, y0 - 1) !== OBSIDIAN || w.get(xx, y1 + 1) !== OBSIDIAN) return false;
    }
    for (let yy = y0; yy <= y1; yy++) {
      if (w.get(x0 - 1, yy) !== OBSIDIAN || w.get(x1 + 1, yy) !== OBSIDIAN) return false;
    }

    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) w.set(xx, yy, NETHER_PORTAL);
    }
    w.portals.push({
      x: (x0 + x1) / 2 + 0.5,
      y: y1 - 1,
      to: this.realm === 'nether' ? 'overworld' : 'nether',
      built: true,
    });

    this.placeCooldown = 0.4;
    this.hud.announce('Portal lit');
    return true;
  }

  /**
   * Chests roll their loot table the first time they're opened, then stay open.
   * Anything that doesn't fit is left in the chest to collect later.
   */
  openChest(x, y) {
    if (this.world.get(x, y) !== CHEST) return false;

    const data = this.world.dataAt(x, y);
    if (!data || data.kind !== 'chest') return false;

    if (!data.opened) {
      data.items = rollLoot(data.table);
      data.opened = true;
    }

    // Take whatever fits of each stack; a partial stack stays in the chest.
    const left = [];
    const took = new Map();       // id -> count, merged across loot rolls
    for (const it of data.items) {
      const n = Math.min(it.count, this.inventory.roomFor(it.id));
      if (n > 0) {
        this.inventory.add(it.id, n);
        took.set(it.id, (took.get(it.id) ?? 0) + n);
      }
      if (n < it.count) left.push({ id: it.id, count: it.count - n });
    }
    data.items = left;
    this.placeCooldown = 0.3;

    if (took.size > 0) {
      const items = [...took].map(([id, count]) => ({ id, count }));
      this.hud.showLoot(items, left.length ? 'Inventory full — chest still has items' : '');
    } else {
      this.hud.announce(left.length ? 'Inventory full' : 'Empty chest');
    }
    return true;
  }

  nearestStructure() {
    let best = null;
    let bestD = Infinity;
    for (const s of this.world.structures) {
      const d = Math.abs(s.x - this.player.x);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best ? `${best.name} ${Math.round(bestD)} blocks ${best.x < this.player.x ? 'west' : 'east'}` : '-';
  }

  renderDebug() {
    if (!this.hud.showDebug) return;
    const p = this.player;
    const hoverId = this.hover ? this.world.get(this.hover.x, this.hover.y) : AIR;
    const biome = this.world.biomeAt(p.x, p.y + p.h / 2);

    this.hud.renderDebug([
      `fps      ${this.fps.toFixed(0)}`,
      `realm    ${this.realm}  [${this.mode}]`,
      `biome    ${biome.name}`,
      `time     ${phaseName(this.timeOfDay)} ${clockAt(this.timeOfDay).toFixed(1)}h, light ${this.dayLight.toFixed(2)}`,
      `pos      ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`,
      `depth    ${(p.y - this.world.ground[Math.max(0, Math.min(this.world.width - 1, p.x | 0))]).toFixed(0)}`,
      `ground   ${p.onGround}${p.inLiquid ? ' (in liquid)' : ''}`,
      `hover    ${this.hover ? `${this.hover.x},${this.hover.y} ${block(hoverId).name}` : '-'}`,
      `health   ${this.player.health.toFixed(0)}/${this.player.maxHealth}`,
      `mobs     ${this.entities.mobs.length}  proj ${this.entities.projectiles.length}`,
      `target   ${this.target ? this.target.def.name : '-'}`,
      `holding  ${this.inventory.describeSelected()}`,
      `nearest  ${this.nearestStructure()}`,
      `seed     ${this.seed}`,
    ]);
  }
}

// ---- bootstrap ----

// A saved game regenerates from its seed and then has its changes put back.
// A save that won't restore is set aside, and the page starts over without it.
const saved = loadSave();
const game = new Game(saved?.seed);
if (saved) {
  try {
    restoreGame(game, saved);
  } catch (err) {
    console.error('Flatcraft: could not restore the saved game', err);
    game.persist = false;
    setAsideSave();
    location.reload();
  }
}

// Save on the way out as well as on the timer.
const saveNow = () => { if (game.running) game.save(); };
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const newWorldButton = document.getElementById('new-world');
overlay.classList.remove('hidden');
if (saved) {
  startButton.textContent = 'Continue';
  newWorldButton.classList.remove('hidden');
}
document.getElementById('save-note').textContent = saved
  ? `Continuing world ${game.seed}, saved in this browser.`
  : 'Your world saves automatically in this browser.';

startButton.addEventListener('click', () => {
  overlay.classList.add('hidden');
  game.start();
  game.canvas.focus();
});

// Starting over erases the save, so it takes a second click.
let confirmNewWorld = null;
newWorldButton.addEventListener('click', () => {
  if (!confirmNewWorld) {
    newWorldButton.textContent = 'Click again to erase this world';
    confirmNewWorld = setTimeout(() => {
      confirmNewWorld = null;
      newWorldButton.textContent = 'New world';
    }, 3000);
    return;
  }
  game.persist = false;
  clearSave();
  location.reload();
});

window.game = game;   // handy for poking at things from the console
