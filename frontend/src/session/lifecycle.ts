/**
 * Keep the local server alive while this tab is open, and ask it to exit
 * when the tab closes (production / launcher mode with AUTO_SHUTDOWN).
 */

const HEARTBEAT_MS = 10_000;
const SESSION_BASE = '/api/session';

let heartbeatTimer: number | null = null;
let started = false;

function postBeacon(path: string, body: Record<string, unknown> = {}): void {
  const payload = JSON.stringify(body);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(`${SESSION_BASE}${path}`, blob);
      return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch(`${SESSION_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

async function postJson(path: string): Promise<void> {
  try {
    await fetch(`${SESSION_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      keepalive: true,
    });
  } catch {
    // Server may already be gone
  }
}

function sendHeartbeat(): void {
  void postJson('/heartbeat');
}

function sendGoodbye(): void {
  postBeacon('/goodbye', { reason: 'pagehide' });
}

function onPageHide(event: PageTransitionEvent): void {
  // bfcache pages can be restored; still signal goodbye — a heartbeat on
  // pageshow will cancel shutdown if the tab comes back.
  void event;
  sendGoodbye();
  stopHeartbeatTimer();
}

function onPageShow(): void {
  sendHeartbeat();
  startHeartbeatTimer();
}

function startHeartbeatTimer(): void {
  stopHeartbeatTimer();
  heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_MS);
}

function stopHeartbeatTimer(): void {
  if (heartbeatTimer != null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/** Start session keep-alive + close detection. Safe to call once. */
export function startSessionLifecycle(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  sendHeartbeat();
  startHeartbeatTimer();

  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  });
}

export function stopSessionLifecycle(): void {
  if (!started) return;
  stopHeartbeatTimer();
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('pageshow', onPageShow);
  started = false;
}
