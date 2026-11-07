import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { billingRepo } from '../database/repositories/jobs.repo.js';

const router = Router();

/** GET /api/billing */
router.get('/', (req: Request, res: Response) => {
  const { status, limit, offset, search } = req.query;
  const tickets = billingRepo.listTickets(
    status as string | undefined,
    limit ? parseInt(limit as string, 10) : 50,
    offset ? parseInt(offset as string, 10) : 0,
    typeof search === 'string' ? search : undefined,
  );
  res.json({ success: true, data: tickets });
});

/** GET /api/billing/:id */
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const ticket = billingRepo.getTicketById(id);
  if (!ticket) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Billing ticket not found' });
    return;
  }
  res.json({ success: true, data: ticket });
});

/** POST /api/billing/:id/pay — mark paid in full (payment collected off-app) */
router.post('/:id/pay', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const body = z.object({
    payment_note: z.string().nullable().optional(),
  }).parse(req.body ?? {});

  try {
    const ticket = billingRepo.markPaid(id, body.payment_note);
    res.json({ success: true, data: ticket });
  } catch (err: any) {
    const notFound = /not found/i.test(err.message);
    res.status(notFound ? 404 : 400).json({
      success: false,
      error: notFound ? 'not_found' : 'bad_request',
      message: err.message,
    });
  }
});

/** POST /api/billing/:id/void */
router.post('/:id/void', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const body = z.object({
    payment_note: z.string().nullable().optional(),
  }).parse(req.body ?? {});

  try {
    const ticket = billingRepo.voidTicket(id, body.payment_note);
    res.json({ success: true, data: ticket });
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
