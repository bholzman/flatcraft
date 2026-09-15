import { isSolid } from './blocks.js';

// Shared AABB physics for anything that walks around: the player and every mob.
// Bodies use the same convention throughout: `x` is centre-x, `y` is the top
// edge, both in blocks.

export function boxOf(body) {
  return {
    left: body.x - body.w / 2,
    right: body.x + body.w / 2,
    top: body.y,
    bottom: body.y + body.h,
  };
}

/** True if the body's box overlaps any solid block. */
export function collides(body, world) {
  const b = boxOf(body);
  const x0 = Math.floor(b.left);
  const x1 = Math.floor(b.right - 1e-9);
  const y0 = Math.floor(b.top);
  const y1 = Math.floor(b.bottom - 1e-9);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (isSolid(world.get(x, y))) return true;
    }
  }
  return false;
}

/**
 * Axis-separated sweep so corners resolve predictably. Zeroes the velocity on
 * whichever axis hit something and reports whether the body landed.
 */
export function sweep(body, world, dx, dy) {
  body.x += dx;
  if (collides(body, world)) {
    const b = boxOf(body);
    if (dx > 0) body.x = Math.floor(b.right) - body.w / 2 - 1e-6;
    else if (dx < 0) body.x = Math.ceil(b.left) + body.w / 2 + 1e-6;
    body.vx = 0;
    body.blockedX = true;
  } else {
    body.blockedX = false;
  }

  body.y += dy;
  body.onGround = false;
  if (collides(body, world)) {
    const b = boxOf(body);
    if (dy > 0) {
      body.y = Math.floor(b.bottom) - body.h - 1e-6;
      body.onGround = true;
    } else if (dy < 0) {
      body.y = Math.ceil(b.top) + 1e-6;
    }
    body.vy = 0;
  }

  // A block placed under a standing body still counts as ground.
  if (!body.onGround && body.vy >= 0) {
    body.y += 0.02;
    if (collides(body, world)) body.onGround = true;
    body.y -= 0.02;
  }
}

/** Every distinct block id the body's box overlaps. */
export function occupiedBlocks(body, world) {
  const ids = new Set();
  const b = boxOf(body);
  const x0 = Math.floor(b.left);
  const x1 = Math.floor(b.right - 1e-9);
  const y0 = Math.floor(b.top);
  const y1 = Math.floor(b.bottom - 1e-9);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) ids.add(world.get(x, y));
  }
  return ids;
}

/** Straight-line visibility between two points, sampled per half block. */
export function lineOfSight(world, x0, y0, x1, y1, maxDist = 24) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  if (dist > maxDist) return false;

  const steps = Math.ceil(dist * 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolid(world.get(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t)))) return false;
  }
  return true;
}
