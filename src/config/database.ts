import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DEFAULT_SETTINGS } from './defaults.js';
import { DATA_DIR } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'autoquote.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    runMigrations(db);
  }
  return db;
}

/** Close the SQLite connection cleanly (WAL checkpoint). */
export function closeDatabase(): void {
  if (!db) return;
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // ignore checkpoint failures during shutdown
  }
  try {
    db.close();
  } catch {
    // ignore
  }
  db = null;
}

function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all()
      .map((r: any) => r.name)
  );

  // Read migration files
  const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(
      `Database migrations directory not found: ${migrationsDir}. Rebuild the application before starting it.`,
    );
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  if (migrationFiles.length === 0) {
    throw new Error(`No database migrations found in: ${migrationsDir}`);
  }

  for (const file of migrationFiles) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`[DB] Applying migration: ${file}`);

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();
  }

  // Seed default settings if settings table is empty
  const count = db.prepare('SELECT COUNT(*) as count FROM settings').get() as any;
  if (count.count === 0) {
    console.log('[DB] Seeding default settings...');
    const insert = db.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
    );
    db.transaction(() => {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        insert.run(key, value);
      }
    })();
  }
}

/** For CLI use: npx tsx src/config/database.ts --init */
if (process.argv.includes('--init')) {
  console.log('[DB] Initializing database...');
  getDatabase();
  console.log(`[DB] Database ready at: ${DB_PATH}`);
  process.exit(0);
}
