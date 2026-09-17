import * as B from './blocks.js';
import { DEEPSLATE_AT, DEEP_DARK_AT, LUSH_CAVES_AT } from './config.js';

// Structures are drawn in cross-section, the way the world is. Each definition
// says where it may appear; `build` paints it through a small brush API so the
// builders read like drawings rather than array indexing.

function brush(world, rand) {
  // Every write is tracked so a structure ends up knowing its own footprint,
  // which is what lets the tooltip name the thing you're standing in.
  const bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };

  const set = (x, y, id) => {
    if (!world.inBounds(x, y)) return;
    world.put(x, y, id);
    if (x < bounds.x0) bounds.x0 = x;
    if (x > bounds.x1) bounds.x1 = x;
    if (y < bounds.y0) bounds.y0 = y;
    if (y > bounds.y1) bounds.y1 = y;
  };

  return {
    world,
    rand,
    set,
    bounds,

    /** Inclusive rectangle fill. */
    fill(x0, y0, x1, y1, id) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y, id);
      }
    },

    clear(x0, y0, x1, y1) {
      this.fill(x0, y0, x1, y1, B.AIR);
    },

    /** Walls only, leaving the inside untouched. */
    outline(x0, y0, x1, y1, id) {
      for (let x = x0; x <= x1; x++) { set(x, y0, id); set(x, y1, id); }
      for (let y = y0; y <= y1; y++) { set(x0, y, id); set(x1, y, id); }
    },

    /** Walled room with an empty interior. */
    room(x0, y0, x1, y1, wall, floorId = wall) {
      this.fill(x0, y0, x1, y1, B.AIR);
      this.outline(x0, y0, x1, y1, wall);
      for (let x = x0; x <= x1; x++) set(x, y1, floorId);
    },

    /** Scatter `id` over a rect at the given density. */
    speckle(x0, y0, x1, y1, id, density) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (rand() < density) set(x, y, id);
        }
      }
    },

    /** A chest that rolls the named loot table the first time it's opened. */
    chest(x, y, table) {
      set(x, y, B.CHEST);
      world.setData(x, y, { kind: 'chest', table, opened: false });
    },

    spawner(x, y, mobId) {
      set(x, y, B.SPAWNER);
      world.setData(x, y, { kind: 'spawner', mob: mobId, cooldown: 0 });
    },

    pick(list) {
      return list[Math.floor(rand() * list.length)];
    },

    chance(p) {
      return rand() < p;
    },
  };
}

// Wood and stone vary by biome so a village reads as belonging where it stands.
const VILLAGE_PALETTES = {
  plains:  { planks: B.OAK_PLANKS, log: B.OAK_LOG, wall: B.COBBLESTONE, roof: B.OAK_PLANKS },
  meadow:  { planks: B.OAK_PLANKS, log: B.OAK_LOG, wall: B.COBBLESTONE, roof: B.OAK_PLANKS },
  savanna: { planks: B.ACACIA_PLANKS, log: B.ACACIA_LOG, wall: B.ACACIA_PLANKS, roof: B.ACACIA_PLANKS },
  taiga:   { planks: B.SPRUCE_PLANKS, log: B.SPRUCE_LOG, wall: B.COBBLESTONE, roof: B.SPRUCE_PLANKS },
  desert:  { planks: B.SANDSTONE, log: B.CHISELED_SANDSTONE, wall: B.SANDSTONE, roof: B.SANDSTONE },
};

/** One village building: walls, a door, a window, a roof, sometimes furniture. */
function house(b, x, groundY, w, h, pal) {
  const top = groundY - h;
  b.clear(x, top, x + w, groundY - 1);
  b.outline(x, top, x + w, groundY - 1, pal.wall);
  b.fill(x, top, x + w, top, pal.roof);                  // roof
  b.set(x, groundY - 1, pal.log);                        // corner posts
  b.set(x + w, groundY - 1, pal.log);

  const doorX = x + 1 + Math.floor(b.rand() * (w - 1));
  b.set(doorX, groundY - 1, B.OAK_DOOR);
  b.set(doorX, groundY - 2, B.OAK_DOOR);

  const winX = doorX === x + 1 ? x + w - 1 : x + 1;
  b.set(winX, groundY - 2, B.GLASS);

  if (b.chance(0.5)) b.set(x + 1, groundY - 1, B.CRAFTING_TABLE);
  if (b.chance(0.4)) b.set(x + w - 1, groundY - 1, B.FURNACE);
  if (b.chance(0.45)) b.chest(x + Math.floor(w / 2), groundY - 1, 'village');
  if (b.chance(0.5)) b.set(x + Math.floor(w / 2), top + 1, B.LANTERN);
}

export const STRUCTURES = {
  // ---------------------------------------------------------------- surface
  village: {
    name: 'Village', realm: 'overworld', place: 'surface',
    biomes: ['plains', 'meadow', 'savanna', 'taiga', 'desert'],
    width: 34, spacing: 430, chance: 0.8, flatness: 9,
    build(b, x, groundY, biomeId) {
      const pal = VILLAGE_PALETTES[biomeId] ?? VILLAGE_PALETTES.plains;
      let cx = x;

      // A well at the near end, then a row of houses with farm plots between.
      b.fill(cx, groundY - 1, cx + 2, groundY - 1, B.COBBLESTONE);
      b.fill(cx + 1, groundY, cx + 1, groundY + 3, B.WATER);
      b.set(cx, groundY, B.COBBLESTONE);
      b.set(cx + 2, groundY, B.COBBLESTONE);
      cx += 5;

      const houses = 3 + Math.floor(b.rand() * 2);
      for (let i = 0; i < houses; i++) {
        const w = 4 + Math.floor(b.rand() * 3);
        house(b, cx, groundY, w, 4 + Math.floor(b.rand() * 2), pal);
        cx += w + 2;

        if (b.chance(0.6)) {                             // farm plot
          const fw = 3 + Math.floor(b.rand() * 3);
          for (let fx = cx; fx < cx + fw; fx++) {
            b.set(fx, groundY, B.FARMLAND);
            b.set(fx, groundY - 1, B.WHEAT);
          }
          cx += fw + 1;
        }
      }
      if (b.chance(0.7)) b.set(cx, groundY - 1, B.HAY_BALE);
    },
  },

  desert_pyramid: {
    name: 'Desert Pyramid', realm: 'overworld', place: 'surface',
    biomes: ['desert'], width: 21, spacing: 520, chance: 0.75, flatness: 8,
    build(b, x, groundY) {
      const size = 10;
      // Stepped pyramid: each course one block narrower on both sides.
      for (let i = 0; i < size; i++) {
        b.fill(x + i, groundY - i, x + size * 2 - i, groundY - i, B.SANDSTONE);
      }
      for (let i = 0; i < size; i += 3) {
        b.set(x + i + 1, groundY - i, B.TERRACOTTA_ORANGE);
        b.set(x + size * 2 - i - 1, groundY - i, B.TERRACOTTA_ORANGE);
      }
      b.set(x + size, groundY - size + 1, B.CHISELED_SANDSTONE);

      // Buried treasure room under the base, with the classic TNT under it.
      const cx = x + size;
      const ry = groundY + 5;
      b.room(cx - 4, ry - 4, cx + 4, ry, B.SANDSTONE, B.SANDSTONE);
      b.fill(cx - 3, ry - 1, cx + 3, ry - 1, B.AIR);
      b.set(cx, ry - 1, B.CHISELED_SANDSTONE);
      b.fill(cx - 1, ry, cx + 1, ry, B.TNT);
      b.chest(cx - 3, ry - 1, 'desert_pyramid');
      b.chest(cx + 3, ry - 1, 'desert_pyramid');
      // A shaft down from the apex, mostly filled in, as the way in.
      b.fill(cx, groundY - 1, cx, ry - 5, B.SANDSTONE);
    },
  },

  jungle_temple: {
    name: 'Jungle Temple', realm: 'overworld', place: 'surface',
    biomes: ['jungle'], width: 13, spacing: 480, chance: 0.7, flatness: 9,
    build(b, x, groundY) {
      const w = 10;
      const h = 8;
      b.fill(x, groundY - h, x + w, groundY + 2, B.COBBLESTONE);
      b.speckle(x, groundY - h, x + w, groundY + 2, B.MOSSY_COBBLESTONE, 0.45);

      b.room(x + 1, groundY - 3, x + w - 1, groundY, B.COBBLESTONE);        // upper
      b.room(x + 1, groundY - h + 1, x + w - 1, groundY - 4, B.COBBLESTONE); // lower
      b.set(x + 1, groundY - 1, B.AIR);                                      // doorway
      b.set(x + 1, groundY - 2, B.AIR);

      b.speckle(x + 2, groundY - h + 2, x + w - 2, groundY - 5, B.COBWEB, 0.18);
      b.chest(x + w - 2, groundY - 5, 'jungle_temple');
      b.chest(x + 2, groundY - 1, 'jungle_temple');
      b.set(x + Math.floor(w / 2), groundY - 5, B.LANTERN);
      for (let i = 2; i < w - 1; i += 3) b.set(x + i, groundY - h, B.MOSSY_COBBLESTONE);
    },
  },

  swamp_hut: {
    name: 'Swamp Hut', realm: 'overworld', place: 'surface',
    biomes: ['swamp'], width: 9, spacing: 400, chance: 0.7, flatness: 10,
    build(b, x, groundY) {
      const floorY = groundY - 4;                         // raised on stilts
      for (const sx of [x, x + 6]) b.fill(sx, floorY + 1, sx, groundY, B.OAK_FENCE);

      b.room(x, floorY - 3, x + 6, floorY, B.SPRUCE_PLANKS, B.SPRUCE_PLANKS);
      b.fill(x, floorY - 4, x + 6, floorY - 4, B.SPRUCE_PLANKS);
      b.set(x + 3, floorY - 1, B.AIR);
      b.set(x + 3, floorY - 2, B.AIR);
      b.set(x + 1, floorY - 1, B.CRAFTING_TABLE);
      b.set(x + 5, floorY - 1, B.FURNACE);
      b.chest(x + 2, floorY - 1, 'swamp_hut');
      b.spawner(x + 4, floorY - 2, 'witch');
      b.set(x + 3, floorY - 3, B.LANTERN);
    },
  },

  mansion: {
    name: 'Woodland Mansion', realm: 'overworld', place: 'surface',
    biomes: ['dark_forest'], width: 26, spacing: 600, chance: 0.85, flatness: 11,
    build(b, x, groundY) {
      const w = 22;
      const floors = 3;
      const fh = 4;
      const top = groundY - floors * fh;

      b.fill(x, top, x + w, groundY - 1, B.DARK_OAK_PLANKS);
      b.outline(x, top, x + w, groundY - 1, B.COBBLESTONE);

      for (let f = 0; f < floors; f++) {
        const fy = groundY - 1 - f * fh;
        b.clear(x + 1, fy - fh + 1, x + w - 1, fy - 1);
        b.fill(x + 1, fy, x + w - 1, fy, B.DARK_OAK_PLANKS);

        // Interior walls split each floor into rooms.
        for (let rx = x + 6; rx < x + w - 2; rx += 6) {
          b.fill(rx, fy - fh + 1, rx, fy - 1, B.DARK_OAK_PLANKS);
          b.set(rx, fy - 1, B.AIR);
        }
        for (let wx = x + 3; wx < x + w - 1; wx += 5) b.set(wx, fy - 2, B.GLASS);
        if (b.chance(0.8)) b.chest(x + 2 + Math.floor(b.rand() * (w - 4)), fy - 1, 'mansion');
        if (b.chance(0.6)) b.set(x + 4, fy - 1, B.BOOKSHELF);
        b.set(x + 1, fy - 1, B.LANTERN);
      }

      b.set(x + 2, groundY - 1, B.OAK_DOOR);
      b.set(x + 2, groundY - 2, B.OAK_DOOR);
      b.fill(x, top - 1, x + w, top - 1, B.DARK_OAK_LOG);   // roof ridge
    },
  },

  outpost: {
    name: 'Pillager Outpost', realm: 'overworld', place: 'surface',
    biomes: ['plains', 'savanna', 'taiga', 'desert'],
    width: 10, spacing: 560, chance: 0.8, flatness: 9,
    build(b, x, groundY) {
      const h = 13;
      b.fill(x, groundY - h, x + 5, groundY - 1, B.DARK_OAK_PLANKS);
      b.outline(x, groundY - h, x + 5, groundY - 1, B.DARK_OAK_LOG);
      for (let y = groundY - 2; y > groundY - h; y -= 4) {
        b.clear(x + 1, y - 2, x + 4, y);
        b.set(x + 1, y, B.LADDER);
      }
      b.fill(x - 1, groundY - h - 1, x + 6, groundY - h - 1, B.DARK_OAK_PLANKS);
      b.fill(x + 6, groundY - h, x + 6, groundY - h + 2, B.RED_WOOL);   // banner
      b.chest(x + 3, groundY - 2, 'outpost');
      b.spawner(x + 3, groundY - h + 2, 'zombie');
      b.set(x + 4, groundY - h + 1, B.LANTERN);
    },
  },

  ruined_portal: {
    name: 'Ruined Portal', realm: 'overworld', place: 'surface',
    biomes: ['plains', 'meadow', 'forest', 'desert', 'savanna', 'taiga', 'mesa', 'swamp'],
    width: 8, spacing: 380, chance: 0.6, flatness: 9, level: false,
    build(b, x, groundY) {
      // A portal frame with pieces missing, half-swallowed by netherrack.
      for (let dy = 0; dy < 5; dy++) {
        if (b.chance(0.75)) b.set(x, groundY - 1 - dy, B.OBSIDIAN);
        if (b.chance(0.75)) b.set(x + 4, groundY - 1 - dy, B.OBSIDIAN);
      }
      for (let dx = 0; dx <= 4; dx++) {
        if (b.chance(0.6)) b.set(x + dx, groundY - 5, B.OBSIDIAN);
        if (b.chance(0.8)) b.set(x + dx, groundY, B.OBSIDIAN);
      }
      if (b.chance(0.6)) b.set(x, groundY - 3, B.CRYING_OBSIDIAN);
      b.speckle(x - 2, groundY, x + 6, groundY + 1, B.NETHERRACK, 0.55);
      b.speckle(x - 2, groundY, x + 6, groundY, B.GOLD_ORE, 0.12);
      b.chest(x + 6, groundY - 1, 'ruined_portal');
    },
  },

  // ---------------------------------------------------------------- water
  shipwreck: {
    name: 'Shipwreck', realm: 'overworld', place: 'seafloor',
    biomes: ['ocean', 'lake'], width: 16, spacing: 420, chance: 0.6,
    build(b, x, groundY) {
      const w = 13;
      const tilt = b.chance(0.5) ? 1 : -1;
      // Hull planking, sagging along its length.
      for (let i = 0; i <= w; i++) {
        const dip = Math.round(Math.sin((i / w) * Math.PI) * -2);
        const deck = groundY - 4 + dip;
        b.fill(x + i, deck, x + i, groundY - 1, B.AIR);
        b.set(x + i, groundY - 1, B.OAK_PLANKS);
        b.set(x + i, deck, b.chance(0.75) ? B.OAK_PLANKS : B.AIR);
      }
      for (let y = groundY - 7; y < groundY - 1; y++) {   // mast
        if (b.chance(0.7)) b.set(x + Math.floor(w / 2) + tilt, y, B.OAK_LOG);
      }
      b.chest(x + 2, groundY - 2, 'shipwreck');
      if (b.chance(0.6)) b.chest(x + w - 2, groundY - 2, 'shipwreck');
      b.speckle(x, groundY - 3, x + w, groundY - 2, B.COBWEB, 0.06);
    },
  },

  monument: {
    name: 'Ocean Monument', realm: 'overworld', place: 'seafloor',
    biomes: ['ocean'], width: 24, spacing: 900, chance: 0.75,
    build(b, x, groundY) {
      const w = 20;
      const h = 12;
      const top = groundY - h;
      b.fill(x, top, x + w, groundY, B.PRISMARINE);
      b.speckle(x, top, x + w, groundY, B.DARK_PRISMARINE, 0.3);
      b.room(x + 2, top + 2, x + w - 2, groundY - 1, B.DARK_PRISMARINE, B.PRISMARINE);
      b.fill(x + 8, top + 2, x + 8, groundY - 1, B.PRISMARINE);
      b.fill(x + 13, top + 2, x + 13, groundY - 1, B.PRISMARINE);
      // The halls are flooded, as they are in Minecraft -- which is also what
      // lets the drowned that guard the place actually spawn here.
      for (let iy = top + 3; iy < groundY - 1; iy++) {
        for (let ix = x + 3; ix < x + w - 2; ix++) {
          if (b.world.get(ix, iy) === B.AIR) b.set(ix, iy, B.WATER);
        }
      }

      for (const lx of [x + 4, x + 10, x + 16]) b.set(lx, top + 3, B.SEA_LANTERN);
      b.set(x + 5, top + 1, B.SEA_LANTERN);
      b.chest(x + 4, groundY - 2, 'monument');
      b.chest(x + 16, groundY - 2, 'monument');
      b.spawner(x + 10, groundY - 3, 'drowned');
    },
  },

  buried_treasure: {
    name: 'Buried Treasure', realm: 'overworld', place: 'surface',
    biomes: ['desert', 'ocean', 'lake'], width: 3, spacing: 340, chance: 0.5,
    flatness: 8, level: false,
    build(b, x, groundY) {
      b.fill(x, groundY + 3, x + 2, groundY + 5, B.SAND);
      b.chest(x + 1, groundY + 4, 'buried_treasure');
    },
  },

  // ---------------------------------------------------------------- underground
  mineshaft: {
    name: 'Mineshaft', realm: 'overworld', place: 'underground',
    band: 'caves', width: 60, spacing: 340, chance: 0.85,
    build(b, x, y) {
      const len = 34 + Math.floor(b.rand() * 22);
      b.clear(x, y - 2, x + len, y);
      b.fill(x, y + 1, x + len, y + 1, B.OAK_PLANKS);

      for (let i = 0; i <= len; i++) {
        b.set(x + i, y, B.RAIL);
        if (i % 6 === 0) {                                // support frames
          b.fill(x + i, y - 2, x + i, y - 1, B.OAK_FENCE);
          b.set(x + i, y - 3, B.OAK_LOG);
        }
        if (b.chance(0.06)) b.set(x + i, y - 1, B.COBWEB);
        if (b.chance(0.05)) b.set(x + i, y - 3, B.TORCH);
      }
      // A side shaft dropping to a lower level, as they always have.
      const bx = x + 8 + Math.floor(b.rand() * (len - 16));
      b.clear(bx, y + 1, bx + 1, y + 7);
      b.fill(bx, y + 8, bx + 1, y + 8, B.OAK_PLANKS);
      for (let i = 0; i < 8; i++) b.set(bx, y + 1 + i, B.LADDER);
      b.chest(bx + 1, y + 7, 'mineshaft');
      if (b.chance(0.6)) b.chest(x + 4, y, 'mineshaft');
      if (b.chance(0.7)) b.spawner(x + Math.floor(len / 2), y - 1, 'cave_spider');
    },
  },

  dungeon: {
    name: 'Dungeon', realm: 'overworld', place: 'underground',
    band: 'caves', width: 11, spacing: 190, chance: 0.75,
    build(b, x, y) {
      const w = 8;
      const h = 4;
      b.room(x, y - h, x + w, y, B.COBBLESTONE, B.COBBLESTONE);
      b.speckle(x, y - h, x + w, y, B.MOSSY_COBBLESTONE, 0.4);
      b.spawner(x + Math.floor(w / 2), y - 1, b.pick(['zombie', 'skeleton', 'spider']));
      b.chest(x + 1, y - 1, 'dungeon');
      if (b.chance(0.6)) b.chest(x + w - 1, y - 1, 'dungeon');
      b.set(x + 2, y - h + 1, B.TORCH);
    },
  },

  geode: {
    name: 'Amethyst Geode', realm: 'overworld', place: 'underground',
    band: 'any', width: 14, spacing: 260, chance: 0.6,
    build(b, x, y) {
      const r = 4 + Math.floor(b.rand() * 2);
      const cx = x + r;
      // Three shells: basalt, calcite, amethyst, hollow at the centre.
      for (let dy = -r - 2; dy <= r + 2; dy++) {
        for (let dx = -r - 2; dx <= r + 2; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > r + 2) continue;
          const id = d > r + 1 ? B.SMOOTH_BASALT
            : d > r ? B.CALCITE
              : d > r - 1 ? (b.chance(0.25) ? B.BUDDING_AMETHYST : B.AMETHYST_BLOCK)
                : B.AIR;
          b.set(cx + dx, y + dy, id);
        }
      }
      b.chest(cx, y + r - 2, 'geode');
    },
  },

  stronghold: {
    name: 'Stronghold', realm: 'overworld', place: 'underground',
    band: 'deep', width: 40, spacing: 900, chance: 0.9,
    build(b, x, y) {
      const rooms = 3;
      let cx = x;
      for (let i = 0; i < rooms; i++) {
        const w = 9 + Math.floor(b.rand() * 4);
        const h = 5;
        b.room(cx, y - h, cx + w, y, B.STONE_BRICKS, B.STONE_BRICKS);
        b.speckle(cx, y - h, cx + w, y, B.MOSSY_STONE_BRICKS, 0.22);
        b.speckle(cx, y - h, cx + w, y, B.CRACKED_STONE_BRICKS, 0.15);
        b.set(cx, y - 1, B.AIR);                          // doorway through
        b.set(cx, y - 2, B.AIR);
        b.set(cx + w, y - 1, B.AIR);
        b.set(cx + w, y - 2, B.AIR);
        b.set(cx + 2, y - h + 1, B.TORCH);

        if (i === 1) {                                    // library
          for (let bx = cx + 1; bx < cx + w; bx += 2) {
            b.fill(bx, y - 3, bx, y - 1, B.BOOKSHELF);
          }
          b.chest(cx + w - 1, y - 4, 'stronghold');
        } else {
          if (b.chance(0.7)) b.chest(cx + 2, y - 1, 'stronghold');
          if (b.chance(0.4)) b.spawner(cx + w - 2, y - 1, 'silverfish');
        }
        cx += w;
      }
      // Portal room at the end: a frame over a lava pit.
      b.room(cx, y - 6, cx + 9, y + 1, B.STONE_BRICKS, B.STONE_BRICKS);
      b.fill(cx + 1, y, cx + 8, y, B.LAVA);
      b.fill(cx + 3, y - 2, cx + 6, y - 2, B.CHISELED_STONE_BRICKS);
      b.fill(cx + 4, y - 3, cx + 5, y - 3, B.END_PORTAL);
      b.set(cx + 2, y - 5, B.TORCH);
    },
  },

  ancient_city: {
    name: 'Ancient City', realm: 'overworld', place: 'underground',
    band: 'deep_dark', width: 46, spacing: 1000, chance: 0.9,
    build(b, x, y) {
      const w = 40;
      const h = 9;
      b.room(x, y - h, x + w, y, B.DEEPSLATE_BRICKS, B.DEEPSLATE_TILES);
      b.speckle(x, y - h, x + w, y, B.SCULK, 0.3);
      b.speckle(x + 1, y - 1, x + w - 1, y - 1, B.SCULK_VEIN, 0.25);

      // Pillars down the hall, a shrieker at the foot of each.
      for (let px = x + 5; px < x + w - 3; px += 7) {
        b.fill(px, y - h + 1, px, y - 1, B.DEEPSLATE_BRICKS);
        b.set(px, y - h + 1, B.SCULK_CATALYST);
        b.set(px + 1, y - 1, B.SCULK_SHRIEKER);
        b.set(px - 1, y - 1, B.SCULK_SENSOR);
        b.set(px, y - 4, B.SOUL_LANTERN);
      }
      b.fill(x + w / 2 - 2, y - 1, x + w / 2 + 2, y - 1, B.DEEPSLATE_TILES);
      b.chest(x + 3, y - 1, 'ancient_city');
      b.chest(x + w - 3, y - 1, 'ancient_city');
      b.spawner(x + Math.floor(w / 2), y - 1, 'warden');
    },
  },

  // ---------------------------------------------------------------- nether
  nether_fortress: {
    name: 'Nether Fortress', realm: 'nether', place: 'surface',
    biomes: ['nether_wastes', 'soul_sand_valley', 'lava_ring'],
    width: 36, spacing: 420, chance: 0.85, flatness: 14,
    build(b, x, groundY) {
      const w = 30;
      const y = groundY - 3;
      // Raised walkway on arches, with two towers.
      b.fill(x, y, x + w, y, B.NETHER_BRICK);
      b.fill(x, y - 4, x + w, y - 4, B.NETHER_BRICK);
      for (let i = 0; i <= w; i += 5) b.fill(x + i, y + 1, x + i, groundY, B.NETHER_BRICK);
      for (let i = 1; i < w; i++) {
        b.clear(x + i, y - 3, x + i, y - 1);
        if (i % 5 === 2) b.set(x + i, y - 3, B.NETHER_BRICK_FENCE);
      }

      for (const tx of [x + 2, x + w - 6]) {
        b.fill(tx, y - 11, tx + 4, y - 5, B.NETHER_BRICK);
        b.room(tx, y - 11, tx + 4, y - 5, B.NETHER_BRICK, B.NETHER_BRICK);
        b.set(tx + 2, y - 6, B.LAVA);
        b.set(tx + 1, y - 10, B.GLOWSTONE);
      }
      b.spawner(x + 4, y - 6, 'blaze');
      b.spawner(x + w - 4, y - 1, 'wither_skeleton');
      b.chest(x + 6, y - 1, 'nether_fortress');
      b.chest(x + w - 8, y - 6, 'nether_fortress');
    },
  },

  bastion: {
    name: 'Bastion Remnant', realm: 'nether', place: 'surface',
    biomes: ['nether_wastes', 'crimson_forest'],
    width: 26, spacing: 520, chance: 0.7, flatness: 12,
    build(b, x, groundY) {
      const w = 22;
      const h = 10;
      b.fill(x, groundY - h, x + w, groundY, B.BLACKSTONE);
      b.speckle(x, groundY - h, x + w, groundY, B.POLISHED_BLACKSTONE, 0.35);
      b.speckle(x, groundY - h, x + w, groundY, B.GILDED_BLACKSTONE, 0.06);
      b.room(x + 2, groundY - h + 2, x + w - 2, groundY - 1, B.POLISHED_BLACKSTONE, B.BLACKSTONE);

      // Broken ramparts along the top.
      for (let i = 0; i <= w; i++) {
        if (b.chance(0.4)) b.set(x + i, groundY - h, B.AIR);
        if (b.chance(0.25)) b.set(x + i, groundY - h + 1, B.AIR);
      }
      b.set(x + 5, groundY - h + 3, B.LAVA);
      b.chest(x + 4, groundY - 2, 'bastion');
      b.chest(x + w - 4, groundY - 2, 'bastion');
      b.spawner(x + Math.floor(w / 2), groundY - 2, 'piglin');
    },
  },

  // ---------------------------------------------------------------- end
  end_city: {
    name: 'End City', realm: 'end', place: 'surface',
    biomes: ['end_main', 'end_outer'],
    width: 18, spacing: 260, chance: 0.85, flatness: 12,
    build(b, x, groundY) {
      const w = 11;
      const floors = 3;
      const fh = 5;
      for (let f = 0; f < floors; f++) {
        const fy = groundY - 1 - f * fh;
        const inset = f;
        b.room(x + inset, fy - fh, x + w - inset, fy, B.PURPUR_BLOCK, B.PURPUR_BLOCK);
        b.fill(x + inset, fy - fh, x + inset, fy, B.PURPUR_PILLAR);
        b.fill(x + w - inset, fy - fh, x + w - inset, fy, B.PURPUR_PILLAR);
        b.set(x + inset + 1, fy - fh + 1, B.END_ROD);
        b.set(x + w - inset - 1, fy - fh + 1, B.END_ROD);
        b.set(x + inset, fy - 1, B.AIR);                  // way through
        if (b.chance(0.7)) b.chest(x + inset + 2, fy - 1, 'end_city');
        if (b.chance(0.5)) b.spawner(x + w - inset - 2, fy - 1, 'shulker');
      }
      b.fill(x + 3, groundY - floors * fh - 2, x + w - 3, groundY - floors * fh - 2, B.PURPUR_BLOCK);
    },
  },
};

// ------------------------------------------------------------------ placement

/**
 * Flatten the footprint down to `y`, the way Minecraft terraforms under a
 * village: shave off anything standing higher, then make sure every column has
 * solid ground to build on. Without this, surface structures can only appear
 * on terrain that happens to be dead level.
 */
function levelGround(world, x, width, y) {
  for (let i = 0; i < width; i++) {
    const col = x + i;
    if (col < 1 || col >= world.width - 1) continue;

    for (let yy = y - 1; yy >= Math.max(0, world.ground[col] - 10); yy--) {
      if (world.get(col, yy) !== B.AIR) world.put(col, yy, B.AIR);
    }
    if (!B.isSolid(world.get(col, y))) {
      const below = world.get(col, y + 1);
      world.put(col, y, B.isSolid(below) ? below : B.DIRT);
    }

    // The terrain baseline has to follow the cut, or the renderer keeps
    // painting its underground backdrop from the old, higher surface and the
    // structure ends up sitting in a black pit.
    world.ground[col] = y;
  }
}

function terrainSpread(world, x, width) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < width; i++) {
    const col = x + i;
    if (col < 1 || col >= world.width - 1) return null;
    lo = Math.min(lo, world.ground[col]);
    hi = Math.max(hi, world.ground[col]);
  }
  return { lo, hi, spread: hi - lo };
}

/** Pick a y inside an underground band that has rock around it. */
function undergroundY(world, x, band, rand) {
  const h = world.height;
  let lo;
  let hi;
  if (band === 'deep_dark') { lo = h * DEEP_DARK_AT + 4; hi = h - 10; }
  else if (band === 'deep') { lo = h * DEEPSLATE_AT; hi = h * DEEP_DARK_AT; }
  else if (band === 'caves') { lo = world.ground[x] + 14; hi = h * LUSH_CAVES_AT; }
  else { lo = world.ground[x] + 12; hi = h - 12; }

  lo = Math.max(lo, world.ground[x] + 10);
  if (hi - lo < 8) return null;
  return Math.floor(lo + rand() * (hi - lo));
}

/**
 * Walk the world in `spacing`-wide cells and try to drop one of each structure
 * into each cell. Cells keep structures of a kind apart without the cost of
 * checking every previous placement.
 */
export function placeStructures(world, rand) {
  for (const [id, def] of Object.entries(STRUCTURES)) {
    if (def.realm !== world.realm) continue;

    for (let cellStart = 0; cellStart < world.width; cellStart += def.spacing) {
      if (rand() > def.chance) continue;
      const cellEnd = Math.min(world.width - def.width - 2, cellStart + def.spacing);
      if (cellEnd <= cellStart) continue;

      for (let attempt = 0; attempt < 18; attempt++) {
        const x = cellStart + Math.floor(rand() * (cellEnd - cellStart));
        if (x < 2) continue;

        const b = brush(world, rand);

        if (def.place === 'underground') {
          const y = undergroundY(world, x, def.band, rand);
          if (y === null) continue;
          def.build(b, x, y);
          world.structures.push({ id, name: def.name, x, y, ...b.bounds });
          break;
        }

        const biomeId = world.bandAt(x).id;
        if (def.biomes && !def.biomes.includes(biomeId)) continue;

        const spread = terrainSpread(world, x, def.width);
        if (!spread) continue;

        const flooded = world.liquidLevel >= 0 && spread.lo > world.liquidLevel;
        if (def.place === 'seafloor' && !flooded) continue;
        if (def.place === 'surface' && flooded) continue;
        if (def.flatness !== undefined && spread.spread > def.flatness) continue;

        if (def.level !== false) levelGround(world, x, def.width, spread.hi);
        def.build(b, x, spread.hi, biomeId);
        world.structures.push({ id, name: def.name, x, y: spread.hi, ...b.bounds });
        break;
      }
    }
  }
}
