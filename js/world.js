import { REALMS, LUSH_CAVES_AT, DEEP_DARK_AT, PLAYER_H } from './config.js';
import { AIR, BEDROCK, isSolid, isLiquid, isDecoration } from './blocks.js';
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
    this.surface = new Int32Array(this.width);   // topmost non-air y (live)
    this.ground = new Int32Array(this.width);    // generated terrain height (fixed)
    this.bands = layoutBands(LAYOUTS[realm], this.width);

    this.spawn = null;      // set by the generator
    this.portals = [];      // [{ x, y, to }] built by the generator

    generate(this);

    for (let x = 0; x < this.width; x++) this.recalcSurface(x);
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
    this.grid[this.idx(x, y)] = id;
    this.recalcSurface(x);
    return true;
  }

  /** Unchecked write used by the generator; skips the surface recalc. */
  put(x, y, id) {
    if (this.inBounds(x, y)) this.grid[this.idx(x, y)] = id;
  }

  isSolidAt(x, y) {
    return isSolid(this.get(x, y));
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
      if (!isSolid(this.get(x, y))) continue;
      // Headroom only has to be passable, not empty -- tall grass and flowers
      // sit in the two cells above almost every grassy column.
      if (!this.isPassable(x, y - 1) || !this.isPassable(x, y - 2)) continue;
      return y - PLAYER_H;
    }
    return null;
  }

  /** Nothing there to stand in the way: air or a decoration, but not liquid. */
  isPassable(x, y) {
    const id = this.get(x, y);
    return id === AIR || isDecoration(id);
  }

  /**
   * Where to put the player to *see* a column: on its terrain if it's dry, on
   * the waterline if it's flooded. Used by creative travel, where landing on
   * the sea bed of an ocean isn't what "go to the ocean" means.
   */
  viewpointAt(x) {
    const start = Math.max(0, Math.min(this.width - 1, x | 0));

    // Step sideways if the obvious spot is inside a tree trunk or a pillar.
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
        // Skip anything built on top of the terrain -- trees, pillars, portals.
        if (Math.abs(y + PLAYER_H - this.ground[col]) > 1.5) continue;
        return { x: col + 0.5, y };
      }
    }
    return { x: preferred + 0.5, y: from };
  }
}
