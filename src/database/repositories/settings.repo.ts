import { getDatabase } from '../../config/database.js';

export interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export class SettingsRepository {
  /** Get a single setting value (raw JSON string) */
  get(key: string): string | null {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    return row?.value ?? null;
  }

  /** Get a setting parsed as its expected type */
  getTyped<T>(key: string, fallback: T): T {
    const raw = this.get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  /** Get all settings as a flat record */
  getAll(): Record<string, string> {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all() as SettingRow[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  /** Get all settings parsed as their JSON values */
  getAllParsed(): Record<string, unknown> {
    const raw = this.getAll();
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
    return result;
  }

  /** Set a single setting */
  set(key: string, value: string): void {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, value);
  }

  /** Set a setting with typed value (auto JSON.stringify) */
  setTyped<T>(key: string, value: T): void {
    this.set(key, JSON.stringify(value));
  }

  /** Bulk update settings */
  bulkSet(entries: Record<string, string>): void {
    const db = getDatabase();
    const stmt = db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    db.transaction(() => {
      for (const [key, value] of Object.entries(entries)) {
        stmt.run(key, value);
      }
    })();
  }

  /** Delete a setting */
  delete(key: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }
}

// Singleton
export const settingsRepo = new SettingsRepository();