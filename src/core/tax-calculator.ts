/**
 * Tax calculation — pure functions, no I/O.
 * All amounts in cents (integer).
 */

export interface TaxConfig {
  taxRate: number;             // e.g., 8.25 (percent)
  taxAppliesToParts: boolean;
  taxAppliesToLabor: boolean;
}

export interface TaxResult {
  taxableAmountCents: number;
  taxAmountCents: number;
  rate: number;
}

/**
 * Compute tax on parts and/or labor based on shop configuration.
 */
export function calculateTax(
  partsSubtotalCents: number,
  laborSubtotalCents: number,
  config: TaxConfig,
): TaxResult {
  let taxableAmountCents = 0;

  if (config.taxAppliesToParts) {
    taxableAmountCents += partsSubtotalCents;
  }
  if (config.taxAppliesToLabor) {
    taxableAmountCents += laborSubtotalCents;
  }

  const taxAmountCents = Math.round(taxableAmountCents * (config.taxRate / 100));

  return {
    taxableAmountCents,
    taxAmountCents,
    rate: config.taxRate,
  };
}