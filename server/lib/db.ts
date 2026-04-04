import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../shared/schema";
import path from "path";

const dbPath = process.env.DATABASE_URL || "sqlite.db";

// Create or connect to database
const sqlite = new Database(dbPath);

// Enable foreign keys
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Initialize database tables
export function initializeDatabase() {
    console.log(`📊 Database initialized at: ${path.resolve(dbPath)}`);
}

export { sqlite };
