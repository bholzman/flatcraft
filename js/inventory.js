import { AIR, PLACEABLE } from './blocks.js';
import * as I from './items.js';

export const HOTBAR_SIZE = 9;
export const STORAGE_SIZE = 18;

/**
 * Nine hotbar slots plus a backpack behind them. Mob drops overflow into the
 * backpack rather than being thrown away when the hotbar is full.
 */
export class Inventory {
  constructor() {
    this.slots = Array.from({ length: HOTBAR_SIZE }, () => ({ id: AIR, count: 0 }));
    this.storage = Array.from({ length: STORAGE_SIZE }, () => ({ id: AIR, count: 0 }));
    this.selected = 0;
    this.infinite = false;   // creative mode: placing never depletes a slot
    this.onChange = null;
  }

  get held() {
    return this.slots[this.selected];
  }

  /** Hotbar first, then backpack -- the order `add` fills them in. */
  get everySlot() {
    return [...this.slots, ...this.storage];
  }

  select(i) {
    this.selected = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.changed();
  }

  scroll(delta) {
    this.select(this.selected + delta);
  }

  add(id, count = 1) {
    if (id === AIR || count <= 0) return true;
    const max = I.stackSize(id);
    let left = count;

    // Top up existing stacks first, then take empty slots, hotbar before pack.
    const all = this.everySlot;
    for (const s of all) {
      if (left <= 0) break;
      if (s.id === id && s.count > 0 && s.count < max) {
        const take = Math.min(max - s.count, left);
        s.count += take;
        left -= take;
      }
    }
    for (const s of all) {
      if (left <= 0) break;
      if (s.count === 0) {
        s.id = id;
        s.count = Math.min(max, left);
        left -= s.count;
      }
    }

    this.changed();
    return left === 0;
  }

  /** Take `count` of `id` from anywhere in the bar; false if there wasn't enough. */
  remove(id, count = 1) {
    if (this.infinite) return true;
    if (this.total(id) < count) return false;

    let left = count;
    for (const s of this.everySlot) {
      if (left <= 0) break;
      if (s.id !== id || s.count === 0) continue;
      const take = Math.min(s.count, left);
      s.count -= take;
      left -= take;
      if (s.count === 0) s.id = AIR;
    }
    this.changed();
    return true;
  }

  /** Is there room for `count` of `id` without dropping any? */
  fits(id, count) {
    const max = I.stackSize(id);
    let room = 0;
    for (const s of this.everySlot) {
      if (s.count === 0) room += max;
      else if (s.id === id) room += Math.max(0, max - s.count);
      if (room >= count) return true;
    }
    return false;
  }

  total(id) {
    return this.everySlot.reduce((n, s) => n + (s.id === id ? s.count : 0), 0);
  }

  /** Swap a backpack slot with the selected hotbar slot. */
  swapWithHeld(storageIndex) {
    const a = this.storage[storageIndex];
    const b = this.held;
    const tmp = { id: a.id, count: a.count };
    a.id = b.id; a.count = b.count;
    b.id = tmp.id; b.count = tmp.count;
    this.changed();
  }

  /** Consume one of the selected slot; returns the id used, or AIR. */
  takeSelected() {
    const slot = this.held;
    if (slot.count <= 0) return AIR;
    if (this.infinite) return slot.id;

    const id = slot.id;
    slot.count -= 1;
    if (slot.count === 0) slot.id = AIR;
    this.changed();
    return id;
  }

  /** Drop `id` straight into the selected slot, replacing what's there. */
  setSelected(id, count = 1) {
    const slot = this.held;
    slot.id = id;
    slot.count = count;
    this.changed();
  }

  /** Starter kit: enough to build with, and enough to defend yourself. */
  giveStarter() {
    this.add(I.WOODEN_SWORD, 1);
    this.add(I.BOW, 1);
    this.add(I.ARROW, 16);
    this.add(I.POTION_HEALING, 2);
    this.add(I.FLINT_AND_STEEL, 1);
    for (const id of PLACEABLE.slice(0, 4)) this.add(id, 16);
  }

  changed() {
    this.onChange?.(this);
  }

  describeSelected() {
    const s = this.held;
    return s.count > 0 ? `${I.nameOf(s.id)} x${s.count}` : 'empty';
  }
}
