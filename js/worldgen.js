import * as B from './blocks.js';
import { BIOMES } from './biomes.js';
import { CAVE_TOP_OFFSET, DEEPSLATE_AT, LUSH_CAVES_AT, DEEP_DARK_AT } from './config.js';
import { placeStructures } from './structures.js';

// ---------------------------------------------------------------- randomness

/** Small deterministic PRNG so a seed always regenerates the same world. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 1-D value noise: smooth interpolation between per-integer random values. */
function makeNoise1D(rand) {
  const table = new Float32Array(2048).map(() => rand());
  const at = (i) => table[((i % 2048) + 2048) % 2048];
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const t = f * f * (3 - 2 * f);
    return at(i) + (at(i + 1) - at(i)) * t;
  };
}

/** Stable per-cell hash in [0,1); used where a noise table would be overkill. */
function hash2(x, y, salt) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// ---------------------------------------------------------------- heights

const BLEND = 16;   // blocks of cross-fade either side of a band boundary

function biomeHeight(bi, x, coarse, fine) {
  if (!bi.height) return null;
  const { base, amp, freq } = bi.height;
  return base
    - (coarse(x / freq) - 0.5) * amp * 2
    - (fine(x / (freq / 4)) - 0.5) * amp * 0.5;
}

/**
 * Surface height per column, cross-faded across band boundaries so a mesa
 * doesn't end in a cliff where it meets the plains.
 * Also returns, per column, the neighbouring band and how strongly it bleeds in.
 */
function computeHeights(world, coarse, fine) {
  const { bands, width } = world;
  const heights = new Int32Array(width);
  const blendWith = new Int32Array(width).fill(-1);
  const blendAmt = new Float32Array(width);

  let bi = 0;
  for (let x = 0; x < width; x++) {
    while (bi < bands.length - 1 && x >= bands[bi].x1) bi++;
    const band = bands[bi];

    let other = -1;
    let t = 0;
    const dLeft = x - band.x0;
    const dRight = band.x1 - 1 - x;
    if (dLeft < BLEND && bi > 0) {
      other = bi - 1;
      t = 0.5 * (1 - dLeft / BLEND);
    } else if (dRight < BLEND && bi < bands.length - 1) {
      other = bi + 1;
      t = 0.5 * (1 - dRight / BLEND);
    }

    const a = BIOMES[band.id];
    const b = other >= 0 ? BIOMES[bands[other].id] : a;
    const ha = biomeHeight(a, x, coarse, fine);
    const hb = biomeHeight(b, x, coarse, fine) ?? ha;

    heights[x] = ha === null ? -1 : Math.round(ha * (1 - t) + hb * t);
    blendWith[x] = other;
    blendAmt[x] = t;
  }

  return { heights, blendWith, blendAmt };
}

/**
 * The biome whose materials a column should use. Near a boundary the two
 * biomes interfinger rather than meeting on a straight line; grouping the
 * hash by threes keeps that from degenerating into one-block pinstripes.
 */
function materialBiome(world, x, blendWith, blendAmt) {
  if (blendWith[x] >= 0 && hash2(Math.floor(x / 3), 0, 5) < blendAmt[x]) {
    return BIOMES[world.bands[blendWith[x]].id];
  }
  return BIOMES[world.bandAt(x).id];
}

// ---------------------------------------------------------------- shared passes

/** Two offset noise fields; where they nearly agree, carve a tunnel. */
function carveCaves(world, noiseA, noiseB, heights, opts = {}) {
  const { width, height } = world;
  const top = opts.top ?? CAVE_TOP_OFFSET;
  const density = opts.density ?? 0.055;
  const floor = opts.floor ?? 5;

  for (let x = 0; x < width; x++) {
    const start = (heights[x] < 0 ? 0 : heights[x]) + top;
    for (let y = start; y < height - floor; y++) {
      const depth = (y - start) / Math.max(1, height - start);
      const a = noiseA(x / 18 + y / 11);
      const b = noiseB(x / 13 - y / 17);
      if (Math.abs(a - b) < density + depth * 0.035) world.put(x, y, B.AIR);
    }
  }
}

/** Random-walk veins, seeded within a depth window below the terrain. */
function scatterOres(world, rand, heights, veins) {
  const { width, height } = world;

  for (const vein of veins) {
    const tries = Math.round(width * vein.rate);
    for (let n = 0; n < tries; n++) {
      const x = Math.floor(rand() * width);
      const top = heights[x] < 0 ? 0 : heights[x];
      const lo = top + vein.minDepth;
      const hi = Math.min(height - 4, top + vein.maxDepth);
      if (hi <= lo) continue;

      let cx = x;
      let cy = Math.floor(lo + rand() * (hi - lo));
      if (world.get(cx, cy) !== vein.host) continue;

      const size = 2 + Math.floor(rand() * vein.maxSize);
      for (let i = 0; i < size; i++) {
        if (world.get(cx, cy) === vein.host) world.put(cx, cy, vein.id);
        cx += Math.floor(rand() * 3) - 1;
        cy += Math.floor(rand() * 3) - 1;
      }
    }
  }
}

/**
 * Cap the waterline with ice wherever the biome is cold enough. Runs after
 * flooding so it only ever replaces water that actually formed.
 */
function freezeSurface(world, blendWith, blendAmt) {
  const level = world.liquidLevel;
  if (level < 0) return;

  for (let x = 0; x < world.width; x++) {
    const bi = materialBiome(world, x, blendWith, blendAmt);
    if (!bi.freezes) continue;

    // Open ocean freezes a couple of blocks deep; shallows just skin over.
    const depth = world.ground[x] - level;
    const thickness = depth > 8 ? 2 : 1;
    for (let i = 0; i < thickness; i++) {
      if (world.get(x, level + i) === B.WATER) world.put(x, level + i, B.ICE);
    }
  }
}

/** Flood every air cell at or below the liquid level. */
function fillLiquid(world, level, liquidId) {
  if (level < 0) return;
  const { width, height } = world;
  for (let x = 0; x < width; x++) {
    for (let y = level; y < height; y++) {
      if (world.get(x, y) !== B.AIR) continue;
      // Only flood cells connected to the open surface, not sealed cave pockets.
      if (y === level || world.get(x, y - 1) === liquidId) world.put(x, y, liquidId);
    }
  }
}

// ---------------------------------------------------------------- features

/** Rounded clump of `id`, with a ragged outer ring so crowns aren't circles. */
function blob(world, cx, cy, r, id, ragged = true) {
  const rr = (r + 0.5) * (r + 0.5);
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > rr + 2.5) continue;
      if (ragged && d2 > rr && hash2(cx + dx, cy + dy, 3) < 0.45) continue;
      if (world.get(cx + dx, cy + dy) === B.AIR) world.put(cx + dx, cy + dy, id);
    }
  }
}

function hangVines(world, x, y, id, rand, maxLen = 4) {
  const len = 1 + Math.floor(rand() * maxLen);
  for (let i = 0; i < len; i++) {
    if (world.get(x, y + i) !== B.AIR) break;
    world.put(x, y + i, id);
  }
}

function placeTree(world, x, top, f, rand) {
  const h = f.minH + Math.floor(rand() * (f.maxH - f.minH + 1));
  const trunkTop = top - h;

  const trunk = (tx = x, from = 1, to = h) => {
    for (let i = from; i <= to; i++) world.put(tx, top - i, f.log);
  };

  switch (f.shape) {
    case 'spruce': {
      trunk();
      for (let i = 0; i < h - 2; i++) {
        const y = trunkTop + i + 1;
        const r = Math.max(1, Math.round((h - 2 - i) / 2.4));
        for (let dx = -r; dx <= r; dx++) {
          if (dx === 0 && y > trunkTop + 1) continue;
          if (world.get(x + dx, y) === B.AIR) world.put(x + dx, y, f.leaves);
        }
      }
      world.put(x, trunkTop - 1, f.leaves);
      break;
    }
    case 'acacia': {
      const lean = rand() < 0.5 ? -1 : 1;
      for (let i = 1; i <= h; i++) world.put(x + (i > h / 2 ? lean : 0), top - i, f.log);
      const cx = x + lean;
      for (let dx = -3; dx <= 3; dx++) {
        world.put(cx + dx, trunkTop - 1, f.leaves);
        if (Math.abs(dx) <= 2) world.put(cx + dx, trunkTop - 2, f.leaves);
      }
      break;
    }
    case 'jungle': {
      trunk();
      blob(world, x, trunkTop + 1, 3, f.leaves);
      for (const dx of [-3, -2, 2, 3]) {
        // Drop to the first open cell under the canopy before hanging.
        let y = trunkTop;
        while (y < top && world.get(x + dx, y) !== B.AIR) y++;
        if (y < top) hangVines(world, x + dx, y, B.VINES, rand, 5);
      }
      break;
    }
    case 'dark': {
      trunk();
      blob(world, x, trunkTop + 1, 3, f.leaves, false);
      break;
    }
    case 'mangrove': {
      trunk();
      blob(world, x, trunkTop + 1, 2, f.leaves);
      for (const dx of [-2, -1, 1, 2]) {         // prop roots
        for (let i = 0; i < Math.abs(dx); i++) {
          if (world.get(x + dx, top - i) === B.AIR) world.put(x + dx, top - i, f.log);
        }
      }
      break;
    }
    case 'nether': {
      trunk();
      for (let dx = -2; dx <= 2; dx++) world.put(x + dx, trunkTop - 1, f.leaves);
      for (const dx of [-2, 2]) world.put(x + dx, trunkTop, f.leaves);
      blob(world, x, trunkTop - 1, 2, f.leaves);
      break;
    }
    case 'chorus': {
      let cx = x;
      for (let i = 1; i <= h; i++) {
        world.put(cx, top - i, f.log);
        if (i > 2 && rand() < 0.3) {             // branch sideways
          const dir = rand() < 0.5 ? -1 : 1;
          world.put(cx + dir, top - i, f.log);
          world.put(cx + dir * 2, top - i, f.leaves);
        }
        if (rand() < 0.25) cx += rand() < 0.5 ? -1 : 1;
      }
      world.put(cx, top - h - 1, f.leaves);
      break;
    }
    default: {                                    // oak / birch / generic
      trunk();
      blob(world, x, trunkTop + 1, 2, f.leaves);
      break;
    }
  }
}

/** Walk the surface placing each biome's decorations. */
function placeFeatures(world, rand, heights, blendWith, blendAmt) {
  const lastTree = new Int32Array(world.width).fill(-99);
  let lastTreeX = -99;

  for (let x = 2; x < world.width - 2; x++) {
    const top = heights[x];
    if (top < 1 || top >= world.height - 2) continue;

    const bi = materialBiome(world, x, blendWith, blendAmt);
    if (!bi.features || !bi.features.length) continue;

    const ground = world.get(x, top);
    const above = world.get(x, top - 1);
    const submerged = above !== B.AIR;

    for (const f of bi.features) {
      if (f.kind === 'lilypad') {
        // Lily pads sit on the waterline, which is the liquid level -- not on
        // the lake bed, which is what `top` points at in a flooded column.
        const surf = world.liquidLevel;
        if (above !== B.AIR && top > surf
            && world.get(x, surf) === B.WATER && world.get(x, surf - 1) === B.AIR
            && rand() < f.chance) {
          world.put(x, surf - 1, B.LILY_PAD);
        }
        continue;
      }
      if (submerged) continue;

      if (f.kind === 'plant' && rand() < f.chance) {
        if (world.get(x, top - 1) === B.AIR) world.put(x, top - 1, f.block);
      } else if (f.kind === 'cactus' && rand() < f.chance) {
        const h = f.minH + Math.floor(rand() * (f.maxH - f.minH + 1));
        for (let i = 1; i <= h; i++) world.put(x, top - i, B.CACTUS);
      } else if (f.kind === 'pillar' && rand() < f.chance) {
        const h = f.minH + Math.floor(rand() * (f.maxH - f.minH + 1));
        for (let i = 0; i < h; i++) world.put(x, top - i, f.block);
      } else if (f.kind === 'spike' && rand() < f.chance) {
        // Tapering spire: wide at the base, a single block at the tip.
        const h = f.minH + Math.floor(rand() * (f.maxH - f.minH + 1));
        for (let i = 0; i < h; i++) {
          const r = Math.round((1 - i / h) * 1.7);
          for (let dx = -r; dx <= r; dx++) {
            if (world.get(x + dx, top - i) === B.AIR) world.put(x + dx, top - i, f.block);
          }
        }
      } else if (f.kind === 'patch' && rand() < f.chance) {
        // A hollow in the ground filled level with the surface -- powder snow
        // reads as a drift you can fall into rather than a lump sitting on top.
        const h = f.minH + Math.floor(rand() * (f.maxH - f.minH + 1));
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = 0; dy < h; dy++) world.put(x + dx, top + dy, f.block);
        }
      } else if (f.kind === 'tree' && rand() < f.chance) {
        if (x - lastTreeX < 3) continue;
        if (!B.isSolid(ground)) continue;
        placeTree(world, x, top, f, rand);
        lastTreeX = x;
        lastTree[x] = x;
      }
    }
  }
}

/** Line cave floors and ceilings with the depth band's signature blocks. */
function dressCaves(world, rand) {
  const { width, height } = world;

  for (let x = 0; x < width; x++) {
    for (let y = world.ground[x] + CAVE_TOP_OFFSET; y < height - 2; y++) {
      if (world.get(x, y) !== B.AIR) continue;

      const bi = world.undergroundBiomeAt(y);
      if (!bi || !bi.floor) continue;

      const below = world.get(x, y + 1);
      const above = world.get(x, y - 1);

      if (B.isSolid(below) && rand() < 0.72) {
        world.put(x, y + 1, bi.floor);
        if (bi.ground && rand() < 0.14) world.put(x, y, pick(rand, bi.ground));
      }
      if (B.isSolid(above) && rand() < 0.6) {
        world.put(x, y - 1, bi.ceiling);
        if (bi.hangs && rand() < 0.3) hangVines(world, x, y, pick(rand, bi.hangs), rand, 4);
      }
    }
  }
}

/** A 2x3 portal frame with the portal surface inside it. */
function buildPortal(world, x, y, frameId, portalId, to) {
  for (let dy = -1; dy <= 3; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      const edge = dx === -1 || dx === 2 || dy === -1 || dy === 3;
      if (edge) world.put(x + dx, y + dy, frameId);
      else world.put(x + dx, y + dy, portalId);
    }
  }
  world.portals.push({ x: x + 0.5, y: y + 1, to });
}

/** Drop a portal onto the surface at the first solid column near `nearX`. */
export function portalOnSurface(world, nearX, frameId, portalId, to) {
  for (let d = 0; d < 200; d++) {
    for (const x of d === 0 ? [nearX] : [nearX - d, nearX + d]) {
      if (x < 2 || x >= world.width - 3) continue;
      const top = world.ground[x];
      if (top < 2 || top >= world.height - 6) continue;
      if (!B.isSolid(world.get(x, top))) continue;
      if (world.get(x, top - 1) !== B.AIR) continue;
      for (let dx = -1; dx <= 2; dx++) world.put(x + dx, top, B.COBBLESTONE);
      buildPortal(world, x, top - 3, frameId, portalId, to);
      return x;
    }
  }
  return nearX;
}

// ---------------------------------------------------------------- realms

function generateOverworld(world) {
  const rand = mulberry32(world.seed ^ 0x9e3779b9);
  const coarse = makeNoise1D(rand);
  const fine = makeNoise1D(rand);
  const caveA = makeNoise1D(rand);
  const caveB = makeNoise1D(rand);

  const { heights, blendWith, blendAmt } = computeHeights(world, coarse, fine);
  world.ground.set(heights);

  const { width, height } = world;
  const deepslateAt = Math.floor(height * DEEPSLATE_AT);

  for (let x = 0; x < width; x++) {
    const top = heights[x];
    // Only the surface layers interfinger across a boundary -- letting the
    // blend reach bedrock draws full-height seams of the neighbour's material.
    const bi = materialBiome(world, x, blendWith, blendAmt);
    const deep = BIOMES[world.bandAt(x).id];

    for (let y = top; y < height; y++) {
      const depth = y - top;
      let id;

      if (y >= height - 1 || (y > height - 4 && rand() < 0.6)) {
        id = B.BEDROCK;
      } else if (depth > 0 && deep.paint && deep.paint(y, top, depth) !== null) {
        id = deep.paint(y, top, depth);
      } else if (depth === 0) {
        id = bi.surface;
      } else if (depth <= bi.subDepth) {
        id = bi.sub;
      } else if (bi.rock && depth <= bi.subDepth + bi.rockDepth) {
        id = bi.rock;
      } else {
        id = y >= deepslateAt ? B.DEEPSLATE : (deep.stone ?? B.STONE);
      }
      world.put(x, y, id);
    }
  }

  carveCaves(world, caveA, caveB, heights);
  fillLiquid(world, world.liquidLevel, B.WATER);
  freezeSurface(world, blendWith, blendAmt);

  scatterOres(world, rand, heights, [
    { id: B.COAL_ORE, host: B.STONE, rate: 0.45, minDepth: 5, maxDepth: 120, maxSize: 7 },
    { id: B.COPPER_ORE, host: B.STONE, rate: 0.30, minDepth: 8, maxDepth: 90, maxSize: 6 },
    { id: B.IRON_ORE, host: B.STONE, rate: 0.28, minDepth: 20, maxDepth: 160, maxSize: 5 },
    { id: B.LAPIS_ORE, host: B.STONE, rate: 0.12, minDepth: 40, maxDepth: 180, maxSize: 4 },
    { id: B.GOLD_ORE, host: B.STONE, rate: 0.10, minDepth: 60, maxDepth: 220, maxSize: 4 },
    { id: B.REDSTONE_ORE, host: B.DEEPSLATE, rate: 0.16, minDepth: 80, maxDepth: 300, maxSize: 5 },
    { id: B.DIAMOND_ORE, host: B.DEEPSLATE, rate: 0.07, minDepth: 110, maxDepth: 300, maxSize: 3 },
    { id: B.EMERALD_ORE, host: B.DEEPSLATE, rate: 0.04, minDepth: 100, maxDepth: 300, maxSize: 2 },
  ]);

  for (let x = 0; x < width; x++) world.recalcSurface(x);
  dressCaves(world, rand);
  placeFeatures(world, rand, heights, blendWith, blendAmt);
  placeStructures(world, rand);

  // Spawn in the forest band, as drawn, and put the nether portal beside it.
  const forest = world.bands.find((b) => b.id === 'forest');
  world.spawnX = forest ? forest.mid : Math.floor(width / 2);
  portalOnSurface(world, world.spawnX + 14, B.OBSIDIAN, B.NETHER_PORTAL, 'nether');

  // The end portal is buried in the deep dark, so it has to be dug out.
  const deepY = Math.floor(height * DEEP_DARK_AT) + 20;
  const endX = Math.floor(width / 2);
  for (let dy = -2; dy <= 4; dy++) {
    for (let dx = -2; dx <= 3; dx++) world.put(endX + dx, deepY + dy, B.AIR);
  }
  buildPortal(world, endX, deepY, B.END_STONE_BRICKS, B.END_PORTAL, 'end');
}

function generateNether(world) {
  const rand = mulberry32(world.seed ^ 0x5bf03635);
  const coarse = makeNoise1D(rand);
  const fine = makeNoise1D(rand);
  const caveA = makeNoise1D(rand);
  const caveB = makeNoise1D(rand);

  const { heights, blendWith, blendAmt } = computeHeights(world, coarse, fine);
  world.ground.set(heights);

  const { width, height } = world;
  const ceiling = world.spec.ceiling ?? 6;

  for (let x = 0; x < width; x++) {
    const bi = materialBiome(world, x, blendWith, blendAmt);
    const top = heights[x];

    // The forest bands float: a slab of land suspended inside the lava ring.
    const floating = bi.floating;
    const bottom = floating ? top + 18 : height;

    for (let y = 0; y < height; y++) {
      let id = B.AIR;

      if (y < ceiling) {
        id = y === 0 ? B.BEDROCK : B.NETHERRACK;      // solid nether ceiling
      } else if (y >= top && y < bottom) {
        const depth = y - top;
        if (y >= height - 1) id = B.BEDROCK;
        else if (depth === 0) id = bi.surface;
        else if (depth <= bi.subDepth) id = bi.sub;
        else id = bi.stone;

        // Taper the underside of a floating island to a point.
        if (floating && depth > 6 && hash2(x, y, 11) < (depth - 6) / 12) id = B.AIR;
      }
      world.put(x, y, id);
    }
  }

  carveCaves(world, caveA, caveB, heights, { top: 6, density: 0.05, floor: 2 });
  fillLiquid(world, world.liquidLevel, B.LAVA);

  scatterOres(world, rand, heights, [
    { id: B.QUARTZ_ORE, host: B.NETHERRACK, rate: 0.5, minDepth: 4, maxDepth: 120, maxSize: 6 },
    { id: B.NETHER_GOLD_ORE, host: B.NETHERRACK, rate: 0.3, minDepth: 4, maxDepth: 120, maxSize: 5 },
    { id: B.MAGMA_BLOCK, host: B.NETHERRACK, rate: 0.2, minDepth: 10, maxDepth: 140, maxSize: 4 },
    { id: B.GLOWSTONE, host: B.NETHERRACK, rate: 0.15, minDepth: 6, maxDepth: 20, maxSize: 5 },
  ]);

  for (let x = 0; x < width; x++) world.recalcSurface(x);
  placeFeatures(world, rand, heights, blendWith, blendAmt);
  placeStructures(world, rand);

  const wastes = world.bands.find((b) => b.id === 'nether_wastes');
  world.spawnX = wastes ? wastes.mid : Math.floor(width / 2);
  portalOnSurface(world, world.spawnX, B.OBSIDIAN, B.NETHER_PORTAL, 'overworld');
}

function generateEnd(world) {
  const rand = mulberry32(world.seed ^ 0x27d4eb2f);
  const coarse = makeNoise1D(rand);
  const fine = makeNoise1D(rand);

  const { heights, blendWith, blendAmt } = computeHeights(world, coarse, fine);
  const { width, height } = world;

  // Islands only exist inside their own bands; everywhere else is void.
  const ground = new Int32Array(width).fill(height);
  for (let x = 0; x < width; x++) {
    const band = world.bandAt(x);
    const bi = BIOMES[band.id];
    if (!bi.island) continue;

    // Taper each island's edges so it reads as a floating chunk, not a wall.
    const edge = Math.min(x - band.x0, band.x1 - 1 - x);
    const taper = Math.min(1, edge / 14);
    if (taper <= 0.02) continue;

    const top = Math.round(heights[x] + (1 - taper) * 10);
    const thick = Math.round(bi.thickness * taper);
    if (thick < 2) continue;

    ground[x] = top;
    for (let y = top; y < top + thick; y++) {
      const depth = y - top;
      let id = depth === 0 ? bi.surface : bi.stone;
      if (depth > thick - 4 && hash2(x, y, 17) < 0.5) id = B.AIR;   // ragged underside
      world.put(x, y, id);
    }
  }
  world.ground.set(ground);

  for (let x = 0; x < width; x++) world.recalcSurface(x);
  placeFeatures(world, rand, ground, blendWith, blendAmt);
  placeStructures(world, rand);

  const main = world.bands.find((b) => b.id === 'end_main');
  world.spawnX = main ? main.mid : Math.floor(width / 2);
  portalOnSurface(world, world.spawnX, B.END_STONE_BRICKS, B.END_PORTAL, 'overworld');
}

export function generate(world) {
  if (world.realm === 'overworld') generateOverworld(world);
  else if (world.realm === 'nether') generateNether(world);
  else if (world.realm === 'end') generateEnd(world);
  else throw new Error(`no generator for realm ${world.realm}`);
}
