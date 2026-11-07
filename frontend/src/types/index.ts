// ── Shared types (mirrors backend interfaces) ──

export interface QuoteHeader {
  id: number;
  quote_number: string;
  customer_id: number | null;
  vehicle_id: number | null;
  status: 'draft' | 'sent' | 'approved' | 'declined' | 'expired';
  notes: string | null;
  valid_until: string | null;
  labor_rate_override: number | null;
  tax_rate_override: number | null;
  shop_fee_override: number | null;
  markup_override: number | null;
  parts_subtotal: number;
  labor_subtotal: number;
  shop_fee_amount: number;
  misc_fees_total: number;
  tax_total: number;
  shipping_total: number;
  grand_total: number;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  vehicle_summary?: string | null;
}

export interface LineItem {
  id: number;
  quote_id: number;
  item_type: 'part' | 'labor' | 'misc' | 'fee' | 'shipping';
  description: string;
  priority: 'safety_critical' | 'required' | 'recommended' | 'optional' | null;
  vendor: string | null;
  vendor_part_id: string | null;
  part_number: string | null;
  brand: string | null;
  source_url: string | null;
  option_value?: string | null;
  unit_cost: number;
  markup_percent: number;
  unit_price: number;
  quantity: number;
  line_total: number;
  sort_order: number;
  ai_explanation: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  notes: string | null;
  vehicle_count?: number;
  quote_count?: number;
}

export interface Vehicle {
  id: number;
  customer_id: number | null;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  transmission: string | null;
  mileage: number | null;
  license_plate: string | null;
  color: string | null;
}

export interface AiStatus {
  connected: boolean;
  enabled: boolean;
  models: string[];
  model: string | null;
  error: string | null;
}

export interface CategorizedItem {
  index: number;
  category: 'safety_critical' | 'required' | 'recommended' | 'optional';
  reason: string;
}

export interface ScrapedPart {
  vendor: string;
  vendor_part_id: string;
  part_name: string;
  part_number: string;
  price_cents: number;
  item_type: 'part' | 'misc';
  source_url: string;
  image_url?: string;
  brand?: string;
  fitment_position?: string;
  availability?: string;
  shipping_estimate?: string;
  cart_action?: string;
  cart_nck?: string;
  cart_hidden_fields?: Record<string, string>;
  option_value?: string;
  option_label?: string;
}

export interface ShopProfile {
  id: number;
  shop_name: string;
  address: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_path: string | null;
}

export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type BillingStatus = 'open' | 'paid' | 'void';

export interface JobHeader {
  id: number;
  job_number: string;
  quote_id: number;
  customer_id: number | null;
  vehicle_id: number | null;
  status: JobStatus;
  quote_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  vehicle_summary: string | null;
  vehicle_vin: string | null;
  vehicle_mileage: string | null;
  quote_notes: string | null;
  mechanic_notes: string | null;
  completion_notes: string | null;
  parts_subtotal: number;
  labor_subtotal: number;
  shop_fee_amount: number;
  misc_fees_total: number;
  tax_total: number;
  shipping_total: number;
  grand_total: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  billing_ticket_id?: number | null;
  billing_ticket_number?: string | null;
  billing_status?: BillingStatus | null;
  items_total?: number;
  items_done?: number;
}

export interface JobLineItem {
  id: number;
  job_id: number;
  source_line_item_id: number | null;
  item_type: 'part' | 'labor' | 'misc' | 'fee' | 'shipping';
  description: string;
  priority: 'safety_critical' | 'required' | 'recommended' | 'optional' | null;
  vendor: string | null;
  part_number: string | null;
  brand: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  is_done: number;
  mechanic_note: string | null;
  sort_order: number;
  created_at: string;
}

export interface FullJob {
  header: JobHeader;
  items: JobLineItem[];
}

export interface BillingTicket {
  id: number;
  ticket_number: string;
  job_id: number;
  quote_id: number;
  customer_id: number | null;
  status: BillingStatus;
  amount_due_cents: number;
  amount_paid_cents: number;
  paid_in_full: number;
  paid_at: string | null;
  payment_note: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  vehicle_summary: string | null;
  job_number: string;
  quote_number: string;
  created_at: string;
  closed_at: string | null;
  updated_at: string;
}

export interface JobSummaryRef {
  id: number;
  job_number: string;
  status: JobStatus;
}

export function getJobDisplayStatus(job: JobHeader): JobStatus | 'void' {
  return job.billing_status === 'void' ? 'void' : job.status;
}

// ── API response wrappers ──

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
  rawResponse?: string;
}

// ── Monetary helpers ──

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function formatCurrency(cents: number): string {
  return `$${centsToDollars(cents)}`;
}