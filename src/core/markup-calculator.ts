/**
 * Parts markup calculation — pure functions.
 * All amounts in cents.
 */

/**
 * Apply markup percentage to a cost price.
 * @param costCents - The vendor cost in cents
 * @param markupPercent - Markup percentage (e.g., 30 = 30%)
 * @returns The sell price in cents
 */
export function applyMarkup(costCents: number, markupPercent: number): number {
  if (costCents <= 0) return 0;
  return Math.round(costCents * (1 + markupPercent / 100));
}

/**
 * Reverse: given a sell price and markup %, determine the cost.
 */
export function reverseMarkup(sellPriceCents: number, markupPercent: number): number {
  if (markupPercent <= -100) return sellPriceCents; // avoid division by zero
  return Math.round(sellPriceCents / (1 + markupPercent / 100));
}