import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "mf-dashboard.db");

// SQLite connection with WAL mode for better concurrent read performance
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("cache_size = -64000"); // 64MB cache
sqlite.pragma("temp_store = MEMORY");

export const db = drizzle(sqlite, { schema });

export default db;
