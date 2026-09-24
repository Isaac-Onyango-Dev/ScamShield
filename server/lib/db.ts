import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../../shared/schema";

export type DB = BetterSQLite3Database<typeof schema>;

export function openDatabase(file: string): { db: DB; sqlite: Database.Database } {
    const sqlite = new Database(file);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("foreign_keys = ON");
    return { db: drizzle(sqlite, { schema }), sqlite };
}

export function runMigrations(db: DB, migrationsFolder: string) {
    migrate(db, { migrationsFolder });
}
