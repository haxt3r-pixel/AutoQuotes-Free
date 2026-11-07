import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findBestEngine } from '../src/parts/parts-scraper.js';
import { CartSession } from '../src/parts/cart-session.js';

test('engine selection never silently substitutes an unrelated or ambiguous engine', () => {
  const engines = [
    { engine: '2.0L L4', carcode: 'one' },
    { engine: '3.5L V6', carcode: 'two' },
  ];
  assert.equal(findBestEngine(engines, '3.5L V6')?.carcode, 'two');
  assert.equal(findBestEngine(engines, '3.5L')?.carcode, 'two');
  assert.equal(findBestEngine(engines, '5.0L'), null);
  assert.equal(findBestEngine(engines, ''), null);
  assert.equal(findBestEngine([engines[0]], '5.0L'), null);
  assert.equal(findBestEngine([...engines, { engine: '3.5L V6 Turbo', carcode: 'three' }], '3.5L'), null);
});

test('clearing a cart that has not been initialized succeeds without opening a browser', async () => {
  const cart = new CartSession();
  await cart.clearCart();
  assert.equal(cart.getItemCount(), 0);
});
