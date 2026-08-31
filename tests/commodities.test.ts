import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer } from '../src/engine/reducer';
import { GameEngine } from '../src/engine/engine';

describe('Black Market & High-Risk Commodities', () => {
  it('should process sales of black market goods and accumulate legal heat', () => {
    let state = new GameEngine().getState();

    const initialHeat = state.player.heat;
    const initialStimulantStock = state.blackMarketInventory['comm_neuro_stimulant'].stockUnits;

    // Simulate 1 minute of ticks
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 60,
      currentEpochMs: Date.now()
    });

    const newStock = state.blackMarketInventory['comm_neuro_stimulant'].stockUnits;
    assert.ok(newStock < initialStimulantStock);
    assert.ok(state.player.heat > initialHeat);
  });

  it('should allow importing additional black market batches and increase suspicion', () => {
    let state = new GameEngine().getState();

    state.player.cashCents = 500000;
    const initialStock = state.blackMarketInventory['comm_clinical_tranquilizer'].stockUnits;

    state = gameReducer(state, {
      type: 'RESTOCK_BLACK_MARKET',
      commodityId: 'comm_clinical_tranquilizer',
      units: 10
    });

    assert.equal(state.blackMarketInventory['comm_clinical_tranquilizer'].stockUnits, initialStock + 10);
  });
});
