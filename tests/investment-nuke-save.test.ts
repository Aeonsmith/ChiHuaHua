import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { gameReducer } from '../src/engine/reducer';
import { GameEngine } from '../src/engine/engine';
import { SaveManager } from '../src/storage/save-manager';
import { GameState } from '../src/types';

describe('Investments & Wishlist System', () => {
  it('should purchase investment, deduct capital, and apply sanity/yield boosts', () => {
    const engine = new GameEngine();
    let state = engine.getState();

    // Give player $10,000.00
    state.player.cashCents = 1000000;
    state.player.sanity = 0.50;
    state.player.heat = 20.0;

    // Purchase Designer Nursery & Baby Luxe Suite ($2,500 = 250000 cents)
    const nextState = gameReducer(state, {
      type: 'PURCHASE_INVESTMENT',
      itemId: 'inv_baby_suite'
    });

    assert.equal(nextState.player.cashCents, 750000);
    assert.equal(nextState.player.sanity, 0.50 + 0.35);
    assert.equal(nextState.player.heat, 10.0);
    assert.equal(nextState.investments['inv_baby_suite'].isPurchased, true);
    assert.ok(nextState.runtime.unresolvedAlerts.some(a => a.type === 'INVESTMENT_ACQUIRED'));
  });

  it('should generate passive revenue from business venture investments on tick', () => {
    let state = new GameEngine().getState();

    // Purchase Sound Studio ($5,000; yields $450/min = 45000 cents/min)
    state.player.cashCents = 1000000;
    state = gameReducer(state, {
      type: 'PURCHASE_INVESTMENT',
      itemId: 'inv_sound_studio'
    });

    const cashAfterBuy = state.player.cashCents;

    // Simulate 2 minutes of ticks (+90000 cents yield, minus worker salaries for Thomas/Jonas)
    // Thomas (5000) + Jonas (3500) = 8500 * 2 = 17000 upkeep
    // Net cash gain = 90000 - 17000 = 73000 cents
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 120,
      currentEpochMs: Date.now()
    });

    assert.ok(state.player.cashCents > cashAfterBuy);
  });
});

describe('Emergency Nuke (Scorched Earth Protocol)', () => {
  it('should incinerate all legal heat, active police raids, and reset state', () => {
    const engine = new GameEngine();
    let state = engine.getState();

    state.player.heat = 98.0;
    state.player.sanity = 0.20;
    state.runtime.isRaidActive = true;

    const nukedState = gameReducer(state, { type: 'NUKE_STATE' });

    assert.equal(nukedState.player.heat, 0.0);
    assert.equal(nukedState.player.sanity, 1.0);
    assert.equal(nukedState.player.distortionIndex, 0.0);
    assert.equal(nukedState.runtime.isRaidActive, false);
    assert.equal(nukedState.player.cashCents, 100000); // $1,000.00 clean capital
    assert.ok(nukedState.runtime.unresolvedAlerts.some(a => a.type === 'NUKE_EXECUTED'));
  });
});

describe('Save and Load Game System', () => {
  it('should serialize game state to disk and restore it accurately', () => {
    const testSavePath = path.join(__dirname, 'test_save_game.json');
    const saveManager = new SaveManager(testSavePath);

    const engine = new GameEngine();
    let state = engine.getState();
    state.player.cashCents = 999999;
    state.player.alias = 'CUSTOM_JACK';

    // Save
    const saved = saveManager.saveGame(state);
    assert.equal(saved, true);
    assert.equal(saveManager.saveExists(), true);

    // Load
    const loaded = saveManager.loadGame();
    assert.ok(loaded);
    assert.equal(loaded?.player.cashCents, 999999);
    assert.equal(loaded?.player.alias, 'CUSTOM_JACK');

    // Cleanup
    saveManager.deleteSave();
    assert.equal(saveManager.saveExists(), false);
  });
});
