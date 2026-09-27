import { AIR, FIRE, TNT, WATER, block, isSolid, isDecoration } from './blocks.js';

// Fire and lit TNT. Both live on the world (`world.fires`, `world.primed`) and
// only tick for the realm the player is in.

const TICK = 0.25;           // seconds between one fire's turns
const MAX_FIRES = 600;       // a forest fire can burn a forest, not the whole world
const TNT_FUSE = 4;          // seconds from lighting to the bang
const TNT_POWER = 4;
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const flammability = (id) => block(id).flammable ?? 0;

function nearFuel(world, x, y) {
  return SIDES.some(([dx, dy]) => flammability(world.get(x + dx, y + dy)) > 0);
}

/** Fire needs somewhere to sit: a solid floor, or something beside it to burn. */
function supported(world, x, y) {
  return isSolid(world.get(x, y + 1)) || nearFuel(world, x, y);
}

/**
 * Start a fire in cell (x, y) if it can hold one: open air (or a tuft of
 * something that burns) with a floor or fuel beside it. Returns true if lit.
 */
export function ignite(world, x, y) {
  if (!world.inBounds(x, y) || world.fires.size >= MAX_FIRES) return false;
  const id = world.get(x, y);
  if (id !== AIR && !(isDecoration(id) && flammability(id) > 0)) return false;
  if (!supported(world, x, y)) return false;
  world.set(x, y, FIRE);
  return true;
}

/** Light a TNT block; `fuse` is shorter when a blast sets it off. */
export function primeTnt(world, x, y, fuse = TNT_FUSE) {
  const key = `${x},${y}`;
  if (world.get(x, y) !== TNT || world.primed.has(key)) return;
  world.primed.set(key, { x, y, fuse });
}

/**
 * Each fire in turn: water puts it out; it eats what burns beside it, leaps
 * to open air near more fuel (mostly upward -- heat rises), and burns out
 * unless it sits on netherrack.
 */
export function tickFires(world, dt) {
  for (const [key, f] of [...world.fires]) {
    f.wait -= dt;
    if (f.wait > 0) continue;
    f.wait = TICK * (0.6 + Math.random() * 0.8);
    f.age += TICK;
    const { x, y } = f;

    if (SIDES.some(([dx, dy]) => world.get(x + dx, y + dy) === WATER)) {
      world.set(x, y, AIR);
      continue;
    }

    for (const [dx, dy] of SIDES) {
      const nx = x + dx;
      const ny = y + dy;
      const id = world.get(nx, ny);
      const rate = flammability(id);
      if (!rate || Math.random() > rate * TICK) continue;
      if (id === TNT) primeTnt(world, nx, ny);
      else if (world.fires.size < MAX_FIRES && Math.random() < 0.6) world.set(nx, ny, FIRE);
      else world.set(nx, ny, AIR);
    }

    const sx = x + Math.floor(Math.random() * 3) - 1;
    const sy = y + Math.floor(Math.random() * 4) - 2;
    if (Math.random() < 0.3 && nearFuel(world, sx, sy)) ignite(world, sx, sy);

    if (!world.fires.has(key)) continue;           // already burnt away above
    const eternal = block(world.get(x, y + 1)).eternalFire;
    if (!eternal && (f.age > f.life || !supported(world, x, y))) world.set(x, y, AIR);
  }
}

/** Count down lit TNT; `explode(x, y, power)` does the rest. */
export function tickTnt(world, dt, explode) {
  for (const [key, t] of [...world.primed]) {
    if (world.get(t.x, t.y) !== TNT) { world.primed.delete(key); continue; }   // mined out
    t.fuse -= dt;
    if (t.fuse > 0) continue;
    world.primed.delete(key);
    world.set(t.x, t.y, AIR);
    explode(t.x + 0.5, t.y + 0.5, TNT_POWER);
  }
}
