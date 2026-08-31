import { WorkerRole } from './worker';
import { TapeScenario } from './tape';
import { InvestmentItem } from './investment';
import { GameState } from './state';

export type GameAction =
  | { type: 'TICK'; deltaSeconds: number; currentEpochMs: number }
  | { type: 'SET_PLAYER_ALIAS'; alias: string }
  | { type: 'RECRUIT_WORKER'; role: WorkerRole; codename: string; tier?: number }
  | { type: 'ASSIGN_WORKER'; workerId: string; nodeId: string | null }
  | { type: 'RETIRE_WORKER'; workerId: string }
  | { type: 'UPGRADE_WORKER'; workerId: string }
  | { type: 'ADD_NODE'; id: string; name: string; baseYieldPerMinCents: number; tier?: number; upgradeCostCents?: number; workerCapacity?: number; sanityRecoveryRatePerMin?: number }
  | { type: 'UPGRADE_NODE'; nodeId: string }
  | { type: 'REGISTER_TAPE'; tape: TapeScenario }
  | { type: 'RENT_TAPE'; tapeId: string; currentEpochMs: number }
  | { type: 'SCRUB_TAPE_FORENSICS'; tapeId: string; effortDeltaPercent: number }
  | { type: 'REGISTER_INVESTMENT'; item: InvestmentItem }
  | { type: 'PURCHASE_INVESTMENT'; itemId: string }
  | { type: 'NUKE_STATE' }
  | { type: 'LOAD_SAVED_STATE'; state: GameState }
  | { type: 'DISMISS_ALERT'; alertId: string }
  | { type: 'RECOVER_SANITY'; recoveryCents: number }
  | { type: 'RESOLVE_POLICE_RAID'; bribesPaidCents: number; success: boolean };
