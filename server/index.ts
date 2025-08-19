import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { Pool } from "@neondatabase/serverless";
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
  const server = await registerRoutes(app);
  
  // Start automatic session cleanup
  SessionCleanup.startAutomaticCleanup();

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
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info('Standards Sherpa server started', {
      port: port,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '0.7.4'
    });
  });
})();
