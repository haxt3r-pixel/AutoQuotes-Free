import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote } from '../src/core/quote-calculator.js';

const baseSettings = {
  laborRateCents: 12000,
  defaultMarkupPercent: 30,
  taxConfig: { taxRate: 8.25, taxAppliesToParts: true, taxAppliesToLabor: true },
  feeConfig: {
    shopFeePercent: 5,
    shopFeeCapCents: 5000,
    shopFeeFlatCents: 0,
    disposalFeeCents: 300,
    shippingDefaultCents: 0,
  },
};

test('part with markup', () => {
  const { lineItems, totals } = calculateQuote(
    [{ itemType: 'part', unitCostCents: 10000, markupPercent: 30, quantity: 1 }],
    baseSettings,
  );
  assert.equal(lineItems[0].unitPriceCents, 13000);
  assert.equal(lineItems[0].lineTotalCents, 13000);
  assert.equal(totals.partsSubtotalCents, 13000);
});

test('labor uses default rate when cost omitted', () => {
  const { lineItems, totals } = calculateQuote(
    [{ itemType: 'labor', unitCostCents: 0, markupPercent: 0, quantity: 2 }],
    baseSettings,
  );
  assert.equal(lineItems[0].unitPriceCents, 12000);
  assert.equal(totals.laborSubtotalCents, 24000);
});

test('shop fee applied as percent of parts+labor', () => {
  const { totals } = calculateQuote(
    [
      { itemType: 'part', unitCostCents: 10000, markupPercent: 0, quantity: 1 },
      { itemType: 'labor', unitCostCents: 10000, markupPercent: 0, quantity: 1 },
    ],
    baseSettings,
  );
  // base = 20000, 5% = 1000
  assert.equal(totals.shopFeeCents, 1000);
});

test('tax applies to parts + labor', () => {
  const { totals } = calculateQuote(
    [
      { itemType: 'part', unitCostCents: 10000, markupPercent: 0, quantity: 1 },
      { itemType: 'labor', unitCostCents: 10000, markupPercent: 0, quantity: 1 },
    ],
    baseSettings,
  );
  // taxable = 20000, 8.25% = 1650
  assert.equal(totals.taxAmountCents, 1650);
});

test('grand total includes parts, labor, fee, tax, disposal', () => {
  const { totals } = calculateQuote(
    [
      { itemType: 'part', unitCostCents: 10000, markupPercent: 0, quantity: 1 },
      { itemType: 'labor', unitCostCents: 10000, markupPercent: 0, quantity: 1 },
    ],
    baseSettings,
  );
  const expected = 10000 + 10000 + 1000 + 300 + 1650;
  assert.equal(totals.grandTotalCents, expected);
});

test('shipping line item is passed through', () => {
  const { totals } = calculateQuote(
    [
      { itemType: 'part', unitCostCents: 10000, markupPercent: 0, quantity: 1 },
      { itemType: 'shipping', unitCostCents: 1500, markupPercent: 0, quantity: 1 },
    ],
    baseSettings,
  );
  assert.equal(totals.shippingCents, 1500);
  assert.ok(totals.grandTotalCents > 1500);
});

test('default shipping used when no shipping line item', () => {
  const { totals } = calculateQuote(
    [{ itemType: 'part', unitCostCents: 10000, markupPercent: 0, quantity: 1 }],
    { ...baseSettings, feeConfig: { ...baseSettings.feeConfig, shippingDefaultCents: 800 } },
  );
  assert.equal(totals.shippingCents, 800);
});

test('an explicit free shipping item overrides a nonzero default', () => {
  const { totals } = calculateQuote(
    [{ itemType: 'shipping', unitCostCents: 0, markupPercent: 0, quantity: 1 }],
    { ...baseSettings, feeConfig: { ...baseSettings.feeConfig, shippingDefaultCents: 800 } },
  );
  assert.equal(totals.shippingCents, 0);
});
