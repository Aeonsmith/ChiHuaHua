export type InvestmentCategory =
  | 'LUXURY_TROPHY'
  | 'VENTURE_BUSINESS'
  | 'STATUS_ASSET'
  | 'FAMILY_WISHLIST';

export interface InvestmentItem {
  id: string;
  title: string;
  category: InvestmentCategory;
  costCents: number;
  sanityBoost: number;                // Instant or passive clarity gain
  passiveYieldPerMinCents: number;   // Income stream added to cash flow
  heatReduction: number;              // Instant heat relief
  description: string;
  isPurchased: boolean;
}
