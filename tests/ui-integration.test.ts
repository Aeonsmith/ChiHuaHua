import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/engine/engine';
import { TorManager } from '../src/network/tor-manager';
import { TerminalDashboard } from '../src/ui/dashboard';
import { WorkerRole } from '../src/types';

describe('UI Dashboard - End-to-End Integration', () => {
  it('should execute command handlers and reflect state mutations in rendered view', () => {
    const engine = new GameEngine();
    const torManager = new TorManager({ enabled: false });
    const dashboard = new TerminalDashboard(engine, torManager);

    // Initial render verification
    let renderOutput = dashboard.render();
    assert.ok(renderOutput.includes('JACK'));
    assert.ok(renderOutput.includes('THOMAS'));
    assert.ok(renderOutput.includes('JONAS'));
    assert.ok(renderOutput.includes('No tapes currently leased'));

    // Test "Promote Thomas"
    dashboard.handleCommand('PROMOTE THOMAS');
    let state = engine.getState();
    assert.equal(state.workers['worker_thomas'].tier, 2);

    // Test "Fire Jonas"
    dashboard.handleCommand('FIRE JONAS');
    state = engine.getState();
    assert.equal(state.workers['worker_jonas'], undefined);

    // Command 1: Recruit Benjamin
    dashboard.handleCommand('1');
    state = engine.getState();
    const benjamins = Object.values(state.workers).filter(w => w.role === WorkerRole.BENJAMIN);
    assert.equal(benjamins.length, 2); // Thomas + new Benjamin
    assert.equal(benjamins[0].assignedNodeId, 'node_broadcasting_hub');

    renderOutput = dashboard.render();
    assert.ok(renderOutput.includes('BENJAMIN'));
    assert.ok(renderOutput.includes('node_broadcasting_hub'));

    // Command 2: Recruit Elias
    dashboard.handleCommand('2');
    state = engine.getState();
    const eliases = Object.values(state.workers).filter(w => w.role === WorkerRole.ELIAS);
    assert.equal(eliases.length, 1);

    renderOutput = dashboard.render();
    assert.ok(renderOutput.includes('ELIAS'));

    // Command 3: Lease Tape
    dashboard.handleCommand('3');
    state = engine.getState();
    assert.ok(state.activeRentals['tape_001_vhf_leak']);
    assert.equal(state.activeRentals['tape_001_vhf_leak'].status, 'RENTED');

    renderOutput = dashboard.render();
    assert.ok(renderOutput.includes('VHF-88 Broadcast Intercept [1994]'));
    assert.ok(renderOutput.includes('RENTED'));

    // Command 4: Scrub Forensics (+50%)
    dashboard.handleCommand('4');
    state = engine.getState();
    assert.equal(state.activeRentals['tape_001_vhf_leak'].progressPercent, 50);

    // Command 4 again: (+50% -> 100% -> Decoded)
    dashboard.handleCommand('4');
    state = engine.getState();
    assert.equal(state.activeRentals['tape_001_vhf_leak'].status, 'DECODED');

    renderOutput = dashboard.render();
    assert.ok(renderOutput.includes('[DECODED]'));
    assert.ok(renderOutput.includes('CODENAME::ECHELON_ALPHA'));

    // Command 6: Recover Sanity ($100 spent)
    const cashBeforeSanity = state.player.cashCents;
    dashboard.handleCommand('6');
    state = engine.getState();
    assert.equal(state.player.cashCents, cashBeforeSanity - 10000);

    // Command Q: Detach
    dashboard.handleCommand('Q');
  });

  it('should render police raid warnings when critical heat is detected', () => {
    const engine = new GameEngine();
    const torManager = new TorManager();
    const dashboard = new TerminalDashboard(engine, torManager);

    // Trigger raid state
    engine.dispatch({
      type: 'TICK',
      deltaSeconds: 0,
      currentEpochMs: Date.now()
    });

    // Manually force legal heat to 96%
    const state = engine.getState();
    state.player.heat = 96.0;
    state.runtime.isRaidActive = true;

    const renderOutput = dashboard.render();
    assert.ok(renderOutput.includes('SURVEILLANCE BREACH: POLICE RAID ACTIVE'));

    // Command 5: Resolve raid with bribes
    dashboard.handleCommand('5');
    const resolvedState = engine.getState();
    assert.equal(resolvedState.runtime.isRaidActive, false);
    assert.equal(resolvedState.player.heat, 15.0);

    const updatedRender = dashboard.render();
    assert.equal(updatedRender.includes('POLICE RAID ACTIVE'), false);
  });
});
