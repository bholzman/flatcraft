import { BLOCKS, AIR, block } from './blocks.js';
import { ITEMS } from './items.js';

// Blocks are drawn from small offscreen canvases baked once at load, so the
// pixel-art look costs no image assets. One painter per `style` in blocks.js.

const RES = 16;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(rgb, amount) {
  return rgb.map((c) => Math.max(0, Math.min(255, Math.round(c * amount))));
}

function css([r, g, b], a = 1) {
  return a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

/** Deterministic per-pixel jitter, so every block of a type looks identical. */
function noiseAt(x, y, salt) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Fill the tile with speckled base colour. */
function grain(g, base, salt, spread = 0.28, lo = 0.86) {
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      g.fillStyle = css(shade(base, lo + noiseAt(x, y, salt) * spread));
      g.fillRect(x, y, 1, 1);
    }
  }
}

const PAINTERS = {
  plain: (g, base, d) => grain(g, base, d.id),

  grass: (g, base, d) => {
    const soil = hexToRgb(block(d.soil).tint);
    grain(g, soil, d.soil);
    for (let x = 0; x < RES; x++) {
      const lip = 4 + Math.floor(noiseAt(x, 0, d.id) * 3);
      for (let y = 0; y < lip; y++) {
        g.fillStyle = css(shade(base, 0.86 + noiseAt(x, y, d.id) * 0.28));
        g.fillRect(x, y, 1, 1);
      }
    }
  },

  cobble: (g, base, d) => {
    grain(g, shade(base, 0.8), d.id, 0.1);
    for (let i = 0; i < 9; i++) {                       // rounded stones
      const x = Math.floor(noiseAt(i, 1, d.id) * (RES - 4));
      const y = Math.floor(noiseAt(i, 2, d.id) * (RES - 4));
      const w = 3 + Math.floor(noiseAt(i, 3, d.id) * 3);
      g.fillStyle = css(shade(base, 0.95 + noiseAt(i, 4, d.id) * 0.35));
      g.fillRect(x, y, w, w);
    }
  },

  layered: (g, base, d) => {
    grain(g, base, d.id, 0.14);
    g.fillStyle = css(shade(base, 0.78), 0.7);
    for (let y = 3; y < RES; y += 4) g.fillRect(0, y, RES, 1);
  },

  log: (g, base, d) => {
    grain(g, base, d.id, 0.2);
    g.fillStyle = css(shade(base, 0.68), 0.75);
    for (let x = 2; x < RES; x += 5) g.fillRect(x, 0, 1, RES);
  },

  birch_log: (g, base, d) => {
    grain(g, base, d.id, 0.12);
    g.fillStyle = css(shade(base, 0.32), 0.85);
    for (let i = 0; i < 5; i++) {
      const y = Math.floor(noiseAt(i, 1, d.id) * RES);
      const x = Math.floor(noiseAt(i, 2, d.id) * (RES - 5));
      g.fillRect(x, y, 3 + Math.floor(noiseAt(i, 3, d.id) * 3), 1);
    }
  },

  planks: (g, base, d) => {
    grain(g, base, d.id, 0.18);
    g.fillStyle = css(shade(base, 0.66), 0.9);
    for (let y = 3; y < RES; y += 5) g.fillRect(0, y, RES, 1);
    g.fillRect(RES / 2, 0, 1, 4);
    g.fillRect(RES / 4, 8, 1, 5);
  },

  bricks: (g, base, d) => {
    grain(g, base, d.id, 0.14);
    g.fillStyle = css(shade(base, 0.6), 0.9);
    for (let y = 3; y < RES; y += 4) g.fillRect(0, y, RES, 1);
    for (let row = 0; row < 4; row++) {
      const x = row % 2 === 0 ? 4 : 11;
      g.fillRect(x, row * 4, 1, 3);
    }
  },

  leaves: (g, base, d) => {
    grain(g, base, d.id, 0.3);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(noiseAt(i, 1, d.id) * RES);
      const y = Math.floor(noiseAt(i, 2, d.id) * RES);
      g.fillStyle = css(shade(base, 0.66), 0.7);
      g.fillRect(x, y, 2, 2);
    }
  },

  moss: (g, base, d) => {
    grain(g, base, d.id, 0.34);
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(noiseAt(i, 5, d.id) * RES);
      const y = Math.floor(noiseAt(i, 6, d.id) * RES);
      g.fillStyle = css(shade(base, 1.28), 0.55);
      g.fillRect(x, y, 2, 1);
    }
  },

  soul: (g, base, d) => {
    grain(g, base, d.id, 0.22);
    for (let i = 0; i < 3; i++) {                       // hollow-eyed faces
      const x = 2 + Math.floor(noiseAt(i, 7, d.id) * (RES - 7));
      const y = 2 + Math.floor(noiseAt(i, 8, d.id) * (RES - 8));
      g.fillStyle = css(shade(base, 0.5), 0.85);
      g.fillRect(x, y, 2, 2);
      g.fillRect(x + 3, y, 2, 2);
      g.fillRect(x + 1, y + 4, 3, 1);
    }
  },

  magma: (g, base, d) => {
    grain(g, shade(base, 0.55), d.id, 0.2);
    for (let i = 0; i < 10; i++) {                      // glowing cracks
      const x = Math.floor(noiseAt(i, 9, d.id) * (RES - 3));
      const y = Math.floor(noiseAt(i, 10, d.id) * (RES - 3));
      g.fillStyle = css(shade(base, 1.9), 0.9);
      g.fillRect(x, y, 3, 2);
    }
  },

  glow: (g, base, d) => {
    grain(g, base, d.id, 0.26);
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(noiseAt(i, 11, d.id) * (RES - 3));
      const y = Math.floor(noiseAt(i, 12, d.id) * (RES - 3));
      g.fillStyle = css(shade(base, 1.5), 0.85);
      g.fillRect(x, y, 2, 2);
    }
  },

  sculk: (g, base, d) => {
    grain(g, base, d.id, 0.2);
    for (let i = 0; i < 14; i++) {                      // cyan filaments
      const x = Math.floor(noiseAt(i, 13, d.id) * RES);
      const y = Math.floor(noiseAt(i, 14, d.id) * RES);
      g.fillStyle = `rgba(90,220,210,${0.25 + noiseAt(i, 15, d.id) * 0.5})`;
      g.fillRect(x, y, 1, 1 + Math.floor(noiseAt(i, 16, d.id) * 2));
    }
  },

  ore: (g, base, d) => {
    grain(g, base, d.id);
    const s = hexToRgb(d.speckle);
    for (let i = 0; i < 7; i++) {
      const x = 1 + Math.floor(noiseAt(i, d.id, 13) * (RES - 4));
      const y = 1 + Math.floor(noiseAt(d.id, i, 29) * (RES - 4));
      const size = 2 + Math.floor(noiseAt(i, i, d.id) * 2);
      g.fillStyle = css(s);
      g.fillRect(x, y, size, size);
      g.fillStyle = css(shade(s, 1.35), 0.8);
      g.fillRect(x, y, 1, 1);
    }
  },

  glass: (g, base) => {
    g.fillStyle = css(base, 0.2);
    g.fillRect(0, 0, RES, RES);
    g.strokeStyle = css(shade(base, 1.1), 0.75);
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, RES - 1, RES - 1);
    g.globalAlpha = 0.5;
    g.beginPath();
    g.moveTo(2, RES - 3);
    g.lineTo(RES - 3, 2);
    g.stroke();
    g.globalAlpha = 1;
  },

  /**
   * Ice reads as ice through frost and fractures, not through transparency.
   * Drawn at the `alpha` on the block definition: the glass painter's 20%
   * left it looking like a black square anywhere the background was dark.
   */
  ice: (g, base, d) => {
    const alpha = d.alpha ?? 0.78;

    // Frosted body, lit from the top-left so a face has some form to it.
    for (let y = 0; y < RES; y++) {
      for (let x = 0; x < RES; x++) {
        const n = noiseAt(x, y, d.id);
        const form = 1.1 - (x + y) / (RES * 7);
        g.fillStyle = css(shade(base, form + n * 0.14), alpha);
        g.fillRect(x, y, 1, 1);
      }
    }

    // Internal fractures: pale seams at shallow angles, a few per block.
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x0 = noiseAt(i, 50, d.id) * RES;
      const y0 = noiseAt(i, 51, d.id) * RES;
      const len = 4 + noiseAt(i, 52, d.id) * 9;
      const dir = noiseAt(i, 53, d.id) > 0.5 ? 1 : -1;
      g.strokeStyle = `rgba(242,251,255,${0.22 + noiseAt(i, 54, d.id) * 0.33})`;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + len, y0 + len * 0.5 * dir);
      g.stroke();
    }

    // A glint, which is what actually says "ice" rather than "blue block".
    g.fillStyle = 'rgba(255,255,255,0.62)';
    g.fillRect(3, 2, 4, 1);
    g.fillRect(3, 3, 2, 1);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(RES - 6, RES - 5, 3, 1);

    // Lit top edge, shaded bottom, so stacked ice still shows its courses.
    g.fillStyle = 'rgba(255,255,255,0.42)';
    g.fillRect(0, 0, RES, 1);
    g.fillStyle = 'rgba(28,58,104,0.34)';
    g.fillRect(0, RES - 1, RES, 1);
  },

  liquid: (g, base, d) => {
    g.fillStyle = css(base, d.emit > 0.5 ? 0.92 : 0.55);
    g.fillRect(0, 0, RES, RES);
    for (let i = 0; i < 6; i++) {
      const y = Math.floor(noiseAt(i, 17, d.id) * RES);
      g.fillStyle = css(shade(base, 1.25), 0.35);
      g.fillRect(0, y, RES, 1);
    }
  },

  portal: (g, base, d) => {
    g.fillStyle = css(base, 0.72);
    g.fillRect(0, 0, RES, RES);
    for (let i = 0; i < 22; i++) {                      // drifting sparks
      const x = Math.floor(noiseAt(i, 18, d.id) * RES);
      const y = Math.floor(noiseAt(i, 19, d.id) * RES);
      g.fillStyle = `rgba(230,210,255,${0.25 + noiseAt(i, 20, d.id) * 0.6})`;
      g.fillRect(x, y, 1, 1);
    }
  },

  column: (g, base, d) => {                             // cactus and the like
    g.fillStyle = css(shade(base, 0.85));
    g.fillRect(2, 0, RES - 4, RES);
    g.fillStyle = css(base);
    g.fillRect(4, 0, RES - 8, RES);
    g.fillStyle = css(shade(base, 0.55), 0.8);
    for (let y = 1; y < RES; y += 4) {
      g.fillRect(3, y, 1, 2);
      g.fillRect(RES - 4, y, 1, 2);
    }
  },

  plant: (g, base, d) => {                              // tufts rooted at the bottom
    for (let i = 0; i < 7; i++) {
      const x = 2 + Math.floor(noiseAt(i, 21, d.id) * (RES - 4));
      const h = 5 + Math.floor(noiseAt(i, 22, d.id) * 8);
      g.fillStyle = css(shade(base, 0.8 + noiseAt(i, 23, d.id) * 0.5));
      g.fillRect(x, RES - h, 1, h);
      if (h > 8) g.fillRect(x + 1, RES - h + 1, 1, h - 2);
    }
  },

  flower: (g, base, d) => {
    g.fillStyle = '#3f7a32';
    g.fillRect(RES / 2, RES - 8, 1, 8);
    g.fillRect(RES / 2 - 2, RES - 5, 2, 1);
    g.fillStyle = css(base);
    g.fillRect(RES / 2 - 2, RES - 12, 5, 4);
    g.fillStyle = css(shade(base, 1.35), 0.9);
    g.fillRect(RES / 2 - 1, RES - 11, 3, 2);
  },

  vine: (g, base, d) => {                               // strands hung from the top
    for (let i = 0; i < 5; i++) {
      const x = 1 + Math.floor(noiseAt(i, 24, d.id) * (RES - 2));
      const h = 6 + Math.floor(noiseAt(i, 25, d.id) * 10);
      g.fillStyle = css(shade(base, 0.85 + noiseAt(i, 26, d.id) * 0.4));
      g.fillRect(x, 0, 1, h);
      if (d.emit > 0.5 && noiseAt(i, 27, d.id) > 0.5) {
        g.fillStyle = css(shade(base, 1.5));
        g.fillRect(x - 1, h - 2, 3, 3);                 // berry
      }
    }
  },

  flat: (g, base, d) => {                               // lily pads, dripleaf
    g.fillStyle = css(base);
    g.fillRect(1, RES - 5, RES - 2, 3);
    g.fillStyle = css(shade(base, 1.25), 0.8);
    g.fillRect(2, RES - 5, RES - 4, 1);
  },

  cracked: (g, base, d) => {
    PAINTERS.bricks(g, base, d);
    g.strokeStyle = css(shade(base, 0.45), 0.9);
    g.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(noiseAt(i, 40, d.id) * RES);
      const y = Math.floor(noiseAt(i, 41, d.id) * RES);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 3 - noiseAt(i, 42, d.id) * 6, y + 4);
      g.stroke();
    }
  },

  chiseled: (g, base, d) => {
    grain(g, base, d.id, 0.12);
    g.fillStyle = css(shade(base, 0.6), 0.9);
    g.strokeRect(1.5, 1.5, RES - 3, RES - 3);
    g.fillRect(1, 1, RES - 2, 1);
    g.fillRect(1, RES - 2, RES - 2, 1);
    g.fillStyle = css(shade(base, 0.72), 0.85);
    g.fillRect(5, 4, 6, 8);                              // engraved face
    g.fillStyle = css(shade(base, 1.2), 0.8);
    g.fillRect(7, 6, 2, 4);
  },

  chest: (g, base, d) => {
    grain(g, base, d.id, 0.16);
    g.fillStyle = css(shade(base, 0.55), 0.95);
    g.fillRect(0, 5, RES, 2);                            // lid seam
    g.strokeStyle = css(shade(base, 0.4), 0.9);
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, RES - 1, RES - 1);
    g.fillStyle = '#d8bf5a';                             // latch
    g.fillRect(RES / 2 - 2, 4, 4, 4);
    g.fillStyle = '#4a3a1a';
    g.fillRect(RES / 2 - 1, 5, 2, 2);
  },

  cage: (g, base, d) => {
    grain(g, shade(base, 0.7), d.id, 0.12);
    g.strokeStyle = css(shade(base, 1.6), 0.9);
    g.lineWidth = 1;
    for (let i = 2; i < RES; i += 4) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, RES); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(RES, i); g.stroke();
    }
    g.fillStyle = 'rgba(90,220,210,0.5)';                // something glowing inside
    g.fillRect(6, 6, 4, 4);
  },

  crafting: (g, base, d) => {
    PAINTERS.planks(g, base, d);
    g.fillStyle = 'rgba(40,28,16,0.85)';
    g.fillRect(2, 2, RES - 4, RES - 4);
    g.fillStyle = css(shade(base, 1.25));
    for (let i = 0; i < 4; i++) {
      g.fillRect(3 + (i % 2) * 6, 3 + Math.floor(i / 2) * 6, 5, 5);
    }
  },

  furnace: (g, base, d) => {
    PAINTERS.cobble(g, base, d);
    g.fillStyle = '#1e1e22';
    g.fillRect(3, 7, RES - 6, 7);                        // mouth
    g.fillStyle = '#e2611c';
    g.fillRect(5, 10, RES - 10, 3);
    g.fillStyle = '#f0c04a';
    g.fillRect(6, 11, 3, 1);
  },

  bookshelf: (g, base, d) => {
    PAINTERS.planks(g, base, d);
    g.fillStyle = 'rgba(40,28,16,0.8)';
    g.fillRect(0, 3, RES, 10);
    const spines = ['#a83a32', '#3a6aa8', '#c9a834', '#4a8a3a', '#8a4aa8'];
    for (let i = 0; i < 6; i++) {
      g.fillStyle = spines[i % spines.length];
      g.fillRect(1 + i * 2.5, 4, 2, 8);
    }
  },

  web: (g, base) => {
    g.strokeStyle = css(base, 0.75);
    g.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      g.beginPath();
      g.moveTo(RES / 2 - Math.cos(a) * 8, RES / 2 - Math.sin(a) * 8);
      g.lineTo(RES / 2 + Math.cos(a) * 8, RES / 2 + Math.sin(a) * 8);
      g.stroke();
    }
    for (const r of [3, 6]) {
      g.beginPath();
      g.arc(RES / 2, RES / 2, r, 0, Math.PI * 2);
      g.stroke();
    }
  },

  rail: (g, base) => {
    g.fillStyle = '#6b4c2b';
    for (let x = 1; x < RES; x += 4) g.fillRect(x, RES - 5, 3, 3);
    g.fillStyle = css(base);
    g.fillRect(0, RES - 6, RES, 1);
    g.fillRect(0, RES - 2, RES, 1);
  },

  fence: (g, base) => {
    g.fillStyle = css(base);
    g.fillRect(RES / 2 - 2, 0, 4, RES);                  // post
    g.fillStyle = css(shade(base, 0.8));
    g.fillRect(0, 4, RES, 2);                            // rails
    g.fillRect(0, 10, RES, 2);
  },

  ladder: (g, base) => {
    g.fillStyle = css(base);
    g.fillRect(2, 0, 2, RES);
    g.fillRect(RES - 4, 0, 2, RES);
    g.fillStyle = css(shade(base, 1.15));
    for (let y = 2; y < RES; y += 5) g.fillRect(2, y, RES - 4, 2);
  },

  door: (g, base, d) => {
    PAINTERS.planks(g, base, d);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, 2, RES);
    g.fillRect(RES - 2, 0, 2, RES);
    g.fillStyle = '#d8bf5a';
    g.fillRect(RES - 5, RES / 2 - 1, 2, 2);              // handle
  },

  crystal: (g, base, d) => {
    grain(g, shade(base, 0.8), d.id, 0.2);
    for (let i = 0; i < 5; i++) {
      const x = 2 + Math.floor(noiseAt(i, 43, d.id) * (RES - 6));
      const y = 2 + Math.floor(noiseAt(i, 44, d.id) * (RES - 8));
      g.fillStyle = css(shade(base, 1.45), 0.9);
      g.beginPath();
      g.moveTo(x + 2, y);
      g.lineTo(x + 4, y + 5);
      g.lineTo(x, y + 5);
      g.closePath(); g.fill();
      g.fillStyle = css(shade(base, 1.9), 0.8);
      g.fillRect(x + 2, y + 1, 1, 3);
    }
  },

  tnt: (g, base, d) => {
    grain(g, base, d.id, 0.14);
    g.fillStyle = '#e8e4dc';
    g.fillRect(0, 5, RES, 6);
    g.fillStyle = '#2a2a2a';
    g.font = 'bold 6px monospace';
    g.fillText('TNT', 2, 10);
  },

  wool: (g, base, d) => {
    grain(g, base, d.id, 0.16);
    g.fillStyle = css(shade(base, 0.88), 0.5);
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(noiseAt(i, 45, d.id) * RES);
      const y = Math.floor(noiseAt(i, 46, d.id) * RES);
      g.fillRect(x, y, 2, 1);
    }
  },

  lantern: (g, base) => {
    g.fillStyle = '#4a4a52';
    g.fillRect(RES / 2 - 1, 0, 2, 3);                    // chain
    g.fillRect(RES / 2 - 4, 3, 8, 2);
    g.fillStyle = css(base);
    g.fillRect(RES / 2 - 3, 5, 6, 6);
    g.fillStyle = css(shade(base, 1.5));
    g.fillRect(RES / 2 - 2, 6, 4, 4);
    g.fillStyle = '#4a4a52';
    g.fillRect(RES / 2 - 4, 11, 8, 2);
  },

  torch: (g, base) => {
    g.fillStyle = '#6b4c2b';
    g.fillRect(RES / 2 - 1, RES - 9, 2, 9);
    g.fillStyle = css(base);
    g.fillRect(RES / 2 - 1, RES - 12, 2, 3);
    g.fillStyle = '#fff3c4';
    g.fillRect(RES / 2 - 1, RES - 12, 1, 1);
  },
};

// Item icons are drawn the same way as blocks, keyed into the same table, so
// the hotbar and palette don't care whether a slot holds a block or an item.
const ITEM_PAINTERS = {
  sword: (g, base) => {
    g.strokeStyle = '#3a2c1e';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(4, 12); g.lineTo(7, 9); g.stroke();      // hilt
    g.fillStyle = '#6b4c2b';
    g.fillRect(3, 11, 3, 3);
    g.fillStyle = '#8a6a3a';
    g.fillRect(5, 8, 5, 2);                                          // guard
    g.fillStyle = css(base);
    g.beginPath();
    g.moveTo(7, 9); g.lineTo(13, 3); g.lineTo(14, 4); g.lineTo(8, 10);
    g.closePath(); g.fill();
    g.fillStyle = css(shade(base, 1.4), 0.9);
    g.fillRect(12, 3, 2, 2);
  },

  bow: (g, base) => {
    g.strokeStyle = css(base);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(6, 8, 6, -Math.PI / 2.2, Math.PI / 2.2);                   // limb
    g.stroke();
    g.strokeStyle = '#e8e4dc';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(3, 2); g.lineTo(3, 14); g.stroke();      // string
    g.strokeStyle = '#c9c4bc';
    g.beginPath(); g.moveTo(3, 8); g.lineTo(13, 8); g.stroke();      // nocked arrow
  },

  arrow: (g, base) => {
    g.strokeStyle = '#6b4c2b';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(3, 13); g.lineTo(12, 4); g.stroke();
    g.fillStyle = css(base);
    g.beginPath();
    g.moveTo(13, 3); g.lineTo(13, 7); g.lineTo(9, 5);
    g.closePath(); g.fill();
    g.fillStyle = '#e8e4dc';
    g.fillRect(2, 12, 3, 1);
    g.fillRect(3, 13, 1, 2);
  },

  potion: (g, base) => {
    g.fillStyle = '#c8c4bc';
    g.fillRect(7, 2, 2, 3);                                          // neck
    g.fillStyle = 'rgba(210,215,225,0.55)';
    g.beginPath(); g.arc(8, 10, 5, 0, Math.PI * 2); g.fill();        // glass
    g.fillStyle = css(base);
    g.beginPath(); g.arc(8, 11, 4, 0, Math.PI * 2); g.fill();        // contents
    g.fillStyle = css(shade(base, 1.5), 0.8);
    g.fillRect(6, 8, 2, 1);
  },

  igniter: (g, base) => {
    g.fillStyle = css(base);                              // steel striker
    g.beginPath();
    g.moveTo(3, 4); g.lineTo(9, 4); g.lineTo(9, 7); g.lineTo(5, 7); g.lineTo(5, 10); g.lineTo(3, 10);
    g.closePath(); g.fill();
    g.fillStyle = '#4a4a52';                              // flint
    g.fillRect(9, 9, 5, 4);
    g.fillStyle = '#f0c04a';                              // sparks
    g.fillRect(7, 8, 2, 2);
    g.fillRect(11, 6, 1, 1);
    g.fillStyle = '#fff3c4';
    g.fillRect(8, 8, 1, 1);
  },

  stick: (g, base) => {
    g.strokeStyle = css(base);
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(4, 12); g.lineTo(12, 4); g.stroke();
    g.strokeStyle = css(shade(base, 0.7), 0.8);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(5, 12); g.lineTo(12, 5); g.stroke();
  },

  ingot: (g, base) => {
    g.fillStyle = css(shade(base, 0.72));
    g.beginPath();
    g.moveTo(2, 11); g.lineTo(14, 11); g.lineTo(12, 14); g.lineTo(4, 14);
    g.closePath(); g.fill();
    g.fillStyle = css(base);
    g.beginPath();
    g.moveTo(3, 6); g.lineTo(13, 6); g.lineTo(14, 11); g.lineTo(2, 11);
    g.closePath(); g.fill();
    g.fillStyle = css(shade(base, 1.3), 0.85);
    g.fillRect(4, 7, 7, 1);
  },

  nugget: (g, base, d) => {
    for (let i = 0; i < 4; i++) {
      const x = 3 + Math.floor(noiseAt(i, 60, d.id) * 8);
      const y = 3 + Math.floor(noiseAt(i, 61, d.id) * 8);
      const s = 3 + Math.floor(noiseAt(i, 62, d.id) * 2);
      g.fillStyle = css(shade(base, 0.85 + noiseAt(i, 63, d.id) * 0.5));
      g.fillRect(x, y, s, s);
      g.fillStyle = css(shade(base, 1.6), 0.7);
      g.fillRect(x, y, 1, 1);
    }
  },

  gem: (g, base) => {
    g.fillStyle = css(base);
    g.beginPath();
    g.moveTo(8, 2); g.lineTo(13, 7); g.lineTo(8, 14); g.lineTo(3, 7);
    g.closePath(); g.fill();
    g.fillStyle = css(shade(base, 1.45), 0.9);
    g.beginPath();
    g.moveTo(8, 2); g.lineTo(13, 7); g.lineTo(8, 7);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(6, 5, 2, 1);
  },

  material: (g, base, d) => {
    grain(g, base, d.id, 0.3);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, RES, 3);
    g.fillRect(0, RES - 3, RES, 3);
    g.fillRect(0, 0, 3, RES);
    g.fillRect(RES - 3, 0, 3, RES);
  },
};

export const textures = {};

// A black silhouette of each texture, carrying its alpha. Shading by filling
// the whole cell with black paints the transparent parts of a plant or a torch
// too, which shows up as a black square behind it at night.
export const shadowMasks = {};

function bakeInto(id, painter, tint, def) {
  const c = document.createElement('canvas');
  c.width = c.height = RES;
  const g = c.getContext('2d');
  painter(g, hexToRgb(tint), def);
  textures[id] = c;

  const mask = document.createElement('canvas');
  mask.width = mask.height = RES;
  const mg = mask.getContext('2d');
  mg.drawImage(c, 0, 0);
  mg.globalCompositeOperation = 'source-in';   // keep this texture's alpha
  mg.fillStyle = '#000';
  mg.fillRect(0, 0, RES, RES);
  shadowMasks[id] = mask;
}

export function bakeAll() {
  for (const d of Object.values(BLOCKS)) {
    if (d.id === AIR || d.style === 'none' || !d.tint) continue;
    bakeInto(d.id, PAINTERS[d.style] ?? PAINTERS.plain, d.tint, d);
  }
  for (const d of Object.values(ITEMS)) {
    bakeInto(d.id, ITEM_PAINTERS[d.icon] ?? ITEM_PAINTERS.material, d.tint, d);
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

export { RES as TEXTURE_RES };
