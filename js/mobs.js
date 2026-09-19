import * as I from './items.js';

// Mob registry.
//
//   behavior  passive  wanders, flees when hit
//             neutral  wanders, fights back once provoked
//             hostile  hunts the player on sight
//   where     'surface' | 'underground' | 'any' -- stands in for a light level,
//             since there's no day/night cycle yet
//   biomes    which biome ids it may spawn in; hostiles also need `where`
//   shape     how renderer.js draws it
//   ranged    fires a projectile instead of closing to melee

const drop = (id, min, max = min, chance = 1) => ({ id, min, max, chance });

function mob(id, def) {
  return [id, { id, weight: 1, speed: 3, jump: 8.5, ...def }];
}

export const MOBS = Object.fromEntries([
  // ---------------------------------------------------------- overworld: passive
  mob('pig', {
    name: 'Pig', behavior: 'passive', health: 10, size: [0.9, 0.85], shape: 'quadruped',
    where: 'surface', biomes: ['plains', 'meadow', 'forest', 'savanna', 'birch_forest'],
    palette: { body: '#e89a9a', head: '#e28f8f', legs: '#c97878', accent: '#f0b5b5' },
    drops: [drop(I.RAW_PORKCHOP, 1, 2)], speed: 2.2, weight: 3,
  }),
  mob('cow', {
    name: 'Cow', behavior: 'passive', health: 10, size: [1.0, 1.1], shape: 'quadruped',
    where: 'surface', biomes: ['plains', 'meadow', 'forest', 'birch_forest'],
    palette: { body: '#4a3a2a', head: '#3a2c20', legs: '#33261b', accent: '#e8e4dc' },
    drops: [drop(I.RAW_BEEF, 1, 2), drop(I.LEATHER, 0, 2)], speed: 2.0, weight: 3,
  }),
  mob('sheep', {
    name: 'Sheep', behavior: 'passive', health: 8, size: [0.95, 1.0], shape: 'quadruped',
    where: 'surface', biomes: ['plains', 'meadow', 'forest', 'taiga', 'birch_forest'],
    palette: { body: '#e8e4dc', head: '#d8c8b8', legs: '#b0a494', accent: '#f4f2ee' },
    drops: [drop(I.WOOL, 1, 1)], speed: 2.0, weight: 3,
  }),
  mob('chicken', {
    name: 'Chicken', behavior: 'passive', health: 4, size: [0.5, 0.65], shape: 'bird',
    where: 'surface', biomes: ['plains', 'meadow', 'forest', 'swamp', 'jungle'],
    palette: { body: '#f0ece4', head: '#f0ece4', legs: '#e8a63a', accent: '#d8443a' },
    drops: [drop(I.FEATHER, 0, 2)], speed: 2.0, weight: 2, fallImmune: true,
  }),
  mob('rabbit', {
    name: 'Rabbit', behavior: 'passive', health: 3, size: [0.45, 0.5], shape: 'quadruped',
    where: 'surface', biomes: ['desert', 'meadow', 'taiga', 'snowy_plains', 'snowy_taiga', 'grove'],
    palette: { body: '#b09a7a', head: '#a89272', legs: '#8e7a5e', accent: '#e8e0d0' },
    drops: [drop(I.LEATHER, 0, 1)], speed: 3.6, jump: 10, weight: 2,
  }),
  mob('horse', {
    name: 'Horse', behavior: 'passive', health: 15, size: [1.3, 1.5], shape: 'quadruped',
    where: 'surface', biomes: ['plains', 'savanna', 'meadow'],
    palette: { body: '#8a6a44', head: '#7a5c3a', legs: '#5e4630', accent: '#3a2c1e' },
    drops: [drop(I.LEATHER, 0, 2)], speed: 4.5, jump: 11, weight: 1,
  }),
  mob('llama', {
    name: 'Llama', behavior: 'neutral', health: 15, size: [0.9, 1.5], shape: 'quadruped',
    where: 'surface', biomes: ['savanna', 'mesa'], damage: 2,
    palette: { body: '#c4b090', head: '#b8a484', legs: '#9c8a6e', accent: '#e0d4bc' },
    drops: [drop(I.LEATHER, 0, 2)], speed: 2.6, weight: 2,
  }),
  mob('fox', {
    name: 'Fox', behavior: 'passive', health: 10, size: [0.8, 0.6], shape: 'quadruped',
    where: 'surface', biomes: ['taiga', 'forest', 'snowy_taiga', 'grove'],
    palette: { body: '#d2702a', head: '#e08838', legs: '#3a2c20', accent: '#f0e0cc' },
    drops: [drop(I.LEATHER, 0, 1)], speed: 4.0, weight: 2,
  }),
  mob('parrot', {
    name: 'Parrot', behavior: 'passive', health: 6, size: [0.5, 0.7], shape: 'bird',
    where: 'surface', biomes: ['jungle'], flying: true,
    palette: { body: '#d83a3a', head: '#e8c43a', legs: '#4a4a4a', accent: '#3a7ad8' },
    drops: [drop(I.FEATHER, 1, 2)], speed: 3.4, weight: 2,
  }),
  mob('panda', {
    name: 'Panda', behavior: 'neutral', health: 20, size: [1.2, 1.2], shape: 'quadruped',
    where: 'surface', biomes: ['jungle'], damage: 4,
    palette: { body: '#eeeae2', head: '#f2efe8', legs: '#25232a', accent: '#25232a' },
    drops: [], speed: 2.0, weight: 1,
  }),
  mob('goat', {
    name: 'Goat', behavior: 'neutral', health: 10, size: [0.8, 1.2], shape: 'quadruped',
    where: 'surface', biomes: ['meadow', 'mesa', 'snowy_slopes', 'frozen_peaks', 'jagged_peaks'], damage: 3,
    palette: { body: '#d8d2c4', head: '#c8c0b0', legs: '#8e8678', accent: '#6a6258' },
    drops: [], speed: 3.0, jump: 13, weight: 2,
  }),
  mob('turtle', {
    name: 'Turtle', behavior: 'passive', health: 30, size: [1.0, 0.6], shape: 'quadruped',
    where: 'surface', biomes: ['ocean', 'lake'],
    palette: { body: '#4a8a5a', head: '#7ab88a', legs: '#5a9a6a', accent: '#d8d0a8' },
    drops: [], speed: 1.2, weight: 2,
  }),
  mob('frog', {
    name: 'Frog', behavior: 'passive', health: 10, size: [0.55, 0.5], shape: 'quadruped',
    where: 'surface', biomes: ['swamp'],
    palette: { body: '#8aa83a', head: '#9ab84a', legs: '#6a8a2a', accent: '#e8a83a' },
    drops: [drop(I.SLIME_BALL, 0, 1)], speed: 2.4, jump: 12, weight: 3,
  }),
  mob('squid', {
    name: 'Squid', behavior: 'passive', health: 10, size: [0.8, 0.8], shape: 'squid',
    where: 'surface', biomes: ['ocean', 'lake'], aquatic: true,
    palette: { body: '#2a3a6a', head: '#34467e', legs: '#223058', accent: '#5a6a9a' },
    drops: [], speed: 2.0, weight: 3,
  }),
  mob('glow_squid', {
    name: 'Glow Squid', behavior: 'passive', health: 10, size: [0.8, 0.8], shape: 'squid',
    where: 'underground', biomes: ['lush_caves'], aquatic: true, glow: 0.6,
    palette: { body: '#16495a', head: '#1d6a7e', legs: '#123a48', accent: '#7fe8e0' },
    drops: [], speed: 1.8, weight: 3,
  }),
  mob('axolotl', {
    name: 'Axolotl', behavior: 'passive', health: 14, size: [0.6, 0.5], shape: 'squid',
    where: 'underground', biomes: ['lush_caves'], aquatic: true,
    palette: { body: '#f2b4d4', head: '#f8c6e0', legs: '#e096bc', accent: '#c46a9a' },
    drops: [], speed: 2.4, weight: 2,
  }),
  mob('bat', {
    name: 'Bat', behavior: 'passive', health: 6, size: [0.5, 0.5], shape: 'bat',
    where: 'underground', biomes: ['caves', 'lush_caves'], flying: true,
    palette: { body: '#4a3a2e', head: '#5a4638', legs: '#2e241c', accent: '#7a6252' },
    drops: [], speed: 3.2, weight: 3,
  }),
  mob('bee', {
    name: 'Bee', behavior: 'neutral', health: 10, size: [0.5, 0.5], shape: 'bat',
    where: 'surface', biomes: ['meadow', 'plains', 'forest'], flying: true, damage: 2,
    palette: { body: '#e8b830', head: '#3a3028', legs: '#3a3028', accent: '#f0e0c0' },
    drops: [], speed: 3.0, weight: 2,
  }),


  // ---------------------------------------------------------- overworld: snowy
  mob('polar_bear', {
    name: 'Polar Bear', behavior: 'neutral', health: 30, size: [1.3, 1.2], shape: 'quadruped',
    where: 'surface', biomes: ['snowy_plains', 'ice_spikes', 'frozen_ocean', 'snowy_beach'],
    damage: 6,
    palette: { body: '#f0f2f4', head: '#f6f8fa', legs: '#d8dce2', accent: '#2a2a30' },
    drops: [drop(I.LEATHER, 0, 2)], speed: 3.4, weight: 2,
  }),
  mob('stray', {
    name: 'Stray', behavior: 'hostile', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['snowy_plains', 'ice_spikes', 'snowy_taiga', 'snowy_slopes', 'frozen_peaks'],
    damage: 3,
    ranged: { kind: 'arrow', range: 16, cooldown: 1.6, speed: 26, damage: 4 },
    palette: { body: '#c2cfd4', head: '#d4e0e4', legs: '#9fb0b6', accent: '#5a7a84' },
    drops: [drop(I.BONE, 0, 2), drop(I.ARROW, 0, 2)], speed: 2.8, weight: 4,
  }),
  mob('snow_golem', {
    name: 'Snow Golem', behavior: 'passive', health: 4, size: [0.8, 1.9], shape: 'blob',
    where: 'surface', biomes: ['snowy_plains', 'grove', 'snowy_taiga'],
    palette: { body: '#f4f8fc', head: '#ffffff', legs: '#dce6ee', accent: '#e08838' },
    drops: [drop(I.SNOWBALL, 1, 3)], speed: 2.2, weight: 1,
  }),

  // ---------------------------------------------------------- overworld: neutral
  mob('wolf', {
    name: 'Wolf', behavior: 'neutral', health: 8, size: [0.8, 0.8], shape: 'quadruped',
    where: 'surface', biomes: ['taiga', 'forest', 'dark_forest', 'snowy_taiga', 'grove'], damage: 4,
    palette: { body: '#ccc8bc', head: '#dad6ca', legs: '#a8a498', accent: '#3a3630' },
    drops: [], speed: 5.0, weight: 2,
  }),
  mob('dolphin', {
    name: 'Dolphin', behavior: 'neutral', health: 10, size: [1.2, 0.6], shape: 'squid',
    where: 'surface', biomes: ['ocean'], aquatic: true, damage: 3,
    palette: { body: '#5a7a9a', head: '#6a8aaa', legs: '#4a6a88', accent: '#e8eef2' },
    drops: [], speed: 5.0, weight: 2,
  }),
  mob('enderman', {
    name: 'Enderman', behavior: 'neutral', health: 40, size: [0.7, 2.6], shape: 'tall',
    where: 'any', biomes: ['forest', 'dark_forest', 'plains', 'caves', 'deep_dark',
      'warped_forest', 'end_main', 'end_outer'], damage: 7,
    palette: { body: '#12121a', head: '#0d0d14', legs: '#12121a', accent: '#c26af0' },
    drops: [drop(I.ENDER_PEARL, 0, 1)], speed: 5.5, jump: 10, weight: 1, glow: 0.2,
  }),
  mob('spider', {
    name: 'Spider', behavior: 'neutral', health: 16, size: [1.1, 0.7], shape: 'spider',
    where: 'underground', biomes: ['caves', 'dark_forest', 'lush_caves'], damage: 3,
    palette: { body: '#2e2320', head: '#3a2c28', legs: '#241c1a', accent: '#d8322a' },
    drops: [drop(I.STRING, 0, 2), drop(I.SPIDER_EYE, 0, 1)], speed: 4.2, jump: 9, weight: 3,
  }),

  // ---------------------------------------------------------- overworld: hostile
  mob('zombie', {
    name: 'Zombie', behavior: 'hostile', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'underground', biomes: ['caves', 'dark_forest', 'forest', 'plains', 'swamp'],
    damage: 4,
    palette: { body: '#3a6a4a', head: '#4a7a3a', legs: '#3a4a7a', accent: '#2a3a2a' },
    drops: [drop(I.ROTTEN_FLESH, 0, 2)], speed: 2.6, weight: 4,
  }),
  mob('husk', {
    name: 'Husk', behavior: 'hostile', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['desert', 'mesa'], damage: 5, sunProof: true,
    palette: { body: '#a8996e', head: '#b8a87e', legs: '#8a7c5a', accent: '#6a5e46' },
    drops: [drop(I.ROTTEN_FLESH, 0, 2)], speed: 2.6, weight: 3,
  }),
  mob('drowned', {
    name: 'Drowned', behavior: 'hostile', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['ocean', 'lake'], aquatic: true, damage: 4, sunProof: true,
    palette: { body: '#2e6a6a', head: '#3a7a74', legs: '#2a4a5a', accent: '#8ad8c8' },
    drops: [drop(I.ROTTEN_FLESH, 0, 2)], speed: 2.4, weight: 3,
  }),
  mob('skeleton', {
    name: 'Skeleton', behavior: 'hostile', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'underground', biomes: ['caves', 'dark_forest', 'deep_dark'], damage: 3,
    ranged: { kind: 'arrow', range: 16, cooldown: 1.6, speed: 26, damage: 4 },
    palette: { body: '#d8d4c8', head: '#e2ded2', legs: '#c0bcb0', accent: '#6a6a6a' },
    drops: [drop(I.BONE, 0, 2), drop(I.ARROW, 0, 2)], speed: 2.8, weight: 4,
  }),
  mob('creeper', {
    name: 'Creeper', behavior: 'hostile', health: 20, size: [0.7, 1.7], shape: 'creeper',
    where: 'any', biomes: ['caves', 'forest', 'plains', 'dark_forest', 'taiga', 'meadow'],
    damage: 9, explodes: true,
    palette: { body: '#4fa04a', head: '#5ab055', legs: '#3d7f3a', accent: '#18240f' },
    drops: [drop(I.GUNPOWDER, 0, 2)], speed: 2.8, weight: 3,
  }),
  mob('cave_spider', {
    name: 'Cave Spider', behavior: 'hostile', health: 12, size: [0.8, 0.5], shape: 'spider',
    where: 'underground', biomes: ['caves', 'deep_dark'], damage: 3,
    palette: { body: '#12363a', head: '#1a464a', legs: '#0d2a2e', accent: '#d8322a' },
    drops: [drop(I.STRING, 0, 2)], speed: 5.0, jump: 9, weight: 3,
  }),
  mob('slime', {
    name: 'Slime', behavior: 'hostile', health: 16, size: [1.0, 1.0], shape: 'blob',
    where: 'underground', biomes: ['caves', 'swamp'], damage: 3,
    palette: { body: '#6fbf5f', head: '#7fcf6f', legs: '#5aa84a', accent: '#3a7a2a' },
    drops: [drop(I.SLIME_BALL, 0, 2)], speed: 2.0, jump: 10, weight: 3,
  }),
  mob('witch', {
    name: 'Witch', behavior: 'hostile', health: 26, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['swamp'], damage: 3,
    ranged: { kind: 'potion', range: 13, cooldown: 2.6, speed: 15, damage: 6 },
    palette: { body: '#5a3a7a', head: '#9a8a6a', legs: '#3a2a4a', accent: '#2a1a2a' },
    drops: [drop(I.SPIDER_EYE, 0, 1), drop(I.GUNPOWDER, 0, 1)], speed: 2.6, weight: 2,
  }),
  mob('silverfish', {
    name: 'Silverfish', behavior: 'hostile', health: 8, size: [0.5, 0.35], shape: 'spider',
    where: 'underground', biomes: ['caves', 'deep_dark'], damage: 1,
    palette: { body: '#8a8a94', head: '#9a9aa4', legs: '#6a6a74', accent: '#4a4a54' },
    drops: [], speed: 4.0, weight: 2,
  }),
  mob('warden', {
    name: 'Warden', behavior: 'hostile', health: 120, size: [1.2, 2.9], shape: 'tall',
    where: 'underground', biomes: ['deep_dark'], damage: 16,
    palette: { body: '#123840', head: '#0d2a30', legs: '#0d2a30', accent: '#3ad8c8' },
    drops: [drop(I.ECHO_SHARD, 1, 1)], speed: 3.4, weight: 1, glow: 0.5,
  }),
  mob('phantom', {
    name: 'Phantom', behavior: 'hostile', health: 20, size: [1.3, 0.6], shape: 'bat',
    where: 'surface', biomes: ['ocean', 'desert', 'mesa', 'plains'], flying: true, damage: 4,
    palette: { body: '#3a4a6a', head: '#44567e', legs: '#2a3a52', accent: '#7fe8e0' },
    drops: [drop(I.PHANTOM_MEMBRANE, 0, 1)], speed: 5.0, weight: 1,
  }),

  // ---------------------------------------------------------- nether
  mob('strider', {
    name: 'Strider', behavior: 'passive', health: 20, size: [0.9, 1.3], shape: 'quadruped',
    where: 'any', biomes: ['lava_ocean', 'lava_ring'], lavaProof: true, floatsOnLava: true,
    palette: { body: '#8a2a3a', head: '#9a3a4a', legs: '#d8603a', accent: '#e88a4a' },
    drops: [drop(I.STRING, 0, 1)], speed: 2.0, weight: 3, glow: 0.25,
  }),
  mob('zombified_piglin', {
    name: 'Zombified Piglin', behavior: 'neutral', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['nether_wastes', 'lava_ring'], lavaProof: true, damage: 5,
    palette: { body: '#3a7a5a', head: '#7aa07a', legs: '#2a5a4a', accent: '#e8c43a' },
    drops: [drop(I.ROTTEN_FLESH, 0, 1)], speed: 2.8, weight: 4,
  }),
  mob('piglin', {
    name: 'Piglin', behavior: 'neutral', health: 16, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['nether_wastes', 'crimson_forest'], lavaProof: true, damage: 5,
    palette: { body: '#e0a08a', head: '#e8ae98', legs: '#8a6a4a', accent: '#e8c43a' },
    drops: [drop(I.LEATHER, 0, 1)], speed: 3.2, weight: 3,
  }),
  mob('hoglin', {
    name: 'Hoglin', behavior: 'hostile', health: 40, size: [1.3, 1.3], shape: 'quadruped',
    where: 'any', biomes: ['crimson_forest'], lavaProof: true, damage: 7,
    palette: { body: '#9a5a4a', head: '#aa6a5a', legs: '#6a3a2a', accent: '#3a2a22' },
    drops: [drop(I.LEATHER, 0, 2)], speed: 3.4, weight: 2,
  }),
  mob('wither_skeleton', {
    name: 'Wither Skeleton', behavior: 'hostile', health: 20, size: [0.7, 2.2], shape: 'biped',
    where: 'any', biomes: ['nether_wastes', 'soul_sand_valley'], lavaProof: true, damage: 8,
    palette: { body: '#2a2a2a', head: '#333333', legs: '#1e1e1e', accent: '#5a5a5a' },
    drops: [drop(I.BONE, 0, 2)], speed: 3.0, weight: 3,
  }),
  mob('blaze', {
    name: 'Blaze', behavior: 'hostile', health: 20, size: [0.7, 1.6], shape: 'blaze',
    where: 'any', biomes: ['nether_wastes', 'lava_ring', 'soul_sand_valley'],
    lavaProof: true, flying: true, damage: 5, glow: 0.9,
    ranged: { kind: 'fireball', range: 14, cooldown: 1.8, speed: 18, damage: 5 },
    palette: { body: '#e8c43a', head: '#f0d45a', legs: '#c08a1a', accent: '#f8f0a0' },
    drops: [drop(I.BLAZE_ROD, 0, 1)], speed: 2.6, weight: 3,
  }),
  mob('ghast', {
    name: 'Ghast', behavior: 'hostile', health: 10, size: [2.4, 2.4], shape: 'ghast',
    where: 'any', biomes: ['lava_ocean', 'nether_wastes', 'soul_sand_valley'], lavaProof: true, flying: true,
    damage: 6, glow: 0.3,
    ranged: { kind: 'fireball', range: 26, cooldown: 3.2, speed: 13, damage: 9 },
    palette: { body: '#e8e4dc', head: '#f0ece4', legs: '#c8c4bc', accent: '#3a3a3a' },
    drops: [drop(I.GHAST_TEAR, 0, 1)], speed: 2.4, weight: 1,
  }),
  mob('magma_cube', {
    name: 'Magma Cube', behavior: 'hostile', health: 16, size: [1.0, 1.0], shape: 'blob',
    where: 'any', biomes: ['lava_ring', 'nether_wastes'], lavaProof: true, damage: 5,
    glow: 0.55,
    palette: { body: '#2a1a1a', head: '#e2611c', legs: '#8e3a1c', accent: '#f0a83a' },
    drops: [drop(I.SLIME_BALL, 0, 1)], speed: 2.2, jump: 11, weight: 3,
  }),

  // ---------------------------------------------------------- the end
  mob('endermite', {
    name: 'Endermite', behavior: 'hostile', health: 8, size: [0.45, 0.35], shape: 'spider',
    where: 'any', biomes: ['end_main', 'end_outer'], damage: 2,
    palette: { body: '#221a2e', head: '#2e2440', legs: '#181222', accent: '#c26af0' },
    drops: [], speed: 4.0, weight: 3, glow: 0.2,
  }),
  mob('shulker', {
    name: 'Shulker', behavior: 'hostile', health: 30, size: [0.9, 0.9], shape: 'blob',
    where: 'any', biomes: ['end_main'], damage: 4,
    ranged: { kind: 'fireball', range: 15, cooldown: 2.4, speed: 9, damage: 4 },
    palette: { body: '#8a6a9a', head: '#9a7aaa', legs: '#6a4a7a', accent: '#d8c8e8' },
    drops: [drop(I.SHULKER_SHELL, 0, 1)], speed: 0, jump: 0, weight: 2,
  }),
  mob('ender_dragon', {
    name: 'Ender Dragon', behavior: 'hostile', health: 200, size: [3.5, 2.0], shape: 'dragon',
    where: 'any', biomes: ['end_main'], flying: true, damage: 12, boss: true,
    palette: { body: '#161020', head: '#1e1630', legs: '#100c18', accent: '#c26af0' },
    drops: [], speed: 6.0, weight: 0.2, glow: 0.35,
  }),
]);

/**
 * Mobs eligible for a biome. `allowed` is the set of `where` values that fit
 * the spawn point -- a dark surface at night accepts the same mobs a cave
 * does, which is what makes nightfall feel different from noon.
 */
export function candidatesFor(biomeId, allowed) {
  const ok = Array.isArray(allowed) ? allowed : [allowed];
  return Object.values(MOBS).filter((m) =>
    m.biomes.includes(biomeId) && (m.where === 'any' || ok.includes(m.where)));
}

export const MOB_IDS = Object.keys(MOBS);
