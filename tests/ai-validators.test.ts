import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCategories } from '../src/ai/validators/priority.validator.js';
import { extractJson } from '../src/ai/validators/json-extractor.js';

test('valid categories pass through', () => {
  const r = validateCategories([
    { index: 0, category: 'safety_critical', reason: 'leaking line' },
    { index: 1, category: 'required', reason: 'main repair' },
    { index: 2, category: 'recommended', reason: 'preventive' },
    { index: 3, category: 'optional', reason: 'cosmetic' },
  ]);
  assert.equal(r.length, 4);
  assert.equal(r[0].category, 'safety_critical');
  assert.equal(r[1].category, 'required');
});

test('unknown category falls back to recommended', () => {
  const r = validateCategories([{ index: 0, category: 'nonsense', reason: 'x' }]);
  assert.equal(r[0].category, 'recommended');
});

test('missing index falls back to array position', () => {
  const r = validateCategories([{ category: 'required', reason: 'x' }]);
  assert.equal(r[0].index, 0);
});

test('missing reason gets default', () => {
  const r = validateCategories([{ index: 0, category: 'required' }]);
  assert.equal(r[0].reason, 'No reason provided');
});

test('non-array input throws', () => {
  assert.throws(() => validateCategories('nope' as any), /Expected an array/);
});

test('extractJson parses plain JSON', () => {
  const r = extractJson<number[]>('[1,2,3]');
  assert.deepEqual(r, [1, 2, 3]);
});

test('extractJson parses JSON in markdown fences', () => {
  const r = extractJson<{ a: number }>('```json\n{"a":1}\n```');
  assert.deepEqual(r, { a: 1 });
});

test('extractJson parses JSON with commentary', () => {
  const r = extractJson<{ a: number }>('Here is the result: {"a": 5} thanks!');
  assert.deepEqual(r, { a: 5 });
});

test('extractJson throws on garbage', () => {
  assert.throws(() => extractJson('this is not json at all'));
});
