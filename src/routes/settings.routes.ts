import { Router, type Request, type Response } from 'express';
import { settingsRepo } from '../database/repositories/settings.repo.js';
import { getDatabase } from '../config/database.js';
import { uploadLogo } from '../middleware/upload.middleware.js';
import { parseSettingValue, settingsUpdateSchema } from '../validation/schemas.js';

const router = Router();

export function redactSensitiveSettings(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const { smtp_pass: smtpPass, ...safeSettings } = settings;
  return {
    ...safeSettings,
    smtp_pass_configured: typeof smtpPass === 'string' && smtpPass.length > 0,
  };
}

/** GET /api/settings — all settings as parsed JSON */
router.get('/', (_req: Request, res: Response) => {
  const settings = redactSensitiveSettings(settingsRepo.getAllParsed());
  res.json({ success: true, data: settings });
});

/** PUT /api/settings — bulk update settings */
router.put('/', (req: Request, res: Response) => {
  const data = settingsUpdateSchema.parse(req.body);
  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    // Always JSON-encode so getAllParsed can reliably decode
    updates[key] = JSON.stringify(value);
  }
  settingsRepo.bulkSet(updates);
  res.json({ success: true, data: redactSensitiveSettings(settingsRepo.getAllParsed()) });
});

/** GET /api/settings/:key — single setting */
router.get('/:key', (req: Request, res: Response) => {
  const value = settingsRepo.get(req.params.key);
  if (value === null) {
    res.status(404).json({ success: false, error: 'not_found', message: `Setting "${req.params.key}" not found` });
    return;
  }
  if (req.params.key === 'smtp_pass') {
    const configured = settingsRepo.getTyped<string>('smtp_pass', '').length > 0;
    res.json({ success: true, data: { key: req.params.key, configured } });
    return;
  }
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { parsed = value; }
  res.json({ success: true, data: { key: req.params.key, value: parsed } });
});

/** PUT /api/settings/:key — set single setting */
router.put('/:key', (req: Request, res: Response) => {
  const { value } = req.body;
  const parsed = parseSettingValue(req.params.key, value);
  settingsRepo.setTyped(req.params.key, parsed);
  const data = req.params.key === 'smtp_pass'
    ? { key: req.params.key, configured: typeof parsed === 'string' && parsed.length > 0 }
    : { key: req.params.key, value: parsed };
  res.json({ success: true, data });
});

// ── Shop Profile ──

/** GET /api/settings/profile — shop profile */
router.get('/profile/data', (_req: Request, res: Response) => {
  const db = getDatabase();
  const profile = db.prepare('SELECT * FROM shop_profile WHERE id = 1').get() as any;
  res.json({ success: true, data: profile });
});

/** PUT /api/settings/profile — update shop profile */
router.put('/profile/data', (req: Request, res: Response) => {
  const db = getDatabase();
  const { shop_name, address, address_street, address_city, address_state, address_zip, phone, email, website } = req.body;
  db.prepare(`
    UPDATE shop_profile
    SET shop_name = COALESCE(?, shop_name),
        address_street = COALESCE(?, address_street),
        address_city = COALESCE(?, address_city),
        address_state = COALESCE(?, address_state),
        address_zip = COALESCE(?, address_zip),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        website = COALESCE(?, website)
    WHERE id = 1
  `).run(
    shop_name,
    address_street ?? address,  // support legacy single-field address
    address_city,
    address_state,
    address_zip,
    phone,
    email,
    website,
  );
  const profile = db.prepare('SELECT * FROM shop_profile WHERE id = 1').get();
  res.json({ success: true, data: profile });
});

/** POST /api/settings/logo — upload shop logo */
router.post('/logo', (req: Request, res: Response) => {
  uploadLogo(req, res, (err) => {
    if (err) {
      res.status(400).json({ success: false, error: 'upload_failed', message: err.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: 'no_file', message: 'No logo file provided' });
      return;
    }
    const db = getDatabase();
    const logoPath = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE shop_profile SET logo_path = ? WHERE id = 1').run(logoPath);
    res.json({ success: true, data: { logo_path: logoPath } });
  });
});

export default router;