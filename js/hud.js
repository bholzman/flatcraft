import { AIR, block } from './blocks.js';
import { swatchDataURL } from './textures.js';
import { HOTBAR_SIZE } from './inventory.js';

export class HUD {
  constructor(inventory) {
    this.inventory = inventory;
    this.hotbarEl = document.getElementById('hotbar');
    this.debugEl = document.getElementById('debug');
    this.showDebug = false;
    this.debugEl.classList.add('hidden');

    this.slotEls = [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = `<span class="key">${i + 1}</span>`
        + '<img class="swatch" alt="">'
        + '<span class="count"></span>';
      el.addEventListener('mousedown', () => inventory.select(i));
      this.hotbarEl.appendChild(el);
      this.slotEls.push(el);
    }

    inventory.onChange = () => this.renderHotbar();
    this.renderHotbar();
  }

  renderHotbar() {
    this.inventory.slots.forEach((slot, i) => {
      const el = this.slotEls[i];
      el.classList.toggle('selected', i === this.inventory.selected);

      const img = el.querySelector('.swatch');
      const count = el.querySelector('.count');

      if (slot.count > 0 && slot.id !== AIR) {
        img.src = swatchDataURL(slot.id);
        img.style.visibility = 'visible';
        img.title = block(slot.id).name;
        count.textContent = slot.count;
      } else {
        img.style.visibility = 'hidden';
        count.textContent = '';
      }
    });
  }

  toggleDebug() {
    this.showDebug = !this.showDebug;
    this.debugEl.classList.toggle('hidden', !this.showDebug);
  }

  renderDebug(lines) {
    if (this.showDebug) this.debugEl.textContent = lines.join('\n');
  }
}
