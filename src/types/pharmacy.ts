export interface PharmacyProduct {
  id: string;
  name: string;
  category: 'OVER_THE_COUNTER' | 'PRESCRIPTION_WELLNESS' | 'VITAMINS_SUPPLEMENTS' | 'FIRST_AID';
  wholesaleCostCents: number;
  retailPriceCents: number;
  stockQuantity: number;
  qualityRating: number; // 1 to 5
  description: string;
}

export interface CustomerSatisfactionState {
  satisfactionScore: number; // 0.0 to 1.0 (0% to 100%)
  loyaltyTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  totalCustomersServed: number;
  stockoutPenaltyCount: number;
}
