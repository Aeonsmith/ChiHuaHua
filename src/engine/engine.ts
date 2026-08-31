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
        alias: 'JACK',
        cashCents: 50000, // $500.00 initial capital
        sanity: 1.0,      // 100% clarity
        heat: 10.0,       // 10% base heat
        distortionIndex: 0.03
      },
      workers: {
        worker_thomas: {
          id: 'worker_thomas',
          codename: 'THOMAS',
          role: 'BENJAMIN' as any,
          status: 'ACTIVE' as any,
          tier: 1,
          salaryPerMinuteCents: 5000,
          efficiency: 2.0,
          heatGeneratedPerMin: 2.5,
          heatDissipationPerMin: 0.0,
          sanityDrainRate: -0.005,
          durability: 1.0,
          assignedNodeId: 'node_broadcasting_hub'
        },
        worker_jonas: {
          id: 'worker_jonas',
          codename: 'JONAS',
          role: 'ELIAS' as any,
          status: 'ACTIVE' as any,
          tier: 1,
          salaryPerMinuteCents: 3500,
          efficiency: 1.25,
          heatGeneratedPerMin: 0.0,
          heatDissipationPerMin: 4.0,
          sanityDrainRate: 0.01,
          durability: 1.0,
          assignedNodeId: null
        }
      },
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
        },
        node_molly_pop: {
          id: 'node_molly_pop',
          name: 'Molly Pop Confectionery (Front Store)',
          tier: 1,
          baseYieldPerMinCents: 12000, // $120.00/min
          upgradeCostCents: 200000,    // $2,000.00
          workerCapacity: 3,
          isCompromised: false,
          sanityRecoveryRatePerMin: 0.008
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
        },
        tape_003_deep_sea: {
          id: 'tape_003_deep_sea',
          title: 'Deep Sea Hydrophone Anomaly [Abyssal Log]',
          category: 'SURVEILLANCE_LOG',
          rentalCostCents: 18000,      // $180.00 rental
          sanityCost: 0.08,
          durationSeconds: 150,        // 2.5-minute window
          potentialYieldCents: 85000,  // $850.00 decode reward
          heatGenerated: 6.0,
          clues: [
            'Sub-trench acoustic pattern matched secret naval transponder',
            'Pressure hull telemetry recorded at -10,920m depth'
          ],
          glitchIntensity: 0.35
        },
        tape_004_constellation_relay: {
          id: 'tape_004_constellation_relay',
          title: 'Orion Sector Radio Telescope Decrypt',
          category: 'NUMBER_STATION',
          rentalCostCents: 30000,      // $300.00 rental
          sanityCost: 0.15,
          durationSeconds: 240,        // 4-minute window
          potentialYieldCents: 160000, // $1,600.00 decode reward
          heatGenerated: 8.0,
          clues: [
            'Star chart coordinates align with offshore broadcast beacon',
            'Binary burst synchronized with UTC sidereal time'
          ],
          glitchIntensity: 0.50
        }
      },
      activeRentals: {},
      investments: {
        inv_baby_suite: {
          id: 'inv_baby_suite',
          title: 'Designer Nursery & Baby Luxe Suite',
          category: 'FAMILY_WISHLIST',
          costCents: 250000,           // $2,500.00
          sanityBoost: 0.35,           // +35% clarity
          passiveYieldPerMinCents: 0,
          heatReduction: 10.0,
          description: 'Custom handcrafted crib, organic nursery essentials, and soothing ambient lullaby acoustics for the baby.',
          isPurchased: false
        },
        inv_sound_studio: {
          id: 'inv_sound_studio',
          title: 'Underground Sound Studio & Record Label',
          category: 'VENTURE_BUSINESS',
          costCents: 500000,           // $5,000.00
          sanityBoost: 0.15,
          passiveYieldPerMinCents: 45000, // +$450.00/min passive yield
          heatReduction: 0.0,
          description: 'Analog SSL mixing console, vintage Neumann microphones, and independent tape production mastering suite.',
          isPurchased: false
        },
        inv_vintage_supercar: {
          id: 'inv_vintage_supercar',
          title: 'Vintage 1990s Testarossa Supercar',
          category: 'LUXURY_TROPHY',
          costCents: 1200000,          // $12,000.00
          sanityBoost: 0.25,
          passiveYieldPerMinCents: 0,
          heatReduction: 0.0,
          description: 'Rosso Corsa finish, gated 5-speed manual, pop-up headlights, and pristine midnight cruiser status.',
          isPurchased: false
        },
        inv_diamond_chain: {
          id: 'inv_diamond_chain',
          title: 'Custom Iced-Out Cuban Link Chain',
          category: 'STATUS_ASSET',
          costCents: 800000,           // $8,000.00
          sanityBoost: 0.15,
          passiveYieldPerMinCents: 0,
          heatReduction: 0.0,
          description: 'Flawless VVS baguette stones with solid 18k white gold interlocking links.',
          isPurchased: false
        },
        inv_vip_club: {
          id: 'inv_vip_club',
          title: 'Subterranean VIP Lounge & Nightclub',
          category: 'VENTURE_BUSINESS',
          costCents: 2500000,          // $25,000.00
          sanityBoost: 0.10,
          passiveYieldPerMinCents: 180000, // +$1,800.00/min passive yield
          heatReduction: 0.0,
          description: 'Soundproof basement lounge with private booths, bottle service, and steady weekend cash flow.',
          isPurchased: false
        },
        inv_space_satellite: {
          id: 'inv_space_satellite',
          title: 'Orbital Private Satellite Relay Station',
          category: 'VENTURE_BUSINESS',
          costCents: 10000000,         // $100,000.00
          sanityBoost: 0.30,
          passiveYieldPerMinCents: 850000, // +$8,500.00/min passive yield
          heatReduction: 20.0,
          description: 'Dedicated low-earth-orbit transponder for global high-frequency encryption and untraceable data leasing.',
          isPurchased: false
        }
      },
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
