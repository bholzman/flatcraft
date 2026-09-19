import * as B from './blocks.js';

// Biomes are horizontal bands. The hand-drawn map is concentric, so the world
// is a left-to-right cut straight through those rings: ocean on both edges,
// working inward through desert, mesa, grassland and forest to the lake and
// swamp at the centre. Underground biomes are depth bands instead.
//
// Per biome:
//   height   base y of the surface, swing amplitude, and noise wavelength
//   surface  top block; sub/subDepth the layer under it; stone the deep filler
//   paint    optional (y, top, depth) -> id override, for things like mesa strata
//   sky      [zenith, horizon] colours
//   features decorations placed on the surface after terrain is laid down

const MESA_STRATA = [
  B.TERRACOTTA_ORANGE, B.TERRACOTTA_WHITE, B.TERRACOTTA, B.TERRACOTTA_YELLOW,
  B.TERRACOTTA_BROWN, B.TERRACOTTA_RED, B.TERRACOTTA_ORANGE, B.TERRACOTTA_WHITE,
];

const tree = (shape, log, leaves, chance, minH, maxH) =>
  ({ kind: 'tree', shape, log, leaves, chance, minH, maxH });
const plant = (blockId, chance) => ({ kind: 'plant', block: blockId, chance });

export const BIOMES = {
  // ---------------- overworld surface ----------------
  ocean: {
    name: 'Ocean',
    height: { base: 134, amp: 5, freq: 46 },
    surface: B.GRAVEL, sub: B.SAND, subDepth: 4, stone: B.STONE,
    sky: ['#2f63a4', '#8fc0e2'],
    features: [],
  },
  desert: {
    name: 'Desert',
    height: { base: 115, amp: 4, freq: 34 },
    surface: B.SAND, sub: B.SAND, subDepth: 6, rock: B.SANDSTONE, rockDepth: 10, stone: B.STONE,
    sky: ['#4f8ec4', '#e3d5a8'],
    features: [{ kind: 'cactus', chance: 0.05, minH: 2, maxH: 4 }, plant(B.DEAD_BUSH, 0.04)],
  },
  mesa: {
    name: 'Mesa Mountains',
    height: { base: 78, amp: 30, freq: 58 },
    surface: B.RED_SAND, sub: B.RED_SANDSTONE, subDepth: 3, rock: B.RED_SANDSTONE, rockDepth: 4, stone: B.STONE,
    paint: (y, top, depth) => (depth > 2 && depth < 40 ? MESA_STRATA[Math.floor(y / 3) % MESA_STRATA.length] : null),
    sky: ['#4b7fb4', '#d9a97a'],
    features: [plant(B.DEAD_BUSH, 0.03)],
  },
  plains: {
    name: 'Plains',
    height: { base: 110, amp: 5, freq: 30 },
    surface: B.GRASS, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    sky: ['#4d84c4', '#9cc3e0'],
    features: [plant(B.TALL_GRASS, 0.34), plant(B.FLOWER_YELLOW, 0.03), plant(B.FLOWER_RED, 0.02),
      tree('oak', B.OAK_LOG, B.OAK_LEAVES, 0.012, 4, 6)],
  },
  savanna: {
    name: 'Savanna',
    height: { base: 108, amp: 7, freq: 36 },
    surface: B.DRY_GRASS, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    sky: ['#5089c0', '#c9c48f'],
    features: [plant(B.TALL_GRASS, 0.26), tree('acacia', B.ACACIA_LOG, B.ACACIA_LEAVES, 0.035, 4, 6)],
  },
  meadow: {
    name: 'Meadow',
    height: { base: 102, amp: 10, freq: 40 },
    surface: B.GRASS, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    sky: ['#4a86c8', '#a9d0e6'],
    features: [plant(B.TALL_GRASS, 0.42), plant(B.FLOWER_RED, 0.08), plant(B.FLOWER_YELLOW, 0.08),
      tree('oak', B.OAK_LOG, B.OAK_LEAVES, 0.006, 5, 7)],
  },
  taiga: {
    name: 'Taiga',
    height: { base: 106, amp: 8, freq: 32 },
    surface: B.GRASS, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    sky: ['#4a7ba8', '#9fb8c6'],
    features: [plant(B.TALL_GRASS, 0.18), tree('spruce', B.SPRUCE_LOG, B.SPRUCE_LEAVES, 0.12, 7, 12)],
  },
  birch_forest: {
    name: 'Birch Forest',
    height: { base: 108, amp: 6, freq: 30 },
    surface: B.GRASS, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    sky: ['#4d88c6', '#b0d4e8'],
    features: [plant(B.TALL_GRASS, 0.24), tree('birch', B.BIRCH_LOG, B.BIRCH_LEAVES, 0.13, 6, 9)],
  },
  dark_forest: {
    name: 'Dark Forest',
    height: { base: 109, amp: 5, freq: 28 },
    surface: B.GRASS, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    sky: ['#3d6a96', '#7f9cb0'],
    features: [plant(B.TALL_GRASS, 0.2), tree('dark', B.DARK_OAK_LOG, B.DARK_OAK_LEAVES, 0.16, 5, 7)],
  },
  jungle: {
    name: 'Jungle',
    height: { base: 107, amp: 8, freq: 26 },
    surface: B.GRASS, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    sky: ['#3f86b4', '#a8d8c0'],
    features: [plant(B.TALL_GRASS, 0.38), tree('jungle', B.JUNGLE_LOG, B.JUNGLE_LEAVES, 0.14, 9, 15)],
  },
  forest: {
    name: 'Forest',
    height: { base: 108, amp: 6, freq: 30 },
    surface: B.GRASS, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    sky: ['#4d84c4', '#9cc3e0'],
    features: [plant(B.TALL_GRASS, 0.3), plant(B.FLOWER_RED, 0.03),
      tree('oak', B.OAK_LOG, B.OAK_LEAVES, 0.11, 5, 8)],
  },
  lake: {
    name: 'Lake',
    height: { base: 126, amp: 4, freq: 30 },
    surface: B.SAND, sub: B.CLAY, subDepth: 3, stone: B.STONE,
    sky: ['#4d84c4', '#a8cfe8'],
    features: [{ kind: 'lilypad', chance: 0.12 }],
  },
  swamp: {
    name: 'Swamp',
    // Straddles the waterline on purpose, so the band comes out as patchy
    // marsh -- dry hummocks and shallow pools -- rather than uniform shallows.
    height: { base: 117, amp: 3.5, freq: 18 },
    surface: B.SWAMP_GRASS, sub: B.MUD, subDepth: 5, stone: B.STONE,
    sky: ['#4a7390', '#8fa88c'],
    features: [plant(B.TALL_GRASS, 0.3), { kind: 'lilypad', chance: 0.1 },
      tree('mangrove', B.MANGROVE_LOG, B.MANGROVE_LEAVES, 0.07, 5, 8)],
  },


  // ---------------- overworld: the polar rim ----------------
  frozen_ocean: {
    name: 'Frozen Ocean',
    height: { base: 133, amp: 4, freq: 44 },
    surface: B.GRAVEL, sub: B.GRAVEL, subDepth: 3, stone: B.STONE,
    freezes: true,                    // the waterline is capped with ice
    sky: ['#5d86ae', '#cfe2ee'],
    features: [],
  },
  snowy_beach: {
    name: 'Snowy Beach',
    height: { base: 117, amp: 3, freq: 30 },
    surface: B.SNOW_BLOCK, sub: B.SAND, subDepth: 5, rock: B.SANDSTONE, rockDepth: 6, stone: B.STONE,
    freezes: true,
    sky: ['#6a93bc', '#dbe9f2'],
    features: [plant(B.SNOW_LAYER, 0.3)],
  },
  snowy_plains: {
    name: 'Snowy Plains',
    height: { base: 110, amp: 5, freq: 32 },
    surface: B.SNOW_BLOCK, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    freezes: true,
    sky: ['#6e97c0', '#dce9f4'],
    features: [plant(B.SNOW_LAYER, 0.45),
      tree('spruce', B.SPRUCE_LOG, B.SPRUCE_LEAVES, 0.012, 6, 9)],
  },
  ice_spikes: {
    name: 'Ice Spikes',
    height: { base: 109, amp: 5, freq: 28 },
    surface: B.SNOW_BLOCK, sub: B.PACKED_ICE, subDepth: 3, stone: B.STONE,
    freezes: true,
    sky: ['#6a9ccb', '#d6ecf8'],
    features: [{ kind: 'spike', block: B.PACKED_ICE, chance: 0.07, minH: 6, maxH: 16 },
      plant(B.SNOW_LAYER, 0.3)],
  },
  snowy_taiga: {
    name: 'Snowy Taiga',
    height: { base: 107, amp: 8, freq: 32 },
    surface: B.SNOW_BLOCK, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    freezes: true,
    sky: ['#628cb4', '#cfe0ec'],
    features: [plant(B.SNOW_LAYER, 0.4),
      tree('spruce', B.SPRUCE_LOG, B.SPRUCE_LEAVES, 0.13, 7, 13)],
  },
  grove: {
    name: 'Grove',
    height: { base: 100, amp: 12, freq: 36 },
    surface: B.SNOW_BLOCK, sub: B.DIRT, subDepth: 4, stone: B.STONE,
    freezes: true,
    sky: ['#5f8cb8', '#d2e4f0'],
    features: [plant(B.SNOW_LAYER, 0.5),
      tree('spruce', B.SPRUCE_LOG, B.SPRUCE_LEAVES, 0.16, 8, 14)],
  },
  snowy_slopes: {
    name: 'Snowy Slopes',
    height: { base: 82, amp: 22, freq: 44 },
    surface: B.SNOW_BLOCK, sub: B.SNOW_BLOCK, subDepth: 3, rock: B.STONE, rockDepth: 8, stone: B.STONE,
    freezes: true,
    sky: ['#5a88b6', '#d8e8f4'],
    features: [plant(B.SNOW_LAYER, 0.4),
      { kind: 'patch', block: B.POWDER_SNOW, chance: 0.05, minH: 2, maxH: 4 }],
  },
  frozen_peaks: {
    name: 'Frozen Peaks',
    height: { base: 58, amp: 30, freq: 52 },
    surface: B.SNOW_BLOCK, sub: B.PACKED_ICE, subDepth: 4, rock: B.STONE, rockDepth: 10, stone: B.STONE,
    freezes: true,
    sky: ['#4f80b0', '#e2eef8'],
    features: [plant(B.SNOW_LAYER, 0.35),
      { kind: 'spike', block: B.BLUE_ICE, chance: 0.03, minH: 4, maxH: 9 }],
  },
  jagged_peaks: {
    name: 'Jagged Peaks',
    height: { base: 52, amp: 34, freq: 46 },
    surface: B.SNOW_BLOCK, sub: B.STONE, subDepth: 5, stone: B.STONE,
    freezes: true,
    sky: ['#4a7cad', '#e6f0f8'],
    features: [plant(B.SNOW_LAYER, 0.3),
      { kind: 'spike', block: B.STONE, chance: 0.06, minH: 5, maxH: 14 }],
  },

  // ---------------- overworld underground (depth bands) ----------------
  caves: {
    name: 'Caves', underground: true,
    fill: B.STONE, accents: [B.ANDESITE, B.GRANITE, B.DIORITE, B.GRAVEL],
    ambient: '#1d1a24',
  },
  lush_caves: {
    name: 'Lush Caves', underground: true,
    fill: B.STONE, accents: [B.MOSS_BLOCK, B.ROOTED_DIRT, B.CLAY],
    ceiling: B.MOSS_BLOCK, floor: B.MOSS_BLOCK,
    hangs: [B.HANGING_ROOTS, B.GLOW_BERRIES], ground: [B.AZALEA_LEAVES, B.BIG_DRIPLEAF],
    ambient: '#1b2417',
  },
  deep_dark: {
    name: 'Deep Dark', underground: true,
    fill: B.DEEPSLATE, accents: [B.COBBLED_DEEPSLATE, B.SCULK],
    ceiling: B.SCULK, floor: B.SCULK,
    hangs: [B.SCULK_VEIN], ground: [B.SCULK_SENSOR, B.SCULK_CATALYST],
    ambient: '#090d12',
  },

  // ---------------- nether ----------------
  lava_ocean: {
    name: 'Lava Ocean',
    height: { base: 62, amp: 4, freq: 30 },
    surface: B.NETHERRACK, sub: B.NETHERRACK, subDepth: 5, stone: B.NETHERRACK,
    sky: ['#3a0f0f', '#8a2a12'],
    features: [],
  },
  soul_sand_valley: {
    name: 'Soul Sand Valley',
    height: { base: 44, amp: 9, freq: 28 },
    surface: B.SOUL_SAND, sub: B.SOUL_SOIL, subDepth: 6, stone: B.BASALT,
    sky: ['#20242c', '#4a5a5e'],
    features: [{ kind: 'pillar', block: B.BASALT, chance: 0.05, minH: 4, maxH: 12 }],
  },
  nether_wastes: {
    name: 'Nether Wastes',
    height: { base: 42, amp: 8, freq: 26 },
    surface: B.NETHERRACK, sub: B.NETHERRACK, subDepth: 8, stone: B.NETHERRACK,
    sky: ['#3a0f0f', '#7a2410'],
    features: [plant(B.GLOWSTONE, 0.01), { kind: 'pillar', block: B.BLACKSTONE, chance: 0.02, minH: 3, maxH: 7 }],
  },
  lava_ring: {
    name: 'Lava Ring',
    height: { base: 66, amp: 3, freq: 20 },
    surface: B.MAGMA_BLOCK, sub: B.NETHERRACK, subDepth: 4, stone: B.NETHERRACK,
    sky: ['#4a1008', '#c04a14'],
    features: [],
  },
  crimson_forest: {
    name: 'Crimson Forest',
    height: { base: 40, amp: 5, freq: 22 }, floating: true,
    surface: B.CRIMSON_NYLIUM, sub: B.NETHERRACK, subDepth: 6, stone: B.NETHERRACK,
    sky: ['#4a0f14', '#9a2a2a'],
    features: [tree('nether', B.CRIMSON_STEM, B.NETHER_WART_BLOCK, 0.16, 5, 10), plant(B.SHROOMLIGHT, 0.03)],
  },
  warped_forest: {
    name: 'Warped Forest',
    height: { base: 40, amp: 5, freq: 22 }, floating: true,
    surface: B.WARPED_NYLIUM, sub: B.NETHERRACK, subDepth: 6, stone: B.NETHERRACK,
    sky: ['#0d2a2e', '#177a74'],
    features: [tree('nether', B.WARPED_STEM, B.WARPED_WART_BLOCK, 0.16, 5, 10), plant(B.SHROOMLIGHT, 0.03)],
  },

  // ---------------- the end ----------------
  end_void: {
    name: 'The Void', void: true,
    sky: ['#0a0710', '#140d1c'],
    features: [],
  },
  end_main: {
    name: 'Central Island', island: true,
    height: { base: 70, amp: 7, freq: 34 }, thickness: 26,
    surface: B.END_STONE, sub: B.END_STONE, subDepth: 40, stone: B.END_STONE,
    sky: ['#0a0710', '#1b1430'],
    features: [{ kind: 'pillar', block: B.OBSIDIAN, chance: 0.03, minH: 8, maxH: 22 }],
  },
  end_outer: {
    name: 'Outer Island', island: true,
    height: { base: 74, amp: 9, freq: 30 }, thickness: 20,
    surface: B.END_STONE, sub: B.END_STONE, subDepth: 30, stone: B.END_STONE,
    sky: ['#0a0710', '#1b1430'],
    features: [tree('chorus', B.CHORUS_STEM, B.CHORUS_FLOWER, 0.12, 4, 9),
      plant(B.PURPUR_BLOCK, 0.02)],
  },
};

// Band order from the world edge inward, plus what sits at the dead centre.
// The full left-to-right layout is outward + centre + outward reversed.
export const LAYOUTS = {
  overworld: {
    // Outermost ring inward. The drawn map is concentric, so reading it as
    // climate bands puts the polar rim at the world edge and the warm, wet
    // core at the centre. Reorder this array to move a biome.
    outward: [
      'frozen_ocean', 'snowy_beach', 'snowy_plains', 'ice_spikes', 'snowy_taiga',
      'grove', 'snowy_slopes', 'frozen_peaks', 'jagged_peaks',
      'ocean', 'desert', 'mesa', 'plains', 'savanna', 'meadow',
      'taiga', 'birch_forest', 'dark_forest', 'jungle', 'forest',
    ],
    center: ['lake', 'swamp'],
    weights: {
      frozen_ocean: 1.6, snowy_beach: 0.8, snowy_plains: 1.1, ice_spikes: 0.9,
      snowy_taiga: 1.1, grove: 1.0, snowy_slopes: 1.2, frozen_peaks: 1.3,
      jagged_peaks: 1.2,
      ocean: 2.2, desert: 1.3, mesa: 1.7, plains: 1.1, savanna: 1.0, meadow: 1.0,
      taiga: 1.0, birch_forest: 0.9, dark_forest: 1.0, jungle: 1.0, forest: 1.2,
      lake: 1.0, swamp: 1.0,
    },
    spawnBiome: 'forest',
  },
  nether: {
    outward: ['lava_ocean', 'soul_sand_valley', 'nether_wastes', 'lava_ring'],
    center: ['crimson_forest', 'warped_forest'],
    weights: {
      lava_ocean: 1.6, soul_sand_valley: 1.4, nether_wastes: 2.0, lava_ring: 0.8,
      crimson_forest: 1.2, warped_forest: 1.2,
    },
    spawnBiome: 'nether_wastes',
  },
  end: {
    outward: ['end_void'],
    center: ['end_main', 'end_void', 'end_outer'],
    weights: { end_void: 1.0, end_main: 2.4, end_outer: 1.4 },
    spawnBiome: 'end_main',
  },
};

/**
 * Expand a layout into concrete x ranges across `width`.
 * Returns [{ id, x0, x1, mid }], left to right.
 */
export function layoutBands(layout, width) {
  const order = [...layout.outward, ...layout.center, ...[...layout.outward].reverse()];
  const total = order.reduce((sum, id) => sum + (layout.weights[id] ?? 1), 0);

  const bands = [];
  let x = 0;
  order.forEach((id, i) => {
    const w = ((layout.weights[id] ?? 1) / total) * width;
    const x0 = Math.round(x);
    const x1 = i === order.length - 1 ? width : Math.round(x + w);
    bands.push({ id, x0, x1, mid: Math.round((x0 + x1) / 2) });
    x += w;
  });
  return bands;
}

/** Index of the band containing x. */
export function bandIndexAt(bands, x) {
  for (let i = 0; i < bands.length; i++) {
    if (x < bands[i].x1) return i;
  }
  return bands.length - 1;
}
