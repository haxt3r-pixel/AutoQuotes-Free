import type { RequestHandler } from 'express';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function assertLoopbackHost(host: string): void {
  if (!LOOPBACK_HOSTS.has(host.toLowerCase())) {
    throw new Error(
      `Refusing to bind to non-loopback HOST "${host}". Authentication is required for network access.`,
    );
  }
}

export function buildAllowedOrigins(port: number): ReadonlySet<string> {
  return new Set([
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`,
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]);
}

export function rejectUntrustedBrowserOrigins(
  allowedOrigins: ReadonlySet<string>,
): RequestHandler {
  return (req, res, next) => {
    const origin = req.get('origin');
    const fetchSite = req.get('sec-fetch-site');

    if (origin && !allowedOrigins.has(origin)) {
      res.status(403).json({
        success: false,
        error: 'forbidden_origin',
        message: 'Cross-origin access is not allowed',
      });
      return;
    }

    if (!origin && fetchSite === 'cross-site') {
      res.status(403).json({
        success: false,
        error: 'forbidden_origin',
        message: 'Cross-site access is not allowed',
      });
      return;
    }

    next();
  };
}
