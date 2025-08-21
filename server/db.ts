import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon with timeouts and retry settings for deployment stability
neonConfig.webSocketConstructor = ws;
neonConfig.wsProxy = (host) => `${host}/v2`;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = false;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create pool with connection timeout and retry configurations
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 20000, // 20 second timeout
  idleTimeoutMillis: 30000,       // 30 second idle timeout
  max: 5,                         // Limit concurrent connections for deployment
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle({ client: pool, schema });