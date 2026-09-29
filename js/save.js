import { REALMS, START_REALM } from './config.js';
import { AIR } from './blocks.js';

// The game, saved to localStorage. Worlds aren't stored whole: each one
// regenerates from the seed and the save holds only what's changed since (see
// World.changes). The player, inventory and clock are stored outright. Mobs
// aren't saved at all; a reloaded world repopulates.

const KEY = 'flatcraft:save';
const VERSION = 1;

/** The saved game, or null if there isn't one this build can read. */
export function loadSave() {
  try {
    const save = JSON.parse(localStorage.getItem(KEY));
    return save?.v === VERSION ? save : null;
  } catch {
    return null;
  }
}

/** Write the game out; false if the browser wouldn't take it (full, or disabled). */
export function writeSave(game) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot(game)));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/** Keep a save that failed to load out of the way, rather than losing it. */
export function setAsideSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) localStorage.setItem(`${KEY}:unreadable`, raw);
    localStorage.removeItem(KEY);
  } catch { /* nothing to set aside */ }
}

function snapshot(game) {
  // A portal's link is its far end, which lives in another realm's list.
  const links = [];
  for (const [realm, world] of Object.entries(game.worlds)) {
    world.portals.forEach((p, i) => {
      const to = p.link && findPortal(game.worlds, p.link);
      if (to) links.push([realm, i, ...to]);
    });
  }

  const worlds = {};
  for (const [realm, world] of Object.entries(game.worlds)) {
    const c = world.changes();
    if (c) worlds[realm] = { cells: toBase64(c.cells), data: c.data, portals: c.portals };
    // A link needs both ends generated on load, even an end nothing changed in.
    else if (links.some((l) => l[0] === realm || l[2] === realm)) worlds[realm] = null;
  }

  const p = game.player;
  const inv = game.inventory;
  const stacks = (slots) => slots.map((s) => [s.id, s.count]);

  return {
    v: VERSION,
    seed: game.seed,
    mode: game.mode,
    worldTime: game.worldTime,
    timeFrozen: game.timeFrozen,
    // Dead and waiting to respawn? Then save them where they're about to be.
    realm: p.dead ? START_REALM : game.realm,
    player: p.dead ? null : {
      x: p.x, y: p.y, facing: p.facing,
      health: p.health, air: p.air, onFire: p.onFire, effects: p.effects,
    },
    inventory: { slots: stacks(inv.slots), storage: stacks(inv.storage), selected: inv.selected },
    worlds,
    links,
  };
}

function findPortal(worlds, portal) {
  for (const [realm, world] of Object.entries(worlds)) {
    const i = world.portals.indexOf(portal);
    if (i >= 0) return [realm, i];
  }
  return null;
}

/** Load a save into a game freshly made from the save's seed. */
export function restoreGame(game, save) {
  for (const [realm, w] of Object.entries(save.worlds)) {
    if (!REALMS[realm]) continue;
    const world = game.getWorld(realm);
    if (w) world.restore({ cells: fromBase64(w.cells), data: w.data, portals: w.portals });
  }
  for (const [fromRealm, from, toRealm, to] of save.links) {
    const a = game.worlds[fromRealm]?.portals[from];
    const b = game.worlds[toRealm]?.portals[to];
    if (a && b) a.link = b;
  }

  const inv = game.inventory;
  const fill = (slots, saved) => slots.forEach((s, i) => {
    [s.id, s.count] = saved[i] ?? [AIR, 0];
  });
  fill(inv.slots, save.inventory.slots);
  fill(inv.storage, save.inventory.storage);
  inv.selected = save.inventory.selected;
  inv.changed();

  game.worldTime = save.worldTime;
  game.timeFrozen = save.timeFrozen;

  game.realm = REALMS[save.realm] ? save.realm : START_REALM;
  game.world = game.getWorld(game.realm);
  const p = game.player;
  const s = save.player;
  p.enter(game.world, s ?? game.world.spawnPoint(game.world.spawnX));
  if (s) {
    p.facing = s.facing;
    p.health = s.health;
    p.air = s.air;
    p.onFire = s.onFire;
    p.effects = s.effects;
  }

  // Sets flight and noclip to match, and digs the player out if the world
  // around them has somehow filled in.
  game.setMode(save.mode);
  game.renderer.snapTo(p);
  game.travelLock = true;     // saved standing in a portal shouldn't mean leaving
}

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function fromBase64(text) {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
