import { Router, type Request, type Response } from 'express';
import { searchParts, calculateRockAutoShipping, launchRockAutoCheckout, type PartToShip } from '../parts/parts-scraper.js';
import { getDatabase } from '../config/database.js';

const router = Router();

/** Only permit direct HTTPS listings on RockAuto's actual domains. */
export function isRockAutoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /[\x00-\x20\x7f]/.test(value)) return false;
  try {
    const url = new URL(value);
    const authority = value.slice(value.indexOf('//') + 2).split(/[/?#]/, 1)[0];
    return !authority.includes('@') && url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'rockauto.com' || url.hostname.endsWith('.rockauto.com'));
  } catch {
    return false;
  }
}

function hasOnlyRockAutoListings(parts: PartToShip[]): boolean {
  return parts.every(part => part && typeof part === 'object' && isRockAutoUrl(part.listing_url));
}

/** POST /api/parts/search — search parts across vendors */
router.post('/search', async (req: Request, res: Response) => {
  const { query, vendors, vehicleContext, vehicle, zipCode } = req.body as {
    query?: string;
    vendors?: string[];
    vehicleContext?: string;
    vehicle?: { year?: number; make?: string; model?: string; engine?: string };
    zipCode?: string;
  };

  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    res.status(400).json({
      success: false,
      error: 'bad_request',
      message: 'Search query must be at least 2 characters',
    });
    return;
  }

  try {
    const parts = await searchParts(query.trim(), { vendors, vehicleContext, vehicle, zipCode });
    res.json({ success: true, data: parts });
  } catch (err: any) {
    console.error('[PartsRoutes] Search failed:', err.message);
    res.status(500).json({
      success: false,
      error: 'search_failed',
      message: err.message || 'Parts search failed',
    });
  }
});

/** GET /api/parts/cache — list cached searches */
router.get('/cache', (_req: Request, res: Response) => {
  const db = getDatabase();
  const rows = db
    .prepare(
      'SELECT DISTINCT vendor, search_keyword, MAX(cached_at) as cached_at FROM parts_cache GROUP BY vendor, search_keyword ORDER BY cached_at DESC LIMIT 20',
    )
    .all();
  res.json({ success: true, data: rows });
});

/** DELETE /api/parts/cache — clear all cached parts */
router.delete('/cache', (_req: Request, res: Response) => {
  const db = getDatabase();
  db.prepare('DELETE FROM parts_cache').run();
  res.json({ success: true, data: { cleared: true } });
});

/** POST /api/parts/shipping — estimate shipping for a specific part */
router.post('/shipping', async (req: Request, res: Response) => {
  const { partName, zipCode, sourceUrl } = req.body as {
    partName?: string;
    zipCode?: string;
    sourceUrl?: unknown;
  };

  if (sourceUrl != null && !isRockAutoUrl(sourceUrl)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Invalid RockAuto listing URL.' });
    return;
  }

  const name = (partName || '').toLowerCase();
  const zip = (zipCode || '').toString().trim();

  // RockAuto shipping tiers based on typical part weight/size
  // Brake pads ~3-5 lbs, rotors ~15-20 lbs, radiators ~10 lbs, etc.
  let weightLbs = 3; // default weight

  if (/rotor|caliper|drum|radiator|ac compressor|a\/c compressor|alternator|starter|control arm|axle|wheel bearing|hub/i.test(name)) {
    weightLbs = 15;
  } else if (/strut|shock|spring|brake pad kit|rotor & pad kit/i.test(name)) {
    weightLbs = 10;
  } else if (/battery/i.test(name)) {
    weightLbs = 35;
  } else if (/pad|shoe|filter|plug|sensor|belt|hose|wiper|gasket|seal|bulb|cap|clip|bolt/i.test(name)) {
    weightLbs = 3;
  } else if (/pump|compressor|tie rod|ball joint|mount/i.test(name)) {
    weightLbs = 8;
  }

  // RockAuto flat rate: $5.99 base + ~$0.50/lb over 2 lbs + zone adjustment
  let shipping = 5.99;
  if (weightLbs > 2) {
    shipping += (weightLbs - 2) * 0.50;
  }

  // Zone adjustment based on ZIP
  if (zip.length >= 1) {
    const fd = zip[0];
    if (fd === '6') shipping *= 0.90;         // TX/NM/OK area — near warehouse
    else if ('345'.includes(fd)) shipping *= 0.92;  // Midwest
    else if ('012'.includes(fd)) shipping *= 1.15;  // East coast + Puerto Rico
    else if ('89'.includes(fd)) shipping *= 1.08;   // West coast
  }

  shipping = Math.round(shipping * 100) / 100;

  res.json({
    success: true,
    data: {
      shipping_cents: Math.round(shipping * 100),
      shipping_dollars: shipping,
      weight_lbs_est: weightLbs,
      zip: zip || null,
      formula: `$${shipping.toFixed(2)} estimate (${weightLbs}lbs to ${zip || 'N/A'})`,
    },
  });
});

/** POST /api/parts/shipping/checkout — add parts to RockAuto cart and get actual shipping */
router.post('/shipping/checkout', async (req: Request, res: Response) => {
  const { parts, zipCode } = req.body as {
    parts?: PartToShip[];
    zipCode?: string;
  };

  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing "parts" array with part_number and listing_url' });
    return;
  }

  if (!hasOnlyRockAutoListings(parts)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Every part needs a RockAuto listing URL to calculate shipping.' });
    return;
  }
  const rockAutoParts = parts;
  if (rockAutoParts.some(p => !Number.isInteger(p.quantity ?? 1) || (p.quantity ?? 1) < 1 || (p.quantity ?? 1) > 100)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Part quantities must be whole numbers between 1 and 100.' });
    return;
  }

  const result = await calculateRockAutoShipping(rockAutoParts, zipCode);

  if (!result) {
    res.status(422).json({ success: false, error: 'shipping_unavailable', message: 'Could not calculate shipping for every part. Check the ZIP code and listings, then try again.' });
    return;
  }

  res.json({
    success: true,
    data: {
      rockauto_shipping: result,
      rockauto_parts_count: rockAutoParts.length,
      non_rockauto_parts_count: 0,
      total_shipping_cents: result.total_shipping_cents,
    },
  });
});

/** POST /api/parts/purchase — add RockAuto parts to cart and return checkout link */
router.post('/purchase', async (req: Request, res: Response) => {
  const { parts, zipCode } = req.body as {
    parts?: PartToShip[];
    zipCode?: string;
  };

  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing "parts" array' });
    return;
  }

  if (!hasOnlyRockAutoListings(parts)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'No valid RockAuto parts with listing URLs' });
    return;
  }
  const validParts = parts;

  // Add all parts to cart
  const result = await calculateRockAutoShipping(
    validParts.map(p => ({
      part_number: p.part_number,
      listing_url: p.listing_url,
      part_name: p.part_name,
      option_value: p.option_value,
      quantity: p.quantity,
    })),
    zipCode,
  );

  res.json({
    success: true,
    data: {
      parts_added: result?.parts_in_cart || 0,
      cart_url: 'https://www.rockauto.com/en/cart/',
      listing_urls: validParts.map(p => p.listing_url),
      summary: result
        ? `$${(result.total_shipping_cents / 100).toFixed(2)} shipping to ${result.zip_code}`
        : 'Unable to calculate shipping',
    },
  });
});

/**
 * POST /api/parts/checkout — open a visible browser, auto-add every part to the
 * RockAuto cart, then land on the cart page for the user to complete purchase.
 */
router.post('/checkout', async (req: Request, res: Response) => {
  const { parts } = req.body as { parts?: PartToShip[] };

  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing "parts" array with part_number and listing_url' });
    return;
  }

  if (!hasOnlyRockAutoListings(parts)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'No valid RockAuto parts with listing URLs' });
    return;
  }
  const validParts = parts;

  try {
    const result = await launchRockAutoCheckout(validParts);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Parts/Checkout] Failed:', err.message);
    res.status(500).json({ success: false, error: 'checkout_failed', message: err.message });
  }
});

// ── Persistent Cart Session ──

let _cartModule: any = null;
async function getCart() {
  if (!_cartModule) {
    _cartModule = await import('../parts/cart-session.js');
  }
  return _cartModule.cartSession;
}

/** POST /api/parts/cart/add — add a part to the persistent background cart */
router.post('/cart/add', async (req: Request, res: Response) => {
  const { part_number, listing_url, part_name, option_value } = req.body || {};
  if (!part_number || !listing_url) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Missing part_number or listing_url' });
    return;
  }
  if (!isRockAutoUrl(listing_url)) {
    res.status(400).json({ success: false, error: 'bad_request', message: 'Invalid RockAuto listing URL.' });
    return;
  }

  const cart = await getCart();
  const added = await cart.addPart(part_number, listing_url, part_name || part_number, option_value);
  res.json({ success: true, data: { added, cart_size: cart.getItemCount() } });
});

/** GET /api/parts/cart — get persistent cart contents */
router.get('/cart', async (_req: Request, res: Response) => {
  const cart = await getCart();
  const items = await cart.getCartContents();
  res.json({ success: true, data: { items, count: items.length } });
});

/** DELETE /api/parts/cart — clear persistent cart */
router.delete('/cart', async (_req: Request, res: Response) => {
  const cart = await getCart();
  await cart.clearCart();
  res.json({ success: true, data: { cleared: true } });
});

export default router;
