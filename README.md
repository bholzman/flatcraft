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
| Right click *(or Ctrl-click)* | Place, open a chest, **draw the bow**, **drink/throw a potion**, or **start a fire / light TNT** with flint and steel |
| Right click a mob | Trade with a villager, tame a wolf (holding a bone), barter with a piglin (holding gold), light a creeper (flint and steel) |
| `C` | Crafting |
| `I` | Backpack |
| `M` | Toggle the map overlay |
| Hover | Tooltip naming the block, mob, or structure under the cursor |
| `G` | Cycle survival → creative → spectator |
| `B` | Travel to any biome or structure, set the time (creative / spectator) |
| `E` | Block palette with search (creative) |
| `F3` | Debug overlay |

Stand in a portal for a moment to change realm.

## Modes

| Mode | Movement | World |
| --- | --- | --- |
| Survival | Walk, jump, swim | Mine and place, blocks cost inventory |
| Creative | Fly | Instant mining, infinite blocks, longer reach |
| Spectator | Fly through blocks | Look only — no mining, placing or targeting |

Only survival takes damage; creative and spectator are invulnerable -- except
to the void, which kills in every mode. The void is past either side edge of
every realm, and in the End it has a floor 10 blocks under the lowest island.

Generated trees are solid to build against but walk-through for the player,
mobs and arrows; a log you place yourself is an ordinary wall. Doors let the
player through but stop mobs. With your head under water you have 15 seconds
of air, then drown a heart a second; you can still jump off the bottom or out
of the surface onto a ledge.

## Crafting

`C` opens the recipe book: 70 recipes across wood, building, snow, light,
combat, brewing and smelting. Each row shows what it makes, what it needs with
have/need counts, and why it isn't available yet. **Craft** makes one, **x8**
makes a batch, and a filter hides everything you can't currently make.

Minecraft's constraints are kept even though the placement grid isn't: small
recipes work anywhere, bigger ones need a **crafting table** within four
blocks, and smelting needs a **furnace**. Furnaces hold a burn buffer — a coal
is worth eight smelts and the remainder stays in that furnace. It's a recipe
book rather than a 3x3 grid because drag-and-drop into a grid doesn't survive
contact with a browser and one mouse button.

Ores now drop their material, so the chain works: coal ore gives coal, iron
ore smelts to an ingot, and log → planks → sticks → sword runs end to end.

## Day and night

A full cycle runs ten minutes: sunrise, day, sunset, night, with a sun, a moon
and stars crossing the sky. The Travel panel (`B`, creative or spectator) sets
it: seven named phases, a slider for anything between, a **Hold** that stops
the clock where you put it, and a live readout. It is not just a tint — **nothing hostile spawns
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

## Fire

Flint and steel sets fire to the spot you click, or to the top of the block you
click, and lights TNT. Fire eats planks, logs, leaves, wool, hay, bookshelves
and plants, leaps to open air near more fuel (mostly upward, so trees go up
fast), and burns out after a few seconds -- except on netherrack and soul sand,
where it burns forever, as it does across the Nether wastes. Water beside a
fire puts it out, and at most 600 fires burn at once, so a forest fire takes a
forest rather than the world.

Standing in fire or lava sets you (or a mob) alight, and you keep burning for a
few seconds after stepping out; jump in water to put it out. Fire resistance
ignores all of it, and Nether mobs don't burn. Blaze fireballs start fires
where they land, ghast blasts leave fire behind, and lit TNT flashes for four
seconds before a blast that sets off any TNT caught in it.

## Mobs and combat

54 mobs spawn into the biomes they belong in — pigs and bees in the plains,
husks and rabbits in the desert, dolphins and drowned in the ocean, frogs and
witches in the swamp, polar bears and strays in the snow, axolotls and glow
squid in the lush caves, wardens in the deep dark, piglins and ghasts in the
Nether, endermen and shulkers in the End, pillager patrols in the open.

- **Passive** (16) wander, and flee when hit.
- **Neutral** (12) ignore you until provoked, then fight back.
- **Hostile** (25) hunt you on sight, and some shoot: skeletons and strays fire
  arrows, pillagers crossbows, ghasts and blazes fireballs, witches splash
  potions, shulkers homing bullets.
- **Guard** (1): the snow golem never turns on you.

Mobs fight each other too. Iron and snow golems attack monsters and illagers;
zombies and illagers hunt villagers, who run from them; wolves hunt sheep,
rabbits and skeletons, and skeletons run from wolves. Stray shots never hurt a
teammate. Each mob has its standard behaviour:

| Mob | Behaviour |
| --- | --- |
| Creeper | Lights a fuse when close, swells and flashes, and explodes — breaking blocks and hurting everything nearby. Walk away in time and it fizzles |
| Enderman | Blinks about, dodges arrows by teleporting, hates water, and turns on you if the cursor rests on it (a stare) |
| Zombie, skeleton, stray, phantom | Burn in daylight under open sky |
| Spider | Neutral by day, hostile at night and underground; climbs walls |
| Cave spider, bee, wither skeleton, stray | Poison, poison, wither, slowness |
| Slime, magma cube | Hop, and split into smaller copies when killed |
| Witch | Drinks a healing potion when hurt |
| Blaze | Fires fireballs in bursts of three |
| Ghast | Fireballs explode on impact |
| Shulker | Homing bullets that levitate you (and then you fall) |
| Warden | Blind: hears you moving or digging through walls; sonic boom ignores walls |
| Phantom | Circles high, then swoops |
| Wolf | Packs defend each other; tame with bones and it follows and fights for you |
| Bee, zombified piglin, piglin | Hit one and the rest join in; a bee dies soon after it stings |
| Piglin | Hostile unless you're holding gold; right-click with a gold ingot to barter |
| Hoglin, iron golem, goat | Launch or ram you |
| Villager | Seven professions, each with its own trades for emeralds |
| Iron golem | Guards villages; turns on you if you hit a villager |
| Snow golem | Throws snowballs (they hurt blazes), leaves snow, melts somewhere hot |
| Pillager, vindicator, evoker, vex, ravager | The illagers. Evokers summon vexes, which fly through walls, and snap fangs along the ground; they drop a Totem of Undying, which saves you from one death while it's in your hotbar |

Build a **snow golem** from two snow blocks topped with a carved pumpkin, and
an **iron golem** from a T of four iron blocks topped with one. Pumpkins grow
wild in plains, meadow, forest and taiga.

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
one per structure), show exactly what you took, and keep whatever doesn't fit.

Villages, outposts, mansions and swamp huts come with their residents —
villagers and an iron golem, pillagers, vindicators and an evoker, a witch —
who appear as you approach.
**Spawners** run only while you're within 22 blocks and cap the mobs they've
made nearby, so a dungeon doesn't eat the whole population budget.

## Layout additions

```
js/items.js      swords, bow, arrows, potions, mob drops (ids >= 256)
js/mobs.js       mob registry: stats, biomes, behaviour, palettes
js/entities.js   mob AI, projectiles, ballistics, spawning
js/physics.js    AABB sweep for mobs (the player has its own: it can pass doors)
js/structures.js structure registry, cross-section builders, placement
js/loot.js       per-structure chest loot tables
js/minimap.js    corner map overlay
js/recipes.js    crafting and smelting recipes, fuel values
```

## Not built yet

Tool tiers, hunger, world save/load, chunked streaming, sound, breeding,
raids. The Ender Dragon exists and fights, but has no boss mechanics
— no perches, healing crystals, or end-of-fight sequence.
