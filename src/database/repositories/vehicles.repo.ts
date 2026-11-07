import { getDatabase } from '../../config/database.js';

export interface VehicleRow {
  id: number;
  customer_id: number | null;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  submodel: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  mileage: number | null;
  license_plate: string | null;
  color: string | null;
  created_at: string;
}

export interface CreateVehicleInput {
  customer_id?: number | null;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  submodel?: string | null;
  engine?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
  mileage?: number | null;
  license_plate?: string | null;
  color?: string | null;
}

export class VehiclesRepository {
  listVehicles(options?: { customer_id?: number; limit?: number }): VehicleRow[] {
    const db = getDatabase();
    const limit = options?.limit ?? 100;
    if (options?.customer_id) {
      return db
        .prepare('SELECT * FROM vehicles WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?')
        .all(options.customer_id, limit) as VehicleRow[];
    }
    return db
      .prepare('SELECT * FROM vehicles ORDER BY created_at DESC LIMIT ?')
      .all(limit) as VehicleRow[];
  }

  getVehicleById(id: number): VehicleRow | null {
    const db = getDatabase();
    return (db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as VehicleRow) || null;
  }

  createVehicle(input: CreateVehicleInput): VehicleRow {
    const db = getDatabase();
    const result = db
      .prepare(
        `INSERT INTO vehicles (customer_id, vin, year, make, model, submodel, engine, transmission, drivetrain, mileage, license_plate, color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.customer_id ?? null,
        input.vin ?? null,
        input.year ?? null,
        input.make ?? null,
        input.model ?? null,
        input.submodel ?? null,
        input.engine ?? null,
        input.transmission ?? null,
        input.drivetrain ?? null,
        input.mileage ?? null,
        input.license_plate ?? null,
        input.color ?? null,
      );
    return this.getVehicleById(Number(result.lastInsertRowid))!;
  }

  updateVehicle(id: number, input: Partial<CreateVehicleInput>): VehicleRow | null {
    const db = getDatabase();
    const existing = this.getVehicleById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    const map: Record<string, string> = {
      customer_id: 'customer_id', vin: 'vin', year: 'year', make: 'make',
      model: 'model', submodel: 'submodel', engine: 'engine',
      transmission: 'transmission', drivetrain: 'drivetrain',
      mileage: 'mileage', license_plate: 'license_plate', color: 'color',
    };

    for (const [key, col] of Object.entries(map)) {
      if (key in input) {
        fields.push(`${col} = ?`);
        values.push((input as any)[key] ?? null);
      }
    }

    if (fields.length === 0) return existing;
    values.push(id);
    db.prepare(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getVehicleById(id);
  }

  deleteVehicle(id: number): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /** Get a display string for the vehicle (e.g., "2018 Honda Accord LX 2.4L FWD") */
  getVehicleSummary(vehicle: VehicleRow): string {
    const parts: string[] = [];
    if (vehicle.year) parts.push(String(vehicle.year));
    if (vehicle.make) parts.push(vehicle.make);
    if (vehicle.model) parts.push(vehicle.model);
    if (vehicle.submodel) parts.push(vehicle.submodel);
    if (vehicle.engine) parts.push(vehicle.engine);
    if (vehicle.drivetrain) parts.push(vehicle.drivetrain.toUpperCase());
    return parts.join(' ') || `Vehicle #${vehicle.id}`;
  }

  /** Build a search query string from vehicle for parts searches */
  buildSearchString(vehicle: VehicleRow): string {
    const parts: string[] = [];
    if (vehicle.year) parts.push(String(vehicle.year));
    if (vehicle.make) parts.push(vehicle.make);
    if (vehicle.model) parts.push(vehicle.model);
    if (vehicle.submodel) parts.push(vehicle.submodel);
    if (vehicle.engine) parts.push(vehicle.engine);
    return parts.join(' ');
  }
}

export const vehiclesRepo = new VehiclesRepository();
