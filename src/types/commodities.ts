export interface BlackMarketCommodity {
  id: string;
  name: string;
  codename: string;
  tier: number; // Tier 1 (Low Risk) to Tier 3 (Severe Scrutiny)
  wholesaleCostCents: number;
  retailPriceCents: number;
  stockUnits: number;
  heatGeneratedPerSale: number; // Legal risk added per batch sold
  customerDemandRate: number;
  description: string;
}
