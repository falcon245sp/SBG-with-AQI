import { Pool as PgPool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use standard PostgreSQL driver for complete websocket-free deployment
export const pool = new PgPool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 8000,   // Short timeout to fail fast
  idleTimeoutMillis: 12000,        // Short idle timeout  
  max: 2,                          // Minimal connections for deployment
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });