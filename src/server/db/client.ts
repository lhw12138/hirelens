import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  pool ??= new Pool({connectionString:process.env.DATABASE_URL,max:10});
  return pool;
}

export function getDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database operations");
  }
  return drizzle(getPool(), { schema });
}
