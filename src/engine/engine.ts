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
        },
        node_nav_norway: {
          id: 'node_nav_norway',
          name: 'NAV Kontor (Norwegian Welfare & Security Hub)',
          tier: 1,
          baseYieldPerMinCents: 8500,  // $85.00/min state welfare/pension grant
          upgradeCostCents: 150000,    // $1,500.00
          workerCapacity: 2,
          isCompromised: false,
          sanityRecoveryRatePerMin: 0.010 // Social safety net restores sanity
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
        },
        tape_005_nav_archive: {
          id: 'tape_005_nav_archive',
          title: 'NAV Oslo Sentrum - Encrypted Benefit Archive [1999]',
          category: 'BLACK_LEDGER',
          rentalCostCents: 14000,      // $140.00 rental
          sanityCost: 0.05,
          durationSeconds: 160,        // 2.6-minute window
          potentialYieldCents: 75000,  // $750.00 state audit payout
          heatGenerated: 4.0,
          clues: [
            'Kommune subsidy ledger reveals untraced offshore deposit',
            'Folketrygden digital mainframe key located at BankID backup node'
          ],
          glitchIntensity: 0.30
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
      pharmacyInventory: {
        prod_ibuprofen_400: {
          id: 'prod_ibuprofen_400',
          name: 'Ibuprofen 400mg (20-Pack)',
          category: 'OVER_THE_COUNTER',
          wholesaleCostCents: 350,       // $3.50 wholesale
          retailPriceCents: 899,         // $8.99 retail
          stockQuantity: 45,
          qualityRating: 5,
          description: 'Standard anti-inflammatory pain relief medication (NSAID).'
        },
        prod_amoxicillin_500: {
          id: 'prod_amoxicillin_500',
          name: 'Amoxicillin 500mg Capsules',
          category: 'PRESCRIPTION_WELLNESS',
          wholesaleCostCents: 850,       // $8.50 wholesale
          retailPriceCents: 2499,        // $24.99 retail
          stockQuantity: 25,
          qualityRating: 5,
          description: 'Broad-spectrum beta-lactam antibiotic for bacterial infections.'
        },
        prod_multivitamin_complex: {
          id: 'prod_multivitamin_complex',
          name: 'Vitamin B-Complex & Zinc Elixir',
          category: 'VITAMINS_SUPPLEMENTS',
          wholesaleCostCents: 500,       // $5.00 wholesale
          retailPriceCents: 1450,        // $14.50 retail
          stockQuantity: 30,
          qualityRating: 5,
          description: 'Daily cellular energy booster and immune support multivitamin formula.'
        },
        prod_antiseptic_kit: {
          id: 'prod_antiseptic_kit',
          name: 'Emergency Surgical Dressing & Antiseptic',
          category: 'FIRST_AID',
          wholesaleCostCents: 600,       // $6.00 wholesale
          retailPriceCents: 1799,        // $17.99 retail
          stockQuantity: 20,
          qualityRating: 4,
          description: 'Sterile trauma dressing pads and povidone-iodine antiseptic solution.'
        }
      },
      blackMarketInventory: {
        comm_neuro_stimulant: {
          id: 'comm_neuro_stimulant',
          name: 'Class-IV Cognitive Neuro-Stimulant',
          codename: 'SYNTH_SPEED_01',
          tier: 2,
          wholesaleCostCents: 4500,     // $45.00
          retailPriceCents: 12000,      // $120.00
          stockUnits: 15,
          heatGeneratedPerSale: 1.2,
          customerDemandRate: 4,
          description: 'High-potency synthesized cognitive enhancer yielding rapid cash turnover with legal exposure.'
        },
        comm_botanical_resin: {
          id: 'comm_botanical_resin',
          name: 'High-Altitude Concentrated Herbal Resin',
          codename: 'BLACK_HASH_RESIN',
          tier: 1,
          wholesaleCostCents: 2000,     // $20.00
          retailPriceCents: 5500,       // $55.00
          stockUnits: 25,
          heatGeneratedPerSale: 0.6,
          customerDemandRate: 6,
          description: 'Traditional compressed aromatic botanical extract with broad street demand.'
        },
        comm_clinical_tranquilizer: {
          id: 'comm_clinical_tranquilizer',
          name: 'Clinical Sedative Compound (Blister Strip)',
          codename: 'BENZO_TRANQ_90',
          tier: 2,
          wholesaleCostCents: 6000,     // $60.00
          retailPriceCents: 15000,      // $150.00
          stockUnits: 10,
          heatGeneratedPerSale: 1.8,
          customerDemandRate: 3,
          description: 'Prescription-grade neuro-inhibitor traded in underground clinic channels.'
        },
        comm_mycelial_alkaloid: {
          id: 'comm_mycelial_alkaloid',
          name: 'Purified Botanical Neuro-Alkaloid',
          codename: 'MYCELIAL_SPORE_EXTRACT',
          tier: 1,
          wholesaleCostCents: 3500,     // $35.00
          retailPriceCents: 9500,       // $95.00
          stockUnits: 18,
          heatGeneratedPerSale: 0.8,
          customerDemandRate: 5,
          description: 'Refined natural psychedelic alkaloid extract popular among underground creative circuits.'
        }
      },
      customerSatisfaction: {
        satisfactionScore: 0.88,         // 88% customer satisfaction
        loyaltyTier: 'GOLD',
        totalCustomersServed: 120,
        stockoutPenaltyCount: 0
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
