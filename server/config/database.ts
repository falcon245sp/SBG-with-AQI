import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { Connector } from '@google-cloud/cloud-sql-connector';

const connector = new Connector();

export async function createDatabaseConnection() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && process.env.GOOGLE_CLOUD_PROJECT) {
    console.log('[Database] Using Cloud SQL connector for production');
    const instanceConnectionName = `${process.env.GOOGLE_CLOUD_PROJECT}:${process.env.GOOGLE_SQL_REGION || 'us-central1'}:${process.env.GOOGLE_SQL_INSTANCE || 'aqi-development'}`;
    console.log('[Database] Instance connection name:', instanceConnectionName);
    
    const socketPath = `/cloudsql/${instanceConnectionName}`;
    console.log('[Database] Using Unix socket path:', socketPath);
    
    const sql = postgres({
      host: socketPath,
      database: process.env.GOOGLE_SQL_DATABASE,
      username: process.env.GOOGLE_SQL_USERNAME,
      password: process.env.GOOGLE_SQL_PASSWORD,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    return drizzle(sql);
  } else {
    console.log('[Database] Using direct connection for development');
    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.GOOGLE_SQL_USERNAME}:${process.env.GOOGLE_SQL_PASSWORD}@${process.env.GOOGLE_SQL_HOST}:5432/${process.env.GOOGLE_SQL_DATABASE}?sslmode=require`;
    
    if (!connectionString) {
      throw new Error('Database connection string not configured');
    }

    const sql = postgres(connectionString, {
      ssl: process.env.NODE_ENV === 'production' ? 'require' : 'prefer',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    return drizzle(sql);
  }
}

export async function closeDatabaseConnection() {
  await connector.close();
}
