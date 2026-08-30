export interface RealEstateNode {
  id: string;
  name: string;
  tier: number;                     // Level 1 to 5
  baseYieldPerMinCents: number;     // Passive base capital generation
  upgradeCostCents: number;         // Cost to elevate hub tier
  workerCapacity: number;           // Maximum operatives supported
  isCompromised: boolean;           // Whether node has been raided or exposed
  sanityRecoveryRatePerMin: number; // Passive clarity restoration if operated as safehouse
}
