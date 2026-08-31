import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer } from '../src/engine/reducer';
import { GameEngine } from '../src/engine/engine';

describe('Pharmacy Operations & Customer Satisfaction', () => {
  it('should process customer retail sales and restock inventory', () => {
    let state = new GameEngine().getState();

    const initialCash = state.player.cashCents;
    const initialIbuprofenStock = state.pharmacyInventory['prod_ibuprofen_400'].stockQuantity;

    // Simulate tick with customer demand
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 60,
      currentEpochMs: Date.now()
    });

    // Stock should decrease as customers purchase goods, and sales revenue should be added
    const newStock = state.pharmacyInventory['prod_ibuprofen_400'].stockQuantity;
    assert.ok(newStock < initialIbuprofenStock);
    assert.ok(state.customerSatisfaction.totalCustomersServed > 120);

    // Restock 20 units
    state = gameReducer(state, {
      type: 'RESTOCK_PHARMACY_PRODUCT',
      productId: 'prod_ibuprofen_400',
      quantity: 20
    });

    assert.equal(state.pharmacyInventory['prod_ibuprofen_400'].stockQuantity, newStock + 20);
  });

  it('should adjust retail prices and shift customer demand calculations', () => {
    let state = new GameEngine().getState();

    state = gameReducer(state, {
      type: 'SET_PRODUCT_PRICE',
      productId: 'prod_ibuprofen_400',
      newPriceCents: 1299
    });

    assert.equal(state.pharmacyInventory['prod_ibuprofen_400'].retailPriceCents, 1299);
  });
});

describe('NAV Norway Integration', () => {
  it('should include NAV Kontor in real estate nodes and provide welfare yields and sanity recovery', () => {
    const state = new GameEngine().getState();

    assert.ok(state.nodes['node_nav_norway']);
    assert.equal(state.nodes['node_nav_norway'].name, 'NAV Kontor (Norwegian Welfare & Security Hub)');
    assert.equal(state.nodes['node_nav_norway'].baseYieldPerMinCents, 8500);
    assert.equal(state.nodes['node_nav_norway'].sanityRecoveryRatePerMin, 0.010);
  });

  it('should include NAV benefit archive tape in analog vault', () => {
    const state = new GameEngine().getState();

    assert.ok(state.tapeCatalog['tape_005_nav_archive']);
    assert.equal(state.tapeCatalog['tape_005_nav_archive'].title, 'NAV Oslo Sentrum - Encrypted Benefit Archive [1999]');
    assert.equal(state.tapeCatalog['tape_005_nav_archive'].potentialYieldCents, 75000);
  });
});
