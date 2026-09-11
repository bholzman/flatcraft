import { FIXED_DT, MAX_FRAME_DT, REACH } from './config.js';
import { AIR, WATER, block, isBreakable, isSolid, dropOf } from './blocks.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { Inventory } from './inventory.js';
import { HUD } from './hud.js';
import { bakeAll } from './textures.js';

class Game {
  constructor() {
    bakeAll();

    this.canvas = document.getElementById('canvas');
    this.renderer = new Renderer(this.canvas);
    this.input = new Input(this.canvas);

    this.world = new World(0xf1a7c2a7);
    this.player = new Player(this.world, this.world.spawnPoint());
    this.inventory = new Inventory();
    this.inventory.giveStarter();
    this.hud = new HUD(this.inventory);

    this.mining = null;          // { x, y, id, progress }
    this.hover = null;           // block cell under the cursor, if in reach
    this.placeCooldown = 0;
    this.running = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.fps = 0;

    // Snap the camera to the player before the first frame.
    this.renderer.follow(this.player, this.world, 10);

    this.frame = this.frame.bind(this);
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

    this.renderer.follow(this.player, this.world, dt);
    this.renderer.draw(this);
    this.renderDebug();

    this.input.endFrame();
    requestAnimationFrame(this.frame);
  }

  step(dt) {
    this.player.update(dt, this.intent);
    this.intent.jumpPressed = false;      // a buffered jump only fires once
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
  }

  handleInput(dt) {
    const input = this.input;

    const move = (input.isDown('KeyD', 'ArrowRight') ? 1 : 0)
      - (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const jumpHeld = input.isDown('Space', 'KeyW', 'ArrowUp');
    const jumpPressed = input.consumePress('Space', 'KeyW', 'ArrowUp');

    this.intent = { move, jumpHeld, jumpPressed: jumpPressed || this.intent?.jumpPressed };

    // Hotbar selection.
    for (let i = 0; i < 9; i++) {
      if (input.consumePress(`Digit${i + 1}`)) this.inventory.select(i);
    }
    const wheel = input.consumeWheel();
    if (wheel) this.inventory.scroll(wheel);

    if (input.consumePress('F3')) this.hud.toggleDebug();

    this.updateHover();
    this.updateMining(dt);
    this.updatePlacing();
  }

  updateHover() {
    const m = this.input.mouse;
    const w = this.renderer.screenToWorld(m.x, m.y);
    const bx = Math.floor(w.x);
    const by = Math.floor(w.y);

    const dx = bx + 0.5 - this.player.x;
    const dy = by + 0.5 - (this.player.y + this.player.h / 2);
    const inReach = Math.hypot(dx, dy) <= REACH;

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

    this.mining.progress += dt / block(id).hardness;

    if (this.mining.progress >= 1) {
      this.world.set(target.x, target.y, AIR);
      this.inventory.add(dropOf(id), 1);
      this.mining = null;
    }
  }

  updatePlacing() {
    if (!this.input.mouse.right || !this.hover || this.placeCooldown > 0) return;

    const { x, y } = this.hover;
    const existing = this.world.get(x, y);
    if (existing !== AIR && existing !== WATER) return;
    if (this.player.overlapsCell(x, y)) return;

    // Require an adjacent block to build off of, like the real thing.
    const touching = isSolid(this.world.get(x + 1, y)) || isSolid(this.world.get(x - 1, y))
      || isSolid(this.world.get(x, y + 1)) || isSolid(this.world.get(x, y - 1));
    if (!touching) return;

    const id = this.inventory.takeSelected();
    if (id === AIR) return;

    this.world.set(x, y, id);
    this.placeCooldown = 0.15;
  }

  renderDebug() {
    if (!this.hud.showDebug) return;
    const p = this.player;
    const hoverId = this.hover ? this.world.get(this.hover.x, this.hover.y) : AIR;

    this.hud.renderDebug([
      `fps      ${this.fps.toFixed(0)}`,
      `pos      ${p.x.toFixed(2)}, ${p.y.toFixed(2)}`,
      `vel      ${p.vx.toFixed(2)}, ${p.vy.toFixed(2)}`,
      `ground   ${p.onGround}`,
      `hover    ${this.hover ? `${this.hover.x},${this.hover.y} ${block(hoverId).name}` : '-'}`,
      `holding  ${this.inventory.describeSelected()}`,
      `seed     ${this.world.seed}`,
    ]);
  }
}

// ---- bootstrap ----

const game = new Game();
const overlay = document.getElementById('overlay');
overlay.classList.remove('hidden');

document.getElementById('start').addEventListener('click', () => {
  overlay.classList.add('hidden');
  game.start();
  game.canvas.focus();
});

window.game = game;   // handy for poking at things from the console
