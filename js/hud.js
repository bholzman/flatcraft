import { AIR, PLACEABLE, block, isLiquid, isDecoration } from './blocks.js';
import * as I from './items.js';
import { BIOMES, LAYOUTS } from './biomes.js';
import { phaseName, clockAt, MAX_AIR } from './config.js';
import { RECIPES, CATEGORIES } from './recipes.js';
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
    this.airEl = document.getElementById('air');
    this.effectsEl = document.getElementById('effects');
    this.modeEl = document.getElementById('mode');
    this.biomesEl = document.getElementById('biomes');
    this.paletteEl = document.getElementById('palette');
    this.packEl = document.getElementById('pack');
    this.tipEl = document.getElementById('tooltip');
    this.craftEl = document.getElementById('crafting');
    this.tradeEl = document.getElementById('trading');
    this.toastTimer = null;
    this.showDebug = false;
    this.debugEl.classList.add('hidden');

    this.buildHotbar();
    this.buildPack();
    this.buildBiomePanel();
    this.buildPalette();
    this.buildCrafting();
    this.buildTrading();

    this.inventory.onChange = () => { this.renderHotbar(); this.renderPack(); this.renderTrade(); };
    this.renderHotbar();
    this.renderPack();
    this.renderMode();
    this.lastHearts = -1;
    this.lastAir = -1;
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
    if (show) {
      this.toggleBiomes(false);
      this.togglePalette(false);
      this.toggleCrafting(false);
      this.toggleTrade(false);
    }
  }

  // ---- crafting ----

  /**
   * A recipe book rather than a placement grid: every recipe is listed with
   * what it needs and what it makes, and the ones you can actually make right
   * now are live. Drag-and-drop into a 3x3 grid doesn't survive contact with
   * a browser and a single mouse button.
   */
  buildCrafting() {
    const body = this.craftEl.querySelector('.body');

    const bar = document.createElement('div');
    bar.className = 'craft-bar';
    this.craftOnly = document.createElement('input');
    this.craftOnly.type = 'checkbox';
    this.craftOnly.checked = false;
    this.craftOnly.addEventListener('change', () => this.refreshCrafting(this.game));
    const onlyLabel = document.createElement('label');
    onlyLabel.className = 'time-hold';
    onlyLabel.appendChild(this.craftOnly);
    onlyLabel.appendChild(document.createTextNode('Only what I can make'));
    this.craftStations = document.createElement('span');
    this.craftStations.className = 'craft-stations';
    bar.appendChild(onlyLabel);
    bar.appendChild(this.craftStations);
    body.appendChild(bar);

    this.craftList = document.createElement('div');
    body.appendChild(this.craftList);

    this.craftRows = RECIPES.map((r) => {
      const row = document.createElement('div');
      row.className = 'craft-row';

      const result = document.createElement('div');
      result.className = 'craft-result';
      result.innerHTML = `<img src="${swatchDataURL(r.out.id)}" alt="">`
        + `<span class="craft-name">${I.nameOf(r.out.id)}`
        + `${r.out.count > 1 ? ` <b>x${r.out.count}</b>` : ''}</span>`;

      const needs = document.createElement('div');
      needs.className = 'craft-needs';

      const actions = document.createElement('div');
      actions.className = 'craft-actions';
      const one = document.createElement('button');
      one.className = 'chip craft-btn';
      one.textContent = 'Craft';
      one.addEventListener('click', () => this.game.craft(r, 1));
      const many = document.createElement('button');
      many.className = 'chip craft-btn';
      many.textContent = 'x8';
      many.addEventListener('click', () => this.game.craft(r, 8));
      actions.appendChild(one);
      actions.appendChild(many);

      row.appendChild(result);
      row.appendChild(needs);
      row.appendChild(actions);
      return { recipe: r, row, needs, one, many };
    });

    for (const cat of CATEGORIES) {
      const head = document.createElement('h4');
      head.className = 'section';
      head.textContent = cat;
      head.dataset.cat = cat;
      this.craftList.appendChild(head);
      for (const entry of this.craftRows) {
        if (entry.recipe.category === cat) this.craftList.appendChild(entry.row);
      }
    }

    this.craftEl.querySelector('.close').addEventListener('click', () => this.toggleCrafting(false));
  }

  refreshCrafting(game) {
    if (!this.craftRows || this.craftEl.classList.contains('hidden')) return;

    const stations = game.stationsNearby();
    const onlyReady = this.craftOnly.checked;
    this.craftStations.textContent = [
      stations.table ? 'crafting table ✓' : 'no crafting table',
      stations.furnace ? 'furnace ✓' : 'no furnace',
    ].join(' · ');

    const shown = new Set();
    for (const entry of this.craftRows) {
      const blockers = game.recipeBlockers(entry.recipe, stations);
      const ready = blockers.length === 0;
      const hide = onlyReady && !ready;

      entry.row.classList.toggle('hidden', hide);
      entry.row.classList.toggle('ready', ready);
      entry.one.disabled = !ready;
      entry.many.disabled = !ready;
      entry.one.title = blockers.join(', ') || 'Craft one';
      if (!hide) shown.add(entry.recipe.category);

      // Ingredient chips carry have/need, so a shortfall is obvious.
      const html = entry.recipe.in.map((ing) => {
        const have = game.inventory.total(ing.id);
        const ok = game.creative || have >= ing.count;
        return `<span class="ing ${ok ? '' : 'short'}" title="${I.nameOf(ing.id)}">`
          + `<img src="${swatchDataURL(ing.id)}" alt="">`
          + `${have}/${ing.count}</span>`;
      }).join('');
      const note = blockers.find((b) => b.startsWith('needs')) ?? '';
      entry.needs.innerHTML = html + (note ? `<span class="craft-note">${note}</span>` : '');
    }

    // Hide a category heading when the filter emptied it.
    for (const head of this.craftList.querySelectorAll('h4.section')) {
      head.classList.toggle('hidden', !shown.has(head.dataset.cat));
    }
  }

  toggleCrafting(force) {
    const show = force ?? this.craftEl.classList.contains('hidden');
    this.craftEl.classList.toggle('hidden', !show);
    if (show) {
      this.toggleBiomes(false);
      this.togglePalette(false);
      this.togglePack(false);
      this.toggleTrade(false);
      this.refreshCrafting(this.game);
    }
  }

  // ---- trading ----

  buildTrading() {
    this.tradeTitle = this.tradeEl.querySelector('h2');
    this.tradeList = this.tradeEl.querySelector('.body');
    this.tradeRows = [];
    this.tradeEl.querySelector('.close').addEventListener('click', () => this.toggleTrade(false));
  }

  /**
   * Show a villager's offers. Each offer is `{ give: [{ id, count }], get: { id, count } }`;
   * `onTrade(offer)` does the actual inventory transfer.
   */
  openTrade(title, offers, onTrade) {
    this.tradeTitle.textContent = title;
    this.tradeOnTrade = onTrade;
    this.tradeList.replaceChildren();

    this.tradeRows = offers.map((offer) => {
      const row = document.createElement('div');
      row.className = 'trade-row';

      const give = document.createElement('div');
      give.className = 'craft-needs';

      const arrow = document.createElement('span');
      arrow.className = 'trade-arrow';
      arrow.textContent = '→';

      const get = document.createElement('div');
      get.className = 'craft-result';
      const img = document.createElement('img');
      img.src = swatchDataURL(offer.get.id);
      img.alt = '';
      const name = document.createElement('span');
      name.className = 'craft-name';
      name.textContent = I.nameOf(offer.get.id);
      if (offer.get.count > 1) {
        const n = document.createElement('b');
        n.textContent = ` x${offer.get.count}`;
        name.appendChild(n);
      }
      // Why a row is greyed out, spelled out rather than hidden in a tooltip.
      const why = document.createElement('span');
      why.className = 'trade-why';
      const label = document.createElement('div');
      label.className = 'trade-label';
      label.append(name, why);
      get.append(img, label);

      const button = document.createElement('button');
      button.className = 'chip craft-btn';
      button.textContent = 'Trade';
      button.addEventListener('click', () => {
        this.tradeOnTrade?.(offer);
        this.renderTrade();
      });

      row.append(give, arrow, get, button);
      this.tradeList.appendChild(row);
      return { offer, row, give, button, why };
    });

    // Shown when nothing is affordable, so an all-grey panel explains itself.
    this.tradeHint = document.createElement('p');
    this.tradeHint.className = 'panel-empty trade-hint hidden';
    this.tradeHint.textContent = 'Nothing you can afford yet. Sell this villager what it asks for to '
      + 'earn emeralds, or mine emerald ore deep down in the deepslate.';
    this.tradeList.prepend(this.tradeHint);

    if (!offers.length) {
      const empty = document.createElement('p');
      empty.className = 'panel-empty';
      empty.textContent = 'Nothing to trade right now.';
      this.tradeList.appendChild(empty);
    }

    this.toggleTrade(true);
  }

  /** Refresh have/need chips and which Trade buttons are live. */
  renderTrade() {
    if (!this.tradeRows || !this.tradeOpen) return;
    const inv = this.inventory;

    for (const entry of this.tradeRows) {
      const { give, get } = entry.offer;
      const blockers = [];

      // Ingredient chips carry have/need, the same way the crafting list does.
      entry.give.innerHTML = give.map((g) => {
        const have = inv.total(g.id);
        const ok = inv.infinite || have >= g.count;
        if (!ok) blockers.push(`need ${g.count - have} more ${I.nameOf(g.id)}`);
        return `<span class="ing ${ok ? '' : 'short'}" title="${I.nameOf(g.id)}">`
          + `<img src="${swatchDataURL(g.id)}" alt="">`
          + `${have}/${g.count}</span>`;
      }).join('');

      if (!inv.infinite && inv.roomFor(get.id) < get.count) blockers.push('inventory full');

      const ready = blockers.length === 0;
      entry.row.classList.toggle('ready', ready);
      entry.button.disabled = !ready;
      entry.button.title = blockers.join(', ') || `Trade for ${I.nameOf(get.id)}`;
      entry.why.textContent = ready ? '' : blockers.join(', ');
    }
    const none = this.tradeRows.length > 0 && this.tradeRows.every((e) => e.button.disabled);
    this.tradeHint?.classList.toggle('hidden', !none);
  }

  get tradeOpen() {
    return !this.tradeEl.classList.contains('hidden');
  }

  toggleTrade(force) {
    const show = force ?? !this.tradeOpen;
    this.tradeEl.classList.toggle('hidden', !show);
    if (show) {
      this.toggleBiomes(false);
      this.togglePalette(false);
      this.togglePack(false);
      this.toggleCrafting(false);
      this.renderTrade();
    } else {
      this.tradeOnTrade = null;
    }
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
    this.paletteGrid = grid;

    this.paletteCells = [...PLACEABLE, ...I.ALL_ITEMS].map((id, index) => {
      const name = I.nameOf(id);
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.title = name;
      cell.innerHTML = `<img src="${swatchDataURL(id)}" alt=""><span>${name}</span>`;
      cell.addEventListener('click', () => {
        this.inventory.setSelected(id, I.stackSize(id));
        this.announce(name);
        // Back to the search box, so the next keystroke searches rather than
        // reaching the game's key bindings through the focused button.
        this.paletteSearch.focus();
      });
      grid.appendChild(cell);
      return { el: cell, index, name: name.toLowerCase() };
    });

    // The search bar sits outside the scrolling body so it never scrolls away.
    const bar = document.createElement('div');
    bar.className = 'palette-bar';
    this.paletteSearch = document.createElement('input');
    this.paletteSearch.type = 'search';
    this.paletteSearch.className = 'palette-search';
    this.paletteSearch.placeholder = 'Search blocks and items';
    this.paletteSearch.spellcheck = false;
    this.paletteSearch.autocomplete = 'off';
    this.paletteCount = document.createElement('span');
    this.paletteCount.className = 'craft-stations';
    bar.append(this.paletteSearch, this.paletteCount);

    // Keys typed here are text, not game input: Input listens on window, so
    // stopping the keydown here keeps "g" from cycling the mode and so on.
    // Escape still closes the palette, and Enter takes the first match.
    this.paletteSearch.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.togglePalette(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.paletteCells.find((c) => !c.el.classList.contains('hidden'))?.el.click();
      }
    });
    this.paletteSearch.addEventListener('input', () => this.filterPalette());

    this.paletteEmpty = document.createElement('p');
    this.paletteEmpty.className = 'panel-empty hidden';

    const body = this.paletteEl.querySelector('.body');
    body.before(bar);
    body.append(grid, this.paletteEmpty);
    this.paletteEl.querySelector('.close').addEventListener('click', () => this.togglePalette(false));
    this.filterPalette();
  }

  /**
   * Live filter: every word of the query has to appear in the name. Matches
   * where the name, or one of its words, starts with the query come first --
   * "oak" lists Oak Log before Dark Oak Planks.
   */
  filterPalette() {
    const query = this.paletteSearch.value.trim().toLowerCase();
    const words = query.split(/\s+/).filter(Boolean);
    const total = this.paletteCells.length;

    if (!words.length) {
      for (const c of this.paletteCells) c.el.classList.remove('hidden');
      this.paletteGrid.append(...this.paletteCells.map((c) => c.el));   // original order
      this.paletteEmpty.classList.add('hidden');
      this.paletteCount.textContent = `${total} blocks & items`;
      return;
    }

    const rank = (name) => {
      if (name.startsWith(query)) return 0;
      if (name.split(/\s+/).some((w) => w.startsWith(words[0]))) return 1;
      return 2;
    };
    const hits = [];
    for (const c of this.paletteCells) {
      const hit = words.every((w) => c.name.includes(w));
      c.el.classList.toggle('hidden', !hit);
      if (hit) hits.push({ c, r: rank(c.name) });
    }
    hits.sort((a, b) => a.r - b.r || a.c.index - b.c.index);
    this.paletteGrid.prepend(...hits.map((h) => h.c.el));

    this.paletteEmpty.classList.toggle('hidden', hits.length > 0);
    this.paletteEmpty.textContent = `No blocks match "${this.paletteSearch.value.trim()}"`;
    this.paletteCount.textContent = `${hits.length} of ${total}`;
  }

  toggleBiomes(force) {
    const show = force ?? this.biomesEl.classList.contains('hidden');
    this.biomesEl.classList.toggle('hidden', !show);
    if (show) {
      this.toggleCrafting(false);
      this.refreshStructures();
      this.refreshTime(this.game);
      this.togglePalette(false);
      this.togglePack(false);
      this.toggleTrade(false);
    }
  }

  togglePalette(force) {
    const show = force ?? this.paletteEl.classList.contains('hidden');
    this.paletteEl.classList.toggle('hidden', !show);
    if (show) {
      this.toggleBiomes(false);
      this.togglePack(false);
      this.toggleCrafting(false);
      this.toggleTrade(false);
      this.paletteSearch.focus();
      this.paletteSearch.select();
    } else {
      this.paletteSearch.blur();
    }
  }

  anyPanelOpen() {
    return !this.biomesEl.classList.contains('hidden')
      || !this.paletteEl.classList.contains('hidden')
      || !this.packEl.classList.contains('hidden')
      || !this.craftEl.classList.contains('hidden')
      || this.tradeOpen;
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

  /** Ten bubbles of breath, shown only while some of it has been used. */
  renderAir(player, show) {
    const bubbles = Math.ceil((player.air / MAX_AIR) * 10);
    const visible = show && player.air < MAX_AIR;
    const key = visible ? bubbles : -1;
    if (key === this.lastAir) return;
    this.lastAir = key;

    this.airEl.classList.toggle('hidden', !visible);
    if (!visible) return;
    let html = '';
    for (let i = 0; i < 10; i++) {
      html += `<span class="bubble ${i < bubbles ? 'full' : 'empty'}"></span>`;
    }
    this.airEl.innerHTML = html;
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
    this.showToast(2200);
  }

  /** What just went into the inventory, one icon row per item, plus an optional note. */
  showLoot(items, note = '') {
    this.toastEl.replaceChildren();
    for (const { id, count } of items) {
      const row = document.createElement('div');
      row.className = 'loot-row';
      const img = document.createElement('img');
      img.className = 'swatch';
      img.alt = '';
      img.src = swatchDataURL(id);
      const label = document.createElement('span');
      label.textContent = `${I.nameOf(id)} x${count}`;
      row.append(img, label);
      this.toastEl.appendChild(row);
    }
    if (note) {
      const el = document.createElement('div');
      el.className = 'loot-note';
      el.textContent = note;
      this.toastEl.appendChild(el);
    }
    // Long enough to read the list, not so long it lingers.
    this.showToast(Math.min(6000, 2600 + items.length * 500));
  }

  showToast(ms) {
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  toggleDebug() {
    this.showDebug = !this.showDebug;
    this.debugEl.classList.toggle('hidden', !this.showDebug);
  }

  renderDebug(lines) {
    if (this.showDebug) this.debugEl.textContent = lines.join('\n');
  }
}
