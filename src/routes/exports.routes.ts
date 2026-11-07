import { Router, type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import { generateQuotePdf } from '../pdf/pdf-generator.js';
import { sendEmail, generateMailtoUri, isEmailConfigured } from '../email/email.service.js';
import { settingsRepo } from '../database/repositories/settings.repo.js';
import { quotesRepo } from '../database/repositories/quotes.repo.js';
import { customersRepo } from '../database/repositories/customers.repo.js';
import { getDatabase } from '../config/database.js';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

/** POST /api/exports/pdf/:quoteId — generate PDF and return download URL */
router.post('/pdf/:quoteId', asyncHandler(async (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.quoteId, 10);
  if (isNaN(quoteId)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Invalid quote ID' });
    return;
  }

  try {
    const { fileName } = await generateQuotePdf(quoteId);
    res.json({
      success: true,
      data: {
        fileName,
        downloadUrl: `/exports/${fileName}`,
        viewUrl: `/api/exports/pdf/${quoteId}/view`,
      },
    });
  } catch (err: any) {
    console.error('[PDF] Generation failed:', err);
    res.status(500).json({ success: false, error: 'pdf_failed', message: err.message });
  }
}));

/** GET /api/exports/pdf/:quoteId/view — generate the latest PDF and display it */
router.get('/pdf/:quoteId/view', asyncHandler(async (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.quoteId, 10);
  const quote = quotesRepo.getQuoteById(quoteId);
  if (!quote) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }

  const { filePath: pdfPath, fileName } = await generateQuotePdf(quoteId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  fs.createReadStream(pdfPath).pipe(res);
}));

/** GET /api/exports/pdf/:quoteId/download — generate and download the latest PDF */
router.get('/pdf/:quoteId/download', asyncHandler(async (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.quoteId, 10);
  const quote = quotesRepo.getQuoteById(quoteId);
  if (!quote) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }

  const { filePath: pdfPath, fileName } = await generateQuotePdf(quoteId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  fs.createReadStream(pdfPath).pipe(res);
}));

/** POST /api/exports/email/:quoteId — send quote via email */
router.post('/email/:quoteId', asyncHandler(async (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.quoteId, 10);
  const { to, subject, body } = req.body;

  if (!to) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing "to" email address' });
    return;
  }

  // Build email body if not provided
  const shopProfile = (() => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM shop_profile WHERE id = 1').get() as any;
  })();

  const shopName = shopProfile?.shop_name || 'Auto Repair Shop';
  const quote = quotesRepo.getQuoteById(quoteId);
  if (!quote) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }

  const emailSubject = subject || `Repair Quote ${quote.quote_number} from ${shopName}`;

  const emailBodyHtml = body || `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Repair Quote ${quote.quote_number}</h2>
      <p>Dear Customer,</p>
      <p>Please find your repair quote attached. The total estimate is <strong>$${(quote.grand_total / 100).toFixed(2)}</strong>.</p>
      <p>If you have any questions or would like to schedule the service, please contact us.</p>
      <p>Thank you,<br><strong>${shopName}</strong></p>
    </div>
  `;

  const emailBodyText = `Repair Quote ${quote.quote_number} from ${shopName}\n\nTotal Estimate: $${(quote.grand_total / 100).toFixed(2)}\n\nPlease contact us to schedule.`;

  // Check if SMTP is configured
  if (!isEmailConfigured()) {
    // Generate mailto: fallback
    const mailtoUri = generateMailtoUri({
      to,
      subject: emailSubject,
      body: emailBodyText,
    });
    res.json({
      success: true,
      data: {
        sent: false,
        method: 'mailto',
        mailtoUri,
        message: 'SMTP not configured. Use the mailto: link to open your default email client.',
      },
    });
    return;
  }

  // Generate PDF first (for attachment)
  let pdfFileName: string | null = null;
  let pdfPath: string | null = null;
  try {
    const result = await generateQuotePdf(quoteId);
    pdfFileName = result.fileName;
    pdfPath = result.filePath;
  } catch (err) {
    console.warn('[Email] PDF generation failed:', err);
    res.status(500).json({ success: false, error: 'pdf_failed', message: 'Could not generate the PDF attachment. Email was not sent.' });
    return;
  }

  const attachments = pdfPath ? [{ filename: pdfFileName || 'quote.pdf', path: pdfPath }] : [];

  const result = await sendEmail({
    to,
    subject: emailSubject,
    bodyHtml: emailBodyHtml,
    bodyText: emailBodyText,
    attachments,
  });

  if (!result.success) {
    res.status(502).json({ success: false, error: 'email_failed', message: result.message });
    return;
  }
  res.json({ success: true, data: result });
}));

/** GET /api/exports/mailto/:quoteId — get mailto: URI for the quote */
router.get('/mailto/:quoteId', (req: Request, res: Response) => {
  const quoteId = parseInt(req.params.quoteId, 10);
  const quote = quotesRepo.getQuoteById(quoteId);
  if (!quote) {
    res.status(404).json({ success: false, error: 'not_found', message: 'Quote not found' });
    return;
  }

  const shopProfile = (() => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM shop_profile WHERE id = 1').get() as any;
  })();
  const shopName = shopProfile?.shop_name || 'Auto Repair Shop';

  const mailtoUri = generateMailtoUri({
    to: '',
    subject: `Repair Quote ${quote.quote_number} from ${shopName}`,
    body: `Repair Quote ${quote.quote_number}\n\nTotal Estimate: $${(quote.grand_total / 100).toFixed(2)}\n\nPlease attach the quote PDF.`,
  });

  res.json({ success: true, data: { mailtoUri } });
});

export default router;
