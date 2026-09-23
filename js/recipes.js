import * as B from './blocks.js';
import * as I from './items.js';

// Recipes are declarative: what goes in, what comes out, and where you have to
// be standing to do it.
//
//   grid 2   craftable by hand, anywhere
//   grid 3   needs a crafting table within reach
//   station  'furnace' smelts instead: one input, plus fuel to burn
//
// There's no placement grid — the panel is a recipe book, which is how a
// mouse-driven browser game stays usable without drag and drop.

const R = [];

function recipe(category, out, ins, opts = {}) {
  R.push({
    id: `${category}:${R.length}`,
    category,
    out: { id: out[0], count: out[1] ?? 1 },
    in: ins.map(([id, count]) => ({ id, count: count ?? 1 })),
    grid: opts.grid ?? 2,
    station: opts.station ?? null,
    ...opts,
  });
}

// Every wood type makes the same things, so generate those rather than
// writing six near-identical blocks by hand.
const WOODS = [
  ['Oak', B.OAK_LOG, B.OAK_PLANKS],
  ['Spruce', B.SPRUCE_LOG, B.SPRUCE_PLANKS],
  ['Birch', B.BIRCH_LOG, B.BIRCH_PLANKS],
  ['Dark Oak', B.DARK_OAK_LOG, B.DARK_OAK_PLANKS],
  ['Jungle', B.JUNGLE_LOG, B.JUNGLE_PLANKS],
  ['Acacia', B.ACACIA_LOG, B.ACACIA_PLANKS],
  ['Mangrove', B.MANGROVE_LOG, B.MANGROVE_PLANKS],
];

for (const [, log, planks] of WOODS) {
  recipe('Wood', [planks, 4], [[log, 1]]);
}
recipe('Wood', [I.STICK, 4], [[B.OAK_PLANKS, 2]]);
recipe('Wood', [B.CRAFTING_TABLE, 1], [[B.OAK_PLANKS, 4]]);
recipe('Wood', [B.CHEST, 1], [[B.OAK_PLANKS, 8]], { grid: 3 });
recipe('Wood', [B.BARREL, 1], [[B.OAK_PLANKS, 6], [I.STICK, 2]], { grid: 3 });
recipe('Wood', [B.OAK_FENCE, 3], [[B.OAK_PLANKS, 4], [I.STICK, 2]], { grid: 3 });
recipe('Wood', [B.LADDER, 3], [[I.STICK, 7]], { grid: 3 });
recipe('Wood', [B.OAK_DOOR, 2], [[B.OAK_PLANKS, 6]], { grid: 3 });
recipe('Wood', [B.BOOKSHELF, 1], [[B.OAK_PLANKS, 6], [B.OAK_LEAVES, 3]], { grid: 3 });

// ---- stone and building ----
recipe('Building', [B.FURNACE, 1], [[B.COBBLESTONE, 8]], { grid: 3 });
recipe('Building', [B.STONE_BRICKS, 4], [[B.STONE, 4]]);
recipe('Building', [B.CHISELED_STONE_BRICKS, 1], [[B.STONE_BRICKS, 2]]);
recipe('Building', [B.MOSSY_COBBLESTONE, 1], [[B.COBBLESTONE, 1], [B.MOSS_BLOCK, 1]]);
recipe('Building', [B.BRICKS, 1], [[B.CLAY, 4]]);
recipe('Building', [B.SANDSTONE, 1], [[B.SAND, 4]]);
recipe('Building', [B.RED_SANDSTONE, 1], [[B.RED_SAND, 4]]);
recipe('Building', [B.CHISELED_SANDSTONE, 1], [[B.SANDSTONE, 2]]);
recipe('Building', [B.DEEPSLATE_BRICKS, 4], [[B.COBBLED_DEEPSLATE, 4]]);
recipe('Building', [B.DEEPSLATE_TILES, 4], [[B.DEEPSLATE_BRICKS, 4]]);
recipe('Building', [B.POLISHED_BLACKSTONE, 4], [[B.BLACKSTONE, 4]]);
recipe('Building', [B.NETHER_BRICK, 1], [[B.NETHERRACK, 4]]);
recipe('Building', [B.NETHER_BRICK_FENCE, 4], [[B.NETHER_BRICK, 6]], { grid: 3 });
recipe('Building', [B.PURPUR_BLOCK, 4], [[B.CHORUS_FLOWER, 4]]);
recipe('Building', [B.PURPUR_PILLAR, 1], [[B.PURPUR_BLOCK, 2]]);
recipe('Building', [B.END_STONE_BRICKS, 4], [[B.END_STONE, 4]]);

// ---- snow and ice ----
recipe('Snow', [B.SNOW_BLOCK, 1], [[I.SNOWBALL, 4]]);
recipe('Snow', [B.PACKED_ICE, 1], [[B.ICE, 9]], { grid: 3 });
recipe('Snow', [B.BLUE_ICE, 1], [[B.PACKED_ICE, 9]], { grid: 3 });

// ---- light ----
recipe('Light', [B.TORCH, 4], [[I.STICK, 1], [I.COAL, 1]]);
recipe('Light', [B.LANTERN, 1], [[I.IRON_INGOT, 1], [B.TORCH, 1]]);
recipe('Light', [B.SOUL_LANTERN, 1], [[B.LANTERN, 1], [B.SOUL_SAND, 1]]);
recipe('Light', [B.SEA_LANTERN, 1], [[B.PRISMARINE, 4], [I.QUARTZ, 4]], { grid: 3 });
recipe('Light', [B.GLOWSTONE, 1], [[I.QUARTZ, 4]]);

// ---- tools and weapons ----
const SWORD_MATERIALS = [
  [B.OAK_PLANKS, I.WOODEN_SWORD],
  [B.COBBLESTONE, I.STONE_SWORD],
  [I.IRON_INGOT, I.IRON_SWORD],
  [I.GOLD_INGOT, I.GOLDEN_SWORD],
  [I.DIAMOND, I.DIAMOND_SWORD],
  [I.NETHERITE_INGOT, I.NETHERITE_SWORD],
];
for (const [mat, sword] of SWORD_MATERIALS) {
  recipe('Combat', [sword, 1], [[mat, 2], [I.STICK, 1]]);
}
recipe('Combat', [I.BOW, 1], [[I.STICK, 3], [I.STRING, 3]], { grid: 3 });
recipe('Combat', [I.ARROW, 4], [[I.FLINT, 1], [I.STICK, 1], [I.FEATHER, 1]]);
recipe('Combat', [I.FLINT_AND_STEEL, 1], [[I.IRON_INGOT, 1], [I.FLINT, 1]]);
recipe('Combat', [B.TNT, 1], [[I.GUNPOWDER, 5], [B.SAND, 4]], { grid: 3 });

// ---- misc ----
recipe('Misc', [B.WHITE_WOOL, 1], [[I.STRING, 4]]);
recipe('Misc', [B.RED_WOOL, 1], [[B.WHITE_WOOL, 1], [I.REDSTONE, 1]]);
recipe('Misc', [B.HAY_BALE, 1], [[B.WHEAT, 9]], { grid: 3 });
recipe('Misc', [B.COBWEB, 1], [[I.STRING, 5]]);
recipe('Misc', [B.RAIL, 8], [[I.IRON_INGOT, 6], [I.STICK, 1]], { grid: 3 });
// Brewing has no stand of its own here, so potions are crafting-table recipes
// built from a glass bottle's worth of glass plus the usual reagents.
recipe('Brewing', [I.POTION_HEALING, 1], [[B.GLASS, 1], [B.GLOWSTONE, 1], [I.SPIDER_EYE, 1]], { grid: 3 });
recipe('Brewing', [I.POTION_REGENERATION, 1], [[B.GLASS, 1], [I.GHAST_TEAR, 1], [I.QUARTZ, 1]], { grid: 3 });
recipe('Brewing', [I.POTION_SWIFTNESS, 1], [[B.GLASS, 1], [I.SNOWBALL, 2], [I.QUARTZ, 1]], { grid: 3 });
recipe('Brewing', [I.POTION_STRENGTH, 1], [[B.GLASS, 1], [I.BLAZE_ROD, 1], [I.QUARTZ, 1]], { grid: 3 });
recipe('Brewing', [I.POTION_FIRE_RESISTANCE, 1], [[B.GLASS, 1], [B.MAGMA_BLOCK, 1], [I.BLAZE_ROD, 1]], { grid: 3 });
recipe('Brewing', [I.POTION_HARMING, 2], [[I.POTION_HEALING, 1], [I.SPIDER_EYE, 1], [I.GUNPOWDER, 1]], { grid: 3 });

// ---- smelting ----
const smelt = (out, input) => recipe('Smelting', out, [[input, 1]], { station: 'furnace' });
smelt([I.IRON_INGOT, 1], B.IRON_ORE);
smelt([I.GOLD_INGOT, 1], B.GOLD_ORE);
smelt([I.COPPER_INGOT, 1], B.COPPER_ORE);
smelt([B.GLASS, 1], B.SAND);
smelt([B.STONE, 1], B.COBBLESTONE);
smelt([B.DEEPSLATE, 1], B.COBBLED_DEEPSLATE);
smelt([B.SMOOTH_BASALT, 1], B.BASALT);
smelt([I.COAL, 1], B.OAK_LOG);            // charcoal
smelt([B.TERRACOTTA, 1], B.CLAY);
smelt([B.CRACKED_STONE_BRICKS, 1], B.STONE_BRICKS);

export const RECIPES = R.filter((r) =>
  r.out.id !== undefined && r.in.every((i) => i.id !== undefined));

export const CATEGORIES = [...new Set(RECIPES.map((r) => r.category))];

/** Fuel value in items smelted, for anything that can go in a furnace. */
export const FUEL = {
  [I.COAL]: 8,
  [B.OAK_PLANKS]: 2, [B.SPRUCE_PLANKS]: 2, [B.BIRCH_PLANKS]: 2,
  [B.DARK_OAK_PLANKS]: 2, [B.JUNGLE_PLANKS]: 2, [B.ACACIA_PLANKS]: 2,
  [B.MANGROVE_PLANKS]: 2, [B.MANGROVE_LOG]: 2,
  [B.OAK_LOG]: 2, [B.SPRUCE_LOG]: 2, [B.BIRCH_LOG]: 2,
  [B.DARK_OAK_LOG]: 2, [B.JUNGLE_LOG]: 2, [B.ACACIA_LOG]: 2,
  [I.STICK]: 1,
  [I.BLAZE_ROD]: 12,
};

export function fuelValue(id) {
  return FUEL[id] ?? 0;
}
