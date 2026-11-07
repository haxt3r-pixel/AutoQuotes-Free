import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAutoShutdownEnabled, SessionLifecycle } from '../src/session/lifecycle.js';

describe('session lifecycle', () => {
  it('parses AUTO_SHUTDOWN env defaults and overrides', () => {
    assert.equal(isAutoShutdownEnabled({}), true);
    assert.equal(isAutoShutdownEnabled({ AUTO_SHUTDOWN: '1' }), true);
    assert.equal(isAutoShutdownEnabled({ AUTO_SHUTDOWN: '0' }), false);
    assert.equal(isAutoShutdownEnabled({ AUTO_SHUTDOWN: 'false' }), false);
    assert.equal(isAutoShutdownEnabled({ AUTO_SHUTDOWN: 'off' }), false);
  });

  it('shuts down after goodbye grace when no heartbeat resumes', async () => {
    let reason: string | null = null;
    let now = 1_000;
    const life = new SessionLifecycle({
      enabled: true,
      heartbeatTimeoutMs: 50_000,
      goodbyeGraceMs: 30,
      bootTimeoutMs: 0,
      now: () => now,
      onShutdown: (r) => { reason = r; },
      log: () => {},
    });

    life.heartbeat();
    life.goodbye();
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(reason, 'goodbye');
    life.dispose();
  });

  it('cancels goodbye shutdown when heartbeat resumes', async () => {
    let reason: string | null = null;
    const life = new SessionLifecycle({
      enabled: true,
      heartbeatTimeoutMs: 50_000,
      goodbyeGraceMs: 80,
      bootTimeoutMs: 0,
      onShutdown: (r) => { reason = r; },
      log: () => {},
    });

    life.heartbeat();
    life.goodbye();
    await new Promise((r) => setTimeout(r, 20));
    life.heartbeat();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(reason, null);
    life.dispose();
  });

  it('does nothing when auto-shutdown is disabled', async () => {
    let reason: string | null = null;
    const life = new SessionLifecycle({
      enabled: false,
      heartbeatTimeoutMs: 10,
      goodbyeGraceMs: 10,
      bootTimeoutMs: 10,
      onShutdown: (r) => { reason = r; },
      log: () => {},
    });
    life.goodbye();
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(reason, null);
    life.dispose();
  });
});
