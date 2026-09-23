import { BLOCKS, AIR, isLiquid } from './blocks.js';
import { BIOMES } from './biomes.js';

// Corner overlay showing the world around the player. Terrain is sampled on a
// coarse grid rather than drawn per block -- at 4096 wide a full-fidelity map
// would cost more than the game itself.

const WIDTH = 240;          // css pixels
const HEIGHT = 136;
const SPAN_X = 200;         // blocks of world covered horizontally
const SPAN_Y = 112;
const REFRESH = 0.25;       // seconds between terrain resamples

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    // The frame around the canvas has to hide with it, or toggling off leaves
    // an empty bordered box in the corner.
    this.wrap = canvas.closest('#minimap-wrap') ?? canvas;
    this.ctx = canvas.getContext('2d');
    this.visible = true;
    this.timer = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = WIDTH * this.dpr;
    canvas.height = HEIGHT * this.dpr;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;

    // Terrain is rendered to an offscreen buffer at one pixel per sample and
    // scaled up, so a redraw is one drawImage rather than thousands of rects.
    this.cols = Math.floor(WIDTH / 2);
    this.rows = Math.floor(HEIGHT / 2);
    this.buffer = document.createElement('canvas');
    this.buffer.width = this.cols;
    this.buffer.height = this.rows;
    this.bufferCtx = this.buffer.getContext('2d');
    this.image = this.bufferCtx.createImageData(this.cols, this.rows);

    this.colourCache = new Map();
  }

  toggle(force) {
    this.visible = force ?? !this.visible;
    this.wrap.classList.toggle('hidden', !this.visible);
  }

  colourOf(id) {
    let c = this.colourCache.get(id);
    if (c) return c;
    const def = BLOCKS[id];
    c = def?.tint ? hexToRgb(def.tint) : [0, 0, 0];
    this.colourCache.set(id, c);
    return c;
  }

  update(dt, state) {
    if (!this.visible) return;
    // Resample when the light has moved enough to show, not just on a timer.
    if (Math.abs((state.dayLight ?? 1) - (this.lastLight ?? -1)) > 0.05) this.timer = 0;
    this.timer -= dt;
    if (this.timer > 0) {
      this.drawMarkers(state);
      return;
    }
    this.timer = REFRESH;
    this.sample(state);
    this.drawMarkers(state);
  }

  /** Resample the terrain block grid into the offscreen pixel buffer. */
  sample(state) {
    const { world, player } = state;
    const data = this.image.data;
    const stepX = SPAN_X / this.cols;
    const stepY = SPAN_Y / this.rows;
    const originX = player.x - SPAN_X / 2;
    const originY = player.y - SPAN_Y / 2;

    // The map's sky follows the time of day, or a night map reads as daylight.
    const light = state.dayLight ?? 1;
    this.lastLight = light;
    const sky = BIOMES[world.bandAt(player.x).id]?.sky?.[1] ?? '#9cc3e0';
    const base = hexToRgb(sky);
    const skyRgb = base.map((c, i) => Math.round(c * light + [10, 12, 28][i] * (1 - light)));

    for (let ry = 0; ry < this.rows; ry++) {
      const wy = Math.floor(originY + ry * stepY);
      for (let rx = 0; rx < this.cols; rx++) {
        const wx = Math.floor(originX + rx * stepX);
        const i = (ry * this.cols + rx) * 4;

        if (wx < 0 || wx >= world.width || wy >= world.height) {
          data[i] = 12; data[i + 1] = 12; data[i + 2] = 16; data[i + 3] = 255;
          continue;
        }

        const id = wy < 0 ? AIR : world.grid[wy * world.width + wx];
        if (id === AIR) {
          // Above ground reads as sky; below it, as unlit rock.
          const underground = wy > world.ground[wx];
          if (underground) {
            data[i] = 26; data[i + 1] = 23; data[i + 2] = 32;
          } else {
            data[i] = skyRgb[0]; data[i + 1] = skyRgb[1]; data[i + 2] = skyRgb[2];
          }
          data[i + 3] = 255;
          continue;
        }

        const [r, g, b] = this.colourOf(id);
        // Shade with depth so caves and ore veins stay legible against rock.
        const depth = Math.max(0, wy - world.ground[wx]);
        const depthK = isLiquid(id) ? 1 : 1 - Math.min(0.45, depth / 260);
        // Surface blocks dim with nightfall; deep ones are already dark.
        const nightK = depth > 6 ? 1 : 0.35 + 0.65 * light;
        const k = depthK * nightK;
        data[i] = r * k; data[i + 1] = g * k; data[i + 2] = b * k; data[i + 3] = 255;
      }
    }

    this.bufferCtx.putImageData(this.image, 0, 0);
  }

  drawMarkers(state) {
    const { world, player, entities } = state;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(this.buffer, 0, 0, WIDTH, HEIGHT);

    const toMap = (wx, wy) => ({
      x: ((wx - (player.x - SPAN_X / 2)) / SPAN_X) * WIDTH,
      y: ((wy - (player.y - SPAN_Y / 2)) / SPAN_Y) * HEIGHT,
    });

    // Structures in range, so the map is worth opening.
    ctx.fillStyle = '#d9b877';
    for (const s of world.structures) {
      if (Math.abs(s.x - player.x) > SPAN_X / 2) continue;
      const m = toMap(s.x, (s.y0 + s.y1) / 2);
      if (m.y < 0 || m.y > HEIGHT) continue;
      ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
    }

    ctx.fillStyle = '#c26af0';
    for (const p of world.portals) {
      if (Math.abs(p.x - player.x) > SPAN_X / 2) continue;
      const m = toMap(p.x, p.y);
      ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
    }

    for (const mob of entities.mobs) {
      if (Math.abs(mob.x - player.x) > SPAN_X / 2) continue;
      const m = toMap(mob.x, mob.centerY);
      if (m.y < 0 || m.y > HEIGHT) continue;
      ctx.fillStyle = mob.def.behavior === 'hostile' ? '#e8756a'
        : mob.def.behavior === 'neutral' ? '#e8c43a' : '#7fd48a';
      ctx.fillRect(m.x - 1, m.y - 1, 2, 2);
    }

    // The player, always dead centre.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(WIDTH / 2 - 2, HEIGHT / 2 - 2, 4, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(WIDTH / 2 - 2.5, HEIGHT / 2 - 2.5, 5, 5);

    // Waterline, as a horizon reference while underground.
    if (world.liquidLevel >= 0) {
      const m = toMap(0, world.liquidLevel);
      if (m.y > 0 && m.y < HEIGHT) {
        ctx.strokeStyle = 'rgba(160,200,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(0, m.y);
        ctx.lineTo(WIDTH, m.y);
        ctx.stroke();
      }
    }
  }
}

export { WIDTH as MAP_WIDTH, HEIGHT as MAP_HEIGHT };
