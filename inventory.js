// =================================================================
// 1. BASE DE DADOS DE ITENS (ITEM DATABASE)
// =================================================================
const ITEM_DATABASE = {
    'medkit': { id: 'medkit', name: 'Kit Médico', type: 'consumable', rarity: 'rare', weight: 0.8, maxStack: 3, icon: '🩹', desc: 'Soro e ligaduras avançadas. Restaura +50 HP.', stats: { heal: 50 } },
    'water': { id: 'water', name: 'Garrafa de Água', type: 'consumable', rarity: 'common', weight: 0.5, maxStack: 5, icon: '💧', desc: 'Água potável não contaminada.', stats: { hydration: 30 } },
    'pistol': { id: 'pistol', name: 'Pistola Tática', type: 'weapon', rarity: 'common', weight: 1.5, maxStack: 1, icon: '🔫', desc: 'Arma secundária de 9mm de alto impacto.', stats: { damage: 25, range: 20 } },
    'shotgun': { id: 'shotgun', name: 'Espingarda Calibre 12', type: 'weapon', rarity: 'epic', weight: 4.2, maxStack: 1, icon: '💥', desc: 'Devastadora a curtas distâncias.', stats: { damage: 90, range: 8 } },
    'ammo_9mm': { id: 'ammo_9mm', name: 'Munição 9mm', type: 'ammo', rarity: 'common', weight: 0.02, maxStack: 60, icon: '📦', desc: 'Cartuchos padrão de 9mm.', stats: {} },
    'scrap': { id: 'scrap', name: 'Sucata de Metal', type: 'resource', rarity: 'common', weight: 0.3, maxStack: 20, icon: '⚙️', desc: 'Peças metálicas úteis para crafting.', stats: {} }
  };
  
  // =================================================================
  // 2. CLASSE ITEM (INSTÂNCIA)
  // =================================================================
  class Item {
    constructor(databaseId, count = 1) {
      const template = ITEM_DATABASE[databaseId];
      if (!template) throw new Error(`Item ${databaseId} não encontrado na base de dados!`);
  
      this.instanceId = 'item_' + Math.random().toString(36).substr(2, 9);
      this.id = template.id;
      this.name = template.name;
      this.type = template.type;
      this.rarity = template.rarity;
      this.weight = template.weight;
      this.maxStack = template.maxStack;
      this.icon = template.icon;
      this.desc = template.desc;
      this.stats = template.stats;
      this.count = Math.min(count, this.maxStack);
    }
  
    get totalWeight() {
      return parseFloat((this.weight * this.count).toFixed(2));
    }
  }
  
  // =================================================================
  // 3. CLASSE INVENTORY MANAGER
  // =================================================================
  class InventorySystem {
    constructor(rows = 5, cols = 6, maxWeight = 30.0) {
      this.rows = rows;
      this.cols = cols;
      this.maxSlotCount = rows * cols;
      this.maxWeight = maxWeight;
  
      this.slots = new Array(this.maxSlotCount).fill(null);
      this.hotbarSlots = new Array(5).fill(null);
  
      this.draggedContext = null; // Guarda referência do drag ativo
      this.selectedContextSlot = null; // Slot para o Menu de Contexto
  
      this.initDOMReferences();
      this.buildGrids();
      this.bindEvents();
    }
  
    initDOMReferences() {
      this.overlay = document.getElementById('inventory-overlay');
      this.gridEl = document.getElementById('inventory-grid');
      this.hotbarEl = document.getElementById('hotbar-grid');
      this.weightValEl = document.getElementById('weight-val');
      this.weightFillEl = document.getElementById('weight-bar-fill');
      this.tooltipEl = document.getElementById('inv-tooltip');
      this.contextMenuEl = document.getElementById('context-menu');
      this.dropZoneEl = document.getElementById('drop-zone');
    }
  
    buildGrids() {
      // Construção do Grid da Mochila
      this.gridEl.innerHTML = '';
      for (let i = 0; i < this.maxSlotCount; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.slotIndex = i;
        slot.dataset.container = 'backpack';
        this.gridEl.appendChild(slot);
      }
  
      // Construção da Hotbar
      this.hotbarEl.innerHTML = '';
      for (let i = 0; i < 5; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.slotIndex = i;
        slot.dataset.container = 'hotbar';
        
        const keyHint = document.createElement('span');
        keyHint.className = 'slot-hotbar-key';
        keyHint.innerText = i + 1;
        slot.appendChild(keyHint);
  
        this.hotbarEl.appendChild(slot);
      }
    }
  
    // CALCULAR PESO TOTAL
    getCurrentWeight() {
      let total = 0;
      this.slots.forEach(item => { if (item) total += item.totalWeight; });
      this.hotbarSlots.forEach(item => { if (item) total += item.totalWeight; });
      return parseFloat(total.toFixed(2));
    }
  
    // VERIFICAR ESPAÇO E ADICIONAR ITEM
    addItem(item) {
      if (this.getCurrentWeight() + item.totalWeight > this.maxWeight) {
        console.warn("Mochila cheia! Excesso de peso.");
        return false;
      }
  
      // 1. Tentar Empilhar em slots existentes
      if (item.maxStack > 1) {
        for (let i = 0; i < this.maxSlotCount; i++) {
          let existing = this.slots[i];
          if (existing && existing.id === item.id && existing.count < existing.maxStack) {
            let spaceInStack = existing.maxStack - existing.count;
            let added = Math.min(spaceInStack, item.count);
            existing.count += added;
            item.count -= added;
  
            if (item.count <= 0) {
              this.render();
              return true;
            }
          }
        }
      }
  
      // 2. Colocar em Slot Vazio da Mochila
      if (item.count > 0) {
        let emptyIndex = this.slots.findIndex(s => s === null);
        if (emptyIndex !== -1) {
          this.slots[emptyIndex] = item;
          this.render();
          return true;
        }
      }
  
      this.render();
      return false;
    }
  
    // =================================================================
    // DRAG AND DROP & EVENT HANDLERS
    // =================================================================
    bindEvents() {
      // Delegar Drag/Drop nos slots
      [this.gridEl, this.hotbarEl].forEach(container => {
        container.addEventListener('dragstart', (e) => this.handleDragStart(e));
        container.addEventListener('dragover', (e) => this.handleDragOver(e));
        container.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        container.addEventListener('drop', (e) => this.handleDrop(e));
        container.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        container.addEventListener('mouseover', (e) => this.handleMouseOver(e));
        container.addEventListener('mouseout', () => this.hideTooltip());
      });
  
      // Zona de Descarte (Drop no chão)
      this.dropZoneEl.addEventListener('dragover', (e) => { e.preventDefault(); this.dropZoneEl.classList.add('drag-over'); });
      this.dropZoneEl.addEventListener('dragleave', () => this.dropZoneEl.classList.remove('drag-over'));
      this.dropZoneEl.addEventListener('drop', (e) => this.handleDiscardDrop(e));
  
      // Fechar Menu de Contexto em cliques externos
      document.addEventListener('click', () => this.hideContextMenu());
  
      // Botões do Menu de Contexto
      document.getElementById('ctx-use').addEventListener('click', () => this.useSelectedContextItem());
      document.getElementById('ctx-split').addEventListener('click', () => this.splitSelectedContextItem());
      document.getElementById('ctx-drop').addEventListener('click', () => this.discardSelectedContextItem());
    }
  
    handleDragStart(e) {
      const itemCard = e.target.closest('.item-card');
      if (!itemCard) return;
  
      const slotEl = itemCard.parentElement;
      const container = slotEl.dataset.container;
      const index = parseInt(slotEl.dataset.slotIndex);
  
      this.draggedContext = {
        container: container,
        index: index,
        item: container === 'backpack' ? this.slots[index] : this.hotbarSlots[index]
      };
  
      e.dataTransfer.setData('text/plain', ''); // Necessário para Firefox
    }
  
    handleDragOver(e) {
      e.preventDefault();
      const slotEl = e.target.closest('.slot');
      if (slotEl) slotEl.classList.add('drag-over');
    }
  
    handleDragLeave(e) {
      const slotEl = e.target.closest('.slot');
      if (slotEl) slotEl.classList.remove('drag-over');
    }
  
    handleDrop(e) {
      e.preventDefault();
      const targetSlot = e.target.closest('.slot');
      if (!targetSlot || !this.draggedContext) return;
  
      targetSlot.classList.remove('drag-over');
  
      const targetContainer = targetSlot.dataset.container;
      const targetIndex = parseInt(targetSlot.dataset.slotIndex);
  
      // Fonte e Destino
      let sourceList = this.draggedContext.container === 'backpack' ? this.slots : this.hotbarSlots;
      let targetList = targetContainer === 'backpack' ? this.slots : this.hotbarSlots;
  
      let sourceItem = sourceList[this.draggedContext.index];
      let targetItem = targetList[targetIndex];
  
      // Troca de Posição (Swap) ou Fusão de Pilha
      if (targetItem && targetItem.id === sourceItem.id && targetItem.maxStack > 1) {
        // Unir Pilhas
        let space = targetItem.maxStack - targetItem.count;
        let transfer = Math.min(space, sourceItem.count);
        targetItem.count += transfer;
        sourceItem.count -= transfer;
  
        if (sourceItem.count <= 0) {
          sourceList[this.draggedContext.index] = null;
        }
      } else {
        // Inverter Posições
        sourceList[this.draggedContext.index] = targetItem;
        targetList[targetIndex] = sourceItem;
      }
  
      this.draggedContext = null;
      this.render();
    }
  
    handleDiscardDrop(e) {
      e.preventDefault();
      this.dropZoneEl.classList.remove('drag-over');
      if (!this.draggedContext) return;
  
      let sourceList = this.draggedContext.container === 'backpack' ? this.slots : this.hotbarSlots;
      console.log(`[CHÃO] Item descartado: ${sourceList[this.draggedContext.index].name}`);
      sourceList[this.draggedContext.index] = null;
  
      this.draggedContext = null;
      this.render();
    }
  
    // =================================================================
    // TOOLTIP E MENU DE CONTEXTO
    // =================================================================
    handleMouseOver(e) {
      const itemCard = e.target.closest('.item-card');
      if (!itemCard) return;
  
      const slotEl = itemCard.parentElement;
      const container = slotEl.dataset.container;
      const index = parseInt(slotEl.dataset.slotIndex);
      const item = container === 'backpack' ? this.slots[index] : this.hotbarSlots[index];
  
      if (!item) return;
  
      let statsHtml = '';
      for (let [k, v] of Object.entries(item.stats)) {
        statsHtml += `<div>${k.toUpperCase()}: +${v}</div>`;
      }
  
      this.tooltipEl.innerHTML = `
        <h4 style="color:${this.getRarityColor(item.rarity)}">${item.name}</h4>
        <p><strong>Tipo:</strong> ${item.type.toUpperCase()}</p>
        <p>${item.desc}</p>
        <p><strong>Peso Unit.:</strong> ${item.weight} kg</p>
        ${statsHtml ? `<div class="stats">${statsHtml}</div>` : ''}
      `;
  
      this.tooltipEl.classList.remove('hidden');
      this.tooltipEl.style.left = `${e.pageX + 12}px`;
      this.tooltipEl.style.top = `${e.pageY + 12}px`;
    }
  
    hideTooltip() {
      this.tooltipEl.classList.add('hidden');
    }
  
    handleContextMenu(e) {
      e.preventDefault();
      const itemCard = e.target.closest('.item-card');
      if (!itemCard) return;
  
      const slotEl = itemCard.parentElement;
      this.selectedContextSlot = {
        container: slotEl.dataset.container,
        index: parseInt(slotEl.dataset.slotIndex)
      };
  
      this.contextMenuEl.style.left = `${e.pageX}px`;
      this.contextMenuEl.style.top = `${e.pageY}px`;
      this.contextMenuEl.classList.remove('hidden');
    }
  
    hideContextMenu() {
      this.contextMenuEl.classList.add('hidden');
    }
  
    useSelectedContextItem() {
      if (!this.selectedContextSlot) return;
      const { container, index } = this.selectedContextSlot;
      const list = container === 'backpack' ? this.slots : this.hotbarSlots;
      const item = list[index];
  
      if (item) {
        console.log(`[SISTEMA] Item Usado: ${item.name}`);
        // Lógica de consumo de efeitos
        if (item.type === 'consumable') {
          item.count--;
          if (item.count <= 0) list[index] = null;
        }
      }
      this.render();
    }
  
    splitSelectedContextItem() {
      if (!this.selectedContextSlot) return;
      const { container, index } = this.selectedContextSlot;
      const list = container === 'backpack' ? this.slots : this.hotbarSlots;
      const item = list[index];
  
      if (item && item.count > 1) {
        let splitAmount = Math.floor(item.count / 2);
        item.count -= splitAmount;
  
        let newItem = new Item(item.id, splitAmount);
        this.addItem(newItem);
      }
      this.render();
    }
  
    discardSelectedContextItem() {
      if (!this.selectedContextSlot) return;
      const { container, index } = this.selectedContextSlot;
      const list = container === 'backpack' ? this.slots : this.hotbarSlots;
      list[index] = null;
      this.render();
    }
  
    getRarityColor(rarity) {
      switch (rarity) {
        case 'rare': return '#0088ff';
        case 'epic': return '#aa00ff';
        default: return '#ffffff';
      }
    }
  
    // =================================================================
    // RENDERIZAÇÃO E PERSISTÊNCIA
    // =================================================================
    render() {
      // 1. Renderizar Mochila
      const backpackSlotsDOM = this.gridEl.querySelectorAll('.slot');
      backpackSlotsDOM.forEach((slotEl, i) => {
        this.renderSlotContent(slotEl, this.slots[i]);
      });
  
      // 2. Renderizar Hotbar
      const hotbarSlotsDOM = this.hotbarEl.querySelectorAll('.slot');
      hotbarSlotsDOM.forEach((slotEl, i) => {
        this.renderSlotContent(slotEl, this.hotbarSlots[i], true);
      });
  
      // 3. Atualizar Métrica de Peso
      const currentWeight = this.getCurrentWeight();
      this.weightValEl.innerText = currentWeight.toFixed(1);
      const weightPct = Math.min(100, (currentWeight / this.maxWeight) * 100);
      this.weightFillEl.style.width = `${weightPct}%`;
      this.weightFillEl.style.background = weightPct > 85 ? '#ff3333' : '#00bb33';
    }
  
    renderSlotContent(slotEl, item, isHotbar = false) {
      // Limpar cartões antigos mantendo atalhos/labels
      const oldCard = slotEl.querySelector('.item-card');
      if (oldCard) oldCard.remove();
  
      if (item) {
        const card = document.createElement('div');
        card.className = `item-card ${item.rarity}`;
        card.draggable = true;
  
        card.innerHTML = `
          <span class="item-icon">${item.icon}</span>
          ${item.count > 1 ? `<span class="item-count">${item.count}</span>` : ''}
        `;
  
        slotEl.appendChild(card);
      }
    }
  
    // SALVAR NO LOCALSTORAGE
    saveToLocalStorage() {
      const data = {
        slots: this.slots,
        hotbarSlots: this.hotbarSlots
      };
      localStorage.setItem('zombie_game_inventory', JSON.stringify(data));
      console.log("[STORAGE] Inventário Guardado!");
    }
  
    // CARREGAR DO LOCALSTORAGE
    loadFromLocalStorage() {
      const saved = localStorage.getItem('zombie_game_inventory');
      if (saved) {
        const data = JSON.parse(saved);
        
        // Re-instanciar protótipos das classes
        this.slots = data.slots.map(s => s ? Object.assign(new Item(s.id), s) : null);
        this.hotbarSlots = data.hotbarSlots.map(s => s ? Object.assign(new Item(s.id), s) : null);
        
        this.render();
        console.log("[STORAGE] Inventário Carregado!");
      }
    }
  }
