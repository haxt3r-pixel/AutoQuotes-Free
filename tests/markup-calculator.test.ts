import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMarkup, reverseMarkup } from '../src/core/markup-calculator.js';
import { centsToDollars, dollarsToCents } from '../src/core/quote-calculator.js';

test('applyMarkup adds percentage', () => {
  assert.equal(applyMarkup(10000, 30), 13000);
  assert.equal(applyMarkup(10000, 0), 10000);
  assert.equal(applyMarkup(0, 30), 0);
});

test('applyMarkup handles negative cost as zero', () => {
  assert.equal(applyMarkup(-100, 30), 0);
});

test('reverseMarkup recovers cost', () => {
  assert.equal(reverseMarkup(13000, 30), 10000);
});

test('reverseMarkup guards against -100', () => {
  assert.equal(reverseMarkup(13000, -100), 13000);
});

test('centsToDollars / dollarsToCents round-trip', () => {
  assert.equal(centsToDollars(12345), 123.45);
  assert.equal(dollarsToCents(123.45), 12345);
  assert.equal(dollarsToCents(0.1), 10);
});
