/**
 * Shop fees & miscellaneous charges — pure functions.
 * All amounts in cents.
 */

export interface ShopFeeConfig {
  /** Percentage-based fee (e.g., 5 = 5% of parts+ labor subtotal) */
  shopFeePercent: number;
  /** Cap on the percentage-based fee in cents */
  shopFeeCapCents: number;
  /** Flat fee override (if > 0, use this instead of percentage) */
  shopFeeFlatCents: number;
  /** Environmental/disposal fee */
  disposalFeeCents: number;
  /** Default shipping charge */
  shippingDefaultCents: number;
}

export interface FeesResult {
  shopFeeCents: number;
  disposalFeeCents: number;
  shippingCents: number;
  miscFeesCents: number;       // sum of all custom misc items
  totalFeesCents: number;
}

/**
 * Calculate all shop fees based on subtotals.
 */
export function calculateFees(
  partsSubtotalCents: number,
  laborSubtotalCents: number,
  miscLineItemsTotalCents: number,
  config: ShopFeeConfig,
): FeesResult {
  const baseAmount = partsSubtotalCents + laborSubtotalCents;

  // Shop fee: prefer flat, otherwise percentage with cap
  let shopFeeCents: number;
  if (config.shopFeeFlatCents > 0) {
    shopFeeCents = config.shopFeeFlatCents;
  } else {
    const percentFee = Math.round(baseAmount * (config.shopFeePercent / 100));
    shopFeeCents = Math.min(percentFee, config.shopFeeCapCents);
  }

  return {
    shopFeeCents,
    disposalFeeCents: config.disposalFeeCents,
    shippingCents: config.shippingDefaultCents,
    miscFeesCents: miscLineItemsTotalCents,
    totalFeesCents: shopFeeCents + config.disposalFeeCents + config.shippingDefaultCents + miscLineItemsTotalCents,
  };
}