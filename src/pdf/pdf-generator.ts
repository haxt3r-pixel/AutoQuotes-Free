/**
 * PDF Generation Engine using Playwright (Chromium headless).
 * Renders an HTML Handlebars template → full-page PDF.
 */
import { chromium } from 'playwright';
import Handlebars from 'handlebars';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { quotesRepo } from '../database/repositories/quotes.repo.js';
import { customersRepo } from '../database/repositories/customers.repo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, 'templates');
const EXPORTS_DIR = path.resolve(__dirname, '..', '..', 'exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// ── Types for template data ──

export interface PdfQuoteData {
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  shopEmail: string | null;
  shopLogo: string | null;
  /** False when a logo is present — logo already includes branding. */
  showShopNameText: boolean;
  quoteNumber: string;
  quoteDate: string;
  validUntil: string | null;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  vehicleYearMakeModel: string | null;
  vehicleEngine: string | null;
  vehicleTransmission: string | null;
  vehicleVIN: string | null;
  vehicleMileage: string | null;
  hasPriorityItems: boolean;
  prioritySummary: Array<{ category: string; label: string; count: number }>;
  lineItems: Array<{
    index: number;
    itemType: string;
    description: string;
    priority: string | null;
    priorityLabel: string | null;
    partNumber: string | null;
    brand: string | null;
    unitPrice: string;
    quantity: string;
    lineTotal: string;
    aiExplanation: string | null;
  }>;
  partsSubtotal: string;
  laborSubtotal: string;
  miscSubtotal: string;
  shopFeeDisplay: string | null;
  shopFeeNote: string | null;
  disposalFeeDisplay: string | null;
  taxDisplay: string | null;
  taxRate: string;
  shippingDisplay: string | null;
  grandTotal: string;
  notes: string | null;
  disclaimer: string;
}

// ── Template loading (cached, invalidated when the HTML file changes) ──

let cachedTemplate: Handlebars.TemplateDelegate<PdfQuoteData> | null = null;
let cachedTemplateMtimeMs = 0;

function getTemplate(): Handlebars.TemplateDelegate<PdfQuoteData> {
  const templatePath = path.join(TEMPLATE_DIR, 'quote-template.html');
  const mtimeMs = fs.statSync(templatePath).mtimeMs;
  if (!cachedTemplate || mtimeMs !== cachedTemplateMtimeMs) {
    const source = fs.readFileSync(templatePath, 'utf-8');
    cachedTemplate = Handlebars.compile<PdfQuoteData>(source);
    cachedTemplateMtimeMs = mtimeMs;
  }
  return cachedTemplate;
}

function resolveLogoPath(logoPath: string): string | null {
  const relative = logoPath.replace(/^\//, '');
  const candidates = [
    path.resolve(__dirname, '..', '..', relative), // project root from src/pdf or dist/pdf
    path.resolve(process.cwd(), relative),
    path.resolve(process.cwd(), 'uploads', path.basename(relative)),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// ── Data assembly ──

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const PRIORITY_LABELS: Record<string, string> = {
  safety_critical: 'Safety',
  recommended: 'Recommended',
  optional: 'Optional',
};

async function assembleQuoteData(quoteId: number): Promise<PdfQuoteData> {
  const fullQuote = quotesRepo.getFullQuote(quoteId);
  if (!fullQuote) throw new Error(`Quote #${quoteId} not found`);

  const { header, items } = fullQuote;

  // Shop profile
  const db = (await import('../config/database.js')).getDatabase();
  const profile = db.prepare('SELECT * FROM shop_profile WHERE id = 1').get() as any;
  const shopName = profile?.shop_name || 'Auto Repair Shop';

  // Customer & vehicle
  let customerName = '—';
  let customerEmail: string | null = null;
  let customerPhone: string | null = null;
  let customerAddress: string | null = null;
  let vehicleYearMakeModel: string | null = null;
  let vehicleEngine: string | null = null;
  let vehicleTransmission: string | null = null;
  let vehicleVIN: string | null = null;
  let vehicleMileage: string | null = null;

  if (header.customer_id) {
    const customer = customersRepo.getCustomerById(header.customer_id);
    if (customer) {
      customerName = customer.name;
      customerEmail = customer.email;
      customerPhone = customer.phone;
      customerAddress = [
        customer.address_street || customer.address,
        [customer.address_city, customer.address_state].filter(Boolean).join(', '),
        customer.address_zip,
      ].filter(Boolean).join(' ') || null;
    }
  }

  if (header.vehicle_id) {
    const vehicle = customersRepo.getVehicleById(header.vehicle_id);
    if (vehicle) {
      const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
      vehicleYearMakeModel = parts.length > 0 ? parts.join(' ') : null;
      vehicleEngine = vehicle.engine;
      vehicleTransmission = vehicle.transmission;
      vehicleVIN = vehicle.vin;
      vehicleMileage = vehicle.mileage ? `${vehicle.mileage.toLocaleString()} mi` : null;
    }
  }

  // Priority summary
  const priorityCounts: Record<string, number> = {};
  for (const item of items) {
    if (item.priority) {
      priorityCounts[item.priority] = (priorityCounts[item.priority] || 0) + 1;
    }
  }
  const hasPriorityItems = Object.keys(priorityCounts).length > 0;
  const prioritySummary = Object.entries(priorityCounts).map(([category, count]) => ({
    category,
    label: PRIORITY_LABELS[category] || category,
    count,
  }));

  // Line items
  const lineItems = items.map((item, i) => ({
    index: i + 1,
    itemType: item.item_type,
    description: item.description,
    priority: item.priority,
    priorityLabel: item.priority ? PRIORITY_LABELS[item.priority] : null,
    partNumber: item.part_number,
    brand: item.brand,
    unitPrice: formatCurrency(item.unit_price),
    quantity: String(item.quantity),
    lineTotal: formatCurrency(item.line_total),
    aiExplanation: item.ai_explanation,
  }));

  // Logo — when present, text shop name is suppressed (branding is in the image)
  let shopLogo: string | null = null;
  if (profile?.logo_path) {
    const logoFullPath = resolveLogoPath(String(profile.logo_path));
    if (logoFullPath) {
      const logoBuffer = fs.readFileSync(logoFullPath);
      const ext = path.extname(logoFullPath).toLowerCase();
      const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      shopLogo = `data:${mime};base64,${logoBuffer.toString('base64')}`;
    } else {
      console.warn('[PDF] Shop logo file not found for path:', profile.logo_path);
    }
  }
  const showShopNameText = !shopLogo;

  // Fee/tax display
  // Historical rates are not recorded with totals. Do not label them with
  // today's settings: those can differ from the rates used for this quote.
  const shopFeeNote = null;

  return {
    shopName,
    shopAddress: [
      profile?.address_street || profile?.address,
      [profile?.address_city, profile?.address_state].filter(Boolean).join(', '),
      profile?.address_zip,
    ].filter(Boolean).join(' ') || null,
    shopPhone: profile?.phone || null,
    shopEmail: profile?.email || null,
    shopLogo,
    showShopNameText,
    quoteNumber: header.quote_number,
    quoteDate: new Date(header.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    validUntil: header.valid_until ? new Date(header.valid_until).toLocaleDateString() : null,
    status: header.status,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    vehicleYearMakeModel,
    vehicleEngine,
    vehicleTransmission,
    vehicleVIN,
    vehicleMileage,
    hasPriorityItems,
    prioritySummary,
    lineItems,
    partsSubtotal: formatCurrency(header.parts_subtotal),
    laborSubtotal: formatCurrency(header.labor_subtotal),
    miscSubtotal: formatCurrency(header.misc_fees_total),
    shopFeeDisplay: header.shop_fee_amount > 0 ? formatCurrency(header.shop_fee_amount) : null,
    shopFeeNote,
    disposalFeeDisplay: null, // Included in misc
    taxDisplay: header.tax_total > 0 ? formatCurrency(header.tax_total) : null,
    taxRate: '',
    shippingDisplay: header.shipping_total > 0 ? formatCurrency(header.shipping_total) : null,
    grandTotal: formatCurrency(header.grand_total),
    notes: header.notes,
    disclaimer: '',
  };
}

// ── PDF Generation ──

// Reuse a lazy browser instance across PDF generations (avoids a fresh
// Chromium launch per PDF — expensive).
let pdfBrowser: import('playwright').Browser | null = null;

async function getPdfBrowser(): Promise<import('playwright').Browser> {
  if (!pdfBrowser || !pdfBrowser.isConnected()) {
    pdfBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return pdfBrowser;
}

/**
 * Convert near-white logo backgrounds to true alpha so opaque RGB uploads
 * (common for shop badges) print cleanly on the PDF page.
 */
async function makeLogoBackgroundTransparent(logoDataUrl: string): Promise<string> {
  if (!logoDataUrl.startsWith('data:image/')) return logoDataUrl;

  const browser = await getPdfBrowser();
  const context = await browser.newContext({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });

  try {
    const page = await context.newPage();
    await page.setContent(
      `<!DOCTYPE html><html><body style="margin:0;background:transparent">
        <img id="logo" src="${logoDataUrl}" />
      </body></html>`,
      { waitUntil: 'load', timeout: 10000 },
    );

    // Browser-side canvas code runs in Playwright; keep it untyped so Node TS builds without DOM libs.
    const transparentDataUrl = await page.evaluate(async () => {
      const doc = (globalThis as any).document;
      const img = doc.getElementById('logo');
      if (!img) return null;
      if (!img.complete) {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load logo image'));
        });
      }

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) return null;

      const canvas = doc.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const minChannel = Math.min(r, g, b);
        const maxChannel = Math.max(r, g, b);
        const isNearGray = maxChannel - minChannel <= 18;

        // Fully transparent pure/near-white paper background
        if (isNearGray && minChannel >= 248) {
          data[i + 3] = 0;
          continue;
        }

        // Soft fade for anti-aliased white edges around the badge
        if (isNearGray && minChannel >= 230) {
          const alpha = Math.round(255 * ((248 - minChannel) / 18));
          data[i + 3] = Math.max(0, Math.min(255, alpha));
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png') as string;
    });

    return transparentDataUrl || logoDataUrl;
  } catch (err) {
    console.warn('[PDF] Logo transparency processing failed — using original image:', err);
    return logoDataUrl;
  } finally {
    await context.close();
  }
}

export async function generateQuotePdf(quoteId: number): Promise<{ filePath: string; fileName: string }> {
  const data = await assembleQuoteData(quoteId);
  if (data.shopLogo) {
    data.shopLogo = await makeLogoBackgroundTransparent(data.shopLogo);
  }
  // Keep text name suppressed whenever a logo image is used (branding is in the artwork).
  data.showShopNameText = !data.shopLogo;
  const template = getTemplate();
  const html = template(data);

  const fileName = `${data.quoteNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
  const filePath = path.join(EXPORTS_DIR, fileName);

  const browser = await getPdfBrowser();
  const context = await browser.newContext({ viewport: { width: 1024, height: 1320 } });
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 15000 });
    await page.pdf({
      path: filePath,
      format: 'Letter',
      margin: { top: '30px', bottom: '55px', left: '30px', right: '30px' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;padding:0 30px;font-family:Arial,sans-serif;font-size:8px;color:#94a3b8;display:flex;justify-content:space-between;">
          <span>${data.shopName.replace(/[<>&'"]/g, '')} · ${data.quoteNumber}</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });
  } finally {
    await context.close();
  }

  return { filePath, fileName };
}

/** Close the shared PDF browser (e.g. during app shutdown). */
export async function closePdfBrowser(): Promise<void> {
  if (pdfBrowser) {
    await pdfBrowser.close().catch(() => {});
    pdfBrowser = null;
  }
}
