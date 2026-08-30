import { GameState, GameAction, Middleware, Dispatch } from '../types';
import { gameReducer } from './reducer';

export interface GameEngineOptions {
  initialState?: GameState;
  middlewares?: Middleware[];
  tickIntervalMs?: number;
}

export class GameEngine {
  private state: GameState;
  private timerHandle: NodeJS.Timeout | null = null;
  private readonly TICK_INTERVAL_MS: number;
  private listeners: Array<(state: GameState) => void> = [];
  private dispatchPipeline: Dispatch;

  constructor(options?: GameEngineOptions) {
    this.TICK_INTERVAL_MS = options?.tickIntervalMs || 350;

    this.state = options?.initialState || {
      player: {
        alias: 'OPERATOR_0',
        cashCents: 50000, // $500.00 initial capital
        sanity: 1.0,      // 100% clarity
        heat: 10.0,       // 10% base heat
        distortionIndex: 0.03
      },
      workers: {},
      nodes: {
        node_broadcasting_hub: {
          id: 'node_broadcasting_hub',
          name: 'Abandoned VHF Station',
          tier: 1,
          baseYieldPerMinCents: 15000, // $150.00/min
          upgradeCostCents: 300000,    // $3,000.00
          workerCapacity: 2,
          isCompromised: false,
          sanityRecoveryRatePerMin: 0.005
        }
      },
      tapeCatalog: {
        tape_001_vhf_leak: {
          id: 'tape_001_vhf_leak',
          title: 'VHF-88 Broadcast Intercept [1994]',
          category: 'SURVEILLANCE_LOG',
          rentalCostCents: 10000,      // $100.00 rental
          sanityCost: 0.05,
          durationSeconds: 120,        // 2-minute countdown window
          potentialYieldCents: 45000,  // $450.00 decode reward
          heatGenerated: 5.0,
          clues: [
            'CODENAME::ECHELON_ALPHA mentioned at timestamp 04:12',
            'Frequency band shifted to 142.850 MHz'
          ],
          glitchIntensity: 0.25
        },
        tape_002_black_ledger: {
          id: 'tape_002_black_ledger',
          title: 'Offshore Holding Shell Audit #7B',
          category: 'BLACK_LEDGER',
          rentalCostCents: 25000,      // $250.00 rental
          sanityCost: 0.12,
          durationSeconds: 180,        // 3-minute window
          potentialYieldCents: 120000, // $1,200.00 decode reward
          heatGenerated: 12.0,
          clues: [
            'Bearer bond routing coordinates found in header padding',
            'Ghost bank account linked to Pacific Haven trust'
          ],
          glitchIntensity: 0.45
        }
      },
      activeRentals: {},
      unlockedClues: [],
      runtime: {
        lastTickEpochMs: Date.now(),
        totalTicksElapsed: 0,
        isRaidActive: false,
        isClockSkewed: false,
        unresolvedAlerts: []
      }
    };

    // Setup middleware dispatch pipeline
    const baseDispatch: Dispatch = (action: GameAction) => {
      this.state = gameReducer(this.state, action);
      this.notifyListeners();
    };

    const middlewares = options?.middlewares || [];
    this.dispatchPipeline = this.composeMiddleware(middlewares, baseDispatch);
  }

  private composeMiddleware(middlewares: Middleware[], baseDispatch: Dispatch): Dispatch {
    const middlewareAPI = {
      getState: () => this.state,
      dispatch: (action: GameAction) => this.dispatch(action)
    };

    const chain = middlewares.map(m => m(middlewareAPI.getState, middlewareAPI.dispatch));
    return chain.reduceRight((next, fn) => fn(next), baseDispatch);
  }

  /**
   * Anti-Clock-Skew Monotonic Tick Loop
   */
  public start(): void {
    if (this.timerHandle) return;

    let previousPerformanceNow = performance.now();
    let previousEpochMs = Date.now();

    this.timerHandle = setInterval(() => {
      const currentPerformanceNow = performance.now();
      const currentEpochMs = Date.now();

      // Calculate elapsed seconds using monotonic clock
      let deltaSeconds = (currentPerformanceNow - previousPerformanceNow) / 1000.0;
      previousPerformanceNow = currentPerformanceNow;

      // Anti-clock-skew detection (wall clock shift vs monotonic clock)
      const expectedEpochDelta = deltaSeconds * 1000.0;
      const actualEpochDelta = currentEpochMs - previousEpochMs;
      const skewMs = Math.abs(actualEpochDelta - expectedEpochDelta);
      previousEpochMs = currentEpochMs;

      // If clock skew exceeds threshold or process was suspended, clamp delta to prevent runaway calculations
      if (skewMs > 2000.0 || deltaSeconds > 5.0) {
        this.state.runtime.isClockSkewed = true;
        deltaSeconds = Math.min(deltaSeconds, 1.0); // Clamp to 1 second
      } else {
        this.state.runtime.isClockSkewed = false;
      }

      this.dispatch({
        type: 'TICK',
        deltaSeconds,
        currentEpochMs
      });
    }, this.TICK_INTERVAL_MS);
  }

  public stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  public dispatch(action: GameAction): void {
    this.dispatchPipeline(action);
  }

  public subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public getState(): GameState {
    return this.state;
  }
}
