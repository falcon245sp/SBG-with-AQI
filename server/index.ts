import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { Pool } from "pg";
import connectPg from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { SessionCleanup } from "./utils/sessionCleanup";
import { logger, requestLoggingMiddleware } from "./utils/logger";
import { config } from './config/environment';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup session management from environment configuration
const sessionTtl = config.sessionTtlMs;
const pgStore = connectPg(session);
const sessionStore = new pgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: true,
  ttl: sessionTtl,
  tableName: config.databaseTableName,
});

app.set("trust proxy", 1);
app.use(session({
  secret: config.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.cookieSecure, // HTTPS only in production
    maxAge: sessionTtl,
    sameSite: 'lax', // Allow cross-site requests for OAuth
    path: '/', // Ensure cookie works for all paths
  },
  name: 'sherpa.sid',
}));

// Use the new comprehensive logging middleware
app.use(requestLoggingMiddleware);

(async () => {
  console.log('[Startup] Starting SBG with AQI server initialization...');
  console.log('[Startup] Environment:', process.env.NODE_ENV);
  console.log('[Startup] Port:', process.env.PORT || config.defaultPort);
  console.log('[Startup] Database URL configured:', !!process.env.DATABASE_URL);
  
  try {
    console.log('[Startup] Testing database connection...');
    console.log('[Startup] DATABASE_URL configured:', !!process.env.DATABASE_URL);
    console.log('[Startup] GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT);
    console.log('[Startup] GOOGLE_SQL_INSTANCE:', process.env.GOOGLE_SQL_INSTANCE);
    
    const testPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await testPool.query('SELECT 1');
    await testPool.end();
    console.log('[Startup] Database connection test successful');
    
    console.log('[Startup] Registering routes...');
    const server = await registerRoutes(app);
    console.log('[Startup] Routes registered successfully');
    
    console.log('[Startup] Starting session cleanup...');
    SessionCleanup.startAutomaticCleanup();
    console.log('[Startup] Session cleanup started');
    
    console.log('[Startup] Starting materialized view manager...');
    const { materializedViewManager } = await import('./services/materializedViewManager');
    materializedViewManager.start();
    console.log('[Startup] Materialized view manager started');

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error with full context for production debugging
    logger.error('Unhandled application error', {
      requestId: (req as any).requestId,
      customerUuid: (req as any).user?.customerUuid,
      userId: (req as any).user?.id,
      method: req.method,
      path: req.path,
      statusCode: status,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }, err);

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || config.defaultPort.toString(), 10);
    console.log('[Startup] Starting server on port', port);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log(`[Startup] ✅ SBG with AQI server successfully started on port ${port}`);
      console.log(`[Startup] Server is ready to accept connections`);
    });
  } catch (error) {
    console.error('[Startup] ❌ Server startup failed:', error);
    if (error instanceof Error) {
      console.error('[Startup] Error details:', error.message);
      console.error('[Startup] Stack trace:', error.stack);
    }
    process.exit(1);
  }
})();
