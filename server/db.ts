import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure Neon based on environment - use HTTP for production deployment stability
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  // Development: Use websockets for better performance
  neonConfig.webSocketConstructor = ws;
  neonConfig.wsProxy = (host) => `${host}/v2`;
  neonConfig.useSecureWebSocket = true;
  neonConfig.pipelineConnect = false;
} else {
  // Production: Use HTTP for deployment reliability  
  neonConfig.webSocketConstructor = undefined;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = "password";
}

// Create pool with connection timeout and retry configurations
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: isProduction ? 10000 : 20000, // Shorter timeout for production
  idleTimeoutMillis: isProduction ? 15000 : 30000,       
  max: isProduction ? 3 : 5,                            // Fewer connections for production
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle({ client: pool, schema });