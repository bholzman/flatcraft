import { AIR, PLACEABLE, block } from './blocks.js';
import { BIOMES, LAYOUTS } from './biomes.js';
import { swatchDataURL } from './textures.js';
import { HOTBAR_SIZE } from './inventory.js';

const REALM_LABEL = { overworld: 'Overworld', nether: 'Nether', end: 'The End' };

export class HUD {
  constructor(game) {
    this.game = game;
    this.inventory = game.inventory;

    this.hotbarEl = document.getElementById('hotbar');
    this.debugEl = document.getElementById('debug');
    this.toastEl = document.getElementById('toast');
    this.modeEl = document.getElementById('mode');
    this.biomesEl = document.getElementById('biomes');
    this.paletteEl = document.getElementById('palette');
    this.toastTimer = null;
    this.showDebug = false;
    this.debugEl.classList.add('hidden');

    this.buildHotbar();
    this.buildBiomePanel();
    this.buildPalette();

    this.inventory.onChange = () => this.renderHotbar();
    this.renderHotbar();
    this.renderMode();
  }

  // ---- hotbar ----

  buildHotbar() {
    this.slotEls = [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = `<span class="key">${i + 1}</span>`
        + '<img class="swatch" alt="">'
        + '<span class="count"></span>';
      el.addEventListener('mousedown', () => this.inventory.select(i));
      this.hotbarEl.appendChild(el);
      this.slotEls.push(el);
    }
  }

  renderHotbar() {
    const infinite = this.inventory.infinite;
    this.inventory.slots.forEach((slot, i) => {
      const el = this.slotEls[i];
      el.classList.toggle('selected', i === this.inventory.selected);

      const img = el.querySelector('.swatch');
      const count = el.querySelector('.count');

      if (slot.count > 0 && slot.id !== AIR) {
        img.src = swatchDataURL(slot.id);
        img.style.visibility = 'visible';
        img.title = block(slot.id).name;
        count.textContent = infinite ? '∞' : slot.count;
      } else {
        img.style.visibility = 'hidden';
        count.textContent = '';
      }
    });
  }

  // ---- creative panels ----

  /** Every biome in every realm, as a jump list. */
  buildBiomePanel() {
    const frag = document.createDocumentFragment();

    for (const realm of Object.keys(LAYOUTS)) {
      const layout = LAYOUTS[realm];
      const ids = [...new Set([...layout.outward, ...layout.center])];

      // Overworld also owns the depth-banded cave biomes.
      if (realm === 'overworld') ids.push('caves', 'lush_caves', 'deep_dark');

      const group = document.createElement('div');
      group.className = 'group';
      group.innerHTML = `<h3>${REALM_LABEL[realm]}</h3>`;

      const row = document.createElement('div');
      row.className = 'chips';
      for (const id of ids) {
        const bi = BIOMES[id];
        if (!bi) continue;
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.textContent = bi.name;
        btn.addEventListener('click', () => {
          this.game.jumpToBiome(realm, id);
          this.toggleBiomes(false);
        });
        row.appendChild(btn);
      }
      group.appendChild(row);
      frag.appendChild(group);
    }

    this.biomesEl.querySelector('.body').appendChild(frag);
    this.biomesEl.querySelector('.close').addEventListener('click', () => this.toggleBiomes(false));
  }

  /** Every placeable block, click to load it into the selected hotbar slot. */
  buildPalette() {
    const grid = document.createElement('div');
    grid.className = 'grid';

    for (const id of PLACEABLE) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.title = block(id).name;
      cell.innerHTML = `<img src="${swatchDataURL(id)}" alt=""><span>${block(id).name}</span>`;
      cell.addEventListener('click', () => {
        this.inventory.setSelected(id, 64);
        this.announce(block(id).name);
      });
      grid.appendChild(cell);
    }

    this.paletteEl.querySelector('.body').appendChild(grid);
    this.paletteEl.querySelector('.close').addEventListener('click', () => this.togglePalette(false));
  }

  toggleBiomes(force) {
    const show = force ?? this.biomesEl.classList.contains('hidden');
    this.biomesEl.classList.toggle('hidden', !show);
    if (show) this.togglePalette(false);
  }

  togglePalette(force) {
    const show = force ?? this.paletteEl.classList.contains('hidden');
    this.paletteEl.classList.toggle('hidden', !show);
    if (show) this.toggleBiomes(false);
  }

  anyPanelOpen() {
    return !this.biomesEl.classList.contains('hidden')
      || !this.paletteEl.classList.contains('hidden');
  }

  // ---- readouts ----

  renderMode() {
    const mode = this.game.mode;
    this.modeEl.textContent = mode.toUpperCase();
    this.modeEl.classList.toggle('creative', mode === 'creative');
    this.modeEl.classList.toggle('spectator', mode === 'spectator');
    // A spectator can't place anything, so the hotbar is just clutter.
    this.hotbarEl.classList.toggle('hidden', mode === 'spectator');
    this.renderHotbar();
  }

  /** Brief centred message, e.g. when the player changes realm. */
  announce(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2200);
  }

  toggleDebug() {
    this.showDebug = !this.showDebug;
    this.debugEl.classList.toggle('hidden', !this.showDebug);
  }

  renderDebug(lines) {
    if (this.showDebug) this.debugEl.textContent = lines.join('\n');
  }
}
