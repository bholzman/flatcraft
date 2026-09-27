import * as I from './items.js';
import * as B from './blocks.js';

// Mob registry.
//
//   behavior  passive  wanders, flees when hit
//             neutral  wanders, fights back once provoked
//             hostile  hunts the player on sight
//             guard    never turns on the player; fights what it `preys` on
//   where     'surface' | 'underground' | 'any' -- which light a spawn point
//             needs (a dark surface at night counts as underground)
//   biomes    which biome ids it may spawn in naturally; [] means it only
//             comes from structures, summoning or building
//   shape     how renderer.js draws it
//   ranged    fires a projectile instead of closing to melee
//
// Who fights whom:
//   tags      what other mobs see it as; hostiles default to ['monster']
//   team      mobs on one team never hurt each other with stray shots
//   preys     ids or tags it attacks on sight (the player is separate)
//   fears     ids or tags it runs from on sight
//
// Standard behaviors, each opt-in:
//   onHit          { effect, value, duration } | { launch } | { knockback }
//   fuse           creeper: { time, trigger, cancel, power }
//   teleports      enderman: blinks around, dodges projectiles
//   stareProvoked  enderman: the cursor resting on it counts as a stare
//   burnsInDay     catches fire under open sky in daylight
//   hostileInDark  neutral in daylight, hostile at night and underground
//   climbs         walks up walls instead of jumping
//   hops           only moves in hops
//   splits         breaks into smaller copies of itself on death
//   groupAnger     hitting one angers every one of its kind nearby
//   stingsOnce     dies a little while after its first sting
//   drinksPotions  heals itself when hurt
//   senses         'vibration': hears movement through walls instead of seeing
//   swoops         dives at its target from above
//   tameWith       item that tames it (wolves: bones)
//   barters        piglins: trade gold for nether goods
//   hatesUngilded  piglins: hostile unless the player is holding gold
//   trades         villagers: open a trading panel
//   caster         evoker: summons vexes and fangs instead of fighting
//   noclip         flies through blocks
//   lifespan       [min, max] seconds before it expires
//   snowTrail      leaves snow where it walks
//   meltsIn        biome ids that hurt it
//   knockbackResist 0..1 of every shove ignored

const drop = (id, min, max = min, chance = 1) => ({ id, min, max, chance });

function mob(id, def) {
  const tags = def.tags ?? (def.behavior === 'hostile' ? ['monster'] : []);
  const team = def.team ?? (tags.includes('monster') || tags.includes('creeper') ? 'monster' : undefined);
  return [id, { id, weight: 1, speed: 3, jump: 8.5, ...def, tags, team }];
}

const UNDEAD = ['undead', 'monster'];
const ILLAGER = { tags: ['illager'], team: 'illager', preys: ['villager', 'golem'] };

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
    drops: [drop(I.LEATHER, 0, 1)], speed: 3.6, jump: 10, weight: 2, hops: true, fears: ['wolf', 'fox'],
  }),
  mob('horse', {
    name: 'Horse', behavior: 'passive', health: 15, size: [1.3, 1.5], shape: 'quadruped',
    where: 'surface', biomes: ['plains', 'savanna', 'meadow'],
    palette: { body: '#8a6a44', head: '#7a5c3a', legs: '#5e4630', accent: '#3a2c1e' },
    drops: [drop(I.LEATHER, 0, 2)], speed: 4.5, jump: 11, weight: 1,
  }),
  mob('llama', {
    name: 'Llama', behavior: 'neutral', health: 15, size: [0.9, 1.5], shape: 'quadruped',
    where: 'surface', biomes: ['savanna', 'mesa'], damage: 1, groupAnger: true,
    ranged: { kind: 'spit', range: 10, cooldown: 2, speed: 18, damage: 1 },
    palette: { body: '#c4b090', head: '#b8a484', legs: '#9c8a6e', accent: '#e0d4bc' },
    drops: [drop(I.LEATHER, 0, 2)], speed: 2.6, weight: 2,
  }),
  mob('fox', {
    name: 'Fox', behavior: 'passive', health: 10, size: [0.8, 0.6], shape: 'quadruped',
    where: 'surface', biomes: ['taiga', 'forest', 'snowy_taiga', 'grove'], damage: 2,
    preys: ['chicken', 'rabbit'],
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
    onHit: { knockback: 15 },          // the ram
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
    where: 'surface', biomes: ['swamp'], hops: true,
    palette: { body: '#8aa83a', head: '#9ab84a', legs: '#6a8a2a', accent: '#e8a83a' },
    drops: [drop(I.SLIME_BALL, 0, 1)], speed: 2.4, jump: 12, weight: 3,
  }),
  mob('squid', {
    name: 'Squid', behavior: 'passive', health: 10, size: [0.8, 0.8], shape: 'squid',
    where: 'surface', biomes: ['ocean', 'lake'], aquatic: true, inks: '#10121c',
    palette: { body: '#2a3a6a', head: '#34467e', legs: '#223058', accent: '#5a6a9a' },
    drops: [], speed: 2.0, weight: 3,
  }),
  mob('glow_squid', {
    name: 'Glow Squid', behavior: 'passive', health: 10, size: [0.8, 0.8], shape: 'squid',
    where: 'underground', biomes: ['lush_caves'], aquatic: true, glow: 0.6, inks: '#1f8a8a',
    palette: { body: '#16495a', head: '#1d6a7e', legs: '#123a48', accent: '#7fe8e0' },
    drops: [], speed: 1.8, weight: 3,
  }),
  mob('axolotl', {
    name: 'Axolotl', behavior: 'passive', health: 14, size: [0.6, 0.5], shape: 'squid',
    where: 'underground', biomes: ['lush_caves'], aquatic: true, damage: 2,
    preys: ['drowned', 'squid', 'glow_squid'],
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
    onHit: { effect: 'poison', value: 1, duration: 10 }, stingsOnce: true, groupAnger: true,
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
    damage: 3, tags: UNDEAD, burnsInDay: true, fears: ['wolf'],
    ranged: { kind: 'arrow', range: 16, cooldown: 1.6, speed: 26, damage: 4,
      effect: { name: 'slowness', value: 0.6, duration: 6 } },
    palette: { body: '#c2cfd4', head: '#d4e0e4', legs: '#9fb0b6', accent: '#5a7a84' },
    drops: [drop(I.BONE, 0, 2), drop(I.ARROW, 0, 2)], speed: 2.8, weight: 4,
  }),
  mob('snow_golem', {
    name: 'Snow Golem', behavior: 'guard', health: 4, size: [0.8, 1.9], shape: 'snowman',
    where: 'surface', biomes: [], tags: ['golem'], team: 'village', preys: ['monster', 'illager'],
    ranged: { kind: 'snowball', range: 10, cooldown: 1.0, speed: 18, damage: 0, vs: { blaze: 3 } },
    snowTrail: true, meltsIn: ['desert', 'savanna', 'mesa', 'badlands', 'jungle'],
    palette: { body: '#f4f8fc', head: '#e08838', legs: '#dce6ee', accent: '#6b4c2b' },
    drops: [drop(I.SNOWBALL, 1, 3)], speed: 2.2, weight: 1,
  }),

  // ---------------------------------------------------------- overworld: neutral
  mob('wolf', {
    name: 'Wolf', behavior: 'neutral', health: 8, size: [0.8, 0.8], shape: 'quadruped',
    where: 'surface', biomes: ['taiga', 'forest', 'dark_forest', 'snowy_taiga', 'grove'], damage: 4,
    preys: ['sheep', 'rabbit', 'fox', 'skeleton', 'stray'], groupAnger: true, tameWith: I.BONE,
    palette: { body: '#ccc8bc', head: '#dad6ca', legs: '#a8a498', accent: '#3a3630' },
    drops: [], speed: 5.0, weight: 2,
  }),
  mob('dolphin', {
    name: 'Dolphin', behavior: 'neutral', health: 10, size: [1.2, 0.6], shape: 'squid',
    where: 'surface', biomes: ['ocean'], aquatic: true, damage: 3, grace: true,
    palette: { body: '#5a7a9a', head: '#6a8aaa', legs: '#4a6a88', accent: '#e8eef2' },
    drops: [], speed: 5.0, weight: 2,
  }),
  mob('enderman', {
    name: 'Enderman', behavior: 'neutral', health: 40, size: [0.7, 2.6], shape: 'tall',
    where: 'any', biomes: ['forest', 'dark_forest', 'plains', 'caves', 'deep_dark',
      'warped_forest', 'end_main', 'end_outer'], damage: 7,
    teleports: true, stareProvoked: true,
    palette: { body: '#12121a', head: '#0d0d14', legs: '#12121a', accent: '#c26af0' },
    drops: [drop(I.ENDER_PEARL, 0, 1)], speed: 5.5, jump: 10, weight: 1, glow: 0.2,
  }),
  mob('spider', {
    name: 'Spider', behavior: 'neutral', health: 16, size: [1.1, 0.7], shape: 'spider',
    where: 'underground', biomes: ['caves', 'dark_forest', 'lush_caves'], damage: 3,
    tags: ['monster'], hostileInDark: true, climbs: true,
    palette: { body: '#2e2320', head: '#3a2c28', legs: '#241c1a', accent: '#d8322a' },
    drops: [drop(I.STRING, 0, 2), drop(I.SPIDER_EYE, 0, 1)], speed: 4.2, jump: 9, weight: 3,
  }),

  // ---------------------------------------------------------- overworld: hostile
  mob('zombie', {
    name: 'Zombie', behavior: 'hostile', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'underground', biomes: ['caves', 'dark_forest', 'forest', 'plains', 'swamp'],
    damage: 4, tags: UNDEAD, burnsInDay: true, preys: ['villager'],
    palette: { body: '#3a6a4a', head: '#4a7a3a', legs: '#3a4a7a', accent: '#2a3a2a' },
    drops: [drop(I.ROTTEN_FLESH, 0, 2)], speed: 2.6, weight: 4,
  }),
  mob('husk', {
    name: 'Husk', behavior: 'hostile', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['desert', 'mesa'], damage: 5, sunProof: true, tags: UNDEAD,
    preys: ['villager'],
    palette: { body: '#a8996e', head: '#b8a87e', legs: '#8a7c5a', accent: '#6a5e46' },
    drops: [drop(I.ROTTEN_FLESH, 0, 2)], speed: 2.6, weight: 3,
  }),
  mob('drowned', {
    name: 'Drowned', behavior: 'hostile', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['ocean', 'lake'], aquatic: true, damage: 4, sunProof: true, tags: UNDEAD,
    preys: ['villager'],
    palette: { body: '#2e6a6a', head: '#3a7a74', legs: '#2a4a5a', accent: '#8ad8c8' },
    drops: [drop(I.ROTTEN_FLESH, 0, 2)], speed: 2.4, weight: 3,
  }),
  mob('skeleton', {
    name: 'Skeleton', behavior: 'hostile', health: 20, size: [0.7, 1.9], shape: 'biped',
    where: 'underground', biomes: ['caves', 'dark_forest', 'deep_dark'], damage: 3,
    tags: UNDEAD, burnsInDay: true, fears: ['wolf'],
    ranged: { kind: 'arrow', range: 16, cooldown: 1.6, speed: 26, damage: 4 },
    palette: { body: '#d8d4c8', head: '#e2ded2', legs: '#c0bcb0', accent: '#6a6a6a' },
    drops: [drop(I.BONE, 0, 2), drop(I.ARROW, 0, 2)], speed: 2.8, weight: 4,
  }),
  mob('creeper', {
    name: 'Creeper', behavior: 'hostile', health: 20, size: [0.7, 1.7], shape: 'creeper',
    where: 'any', biomes: ['caves', 'forest', 'plains', 'dark_forest', 'taiga', 'meadow'],
    tags: ['creeper'], fuse: { time: 1.5, trigger: 2.6, cancel: 6.5, power: 3 },
    palette: { body: '#4fa04a', head: '#5ab055', legs: '#3d7f3a', accent: '#18240f' },
    drops: [drop(I.GUNPOWDER, 0, 2)], speed: 2.8, weight: 3,
  }),
  mob('cave_spider', {
    name: 'Cave Spider', behavior: 'hostile', health: 12, size: [0.8, 0.5], shape: 'spider',
    where: 'underground', biomes: ['caves', 'deep_dark'], damage: 2, climbs: true,
    onHit: { effect: 'poison', value: 1, duration: 7 },
    palette: { body: '#12363a', head: '#1a464a', legs: '#0d2a2e', accent: '#d8322a' },
    drops: [drop(I.STRING, 0, 2)], speed: 5.0, jump: 9, weight: 3,
  }),
  mob('slime', {
    name: 'Slime', behavior: 'hostile', health: 16, size: [1.0, 1.0], shape: 'blob',
    where: 'underground', biomes: ['caves', 'swamp'], damage: 4, hops: true, splits: true,
    palette: { body: '#6fbf5f', head: '#7fcf6f', legs: '#5aa84a', accent: '#3a7a2a' },
    drops: [drop(I.SLIME_BALL, 0, 2)], speed: 2.4, jump: 10, weight: 3,
  }),
  mob('witch', {
    name: 'Witch', behavior: 'hostile', health: 26, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['swamp'], damage: 3, drinksPotions: true,
    ranged: { kind: 'potion', range: 13, cooldown: 2.6, speed: 15, damage: 6 },
    palette: { body: '#5a3a7a', head: '#9a8a6a', legs: '#3a2a4a', accent: '#2a1a2a' },
    drops: [drop(I.SPIDER_EYE, 0, 1), drop(I.GUNPOWDER, 0, 1)], speed: 2.6, weight: 2,
  }),
  mob('silverfish', {
    name: 'Silverfish', behavior: 'hostile', health: 8, size: [0.5, 0.35], shape: 'spider',
    where: 'underground', biomes: ['caves', 'deep_dark'], damage: 1, groupAnger: true,
    palette: { body: '#8a8a94', head: '#9a9aa4', legs: '#6a6a74', accent: '#4a4a54' },
    drops: [], speed: 4.0, weight: 2,
  }),
  mob('warden', {
    name: 'Warden', behavior: 'hostile', health: 120, size: [1.2, 2.9], shape: 'tall',
    where: 'underground', biomes: ['deep_dark'], damage: 16, senses: 'vibration',
    knockbackResist: 1,
    ranged: { kind: 'sonic', range: 15, cooldown: 5, damage: 10 },
    palette: { body: '#123840', head: '#0d2a30', legs: '#0d2a30', accent: '#3ad8c8' },
    drops: [drop(I.ECHO_SHARD, 1, 1)], speed: 3.4, weight: 1, glow: 0.5,
  }),
  mob('phantom', {
    name: 'Phantom', behavior: 'hostile', health: 20, size: [1.3, 0.6], shape: 'bat',
    where: 'surface', biomes: ['ocean', 'desert', 'mesa', 'plains'], flying: true, damage: 4,
    tags: UNDEAD, burnsInDay: true, swoops: true,
    palette: { body: '#3a4a6a', head: '#44567e', legs: '#2a3a52', accent: '#7fe8e0' },
    drops: [drop(I.PHANTOM_MEMBRANE, 0, 1)], speed: 5.0, weight: 1,
  }),

  // ---------------------------------------------------------- villages
  mob('villager', {
    name: 'Villager', behavior: 'passive', health: 20, size: [0.7, 1.9], shape: 'villager',
    where: 'surface', biomes: [], tags: ['villager'], team: 'village', trades: true,
    fears: ['undead', 'illager'],
    palette: { body: '#7a5a3a', head: '#c9a07a', legs: '#4a3a2a', accent: '#8a5a3a' },
    drops: [], speed: 2.2, weight: 1,
  }),
  mob('iron_golem', {
    name: 'Iron Golem', behavior: 'neutral', health: 100, size: [1.4, 2.7], shape: 'golem',
    where: 'surface', biomes: [], tags: ['golem'], team: 'village', preys: ['monster', 'illager'],
    damage: 11, onHit: { launch: 12 }, knockbackResist: 1, fallImmune: true,
    palette: { body: '#d8d4cc', head: '#cfcac0', legs: '#bdb8ae', accent: '#4a7a3a' },
    drops: [drop(I.IRON_INGOT, 3, 5), drop(B.FLOWER_RED, 0, 2)], speed: 1.9, jump: 9, weight: 1,
  }),

  // ---------------------------------------------------------- illagers
  mob('pillager', {
    name: 'Pillager', behavior: 'hostile', health: 24, size: [0.7, 1.9], shape: 'illager',
    where: 'surface', biomes: ['plains', 'meadow', 'savanna', 'taiga', 'desert', 'snowy_plains'],
    ...ILLAGER, sunProof: true, weight: 0.4, group: [2, 4], escort: { id: 'ravager', chance: 0.12 },
    ranged: { kind: 'arrow', range: 15, cooldown: 2.2, speed: 30, damage: 5 }, item: 'crossbow',
    palette: { body: '#3a3a44', head: '#9a9a8a', legs: '#2a2a34', accent: '#5a4632' },
    drops: [drop(I.ARROW, 0, 2), drop(I.EMERALD, 0, 1, 0.3)], speed: 3.0,
  }),
  mob('vindicator', {
    name: 'Vindicator', behavior: 'hostile', health: 24, size: [0.7, 1.9], shape: 'illager',
    where: 'surface', biomes: [], ...ILLAGER, damage: 8, item: 'axe',
    palette: { body: '#2a3a3e', head: '#9a9a8a', legs: '#1e2a2e', accent: '#8a8a92' },
    drops: [drop(I.EMERALD, 0, 1)], speed: 3.4,
  }),
  mob('evoker', {
    name: 'Evoker', behavior: 'hostile', health: 24, size: [0.7, 1.9], shape: 'illager',
    where: 'surface', biomes: [], ...ILLAGER, caster: true, item: 'robe',
    palette: { body: '#1e1e24', head: '#9a9a8a', legs: '#16161c', accent: '#d8b43a' },
    drops: [drop(I.TOTEM_OF_UNDYING, 1, 1), drop(I.EMERALD, 0, 1)], speed: 2.8,
  }),
  mob('vex', {
    name: 'Vex', behavior: 'hostile', health: 14, size: [0.4, 0.8], shape: 'vex',
    where: 'any', biomes: [], ...ILLAGER, flying: true, noclip: true, damage: 5,
    lifespan: [30, 119], glow: 0.2,
    palette: { body: '#aabccc', head: '#c4d4e0', legs: '#8a9cae', accent: '#e8eef4' },
    drops: [], speed: 5.0,
  }),
  mob('ravager', {
    name: 'Ravager', behavior: 'hostile', health: 100, size: [1.95, 2.2], shape: 'ravager',
    where: 'surface', biomes: [], ...ILLAGER, damage: 12, onHit: { knockback: 14 },
    knockbackResist: 0.75,
    palette: { body: '#4a4640', head: '#3a3630', legs: '#2e2a26', accent: '#d8d0bc' },
    drops: [drop(I.LEATHER, 1, 3)], speed: 3.0, jump: 9,
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
    tags: UNDEAD, groupAnger: true,
    palette: { body: '#3a7a5a', head: '#7aa07a', legs: '#2a5a4a', accent: '#e8c43a' },
    drops: [drop(I.ROTTEN_FLESH, 0, 1), drop(I.GOLD_INGOT, 0, 1, 0.1)], speed: 2.8, weight: 4,
  }),
  mob('piglin', {
    name: 'Piglin', behavior: 'neutral', health: 16, size: [0.7, 1.9], shape: 'biped',
    where: 'any', biomes: ['nether_wastes', 'crimson_forest'], lavaProof: true, damage: 5,
    hatesUngilded: true, barters: true, groupAnger: true,
    palette: { body: '#e0a08a', head: '#e8ae98', legs: '#8a6a4a', accent: '#e8c43a' },
    drops: [drop(I.LEATHER, 0, 1)], speed: 3.2, weight: 3,
  }),
  mob('hoglin', {
    name: 'Hoglin', behavior: 'hostile', health: 40, size: [1.3, 1.3], shape: 'quadruped',
    where: 'any', biomes: ['crimson_forest'], lavaProof: true, damage: 6, onHit: { launch: 11 },
    palette: { body: '#9a5a4a', head: '#aa6a5a', legs: '#6a3a2a', accent: '#3a2a22' },
    drops: [drop(I.LEATHER, 0, 2)], speed: 3.4, weight: 2,
  }),
  mob('wither_skeleton', {
    name: 'Wither Skeleton', behavior: 'hostile', health: 20, size: [0.7, 2.2], shape: 'biped',
    where: 'any', biomes: ['nether_wastes', 'soul_sand_valley'], lavaProof: true, damage: 8,
    tags: UNDEAD, onHit: { effect: 'wither', value: 1, duration: 10 },
    palette: { body: '#2a2a2a', head: '#333333', legs: '#1e1e1e', accent: '#5a5a5a' },
    drops: [drop(I.BONE, 0, 2)], speed: 3.0, weight: 3,
  }),
  mob('blaze', {
    name: 'Blaze', behavior: 'hostile', health: 20, size: [0.7, 1.6], shape: 'blaze',
    where: 'any', biomes: ['nether_wastes', 'lava_ring', 'soul_sand_valley'],
    lavaProof: true, flying: true, damage: 5, glow: 0.9,
    ranged: { kind: 'fireball', range: 14, cooldown: 3.2, speed: 18, damage: 5, burst: 3, gap: 0.3 },
    palette: { body: '#e8c43a', head: '#f0d45a', legs: '#c08a1a', accent: '#f8f0a0' },
    drops: [drop(I.BLAZE_ROD, 0, 1)], speed: 2.6, weight: 3,
  }),
  mob('ghast', {
    name: 'Ghast', behavior: 'hostile', health: 10, size: [2.4, 2.4], shape: 'ghast',
    where: 'any', biomes: ['lava_ocean', 'nether_wastes', 'soul_sand_valley'], lavaProof: true, flying: true,
    damage: 6, glow: 0.3,
    ranged: { kind: 'fireball', range: 26, cooldown: 3.2, speed: 13, damage: 6, explode: 1 },
    palette: { body: '#e8e4dc', head: '#f0ece4', legs: '#c8c4bc', accent: '#3a3a3a' },
    drops: [drop(I.GHAST_TEAR, 0, 1)], speed: 2.4, weight: 1,
  }),
  mob('magma_cube', {
    name: 'Magma Cube', behavior: 'hostile', health: 16, size: [1.0, 1.0], shape: 'blob',
    where: 'any', biomes: ['lava_ring', 'nether_wastes'], lavaProof: true, damage: 6,
    glow: 0.55, hops: true, splits: true,
    palette: { body: '#2a1a1a', head: '#e2611c', legs: '#8e3a1c', accent: '#f0a83a' },
    drops: [drop(I.SLIME_BALL, 0, 1)], speed: 2.4, jump: 11, weight: 3,
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
    ranged: { kind: 'bullet', range: 15, cooldown: 2.4, speed: 7, damage: 4,
      effect: { name: 'levitation', value: 1, duration: 3 } },
    palette: { body: '#8a6a9a', head: '#9a7aaa', legs: '#6a4a7a', accent: '#d8c8e8' },
    drops: [drop(I.SHULKER_SHELL, 0, 1)], speed: 0, jump: 0, weight: 2,
  }),
  mob('ender_dragon', {
    name: 'Ender Dragon', behavior: 'hostile', health: 200, size: [3.5, 2.0], shape: 'dragon',
    where: 'any', biomes: ['end_main'], flying: true, damage: 12, boss: true, swoops: true,
    knockbackResist: 1,
    palette: { body: '#161020', head: '#1e1630', legs: '#100c18', accent: '#c26af0' },
    drops: [], speed: 6.0, weight: 0.2, glow: 0.35,
  }),
]);

// ------------------------------------------------------------------ villagers

// Each villager gets a profession: its robe colour, and what it will trade.
// `give` is what the player hands over, `get` what comes back.
const t = (give, get) => ({
  give: give.map(([id, count]) => ({ id, count })),
  get: { id: get[0], count: get[1] },
});

export const PROFESSIONS = {
  farmer: {
    name: 'Farmer', robe: '#8a6a3a', hat: '#d8c07a',
    trades: [
      t([[B.WHEAT, 20]], [I.EMERALD, 1]),
      t([[B.PUMPKIN, 6]], [I.EMERALD, 1]),
      t([[I.EMERALD, 1]], [B.CARVED_PUMPKIN, 2]),
      t([[I.EMERALD, 1]], [B.HAY_BALE, 3]),
    ],
  },
  butcher: {
    name: 'Butcher', robe: '#e8e4dc', hat: '#b33a3a',
    trades: [
      t([[I.RAW_BEEF, 10]], [I.EMERALD, 1]),
      t([[I.RAW_PORKCHOP, 10]], [I.EMERALD, 1]),
      t([[I.EMERALD, 1]], [I.LEATHER, 4]),
    ],
  },
  fletcher: {
    name: 'Fletcher', robe: '#4a6a3a', hat: '#e8e4dc',
    trades: [
      t([[I.STICK, 32]], [I.EMERALD, 1]),
      t([[I.STRING, 14]], [I.EMERALD, 1]),
      t([[I.EMERALD, 1]], [I.ARROW, 16]),
      t([[I.EMERALD, 2]], [I.BOW, 1]),
      t([[I.FLINT, 10]], [I.EMERALD, 1]),
    ],
  },
  librarian: {
    name: 'Librarian', robe: '#e0dcd0', hat: '#8a2a2a',
    trades: [
      t([[I.FEATHER, 16]], [I.EMERALD, 1]),
      t([[I.EMERALD, 1]], [B.GLASS, 4]),
      t([[I.EMERALD, 1]], [B.LANTERN, 1]),
      t([[I.EMERALD, 6]], [B.BOOKSHELF, 1]),
    ],
  },
  cleric: {
    name: 'Cleric', robe: '#6a2a7a', hat: '#d8b43a',
    trades: [
      t([[I.ROTTEN_FLESH, 32]], [I.EMERALD, 1]),
      t([[I.GOLD_INGOT, 3]], [I.EMERALD, 1]),
      t([[I.EMERALD, 1]], [I.REDSTONE, 4]),
      t([[I.EMERALD, 1]], [I.LAPIS, 2]),
      t([[I.EMERALD, 5]], [I.ENDER_PEARL, 1]),
      t([[I.EMERALD, 3]], [I.POTION_HEALING, 1]),
    ],
  },
  weaponsmith: {
    name: 'Weaponsmith', robe: '#2a2a30', hat: '#8a8a92',
    trades: [
      t([[I.COAL, 15]], [I.EMERALD, 1]),
      t([[I.IRON_INGOT, 4]], [I.EMERALD, 1]),
      t([[I.EMERALD, 3]], [I.IRON_SWORD, 1]),
      t([[I.EMERALD, 12], [I.DIAMOND, 1]], [I.DIAMOND_SWORD, 1]),
    ],
  },
  mason: {
    name: 'Mason', robe: '#6a5a4a', hat: '#a0a6b0',
    trades: [
      t([[B.CLAY, 10]], [I.EMERALD, 1]),
      t([[I.EMERALD, 1]], [B.STONE_BRICKS, 8]),
      t([[I.EMERALD, 1]], [B.TERRACOTTA, 6]),
    ],
  },
};

// What a piglin hands back for a gold ingot, weighted.
export const BARTERS = [
  { id: I.ENDER_PEARL, min: 1, max: 2, weight: 10 },
  { id: I.STRING, min: 3, max: 9, weight: 20 },
  { id: I.POTION_FIRE_RESISTANCE, min: 1, max: 1, weight: 8 },
  { id: I.QUARTZ, min: 5, max: 12, weight: 20 },
  { id: I.LEATHER, min: 2, max: 4, weight: 40 },
  { id: B.OBSIDIAN, min: 1, max: 1, weight: 40 },
  { id: B.CRYING_OBSIDIAN, min: 1, max: 3, weight: 40 },
  { id: B.SOUL_SAND, min: 2, max: 8, weight: 40 },
  { id: B.GRAVEL, min: 8, max: 16, weight: 40 },
  { id: B.BLACKSTONE, min: 8, max: 16, weight: 40 },
  { id: B.NETHER_BRICK, min: 2, max: 8, weight: 40 },
];

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
