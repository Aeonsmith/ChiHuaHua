import { Worker } from './worker';
import { RealEstateNode } from './node';
import { TapeScenario, ActiveTapeRental } from './tape';
import { InvestmentItem } from './investment';
import { PharmacyProduct, CustomerSatisfactionState } from './pharmacy';

export interface PlayerState {
  alias: string;
  cashCents: number;
  sanity: number;          // 0.0 (Psychosis/Heavy Glitch) to 1.0 (Full Clarity)
  heat: number;            // 0.0 to 100.0 (Legal risk / Raid threshold)
  distortionIndex: number; // 0.0 to 1.0 (Direct shader uniform feed)
}

export interface GameAlert {
  id: string;
  type: 'POLICE_RAID' | 'WORKER_BURNOUT' | 'TAPE_EXPIRED' | 'SANITY_COLLAPSE' | 'DECRYPTION_SUCCESS' | 'INVESTMENT_ACQUIRED' | 'NUKE_EXECUTED' | 'PHARMACY_RESTOCKED' | 'PHARMACY_SALE';
  message: string;
  timestamp: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface RuntimeState {
  lastTickEpochMs: number;
  totalTicksElapsed: number;
  isRaidActive: boolean;
  isClockSkewed: boolean;
  unresolvedAlerts: GameAlert[];
}

export interface GameState {
  player: PlayerState;
  workers: Record<string, Worker>;
  nodes: Record<string, RealEstateNode>;
  tapeCatalog: Record<string, TapeScenario>;
  activeRentals: Record<string, ActiveTapeRental>;
  investments: Record<string, InvestmentItem>;
  pharmacyInventory: Record<string, PharmacyProduct>;
  customerSatisfaction: CustomerSatisfactionState;
  unlockedClues: string[];
  runtime: RuntimeState;
}

export interface SimulationState {
  cashCents: number;
  totalHeat: number;
  sanityLevel: number;
  activeWorkers: Map<string, Worker>;
  assignedNodes: Map<string, { baseYieldCents: number }>;
}
