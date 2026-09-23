// Items live above the block id range so one number identifies either a block
// or an item, and the inventory can hold both without a second field.
// (World grids are Uint8Array, so nothing >= 256 can ever be a placed block.)

import { block } from './blocks.js';

export const ITEM_BASE = 256;

export const WOODEN_SWORD = 256;
export const STONE_SWORD = 257;
export const IRON_SWORD = 258;
export const GOLDEN_SWORD = 259;
export const DIAMOND_SWORD = 260;
export const NETHERITE_SWORD = 261;

export const FLINT_AND_STEEL = 268;
export const FLINT = 269;
export const BOW = 270;
export const ARROW = 271;

export const POTION_HEALING = 280;
export const POTION_REGENERATION = 281;
export const POTION_STRENGTH = 282;
export const POTION_SWIFTNESS = 283;
export const POTION_FIRE_RESISTANCE = 284;
export const POTION_HARMING = 285;      // splash: thrown, hurts what it lands on

// Mob drops that aren't blocks.
export const ROTTEN_FLESH = 290;
export const BONE = 291;
export const STRING = 292;
export const GUNPOWDER = 293;
export const SPIDER_EYE = 294;
export const ENDER_PEARL = 295;
export const BLAZE_ROD = 296;
export const SLIME_BALL = 297;
export const LEATHER = 298;
export const FEATHER = 299;
export const RAW_PORKCHOP = 300;
export const RAW_BEEF = 301;
export const WOOL = 302;
export const GHAST_TEAR = 303;
export const PHANTOM_MEMBRANE = 304;
export const SHULKER_SHELL = 305;
export const ECHO_SHARD = 306;
export const SNOWBALL = 307;

// --- crafting materials ---
export const STICK = 310;
export const COAL = 311;
export const IRON_INGOT = 312;
export const GOLD_INGOT = 313;
export const COPPER_INGOT = 314;
export const DIAMOND = 315;
export const EMERALD = 316;
export const LAPIS = 317;
export const REDSTONE = 318;
export const QUARTZ = 319;
export const NETHERITE_INGOT = 320;

const R = {};

function def(id, name, opts = {}) {
  R[id] = { id, name, kind: 'material', stack: 64, tint: '#b0b0b8', ...opts };
}

// --- swords: `damage` replaces the bare-hand 1, `speed` is attacks per second
const sword = (id, name, damage, tint) =>
  def(id, name, { kind: 'sword', damage, stack: 1, tint, icon: 'sword' });

sword(WOODEN_SWORD, 'Wooden Sword', 4, '#9c7440');
sword(STONE_SWORD, 'Stone Sword', 5, '#8a8a92');
sword(IRON_SWORD, 'Iron Sword', 6, '#d8d8de');
sword(GOLDEN_SWORD, 'Golden Sword', 4, '#f0cf52');
sword(DIAMOND_SWORD, 'Diamond Sword', 7, '#5fe3dc');
sword(NETHERITE_SWORD, 'Netherite Sword', 8, '#5a4f52');

def(FLINT_AND_STEEL, 'Flint and Steel', { kind: 'igniter', stack: 1, tint: '#b8b8c0', icon: 'igniter' });
def(FLINT, 'Flint', { tint: '#4a4a52' });
def(BOW, 'Bow', { kind: 'bow', stack: 1, tint: '#9c7440', icon: 'bow', drawTime: 1.0, damage: 6 });
def(ARROW, 'Arrow', { kind: 'ammo', tint: '#c9c4bc', icon: 'arrow' });

// --- potions: `effect` is applied on drink, `splash` ones are thrown instead
const potion = (id, name, tint, effect, opts = {}) =>
  def(id, name, { kind: 'potion', stack: 16, tint, icon: 'potion', effect, ...opts });

potion(POTION_HEALING, 'Potion of Healing', '#f0447a', { heal: 7 });
potion(POTION_REGENERATION, 'Potion of Regeneration', '#cd5cab', { regen: 1.2, duration: 22 });
potion(POTION_STRENGTH, 'Potion of Strength', '#932423', { strength: 3, duration: 30 });
potion(POTION_SWIFTNESS, 'Potion of Swiftness', '#7cafc6', { speed: 1.35, duration: 30 });
potion(POTION_FIRE_RESISTANCE, 'Potion of Fire Resistance', '#e49a3a', { fireResist: true, duration: 30 });
potion(POTION_HARMING, 'Splash Potion of Harming', '#430a09', { damage: 6 }, { splash: true });

def(ROTTEN_FLESH, 'Rotten Flesh', { tint: '#7a5a3a' });
def(BONE, 'Bone', { tint: '#e2ded0' });
def(STRING, 'String', { tint: '#dcdcdc' });
def(GUNPOWDER, 'Gunpowder', { tint: '#4a4a4a' });
def(SPIDER_EYE, 'Spider Eye', { tint: '#8a3a32' });
def(ENDER_PEARL, 'Ender Pearl', { tint: '#1d7a6e', stack: 16 });
def(BLAZE_ROD, 'Blaze Rod', { tint: '#e0a022' });
def(SLIME_BALL, 'Slimeball', { tint: '#7fbf5f' });
def(LEATHER, 'Leather', { tint: '#9c6f42' });
def(FEATHER, 'Feather', { tint: '#e8e8e8' });
def(RAW_PORKCHOP, 'Raw Porkchop', { tint: '#e08a8a' });
def(RAW_BEEF, 'Raw Beef', { tint: '#b33a3a' });
def(WOOL, 'Wool', { tint: '#e4e4e4' });
def(GHAST_TEAR, 'Ghast Tear', { tint: '#d6ece8' });
def(PHANTOM_MEMBRANE, 'Phantom Membrane', { tint: '#6a5e7a' });
def(SHULKER_SHELL, 'Shulker Shell', { tint: '#9a6a9a' });
def(ECHO_SHARD, 'Echo Shard', { tint: '#1f9a9a' });
def(SNOWBALL, 'Snowball', { tint: '#e8f2fb', stack: 16 });

def(STICK, 'Stick', { tint: '#9c7440', icon: 'stick' });
def(COAL, 'Coal', { tint: '#26262c', icon: 'nugget' });
def(IRON_INGOT, 'Iron Ingot', { tint: '#d8d8de', icon: 'ingot' });
def(GOLD_INGOT, 'Gold Ingot', { tint: '#f0cf52', icon: 'ingot' });
def(COPPER_INGOT, 'Copper Ingot', { tint: '#d98149', icon: 'ingot' });
def(DIAMOND, 'Diamond', { tint: '#5fe3dc', icon: 'gem' });
def(EMERALD, 'Emerald', { tint: '#36cd47', icon: 'gem' });
def(LAPIS, 'Lapis Lazuli', { tint: '#2a51b8', icon: 'nugget' });
def(REDSTONE, 'Redstone', { tint: '#d33b32', icon: 'nugget' });
def(QUARTZ, 'Nether Quartz', { tint: '#e8e2dc', icon: 'gem' });
def(NETHERITE_INGOT, 'Netherite Ingot', { tint: '#5a4f52', icon: 'ingot' });

export const ITEMS = R;

export function isItem(id) {
  return id >= ITEM_BASE;
}

export function item(id) {
  return R[id] ?? null;
}

/** Display name for either a block id or an item id. */
export function nameOf(id) {
  return isItem(id) ? (R[id]?.name ?? 'Unknown') : block(id).name;
}

/** How many of `id` fit in one slot. */
export function stackSize(id) {
  return isItem(id) ? (R[id]?.stack ?? 64) : 64;
}

export const SWORDS = Object.values(R).filter((i) => i.kind === 'sword').map((i) => i.id);
export const POTIONS = Object.values(R).filter((i) => i.kind === 'potion').map((i) => i.id);
export const ALL_ITEMS = Object.values(R).map((i) => i.id);
