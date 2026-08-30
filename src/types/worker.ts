export enum WorkerRole {
  BENJAMIN = 'BENJAMIN', // High-yield cash generation / capital operative
  ELIAS = 'ELIAS',       // Identity mask / surveillance countermeasure operative
  OPERATOR = 'OPERATOR'  // Standard node operator
}

export enum WorkerStatus {
  ACTIVE = 'ACTIVE',
  BURNT = 'BURNT',               // Identity exposed or exhausted
  INCARCERATED = 'INCARCERATED',
  ON_COOLDOWN = 'ON_COOLDOWN'
}

export interface Worker {
  id: string;
  codename: string;
  role: WorkerRole;
  status: WorkerStatus;
  tier: number;                  // Level 1 to 5
  salaryPerMinuteCents: number;  // Base upkeep cost ($/min in cents)
  efficiency: number;            // Multiplier (1.0 = baseline)
  heatGeneratedPerMin: number;   // Passive legal risk added
  heatDissipationPerMin: number; // Passive legal risk removed
  sanityDrainRate: number;       // Impact on player's mental clarity
  durability: number;            // 0.0 to 1.0 (Burnout indicator)
  assignedNodeId: string | null; // Attached real estate / surveillance hub
}
