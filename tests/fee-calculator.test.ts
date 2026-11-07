import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFees } from '../src/core/fee-calculator.js';

test('percentage shop fee with cap', () => {
  const r = calculateFees(10000, 5000, 0, {
    shopFeePercent: 5,
    shopFeeCapCents: 5000,
    shopFeeFlatCents: 0,
    disposalFeeCents: 300,
    shippingDefaultCents: 0,
  });
  // base = 15000, 5% = 750, under cap
  assert.equal(r.shopFeeCents, 750);
  assert.equal(r.disposalFeeCents, 300);
});

test('percentage fee is capped', () => {
  const r = calculateFees(200000, 0, 0, {
    shopFeePercent: 5,
    shopFeeCapCents: 5000,
    shopFeeFlatCents: 0,
    disposalFeeCents: 0,
    shippingDefaultCents: 0,
  });
  // base = 200000, 5% = 10000, capped to 5000
  assert.equal(r.shopFeeCents, 5000);
});

test('flat fee overrides percentage', () => {
  const r = calculateFees(10000, 0, 0, {
    shopFeePercent: 5,
    shopFeeCapCents: 5000,
    shopFeeFlatCents: 2500,
    disposalFeeCents: 0,
    shippingDefaultCents: 0,
  });
  assert.equal(r.shopFeeCents, 2500);
});

test('total fees sums everything', () => {
  const r = calculateFees(10000, 10000, 2000, {
    shopFeePercent: 0,
    shopFeeCapCents: 0,
    shopFeeFlatCents: 0,
    disposalFeeCents: 300,
    shippingDefaultCents: 1000,
  });
  assert.equal(r.totalFeesCents, 0 + 300 + 1000 + 2000);
});
