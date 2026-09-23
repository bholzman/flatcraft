import { AIR, PLACEABLE, block, isLiquid, isDecoration } from './blocks.js';
import * as I from './items.js';
import { BIOMES, LAYOUTS } from './biomes.js';
import { phaseName, clockAt } from './config.js';
import { swatchDataURL } from './textures.js';
import { HOTBAR_SIZE, STORAGE_SIZE } from './inventory.js';

const REALM_LABEL = { overworld: 'Overworld', nether: 'Nether', end: 'The End' };

export class HUD {
  constructor(game) {
    this.game = game;
    this.inventory = game.inventory;

    this.hotbarEl = document.getElementById('hotbar');
    this.debugEl = document.getElementById('debug');
    this.toastEl = document.getElementById('toast');
    this.healthEl = document.getElementById('health');
    this.effectsEl = document.getElementById('effects');
    this.modeEl = document.getElementById('mode');
    this.biomesEl = document.getElementById('biomes');
    this.paletteEl = document.getElementById('palette');
    this.packEl = document.getElementById('pack');
    this.tipEl = document.getElementById('tooltip');
    this.toastTimer = null;
    this.showDebug = false;
    this.debugEl.classList.add('hidden');

    this.buildHotbar();
    this.buildPack();
    this.buildBiomePanel();
    this.buildPalette();

    this.inventory.onChange = () => { this.renderHotbar(); this.renderPack(); };
    this.renderHotbar();
    this.renderPack();
    this.renderMode();
    this.lastHearts = -1;
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
        img.title = I.nameOf(slot.id);
        count.textContent = infinite ? '∞' : slot.count;
      } else {
        img.style.visibility = 'hidden';
        count.textContent = '';
      }
    });
  }

  // ---- backpack ----

  buildPack() {
    const grid = this.packEl.querySelector('.body');
    this.packEls = [];
    for (let i = 0; i < STORAGE_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML = '<img class="swatch" alt=""><span class="count"></span>';
      el.addEventListener('mousedown', () => this.inventory.swapWithHeld(i));
      el.title = 'Click to swap with the selected hotbar slot';
      grid.appendChild(el);
      this.packEls.push(el);
    }
    this.packEl.querySelector('.close').addEventListener('click', () => this.togglePack(false));
  }

  renderPack() {
    if (!this.packEls) return;
    this.inventory.storage.forEach((slot, i) => {
      const el = this.packEls[i];
      const img = el.querySelector('.swatch');
      const count = el.querySelector('.count');
      if (slot.count > 0 && slot.id !== AIR) {
        img.src = swatchDataURL(slot.id);
        img.style.visibility = 'visible';
        el.title = I.nameOf(slot.id);
        count.textContent = slot.count;
      } else {
        img.style.visibility = 'hidden';
        count.textContent = '';
      }
    });
  }

  togglePack(force) {
    const show = force ?? this.packEl.classList.contains('hidden');
    this.packEl.classList.toggle('hidden', !show);
    if (show) { this.toggleBiomes(false); this.togglePalette(false); }
  }

  // ---- creative panels ----

  /** Every biome in every realm, as a jump list. */
  buildBiomePanel() {
    const body = this.biomesEl.querySelector('.body');

    this.buildTimePanel(body);

    const frag = document.createDocumentFragment();

    const biomeHead = document.createElement('h4');
    biomeHead.className = 'section';
    biomeHead.textContent = 'Biomes';
    frag.appendChild(biomeHead);

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

    body.appendChild(frag);

    // Structures are per-world, so this section is filled in each time the
    // panel opens rather than baked once at startup.
    const structHead = document.createElement('h4');
    structHead.className = 'section';
    structHead.textContent = 'Structures';
    body.appendChild(structHead);

    this.structuresEl = document.createElement('div');
    body.appendChild(this.structuresEl);

    this.biomesEl.querySelector('.close').addEventListener('click', () => this.toggleBiomes(false));
  }

  /**
   * Time of day: named phases for the usual ones, a slider for anything in
   * between, and a hold so a time you set doesn't drift while you look at it.
   */
  buildTimePanel(body) {
    const head = document.createElement('h4');
    head.className = 'section';
    head.textContent = 'Time of day';
    body.appendChild(head);

    const group = document.createElement('div');
    group.className = 'group';

    const row = document.createElement('div');
    row.className = 'chips';
    const PHASES = [
      ['Sunrise', 0.02], ['Morning', 0.14], ['Noon', 0.25], ['Afternoon', 0.36],
      ['Sunset', 0.48], ['Night', 0.6], ['Midnight', 0.75],
    ];
    for (const [label, phase] of PHASES) {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = label;
      // Stays open: setting a time is something you tend to do a few times.
      btn.addEventListener('click', () => this.game.setTimeOfDay(phase));
      row.appendChild(btn);
    }
    group.appendChild(row);

    const controls = document.createElement('div');
    controls.className = 'time-row';

    this.timeSlider = document.createElement('input');
    this.timeSlider.type = 'range';
    this.timeSlider.min = '0';
    this.timeSlider.max = '1000';
    this.timeSlider.step = '1';
    this.timeSlider.addEventListener('input', () => {
      this.game.setTimeOfDay(Number(this.timeSlider.value) / 1000);
    });

    const hold = document.createElement('label');
    hold.className = 'time-hold';
    this.timeHold = document.createElement('input');
    this.timeHold.type = 'checkbox';
    this.timeHold.addEventListener('change', () => {
      this.game.timeFrozen = this.timeHold.checked;
    });
    hold.appendChild(this.timeHold);
    hold.appendChild(document.createTextNode('Hold'));

    this.timeReadout = document.createElement('span');
    this.timeReadout.className = 'time-readout';

    controls.appendChild(this.timeSlider);
    controls.appendChild(hold);
    controls.appendChild(this.timeReadout);
    group.appendChild(controls);
    body.appendChild(group);
  }

  /** Keep the slider and caption in step with a clock that is still running. */
  refreshTime(game) {
    if (!this.timeSlider || this.biomesEl.classList.contains('hidden')) return;

    const phase = game.timeOfDay;
    if (document.activeElement !== this.timeSlider) {
      this.timeSlider.value = String(Math.round(phase * 1000));
    }
    this.timeHold.checked = !!game.timeFrozen;

    const hours = clockAt(phase);
    const text = `${phaseName(phase)} · ${String(Math.floor(hours)).padStart(2, '0')}:`
      + `${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}`
      + `${game.realm === 'overworld' ? '' : ' · no sky here'}`;
    if (text !== this.lastTimeText) {
      this.lastTimeText = text;
      this.timeReadout.textContent = text;
    }
  }

  /** Rebuild the structure chips from whatever the worlds actually generated. */
  refreshStructures() {
    const frag = document.createDocumentFragment();

    for (const { realm, groups } of this.game.structureGroups()) {
      const group = document.createElement('div');
      group.className = 'group';
      group.innerHTML = `<h3>${REALM_LABEL[realm]}</h3>`;

      const row = document.createElement('div');
      row.className = 'chips';
      for (const g of groups) {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.innerHTML = g.count > 1
          ? `${g.name} <span class="count-badge">${g.count}</span>`
          : g.name;
        btn.title = g.count > 1 ? 'Click again for the next one' : g.name;
        btn.addEventListener('click', () => {
          this.game.jumpToStructure(realm, g.id);
          this.toggleBiomes(false);
        });
        row.appendChild(btn);
      }
      group.appendChild(row);
      frag.appendChild(group);
    }

    this.structuresEl.innerHTML = '';
    this.structuresEl.appendChild(frag);
  }

  /** Every placeable block, click to load it into the selected hotbar slot. */
  buildPalette() {
    const grid = document.createElement('div');
    grid.className = 'grid';

    for (const id of [...PLACEABLE, ...I.ALL_ITEMS]) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.title = I.nameOf(id);
      cell.innerHTML = `<img src="${swatchDataURL(id)}" alt=""><span>${I.nameOf(id)}</span>`;
      cell.addEventListener('click', () => {
        this.inventory.setSelected(id, I.stackSize(id));
        this.announce(I.nameOf(id));
      });
      grid.appendChild(cell);
    }

    this.paletteEl.querySelector('.body').appendChild(grid);
    this.paletteEl.querySelector('.close').addEventListener('click', () => this.togglePalette(false));
  }

  toggleBiomes(force) {
    const show = force ?? this.biomesEl.classList.contains('hidden');
    this.biomesEl.classList.toggle('hidden', !show);
    if (show) {
      this.refreshStructures();
      this.refreshTime(this.game);
      this.togglePalette(false);
      this.togglePack(false);
    }
  }

  togglePalette(force) {
    const show = force ?? this.paletteEl.classList.contains('hidden');
    this.paletteEl.classList.toggle('hidden', !show);
    if (show) { this.toggleBiomes(false); this.togglePack(false); }
  }

  anyPanelOpen() {
    return !this.biomesEl.classList.contains('hidden')
      || !this.paletteEl.classList.contains('hidden')
      || !this.packEl.classList.contains('hidden');
  }

  // ---- health & effects ----

  /**
   * Ten hearts, each worth two health. Only rebuilt when the value actually
   * changes, since this runs every frame.
   */
  renderHealth(player, show) {
    this.healthEl.classList.toggle('hidden', !show);
    if (!show) return;

    const hearts = Math.ceil(player.health / 2);
    const half = Math.ceil(player.health) % 2 === 1;
    const key = `${hearts}:${half}:${Math.ceil(player.health)}`;
    if (key === this.lastHearts) return;
    this.lastHearts = key;

    let html = '';
    for (let i = 0; i < player.maxHealth / 2; i++) {
      const full = i < Math.floor(player.health / 2);
      const isHalf = !full && half && i === Math.floor(player.health / 2);
      html += `<span class="heart ${full ? 'full' : isHalf ? 'half' : 'empty'}">&#9829;</span>`;
    }
    this.healthEl.innerHTML = html;
  }

  renderEffects(player) {
    const names = Object.keys(player.effects);
    if (!names.length) {
      if (this.effectsEl.childElementCount) this.effectsEl.innerHTML = '';
      return;
    }
    this.effectsEl.innerHTML = names
      .map((n) => `<span class="effect">${n} ${player.effects[n].time.toFixed(0)}s</span>`)
      .join('');
  }

  /** Caption under the map: where you are, and how deep. */
  renderMinimapLabel(game) {
    if (!game.minimap.visible) return;
    const p = game.player;
    const biome = game.world.biomeAt(p.x, p.y + p.h / 2).name;
    const depth = Math.round(p.y - game.world.ground[
      Math.max(0, Math.min(game.world.width - 1, p.x | 0))]);
    const text = `${biome}  ${p.x | 0}, ${p.y | 0}`;
    if (text !== this.lastMapLabel) {
      this.lastMapLabel = text;
      document.getElementById('minimap-label').textContent = text;
    }
  }

  // ---- hover tooltip ----

  /**
   * Names whatever is under the cursor: a mob, a block, and the structure it
   * belongs to. Rebuilt only when the subject changes, since this runs every
   * frame.
   */
  renderTooltip(info) {
    if (!info || this.anyPanelOpen()) {
      this.tipEl.classList.remove('show');
      this.lastTip = null;
      return;
    }

    const key = info.mob
      ? `mob:${info.mob.eid}:${Math.ceil(info.mob.health)}`
      : `blk:${info.blockId}:${info.bx},${info.by}:${info.structure?.id ?? ''}`;

    if (key !== this.lastTip) {
      this.lastTip = key;
      this.tipEl.innerHTML = info.mob ? this.mobTip(info.mob) : this.blockTip(info);
    }

    // Sit beside the cursor, flipping near the edges so it stays on screen.
    const pad = 16;
    const w = this.tipEl.offsetWidth || 160;
    const h = this.tipEl.offsetHeight || 48;
    const flipX = info.screenX + pad + w > window.innerWidth;
    const flipY = info.screenY + pad + h > window.innerHeight;
    this.tipEl.style.left = `${info.screenX + (flipX ? -w - pad : pad)}px`;
    this.tipEl.style.top = `${info.screenY + (flipY ? -h - pad : pad)}px`;
    this.tipEl.classList.add('show');
  }

  mobTip(m) {
    const d = m.def;
    const bits = [
      `<span class="tag ${d.behavior}">${d.behavior}</span>`,
      `${Math.ceil(m.health)}/${m.maxHealth} HP`,
    ];
    if (d.damage) bits.push(`${d.damage} damage`);
    if (d.ranged) bits.push('ranged');
    if (d.flying) bits.push('flies');
    if (d.aquatic) bits.push('aquatic');
    if (d.boss) bits.push('boss');
    return `<b>${d.name}</b><span class="sub">${bits.join(' &middot; ')}</span>`;
  }

  blockTip(info) {
    const { blockId, structure } = info;
    const def = block(blockId);

    // Empty air only earns a tooltip when it's part of something built.
    if (blockId === AIR) {
      return structure ? `<b>${structure.name}</b><span class="sub">structure</span>` : '';
    }

    const bits = [];
    bits.push(def.hardness === null ? 'unbreakable' : `${def.hardness}s to mine`);
    if (def.drops !== undefined && def.drops !== blockId) bits.push(`drops ${block(def.drops).name}`);
    if (isLiquid(blockId)) bits.push('liquid');
    else if (isDecoration(blockId)) bits.push('walk-through');
    if (def.emit >= 0.4) bits.push('light source');
    if (def.climbable) bits.push('climbable');

    const extra = info.data?.kind === 'chest'
      ? `<span class="sub">${info.data.opened ? 'already looted' : 'unopened &mdash; right click'}</span>`
      : info.data?.kind === 'spawner'
        ? `<span class="sub">spawns ${info.data.mob.replace(/_/g, ' ')}</span>`
        : '';

    const where = structure ? `<span class="where">${structure.name}</span>` : '';
    return `<b>${def.name}</b><span class="sub">${bits.join(' &middot; ')}</span>${extra}${where}`;
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
