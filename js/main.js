import {
  FIXED_DT, MAX_FRAME_DT, REACH, CREATIVE_REACH, REALMS, START_REALM, PORTAL_DWELL,
} from './config.js';
import { AIR, NETHER_PORTAL, END_PORTAL, block, isBreakable, isSolid, dropOf } from './blocks.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { Inventory } from './inventory.js';
import { HUD } from './hud.js';
import { bakeAll } from './textures.js';
import { BIOMES } from './biomes.js';

const PORTAL_IDS = new Set([NETHER_PORTAL, END_PORTAL]);

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
    this.inventory = new Inventory();
    this.inventory.giveStarter();
    this.mode = 'survival';
    this.hud = new HUD(this);

    this.mining = null;          // { x, y, id, progress }
    this.hover = null;           // block cell under the cursor, if in reach
    this.intent = { move: 0, down: false, jumpHeld: false, jumpPressed: false };
    this.placeCooldown = 0;
    this.portalDwell = 0;
    this.travelLock = false;     // stops the arrival portal re-triggering
    this.running = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.fps = 0;

    this.renderer.snapTo(this.player);
    this.frame = this.frame.bind(this);
  }

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

    this.renderer.follow(this.player, dt);
    this.renderer.draw(this);
    this.renderDebug();

    this.input.endFrame();
    requestAnimationFrame(this.frame);
  }

  step(dt) {
    this.player.update(dt, this.intent);
    this.intent.jumpPressed = false;      // a buffered jump only fires once
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.updatePortals(dt);
  }

  handleInput(dt) {
    const input = this.input;

    if (input.consumePress('KeyG')) this.cycleMode();
    if (input.consumePress('F3')) this.hud.toggleDebug();
    // Travel is for exploring, so spectators get it too; the block palette is
    // only useful to someone who can actually place a block.
    if (this.mode !== 'survival' && input.consumePress('KeyB')) this.hud.toggleBiomes();
    if (this.creative && input.consumePress('KeyE')) this.hud.togglePalette();
    if (input.consumePress('Escape')) {
      this.hud.toggleBiomes(false);
      this.hud.togglePalette(false);
    }

    // While a creative panel is open the world shouldn't react to input.
    if (this.hud.anyPanelOpen()) {
      this.intent.move = 0;
      this.intent.down = false;
      this.intent.jumpHeld = false;
      this.hover = null;
      this.mining = null;
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
    this.updateMining(dt);
    this.updatePlacing();
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

    this.player.enter(world, at);
    this.renderer.snapTo(this.player);
    this.travelLock = true;
    this.mining = null;
    this.hud.announce(bi?.name ?? biomeId);
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
          if (!isSolid(world.get(x, y + 1))) continue;
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

    this.travelTo(target);
  }

  travelTo(realm) {
    if (!REALMS[realm]) return;

    const world = this.getWorld(realm);
    this.realm = realm;
    this.world = world;

    // Arrive at that realm's own portal if it has one, else at its spawn.
    const portal = world.portals.find((p) => p.to !== realm) ?? null;
    const at = portal
      ? { x: portal.x, y: portal.y - 1 }
      : world.spawnPoint(world.spawnX);

    this.player.enter(world, at);
    this.renderer.snapTo(this.player);
    this.portalDwell = 0;
    this.travelLock = true;
    this.mining = null;
    this.hud.announce(`Entered ${realm === 'end' ? 'The End' : realm[0].toUpperCase() + realm.slice(1)}`);
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
      this.inventory.add(dropOf(id), 1);
      this.mining = null;
    }
  }

  updatePlacing() {
    if (!this.canInteract) return;
    if (!this.input.mouse.right || !this.hover || this.placeCooldown > 0) return;

    const { x, y } = this.hover;
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
      `pos      ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`,
      `depth    ${(p.y - this.world.ground[Math.max(0, Math.min(this.world.width - 1, p.x | 0))]).toFixed(0)}`,
      `ground   ${p.onGround}${p.inLiquid ? ' (in liquid)' : ''}`,
      `hover    ${this.hover ? `${this.hover.x},${this.hover.y} ${block(hoverId).name}` : '-'}`,
      `holding  ${this.inventory.describeSelected()}`,
      `seed     ${this.seed}`,
    ]);
  }
}

// ---- bootstrap ----

const game = new Game(0xf1a7c2a7);
const overlay = document.getElementById('overlay');
overlay.classList.remove('hidden');

document.getElementById('start').addEventListener('click', () => {
  overlay.classList.add('hidden');
  game.start();
  game.canvas.focus();
});

window.game = game;   // handy for poking at things from the console
