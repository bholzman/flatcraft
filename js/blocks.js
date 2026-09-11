// Block registry. Ids are stable numbers; the world grid stores ids.
//
// Fields:
//   solid    - blocks player movement
//   hardness - seconds of mining at strength 1 (null = unbreakable)
//   drops    - block id added to the inventory when mined (defaults to itself)
//   tint     - base colour; texture() paints per-pixel variation on top
//   liquid   - rendered translucent, no collision

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const COBBLE = 4;
export const SAND = 5;
export const WOOD = 6;
export const LEAVES = 7;
export const COAL_ORE = 8;
export const IRON_ORE = 9;
export const GOLD_ORE = 10;
export const DIAMOND_ORE = 11;
export const BEDROCK = 12;
export const PLANKS = 13;
export const WATER = 14;
export const GLASS = 15;

export const BLOCKS = {
  [AIR]:         { name: 'Air',         solid: false, hardness: null, tint: null },
  [GRASS]:       { name: 'Grass',       solid: true,  hardness: 0.6,  tint: '#5d9b3f', drops: DIRT },
  [DIRT]:        { name: 'Dirt',        solid: true,  hardness: 0.5,  tint: '#8b6141' },
  [STONE]:       { name: 'Stone',       solid: true,  hardness: 1.5,  tint: '#7f7f86', drops: COBBLE },
  [COBBLE]:      { name: 'Cobblestone', solid: true,  hardness: 1.7,  tint: '#6e6e75' },
  [SAND]:        { name: 'Sand',        solid: true,  hardness: 0.5,  tint: '#dbcd8f' },
  [WOOD]:        { name: 'Wood',        solid: true,  hardness: 1.2,  tint: '#6b4c2b' },
  [LEAVES]:      { name: 'Leaves',      solid: true,  hardness: 0.25, tint: '#3f7a32' },
  [COAL_ORE]:    { name: 'Coal Ore',    solid: true,  hardness: 2.2,  tint: '#7f7f86' },
  [IRON_ORE]:    { name: 'Iron Ore',    solid: true,  hardness: 2.8,  tint: '#7f7f86' },
  [GOLD_ORE]:    { name: 'Gold Ore',    solid: true,  hardness: 3.2,  tint: '#7f7f86' },
  [DIAMOND_ORE]: { name: 'Diamond Ore', solid: true,  hardness: 4.0,  tint: '#7f7f86' },
  [BEDROCK]:     { name: 'Bedrock',     solid: true,  hardness: null, tint: '#2a2a30' },
  [PLANKS]:      { name: 'Planks',      solid: true,  hardness: 0.9,  tint: '#a97b46' },
  [WATER]:       { name: 'Water',       solid: false, hardness: null, tint: '#3b6fd4', liquid: true },
  [GLASS]:       { name: 'Glass',       solid: true,  hardness: 0.4,  tint: '#bcd8e4', liquid: true },
};

// Ore speckle colours, drawn over the stone base.
export const ORE_SPECKLE = {
  [COAL_ORE]:    '#1e1e22',
  [IRON_ORE]:    '#c69a7b',
  [GOLD_ORE]:    '#e9c34a',
  [DIAMOND_ORE]: '#5fe3dc',
};

export function block(id) {
  return BLOCKS[id] ?? BLOCKS[AIR];
}

export function isSolid(id) {
  return block(id).solid;
}

export function isBreakable(id) {
  return id !== AIR && block(id).hardness !== null;
}

/** What lands in the inventory when `id` is mined. */
export function dropOf(id) {
  const b = block(id);
  return b.drops ?? id;
}

/** Every id the player can hold/place, in hotbar-friendly order. */
export const PLACEABLE = [
  GRASS, DIRT, STONE, COBBLE, SAND, WOOD, PLANKS, LEAVES, GLASS,
  COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE,
];
