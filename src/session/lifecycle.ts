/**
 * Browser-session lifecycle for local single-user mode.
 * When AUTO_SHUTDOWN is enabled, the process exits after the UI tab closes
 * (or after heartbeats stop), so background servers do not linger.
 */

export type ShutdownReason =
  | 'goodbye'
  | 'heartbeat_timeout'
  | 'boot_timeout'
  | 'signal';

export interface LifecycleOptions {
  enabled: boolean;
  /** How long after the last heartbeat before idle shutdown. */
  heartbeatTimeoutMs: number;
  /** Grace period after goodbye to allow refresh/new tab heartbeats. */
  goodbyeGraceMs: number;
  /** If no client ever connects after boot, shut down (0 = never). */
  bootTimeoutMs: number;
  now?: () => number;
  onShutdown: (reason: ShutdownReason) => void;
  log?: (message: string) => void;
}

export class SessionLifecycle {
  private readonly enabled: boolean;
  private readonly heartbeatTimeoutMs: number;
  private readonly goodbyeGraceMs: number;
  private readonly bootTimeoutMs: number;
  private readonly now: () => number;
  private readonly onShutdown: (reason: ShutdownReason) => void;
  private readonly log: (message: string) => void;

  private lastHeartbeatAt = 0;
  private seenClient = false;
  private shuttingDown = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private goodbyeTimer: NodeJS.Timeout | null = null;
  private bootTimer: NodeJS.Timeout | null = null;

  constructor(options: LifecycleOptions) {
    this.enabled = options.enabled;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs;
    this.goodbyeGraceMs = options.goodbyeGraceMs;
    this.bootTimeoutMs = options.bootTimeoutMs;
    this.now = options.now ?? (() => Date.now());
    this.onShutdown = options.onShutdown;
    this.log = options.log ?? ((message) => console.log(message));

    if (this.enabled && this.bootTimeoutMs > 0) {
      this.bootTimer = setTimeout(() => {
        if (!this.seenClient) {
          this.requestShutdown('boot_timeout');
        }
      }, this.bootTimeoutMs);
      this.bootTimer.unref?.();
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get hasSeenClient(): boolean {
    return this.seenClient;
  }

  /** Call when the UI tab is alive. */
  heartbeat(): { ok: true; autoShutdown: boolean } {
    if (!this.enabled) {
      return { ok: true, autoShutdown: false };
    }
    if (this.shuttingDown) {
      // A late heartbeat after goodbye cancels shutdown (page refresh).
      this.cancelGoodbye();
      this.shuttingDown = false;
      this.log('[Lifecycle] Shutdown cancelled — client heartbeat resumed');
    }

    this.seenClient = true;
    this.lastHeartbeatAt = this.now();
    if (this.bootTimer) {
      clearTimeout(this.bootTimer);
      this.bootTimer = null;
    }
    this.armHeartbeatWatchdog();
    return { ok: true, autoShutdown: true };
  }

  /** Call when the UI tab is closing. */
  goodbye(): { ok: true; shuttingDownInMs: number } {
    if (!this.enabled) {
      return { ok: true, shuttingDownInMs: 0 };
    }

    this.seenClient = true;
    if (this.bootTimer) {
      clearTimeout(this.bootTimer);
      this.bootTimer = null;
    }

    this.cancelGoodbye();
    this.shuttingDown = true;
    this.log(`[Lifecycle] UI closed — shutting down in ${this.goodbyeGraceMs}ms unless a tab reconnects`);
    this.goodbyeTimer = setTimeout(() => {
      this.requestShutdown('goodbye');
    }, this.goodbyeGraceMs);
    this.goodbyeTimer.unref?.();
    return { ok: true, shuttingDownInMs: this.goodbyeGraceMs };
  }

  dispose(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    if (this.goodbyeTimer) clearTimeout(this.goodbyeTimer);
    if (this.bootTimer) clearTimeout(this.bootTimer);
    this.heartbeatTimer = null;
    this.goodbyeTimer = null;
    this.bootTimer = null;
  }

  private cancelGoodbye(): void {
    if (this.goodbyeTimer) {
      clearTimeout(this.goodbyeTimer);
      this.goodbyeTimer = null;
    }
  }

  private armHeartbeatWatchdog(): void {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
      const idleFor = this.now() - this.lastHeartbeatAt;
      if (idleFor >= this.heartbeatTimeoutMs) {
        this.requestShutdown('heartbeat_timeout');
      } else {
        this.armHeartbeatWatchdog();
      }
    }, this.heartbeatTimeoutMs + 50);
    this.heartbeatTimer.unref?.();
  }

  private requestShutdown(reason: ShutdownReason): void {
    if (!this.enabled) return;
    this.dispose();
    this.shuttingDown = true;
    this.log(`[Lifecycle] Shutdown requested (${reason})`);
    this.onShutdown(reason);
  }
}

export function isAutoShutdownEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.AUTO_SHUTDOWN ?? '1').trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no');
}
