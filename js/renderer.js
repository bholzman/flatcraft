import { TILE, ZOOM, CAMERA_SMOOTH, LUSH_CAVES_AT, DEEP_DARK_AT } from './config.js';
import { AIR, BLOCKS } from './blocks.js';
import { BIOMES, bandIndexAt } from './biomes.js';
import { textures } from './textures.js';

const SCALE = TILE * ZOOM;        // on-screen pixels per block
const BLEND = 16;                 // must match the generator's band cross-fade

const REALM_AMBIENT = { overworld: '#1d1a24', nether: '#2a1212', end: '#0a0710' };
const VOID_COLOUR = '#07060b';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  return a.map((c, i) => Math.round(c + (b[i] - c) * t));
}

function rgbCss([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
    this.dpr = 1;
    this.glowCache = new Map();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Radial sprites drawn additively wherever something emits light, tinted by
   * the emitter so lava pools warm and portals cast violet. Cached per colour;
   * there are only a handful of emissive blocks.
   */
  glowFor(hex) {
    let sprite = this.glowCache.get(hex);
    if (sprite) return sprite;

    const size = 128;
    const [r, g, b] = hexToRgb(hex);
    const lit = mix([r, g, b], [255, 255, 255], 0.45);   // hot core

    sprite = document.createElement('canvas');
    sprite.width = sprite.height = size;
    const ctx = sprite.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${lit[0]},${lit[1]},${lit[2]},0.55)`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.2)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    this.glowCache.set(hex, sprite);
    return sprite;
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.viewW = w;
    this.viewH = h;
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * The player stays in the middle of the screen in both axes and the camera
   * never clamps at a world edge -- digging down or climbing is what changes
   * how much sky vs. underground is on screen.
   */
  follow(player, dt) {
    const targetX = player.x - this.viewW / (2 * SCALE);
    const targetY = player.y + player.h / 2 - this.viewH / (2 * SCALE);
    const lerp = 1 - Math.pow(CAMERA_SMOOTH, dt);
    this.camera.x += (targetX - this.camera.x) * lerp;
    this.camera.y += (targetY - this.camera.y) * lerp;
  }

  snapTo(player) {
    this.camera.x = player.x - this.viewW / (2 * SCALE);
    this.camera.y = player.y + player.h / 2 - this.viewH / (2 * SCALE);
  }

  /** Screen pixel -> world block coordinates (fractional). */
  screenToWorld(sx, sy) {
    return { x: this.camera.x + sx / SCALE, y: this.camera.y + sy / SCALE };
  }

  worldToScreen(wx, wy) {
    return { x: (wx - this.camera.x) * SCALE, y: (wy - this.camera.y) * SCALE };
  }

  // ---- sky ----

  /** Sky colours cross-faded between neighbouring surface biomes. */
  skyAt(world, x) {
    const bands = world.bands;
    const i = bandIndexAt(bands, Math.max(0, Math.min(world.width - 1, x | 0)));
    const band = bands[i];

    let other = i;
    let t = 0;
    const dLeft = x - band.x0;
    const dRight = band.x1 - 1 - x;
    if (dLeft < BLEND && i > 0) {
      other = i - 1;
      t = 0.5 * (1 - dLeft / BLEND);
    } else if (dRight < BLEND && i < bands.length - 1) {
      other = i + 1;
      t = 0.5 * (1 - dRight / BLEND);
    }

    const a = BIOMES[band.id].sky ?? ['#4d84c4', '#9cc3e0'];
    const b = BIOMES[bands[other].id].sky ?? a;
    return [
      mix(hexToRgb(a[0]), hexToRgb(b[0]), t),
      mix(hexToRgb(a[1]), hexToRgb(b[1]), t),
    ];
  }

  drawSky(ctx, world, player) {
    const [zenith, horizon] = this.skyAt(world, player.x);

    // Underground, fade the whole sky toward the cave band's ambient colour so
    // the light visibly drains away as the player digs down.
    const depth = player.y - world.ground[Math.max(0, Math.min(world.width - 1, player.x | 0))];
    const sink = Math.max(0, Math.min(1, depth / 26));
    const ambient = hexToRgb(this.ambientAt(world, player.y));

    const top = mix(zenith, ambient, sink);
    const bottom = mix(horizon, ambient, sink);

    const horizonY = (world.spec.surfaceLevel - this.camera.y) * SCALE;
    const g = ctx.createLinearGradient(0, 0, 0, this.viewH);
    g.addColorStop(0, rgbCss(top));
    g.addColorStop(Math.max(0.01, Math.min(0.99, horizonY / this.viewH)), rgbCss(bottom));
    g.addColorStop(1, rgbCss(mix(bottom, ambient, 0.75)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  ambientAt(world, y) {
    const bi = world.undergroundBiomeAt(y);
    return bi?.ambient ?? REALM_AMBIENT[world.realm] ?? '#1d1a24';
  }

  // ---- terrain ----

  draw(state) {
    const { world, player, hover, mining } = state;
    const ctx = this.ctx;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSky(ctx, world, player);

    // Snap the camera to whole device pixels to avoid texture seams.
    const camPx = Math.round(this.camera.x * SCALE * this.dpr) / this.dpr;
    const camPy = Math.round(this.camera.y * SCALE * this.dpr) / this.dpr;
    ctx.save();
    ctx.translate(-camPx, -camPy);

    this.drawBackdrop(ctx, world);
    const lights = this.drawTerrain(ctx, world);
    this.drawPlayer(ctx, player);
    this.drawLights(ctx, lights, player);
    if (hover) this.drawHighlight(ctx, hover, mining);

    ctx.restore();
  }

  viewBounds(world) {
    return {
      x0: Math.floor(this.camera.x) - 1,
      y0: Math.max(0, Math.floor(this.camera.y) - 1),
      x1: Math.ceil(this.camera.x + this.viewW / SCALE) + 1,
      y1: Math.min(world.height - 1, Math.ceil(this.camera.y + this.viewH / SCALE) + 1),
    };
  }

  /**
   * Dark fill behind every underground column, so caves read as hollows rather
   * than windows onto the sky. Keyed off the fixed terrain baseline, not the
   * live surface, or tree canopies would cast it across open air.
   */
  drawBackdrop(ctx, world) {
    const { x0, y0, x1, y1 } = this.viewBounds(world);
    const lush = Math.floor(world.height * LUSH_CAVES_AT);
    const deep = Math.floor(world.height * DEEP_DARK_AT);
    const overworld = world.realm === 'overworld';

    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= world.width) {
        ctx.fillStyle = VOID_COLOUR;                    // past the world edge
        ctx.fillRect(x * SCALE, y0 * SCALE, SCALE, (y1 - y0 + 1) * SCALE);
        continue;
      }

      const top = Math.max(world.ground[x], y0);
      if (top > y1) continue;

      if (!overworld) {
        ctx.fillStyle = REALM_AMBIENT[world.realm];
        ctx.fillRect(x * SCALE, top * SCALE, SCALE, (y1 - top + 1) * SCALE);
        continue;
      }

      // Overworld: one fill per depth band the column passes through.
      const spans = [
        [top, Math.min(y1, lush - 1), BIOMES.caves.ambient],
        [Math.max(top, lush), Math.min(y1, deep - 1), BIOMES.lush_caves.ambient],
        [Math.max(top, deep), y1, BIOMES.deep_dark.ambient],
      ];
      for (const [a, b, colour] of spans) {
        if (b < a) continue;
        ctx.fillStyle = colour;
        ctx.fillRect(x * SCALE, a * SCALE, SCALE, (b - a + 1) * SCALE);
      }
    }
  }

  /** Draws visible blocks; returns the glowing ones for the lighting pass. */
  drawTerrain(ctx, world) {
    const { x0, y0, x1, y1 } = this.viewBounds(world);
    const lights = [];

    for (let y = y0; y <= y1; y++) {
      for (let x = Math.max(0, x0); x <= Math.min(world.width - 1, x1); x++) {
        const id = world.grid[y * world.width + x];
        if (id === AIR) continue;

        const def = BLOCKS[id];
        const px = x * SCALE;
        const py = y * SCALE;
        const tex = textures[id];
        if (tex) ctx.drawImage(tex, px, py, SCALE, SCALE);

        if (def.emit >= 0.4) {
          lights.push([px + SCALE / 2, py + SCALE / 2, def.emit, def.tint]);
          continue;                                     // bright blocks ignore depth shading
        }

        const depth = y - world.ground[x];
        if (depth > 0) {
          const shade = Math.min(0.72, depth / 110);
          if (shade > 0.02) {
            ctx.fillStyle = `rgba(0,0,0,${shade})`;
            ctx.fillRect(px, py, SCALE, SCALE);
          }
        }
      }
    }
    return lights;
  }

  drawLights(ctx, lights, player) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Neighbouring emitters stack, so each one has to stay subtle or a portal
    // frame or lava pool washes the whole screen out.
    for (const [px, py, strength, tint] of lights) {
      const r = SCALE * (1.4 + strength * 1.6);
      ctx.globalAlpha = 0.16 * strength;
      ctx.drawImage(this.glowFor(tint), px - r, py - r, r * 2, r * 2);
    }

    // The player carries a little light of their own, so digging stays legible.
    // The context is already translated into world pixels here.
    const px = player.x * SCALE;
    const py = (player.y + player.h / 2) * SCALE;
    const pr = SCALE * 4;
    ctx.globalAlpha = 0.13;
    ctx.drawImage(this.glowFor('#ffe6b4'), px - pr, py - pr, pr * 2, pr * 2);

    ctx.restore();
  }

  drawPlayer(ctx, p) {
    ctx.save();
    // A spectator is passing through the world, not standing in it.
    if (p.noclip) ctx.globalAlpha = 0.45;

    const x = p.left * SCALE;
    const y = p.top * SCALE;
    const w = p.w * SCALE;
    const h = p.h * SCALE;
    const unit = h / 16;   // 16 vertical "pixels" of character

    ctx.fillStyle = '#2f5aa8';                       // legs
    ctx.fillRect(x, y + unit * 9, w, unit * 7);
    ctx.fillStyle = '#3b7a4a';                       // torso
    ctx.fillRect(x, y + unit * 4, w, unit * 5);
    ctx.fillStyle = '#c9a07a';                       // head
    ctx.fillRect(x + w * 0.08, y, w * 0.84, unit * 4);

    ctx.fillStyle = '#1b1b1f';                       // eye, facing-aware
    const eyeX = p.facing >= 0 ? x + w * 0.55 : x + w * 0.25;
    ctx.fillRect(eyeX, y + unit * 1.6, w * 0.16, unit * 0.9);

    ctx.restore();
  }

  drawHighlight(ctx, hover, mining) {
    const px = hover.x * SCALE;
    const py = hover.y * SCALE;

    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, SCALE - 2, SCALE - 2);

    if (mining && mining.progress > 0) {
      // Crack overlay: more, darker slashes as the block gives way.
      const stage = Math.floor(mining.progress * 5);
      ctx.fillStyle = `rgba(0,0,0,${0.12 + stage * 0.11})`;
      ctx.fillRect(px, py, SCALE, SCALE);

      ctx.strokeStyle = 'rgba(10,10,12,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= stage; i++) {
        const t = (i + 1) / 6;
        ctx.moveTo(px + SCALE * t, py);
        ctx.lineTo(px + SCALE * (t * 0.6), py + SCALE);
      }
      ctx.stroke();
    }
  }
}

export { SCALE };
