// Block registry. Ids are stable numbers; world grids store ids in a Uint8Array,
// so ids must stay below 256.
//
// Fields:
//   solid    - blocks player movement
//   hardness - seconds of mining at strength 1 (null = unbreakable)
//   drops    - block id added to the inventory when mined (defaults to itself)
//   tint     - base colour; textures.js paints per-pixel variation on top
//   style    - how textures.js draws it (see that file's painters)
//   liquid   - swims through it instead of standing on it
//   emit     - 0..1 glow strength; lit blocks ignore depth darkening
//   soil     - for 'grass' style, the block whose colour forms the underside
//   speckle  - for 'ore' style, the mineral colour
//   host     - for 'ore' style, the surrounding rock id (defaults to STONE)

export const AIR = 0;

// --- overworld stone family ---
export const STONE = 1;
export const COBBLESTONE = 2;
export const DIRT = 3;
export const GRASS = 4;
export const SAND = 5;
export const SANDSTONE = 6;
export const GRAVEL = 7;
export const CLAY = 8;
export const ANDESITE = 9;
export const GRANITE = 10;
export const DIORITE = 11;
export const BEDROCK = 12;
export const WATER = 13;
export const GLASS = 14;
export const OAK_PLANKS = 15;

// --- ores ---
export const COAL_ORE = 16;
export const IRON_ORE = 17;
export const COPPER_ORE = 18;
export const GOLD_ORE = 19;
export const REDSTONE_ORE = 20;
export const LAPIS_ORE = 21;
export const DIAMOND_ORE = 22;
export const EMERALD_ORE = 23;

// --- desert ---
export const CACTUS = 24;
export const DEAD_BUSH = 25;

// --- mesa ---
export const RED_SAND = 26;
export const RED_SANDSTONE = 27;
export const TERRACOTTA = 28;
export const TERRACOTTA_ORANGE = 29;
export const TERRACOTTA_YELLOW = 30;
export const TERRACOTTA_WHITE = 31;
export const TERRACOTTA_BROWN = 32;
export const TERRACOTTA_RED = 33;

// --- grassland flora ---
export const TALL_GRASS = 34;
export const FLOWER_RED = 35;
export const FLOWER_YELLOW = 36;
export const DRY_GRASS = 37;

// --- woods ---
export const OAK_LOG = 38;
export const OAK_LEAVES = 39;
export const BIRCH_LOG = 40;
export const BIRCH_LEAVES = 41;
export const DARK_OAK_LOG = 42;
export const DARK_OAK_LEAVES = 43;
export const SPRUCE_LOG = 44;
export const SPRUCE_LEAVES = 45;
export const JUNGLE_LOG = 46;
export const JUNGLE_LEAVES = 47;
export const ACACIA_LOG = 48;
export const ACACIA_LEAVES = 49;

// --- swamp ---
export const MUD = 50;
export const SWAMP_GRASS = 51;
export const VINES = 52;
export const LILY_PAD = 53;
export const MANGROVE_LOG = 54;
export const MANGROVE_LEAVES = 55;

// --- lush caves ---
export const MOSS_BLOCK = 56;
export const ROOTED_DIRT = 57;
export const HANGING_ROOTS = 58;
export const AZALEA_LEAVES = 59;
export const GLOW_BERRIES = 60;
export const BIG_DRIPLEAF = 61;

// --- deep dark ---
export const DEEPSLATE = 62;
export const COBBLED_DEEPSLATE = 63;
export const SCULK = 64;
export const SCULK_VEIN = 65;
export const SCULK_CATALYST = 66;
export const SCULK_SENSOR = 67;
export const REINFORCED_DEEPSLATE = 68;

// --- nether ---
export const NETHERRACK = 69;
export const SOUL_SAND = 70;
export const SOUL_SOIL = 71;
export const BASALT = 72;
export const BLACKSTONE = 73;
export const MAGMA_BLOCK = 74;
export const GLOWSTONE = 75;
export const QUARTZ_ORE = 76;
export const NETHER_GOLD_ORE = 77;
export const LAVA = 78;
export const CRIMSON_NYLIUM = 79;
export const CRIMSON_STEM = 80;
export const NETHER_WART_BLOCK = 81;
export const WARPED_NYLIUM = 82;
export const WARPED_STEM = 83;
export const WARPED_WART_BLOCK = 84;
export const SHROOMLIGHT = 85;
export const NETHER_BRICK = 86;

// --- the end ---
export const END_STONE = 87;
export const END_STONE_BRICKS = 88;
export const OBSIDIAN = 89;
export const PURPUR_BLOCK = 90;
export const CHORUS_STEM = 91;
export const CHORUS_FLOWER = 92;

// --- portals & utility ---
export const NETHER_PORTAL = 93;
export const END_PORTAL = 94;
export const TORCH = 95;

const R = {};   // id -> definition

function def(id, name, opts = {}) {
  R[id] = {
    id,
    name,
    solid: opts.solid !== false,
    hardness: 'hardness' in opts ? opts.hardness : 1,
    tint: opts.tint ?? '#888888',
    style: opts.style ?? 'plain',
    liquid: !!opts.liquid,
    emit: opts.emit ?? 0,
    ...opts,
  };
}

// id, name, { hardness, tint, style, ... }
def(AIR, 'Air', { solid: false, hardness: null, tint: null, style: 'none' });

def(STONE, 'Stone', { hardness: 1.5, tint: '#7f7f86', drops: COBBLESTONE });
def(COBBLESTONE, 'Cobblestone', { hardness: 1.7, tint: '#6e6e75', style: 'cobble' });
def(DIRT, 'Dirt', { hardness: 0.5, tint: '#8b6141' });
def(GRASS, 'Grass Block', { hardness: 0.6, tint: '#5d9b3f', style: 'grass', soil: DIRT, drops: DIRT });
def(SAND, 'Sand', { hardness: 0.5, tint: '#dbcd8f' });
def(SANDSTONE, 'Sandstone', { hardness: 0.9, tint: '#cfc08a', style: 'layered' });
def(GRAVEL, 'Gravel', { hardness: 0.6, tint: '#84807e', style: 'cobble' });
def(CLAY, 'Clay', { hardness: 0.6, tint: '#a0a6b0' });
def(ANDESITE, 'Andesite', { hardness: 1.5, tint: '#8a8a8a' });
def(GRANITE, 'Granite', { hardness: 1.5, tint: '#9b6a55' });
def(DIORITE, 'Diorite', { hardness: 1.5, tint: '#c3c3c6' });
def(BEDROCK, 'Bedrock', { hardness: null, tint: '#2a2a30', style: 'cobble' });
def(WATER, 'Water', { solid: false, hardness: null, tint: '#3b6fd4', style: 'liquid', liquid: true });
def(GLASS, 'Glass', { hardness: 0.4, tint: '#bcd8e4', style: 'glass' });
def(OAK_PLANKS, 'Oak Planks', { hardness: 0.9, tint: '#a97b46', style: 'planks' });

def(COAL_ORE, 'Coal Ore', { hardness: 2.2, tint: '#7f7f86', style: 'ore', speckle: '#1e1e22' });
def(IRON_ORE, 'Iron Ore', { hardness: 2.8, tint: '#7f7f86', style: 'ore', speckle: '#c69a7b' });
def(COPPER_ORE, 'Copper Ore', { hardness: 2.6, tint: '#7f7f86', style: 'ore', speckle: '#d98149' });
def(GOLD_ORE, 'Gold Ore', { hardness: 3.2, tint: '#7f7f86', style: 'ore', speckle: '#e9c34a' });
def(REDSTONE_ORE, 'Redstone Ore', { hardness: 3.0, tint: '#7f7f86', style: 'ore', speckle: '#d33b32', emit: 0.2 });
def(LAPIS_ORE, 'Lapis Ore', { hardness: 3.0, tint: '#7f7f86', style: 'ore', speckle: '#2a51b8' });
def(DIAMOND_ORE, 'Diamond Ore', { hardness: 4.0, tint: '#7f7f86', style: 'ore', speckle: '#5fe3dc' });
def(EMERALD_ORE, 'Emerald Ore', { hardness: 4.0, tint: '#7f7f86', style: 'ore', speckle: '#36cd47' });

def(CACTUS, 'Cactus', { solid: false, hardness: 0.4, tint: '#4f8f4a', style: 'column' });
def(DEAD_BUSH, 'Dead Bush', { solid: false, hardness: 0.1, tint: '#9a7a42', style: 'plant' });

def(RED_SAND, 'Red Sand', { hardness: 0.5, tint: '#bf6a30' });
def(RED_SANDSTONE, 'Red Sandstone', { hardness: 0.9, tint: '#a85a28', style: 'layered' });
def(TERRACOTTA, 'Terracotta', { hardness: 1.4, tint: '#9a6247' });
def(TERRACOTTA_ORANGE, 'Orange Terracotta', { hardness: 1.4, tint: '#a05325', style: 'layered' });
def(TERRACOTTA_YELLOW, 'Yellow Terracotta', { hardness: 1.4, tint: '#b89524', style: 'layered' });
def(TERRACOTTA_WHITE, 'White Terracotta', { hardness: 1.4, tint: '#d1b2a1', style: 'layered' });
def(TERRACOTTA_BROWN, 'Brown Terracotta', { hardness: 1.4, tint: '#4d3423', style: 'layered' });
def(TERRACOTTA_RED, 'Red Terracotta', { hardness: 1.4, tint: '#8e3c2e', style: 'layered' });

def(TALL_GRASS, 'Tall Grass', { solid: false, hardness: 0.05, tint: '#6aa845', style: 'plant' });
def(FLOWER_RED, 'Poppy', { solid: false, hardness: 0.05, tint: '#cc3b34', style: 'flower' });
def(FLOWER_YELLOW, 'Dandelion', { solid: false, hardness: 0.05, tint: '#e6c53a', style: 'flower' });
def(DRY_GRASS, 'Dry Grass Block', { hardness: 0.6, tint: '#b0aa4e', style: 'grass', soil: DIRT, drops: DIRT });

def(OAK_LOG, 'Oak Log', { hardness: 1.2, tint: '#6b4c2b', style: 'log' });
def(OAK_LEAVES, 'Oak Leaves', { hardness: 0.25, tint: '#3f7a32', style: 'leaves' });
def(BIRCH_LOG, 'Birch Log', { hardness: 1.2, tint: '#d6d2c4', style: 'birch_log' });
def(BIRCH_LEAVES, 'Birch Leaves', { hardness: 0.25, tint: '#6a9b41', style: 'leaves' });
def(DARK_OAK_LOG, 'Dark Oak Log', { hardness: 1.3, tint: '#3f2d19', style: 'log' });
def(DARK_OAK_LEAVES, 'Dark Oak Leaves', { hardness: 0.25, tint: '#2c5a25', style: 'leaves' });
def(SPRUCE_LOG, 'Spruce Log', { hardness: 1.2, tint: '#513a1f', style: 'log' });
def(SPRUCE_LEAVES, 'Spruce Leaves', { hardness: 0.25, tint: '#2f5f42', style: 'leaves' });
def(JUNGLE_LOG, 'Jungle Log', { hardness: 1.2, tint: '#7a5a30', style: 'log' });
def(JUNGLE_LEAVES, 'Jungle Leaves', { hardness: 0.25, tint: '#3d8a2a', style: 'leaves' });
def(ACACIA_LOG, 'Acacia Log', { hardness: 1.2, tint: '#8a5a35', style: 'log' });
def(ACACIA_LEAVES, 'Acacia Leaves', { hardness: 0.25, tint: '#6f9b35', style: 'leaves' });

def(MUD, 'Mud', { hardness: 0.6, tint: '#4a3f38' });
def(SWAMP_GRASS, 'Swamp Grass', { hardness: 0.6, tint: '#4c7a3a', style: 'grass', soil: MUD, drops: MUD });
def(VINES, 'Vines', { solid: false, hardness: 0.1, tint: '#3c6b2c', style: 'vine' });
def(LILY_PAD, 'Lily Pad', { solid: false, hardness: 0.05, tint: '#3e7d36', style: 'flat' });
def(MANGROVE_LOG, 'Mangrove Log', { hardness: 1.2, tint: '#5e3a2e', style: 'log' });
def(MANGROVE_LEAVES, 'Mangrove Leaves', { hardness: 0.25, tint: '#3f6d33', style: 'leaves' });

def(MOSS_BLOCK, 'Moss Block', { hardness: 0.4, tint: '#5a7a32', style: 'moss' });
def(ROOTED_DIRT, 'Rooted Dirt', { hardness: 0.5, tint: '#7a5a3e', style: 'moss' });
def(HANGING_ROOTS, 'Hanging Roots', { solid: false, hardness: 0.1, tint: '#a2794f', style: 'vine' });
def(AZALEA_LEAVES, 'Azalea Leaves', { hardness: 0.25, tint: '#4f8a3a', style: 'leaves' });
def(GLOW_BERRIES, 'Glow Berries', { solid: false, hardness: 0.1, tint: '#e8a83c', style: 'vine', emit: 0.75 });
def(BIG_DRIPLEAF, 'Big Dripleaf', { solid: false, hardness: 0.1, tint: '#6f9e3e', style: 'flat' });

def(DEEPSLATE, 'Deepslate', { hardness: 2.2, tint: '#4a4a52', style: 'log', drops: COBBLED_DEEPSLATE });
def(COBBLED_DEEPSLATE, 'Cobbled Deepslate', { hardness: 2.4, tint: '#3f3f47', style: 'cobble' });
def(SCULK, 'Sculk', { hardness: 1.4, tint: '#12232b', style: 'sculk', emit: 0.06 });
def(SCULK_VEIN, 'Sculk Vein', { solid: false, hardness: 0.2, tint: '#1b3a44', style: 'vine', emit: 0.08 });
def(SCULK_CATALYST, 'Sculk Catalyst', { hardness: 2.0, tint: '#193038', style: 'sculk', emit: 0.45 });
def(SCULK_SENSOR, 'Sculk Sensor', { hardness: 1.6, tint: '#1d4450', style: 'sculk', emit: 0.35 });
def(REINFORCED_DEEPSLATE, 'Reinforced Deepslate', { hardness: null, tint: '#3a4046', style: 'sculk' });

def(NETHERRACK, 'Netherrack', { hardness: 0.6, tint: '#6e3436', style: 'moss' });
def(SOUL_SAND, 'Soul Sand', { hardness: 0.7, tint: '#4e3b2f', style: 'soul' });
def(SOUL_SOIL, 'Soul Soil', { hardness: 0.7, tint: '#463428', style: 'soul' });
def(BASALT, 'Basalt', { hardness: 1.5, tint: '#4a4a52', style: 'log' });
def(BLACKSTONE, 'Blackstone', { hardness: 1.6, tint: '#2c262f', style: 'cobble' });
def(MAGMA_BLOCK, 'Magma Block', { hardness: 0.8, tint: '#8e3a1c', style: 'magma', emit: 0.5 });
def(GLOWSTONE, 'Glowstone', { hardness: 0.5, tint: '#e6ca5a', style: 'glow', emit: 1 });
def(QUARTZ_ORE, 'Nether Quartz Ore', { hardness: 1.6, tint: '#6e3436', style: 'ore', speckle: '#e8e2dc', host: NETHERRACK });
def(NETHER_GOLD_ORE, 'Nether Gold Ore', { hardness: 1.6, tint: '#6e3436', style: 'ore', speckle: '#e9c34a', host: NETHERRACK });
def(LAVA, 'Lava', { solid: false, hardness: null, tint: '#e2611c', style: 'liquid', liquid: true, emit: 0.9 });
def(CRIMSON_NYLIUM, 'Crimson Nylium', { hardness: 0.8, tint: '#8d1f1f', style: 'grass', soil: NETHERRACK, drops: NETHERRACK });
def(CRIMSON_STEM, 'Crimson Stem', { hardness: 1.2, tint: '#6a344a', style: 'log' });
def(NETHER_WART_BLOCK, 'Nether Wart Block', { hardness: 0.5, tint: '#7a0d0d', style: 'leaves' });
def(WARPED_NYLIUM, 'Warped Nylium', { hardness: 0.8, tint: '#1c7a74', style: 'grass', soil: NETHERRACK, drops: NETHERRACK });
def(WARPED_STEM, 'Warped Stem', { hardness: 1.2, tint: '#2c5a5a', style: 'log' });
def(WARPED_WART_BLOCK, 'Warped Wart Block', { hardness: 0.5, tint: '#158b8b', style: 'leaves' });
def(SHROOMLIGHT, 'Shroomlight', { hardness: 0.5, tint: '#f0a845', style: 'glow', emit: 1 });
def(NETHER_BRICK, 'Nether Brick', { hardness: 1.8, tint: '#3a1d21', style: 'bricks' });

def(END_STONE, 'End Stone', { hardness: 1.5, tint: '#dcdba4' });
def(END_STONE_BRICKS, 'End Stone Bricks', { hardness: 1.7, tint: '#d3d29b', style: 'bricks' });
def(OBSIDIAN, 'Obsidian', { hardness: 6.0, tint: '#1a1424', style: 'glow', emit: 0.05 });
def(PURPUR_BLOCK, 'Purpur Block', { hardness: 1.5, tint: '#aa72a9', style: 'layered' });
def(CHORUS_STEM, 'Chorus Stem', { hardness: 0.6, tint: '#7a5a8a', style: 'log' });
def(CHORUS_FLOWER, 'Chorus Flower', { hardness: 0.6, tint: '#d4c9de', style: 'flower' });

def(NETHER_PORTAL, 'Nether Portal', { solid: false, hardness: null, tint: '#8a3ad4', style: 'portal', emit: 0.7 });
def(END_PORTAL, 'End Portal', { solid: false, hardness: null, tint: '#1b2a5a', style: 'portal', emit: 0.6 });
def(TORCH, 'Torch', { solid: false, hardness: 0.05, tint: '#f2c44a', style: 'torch', emit: 1 });

export const BLOCKS = R;

export function block(id) {
  return R[id] ?? R[AIR];
}

export function isSolid(id) {
  return block(id).solid;
}

export function isLiquid(id) {
  return block(id).liquid;
}

export function isBreakable(id) {
  const b = block(id);
  return id !== AIR && b.hardness !== null;
}

/** What lands in the inventory when `id` is mined. */
export function dropOf(id) {
  const b = block(id);
  return b.drops ?? id;
}

/** Decorations sit in a cell without supporting the player or filling it. */
export function isDecoration(id) {
  return id !== AIR && !block(id).solid && !block(id).liquid;
}

/** Every id the player can hold and place, in a sensible hotbar order. */
export const PLACEABLE = Object.values(R)
  .filter((b) => b.id !== AIR && b.hardness !== null && b.style !== 'portal')
  .map((b) => b.id);
