export type TapeCategory =
  | 'SURVEILLANCE_LOG'
  | 'FOUND_FOOTAGE'
  | 'FINANCIAL_DECREE'
  | 'BLACK_LEDGER'
  | 'NUMBER_STATION';

export type TapeStatus = 'AVAILABLE' | 'RENTED' | 'DECODED' | 'CORRUPTED' | 'EXPIRED';

export interface TapeScenario {
  id: string;
  title: string;
  category: TapeCategory;
  rentalCostCents: number;
  sanityCost: number;             // Sanity drained upon rental / scrubbing
  durationSeconds: number;        // Countdown duration window (e.g. 24h = 86400s, or fast-cycle)
  potentialYieldCents: number;    // Reward payout upon successful decode
  heatGenerated: number;          // Legal heat incurred
  clues: string[];                // Cryptic narrative fragments
  glitchIntensity: number;        // 0.0 to 1.0 (Corrupted tape noise)
}

export interface ActiveTapeRental {
  tapeId: string;
  rentedAtEpochMs: number;
  expiresAtEpochMs: number;
  remainingSeconds: number;
  status: TapeStatus;
  progressPercent: number;        // 0.0 to 100.0 (Forensics scrubbing progress)
}
