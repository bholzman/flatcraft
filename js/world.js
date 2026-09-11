import { WORLD_W, WORLD_H, SEA_LEVEL, WATER_LEVEL } from './config.js';
import {
  AIR, GRASS, DIRT, STONE, SAND, WOOD, LEAVES, BEDROCK, WATER,
  COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, isSolid,
} from './blocks.js';

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
  const table = new Float32Array(1024).map(() => rand());
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = table[((i % 1024) + 1024) % 1024];
    const b = table[(((i + 1) % 1024) + 1024) % 1024];
    const t = f * f * (3 - 2 * f);          // smoothstep
    return a + (b - a) * t;
  };
}

export class World {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this.width = WORLD_W;
    this.height = WORLD_H;
    this.grid = new Uint8Array(WORLD_W * WORLD_H);
    this.surface = new Int32Array(WORLD_W);   // topmost non-air y per column (live)
    this.ground = new Int32Array(WORLD_W);    // generated terrain height per column (fixed)
    this.generate();
  }

  idx(x, y) {
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Out-of-bounds reads: solid below the world, air above/beside it. */
  get(x, y) {
    if (x < 0 || x >= this.width) return BEDROCK;
    if (y < 0) return AIR;
    if (y >= this.height) return BEDROCK;
    return this.grid[this.idx(x, y)];
  }

  set(x, y, id) {
    if (!this.inBounds(x, y)) return false;
    this.grid[this.idx(x, y)] = id;
    this.recalcSurface(x);
    return true;
  }

  isSolidAt(x, y) {
    return isSolid(this.get(x, y));
  }

  recalcSurface(x) {
    for (let y = 0; y < this.height; y++) {
      if (this.grid[this.idx(x, y)] !== AIR) {
        this.surface[x] = y;
        return;
      }
    }
    this.surface[x] = this.height;
  }

  // ---- generation ----

  generate() {
    const rand = mulberry32(this.seed);
    const hills = makeNoise1D(rand);
    const rolling = makeNoise1D(rand);
    const detail = makeNoise1D(rand);
    const caveA = makeNoise1D(rand);
    const caveB = makeNoise1D(rand);

    const heights = new Int32Array(this.width);

    // Each octave is centred on zero so the sum swings both sides of SEA_LEVEL,
    // which is what lets valleys drop below WATER_LEVEL and form lakes.
    for (let x = 0; x < this.width; x++) {
      const h =
        SEA_LEVEL
        - (hills(x / 70) - 0.5) * 46
        - (rolling(x / 26) - 0.5) * 16
        - (detail(x / 9) - 0.5) * 5;
      heights[x] = Math.max(6, Math.min(this.height - 12, Math.round(h)));
    }

    // The terrain baseline stays fixed: foliage above it and mining below it
    // must not move it, or lighting and the cave backdrop shift with them.
    this.ground.set(heights);

    for (let x = 0; x < this.width; x++) {
      const top = heights[x];
      const beach = top >= WATER_LEVEL - 2;   // ground near the waterline gets sand

      for (let y = 0; y < this.height; y++) {
        let id = AIR;

        if (y === this.height - 1) {
          id = BEDROCK;
        } else if (y > this.height - 4 && rand() < 0.6) {
          id = BEDROCK;
        } else if (y === top) {
          id = beach ? SAND : GRASS;
        } else if (y > top && y <= top + 4) {
          id = beach ? SAND : DIRT;
        } else if (y > top) {
          id = STONE;
        } else if (y >= WATER_LEVEL) {
          id = WATER;                          // low-lying air floods
        }

        this.grid[this.idx(x, y)] = id;
      }
    }

    this.carveCaves(caveA, caveB, heights);
    this.scatterOres(rand, heights);
    this.plantTrees(rand, heights);

    for (let x = 0; x < this.width; x++) this.recalcSurface(x);
  }

  /** Two offset noise fields; where both are near the middle, carve a tunnel. */
  carveCaves(caveA, caveB, heights) {
    for (let x = 0; x < this.width; x++) {
      for (let y = heights[x] + 5; y < this.height - 5; y++) {
        const depth = (y - heights[x]) / (this.height - heights[x]);
        const a = caveA(x / 18 + y / 11);
        const b = caveB(x / 13 - y / 17);
        const v = Math.abs(a - b);
        if (v < 0.055 + depth * 0.035) {
          this.grid[this.idx(x, y)] = AIR;
        }
      }
    }
  }

  scatterOres(rand, heights) {
    const veins = [
      { id: COAL_ORE,    tries: 200, minDepth: 4,  maxSize: 7 },
      { id: IRON_ORE,    tries: 130, minDepth: 18, maxSize: 5 },
      { id: GOLD_ORE,    tries: 55,  minDepth: 34, maxSize: 4 },
      { id: DIAMOND_ORE, tries: 24,  minDepth: 50, maxSize: 3 },
    ];

    for (const vein of veins) {
      for (let n = 0; n < vein.tries; n++) {
        const x = Math.floor(rand() * this.width);
        const top = heights[x];
        const span = this.height - top - vein.minDepth - 4;
        if (span <= 0) continue;
        const y = Math.floor(top + vein.minDepth + rand() * span);
        if (!this.inBounds(x, y) || this.grid[this.idx(x, y)] !== STONE) continue;

        // Random walk to make a blobby vein rather than a single block.
        let cx = x;
        let cy = y;
        const size = 2 + Math.floor(rand() * vein.maxSize);
        for (let i = 0; i < size; i++) {
          if (this.inBounds(cx, cy) && this.grid[this.idx(cx, cy)] === STONE) {
            this.grid[this.idx(cx, cy)] = vein.id;
          }
          cx += Math.floor(rand() * 3) - 1;
          cy += Math.floor(rand() * 3) - 1;
        }
      }
    }
  }

  plantTrees(rand, heights) {
    let lastTree = -99;
    for (let x = 4; x < this.width - 4; x++) {
      if (x - lastTree < 5 || rand() > 0.09) continue;

      const top = heights[x];
      if (this.grid[this.idx(x, top)] !== GRASS) continue;

      const trunk = 4 + Math.floor(rand() * 3);
      for (let i = 1; i <= trunk; i++) {
        const y = top - i;
        if (y >= 0) this.grid[this.idx(x, y)] = WOOD;
      }

      const crownY = top - trunk;
      const r = 2;
      for (let dy = -r; dy <= 1; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > r + 1) continue;
          const lx = x + dx;
          const ly = crownY + dy;
          if (this.inBounds(lx, ly) && this.grid[this.idx(lx, ly)] === AIR) {
            this.grid[this.idx(lx, ly)] = LEAVES;
          }
        }
      }
      lastTree = x;
    }
  }

  /** A safe standing spot: on top of the surface at the given column. */
  spawnPoint(x = Math.floor(this.width / 2)) {
    for (let col = x; col < this.width; col++) {
      const top = this.surface[col];
      if (this.get(col, top) !== WATER && top < this.height - 2) {
        return { x: col + 0.5, y: top - 2 };
      }
    }
    return { x: x + 0.5, y: 0 };
  }
}
