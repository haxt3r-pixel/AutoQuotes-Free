/**
 * Default settings seeded into the database on first run.
 * All monetary values in cents (integer) to avoid floating-point issues.
 */
export const DEFAULT_SETTINGS: Record<string, string> = {
  // Shop Profile
  shop_name: JSON.stringify('My Auto Repair Shop'),
  shop_address: JSON.stringify(''),
  shop_phone: JSON.stringify(''),
  shop_email: JSON.stringify(''),
  shop_website: JSON.stringify(''),

  // Pricing Defaults
  labor_rate: JSON.stringify(12000),           // $120.00/hr in cents
  tax_rate: JSON.stringify(8.25),               // 8.25%
  tax_applies_to_parts: JSON.stringify(true),
  tax_applies_to_labor: JSON.stringify(true),
  shop_fee_percent: JSON.stringify(5),          // 5% of subtotal
  shop_fee_cap: JSON.stringify(5000),           // $50.00 max in cents
  shop_fee_flat: JSON.stringify(0),             // or flat amount in cents
  disposal_fee: JSON.stringify(300),            // $3.00 environmental fee in cents
  shipping_default: JSON.stringify(0),          // default shipping in cents
  markup_default: JSON.stringify(30),           // 30% default parts markup

  // Location
  shop_zip_code: JSON.stringify(''),

  // AI / LM Studio
  ai_enabled: JSON.stringify(false),
  lmstudio_url: JSON.stringify('http://localhost:1234/v1'),
  lmstudio_model: JSON.stringify(''),           // auto-detect if empty

  // Email
  smtp_host: JSON.stringify(''),
  smtp_port: JSON.stringify(587),
  smtp_user: JSON.stringify(''),
  smtp_pass: JSON.stringify(''),
  smtp_from: JSON.stringify(''),
  smtp_secure: JSON.stringify(false),
};

export const DEFAULT_LABOR_RATE_CENTS = 12000;
export const DEFAULT_TAX_RATE = 8.25;
export const DEFAULT_MARKUP_PERCENT = 30;
export const DEFAULT_SHOP_FEE_PERCENT = 5;
export const DEFAULT_SHOP_FEE_CAP_CENTS = 5000;