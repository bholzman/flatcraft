// Block debris: small square chips thrown off a block as it's struck and when
// it breaks. Purely visual -- they fall through the world and fade out, so
// there's no collision to pay for.

import { block } from './blocks.js';

const GRAVITY = 30;          // blocks/s^2, a little floatier than the player
const MAX = 400;             // creative can break a block a frame; cap the pile

export class Particles {
  constructor() {
    this.list = [];
  }

  clear() {
    this.list.length = 0;
  }

  /**
   * Chips from block `id` at cell (bx, by). `fromX/fromY` is where the blow
   * came from, so chips spray back out of the face that was hit.
   */
  debris(id, bx, by, fromX, fromY, count, force = 1) {
    const def = block(id);
    const colours = [def.tint, def.tint];
    if (def.speckle) colours.push(def.speckle);   // ores flash their mineral

    const cx = bx + 0.5;
    const cy = by + 0.5;
    const len = Math.hypot(fromX - cx, fromY - cy) || 1;
    const nx = (fromX - cx) / len;
    const ny = (fromY - cy) / len;

    for (let i = 0; i < count; i++) {
      if (this.list.length >= MAX) this.list.shift();
      const spread = (Math.random() - 0.5) * 2.2;
      const speed = (2.5 + Math.random() * 4) * force;
      this.list.push({
        x: cx + nx * 0.45 + (Math.random() - 0.5) * 0.5,
        y: cy + ny * 0.45 + (Math.random() - 0.5) * 0.5,
        vx: (nx - ny * spread) * speed,
        vy: (ny + nx * spread) * speed - 3 * force,
        size: 0.07 + Math.random() * 0.09,
        colour: colours[(Math.random() * colours.length) | 0],
        life: 0.35 + Math.random() * 0.35,
        age: 0,
      });
    }
  }

  update(dt) {
    const out = this.list;
    let n = 0;
    for (const p of out) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += GRAVITY * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      out[n++] = p;
    }
    out.length = n;
  }
}
