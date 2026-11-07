/**
 * Zod validation schemas for request bodies.
 * Shared by API routes to reject malformed input before it hits the DB.
 */
import { z } from 'zod';

export const itemTypeSchema = z.enum(['part', 'labor', 'misc', 'fee', 'shipping']);
export const prioritySchema = z.enum(['safety_critical', 'required', 'recommended', 'optional']).nullable();

export const lineItemSchema = z.object({
  item_type: itemTypeSchema,
  description: z.string().trim().min(1, 'Description is required').max(500),
  priority: prioritySchema.optional(),
  vendor: z.string().max(100).nullable().optional(),
  vendor_part_id: z.string().max(100).nullable().optional(),
  part_number: z.string().max(100).nullable().optional(),
  brand: z.string().max(100).nullable().optional(),
  source_url: z.string().max(1000).nullable().optional(),
  option_value: z.string().max(1000).nullable().optional(),
  unit_cost: z.number().int().min(0).max(10_000_000).optional(),
  markup_percent: z.number().min(-100).max(1000).optional(),
  unit_price: z.number().int().min(0).max(10_000_000).optional(),
  quantity: z.number().min(0).max(100_000).optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const lineItemUpdateSchema = lineItemSchema.partial();

export const createQuoteSchema = z.object({
  customer_id: z.number().int().positive().nullable().optional(),
  vehicle_id: z.number().int().positive().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  labor_rate_override: z.number().int().min(0).nullable().optional(),
  tax_rate_override: z.number().min(0).max(100).nullable().optional(),
  shop_fee_override: z.number().min(0).max(100).nullable().optional(),
  markup_override: z.number().min(0).max(1000).nullable().optional(),
});

export const quoteUpdateSchema = createQuoteSchema.extend({
  valid_until: z.string().max(50).nullable().optional(),
}).partial();

export const quoteStatusSchema = z.enum(['draft', 'sent', 'approved', 'declined', 'expired']);

export const totalsSchema = z.object({
  parts_subtotal: z.number().int().min(0),
  labor_subtotal: z.number().int().min(0),
  shop_fee_amount: z.number().int().min(0),
  misc_fees_total: z.number().int().min(0),
  tax_total: z.number().int().min(0),
  shipping_total: z.number().int().min(0),
  grand_total: z.number().int().min(0),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').or(z.literal('')).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  address_street: z.string().max(250).nullable().optional(),
  address_city: z.string().max(100).nullable().optional(),
  address_state: z.string().max(50).nullable().optional(),
  address_zip: z.string().max(20).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const customerUpdateSchema = customerSchema.partial();

export const vehicleSchema = z.object({
  customer_id: z.number().int().positive().nullable().optional(),
  vin: z.string().max(30).nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  make: z.string().max(100).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  submodel: z.string().max(100).nullable().optional(),
  engine: z.string().max(100).nullable().optional(),
  transmission: z.string().max(100).nullable().optional(),
  drivetrain: z.string().max(50).nullable().optional(),
  mileage: z.number().int().min(0).max(5_000_000).nullable().optional(),
  license_plate: z.string().max(30).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
});

export const vehicleUpdateSchema = vehicleSchema.partial();

const settingSchemas = {
  shop_name: z.string().max(200),
  shop_address: z.string().max(500),
  shop_phone: z.string().max(50),
  shop_email: z.string().email().or(z.literal('')),
  shop_website: z.string().url().or(z.literal('')),
  labor_rate: z.number().int().min(0).max(10_000_000),
  tax_rate: z.number().min(0).max(100),
  tax_applies_to_parts: z.boolean(),
  tax_applies_to_labor: z.boolean(),
  shop_fee_percent: z.number().min(0).max(100),
  shop_fee_cap: z.number().int().min(0).max(10_000_000),
  shop_fee_flat: z.number().int().min(0).max(10_000_000),
  disposal_fee: z.number().int().min(0).max(10_000_000),
  shipping_default: z.number().int().min(0).max(10_000_000),
  markup_default: z.number().min(0).max(1000),
  shop_zip_code: z.string().max(20),
  ai_enabled: z.boolean(),
  lmstudio_url: z.string().url().max(2048),
  lmstudio_model: z.string().max(500),
  smtp_host: z.string().max(255),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_user: z.string().max(500),
  smtp_pass: z.string().max(2000),
  smtp_from: z.string().max(500),
  smtp_secure: z.boolean(),
} satisfies z.ZodRawShape;

export const settingsUpdateSchema = z.object(settingSchemas).partial().strict();
export const settingKeySchema = z.enum(
  Object.keys(settingSchemas) as [keyof typeof settingSchemas, ...(keyof typeof settingSchemas)[]],
);

export function parseSettingValue(key: string, value: unknown): unknown {
  const validKey = settingKeySchema.parse(key);
  return settingSchemas[validKey].parse(value);
}

/** Parse & validate; returns { data } or throws a ZodError (handled by middleware). */
export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
