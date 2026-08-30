import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer } from '../src/engine/reducer';
import { GameEngine } from '../src/engine/engine';
import { GameState, WorkerRole, WorkerStatus } from '../src/types';

function createMockState(overrides?: Partial<GameState>): GameState {
  return {
    player: {
      alias: 'TEST_OPERATOR',
      cashCents: 100000, // $1,000.00
      sanity: 1.0,       // 100%
      heat: 0.0,         // 0%
      distortionIndex: 0.0,
      ...overrides?.player
    },
    workers: overrides?.workers || {},
    nodes: overrides?.nodes || {
      test_node: {
        id: 'test_node',
        name: 'Test Safehouse Hub',
        tier: 1,
        baseYieldPerMinCents: 6000, // $60.00/min = $1.00/sec = 100 cents/sec
        upgradeCostCents: 50000,
        workerCapacity: 2,
        isCompromised: false,
        sanityRecoveryRatePerMin: 0.0
      }
    },
    tapeCatalog: overrides?.tapeCatalog || {
      mock_tape: {
        id: 'mock_tape',
        title: 'Mock Surveillance Tape',
        category: 'SURVEILLANCE_LOG',
        rentalCostCents: 15000, // $150.00
        sanityCost: 0.10,
        durationSeconds: 60,
        potentialYieldCents: 50000, // $500.00
        heatGenerated: 10.0,
        clues: ['CLUE_1'],
        glitchIntensity: 0.3
      }
    },
    activeRentals: overrides?.activeRentals || {},
    unlockedClues: overrides?.unlockedClues || [],
    runtime: {
      lastTickEpochMs: 1000000,
      totalTicksElapsed: 0,
      isRaidActive: false,
      isClockSkewed: false,
      unresolvedAlerts: [],
      ...overrides?.runtime
    }
  };
}

describe('Economic Mechanics', () => {
  it('should calculate passive node yield and deduct payroll on tick', () => {
    let state = createMockState();

    // Recruit Tier 1 Benjamin ($50.00/min salary = 5000 cents/min; efficiency = 2.0x)
    state = gameReducer(state, {
      type: 'RECRUIT_WORKER',
      role: WorkerRole.BENJAMIN,
      codename: 'Fin-1',
      tier: 1
    });

    const workerId = Object.keys(state.workers)[0];
    assert.ok(workerId);

    // Assign to node ($60/min base * 2.0 = $120/min yield = 12000 cents/min)
    state = gameReducer(state, {
      type: 'ASSIGN_WORKER',
      workerId,
      nodeId: 'test_node'
    });

    // Net income per minute: 12000 yield - 5000 salary = 7000 cents/min
    // Simulate 60 seconds (1 minute)
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 60,
      currentEpochMs: 1060000
    });

    // Initial cash 100000 + 7000 = 107000 cents ($1,070.00)
    assert.equal(state.player.cashCents, 107000);
  });

  it('should scale yield with Benjamin tier promotions', () => {
    let state = createMockState();

    // Tier 2 Benjamin: efficiency = 1.5 + 2 * 0.5 = 2.5x; salary = 5000 * 2 = 10000 cents/min
    state = gameReducer(state, {
      type: 'RECRUIT_WORKER',
      role: WorkerRole.BENJAMIN,
      codename: 'Fin-2',
      tier: 2
    });

    const workerId = Object.keys(state.workers)[0];

    state = gameReducer(state, {
      type: 'ASSIGN_WORKER',
      workerId,
      nodeId: 'test_node'
    });

    // Node: 6000 * 2.5 = 15000 cents/min yield; Salary: 10000 cents/min -> Net: +5000 cents/min
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 60,
      currentEpochMs: 1060000
    });

    assert.equal(state.player.cashCents, 105000);
  });

  it('should upgrade real estate nodes and deduct cash', () => {
    let state = createMockState({
      player: {
        alias: 'TEST',
        cashCents: 100000,
        sanity: 1.0,
        heat: 0.0,
        distortionIndex: 0.0
      }
    });

    // Upgrade cost for test_node is 50000 cents
    state = gameReducer(state, {
      type: 'UPGRADE_NODE',
      nodeId: 'test_node'
    });

    assert.equal(state.player.cashCents, 50000);
    assert.equal(state.nodes.test_node.tier, 2);
    assert.equal(state.nodes.test_node.workerCapacity, 3);
    assert.equal(state.nodes.test_node.baseYieldPerMinCents, Math.round(6000 * 2.2));
  });

  it('should deduct rental cost on lease and credit reward on forensics decode', () => {
    let state = createMockState({
      player: {
        alias: 'TEST',
        cashCents: 50000,
        sanity: 1.0,
        heat: 0.0,
        distortionIndex: 0.0
      }
    });

    // Rent tape ($150 = 15000 cents)
    state = gameReducer(state, {
      type: 'RENT_TAPE',
      tapeId: 'mock_tape',
      currentEpochMs: 1000000
    });

    assert.equal(state.player.cashCents, 35000);
    assert.ok(state.activeRentals['mock_tape']);
    assert.equal(state.activeRentals['mock_tape'].status, 'RENTED');

    // Scrub 50% forensics
    state = gameReducer(state, {
      type: 'SCRUB_TAPE_FORENSICS',
      tapeId: 'mock_tape',
      effortDeltaPercent: 50
    });
    assert.equal(state.activeRentals['mock_tape'].status, 'RENTED');

    // Scrub remaining 50% forensics (Decodes tape, unlocks $500 = 50000 cents yield)
    state = gameReducer(state, {
      type: 'SCRUB_TAPE_FORENSICS',
      tapeId: 'mock_tape',
      effortDeltaPercent: 50
    });

    assert.equal(state.activeRentals['mock_tape'].status, 'DECODED');
    assert.equal(state.player.cashCents, 35000 + 50000);
    assert.deepEqual(state.unlockedClues, ['CLUE_1']);
  });
});

describe('Heat Mechanics & Legal Risk', () => {
  it('should accumulate heat from Benjamin operatives and scrub heat via Elias operatives', () => {
    let state = createMockState();

    // Recruit Tier 1 Benjamin (+2.5 heat/min)
    state = gameReducer(state, {
      type: 'RECRUIT_WORKER',
      role: WorkerRole.BENJAMIN,
      codename: 'HeatGen',
      tier: 1
    });

    // Simulate 2 minutes (+5.0 heat total)
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 120,
      currentEpochMs: 1120000
    });

    assert.equal(state.player.heat, 5.0);

    // Recruit Tier 1 Elias (-4.0 heat/min)
    state = gameReducer(state, {
      type: 'RECRUIT_WORKER',
      role: WorkerRole.ELIAS,
      codename: 'CoverMask',
      tier: 1
    });

    // Net heat rate: +2.5 - 4.0 = -1.5 heat/min
    // Simulate 2 minutes (-3.0 heat) -> Heat becomes 5.0 - 3.0 = 2.0
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 120,
      currentEpochMs: 1240000
    });

    assert.equal(Math.round(state.player.heat * 100) / 100, 2.0);
  });

  it('should trigger operative burnout when heat exceeds scrutiny threshold (>65%)', () => {
    let state = createMockState({
      player: {
        alias: 'HIGH_HEAT',
        cashCents: 100000,
        sanity: 1.0,
        heat: 80.0, // Critical heat
        distortionIndex: 0.24
      }
    });

    state = gameReducer(state, {
      type: 'RECRUIT_WORKER',
      role: WorkerRole.BENJAMIN,
      codename: 'Exposed',
      tier: 1
    });

    const workerId = Object.keys(state.workers)[0];

    // Benjamin durability decays under heat > 65 at rate: 0.03 * dtMin
    // For 20 minutes: 20 * 0.03 = 0.60 decay -> durability becomes 1.0 - 0.6 = 0.40
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 1200, // 20 min
      currentEpochMs: 2200000
    });

    assert.equal(state.workers[workerId].durability, 0.4);
    assert.equal(state.workers[workerId].status, WorkerStatus.ACTIVE);

    // Another 20 minutes (0.60 decay) -> durability <= 0, becomes BURNT
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 1200,
      currentEpochMs: 3400000
    });

    assert.equal(state.workers[workerId].durability, 0.0);
    assert.equal(state.workers[workerId].status, WorkerStatus.BURNT);
  });

  it('should trigger police raid when heat reaches 95% and resolve it with bribes', () => {
    let state = createMockState({
      player: {
        alias: 'RAID_TARGET',
        cashCents: 50000,
        sanity: 1.0,
        heat: 94.0,
        distortionIndex: 0.282
      }
    });

    // Add a Benjamin generating heat (+2.5/min)
    state = gameReducer(state, {
      type: 'RECRUIT_WORKER',
      role: WorkerRole.BENJAMIN,
      codename: 'RaidCatalyst',
      tier: 1
    });

    // Tick 1 minute (+2.5 heat -> 96.5%)
    state = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 60,
      currentEpochMs: 2000000
    });

    assert.ok(state.player.heat >= 95.0);
    assert.equal(state.runtime.isRaidActive, true);
    assert.ok(state.runtime.unresolvedAlerts.some(a => a.type === 'POLICE_RAID'));

    // Resolve raid by paying bribes ($200 = 20000 cents)
    // Cash before raid resolution: 50000 initial - 5000 salary (1 min) = 45000
    // After 20000 bribe: 45000 - 20000 = 25000 cents
    state = gameReducer(state, {
      type: 'RESOLVE_POLICE_RAID',
      bribesPaidCents: 20000,
      success: true
    });

    assert.equal(state.player.cashCents, 25000);
    assert.equal(state.runtime.isRaidActive, false);
    assert.equal(state.player.heat, 15.0);
  });
});

describe('Distortion Index Pipeline', () => {
  it('should accurately compute distortion index from sanity and heat levels', () => {
    // Formula: distortion = (1.0 - sanity) * 0.7 + (heat / 100.0) * 0.3
    const state = createMockState({
      player: {
        alias: 'MIND_BENT',
        cashCents: 10000,
        sanity: 0.60, // 40% sanity loss -> 0.40 * 0.7 = 0.28
        heat: 50.0,   // 50% heat -> 0.50 * 0.3 = 0.15
        distortionIndex: 0.0
      }
    });

    const nextState = gameReducer(state, {
      type: 'TICK',
      deltaSeconds: 0,
      currentEpochMs: 1000000
    });

    // Expected: 0.28 + 0.15 = 0.43
    const expectedDistortion = 0.43;
    assert.ok(Math.abs(nextState.player.distortionIndex - expectedDistortion) < 0.0001);
  });
});

describe('GameEngine Integration', () => {
  it('should initialize, dispatch actions, and update state synchronously', () => {
    const engine = new GameEngine();

    engine.dispatch({
      type: 'RECRUIT_WORKER',
      role: WorkerRole.BENJAMIN,
      codename: 'DirectRecruit',
      tier: 1
    });

    const state = engine.getState();
    const recruited = Object.values(state.workers).find(w => w.codename === 'DIRECTRECRUIT');
    assert.ok(recruited);
    assert.equal(recruited.role, WorkerRole.BENJAMIN);
  });
});
