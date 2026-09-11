import { TILE, ZOOM, SEA_LEVEL } from './config.js';
import { AIR } from './blocks.js';
import { textures } from './textures.js';

const SCALE = TILE * ZOOM;   // on-screen pixels per block

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 0, y: 0 };
    this.dpr = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
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

  /** Camera centres on the player, clamped to the world edges. */
  follow(player, world, dt) {
    const targetX = player.x - this.viewW / (2 * SCALE);
    const targetY = player.y + player.h / 2 - this.viewH / (2 * SCALE);

    const lerp = 1 - Math.pow(0.0015, dt);   // frame-rate independent smoothing
    this.camera.x += (targetX - this.camera.x) * lerp;
    this.camera.y += (targetY - this.camera.y) * lerp;

    const maxX = world.width - this.viewW / SCALE;
    const maxY = world.height - this.viewH / SCALE;
    this.camera.x = Math.max(0, Math.min(Math.max(0, maxX), this.camera.x));
    this.camera.y = Math.max(0, Math.min(Math.max(0, maxY), this.camera.y));
  }

  /** Screen pixel -> world block coordinates (fractional). */
  screenToWorld(sx, sy) {
    return { x: this.camera.x + sx / SCALE, y: this.camera.y + sy / SCALE };
  }

  worldToScreen(wx, wy) {
    return { x: (wx - this.camera.x) * SCALE, y: (wy - this.camera.y) * SCALE };
  }

  draw(state) {
    const { world, player, hover, mining } = state;
    const ctx = this.ctx;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSky(ctx);

    // Snap the camera to whole device pixels to avoid texture seams.
    const camPx = Math.round(this.camera.x * SCALE * this.dpr) / this.dpr;
    const camPy = Math.round(this.camera.y * SCALE * this.dpr) / this.dpr;
    ctx.save();
    ctx.translate(-camPx, -camPy);

    this.drawTerrain(ctx, world);
    this.drawPlayer(ctx, player);
    if (hover) this.drawHighlight(ctx, hover, mining);

    ctx.restore();
  }

  drawSky(ctx) {
    const horizon = (SEA_LEVEL - this.camera.y) * SCALE;
    const g = ctx.createLinearGradient(0, 0, 0, this.viewH);
    g.addColorStop(0, '#4d84c4');
    g.addColorStop(Math.max(0, Math.min(1, horizon / this.viewH)), '#9cc3e0');
    g.addColorStop(1, '#2b2b33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  drawTerrain(ctx, world) {
    const x0 = Math.max(0, Math.floor(this.camera.x) - 1);
    const y0 = Math.max(0, Math.floor(this.camera.y) - 1);
    const x1 = Math.min(world.width - 1, Math.ceil(this.camera.x + this.viewW / SCALE) + 1);
    const y1 = Math.min(world.height - 1, Math.ceil(this.camera.y + this.viewH / SCALE) + 1);

    // Backdrop behind each underground column, so caves read as dark hollows
    // rather than windows onto the sky.
    for (let x = x0; x <= x1; x++) {
      const top = Math.max(world.ground[x], y0);
      if (top > y1) continue;
      ctx.fillStyle = '#1d1a24';
      ctx.fillRect(x * SCALE, top * SCALE, SCALE, (y1 - top + 1) * SCALE);
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const id = world.get(x, y);
        if (id === AIR) continue;

        const tex = textures[id];
        const px = x * SCALE;
        const py = y * SCALE;
        if (tex) ctx.drawImage(tex, px, py, SCALE, SCALE);

        // Cheap depth shading: darker the further below the surface.
        const depth = y - world.ground[x];
        if (depth > 0) {
          const shade = Math.min(0.55, depth / 90);
          if (shade > 0.02) {
            ctx.fillStyle = `rgba(0,0,0,${shade})`;
            ctx.fillRect(px, py, SCALE, SCALE);
          }
        }
      }
    }
  }

  drawPlayer(ctx, p) {
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
