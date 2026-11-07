import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTax } from '../src/core/tax-calculator.js';

test('tax applies to parts only', () => {
  const r = calculateTax(10000, 5000, { taxRate: 8.25, taxAppliesToParts: true, taxAppliesToLabor: false });
  assert.equal(r.taxableAmountCents, 10000);
  assert.equal(r.taxAmountCents, 825);
  assert.equal(r.rate, 8.25);
});

test('tax applies to parts and labor', () => {
  const r = calculateTax(10000, 5000, { taxRate: 10, taxAppliesToParts: true, taxAppliesToLabor: true });
  assert.equal(r.taxableAmountCents, 15000);
  assert.equal(r.taxAmountCents, 1500);
});

test('tax applies to nothing', () => {
  const r = calculateTax(10000, 5000, { taxRate: 8.25, taxAppliesToParts: false, taxAppliesToLabor: false });
  assert.equal(r.taxableAmountCents, 0);
  assert.equal(r.taxAmountCents, 0);
});

test('zero rate yields zero tax', () => {
  const r = calculateTax(10000, 5000, { taxRate: 0, taxAppliesToParts: true, taxAppliesToLabor: true });
  assert.equal(r.taxAmountCents, 0);
});
