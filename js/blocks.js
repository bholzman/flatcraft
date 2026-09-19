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

// --- structure materials ---
export const CHEST = 96;
export const SPAWNER = 97;
export const CRAFTING_TABLE = 98;
export const FURNACE = 99;
export const BOOKSHELF = 100;
export const MOSSY_COBBLESTONE = 101;
export const STONE_BRICKS = 102;
export const MOSSY_STONE_BRICKS = 103;
export const CRACKED_STONE_BRICKS = 104;
export const CHISELED_STONE_BRICKS = 105;
export const COBWEB = 106;
export const RAIL = 107;
export const OAK_FENCE = 108;
export const LADDER = 109;
export const OAK_DOOR = 110;
export const PRISMARINE = 111;
export const DARK_PRISMARINE = 112;
export const SEA_LANTERN = 113;
export const CRYING_OBSIDIAN = 114;
export const AMETHYST_BLOCK = 115;
export const BUDDING_AMETHYST = 116;
export const CALCITE = 117;
export const SMOOTH_BASALT = 118;
export const HAY_BALE = 119;
export const FARMLAND = 120;
export const WHEAT = 121;
export const BRICKS = 122;
export const CHISELED_SANDSTONE = 123;
export const TNT = 124;
export const PURPUR_PILLAR = 125;
export const END_ROD = 126;
export const SCULK_SHRIEKER = 127;
export const POLISHED_BLACKSTONE = 128;
export const GILDED_BLACKSTONE = 129;
export const NETHER_BRICK_FENCE = 130;
export const SPRUCE_PLANKS = 131;
export const BIRCH_PLANKS = 132;
export const DARK_OAK_PLANKS = 133;
export const JUNGLE_PLANKS = 134;
export const ACACIA_PLANKS = 135;
export const WHITE_WOOL = 136;
export const RED_WOOL = 137;
export const LANTERN = 138;
export const BARREL = 139;
export const DEEPSLATE_BRICKS = 140;
export const DEEPSLATE_TILES = 141;
export const SOUL_LANTERN = 142;
export const CHISELED_RED_SANDSTONE = 143;

// --- snow and ice ---
export const SNOW_BLOCK = 144;
export const SNOW_LAYER = 145;
export const ICE = 146;
export const PACKED_ICE = 147;
export const BLUE_ICE = 148;
export const POWDER_SNOW = 149;

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
def(GRAVEL, 'Gravel', { hardness: 0.6, tint: '#84807e', style: 'cobble' });   // sometimes drops flint
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

// --- structure materials ---
def(CHEST, 'Chest', { hardness: 1.2, tint: '#9c7440', style: 'chest' });
def(SPAWNER, 'Monster Spawner', { hardness: 4.0, tint: '#2a2e36', style: 'cage', emit: 0.25 });
def(CRAFTING_TABLE, 'Crafting Table', { hardness: 1.0, tint: '#9a6b3a', style: 'crafting' });
def(FURNACE, 'Furnace', { hardness: 1.8, tint: '#6e6e75', style: 'furnace' });
def(BOOKSHELF, 'Bookshelf', { hardness: 1.0, tint: '#9a6b3a', style: 'bookshelf' });
def(MOSSY_COBBLESTONE, 'Mossy Cobblestone', { hardness: 1.7, tint: '#5f7250', style: 'cobble' });
def(STONE_BRICKS, 'Stone Bricks', { hardness: 1.6, tint: '#7a7a80', style: 'bricks' });
def(MOSSY_STONE_BRICKS, 'Mossy Stone Bricks', { hardness: 1.6, tint: '#67785c', style: 'bricks' });
def(CRACKED_STONE_BRICKS, 'Cracked Stone Bricks', { hardness: 1.6, tint: '#70706f', style: 'cracked' });
def(CHISELED_STONE_BRICKS, 'Chiseled Stone Bricks', { hardness: 1.6, tint: '#80808a', style: 'chiseled' });
def(COBWEB, 'Cobweb', { solid: false, hardness: 1.4, tint: '#e0e4ea', style: 'web' });
def(RAIL, 'Rail', { solid: false, hardness: 0.3, tint: '#8a8a92', style: 'rail' });
def(OAK_FENCE, 'Oak Fence', { solid: false, hardness: 0.9, tint: '#a97b46', style: 'fence' });
def(LADDER, 'Ladder', { solid: false, hardness: 0.4, tint: '#9c7440', style: 'ladder', climbable: true });
def(OAK_DOOR, 'Oak Door', { solid: false, hardness: 0.9, tint: '#a97b46', style: 'door' });
def(PRISMARINE, 'Prismarine', { hardness: 1.5, tint: '#5a9a8e', style: 'moss' });
def(DARK_PRISMARINE, 'Dark Prismarine', { hardness: 1.5, tint: '#2e5449', style: 'layered' });
def(SEA_LANTERN, 'Sea Lantern', { hardness: 0.5, tint: '#a8e4d8', style: 'glow', emit: 0.9 });
def(CRYING_OBSIDIAN, 'Crying Obsidian', { hardness: 6.0, tint: '#2a1250', style: 'glow', emit: 0.45 });
def(AMETHYST_BLOCK, 'Amethyst Block', { hardness: 1.2, tint: '#8a5cc4', style: 'crystal', emit: 0.2 });
def(BUDDING_AMETHYST, 'Budding Amethyst', { hardness: 1.4, tint: '#7a4cb4', style: 'crystal', emit: 0.35 });
def(CALCITE, 'Calcite', { hardness: 1.2, tint: '#dcdcd4', style: 'plain' });
def(SMOOTH_BASALT, 'Smooth Basalt', { hardness: 1.5, tint: '#3a3a42', style: 'layered' });
def(HAY_BALE, 'Hay Bale', { hardness: 0.5, tint: '#c9a834', style: 'log' });
def(FARMLAND, 'Farmland', { hardness: 0.5, tint: '#6a4a30', style: 'layered' });
def(WHEAT, 'Wheat', { solid: false, hardness: 0.05, tint: '#cbb03a', style: 'plant' });
def(BRICKS, 'Bricks', { hardness: 1.8, tint: '#96584a', style: 'bricks' });
def(CHISELED_SANDSTONE, 'Chiseled Sandstone', { hardness: 0.9, tint: '#cfc08a', style: 'chiseled' });
def(CHISELED_RED_SANDSTONE, 'Chiseled Red Sandstone', { hardness: 0.9, tint: '#a85a28', style: 'chiseled' });
def(TNT, 'TNT', { hardness: 0.1, tint: '#c4342a', style: 'tnt' });
def(PURPUR_PILLAR, 'Purpur Pillar', { hardness: 1.5, tint: '#aa72a9', style: 'log' });
def(END_ROD, 'End Rod', { solid: false, hardness: 0.2, tint: '#f2eede', style: 'torch', emit: 0.85 });
def(SCULK_SHRIEKER, 'Sculk Shrieker', { hardness: 2.0, tint: '#2a3a3e', style: 'cage', emit: 0.4 });
def(POLISHED_BLACKSTONE, 'Polished Blackstone', { hardness: 1.7, tint: '#332d38', style: 'layered' });
def(GILDED_BLACKSTONE, 'Gilded Blackstone', { hardness: 1.8, tint: '#2c262f', style: 'ore', speckle: '#e9c34a' });
def(NETHER_BRICK_FENCE, 'Nether Brick Fence', { solid: false, hardness: 1.8, tint: '#3a1d21', style: 'fence' });
def(SPRUCE_PLANKS, 'Spruce Planks', { hardness: 0.9, tint: '#7a5a38', style: 'planks' });
def(BIRCH_PLANKS, 'Birch Planks', { hardness: 0.9, tint: '#d4c48e', style: 'planks' });
def(DARK_OAK_PLANKS, 'Dark Oak Planks', { hardness: 0.9, tint: '#4a3420', style: 'planks' });
def(JUNGLE_PLANKS, 'Jungle Planks', { hardness: 0.9, tint: '#a9805a', style: 'planks' });
def(ACACIA_PLANKS, 'Acacia Planks', { hardness: 0.9, tint: '#b06a3a', style: 'planks' });
def(WHITE_WOOL, 'White Wool', { hardness: 0.4, tint: '#e8e8ea', style: 'wool' });
def(RED_WOOL, 'Red Wool', { hardness: 0.4, tint: '#a83a32', style: 'wool' });
def(LANTERN, 'Lantern', { solid: false, hardness: 0.5, tint: '#e8c43a', style: 'lantern', emit: 0.95 });
def(SOUL_LANTERN, 'Soul Lantern', { solid: false, hardness: 0.5, tint: '#4ad8e0', style: 'lantern', emit: 0.8 });
def(BARREL, 'Barrel', { hardness: 1.0, tint: '#8a6a40', style: 'log' });
def(DEEPSLATE_BRICKS, 'Deepslate Bricks', { hardness: 2.4, tint: '#44444c', style: 'bricks' });
def(DEEPSLATE_TILES, 'Deepslate Tiles', { hardness: 2.4, tint: '#35353d', style: 'layered' });

def(SNOW_BLOCK, 'Snow Block', { hardness: 0.4, tint: '#f0f4f8' });
def(SNOW_LAYER, 'Snow', { solid: false, hardness: 0.1, tint: '#f4f8fc', style: 'flat' });
def(ICE, 'Ice', { hardness: 0.6, tint: '#9dc2ee', style: 'glass', slippery: true });
def(PACKED_ICE, 'Packed Ice', { hardness: 1.0, tint: '#83abdd', slippery: true });
def(BLUE_ICE, 'Blue Ice', { hardness: 1.4, tint: '#5f96d8', slippery: true });
def(POWDER_SNOW, 'Powder Snow', { solid: false, hardness: 0.3, tint: '#e8f2fb', style: 'plain' });

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
