// Desktop Frontend View Controller & Real-Time Shader Pipeline
export {};

declare global {
  interface Window {
    api: {
      getState: () => Promise<any>;
      dispatch: (action: any) => Promise<any>;
      onStateUpdate: (callback: (state: any) => void) => () => void;
      saveGame: () => Promise<boolean>;
      loadGame: () => Promise<boolean>;
      nukeGame: () => Promise<any>;
      getTorStatus: () => Promise<any>;
      checkTorProxy: () => Promise<any>;
      onTorStatusUpdate: (callback: (info: any) => void) => () => void;
    };
  }
}

// State cache
let currentState: any = null;
let currentTorStatus: any = null;
let operativeFilter: 'ALL' | 'BENJAMIN' | 'ELIAS' | 'UNASSIGNED' = 'ALL';
let operativeSort: 'DEFAULT' | 'TIER' | 'EFFICIENCY' = 'DEFAULT';

// DOM references
const valOperator = document.getElementById('val-operator')!;
const valTorStatus = document.getElementById('val-tor-status')!;
const valTorLatency = document.getElementById('val-tor-latency')!;
const valTicks = document.getElementById('val-ticks')!;
const valCash = document.getElementById('val-cash')!;
const meterSanity = document.getElementById('meter-sanity')!;
const valSanity = document.getElementById('val-sanity')!;
const meterHeat = document.getElementById('meter-heat')!;
const valHeat = document.getElementById('val-heat')!;
const meterDistortion = document.getElementById('meter-distortion')!;
const valDistortion = document.getElementById('val-distortion')!;
const meterSatisfaction = document.getElementById('meter-satisfaction');
const valSatisfaction = document.getElementById('val-satisfaction');
const valLoyalty = document.getElementById('val-loyalty');
const valServed = document.getElementById('val-served');
const pharmacyList = document.getElementById('pharmacy-list');
const blackMarketList = document.getElementById('black-market-list');
const raidBanner = document.getElementById('raid-banner')!;
const operativesList = document.getElementById('operatives-list')!;
const nodesList = document.getElementById('nodes-list')!;
const investmentsCatalog = document.getElementById('investments-catalog')!;
const tapeCatalog = document.getElementById('tape-catalog')!;
const activeRentalsList = document.getElementById('active-rentals-list')!;
const intelCluesList = document.getElementById('intel-clues-list')!;
const consoleLogs = document.getElementById('console-logs')!;

// Canvas Glitch Effect
const canvas = document.getElementById('glitch-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawGlitchNoise(): void {
  if (!currentState) return;
  const distortion = currentState.player.distortionIndex;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (distortion > 0.05) {
    const numArtifacts = Math.floor(distortion * 25);
    ctx.fillStyle = 'rgba(51, 255, 102, 0.15)';

    for (let i = 0; i < numArtifacts; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const w = Math.random() * 120 + 20;
      const h = Math.random() * 3 + 1;
      ctx.fillRect(x, y, w, h);
    }
  }

  requestAnimationFrame(drawGlitchNoise);
}
requestAnimationFrame(drawGlitchNoise);

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function logMessage(msg: string, level: 'INFO' | 'WARN' | 'CRIT' = 'INFO'): void {
  const entry = document.createElement('div');
  entry.className = `log-entry ${level === 'WARN' ? 'log-warn' : level === 'CRIT' ? 'log-crit' : ''}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${msg}`;
  consoleLogs.prepend(entry);
}

function updateUI(state: any): void {
  currentState = state;

  // 1. Header & Gauges
  valOperator.textContent = state.player.alias;
  valTicks.textContent = state.runtime.totalTicksElapsed;
  valCash.textContent = formatCurrency(state.player.cashCents);

  const sanityPct = Math.round(state.player.sanity * 100);
  meterSanity.style.width = `${sanityPct}%`;
  valSanity.textContent = `${sanityPct}%`;

  const heatPct = state.player.heat.toFixed(1);
  meterHeat.style.width = `${Math.min(100, state.player.heat)}%`;
  valHeat.textContent = `${heatPct}%`;

  const distortionPct = (state.player.distortionIndex * 100).toFixed(1);
  meterDistortion.style.width = `${Math.min(100, state.player.distortionIndex * 100)}%`;
  valDistortion.textContent = `${distortionPct}%`;

  // 2. Raid Alert
  if (state.runtime.isRaidActive) {
    raidBanner.classList.remove('hidden');
  } else {
    raidBanner.classList.add('hidden');
  }

  // 3. Operatives
  let workers = Object.values(state.workers);

  // Filter
  if (operativeFilter === 'BENJAMIN') {
    workers = workers.filter((w: any) => w.role === 'BENJAMIN');
  } else if (operativeFilter === 'ELIAS') {
    workers = workers.filter((w: any) => w.role === 'ELIAS');
  } else if (operativeFilter === 'UNASSIGNED') {
    workers = workers.filter((w: any) => !w.assignedNodeId);
  }

  // Sort
  if (operativeSort === 'TIER') {
    workers.sort((a: any, b: any) => b.tier - a.tier);
  } else if (operativeSort === 'EFFICIENCY') {
    workers.sort((a: any, b: any) => b.efficiency - a.efficiency);
  }

  const nodes = Object.values(state.nodes);

  if (workers.length === 0) {
    operativesList.innerHTML = '<div class="empty-state">No matching operatives found.</div>';
  } else {
    operativesList.innerHTML = workers.map((w: any) => {
      // Build hub assignment options
      const nodeOptions = [
        `<option value="UNASSIGNED" ${!w.assignedNodeId ? 'selected' : ''}>[UNASSIGNED RESERVE]</option>`,
        ...nodes.map((n: any) => {
          const count = Object.values(state.workers).filter((other: any) => other.assignedNodeId === n.id).length;
          return `<option value="${n.id}" ${w.assignedNodeId === n.id ? 'selected' : ''}>${n.name} (${count}/${n.workerCapacity})</option>`;
        })
      ].join('');

      return `
        <div class="item-card">
          <div class="item-card-header">
            <span class="${w.role === 'BENJAMIN' ? 'badge-benjamin' : 'badge-elias'}">${w.codename} (${w.role})</span>
            <span>Tier ${w.tier}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 4px 0;">
            <span>Upkeep: ${formatCurrency(w.salaryPerMinuteCents)}/m</span>
            <span>Durability: ${(w.durability * 100).toFixed(0)}%</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin: 4px 0;">
            <span style="font-size: 10px; color: #88cc88;">Station:</span>
            <select class="btn" style="padding: 2px 4px; font-size: 10px; flex: 1;" onchange="reassignWorker('${w.id}', this.value)">
              ${nodeOptions}
            </select>
          </div>
          <div style="display: flex; gap: 4px; justify-content: flex-end; margin-top: 4px;">
            <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 10px;" onclick="promoteWorker('${w.id}')">Promote (Tier ${w.tier + 1})</button>
            <button class="btn btn-danger" style="padding: 2px 8px; font-size: 10px;" onclick="fireWorker('${w.id}')">Fire</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. Real Estate Nodes
  nodesList.innerHTML = nodes.map((n: any) => `
    <div class="item-card">
      <div class="item-card-header">
        <span>${n.name} (Tier ${n.tier})</span>
        <span>Base: ${formatCurrency(n.baseYieldPerMinCents)}/m</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px;">
        <span>Capacity: ${n.workerCapacity} Operatives</span>
        <button class="btn" style="padding: 2px 6px;" onclick="upgradeNode('${n.id}')">Upgrade ($${(n.upgradeCostCents/100).toFixed(0)})</button>
      </div>
    </div>
  `).join('');

  // 4b. Investments & Wishlist Catalog
  if (state.investments) {
    const invs = Object.values(state.investments);
    investmentsCatalog.innerHTML = invs.map((inv: any) => `
      <div class="investment-card ${inv.isPurchased ? 'purchased' : ''}">
        <div class="investment-info">
          <span class="investment-title">${inv.title}</span>
          <span class="investment-desc">${inv.description}</span>
          <span class="investment-meta">
            Price: ${formatCurrency(inv.costCents)} | 
            ${inv.passiveYieldPerMinCents > 0 ? `Yield: +${formatCurrency(inv.passiveYieldPerMinCents)}/m` : `Sanity: +${(inv.sanityBoost * 100).toFixed(0)}%`}
          </span>
        </div>
        ${inv.isPurchased 
          ? '<span class="status-badge" style="color: var(--crt-green);">ACQUIRED</span>' 
          : `<button class="btn btn-primary" onclick="buyInvestment('${inv.id}')">Acquire</button>`}
      </div>
    `).join('');
  }

  // 4c. Pharmacy Products & Satisfaction Meter
  if (state.customerSatisfaction && meterSatisfaction && valSatisfaction && valLoyalty && valServed) {
    const satPct = Math.round((state.customerSatisfaction.satisfactionScore || 0.85) * 100);
    meterSatisfaction.style.width = `${satPct}%`;
    valSatisfaction.textContent = `${satPct}%`;
    valLoyalty.textContent = state.customerSatisfaction.loyaltyTier || 'GOLD';
    valServed.textContent = state.customerSatisfaction.totalCustomersServed || 0;
  }

  if (state.pharmacyInventory && pharmacyList) {
    const products = Object.values(state.pharmacyInventory);
    pharmacyList.innerHTML = products.map((p: any) => `
      <div class="item-card">
        <div class="item-card-header">
          <span style="color: var(--crt-cyan);">💊 ${p.name}</span>
          <span>Stock: ${p.stockQuantity}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0;">
          <span>Cost: ${formatCurrency(p.wholesaleCostCents)} | Retail: ${formatCurrency(p.retailPriceCents)}</span>
          <button class="btn btn-secondary" style="padding: 2px 6px;" onclick="restockProduct('${p.id}', 10)">+ Restock 10x ($${((p.wholesaleCostCents * 10)/100).toFixed(2)})</button>
        </div>
      </div>
    `).join('');
  }

  // 4d. Black Market Commodities
  if (state.blackMarketInventory && blackMarketList) {
    const comms = Object.values(state.blackMarketInventory);
    blackMarketList.innerHTML = comms.map((c: any) => `
      <div class="item-card" style="border-color: rgba(255, 51, 68, 0.3);">
        <div class="item-card-header">
          <span style="color: var(--crt-amber); font-weight: bold;">⚡ ${c.name}</span>
          <span style="color: var(--crt-red); font-size: 10px;">+${c.heatGeneratedPerSale} Heat</span>
        </div>
        <div style="font-size: 10px; color: #ccaa99; margin: 2px 0;">${c.description}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
          <span>Stock: ${c.stockUnits} | Retail: ${formatCurrency(c.retailPriceCents)}</span>
          <button class="btn btn-danger" style="padding: 2px 6px;" onclick="restockCommodity('${c.id}', 5)">+ Import 5x ($${((c.wholesaleCostCents * 5)/100).toFixed(2)})</button>
        </div>
      </div>
    `).join('');
  }

  // 5. Tape Catalog
  const tapes = Object.values(state.tapeCatalog);
  tapeCatalog.innerHTML = tapes.map((t: any) => `
    <div class="tape-card">
      <div class="tape-info">
        <span class="tape-title">📼 ${t.title}</span>
        <span class="tape-meta">Lease: ${formatCurrency(t.rentalCostCents)} | Duration: ${t.durationSeconds}s | Reward: ${formatCurrency(t.potentialYieldCents)}</span>
      </div>
      <button class="btn btn-secondary" onclick="rentTape('${t.id}')">Lease Tape</button>
    </div>
  `).join('');

  // 6. Active Rentals & Forensics Deck
  const rentals = Object.values(state.activeRentals);
  if (rentals.length === 0) {
    activeRentalsList.innerHTML = '<div class="empty-state">No tapes currently loaded into forensics deck.</div>';
  } else {
    activeRentalsList.innerHTML = rentals.map((r: any) => `
      <div class="item-card">
        <div class="item-card-header">
          <span>Tape: ${r.tapeId} [${r.status}]</span>
          <span>${Math.ceil(r.remainingSeconds)}s left</span>
        </div>
        <div class="meter-bar" style="margin: 4px 0;"><div class="meter-fill sanity-fill" style="width: ${r.progressPercent}%;"></div></div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>Progress: ${r.progressPercent.toFixed(0)}%</span>
          ${r.status === 'RENTED' ? `<button class="btn btn-primary" onclick="scrubForensics('${r.tapeId}')">Scrub Forensics (+50%)</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  // 7. Intel Clues
  if (state.unlockedClues.length === 0) {
    intelCluesList.innerHTML = '<div class="empty-state">No classified intelligence extracted yet.</div>';
  } else {
    intelCluesList.innerHTML = state.unlockedClues.map((c: string) => `
      <div class="log-entry">🔓 ${c}</div>
    `).join('');
  }
}

function updateTorUI(info: any): void {
  currentTorStatus = info;
  valTorStatus.textContent = info.status;
  valTorStatus.style.color = info.status === 'CONNECTED' || info.status === 'CIRCUIT_ESTABLISHED' ? 'var(--crt-green)' : 'var(--crt-red)';
  valTorLatency.textContent = info.latencyMs ? `${info.latencyMs}ms` : '--ms';
}

// Global action bridges for inline onclicks
(window as any).reassignWorker = (workerId: string, nodeId: string) => {
  const targetNodeId = nodeId === 'UNASSIGNED' ? null : nodeId;
  window.api.dispatch({ type: 'ASSIGN_WORKER', workerId, nodeId: targetNodeId });
  logMessage(`Reassigned operative [${workerId}] -> ${targetNodeId || 'Reserve Pool'}`);
};

(window as any).setOperativeFilter = (filter: 'ALL' | 'BENJAMIN' | 'ELIAS' | 'UNASSIGNED') => {
  operativeFilter = filter;
  if (currentState) updateUI(currentState);
};

(window as any).toggleOperativeSort = () => {
  operativeSort = operativeSort === 'DEFAULT' ? 'TIER' : operativeSort === 'TIER' ? 'EFFICIENCY' : 'DEFAULT';
  logMessage(`Sorted operative roster by: ${operativeSort}`);
  if (currentState) updateUI(currentState);
};

(window as any).buyInvestment = (itemId: string) => {
  window.api.dispatch({ type: 'PURCHASE_INVESTMENT', itemId });
  logMessage(`Acquired wishlist asset/venture [${itemId}]`);
};

(window as any).restockProduct = (productId: string, quantity: number = 10) => {
  window.api.dispatch({ type: 'RESTOCK_PHARMACY_PRODUCT', productId, quantity });
  logMessage(`Ordered pharmacy shipment (+${quantity} units of [${productId}])`);
};

(window as any).restockCommodity = (commodityId: string, units: number = 5) => {
  window.api.dispatch({ type: 'RESTOCK_BLACK_MARKET', commodityId, units });
  logMessage(`Imported underground contraband batch (+${units} units of [${commodityId}])`, 'WARN');
};

(window as any).promoteWorker = (workerId: string) => {
  window.api.dispatch({ type: 'UPGRADE_WORKER', workerId });
  logMessage(`Promoted operative [${workerId}] to next tier level`);
};

(window as any).fireWorker = (workerId: string) => {
  window.api.dispatch({ type: 'RETIRE_WORKER', workerId });
  logMessage(`Terminated contract / fired operative [${workerId}]`, 'WARN');
};

(window as any).rentTape = (tapeId: string) => {
  window.api.dispatch({ type: 'RENT_TAPE', tapeId, currentEpochMs: Date.now() });
  logMessage(`Leased VHS tape [${tapeId}] from analog archive`);
};

(window as any).scrubForensics = (tapeId: string) => {
  window.api.dispatch({ type: 'SCRUB_TAPE_FORENSICS', tapeId, effortDeltaPercent: 50 });
  logMessage(`Advanced forensics scrubbing on [${tapeId}] (+50%)`);
};

(window as any).upgradeNode = (nodeId: string) => {
  window.api.dispatch({ type: 'UPGRADE_NODE', nodeId });
  logMessage(`Upgraded surveillance safehouse node [${nodeId}]`);
};

// Event Listeners
document.getElementById('btn-recruit-benjamin')!.addEventListener('click', () => {
  const codename = `BENJAMIN_${Date.now().toString().slice(-4)}`;
  window.api.dispatch({ type: 'RECRUIT_WORKER', role: 'BENJAMIN', codename, tier: 1 }).then((st) => {
    const wid = Object.keys(st.workers).pop();
    if (wid) window.api.dispatch({ type: 'ASSIGN_WORKER', workerId: wid, nodeId: 'node_broadcasting_hub' });
  });
  logMessage(`Recruited Benjamin Operative [${codename}]`);
});

document.getElementById('btn-recruit-elias')!.addEventListener('click', () => {
  const codename = `ELIAS_${Date.now().toString().slice(-4)}`;
  window.api.dispatch({ type: 'RECRUIT_WORKER', role: 'ELIAS', codename, tier: 1 });
  logMessage(`Recruited Elias Identity Mask Operative [${codename}]`);
});

document.getElementById('btn-restore-sanity')!.addEventListener('click', () => {
  window.api.dispatch({ type: 'RECOVER_SANITY', recoveryCents: 10000 });
  logMessage(`Secured mental sanctuary rest ($100 spent -> +25% clarity)`);
});

document.getElementById('btn-ping-tor')!.addEventListener('click', () => {
  logMessage('Pinging Tor SOCKS5 Onion Proxy circuit...');
  window.api.checkTorProxy().then(updateTorUI);
});

document.getElementById('btn-resolve-raid')?.addEventListener('click', () => {
  window.api.dispatch({ type: 'RESOLVE_POLICE_RAID', bribesPaidCents: 20000, success: true });
  logMessage(`Dispatched bribe payoff ($200.00). Surveillance breach mitigated.`, 'WARN');
});

document.getElementById('btn-save-game')?.addEventListener('click', () => {
  window.api.saveGame().then((success) => {
    if (success) {
      logMessage('💾 Game state successfully serialized to save_game.json');
    } else {
      logMessage('⚠️ Failed to save game state', 'WARN');
    }
  });
});

document.getElementById('btn-load-game')?.addEventListener('click', () => {
  window.api.loadGame().then((success) => {
    if (success) {
      logMessage('📂 Game state restored from save_game.json');
    } else {
      logMessage('⚠️ No saved game found on disk', 'WARN');
    }
  });
});

document.getElementById('btn-nuke-state')?.addEventListener('click', () => {
  const confirmed = confirm('⚠️ SCORCHED EARTH PROTOCOL: Are you sure you want to NUKE and incinerate all logs, legal heat, and active records?');
  if (confirmed) {
    window.api.nukeGame().then(() => {
      logMessage('🚨 EMERGENCY NUKE ACTIVATED! All legal heat and logs incinerated to ground zero!', 'CRIT');
    });
  }
});

// Bootstrapping
window.api.getState().then((st) => {
  updateUI(st);
  logMessage('Console initialized. Connected to local state engine.');
});

window.api.getTorStatus().then(updateTorUI);
window.api.onStateUpdate(updateUI);
window.api.onTorStatusUpdate(updateTorUI);
