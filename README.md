# Flatcraft

A simplified 2-D Minecraft in the browser. Vanilla JS + `<canvas>`, ES modules,
no build step and no dependencies.

## Running

ES modules need to be served over HTTP (opening `index.html` directly will fail
on CORS). Any static server works:

```sh
npx serve .          # or:
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Controls

| Input | Action |
| --- | --- |
| `A` / `D` (or arrows) | Move |
| `Space` / `W` | Jump (hold for higher) |
| Left click | Mine the highlighted block |
| Right click | Place the selected block |
| `1`–`9` / scroll | Select hotbar slot |
| `F3` | Debug overlay |

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

## Not built yet

Crafting, tools/tool tiers, mobs, health/hunger, day–night, world save/load,
chunked streaming, sound.
