import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDirectSearch,
  extractFitmentPosition,
  findCategories,
  findCategory,
} from '../src/parts/parts-scraper.js';

test('common brake-pad searches resolve to the brake-pad category', () => {
  const expectedPartType = 1684;
  for (const query of ['brake pads', 'front brake pads', 'rear disc brake pad set', 'brakes']) {
    assert.equal(findCategory(query)?.parttype, expectedPartType, query);
  }
});

test('specific filter phrases win over broad filter matches', () => {
  assert.equal(findCategory('replace cabin air filter')?.parttype, 6832);
  assert.equal(findCategory('engine air filter')?.parttype, 6192);
  assert.equal(findCategory('a/c compressor')?.parttype, 6628);
});

test('broad part families expand into relevant categories', () => {
  assert.deepEqual(
    findCategories('bearings').map(category => category.parttype),
    [1636, 5212, 5220, 5208],
  );
  assert.deepEqual(
    findCategories('show me filters').map(category => category.parttype),
    [5340, 6192, 6832, 6200],
  );
  assert.deepEqual(
    findCategories('brakes').map(category => category.parttype),
    [1684, 1896, 1704, 1680],
  );
  assert.deepEqual(
    findCategories('gasket').map(category => category.parttype),
    [5412, 10710, 5424, 5436, 5400],
  );
});

test('specific bearing searches do not expand to unrelated bearings', () => {
  assert.deepEqual(findCategories('front wheel bearings').map(category => category.parttype), [1636]);
  assert.deepEqual(findCategories('rod bearings').map(category => category.parttype), [5212]);
  assert.deepEqual(findCategories('valve cover gasket').map(category => category.parttype), [10710]);
});

test('mount searches resolve to RockAuto motor and transmission mount categories', () => {
  assert.equal(findCategory('engine mount')?.parttype, 5552);
  assert.equal(findCategory('motor mounts')?.parttype, 5552);
  assert.equal(findCategory('trans mount')?.parttype, 8616);
  assert.equal(findCategory('transmission mount')?.parttype, 8616);
  assert.deepEqual(findCategories('mounts').map(category => category.parttype), [5552, 8616]);
});

test('fitment position is extracted from RockAuto listing details', () => {
  assert.equal(extractFitmentPosition('Hydraulic mount; Front Right'), 'Front Right');
  assert.equal(extractFitmentPosition('Position: Passenger Side Upper'), 'Passenger Side Upper');
  assert.equal(extractFitmentPosition('Rear Left mount for all wheel drive'), 'Rear Left');
  assert.equal(extractFitmentPosition('Replacement engine mount'), undefined);
});

test('minor spelling errors still resolve to the intended category', () => {
  assert.equal(findCategory('weheel bearings')?.parttype, 1636);
  assert.equal(findCategory('alternater')?.parttype, 2412);
  assert.equal(findCategory('brake rotrs')?.parttype, 1896);
});

test('unmapped identifiers distinguish part numbers from brands', () => {
  assert.deepEqual(classifyDirectSearch('D537'), { type: 'partNumber', value: 'D537' });
  assert.deepEqual(classifyDirectSearch('part number: 513123'), { type: 'partNumber', value: '513123' });
  assert.deepEqual(classifyDirectSearch('MOOG'), { type: 'brand', value: 'MOOG' });
  assert.deepEqual(classifyDirectSearch('WJB / INMOTION PARTS'), {
    type: 'brand',
    value: 'WJB / INMOTION PARTS',
  });
  assert.deepEqual(classifyDirectSearch('3M'), { type: 'brand', value: '3M' });
});
