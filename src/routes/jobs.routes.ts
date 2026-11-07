import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { jobsRepo } from '../database/repositories/jobs.repo.js';
import { quotesRepo } from '../database/repositories/quotes.repo.js';

const router = Router();

const jobStatusSchema = z.enum(['open', 'in_progress', 'cancelled']);

/** GET /api/jobs */
router.get('/', (req: Request, res: Response) => {
  const { status, limit, offset, search } = req.query;
  const jobs = jobsRepo.listJobs(
    status as string | undefined,
    limit ? parseInt(limit as string, 10) : 50,
    offset ? parseInt(offset as string, 10) : 0,
    typeof search === 'string' ? search : undefined,
  );
  res.json({ success: true, data: jobs });
});

/** GET /api/jobs/by-quote/:quoteId */
router.get('/by-quote/:quoteId', (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.quoteId, 10);
  const job = jobsRepo.getJobByQuoteId(quoteId);
  if (!job) {
    res.status(404).json({ success: false, error: 'not_found', message: 'No job for this quote' });
    return;
  }
  res.json({ success: true, data: job });
});

/** POST /api/jobs/from-quote/:quoteId — create (or return) job from approved quote */
router.post('/from-quote/:quoteId', (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.quoteId, 10);
  const quote = quotesRepo.getQuoteById(quoteId);
  if (!quote) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  if (quote.status !== 'approved') {
    res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Only approved quotes can become jobs',
    });
    return;
  }
  const job = jobsRepo.createJobFromQuote(quoteId);
  res.status(201).json({ success: true, data: job });
});

/** GET /api/jobs/:id */
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const job = jobsRepo.getFullJob(id);
  if (!job) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Job not found' });
    return;
  }
  res.json({ success: true, data: job });
});

/** PUT /api/jobs/:id */
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const body = z.object({
    status: jobStatusSchema.optional(),
    mechanic_notes: z.string().nullable().optional(),
    completion_notes: z.string().nullable().optional(),
  }).parse(req.body);

  try {
    const job = jobsRepo.updateJob(id, body);
    if (!job) {
      res.status(404).json({ success: false, error: 'not_found', message: 'Job not found' });
      return;
    }
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(400).json({ success: false, error: 'bad_request', message: err.message });
  }
});

/** DELETE /api/jobs/:id */
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const job = jobsRepo.getJobById(id);
  if (!job) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Job not found' });
    return;
  }
  if (job.status === 'open' && req.query.confirmed !== 'true') {
    res.status(409).json({
      success: false,
      error: 'confirmation_required',
      message: 'Confirmation is required to delete an open job',
    });
    return;
  }
  try {
    jobsRepo.deleteJob(id);
  } catch (err: any) {
    res.status(409).json({ success: false, error: 'linked_history', message: err.message });
    return;
  }
  res.json({ success: true, data: { deleted: true } });
});

/** PUT /api/jobs/:id/items/:itemId */
router.put('/:id/items/:itemId', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const body = z.object({
    is_done: z.boolean().optional(),
    mechanic_note: z.string().nullable().optional(),
  }).parse(req.body);

  try {
    const item = jobsRepo.updateJobItem(id, itemId, body);
    if (!item) {
      res.status(404).json({ success: false, error: 'not_found', message: 'Job item not found' });
      return;
    }
    res.json({
      success: true,
      data: {
        item,
        job: jobsRepo.getFullJob(id),
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: 'bad_request', message: err.message });
  }
});

/** POST /api/jobs/:id/complete — finish job and open billing ticket */
router.post('/:id/complete', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const body = z.object({
    completion_notes: z.string().nullable().optional(),
  }).parse(req.body ?? {});

  try {
    const result = jobsRepo.completeJob(id, body.completion_notes);
    res.json({ success: true, data: result });
  } catch (err: any) {
    const notFound = /not found/i.test(err.message);
    res.status(notFound ? 404 : 400).json({
      success: false,
      error: notFound ? 'not_found' : 'bad_request',
      message: err.message,
    });
  }
});

export default router;
