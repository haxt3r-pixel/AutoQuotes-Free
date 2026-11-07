import { Router, type Request, type Response, type NextFunction } from 'express';
import { aiService } from '../ai/ai.service.js';

const router = Router();

/** Wrap async handlers to catch errors */
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

/** GET /api/ai/status — current connection status */
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const status = await aiService.getStatus();
  res.json({ success: true, data: status });
}));

/** POST /api/ai/test-connection — test LM Studio reachability */
router.post('/test-connection', asyncHandler(async (_req: Request, res: Response) => {
  const result = await aiService.testConnection();
  res.json({
    success: true,
    data: {
      connected: result.ok,
      models: result.models,
      error: result.error ?? null,
    },
  });
}));

/** POST /api/ai/polish-note — polish text */
router.post('/polish-note', asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing "text" field' });
    return;
  }
  const result = await aiService.polishNote(text);
  res.json({ success: true, data: result });
}));

/** POST /api/ai/explain-part — generate layperson explanation */
router.post('/explain-part', asyncHandler(async (req: Request, res: Response) => {
  const { description, vehicle } = req.body;
  if (!description || typeof description !== 'string') {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing "description" field' });
    return;
  }
  const explanation = await aiService.explainPart(description, vehicle ?? undefined);
  res.json({ success: true, data: { explanation } });
}));

/** POST /api/ai/categorize — categorize line items into priority buckets */
router.post('/categorize', asyncHandler(async (req: Request, res: Response) => {
  const { items, notes } = req.body;
  if (!items || !Array.isArray(items)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing "items" array' });
    return;
  }
  // Normalize items
  const normalized = items.map((item: any, i: number) => ({
    index: item.index ?? i,
    description: String(item.description || 'Unknown item'),
    cost: typeof item.cost === 'number' ? item.cost : 0,
  }));
  const categorized = await aiService.categorizeLineItems(normalized, notes ?? undefined);
  res.json({ success: true, data: { categorized } });
}));

/** POST /api/ai/draft-email — generate cover letter email */
router.post('/draft-email', asyncHandler(async (req: Request, res: Response) => {
  const { customerName, vehicleInfo, quoteSummary, shopName, tone } = req.body;
  if (!customerName || !vehicleInfo || !quoteSummary || !shopName) {
    res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Missing required fields: customerName, vehicleInfo, quoteSummary, shopName',
    });
    return;
  }
  const email = await aiService.draftEmail({
    customerName,
    vehicleInfo,
    quoteSummary,
    shopName,
    tone: tone === 'friendly' ? 'friendly' : 'professional',
  });
  res.json({ success: true, data: { email } });
}));

export default router;