import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import type { Server } from 'http';
import { fileURLToPath } from 'url';
import { closeDatabase, getDatabase } from './config/database.js';
import { aiService } from './ai/ai.service.js';
import { errorHandler } from './middleware/error-handler.js';
import {
  assertLoopbackHost, buildAllowedOrigins, rejectUntrustedBrowserOrigins,
} from './middleware/origin-security.js';
import settingsRoutes from './routes/settings.routes.js';
import aiRoutes from './routes/ai.routes.js';
import quotesRoutes from './routes/quotes.routes.js';
import customersRoutes from './routes/customers.routes.js';
import exportsRoutes from './routes/exports.routes.js';
import partsRoutes from './routes/parts.routes.js';
import vehiclesRoutes from './routes/vehicles.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import billingRoutes from './routes/billing.routes.js';
import { createSessionRoutes } from './routes/session.routes.js';
import { isAutoShutdownEnabled, SessionLifecycle, type ShutdownReason } from './session/lifecycle.js';
import { closePdfBrowser } from './pdf/pdf-generator.js';
import { closeBrowser as closePartsBrowser } from './parts/parts-scraper.js';
import { cartSession } from './parts/cart-session.js';
import { EXPORTS_DIR, UPLOADS_DIR } from './config/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const AUTO_SHUTDOWN = isAutoShutdownEnabled();

export function createApp(lifecycle?: SessionLifecycle): express.Application {
  const app = express();
  const allowedOrigins = buildAllowedOrigins(PORT);
  app.use(rejectUntrustedBrowserOrigins(allowedOrigins));
  app.use(cors({
    origin: (origin, callback) => {
      callback(null, origin ? allowedOrigins.has(origin) : false);
    },
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/exports', express.static(EXPORTS_DIR));
  const publicDir = path.resolve(__dirname, '..', 'dist', 'public');
  app.use(express.static(publicDir));
  app.use('/api/settings', settingsRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/quotes', quotesRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/exports', exportsRoutes);
  app.use('/api/parts', partsRoutes);
  app.use('/api/vehicles', vehiclesRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/billing', billingRoutes);
  if (lifecycle) {
    app.use('/api/session', createSessionRoutes(lifecycle));
  }
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        autoShutdown: lifecycle?.isEnabled ?? AUTO_SHUTDOWN,
      },
    });
  });
  app.get(/^\/(?!api\/|uploads\/|exports\/).*/, (_req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).json({ success: true, message: 'API running. Frontend not built.' });
      }
    });
  });
  app.use(errorHandler);
  return app;
}

function clearPidFile(): void {
  const pidFile = process.env.AUTOQUOTE_PID_FILE;
  if (!pidFile) return;
  try {
    if (fs.existsSync(pidFile)) {
      const contents = fs.readFileSync(pidFile, 'utf8').trim();
      if (!contents || contents === String(process.pid)) {
        fs.unlinkSync(pidFile);
      }
    }
  } catch {
    // ignore
  }
}

async function cleanupResources(): Promise<void> {
  await Promise.allSettled([
    closePdfBrowser(),
    closePartsBrowser(),
    cartSession.shutdown(),
  ]);
  closeDatabase();
  clearPidFile();
}

if (process.argv[1]?.includes('main')) {
  console.log('[Server] Initializing...');
  assertLoopbackHost(HOST);
  getDatabase();
  aiService.loadConfig();

  let server: Server | null = null;
  let exiting = false;

  const shutdown = async (reason: ShutdownReason | string) => {
    if (exiting) return;
    exiting = true;
    console.log(`[Server] Shutting down (${reason})...`);
    lifecycle.dispose();

    const forceTimer = setTimeout(() => {
      console.warn('[Server] Forced exit after timeout');
      clearPidFile();
      process.exit(0);
    }, 8_000);
    forceTimer.unref?.();

    try {
      if (server) {
        await new Promise<void>((resolve) => {
          server!.close(() => resolve());
          setTimeout(resolve, 2_000).unref?.();
        });
      }
      await cleanupResources();
      console.log('[Server] Stopped');
    } catch (err) {
      console.error('[Server] Error during shutdown:', err);
    } finally {
      clearTimeout(forceTimer);
      process.exit(0);
    }
  };

  const lifecycle = new SessionLifecycle({
    enabled: AUTO_SHUTDOWN,
    heartbeatTimeoutMs: parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '45000', 10),
    goodbyeGraceMs: parseInt(process.env.GOODBYE_GRACE_MS || '4000', 10),
    bootTimeoutMs: AUTO_SHUTDOWN ? parseInt(process.env.BOOT_TIMEOUT_MS || '180000', 10) : 0,
    onShutdown: (reason) => {
      void shutdown(reason);
    },
  });

  console.log(`[Server] Ready (auto-shutdown ${AUTO_SHUTDOWN ? 'ON' : 'OFF'})`);
  const app = createApp(lifecycle);
  server = app.listen(PORT, HOST, () => {
    console.log(`Server at http://${HOST}:${PORT}`);
  });

  const onSignal = (signal: string) => {
    void shutdown(signal);
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));
}

export default createApp;
