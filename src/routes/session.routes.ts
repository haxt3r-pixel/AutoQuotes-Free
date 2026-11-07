import { Router, type Request, type Response } from 'express';
import type { SessionLifecycle } from '../session/lifecycle.js';

export function createSessionRoutes(lifecycle: SessionLifecycle): Router {
  const router = Router();

  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        autoShutdown: lifecycle.isEnabled,
        hasSeenClient: lifecycle.hasSeenClient,
      },
    });
  });

  router.post('/heartbeat', (_req: Request, res: Response) => {
    const result = lifecycle.heartbeat();
    res.json({ success: true, data: result });
  });

  router.post('/goodbye', (_req: Request, res: Response) => {
    const result = lifecycle.goodbye();
    res.json({ success: true, data: result });
  });

  return router;
}
