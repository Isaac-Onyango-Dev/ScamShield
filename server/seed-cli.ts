// Standalone seeding entry point: `npm run db:seed`
import { config } from "./config";
import { openDatabase, runMigrations } from "./lib/db";
import { seed } from "./seed";

const { db, sqlite } = openDatabase(config.DATABASE_URL);
runMigrations(db, new URL("../migrations", import.meta.url).pathname);
console.log(`Seeded ${seed(db)} new indicator(s)`);
sqlite.close();
