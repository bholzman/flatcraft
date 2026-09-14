import { AIR, PLACEABLE, block } from './blocks.js';

export const HOTBAR_SIZE = 9;

/** A flat hotbar of {id, count} slots. No crafting grid yet. */
export class Inventory {
  constructor() {
    this.slots = Array.from({ length: HOTBAR_SIZE }, () => ({ id: AIR, count: 0 }));
    this.selected = 0;
    this.infinite = false;   // creative mode: placing never depletes a slot
    this.onChange = null;
  }

  get held() {
    return this.slots[this.selected];
  }

  select(i) {
    this.selected = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.changed();
  }

  scroll(delta) {
    this.select(this.selected + delta);
  }

  add(id, count = 1) {
    if (id === AIR) return true;

    const existing = this.slots.find((s) => s.id === id && s.count > 0);
    if (existing) {
      existing.count += count;
      this.changed();
      return true;
    }

    const empty = this.slots.find((s) => s.count === 0);
    if (!empty) return false;

    empty.id = id;
    empty.count = count;
    this.changed();
    return true;
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

  /** Starter kit so there's something to build with before mining. */
  giveStarter() {
    for (const id of PLACEABLE.slice(0, 4)) this.add(id, 16);
  }

  changed() {
    this.onChange?.(this);
  }

  describeSelected() {
    const s = this.held;
    return s.count > 0 ? `${block(s.id).name} x${s.count}` : 'empty';
  }
}
