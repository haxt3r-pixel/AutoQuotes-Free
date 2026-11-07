/**
 * Quote Calculation Engine — orchestrates the full pricing pipeline.
 * All monetary values in cents (integers).
 *
 * Pipeline:
 *   1. Parts Subtotal  = Σ (unit_cost × (1 + markup%) × qty)
 *   2. Labor Subtotal  = Σ (unit_price × hours)
 *   3. Misc Subtotal   = Σ misc line items
 *   4. Shop Fees       = configurable % of parts+labor subtotal (capped)
 *   5. Pre-Tax Total   = 1 + 2 + 3 + 4
 *   6. Tax             = tax_rate% × taxable portions
 *   7. Shipping        = passed through
 *   8. GRAND TOTAL     = 5 + 6 + 7
 */

import { calculateTax, type TaxConfig } from './tax-calculator.js';
import { calculateFees, type ShopFeeConfig } from './fee-calculator.js';

// ── Types ──

export interface QuoteSettings {
  laborRateCents: number;
  taxConfig: TaxConfig;
  feeConfig: ShopFeeConfig;
  defaultMarkupPercent: number;
}

export interface LineItemInput {
  itemType: 'part' | 'labor' | 'misc' | 'fee' | 'shipping';
  unitCostCents: number;
  markupPercent: number;
  quantity: number;            // hours for labor, qty for parts
}

export interface CalculatedLineItem {
  itemType: LineItemInput['itemType'];
  unitCostCents: number;
  markupPercent: number;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface QuoteTotals {
  partsSubtotalCents: number;
  laborSubtotalCents: number;
  miscSubtotalCents: number;
  shopFeeCents: number;
  disposalFeeCents: number;
  shippingCents: number;
  preTaxTotalCents: number;
  taxableAmountCents: number;
  taxAmountCents: number;
  taxRate: number;
  grandTotalCents: number;
}

// ── Main Calculation ──

export function calculateQuote(
  lineItems: LineItemInput[],
  settings: QuoteSettings,
): { lineItems: CalculatedLineItem[]; totals: QuoteTotals } {
  // Step 1: Calculate each line item
  const calculatedItems: CalculatedLineItem[] = lineItems.map(item => {
    // Explicit 0% markup is meaningful (sell at cost) — only fall back to the
    // default when markup is genuinely absent (null/undefined).
    const effectiveMarkup = item.itemType === 'part'
      ? (item.markupPercent ?? settings.defaultMarkupPercent)
      : 0;

    let unitPriceCents: number;
    let lineTotalCents: number;

    if (item.itemType === 'labor') {
      // Labor: unit_price is the hourly rate, quantity is hours
      unitPriceCents = item.unitCostCents || settings.laborRateCents;
      lineTotalCents = Math.round(unitPriceCents * item.quantity);
    } else if (item.itemType === 'part') {
      // Parts: cost + markup
      const cost = item.unitCostCents;
      unitPriceCents = Math.round(cost * (1 + effectiveMarkup / 100));
      lineTotalCents = Math.round(unitPriceCents * item.quantity);
    } else {
      // Misc, fee, shipping: unit_price is as-is
      unitPriceCents = item.unitCostCents;
      lineTotalCents = Math.round(unitPriceCents * item.quantity);
    }

    return {
      itemType: item.itemType,
      unitCostCents: item.unitCostCents,
      markupPercent: effectiveMarkup,
      unitPriceCents,
      quantity: item.quantity,
      lineTotalCents,
    };
  });

  // Step 2: Aggregate by type
  const partsSubtotalCents = sumByType(calculatedItems, 'part');
  const laborSubtotalCents = sumByType(calculatedItems, 'labor');
  const miscSubtotalCents = sumByType(calculatedItems, 'misc') + sumByType(calculatedItems, 'fee');

  // Step 3: Calculate fees
  const fees = calculateFees(
    partsSubtotalCents,
    laborSubtotalCents,
    miscSubtotalCents,
    settings.feeConfig,
  );

  // Step 4: Pre-tax total
  const preTaxTotalCents =
    partsSubtotalCents +
    laborSubtotalCents +
    miscSubtotalCents +
    fees.shopFeeCents +
    fees.disposalFeeCents;

  // Step 5: Tax
  const tax = calculateTax(partsSubtotalCents, laborSubtotalCents, settings.taxConfig);

  // Step 6: Shipping (from line items + default)
  const shippingFromItems = sumByType(calculatedItems, 'shipping');
  const shippingTotalCents = calculatedItems.some(item => item.itemType === 'shipping')
    ? shippingFromItems : fees.shippingCents;

  // Step 7: Grand total
  const grandTotalCents = preTaxTotalCents + tax.taxAmountCents + shippingTotalCents;

  return {
    lineItems: calculatedItems,
    totals: {
      partsSubtotalCents,
      laborSubtotalCents,
      miscSubtotalCents,
      shopFeeCents: fees.shopFeeCents,
      disposalFeeCents: fees.disposalFeeCents,
      shippingCents: shippingTotalCents,
      preTaxTotalCents,
      taxableAmountCents: tax.taxableAmountCents,
      taxAmountCents: tax.taxAmountCents,
      taxRate: tax.rate,
      grandTotalCents,
    },
  };
}

function sumByType(items: CalculatedLineItem[], type: string): number {
  return items
    .filter(i => i.itemType === type)
    .reduce((sum, i) => sum + i.lineTotalCents, 0);
}

// ── Convenience: round to 2 decimal places for display ──

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
