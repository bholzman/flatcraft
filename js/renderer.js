import { TILE, ZOOM, CAMERA_SMOOTH, LUSH_CAVES_AT, DEEP_DARK_AT } from './config.js';
import { AIR, BLOCKS } from './blocks.js';
import { BIOMES, bandIndexAt } from './biomes.js';
import { textures, shadowMasks } from './textures.js';

const SCALE = TILE * ZOOM;        // on-screen pixels per block
const BLEND = 16;                 // must match the generator's band cross-fade

const REALM_AMBIENT = { overworld: '#1d1a24', nether: '#2a1212', end: '#0a0710' };
const VOID_COLOUR = '#07060b';
const NIGHT_ZENITH = [6, 8, 22];
const NIGHT_HORIZON = [26, 30, 58];

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

  drawSky(ctx, world, player, light, phase) {
    let [zenith, horizon] = this.skyAt(world, player.x);

    // Night falls on the sky first; sunrise and sunset warm the horizon as
    // they pass through.
    if (light < 1) {
      const dusk = Math.sin(light * Math.PI);          // peaks mid-transition
      zenith = mix(NIGHT_ZENITH, zenith, light);
      horizon = mix(mix(NIGHT_HORIZON, horizon, light), [236, 140, 78], dusk * 0.45);
    }

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

    if (phase !== null && sink < 0.95) this.drawCelestials(ctx, phase, light, 1 - sink);
  }

  /** Stars, then whichever of the sun or moon is currently up. */
  drawCelestials(ctx, phase, light, strength) {
    const horizonY = this.viewH * 0.62;

    if (light < 0.9) {
      ctx.save();
      ctx.globalAlpha = (1 - light) * strength * 0.9;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 70; i++) {
        // Fixed pattern, drifting slowly westward with the sky.
        const sx = (i * 137.5 + phase * this.viewW * 0.4) % this.viewW;
        const sy = (i * 61.8) % horizonY;
        ctx.fillRect(sx, sy, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
      }
      ctx.restore();
    }

    // Day runs phase 0 -> 0.5, night 0.5 -> 1; each body arcs across in its half.
    const isDay = phase < 0.5;
    const t = isDay ? phase / 0.5 : (phase - 0.5) / 0.5;
    const x = t * this.viewW;
    const y = horizonY - Math.sin(t * Math.PI) * horizonY * 0.78;
    const r = isDay ? 26 : 20;

    ctx.save();
    ctx.globalAlpha = strength;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    if (isDay) {
      grad.addColorStop(0, 'rgba(255,246,200,0.95)');
      grad.addColorStop(0.28, 'rgba(255,224,130,0.5)');
      grad.addColorStop(1, 'rgba(255,210,120,0)');
    } else {
      grad.addColorStop(0, 'rgba(226,232,255,0.85)');
      grad.addColorStop(0.3, 'rgba(180,196,255,0.28)');
      grad.addColorStop(1, 'rgba(150,170,255,0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isDay ? '#fff6c8' : '#e6ecff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (!isDay) {                                      // a couple of craters
      ctx.fillStyle = 'rgba(160,172,210,0.55)';
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.26, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  ambientAt(world, y) {
    const bi = world.undergroundBiomeAt(y);
    return bi?.ambient ?? REALM_AMBIENT[world.realm] ?? '#1d1a24';
  }

  // ---- terrain ----

  draw(state) {
    const { world, player, hover, mining } = state;
    const ctx = this.ctx;

    // Only the overworld has a sky to run a cycle in.
    const hasSky = world.realm === 'overworld';
    const light = hasSky ? state.dayLight : 1;
    const phase = hasSky ? state.timeOfDay : null;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawSky(ctx, world, player, light, phase);

    // Snap the camera to whole device pixels to avoid texture seams.
    const camPx = Math.round(this.camera.x * SCALE * this.dpr) / this.dpr;
    const camPy = Math.round(this.camera.y * SCALE * this.dpr) / this.dpr;
    ctx.save();
    ctx.translate(-camPx, -camPy);

    this.drawBackdrop(ctx, world);
    this.drawVoidHaze(ctx, world);
    const lights = this.drawTerrain(ctx, world, light);
    this.drawPrimedTnt(ctx, world);
    for (const m of state.entities.mobs) this.drawMob(ctx, m, lights);
    for (const p of state.entities.projectiles) this.drawProjectile(ctx, p);
    this.drawPlayer(ctx, player);
    for (const e of state.entities.effects) this.drawEffect(ctx, e);
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
   * live surface, or tree canopies would cast it across open air -- but only
   * down to where the column is still open to the sky, so mining out the top
   * block shows sky behind it rather than cave.
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

      const top = Math.max(world.skyFloor(x), y0);
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

  /**
   * A violet haze where the world meets the void -- rising off the End's floor
   * and creeping in from each side edge -- so the deadly part is visible.
   */
  drawVoidHaze(ctx, world) {
    const haze = 6;                                    // blocks the glow reaches
    const left = this.camera.x * SCALE - SCALE;
    const top = this.camera.y * SCALE - SCALE;
    const w = this.viewW + SCALE * 2;
    const h = this.viewH + SCALE * 2;
    const clear = 'rgba(120, 60, 190, 0)';
    const glow = 'rgba(150, 80, 220, 0.55)';

    // The End's floor sits inside the world; elsewhere it's under bedrock.
    const floor = world.voidFloor;
    if (floor < world.height && top + h > (floor - haze) * SCALE) {
      const grad = ctx.createLinearGradient(0, (floor - haze) * SCALE, 0, floor * SCALE);
      grad.addColorStop(0, clear);
      grad.addColorStop(1, glow);
      ctx.fillStyle = grad;
      ctx.fillRect(left, (floor - haze) * SCALE, w, haze * SCALE);
      ctx.fillStyle = VOID_COLOUR;
      ctx.fillRect(left, floor * SCALE, w, Math.max(0, top + h - floor * SCALE));
    }

    for (const [edge, inward] of [[0, 1], [world.width, -1]]) {
      const x = edge * SCALE;
      if (x + haze * SCALE < left || x - haze * SCALE > left + w) continue;
      const inner = (edge + inward * haze) * SCALE;
      const grad = ctx.createLinearGradient(inner, 0, x, 0);
      grad.addColorStop(0, clear);
      grad.addColorStop(1, glow);
      ctx.fillStyle = grad;
      ctx.fillRect(Math.min(x, inner), top, haze * SCALE, h);
    }
  }

  /** Draws visible blocks; returns the glowing ones for the lighting pass. */
  drawTerrain(ctx, world, light = 1) {
    const { x0, y0, x1, y1 } = this.viewBounds(world);
    const lights = [];
    const night = 1 - light;

    for (let y = y0; y <= y1; y++) {
      for (let x = Math.max(0, x0); x <= Math.min(world.width - 1, x1); x++) {
        const id = world.grid[y * world.width + x];
        if (id === AIR) continue;

        const def = BLOCKS[id];
        const px = x * SCALE;
        const py = y * SCALE;
        const tex = textures[id];
        if (def.style === 'fire') this.drawFire(ctx, px, py, x);
        else if (tex) ctx.drawImage(tex, px, py, SCALE, SCALE);

        if (def.emit >= 0.4) {
          lights.push([px + SCALE / 2, py + SCALE / 2, def.emit, def.tint]);
          continue;                                     // bright blocks ignore depth shading
        }

        // Depth shading underground, nightfall over everything. Taking the
        // greater of the two keeps a shallow cave from looking brighter at
        // midnight than the surface above it.
        const depth = y - world.ground[x];
        const shade = Math.max(
          depth > 0 ? Math.min(0.72, depth / 110) : 0,
          night * 0.62,
        );
        // Shade through the block's own silhouette, so a tuft of grass darkens
        // without the empty rest of its cell turning into a black square.
        if (shade > 0.02 && shadowMasks[id]) {
          ctx.globalAlpha = shade;
          ctx.drawImage(shadowMasks[id], px, py, SCALE, SCALE);
          ctx.globalAlpha = 1;
        }
      }
    }
    return lights;
  }

  /** Tongues of flame licking up from the bottom of a fire cell. */
  drawFire(ctx, px, py, x) {
    const t = performance.now() / 1000;
    const tongues = 4;
    const w = SCALE / tongues;
    for (let i = 0; i < tongues; i++) {
      const phase = t * 9 + x * 1.7 + i * 2.3;
      const fh = SCALE * (0.55 + 0.35 * Math.sin(phase)) * (i % 2 ? 0.8 : 1);
      const cx = px + w * (i + 0.5) + Math.sin(phase * 0.7) * w * 0.25;
      ctx.fillStyle = i % 2 ? 'rgba(255,200,70,0.9)' : 'rgba(238,106,28,0.9)';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.85, py + SCALE);
      ctx.lineTo(cx, py + SCALE - fh);
      ctx.lineTo(cx + w * 0.85, py + SCALE);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Lit TNT flashes white, faster as the fuse runs down. */
  drawPrimedTnt(ctx, world) {
    const t = performance.now() / 1000;
    for (const p of world.primed.values()) {
      const rate = p.fuse < 1 ? 14 : 6;
      if (Math.sin(t * rate) < 0) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(p.x * SCALE, p.y * SCALE, SCALE, SCALE);
    }
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

    if (p.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,60,50,${0.55 * (p.hurtFlash / 0.3)})`;
      ctx.fillRect(x, y, w, h);
    }

    ctx.restore();
    if (p.onFire > 0) this.drawFlames(ctx, x, y, w, h, performance.now() / 250);
  }

  // ---- mobs ----

  /**
   * Mobs are drawn from rectangles, the same way the player is: a per-mob
   * palette plus a shape recipe, so 40-odd mobs need no art.
   */
  drawMob(ctx, m, lights) {
    const px = m.left * SCALE;
    const py = m.top * SCALE;
    const w = m.w * SCALE;
    const h = m.h * SCALE;
    const pal = m.palette ?? m.def.palette;
    const face = m.facing >= 0 ? 1 : -1;
    // A lit creeper swells as its fuse burns down.
    const fuse = m.def.fuse ? Math.min(1, m.fuse / m.def.fuse.time) : 0;
    const swell = 1 + fuse * 0.16;

    if (m.def.glow) lights.push([px + w / 2, py + h / 2, m.def.glow, pal.accent]);

    ctx.save();
    // Flip (and swell) around the mob's feet so every shape can be drawn facing right.
    ctx.translate(px + w / 2, py + h);
    ctx.scale(face * swell, swell);
    ctx.translate(-w / 2, -h);

    const R = (x, y, rw, rh, colour) => {
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, rw, rh);
    };

    switch (m.def.shape) {
      case 'quadruped': {
        const legH = h * 0.3;
        R(w * 0.08, h - legH, w * 0.18, legH, pal.legs);
        R(w * 0.72, h - legH, w * 0.18, legH, pal.legs);
        R(0, h * 0.2, w * 0.82, h - legH - h * 0.2, pal.body);
        R(w * 0.62, 0, w * 0.38, h * 0.42, pal.head);
        R(w * 0.9, h * 0.12, w * 0.08, h * 0.08, pal.accent);   // snout/eye
        if (m.owner) R(w * 0.56, h * 0.22, w * 0.1, h * 0.18, '#c8302a');   // a pet's collar
        break;
      }
      case 'biped': {
        const legH = h * 0.42;
        R(w * 0.1, h - legH, w * 0.35, legH, pal.legs);
        R(w * 0.55, h - legH, w * 0.35, legH, pal.legs);
        R(w * 0.05, h * 0.26, w * 0.9, h * 0.34, pal.body);
        R(w * 0.12, 0, w * 0.76, h * 0.28, pal.head);
        R(w * 0.55, h * 0.1, w * 0.16, h * 0.06, pal.accent);   // eye
        R(0, h * 0.28, w * 0.12, h * 0.34, pal.body);           // arms
        R(w * 0.88, h * 0.28, w * 0.12, h * 0.34, pal.body);
        if (m.barter > 0) R(w * 0.9, h * 0.5, w * 0.36, h * 0.07, '#f0cf52');   // admiring gold
        break;
      }
      case 'villager': {
        const legH = h * 0.14;
        R(w * 0.2, h - legH, w * 0.25, legH, pal.legs);
        R(w * 0.55, h - legH, w * 0.25, legH, pal.legs);
        R(w * 0.06, h * 0.27, w * 0.88, h - legH - h * 0.27, pal.body);   // robe
        R(w * 0.1, 0, w * 0.8, h * 0.29, pal.head);
        R(w * 0.1, 0, w * 0.8, h * 0.05, pal.accent);                    // hat
        R(w * 0.86, h * 0.12, w * 0.16, h * 0.11, '#b0845e');            // the nose
        R(w * 0.48, h * 0.085, w * 0.32, h * 0.03, '#3a2a1e');           // brow
        R(w * 0.58, h * 0.12, w * 0.1, h * 0.04, '#2a6a3a');             // eye
        R(w * 0.02, h * 0.4, w * 0.96, h * 0.09, pal.accent);            // folded arms
        break;
      }
      case 'illager': {
        const legH = h * 0.36;
        const robe = m.def.item === 'robe';
        R(w * 0.12, h - legH, w * 0.32, legH, pal.legs);
        R(w * 0.56, h - legH, w * 0.32, legH, pal.legs);
        R(w * 0.06, h * 0.27, w * 0.88, robe ? h * 0.66 : h * 0.38, pal.body);
        if (robe) R(w * 0.44, h * 0.27, w * 0.12, h * 0.66, pal.accent);   // gold trim
        R(w * 0.1, 0, w * 0.8, h * 0.29, pal.head);
        R(w * 0.86, h * 0.12, w * 0.14, h * 0.11, '#7a7a6c');            // nose
        R(w * 0.44, h * 0.075, w * 0.42, h * 0.035, '#2a2a2a');          // heavy brow
        R(w * 0.56, h * 0.115, w * 0.12, h * 0.04, '#e8e8e0');           // pale eye
        if (m.casting > 0) {
          R(0, -h * 0.02, w * 0.12, h * 0.3, pal.body);                   // arms up, casting
          R(w * 0.88, -h * 0.02, w * 0.12, h * 0.3, pal.body);
        } else {
          R(0, h * 0.29, w * 0.12, h * 0.32, pal.body);
          R(w * 0.88, h * 0.29, w * 0.12, h * 0.32, pal.body);
        }
        if (m.def.item === 'crossbow') {
          R(w * 0.8, h * 0.45, w * 0.55, h * 0.05, '#6b4c2b');
          R(w * 1.22, h * 0.37, w * 0.08, h * 0.21, '#4a3a2a');
        } else if (m.def.item === 'axe') {
          R(w * 0.92, h * 0.22, w * 0.08, h * 0.42, '#6b4c2b');
          R(w * 0.98, h * 0.2, w * 0.3, h * 0.13, pal.accent);
        }
        break;
      }
      case 'golem': {
        const legH = h * 0.3;
        const swing = Math.sin(m.bob) * h * 0.03;
        R(w * 0.2, h - legH, w * 0.24, legH, pal.legs);
        R(w * 0.56, h - legH, w * 0.24, legH, pal.legs);
        R(w * 0.1, h * 0.2, w * 0.8, h * 0.52, pal.body);                 // chest
        R(w * 0.32, 0, w * 0.4, h * 0.22, pal.head);                      // small head
        R(w * 0.7, h * 0.08, w * 0.1, h * 0.1, '#a8a296');                // nose
        R(w * 0.52, h * 0.06, w * 0.08, h * 0.035, '#b03030');            // red eye
        R(-w * 0.04, h * 0.22 + swing, w * 0.16, h * 0.56, pal.legs);     // long arms
        R(w * 0.88, h * 0.22 - swing, w * 0.16, h * 0.56, pal.legs);
        R(w * 0.22, h * 0.3, w * 0.07, h * 0.26, pal.accent);             // vines
        R(w * 0.64, h * 0.44, w * 0.06, h * 0.2, pal.accent);
        break;
      }
      case 'snowman': {
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = Math.max(2, w * 0.07);
        ctx.beginPath();
        ctx.moveTo(w * 0.2, h * 0.43); ctx.lineTo(-w * 0.28, h * 0.3);
        ctx.moveTo(w * 0.8, h * 0.43); ctx.lineTo(w * 1.28, h * 0.3);
        ctx.stroke();
        R(w * 0.06, h * 0.56, w * 0.88, h * 0.44, pal.body);             // lower snowball
        R(w * 0.16, h * 0.3, w * 0.68, h * 0.28, pal.legs);              // upper snowball
        R(w * 0.16, 0, w * 0.68, h * 0.3, pal.head);                     // pumpkin head
        R(w * 0.48, h * 0.08, w * 0.12, h * 0.07, '#3a2210');
        R(w * 0.68, h * 0.08, w * 0.12, h * 0.07, '#3a2210');
        R(w * 0.46, h * 0.19, w * 0.36, h * 0.05, '#3a2210');
        break;
      }
      case 'vex': {
        const flap = Math.sin(m.bob * 4) * h * 0.15;
        ctx.fillStyle = 'rgba(230,238,244,0.7)';
        ctx.beginPath();
        ctx.moveTo(w * 0.3, h * 0.35);
        ctx.lineTo(-w * 0.7, h * 0.08 + flap);
        ctx.lineTo(-w * 0.2, h * 0.62);
        ctx.closePath(); ctx.fill();
        R(w * 0.25, h * 0.35, w * 0.5, h * 0.4, pal.body);
        R(w * 0.32, h * 0.72, w * 0.36, h * 0.2, pal.legs);              // wisp of a tail
        R(w * 0.2, 0, w * 0.6, h * 0.36, pal.head);
        R(w * 0.55, h * 0.12, w * 0.12, h * 0.07, '#3a4a6a');
        R(w * 0.78, h * 0.12, w * 0.1, h * 0.5, '#c8ccd4');              // sword
        R(w * 0.68, h * 0.55, w * 0.3, h * 0.05, '#6b4c2b');
        break;
      }
      case 'ravager': {
        const legH = h * 0.32;
        R(w * 0.06, h - legH, w * 0.16, legH, pal.legs);
        R(w * 0.3, h - legH, w * 0.14, legH, pal.legs);
        R(w * 0.6, h - legH, w * 0.16, legH, pal.legs);
        R(0, h * 0.18, w * 0.78, h - legH - h * 0.18, pal.body);
        R(w * 0.64, h * 0.1, w * 0.36, h * 0.42, pal.head);
        R(w * 0.9, h * 0.34, w * 0.12, h * 0.14, '#1e1c1a');             // snout
        R(w * 0.7, 0, w * 0.06, h * 0.14, pal.accent);                   // horns
        R(w * 0.84, h * 0.02, w * 0.06, h * 0.12, pal.accent);
        R(w * 0.82, h * 0.2, w * 0.06, h * 0.05, '#e8d8a0');
        break;
      }
      case 'tall': {
        const legH = h * 0.44;
        R(w * 0.18, h - legH, w * 0.24, legH, pal.legs);
        R(w * 0.58, h - legH, w * 0.24, legH, pal.legs);
        R(w * 0.1, h * 0.2, w * 0.8, h * 0.38, pal.body);
        R(w * 0.14, 0, w * 0.72, h * 0.22, pal.head);
        R(w * 0.24, h * 0.09, w * 0.5, h * 0.05, pal.accent);   // glowing eyes
        break;
      }
      case 'creeper': {
        const legH = h * 0.22;
        R(w * 0.05, h - legH, w * 0.3, legH, pal.legs);
        R(w * 0.65, h - legH, w * 0.3, legH, pal.legs);
        R(w * 0.08, h * 0.26, w * 0.84, h - legH - h * 0.26, pal.body);
        R(w * 0.05, 0, w * 0.9, h * 0.3, pal.head);
        R(w * 0.2, h * 0.09, w * 0.18, h * 0.09, pal.accent);
        R(w * 0.62, h * 0.09, w * 0.18, h * 0.09, pal.accent);
        R(w * 0.38, h * 0.17, w * 0.24, h * 0.13, pal.accent);  // mouth
        break;
      }
      case 'spider': {
        const legY = h * 0.45;
        ctx.strokeStyle = pal.legs;
        ctx.lineWidth = Math.max(2, w * 0.06);
        for (let i = 0; i < 4; i++) {
          const lx = w * (0.16 + i * 0.22);
          ctx.beginPath();
          ctx.moveTo(lx, legY);
          ctx.lineTo(lx + (i < 2 ? -w * 0.14 : w * 0.14), h);
          ctx.stroke();
        }
        R(w * 0.05, h * 0.2, w * 0.6, h * 0.6, pal.body);
        R(w * 0.6, h * 0.24, w * 0.38, h * 0.5, pal.head);
        R(w * 0.78, h * 0.34, w * 0.1, h * 0.12, pal.accent);
        R(w * 0.78, h * 0.54, w * 0.1, h * 0.12, pal.accent);
        break;
      }
      case 'blob': {
        const squash = 1 + Math.sin(m.bob) * 0.06;
        const bh = h * squash;
        R(w * 0.06, h - bh + h * 0.06, w * 0.88, bh - h * 0.06, pal.body);
        R(w * 0.24, h * 0.34, w * 0.14, h * 0.12, pal.accent);
        R(w * 0.62, h * 0.34, w * 0.14, h * 0.12, pal.accent);
        R(w * 0.38, h * 0.58, w * 0.24, h * 0.08, pal.accent);
        break;
      }
      case 'bird': {
        R(w * 0.3, h * 0.78, w * 0.12, h * 0.22, pal.legs);
        R(w * 0.58, h * 0.78, w * 0.12, h * 0.22, pal.legs);
        R(w * 0.1, h * 0.3, w * 0.7, h * 0.5, pal.body);
        R(w * 0.55, h * 0.05, w * 0.4, h * 0.34, pal.head);
        R(w * 0.92, h * 0.16, w * 0.14, h * 0.1, pal.accent);   // beak
        break;
      }
      case 'bat': {
        const flap = Math.sin(m.bob * 3) * h * 0.22;
        ctx.fillStyle = pal.accent;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.5);
        ctx.lineTo(-w * 0.35, h * 0.5 + flap);
        ctx.lineTo(w * 0.2, h * 0.85);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.5);
        ctx.lineTo(w * 1.35, h * 0.5 - flap);
        ctx.lineTo(w * 0.8, h * 0.85);
        ctx.closePath(); ctx.fill();
        R(w * 0.3, h * 0.22, w * 0.4, h * 0.56, pal.body);
        R(w * 0.34, h * 0.1, w * 0.32, h * 0.2, pal.head);
        break;
      }
      case 'squid': {
        R(w * 0.12, 0, w * 0.76, h * 0.55, pal.head);
        ctx.strokeStyle = pal.body;
        ctx.lineWidth = Math.max(2, w * 0.1);
        for (let i = 0; i < 4; i++) {
          const tx = w * (0.2 + i * 0.2);
          ctx.beginPath();
          ctx.moveTo(tx, h * 0.5);
          ctx.quadraticCurveTo(tx + Math.sin(m.bob + i) * w * 0.14, h * 0.78, tx, h);
          ctx.stroke();
        }
        R(w * 0.6, h * 0.16, w * 0.14, h * 0.12, pal.accent);
        break;
      }
      case 'blaze': {
        for (let i = 0; i < 6; i++) {
          const a = m.bob + i * 1.05;
          R(w * 0.5 + Math.cos(a) * w * 0.42 - w * 0.06, h * 0.5 + Math.sin(a) * h * 0.34,
            w * 0.14, h * 0.16, pal.accent);
        }
        R(w * 0.28, h * 0.3, w * 0.44, h * 0.46, pal.body);
        R(w * 0.3, h * 0.04, w * 0.4, h * 0.28, pal.head);
        break;
      }
      case 'ghast': {
        R(w * 0.06, 0, w * 0.88, h * 0.66, pal.body);
        ctx.strokeStyle = pal.head;
        ctx.lineWidth = Math.max(2, w * 0.07);
        for (let i = 0; i < 5; i++) {
          const tx = w * (0.14 + i * 0.18);
          ctx.beginPath();
          ctx.moveTo(tx, h * 0.64);
          ctx.lineTo(tx + Math.sin(m.bob + i) * w * 0.05, h);
          ctx.stroke();
        }
        R(w * 0.2, h * 0.26, w * 0.16, h * 0.1, pal.accent);
        R(w * 0.62, h * 0.26, w * 0.16, h * 0.1, pal.accent);
        R(w * 0.36, h * 0.44, w * 0.28, h * 0.1, pal.accent);
        break;
      }
      case 'dragon': {
        const flap = Math.sin(m.bob * 2) * h * 0.3;
        ctx.fillStyle = pal.body;
        ctx.beginPath();
        ctx.moveTo(w * 0.45, h * 0.4);
        ctx.lineTo(w * 0.05, h * 0.05 + flap);
        ctx.lineTo(w * 0.42, h * 0.62);
        ctx.closePath(); ctx.fill();
        R(w * 0.3, h * 0.34, w * 0.5, h * 0.3, pal.body);
        R(w * 0.74, h * 0.24, w * 0.26, h * 0.26, pal.head);
        R(w * 0.9, h * 0.3, w * 0.09, h * 0.07, pal.accent);
        ctx.fillStyle = pal.legs;
        ctx.beginPath();
        ctx.moveTo(w * 0.3, h * 0.46);
        ctx.lineTo(0, h * 0.72);
        ctx.lineTo(w * 0.3, h * 0.58);
        ctx.closePath(); ctx.fill();
        break;
      }
      default:
        R(0, 0, w, h, pal.body);
    }

    // The fuse flashes white faster and faster as it burns down.
    if (fuse > 0 && Math.floor(m.fuse * (6 + fuse * 10)) % 2 === 0) R(0, 0, w, h, 'rgba(255,255,255,0.55)');

    ctx.restore();

    if (m.onFire > 0) this.drawFlames(ctx, px, py, w, h, m.bob);

    if (m.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,60,50,${0.55 * (m.hurtFlash / 0.25)})`;
      ctx.fillRect(px, py, w, h);
    }

    // Health bar, only once something has actually hit it.
    if (m.health < m.maxHealth) {
      const bw = Math.max(w, SCALE * 0.9);
      const bx = px + w / 2 - bw / 2;
      const by = py - SCALE * 0.28;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(bx, by, bw, SCALE * 0.12);
      ctx.fillStyle = '#d33b32';
      ctx.fillRect(bx + 1, by + 1, (bw - 2) * (m.health / m.maxHealth), SCALE * 0.12 - 2);
    }
  }

  /** Flickering flames over a burning mob's box. */
  drawFlames(ctx, px, py, w, h, t) {
    ctx.save();
    const n = Math.max(3, Math.round(w / (SCALE * 0.25)));
    for (let i = 0; i < n; i++) {
      const fx = px + (i + 0.5) * (w / n);
      const flick = 0.6 + 0.4 * Math.sin(t * 7 + i * 2.1);
      const fh = h * 0.55 * flick;
      ctx.fillStyle = i % 2 ? 'rgba(255,196,60,0.85)' : 'rgba(240,110,30,0.85)';
      ctx.beginPath();
      ctx.moveTo(fx - w / n * 0.6, py + h);
      ctx.lineTo(fx, py + h - fh);
      ctx.lineTo(fx + w / n * 0.6, py + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Short-lived visuals: explosions, teleports, fangs, sonic booms and the like. */
  drawEffect(ctx, e) {
    if (e.t < 0) return;                          // fangs waiting their turn
    const k = Math.min(1, e.t / e.life);          // 0 -> 1 over its life
    const fade = 1 - k;
    const x = e.x * SCALE;
    const y = e.y * SCALE;
    // Stable pseudo-random scatter per particle, so bursts don't shimmer.
    const jitter = (i, s) => {
      const h = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
      return h - Math.floor(h) - 0.5;
    };
    const dots = (n, spread, rise, size, colour) => {
      ctx.fillStyle = colour;
      for (let i = 0; i < n; i++) {
        const dx = jitter(i, 1) * spread * SCALE;
        const dy = (jitter(i, 2) * spread - rise * k) * SCALE;
        ctx.fillRect(x + dx - size / 2, y + dy - size / 2, size, size);
      }
    };

    ctx.save();
    switch (e.kind) {
      case 'explosion': {
        const r = (e.r ?? 3) * SCALE * (0.5 + k * 0.8);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,248,220,${0.95 * fade})`);
        g.addColorStop(0.4, `rgba(240,150,60,${0.75 * fade})`);
        g.addColorStop(1, 'rgba(90,90,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = fade * 0.6;
        dots(14, (e.r ?? 3) * 1.4, 1, SCALE * 0.35, '#8a8a8a');
        break;
      }
      case 'teleport':
        ctx.globalAlpha = fade;
        dots(12, 1.4, 1.2, SCALE * 0.14, '#c26af0');
        break;
      case 'fang': {
        const up = Math.min(1, e.t / 0.18);
        const down = e.t > 0.6 ? Math.max(0, 1 - (e.t - 0.6) / 0.3) : 1;
        const fh = SCALE * 1.1 * up * down;
        const gap = (e.snapped ? 0.04 : 0.28) * SCALE;
        ctx.fillStyle = '#8a7a5a';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x + side * SCALE * 0.42, y);
          ctx.lineTo(x + side * gap, y - fh);
          ctx.lineTo(x + side * gap, y);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#e8e0c8';
        ctx.fillRect(x - gap - 2, y - fh, 4 + gap * 2 > 6 ? 3 : 2, fh * 0.3);
        break;
      }
      case 'sonic': {
        const x2 = e.x2 * SCALE;
        const y2 = e.y2 * SCALE;
        const n = Math.max(2, Math.round(Math.hypot(x2 - x, y2 - y) / (SCALE * 0.9)));
        ctx.strokeStyle = `rgba(58,216,200,${fade})`;
        ctx.lineWidth = 2;
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          ctx.beginPath();
          ctx.arc(x + (x2 - x) * t, y + (y2 - y) * t, SCALE * 0.3 * (1 + k), 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'ink':
        ctx.globalAlpha = 0.75 * fade;
        dots(16, 1.2 + k, 0, SCALE * 0.4, e.colour ?? '#10121c');
        break;
      case 'hearts':
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#e03a3a';
        ctx.font = `${Math.round(SCALE * 0.5)}px sans-serif`;
        for (let i = 0; i < 3; i++) ctx.fillText('\u2665', x + (i - 1) * SCALE * 0.5, y - k * SCALE * 1.2 - i * 4);
        break;
      case 'smoke':
        ctx.globalAlpha = 0.6 * fade;
        dots(8, 0.8, 1, SCALE * 0.25, '#9a9a9a');
        break;
      case 'sparkle':
        ctx.globalAlpha = fade;
        dots(10, 1, 0.8, SCALE * 0.12, e.colour ?? '#ffffff');
        break;
      case 'puff':
        ctx.globalAlpha = fade;
        dots(6, 0.5, 0, SCALE * 0.12, '#f4f8fc');
        break;
      case 'totem':
        ctx.globalAlpha = fade;
        dots(18, 1.6, 1.5, SCALE * 0.15, '#e8c43a');
        dots(12, 1.4, 1.8, SCALE * 0.12, '#5ad86a');
        break;
    }
    ctx.restore();
  }

  drawProjectile(ctx, p) {
    const px = p.x * SCALE;
    const py = p.centerY * SCALE;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.angle);

    if (p.kind === 'arrow') {
      ctx.fillStyle = '#6b4c2b';
      ctx.fillRect(-SCALE * 0.28, -SCALE * 0.03, SCALE * 0.5, SCALE * 0.06);
      ctx.fillStyle = '#c9c4bc';
      ctx.beginPath();
      ctx.moveTo(SCALE * 0.32, 0);
      ctx.lineTo(SCALE * 0.16, -SCALE * 0.09);
      ctx.lineTo(SCALE * 0.16, SCALE * 0.09);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8e4dc';
      ctx.fillRect(-SCALE * 0.3, -SCALE * 0.09, SCALE * 0.1, SCALE * 0.18);
    } else if (p.kind === 'fireball') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, SCALE * 0.4);
      g.addColorStop(0, '#fff2c0');
      g.addColorStop(0.5, '#e8892a');
      g.addColorStop(1, 'rgba(226,97,28,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, SCALE * 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'snowball') {
      ctx.fillStyle = '#f4f8fc';
      ctx.beginPath(); ctx.arc(0, 0, SCALE * 0.13, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'spit') {
      ctx.fillStyle = 'rgba(236,236,224,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, SCALE * 0.09, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'bullet') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, SCALE * 0.28);
      g.addColorStop(0, '#fffbe0');
      g.addColorStop(0.6, '#e8d8a0');
      g.addColorStop(1, 'rgba(216,200,232,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, SCALE * 0.28, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(210,215,225,0.6)';
      ctx.beginPath(); ctx.arc(0, 0, SCALE * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#430a09';
      ctx.beginPath(); ctx.arc(0, SCALE * 0.04, SCALE * 0.14, 0, Math.PI * 2); ctx.fill();
    }
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
