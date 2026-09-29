import { REALMS, LUSH_CAVES_AT, DEEP_DARK_AT, PLAYER_H } from './config.js';
import { AIR, BEDROCK, FIRE, block, isSolid, isLiquid, isDecoration } from './blocks.js';
import { BIOMES, LAYOUTS, layoutBands, bandIndexAt } from './biomes.js';
import { generate } from './worldgen.js';

/** One realm's block grid, plus the bookkeeping the renderer and physics need. */
export class World {
  constructor(realm, seed) {
    const spec = REALMS[realm];
    if (!spec) throw new Error(`unknown realm: ${realm}`);

    this.realm = realm;
    this.spec = spec;
    this.seed = seed >>> 0;
    this.width = spec.w;
    this.height = spec.h;
    this.liquidLevel = spec.liquidLevel;

    this.grid = new Uint8Array(this.width * this.height);
    this.trees = new Uint8Array(this.width * this.height);   // 1 = part of a generated tree
    this.surface = new Int32Array(this.width);   // topmost non-air y (live)
    this.ground = new Int32Array(this.width);    // generated terrain height (fixed)
    this.bands = layoutBands(LAYOUTS[realm], this.width);

    this.spawn = null;      // set by the generator
    this.portals = [];      // [{ x, y, to }] built by the generator
    this.structures = [];   // [{ id, name, x, y }] for the debug readout
    this.blockData = new Map();   // "x,y" -> chest contents, spawner type, ...
    this.fires = new Map();       // "x,y" -> { x, y, age, life, wait }; see fire.js
    this.primed = new Map();      // "x,y" -> lit TNT and its fuse
    this.edits = 0;               // bumped by every write; see changes()
    this.packed = null;           // changed cells as of some edit count

    generate(this);

    // What the seed made, so a save only has to hold what's changed since.
    this.pristine = {
      grid: this.grid.slice(),
      trees: this.trees.slice(),
      data: new Map([...this.blockData].map(([key, d]) => [key, JSON.stringify(d)])),
      portals: this.portals.length,
    };

    for (let x = 0; x < this.width; x++) this.recalcSurface(x);
    // The generator writes fire straight into the grid (the Nether's eternal
    // flames); register those so they burn like any other.
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === FIRE) this.track(i % this.width, Math.floor(i / this.width));
    }
    this.voidFloor = spec.voidDepth ? this.deepestBlock() + 1 + spec.voidDepth : this.height;
  }

  /** The lowest y holding anything at all -- the underside of the deepest island. */
  deepestBlock() {
    for (let y = this.height - 1; y >= 0; y--) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[this.idx(x, y)] !== AIR) return y;
      }
    }
    return 0;
  }

  /** Whether a body has reached the void: past either side edge, or down to the floor. */
  inVoid(body) {
    return body.left < 0 || body.right > this.width || body.bottom >= this.voidFloor;
  }

  idx(x, y) {
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Out of bounds: solid past the sides and floor, empty above. */
  get(x, y) {
    if (x < 0 || x >= this.width) return BEDROCK;
    if (y < 0) return AIR;
    if (y >= this.height) return this.spec.liquid === null ? AIR : BEDROCK;
    return this.grid[this.idx(x, y)];
  }

  set(x, y, id) {
    if (!this.inBounds(x, y)) return false;
    // Replacing a block discards whatever was attached to it -- a broken chest
    // must not leave its loot behind for whatever is placed there next.
    const was = this.grid[this.idx(x, y)];
    if (was !== id) this.blockData.delete(`${x},${y}`);
    this.edits++;
    this.grid[this.idx(x, y)] = id;
    this.trees[this.idx(x, y)] = 0;      // a placed log is a wall, not a tree
    if (id === FIRE) this.track(x, y);
    else if (was === FIRE) this.fires.delete(`${x},${y}`);
    this.recalcSurface(x);
    return true;
  }

  /** Per-block state: chest contents, spawner mob, and the like. */
  dataAt(x, y) {
    return this.blockData.get(`${x},${y}`) ?? null;
  }

  setData(x, y, value) {
    this.blockData.set(`${x},${y}`, value);
  }

  /** Unchecked write used by the generator; skips the surface recalc. */
  put(x, y, id) {
    if (!this.inBounds(x, y)) return;
    this.grid[this.idx(x, y)] = id;
    this.edits++;
  }

  /** Start keeping time for a fire in (x, y); fire.js decides what it does. */
  track(x, y) {
    this.fires.set(`${x},${y}`, { x, y, age: 0, life: 4 + Math.random() * 5, wait: Math.random() * 0.25 });
  }

  /** Generator write for trunks and crowns: solid, but bodies pass through. */
  putTree(x, y, id) {
    if (!this.inBounds(x, y)) return;
    this.grid[this.idx(x, y)] = id;
    this.trees[this.idx(x, y)] = 1;
    this.edits++;
  }

  /**
   * Whether a body (the player, a mob, a projectile, a line of sight) is
   * stopped by this cell. Generated trees are solid for building against but
   * not for walking; a log the player places is an ordinary wall.
   */
  blocksMovementAt(x, y) {
    // Past the side edges is void: nothing stops a body falling into it.
    if (x < 0 || x >= this.width) return false;
    if (!isSolid(this.get(x, y))) return false;
    return !(this.inBounds(x, y) && this.trees[this.idx(x, y)]);
  }

  isLiquidAt(x, y) {
    return isLiquid(this.get(x, y));
  }

  /** Decorations don't support placement, so builders need to see through them. */
  isReplaceable(x, y) {
    const id = this.get(x, y);
    return id === AIR || isLiquid(id) || isDecoration(id);
  }

  recalcSurface(x) {
    for (let y = 0; y < this.height; y++) {
      if (this.grid[this.idx(x, y)] !== AIR) {
        this.surface[x] = y;
        return;
      }
    }
    this.surface[x] = this.height;
  }

  /**
   * Somewhere inside a box where the player's body fits, searching outward
   * from the middle column. Prefers a spot with a floor under it; falls back
   * to any non-solid gap (water counts -- you can swim, you can't be stuck in
   * it). Returns null only if the whole box is solid.
   */
  findClearSpot(x0, x1, y0, y1) {
    const mid = Math.round((x0 + x1) / 2);
    const cols = [mid];
    for (let d = 1; d <= Math.max(mid - x0, x1 - mid); d++) {
      if (mid - d >= x0) cols.push(mid - d);
      if (mid + d <= x1) cols.push(mid + d);
    }

    let floating = null;
    for (const x of cols) {
      for (let y = Math.max(0, y0 - 2); y <= y1 && y < this.height - 2; y++) {
        if (this.blocksMovementAt(x, y) || this.blocksMovementAt(x, y + 1)) continue;
        if (this.blocksMovementAt(x, y + 2)) return { x: x + 0.5, y };
        if (!floating) floating = { x: x + 0.5, y };
      }
    }
    return floating;
  }

  // ---- saving ----

  /**
   * Everything that differs from what the seed generated, or null if nothing
   * does. `cells` packs each changed cell as a varint index delta and its
   * block id; block data holds only the entries that changed, with null for
   * one that's gone; portals are the ones built since generation.
   */
  changes() {
    const { data, portals } = this.pristine;

    // Scanning the grid is the one slow part, so skip it if nothing's written.
    if (this.packed?.edits !== this.edits) this.packed = { edits: this.edits, cells: this.packCells() };
    const { cells } = this.packed;

    const changed = [];
    for (const [key, d] of this.blockData) {
      // A spawner's cooldown is a live countdown, not something to keep.
      const kept = d.kind === 'spawner' ? { ...d, cooldown: 0 } : d;
      if (JSON.stringify(kept) !== data.get(key)) changed.push([key, kept]);
    }
    for (const key of data.keys()) {
      if (!this.blockData.has(key)) changed.push([key, null]);
    }

    const built = this.portals.slice(portals).map(({ x, y, to, built }) => ({ x, y, to, built }));

    if (!cells.length && !changed.length && !built.length) return null;
    return { cells, data: changed, portals: built };
  }

  /** Every cell whose block (or tree flag) differs from generation, packed. */
  packCells() {
    const { grid, trees } = this.pristine;
    const bytes = [];
    let last = 0;
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === grid[i] && this.trees[i] === trees[i]) continue;
      for (let d = i - last; ; d >>>= 7) {
        if (d < 0x80) { bytes.push(d); break; }
        bytes.push((d & 0x7f) | 0x80);
      }
      bytes.push(this.grid[i]);
      last = i;
    }
    return Uint8Array.from(bytes);
  }

  /** Reapply what changes() recorded, onto a freshly generated world. */
  restore({ cells, data, portals }) {
    let i = 0;
    for (let p = 0; p < cells.length;) {
      let d = 0;
      for (let shift = 0; ; shift += 7) {
        const b = cells[p++];
        d |= (b & 0x7f) << shift;
        if (b < 0x80) break;
      }
      i += d;
      // Through set(), so fires relight and the surface follows -- and, like
      // any block the game changes, a generated tree cell becomes a wall.
      this.set(i % this.width, Math.floor(i / this.width), cells[p++]);
    }
    // After the cells: set() drops a replaced block's data, and this puts back
    // whatever the save says belongs there.
    for (const [key, d] of data) {
      if (d === null) this.blockData.delete(key);
      else this.blockData.set(key, d);
    }
    this.portals.push(...portals);
  }

  /** The structure whose footprint contains this cell, if any. */
  structureAt(x, y) {
    for (const s of this.structures) {
      if (x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1) return s;
    }
    return null;
  }

  // ---- biome lookup ----

  bandAt(x) {
    return this.bands[bandIndexAt(this.bands, Math.max(0, Math.min(this.width - 1, x | 0)))];
  }

  /** The surface biome for a column. */
  surfaceBiomeAt(x) {
    return BIOMES[this.bandAt(x).id];
  }

  /** The underground biome for a depth; overworld only, null elsewhere. */
  undergroundBiomeAt(y) {
    if (this.realm !== 'overworld') return null;
    if (y < this.height * LUSH_CAVES_AT) return BIOMES.caves;
    if (y < this.height * DEEP_DARK_AT) return BIOMES.lush_caves;
    return BIOMES.deep_dark;
  }

  /**
   * What biome the player is "in" — the cave band once they're well below the
   * surface, otherwise the surface band. Drives sky colour and the HUD readout.
   */
  biomeAt(x, y) {
    const below = y - this.ground[Math.max(0, Math.min(this.width - 1, x | 0))];
    const under = this.undergroundBiomeAt(y);
    return below > 6 && under ? under : this.surfaceBiomeAt(x);
  }

  /**
   * Top of the player's box on the first floor below `from` with headroom.
   * Starts below any realm ceiling -- the Nether's roof is solid, so scanning
   * from y=0 would otherwise "land" the player on the underside of it.
   */
  standingYAt(x, from = 0) {
    for (let y = from + 2; y < this.height - 1; y++) {
      if (!this.blocksMovementAt(x, y)) continue;
      // Headroom only has to be passable, not empty -- tall grass, flowers and
      // tree trunks sit in the two cells above many grassy columns.
      if (!this.isPassable(x, y - 1) || !this.isPassable(x, y - 2)) continue;
      return y - PLAYER_H;
    }
    return null;
  }

  /** Like blocksMovementAt, but for mobs, which can't get through doors. */
  blocksMobAt(x, y) {
    return this.blocksMovementAt(x, y) || !!block(this.get(x, y)).door;
  }

  /** Nothing there to stand in the way: air, a decoration or a tree, but not liquid. */
  isPassable(x, y) {
    return !this.blocksMovementAt(x, y) && !isLiquid(this.get(x, y));
  }

  /**
   * Where to put the player to *see* a column: on its terrain if it's dry, on
   * the waterline if it's flooded. Used by creative travel, where landing on
   * the sea bed of an ocean isn't what "go to the ocean" means.
   */
  viewpointAt(x) {
    const start = Math.max(0, Math.min(this.width - 1, x | 0));

    // Step sideways if the obvious spot is inside a pillar.
    for (let d = 0; d <= 24; d++) {
      for (const col of d === 0 ? [start] : [start - d, start + d]) {
        if (col < 0 || col >= this.width) continue;

        const terrain = this.ground[col];
        const top = terrain >= this.height
          ? this.spec.surfaceLevel
          : (this.liquidLevel >= 0 && terrain > this.liquidLevel ? this.liquidLevel : terrain);

        const y = top - PLAYER_H;
        if (this.isPassable(col, Math.floor(y)) && this.isPassable(col, Math.floor(y + 1))) {
          return { x: col + 0.5, y };
        }
      }
    }
    return { x: start + 0.5, y: this.spec.surfaceLevel - PLAYER_H };
  }

  /** A safe standing spot, searching outward from a preferred column. */
  spawnPoint(preferred = Math.floor(this.width / 2)) {
    const from = (this.spec.ceiling ?? 0) + 1;

    for (let d = 0; d < this.width; d++) {
      for (const col of d === 0 ? [preferred] : [preferred - d, preferred + d]) {
        if (col < 0 || col >= this.width) continue;
        const y = this.standingYAt(col, from);
        if (y === null) continue;
        // Skip anything built on top of the terrain -- pillars, portals, houses.
        if (Math.abs(y + PLAYER_H - this.ground[col]) > 1.5) continue;
        return { x: col + 0.5, y };
      }
    }
    return { x: preferred + 0.5, y: from };
  }
}
