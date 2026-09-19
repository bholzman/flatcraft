import * as B from './blocks.js';
import * as I from './items.js';

// Loot tables, one per structure chest. Each entry is rolled independently:
// `chance` that it appears at all, then a count between min and max.

const e = (id, chance, min, max = min) => ({ id, chance, min, max });

export const LOOT = {
  village: [
    e(B.OAK_PLANKS, 0.8, 4, 12), e(I.RAW_BEEF, 0.5, 1, 3),
    e(I.LEATHER, 0.4, 1, 3), e(B.HAY_BALE, 0.4, 1, 3),
    e(I.IRON_SWORD, 0.15, 1), e(I.ARROW, 0.35, 3, 8),
    e(I.FLINT_AND_STEEL, 0.25, 1), e(I.FLINT, 0.4, 1, 3),
    e(B.IRON_ORE, 0.3, 1, 4), e(I.POTION_HEALING, 0.12, 1),
  ],
  desert_pyramid: [
    e(B.GOLD_ORE, 0.5, 2, 6), e(I.DIAMOND_SWORD, 0.05, 1),
    e(B.DIAMOND_ORE, 0.12, 1, 2), e(I.BONE, 0.5, 2, 6),
    e(I.GUNPOWDER, 0.4, 2, 5), e(B.SAND, 0.6, 6, 16),
    e(I.GOLDEN_SWORD, 0.18, 1), e(I.POTION_REGENERATION, 0.15, 1),
  ],
  jungle_temple: [
    e(B.EMERALD_ORE, 0.4, 1, 3), e(I.DIAMOND_SWORD, 0.06, 1),
    e(B.GOLD_ORE, 0.4, 1, 4), e(I.ARROW, 0.5, 4, 10),
    e(B.JUNGLE_LOG, 0.5, 4, 10), e(I.POTION_SWIFTNESS, 0.2, 1),
  ],
  swamp_hut: [
    e(I.SPIDER_EYE, 0.7, 1, 4), e(I.GUNPOWDER, 0.5, 1, 4),
    e(I.POTION_HARMING, 0.3, 1, 2), e(B.MUD, 0.5, 4, 10),
    e(I.SLIME_BALL, 0.4, 1, 3),
  ],
  igloo: [
    e(B.SNOW_BLOCK, 0.8, 4, 12), e(I.RAW_BEEF, 0.5, 1, 3),
    e(B.ICE, 0.5, 2, 6), e(I.POTION_FIRE_RESISTANCE, 0.2, 1),
    e(I.LEATHER, 0.4, 1, 3), e(B.GOLD_ORE, 0.25, 1, 3),
    e(I.SNOWBALL, 0.6, 2, 8),
  ],
  mansion: [
    e(I.DIAMOND_SWORD, 0.12, 1), e(B.DIAMOND_ORE, 0.2, 1, 3),
    e(I.IRON_SWORD, 0.35, 1), e(B.DARK_OAK_PLANKS, 0.7, 6, 16),
    e(I.POTION_STRENGTH, 0.25, 1), e(B.BOOKSHELF, 0.3, 1, 3),
  ],
  outpost: [
    e(I.ARROW, 0.8, 6, 16), e(I.BOW, 0.4, 1),
    e(B.DARK_OAK_LOG, 0.5, 4, 10), e(I.IRON_SWORD, 0.2, 1),
    e(I.GUNPOWDER, 0.3, 1, 4),
  ],
  shipwreck: [
    e(I.LEATHER, 0.5, 1, 4), e(B.OAK_PLANKS, 0.7, 4, 12),
    e(B.IRON_ORE, 0.35, 1, 4), e(B.GOLD_ORE, 0.25, 1, 3),
    e(I.POTION_FIRE_RESISTANCE, 0.15, 1), e(I.FEATHER, 0.4, 1, 4),
  ],
  buried_treasure: [
    e(B.DIAMOND_ORE, 0.6, 1, 3), e(B.GOLD_ORE, 0.8, 3, 8),
    e(I.IRON_SWORD, 0.4, 1), e(I.POTION_HEALING, 0.5, 1, 2),
    e(B.EMERALD_ORE, 0.3, 1, 3),
  ],
  monument: [
    e(B.PRISMARINE, 0.8, 6, 16), e(B.SEA_LANTERN, 0.5, 1, 4),
    e(I.POTION_SWIFTNESS, 0.2, 1), e(B.GOLD_ORE, 0.3, 1, 4),
  ],
  mineshaft: [
    e(B.IRON_ORE, 0.5, 1, 5), e(B.COAL_ORE, 0.6, 2, 8),
    e(B.GOLD_ORE, 0.2, 1, 3), e(I.BONE, 0.4, 1, 4),
    e(B.RAIL, 0.5, 2, 8), e(B.OAK_PLANKS, 0.4, 3, 8),
  ],
  stronghold: [
    e(I.DIAMOND_SWORD, 0.1, 1), e(B.DIAMOND_ORE, 0.2, 1, 3),
    e(I.ENDER_PEARL, 0.4, 1, 3), e(B.BOOKSHELF, 0.4, 1, 4),
    e(I.POTION_REGENERATION, 0.2, 1), e(B.IRON_ORE, 0.5, 2, 6),
  ],
  dungeon: [
    e(I.BONE, 0.6, 2, 6), e(I.GUNPOWDER, 0.5, 1, 4),
    e(I.ROTTEN_FLESH, 0.5, 1, 4), e(B.IRON_ORE, 0.3, 1, 4),
    e(I.GOLDEN_SWORD, 0.12, 1), e(I.POTION_HEALING, 0.2, 1),
  ],
  ancient_city: [
    e(I.ECHO_SHARD, 0.6, 1, 3), e(I.DIAMOND_SWORD, 0.15, 1),
    e(B.DIAMOND_ORE, 0.25, 1, 3), e(B.SCULK_CATALYST, 0.3, 1, 2),
    e(I.POTION_REGENERATION, 0.3, 1), e(B.DEEPSLATE_BRICKS, 0.5, 6, 16),
  ],
  geode: [
    e(B.AMETHYST_BLOCK, 0.9, 4, 10), e(B.CALCITE, 0.5, 4, 8),
  ],
  ruined_portal: [
    e(B.OBSIDIAN, 0.5, 1, 4), e(B.GOLD_ORE, 0.5, 1, 5),
    e(I.POTION_FIRE_RESISTANCE, 0.3, 1), e(B.CRYING_OBSIDIAN, 0.3, 1, 2),
    e(I.FLINT_AND_STEEL, 0.6, 1), e(I.FLINT, 0.5, 1, 3),
  ],
  nether_fortress: [
    e(I.BLAZE_ROD, 0.5, 1, 3), e(B.NETHER_GOLD_ORE, 0.5, 2, 6),
    e(I.DIAMOND_SWORD, 0.1, 1), e(B.NETHER_BRICK, 0.6, 6, 16),
    e(I.FLINT_AND_STEEL, 0.4, 1),
    e(I.POTION_FIRE_RESISTANCE, 0.4, 1, 2),
  ],
  bastion: [
    e(B.GILDED_BLACKSTONE, 0.5, 2, 6), e(I.NETHERITE_SWORD, 0.06, 1),
    e(B.GOLD_ORE, 0.7, 4, 10), e(B.BLACKSTONE, 0.6, 6, 16),
    e(I.POTION_STRENGTH, 0.25, 1),
  ],
  end_city: [
    e(I.SHULKER_SHELL, 0.5, 1, 2), e(B.PURPUR_BLOCK, 0.7, 4, 12),
    e(I.DIAMOND_SWORD, 0.2, 1), e(I.NETHERITE_SWORD, 0.08, 1),
    e(B.DIAMOND_ORE, 0.3, 1, 4), e(I.ENDER_PEARL, 0.4, 1, 4),
  ],
};

/** Roll one chest's contents. */
export function rollLoot(table, rand = Math.random) {
  const entries = LOOT[table] ?? LOOT.dungeon;
  const out = [];
  for (const it of entries) {
    if (it.id === undefined || rand() > it.chance) continue;
    const n = it.min + Math.floor(rand() * (it.max - it.min + 1));
    if (n > 0) out.push({ id: it.id, count: n });
  }
  // Never hand back an empty chest; it reads as a bug rather than bad luck.
  if (!out.length) {
    const pick = entries[Math.floor(rand() * entries.length)];
    if (pick?.id !== undefined) out.push({ id: pick.id, count: Math.max(1, pick.min) });
  }
  return out;
}
