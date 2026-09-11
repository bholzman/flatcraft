import { TILE } from './config.js';
import { BLOCKS, ORE_SPECKLE, AIR, GRASS, WOOD, PLANKS, LEAVES, GLASS, WATER } from './blocks.js';

// Blocks are drawn from small offscreen canvases baked once at load. Keeps the
// pixel-art look without shipping any image assets.

const RES = 16;   // texture resolution in pixels, scaled up to TILE on draw

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(rgb, amount) {
  return rgb.map((c) => Math.max(0, Math.min(255, Math.round(c * amount))));
}

function rgbCss([r, g, b], a = 1) {
  return a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

/** Deterministic per-pixel jitter so every block of a type looks identical. */
function noiseAt(x, y, salt) {
  const n = Math.sin((x * 127.1 + y * 311.7 + salt * 74.7)) * 43758.5453;
  return n - Math.floor(n);
}

function bake(id) {
  const def = BLOCKS[id];
  const c = document.createElement('canvas');
  c.width = c.height = RES;
  const g = c.getContext('2d');

  if (!def.tint) return c;
  const base = hexToRgb(def.tint);

  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      const n = noiseAt(x, y, id);
      g.fillStyle = rgbCss(shade(base, 0.86 + n * 0.28));
      g.fillRect(x, y, 1, 1);
    }
  }

  if (id === GRASS) {
    // Dirt underside with a ragged grass line on top.
    const dirt = hexToRgb(BLOCKS[2].tint);
    for (let x = 0; x < RES; x++) {
      const lip = 4 + Math.floor(noiseAt(x, 0, 99) * 3);
      for (let y = lip; y < RES; y++) {
        const n = noiseAt(x, y, 2);
        g.fillStyle = rgbCss(shade(dirt, 0.86 + n * 0.28));
        g.fillRect(x, y, 1, 1);
      }
    }
  }

  if (id === WOOD) {
    for (let x = 2; x < RES; x += 5) {
      g.fillStyle = rgbCss(shade(base, 0.72), 0.8);
      g.fillRect(x, 0, 1, RES);
    }
  }

  if (id === PLANKS) {
    g.fillStyle = rgbCss(shade(base, 0.68), 0.9);
    for (let y = 3; y < RES; y += 5) g.fillRect(0, y, RES, 1);
    g.fillRect(RES / 2, 0, 1, 4);
    g.fillRect(RES / 4, 8, 1, 5);
  }

  if (id === LEAVES) {
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(noiseAt(i, 1, 7) * RES);
      const y = Math.floor(noiseAt(i, 2, 7) * RES);
      g.fillStyle = rgbCss(shade(base, 0.7), 0.7);
      g.fillRect(x, y, 2, 2);
    }
  }

  if (id === GLASS) {
    g.clearRect(0, 0, RES, RES);
    g.fillStyle = rgbCss(base, 0.22);
    g.fillRect(0, 0, RES, RES);
    g.strokeStyle = rgbCss(shade(base, 1.1), 0.75);
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, RES - 1, RES - 1);
    g.globalAlpha = 0.5;
    g.beginPath();
    g.moveTo(2, RES - 3);
    g.lineTo(RES - 3, 2);
    g.stroke();
    g.globalAlpha = 1;
  }

  if (id === WATER) {
    g.clearRect(0, 0, RES, RES);
    g.fillStyle = rgbCss(base, 0.55);
    g.fillRect(0, 0, RES, RES);
  }

  const speckle = ORE_SPECKLE[id];
  if (speckle) {
    const srgb = hexToRgb(speckle);
    for (let i = 0; i < 7; i++) {
      const x = 1 + Math.floor(noiseAt(i, id, 13) * (RES - 4));
      const y = 1 + Math.floor(noiseAt(id, i, 29) * (RES - 4));
      const s = 2 + Math.floor(noiseAt(i, i, id) * 2);
      g.fillStyle = rgbCss(srgb);
      g.fillRect(x, y, s, s);
      g.fillStyle = rgbCss(shade(srgb, 1.35), 0.8);
      g.fillRect(x, y, 1, 1);
    }
  }

  return c;
}

export const textures = {};

export function bakeAll() {
  for (const id of Object.keys(BLOCKS).map(Number)) {
    if (id === AIR) continue;
    textures[id] = bake(id);
  }
}

/** Small canvas of a block, for the hotbar swatches. */
export function swatchDataURL(id, size = 32) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (textures[id]) g.drawImage(textures[id], 0, 0, size, size);
  return c.toDataURL();
}

export { RES as TEXTURE_RES, TILE };
