import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertLoopbackHost, buildAllowedOrigins,
} from '../src/middleware/origin-security.js';

test('origin allowlist contains only expected local application origins', () => {
  const origins = buildAllowedOrigins(3000);
  assert.equal(origins.has('http://127.0.0.1:3000'), true);
  assert.equal(origins.has('http://localhost:5173'), true);
  assert.equal(origins.has('https://example.com'), false);
  assert.equal(origins.has('http://localhost.evil.example:3000'), false);
});

test('server binding is restricted to loopback hosts', () => {
  assert.doesNotThrow(() => assertLoopbackHost('127.0.0.1'));
  assert.doesNotThrow(() => assertLoopbackHost('::1'));
  assert.throws(() => assertLoopbackHost('0.0.0.0'), /Refusing to bind/);
});
