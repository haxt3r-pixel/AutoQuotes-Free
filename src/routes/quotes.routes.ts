import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { quotesRepo } from '../database/repositories/quotes.repo.js';
import {
  createQuoteSchema, quoteUpdateSchema, quoteStatusSchema, lineItemSchema, lineItemUpdateSchema,
  prioritySchema,
} from '../validation/schemas.js';
import { customersRepo } from '../database/repositories/customers.repo.js';
import { vehiclesRepo } from '../database/repositories/vehicles.repo.js';
import { jobsRepo } from '../database/repositories/jobs.repo.js';
import { getDatabase } from '../config/database.js';

const router = Router();

function requireEditableQuote(id: number, res: Response): boolean {
  if (jobsRepo.getJobByQuoteId(id)) {
    res.status(409).json({ success: false, error: 'quote_locked', message: 'This quote has a linked job and can no longer be edited.' });
    return false;
  }
  return true;
}

/** GET /api/quotes — list quotes */
router.get('/', (req: Request, res: Response) => {
  const { status, limit, offset, search } = req.query;
  const quotes = quotesRepo.listQuotes(
    status as string | undefined,
    limit ? parseInt(limit as string, 10) : 50,
    offset ? parseInt(offset as string, 10) : 0,
    typeof search === 'string' ? search : undefined,
  );
  res.json({ success: true, data: quotes });
});

/** POST /api/quotes — create quote */
router.post('/', (req: Request, res: Response) => {
  const data = createQuoteSchema.parse(req.body);
  if (data.customer_id && !customersRepo.getCustomerById(data.customer_id)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Customer not found' });
    return;
  }
  if (data.vehicle_id) {
    const vehicle = vehiclesRepo.getVehicleById(data.vehicle_id);
    if (!vehicle || !data.customer_id || vehicle.customer_id !== data.customer_id) {
      res.status(400).json({ success: false, error: 'bad_request', message: 'Vehicle does not belong to this customer' });
      return;
    }
  }
  const quote = quotesRepo.createQuote(data);
  res.status(201).json({ success: true, data: quote });
});

/** PUT /api/quotes/:id — update customer, vehicle, notes, or quote overrides */
router.put('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!quotesRepo.getQuoteById(id)) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  const data = quoteUpdateSchema.parse(req.body);
  if (!requireEditableQuote(id, res)) return;
  if (data.customer_id && !customersRepo.getCustomerById(data.customer_id)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Customer not found' });
    return;
  }
  if (data.vehicle_id) {
    const vehicle = vehiclesRepo.getVehicleById(data.vehicle_id);
    const customerId = data.customer_id === undefined
      ? quotesRepo.getQuoteById(id)?.customer_id
      : data.customer_id;
    if (!vehicle || !customerId || vehicle.customer_id !== customerId) {
      res.status(400).json({ success: false, error: 'bad_request', message: 'Vehicle does not belong to this customer' });
      return;
    }
  }
  if (data.customer_id !== undefined && data.customer_id === null && data.vehicle_id === undefined) {
    data.vehicle_id = null;
  }
  if (data.customer_id !== undefined && data.vehicle_id === undefined) {
    const current = quotesRepo.getQuoteById(id)!;
    if (current.vehicle_id && vehiclesRepo.getVehicleById(current.vehicle_id)?.customer_id !== data.customer_id) data.vehicle_id = null;
  }
  const quote = getDatabase().transaction(() => {
    const updated = quotesRepo.updateQuote(id, data);
    if (['labor_rate_override', 'tax_rate_override', 'shop_fee_override', 'markup_override'].some(key => key in data)) {
      return quotesRepo.recalculateTotals(id)?.header ?? updated;
    }
    return updated;
  })();
  res.json({ success: true, data: quote });
});

/** GET /api/quotes/:id — get full quote with line items */
router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const quote = quotesRepo.getFullQuote(id);
  if (!quote) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  res.json({ success: true, data: quote });
});

/** PUT /api/quotes/:id/status — update quote status */
router.put('/:id/status', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { status } = z.object({ status: quoteStatusSchema }).parse(req.body);
  if (!status) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing "status" field' });
    return;
  }
  const quote = quotesRepo.getQuoteById(id);
  if (!quote) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  const existing = jobsRepo.getJobByQuoteId(id);
  if (existing && status !== 'approved') {
    res.status(409).json({ success: false, error: 'quote_locked', message: 'This quote has a linked job and its status cannot be changed.' });
    return;
  }
  const { updated, job } = getDatabase().transaction(() => {
    // Freeze the amount when a quote is sent; approving it must not silently
    // apply pricing settings that changed since the customer saw it.
    if (!existing && ((status === 'sent' && quote.status !== 'sent') || (status === 'approved' && quote.status !== 'sent'))) {
      quotesRepo.recalculateTotals(id);
    }
    quotesRepo.updateQuoteStatus(id, status);
    const job = status === 'approved' ? jobsRepo.createJobFromQuote(id) : null;
    return { updated: quotesRepo.getQuoteById(id), job };
  })();

  res.json({
    success: true,
    data: {
      quote: updated,
      job: job ? { id: job.header.id, job_number: job.header.job_number, status: job.header.status } : null,
    },
  });
});

/** POST /api/quotes/:id/recalculate — recompute and persist all totals */
router.post('/:id/recalculate', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!requireEditableQuote(id, res)) return;
  const full = quotesRepo.recalculateTotals(id);
  if (!full) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  res.json({ success: true, data: full });
});

/** PUT /api/quotes/:id/totals — recalculate and store quote totals */
router.put('/:id/totals', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!requireEditableQuote(id, res)) return;
  const quote = quotesRepo.recalculateTotals(id);
  if (!quote) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  res.json({ success: true, data: quote.header });
});

/** DELETE /api/quotes/:id */
router.delete('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const quote = quotesRepo.getQuoteById(id);
  if (!quote) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  if (jobsRepo.getJobByQuoteId(id)) {
    res.status(409).json({ success: false, error: 'linked_history', message: 'Cannot delete a quote with a linked job or billing ticket.' });
    return;
  }
  if (quote.status === 'approved' && req.query.confirmed !== 'true') {
    res.status(409).json({
      success: false,
      error: 'confirmation_required',
      message: 'Confirmation is required to delete an approved quote',
    });
    return;
  }
  quotesRepo.deleteQuote(id);
  res.json({ success: true, data: { deleted: true } });
});

// ── Line Items ──

/** GET /api/quotes/:id/items — get line items */
router.get('/:id/items', (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const items = quotesRepo.getLineItems(id);
  res.json({ success: true, data: items });
});

/** POST /api/quotes/:id/items — add line item (auto-recalculates totals) */
router.post('/:id/items', (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.id, 10);
  if (!requireEditableQuote(quoteId, res)) return;
  if (!quotesRepo.getQuoteById(quoteId)) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  const data = lineItemSchema.parse(req.body);
  const item = quotesRepo.addLineItem(quoteId, data);
  quotesRepo.recalculateTotals(quoteId);
  res.status(201).json({ success: true, data: item });
});

/** PUT /api/quotes/:id/items/:itemId — update line item (auto-recalculates totals) */
router.put('/:id/items/:itemId', (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.id, 10);
  const itemId = parseInt(req.params.itemId, 10);
  if (!requireEditableQuote(quoteId, res)) return;
  if (!quotesRepo.getQuoteById(quoteId)) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  if (!quotesRepo.getLineItemForQuote(quoteId, itemId)) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Line item not found' });
    return;
  }
  const data = lineItemUpdateSchema.parse(req.body);
  quotesRepo.updateLineItem(quoteId, itemId, data);
  quotesRepo.recalculateTotals(quoteId);
  res.json({ success: true, data: quotesRepo.getLineItemById(itemId) });
});

/** DELETE /api/quotes/:id/items/:itemId (auto-recalculates totals) */
router.delete('/:id/items/:itemId', (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.id, 10);
  const itemId = parseInt(req.params.itemId, 10);
  if (!requireEditableQuote(quoteId, res)) return;
  if (!quotesRepo.getQuoteById(quoteId)) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }
  if (!quotesRepo.getLineItemForQuote(quoteId, itemId)) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Line item not found' });
    return;
  }
  quotesRepo.deleteLineItem(quoteId, itemId);
  quotesRepo.recalculateTotals(quoteId);
  res.json({ success: true, data: { deleted: true } });
});

/** PUT /api/quotes/:id/items/:itemId/priority — update item priority */
router.put('/:id/items/:itemId/priority', (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.id, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const item = quotesRepo.getLineItemForQuote(quoteId, itemId);
  if (!item) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Line item not found' });
    return;
  }
  const { priority } = z.object({ priority: prioritySchema }).parse(req.body);
  quotesRepo.updateLineItemPriority(quoteId, itemId, priority);
  res.json({ success: true, data: quotesRepo.getLineItemById(itemId) });
});

/** PUT /api/quotes/:id/items/:itemId/explanation — cache AI explanation */
router.put('/:id/items/:itemId/explanation', (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.id, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const item = quotesRepo.getLineItemForQuote(quoteId, itemId);
  if (!item) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Line item not found' });
    return;
  }
  const { explanation } = req.body as { explanation?: string };
  if (typeof explanation !== 'string') {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing "explanation" string' });
    return;
  }
  quotesRepo.updateLineItemExplanation(quoteId, itemId, explanation);
  res.json({ success: true, data: quotesRepo.getLineItemById(itemId) });
});

export default router;
