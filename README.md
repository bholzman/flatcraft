# Flatcraft

A simplified 2-D Minecraft in the browser. Vanilla JS + `<canvas>`, ES modules,
no build step and no dependencies.

## Running

ES modules need to be served over HTTP (opening `index.html` directly will fail
on CORS). Use the bundled dev server:

```sh
./serve.py           # http://localhost:8137
```

It sends `Cache-Control: no-store`, which matters while iterating: plain
`python3 -m http.server` sends no cache headers at all, and Chrome will then
keep running a stale copy of an edited module until you hard-reload.

## Controls

| Input | Action |
| --- | --- |
| `A` / `D` (or arrows) | Move |
| `Space` / `W` | Jump (hold for higher) |
| Left click | Mine the highlighted block |
| Right click | Place the selected block |
| `1`–`9` / scroll | Select hotbar slot |
| Left click | Mine, or **attack** the mob under the cursor |
| Right click *(or Ctrl-click)* | Place, open a chest, **draw the bow**, or **drink/throw a potion** |
| `I` | Backpack |
| `M` | Toggle the map overlay |
| Hover | Tooltip naming the block, mob, or structure under the cursor |
| `G` | Cycle survival → creative → spectator |
| `B` | Travel to any biome or structure (creative / spectator) |
| `E` | Block palette (creative) |
| `F3` | Debug overlay |

Stand in a portal for a moment to change realm.

## Modes

| Mode | Movement | World |
| --- | --- | --- |
| Survival | Walk, jump, swim | Mine and place, blocks cost inventory |
| Creative | Fly | Instant mining, infinite blocks, longer reach |
| Spectator | Fly through blocks | Look only — no mining, placing or targeting |

Only survival takes damage; creative and spectator are invulnerable.

## Day and night

A full cycle runs ten minutes: sunrise, day, sunset, night, with a sun, a moon
and stars crossing the sky. It is not just a tint — **nothing hostile spawns
on the open surface in daylight**, and after dark the surface accepts the same
mobs a cave does. Caves stay dangerous around the clock, and the Nether and
End have no cycle at all.

## Map

`M` toggles a corner overlay showing ~200 × 112 blocks around you: terrain,
caves, mobs coloured by behaviour, structures in gold and portals in violet.
Terrain is resampled four times a second onto a coarse buffer rather than
drawn per block — at 4096 wide a faithful map would cost more than the game.

## Portals

Build a frame of obsidian at least 2 wide and 3 tall and light the inside with
**flint and steel**. Portals pair up: the far side is built for you if there
isn't one nearby, and the return trip lands where you started rather than
drifting a little further each crossing. Flint and steel is in the starter
kit, in several loot tables, and gravel drops flint.

## Mobs and combat

47 mobs spawn into the biomes they belong in — pigs and bees in the plains,
husks and rabbits in the desert, dolphins and drowned in the ocean, frogs and
witches in the swamp, polar bears and strays in the snow, axolotls and glow
squid in the lush caves, wardens in the deep dark, piglins and ghasts in the
Nether, endermen and shulkers in the End.

- **Passive** (16) wander, and flee when hit.
- **Neutral** (11) ignore you until provoked, then fight back.
- **Hostile** (20) hunt you on sight, and some shoot: skeletons and strays fire
  arrows, ghasts and blazes fire fireballs, witches throw splash potions.

Spawning follows the player's depth, so digging down changes what you meet
rather than filling the surface far above you, and the time of day decides
whether the surface is safe.

Combat: six sword tiers (4–8 damage, 1 bare-handed), a bow that charges while
you hold right click, and six potions — healing, regeneration, strength,
swiftness, fire resistance, and a thrown splash potion of harming. Projectiles
solve their own launch angle, so a shot aimed at a mob connects rather than
dropping at its feet. Fall damage and lava both hurt; dying respawns you in the
Overworld.

Mob drops go to the hotbar, overflowing into an 18-slot backpack (`I`).

## Layout

```
index.html        markup + HUD shell
css/style.css     HUD, hotbar, start overlay
js/
  config.js       all tuning constants (tile size, physics, world size)
  blocks.js       block registry: ids, hardness, drops, colours
  textures.js     procedural pixel textures baked to offscreen canvases
  world.js        world grid + terrain generation (noise, caves, ores, trees)
  player.js       AABB physics, collision, jump feel
  input.js        keyboard/mouse state
  renderer.js     camera, visible-tile drawing, block highlight
  inventory.js    hotbar slots
  hud.js          hotbar DOM + debug readout
  main.js         wiring, fixed-timestep game loop
```

## Design notes

- **World** is a flat `Uint8Array` of block ids, `WORLD_W × WORLD_H`. Block ids
  are stable numbers so the array stays cheap to store and serialize later.
- **Terrain** comes from layered 1-D value noise on a seeded PRNG — same seed,
  same world. Caves are carved where two offset noise fields agree; ores are
  random-walk veins with depth thresholds.
- **Physics** runs at a fixed 120 Hz step, decoupled from render, with
  axis-separated AABB collision. Coyote time and jump buffering make the
  controls forgiving.
- **Rendering** only touches tiles inside the camera view, so world size doesn't
  affect frame cost.

## Structures

18 structures generate into the biomes and realms they belong in, each drawn
in cross-section:

| Where | Structures |
| --- | --- |
| Surface | Village (oak/acacia/spruce/sandstone by biome), Desert Pyramid, Jungle Temple, Swamp Hut, Woodland Mansion, Pillager Outpost, Ruined Portal |
| Water | Shipwreck, Ocean Monument, Buried Treasure |
| Underground | Mineshaft, Dungeon, Amethyst Geode, Stronghold (with a library and an End portal room), Ancient City |
| Nether | Nether Fortress, Bastion Remnant |
| End | End City |

Placement walks the world in cells so structures of a kind stay apart, and
terrain under a surface structure is levelled the way Minecraft terraforms
under a village — including the terrain baseline the renderer shades from.

In creative or spectator, `B` opens the Travel panel: every biome, plus every
structure that generated, grouped by realm with a count. Clicking a structure
takes you to one; clicking it again goes to the next, so all nine dungeons are
reachable from one chip. You land somewhere you actually fit — inside the
structure where there's room, on the surface above it when there isn't
(buried treasure is a chest inside a block of sand).

**Chests** roll a loot table the first time you right-click them (18 tables,
one per structure) and keep whatever doesn't fit in your inventory.
**Spawners** run only while you're within 22 blocks and cap the mobs they've
made nearby, so a dungeon doesn't eat the whole population budget.

## Layout additions

```
js/items.js      swords, bow, arrows, potions, mob drops (ids >= 256)
js/mobs.js       mob registry: stats, biomes, behaviour, palettes
js/entities.js   mob AI, projectiles, ballistics, spawning
js/physics.js    shared AABB sweep used by the player and every mob
js/structures.js structure registry, cross-section builders, placement
js/loot.js       per-structure chest loot tables
js/minimap.js    corner map overlay
```

## Not built yet

Crafting, tool tiers, hunger, world save/load, chunked streaming, sound,
breeding/taming. The Ender Dragon exists and fights, but has no boss mechanics
— no perches, healing crystals, or end-of-fight sequence.
