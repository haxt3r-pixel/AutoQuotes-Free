import { getDatabase } from '../../config/database.js';
import { calculateQuote, type LineItemInput, type QuoteSettings } from '../../core/quote-calculator.js';
import { settingsRepo } from './settings.repo.js';

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
}

export interface QuoteListItem extends QuoteHeader {
  customer_name: string | null;
  vehicle_summary: string | null;
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
  option_value: string | null;
  unit_cost: number;
  markup_percent: number;
  markup_inherited: number;
  unit_price: number;
  quantity: number;
  line_total: number;
  sort_order: number;
  ai_explanation: string | null;
}

export interface CreateLineItem {
  item_type: LineItem['item_type'];
  description: string;
  priority?: LineItem['priority'];
  vendor?: string | null;
  vendor_part_id?: string | null;
  part_number?: string | null;
  brand?: string | null;
  source_url?: string | null;
  option_value?: string | null;
  unit_cost?: number;
  markup_percent?: number;
  unit_price?: number;
  quantity?: number;
  sort_order?: number;
}

export class QuotesRepository {
  createQuote(overrides?: {
    customer_id?: number | null;
    vehicle_id?: number | null;
    notes?: string | null;
    labor_rate_override?: number | null;
    tax_rate_override?: number | null;
    shop_fee_override?: number | null;
    markup_override?: number | null;
  }): QuoteHeader {
    const db = getDatabase();
    return db.transaction(() => {
      const year = new Date().getFullYear();
      db.prepare(`
        INSERT INTO quote_number_sequences (year, last_number) VALUES (?, 1)
        ON CONFLICT(year) DO UPDATE SET last_number = last_number + 1
      `).run(year);
      const sequence = db.prepare(
        'SELECT last_number FROM quote_number_sequences WHERE year = ?',
      ).get(year) as { last_number: number };
      const quoteNumber = `Q-${year}-${String(sequence.last_number).padStart(4, '0')}`;
      const result = db.prepare(`
        INSERT INTO quotes (quote_number, customer_id, vehicle_id, notes,
          labor_rate_override, tax_rate_override, shop_fee_override, markup_override)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        quoteNumber,
        overrides?.customer_id ?? null,
        overrides?.vehicle_id ?? null,
        overrides?.notes ?? null,
        overrides?.labor_rate_override ?? null,
        overrides?.tax_rate_override ?? null,
        overrides?.shop_fee_override ?? null,
        overrides?.markup_override ?? null,
      );
      return this.getQuoteById(result.lastInsertRowid as number)!;
    })();
  }

  getQuoteById(id: number): QuoteHeader | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM quotes WHERE id = ?').get(id) as QuoteHeader) ?? null;
  }

  getQuoteByNumber(quoteNumber: string): QuoteHeader | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM quotes WHERE quote_number = ?').get(quoteNumber) as QuoteHeader) ?? null;
  }

  listQuotes(status?: string, limit = 50, offset = 0, search?: string): QuoteListItem[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (status) {
      conditions.push('q.status = ?');
      params.push(status);
    }
    if (search?.trim()) {
      const like = `%${search.trim()}%`;
      conditions.push(`(
        q.quote_number LIKE ? OR q.status LIKE ? OR COALESCE(q.notes, '') LIKE ? OR q.created_at LIKE ?
        OR COALESCE(c.name, '') LIKE ? OR COALESCE(c.email, '') LIKE ? OR COALESCE(c.phone, '') LIKE ?
        OR COALESCE(c.address, '') LIKE ? OR COALESCE(c.address_street, '') LIKE ?
        OR COALESCE(c.address_city, '') LIKE ? OR COALESCE(c.address_state, '') LIKE ?
        OR COALESCE(c.address_zip, '') LIKE ? OR COALESCE(v.vin, '') LIKE ? OR COALESCE(v.make, '') LIKE ?
        OR COALESCE(v.model, '') LIKE ? OR COALESCE(v.submodel, '') LIKE ? OR COALESCE(v.engine, '') LIKE ?
        OR COALESCE(v.transmission, '') LIKE ? OR COALESCE(v.license_plate, '') LIKE ? OR COALESCE(v.color, '') LIKE ?
        OR EXISTS (
          SELECT 1 FROM quote_line_items li
          WHERE li.quote_id = q.id AND (
            li.description LIKE ? OR COALESCE(li.part_number, '') LIKE ?
            OR COALESCE(li.brand, '') LIKE ? OR COALESCE(li.vendor, '') LIKE ?
            OR li.item_type LIKE ? OR COALESCE(li.priority, '') LIKE ?
          )
        )
      )`);
      params.push(...Array(26).fill(like));
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    return db.prepare(`
      SELECT q.*, c.name AS customer_name,
        trim(COALESCE(v.year || ' ', '') || COALESCE(v.make || ' ', '') ||
          COALESCE(v.model || ' ', '') || COALESCE(v.submodel, '')) AS vehicle_summary
      FROM quotes q
      LEFT JOIN customers c ON c.id = q.customer_id
      LEFT JOIN vehicles v ON v.id = q.vehicle_id
      ${where}
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params) as QuoteListItem[];
  }

  updateQuote(id: number, data: {
    customer_id?: number | null;
    vehicle_id?: number | null;
    notes?: string | null;
    valid_until?: string | null;
    labor_rate_override?: number | null;
    tax_rate_override?: number | null;
    shop_fee_override?: number | null;
    markup_override?: number | null;
  }): QuoteHeader | null {
    const db = getDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) return this.getQuoteById(id);
    values.push(id);
    db.prepare(`UPDATE quotes SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...values);
    return this.getQuoteById(id);
  }

  updateQuoteStatus(id: number, status: QuoteHeader['status']): void {
    const db = getDatabase();
    db.prepare("UPDATE quotes SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id);
  }

  /**
   * Recalculate all quote totals (and per-line pricing) using the
   * central pricing engine. Applies per-quote overrides where present,
   * falling back to global settings.
   */
  recalculateTotals(id: number): { header: QuoteHeader; items: LineItem[] } | null {
    const header = this.getQuoteById(id);
    if (!header) return null;

    const items = this.getLineItems(id);

    const settings: QuoteSettings = {
      laborRateCents: header.labor_rate_override ?? settingsRepo.getTyped<number>('labor_rate', 12000),
      defaultMarkupPercent: header.markup_override ?? settingsRepo.getTyped<number>('markup_default', 30),
      taxConfig: {
        taxRate: header.tax_rate_override ?? settingsRepo.getTyped<number>('tax_rate', 8.25),
        taxAppliesToParts: settingsRepo.getTyped<boolean>('tax_applies_to_parts', true),
        taxAppliesToLabor: settingsRepo.getTyped<boolean>('tax_applies_to_labor', true),
      },
      feeConfig: {
        shopFeePercent: header.shop_fee_override ?? settingsRepo.getTyped<number>('shop_fee_percent', 5),
        shopFeeCapCents: settingsRepo.getTyped<number>('shop_fee_cap', 5000),
        shopFeeFlatCents: settingsRepo.getTyped<number>('shop_fee_flat', 0),
        disposalFeeCents: settingsRepo.getTyped<number>('disposal_fee', 300),
        shippingDefaultCents: settingsRepo.getTyped<number>('shipping_default', 0),
      },
    };

    const inputs: LineItemInput[] = items.map(item => ({
      itemType: item.item_type,
      unitCostCents: item.unit_cost,
      markupPercent: item.markup_inherited ? settings.defaultMarkupPercent : item.markup_percent,
      quantity: item.quantity,
    }));

    const result = calculateQuote(inputs, settings);

    // Persist per-line computed prices
    const db = getDatabase();
    const updateItem = db.prepare(
      'UPDATE quote_line_items SET unit_price = ?, line_total = ?, markup_percent = ? WHERE id = ?'
    );
    const updateTotals = db.prepare(`
      UPDATE quotes SET
        parts_subtotal = ?, labor_subtotal = ?, shop_fee_amount = ?,
        misc_fees_total = ?, tax_total = ?, shipping_total = ?,
        grand_total = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    db.transaction(() => {
      for (let i = 0; i < items.length; i++) {
        const calc = result.lineItems[i];
        updateItem.run(calc.unitPriceCents, calc.lineTotalCents, calc.markupPercent, items[i].id);
      }
      updateTotals.run(
        result.totals.partsSubtotalCents,
        result.totals.laborSubtotalCents,
        result.totals.shopFeeCents,
        result.totals.miscSubtotalCents + result.totals.disposalFeeCents,
        result.totals.taxAmountCents,
        result.totals.shippingCents,
        result.totals.grandTotalCents,
        id,
      );
    })();

    return this.getFullQuote(id);
  }

  // ── Line Items ──

  addLineItem(quoteId: number, item: CreateLineItem): LineItem {
    const db = getDatabase();
    const sortOrder = item.sort_order ?? this.getNextSortOrder(quoteId);
    const markup = item.item_type === 'part'
      ? item.markup_percent ?? this.getQuoteById(quoteId)?.markup_override ?? settingsRepo.getTyped<number>('markup_default', 30)
      : 0;
    const unitPrice = item.unit_price ?? Math.round((item.unit_cost ?? 0) * (1 + markup / 100));
    const lineTotal = Math.round(unitPrice * (item.quantity ?? 1));

    const result = db.prepare(`
      INSERT INTO quote_line_items
        (quote_id, item_type, description, priority, vendor, vendor_part_id, part_number, brand, source_url, option_value,
         unit_cost, markup_percent, markup_inherited, unit_price, quantity, line_total, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quoteId, item.item_type, item.description, item.priority ?? null,
      item.vendor ?? null, item.vendor_part_id ?? null, item.part_number ?? null,
      item.brand ?? null, item.source_url ?? null, item.option_value ?? null,
      item.unit_cost ?? 0, markup, item.item_type === 'part' && item.markup_percent === undefined ? 1 : 0,
      unitPrice, item.quantity ?? 1, lineTotal, sortOrder,
    );
    return this.getLineItemById(result.lastInsertRowid as number)!;
  }

  getLineItemById(id: number): LineItem | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM quote_line_items WHERE id = ?').get(id) as LineItem) ?? null;
  }

  getLineItemForQuote(quoteId: number, id: number): LineItem | null {
    const db = getDatabase();
    return (db.prepare(
      'SELECT * FROM quote_line_items WHERE quote_id = ? AND id = ?',
    ).get(quoteId, id) as LineItem) ?? null;
  }

  getLineItems(quoteId: number): LineItem[] {
    const db = getDatabase();
    return db.prepare(
      'SELECT * FROM quote_line_items WHERE quote_id = ? ORDER BY sort_order, id'
    ).all(quoteId) as LineItem[];
  }

  updateLineItem(quoteId: number, id: number, updates: Partial<CreateLineItem>): boolean {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.markup_percent !== undefined) {
      fields.push('markup_inherited = ?');
      values.push(0);
    }

    if (fields.length > 0) {
      const result = db.prepare(
        `UPDATE quote_line_items SET ${fields.join(', ')} WHERE id = ? AND quote_id = ?`,
      ).run(...values, id, quoteId);
      if (result.changes === 0) return false;

      // Recalculate line_total if cost/price/qty changed
      if (updates.unit_cost !== undefined || updates.markup_percent !== undefined ||
          updates.unit_price !== undefined || updates.quantity !== undefined) {
        const item = this.getLineItemForQuote(quoteId, id);
        if (item) {
          const unitPrice = updates.unit_price ?? Math.round(
            (updates.unit_cost ?? item.unit_cost) *
            (1 + (updates.markup_percent ?? item.markup_percent) / 100)
          );
          const lineTotal = Math.round(unitPrice * (updates.quantity ?? item.quantity));
          db.prepare('UPDATE quote_line_items SET unit_price = ?, line_total = ? WHERE id = ?')
            .run(unitPrice, lineTotal, id);
        }
      }
    }
    return this.getLineItemForQuote(quoteId, id) !== null;
  }

  deleteLineItem(quoteId: number, id: number): boolean {
    const db = getDatabase();
    return db.prepare(
      'DELETE FROM quote_line_items WHERE id = ? AND quote_id = ?',
    ).run(id, quoteId).changes > 0;
  }

  updateLineItemPriority(
    quoteId: number,
    id: number,
    priority: LineItem['priority'],
  ): boolean {
    const db = getDatabase();
    return db.prepare(
      'UPDATE quote_line_items SET priority = ? WHERE id = ? AND quote_id = ?',
    ).run(priority, id, quoteId).changes > 0;
  }

  updateLineItemExplanation(quoteId: number, id: number, explanation: string): boolean {
    const db = getDatabase();
    return db.prepare(
      'UPDATE quote_line_items SET ai_explanation = ? WHERE id = ? AND quote_id = ?',
    ).run(explanation, id, quoteId).changes > 0;
  }

  private getNextSortOrder(quoteId: number): number {
    const db = getDatabase();
    const row = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM quote_line_items WHERE quote_id = ?'
    ).get(quoteId) as any;
    return row.next;
  }

  // ── Full Quote with Items ──

  getFullQuote(quoteId: number): { header: QuoteHeader; items: LineItem[] } | null {
    const header = this.getQuoteById(quoteId);
    if (!header) return null;
    return { header, items: this.getLineItems(quoteId) };
  }

  deleteQuote(id: number): boolean {
    const db = getDatabase();
    return db.transaction(() => {
      if (db.prepare('SELECT 1 FROM jobs WHERE quote_id = ?').get(id) ||
          db.prepare('SELECT 1 FROM billing_tickets WHERE quote_id = ?').get(id)) {
        throw new Error('Cannot delete a quote with a linked job or billing ticket');
      }
      return db.prepare('DELETE FROM quotes WHERE id = ?').run(id).changes > 0;
    })();
  }
}

export const quotesRepo = new QuotesRepository();
