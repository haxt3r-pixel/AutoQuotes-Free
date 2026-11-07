import { getDatabase } from '../../config/database.js';

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
  created_at: string;
  updated_at: string;
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
  submodel: string | null;
  engine: string | null;
  drivetrain: string | null;
  transmission: string | null;
  mileage: number | null;
  license_plate: string | null;
  color: string | null;
}

export class CustomersRepository {
  createCustomer(data: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    address_street?: string | null;
    address_city?: string | null;
    address_state?: string | null;
    address_zip?: string | null;
    notes?: string | null;
  }): Customer {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO customers (
        name, email, phone, address, address_street, address_city, address_state, address_zip, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name, data.email ?? null, data.phone ?? null, data.address ?? null,
      data.address_street ?? data.address ?? null, data.address_city ?? null,
      data.address_state ?? null, data.address_zip ?? null, data.notes ?? null,
    );
    return this.getCustomerById(result.lastInsertRowid as number)!;
  }

  getCustomerById(id: number): Customer | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer) ?? null;
  }

  searchCustomers(query: string, limit = 20): Customer[] {
    const db = getDatabase();
    const like = `%${query}%`;
    return db.prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id) AS vehicle_count,
        (SELECT COUNT(*) FROM quotes q WHERE q.customer_id = c.id) AS quote_count
       FROM customers c
       WHERE c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.address LIKE ?
         OR c.address_street LIKE ? OR c.address_city LIKE ? OR c.address_state LIKE ?
         OR c.address_zip LIKE ? OR c.notes LIKE ?
       ORDER BY c.name ASC LIMIT ?`
    ).all(like, like, like, like, like, like, like, like, like, limit) as Customer[];
  }

  listCustomers(limit = 100, offset = 0): Customer[] {
    const db = getDatabase();
    return db.prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM vehicles v WHERE v.customer_id = c.id) AS vehicle_count,
        (SELECT COUNT(*) FROM quotes q WHERE q.customer_id = c.id) AS quote_count
       FROM customers c ORDER BY c.name ASC LIMIT ? OFFSET ?`
    ).all(limit, offset) as Customer[];
  }

  updateCustomer(id: number, data: Partial<Omit<Customer, 'id' | 'created_at' | 'updated_at'>>): void {
    const db = getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length > 0) {
      values.push(id);
      db.prepare(`UPDATE customers SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
        .run(...values);
    }
  }

  // ── Vehicles ──

  createVehicle(data: {
    customer_id?: number;
    vin?: string | null;
    year?: number | null;
    make?: string | null;
    model?: string | null;
    submodel?: string | null;
    engine?: string | null;
    drivetrain?: string | null;
    transmission?: string | null;
    mileage?: number | null;
    license_plate?: string | null;
    color?: string | null;
  }): Vehicle {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO vehicles (customer_id, vin, year, make, model, submodel, engine, drivetrain, transmission, mileage, license_plate, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.customer_id ?? null, data.vin ?? null, data.year ?? null, data.make ?? null,
      data.model ?? null, data.submodel ?? null, data.engine ?? null, data.drivetrain ?? null, data.transmission ?? null,
      data.mileage ?? null, data.license_plate ?? null, data.color ?? null,
    );
    return this.getVehicleById(result.lastInsertRowid as number)!;
  }

  getVehicleById(id: number): Vehicle | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Vehicle) ?? null;
  }

  getVehiclesByCustomer(customerId: number): Vehicle[] {
    const db = getDatabase();
    return db.prepare(
      'SELECT * FROM vehicles WHERE customer_id = ? ORDER BY year DESC'
    ).all(customerId) as Vehicle[];
  }
}

export const customersRepo = new CustomersRepository();
