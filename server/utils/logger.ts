import crypto from 'crypto';

export interface LogContext {
  requestId?: string;
  customerUuid?: string;
  userId?: string;
  documentId?: string;
  questionId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  component?: string;
  operation?: string;
  fileSize?: number;
  fileName?: string;
  aiEngine?: string;
  errorCode?: string;
  stackTrace?: string;
}

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private productionMode: boolean;

  private constructor() {
    this.productionMode = process.env.NODE_ENV === 'production';
    this.logLevel = this.productionMode ? LogLevel.INFO : LogLevel.DEBUG;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLog(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const baseLog = {
      timestamp,
      level,
      message,
      environment: this.productionMode ? 'production' : 'development',
      service: 'standards-sherpa',
      version: process.env.npm_package_version || '0.7.4'
    };

    const fullLog = { ...baseLog, ...context };
    
    // In production, use structured JSON logging
    if (this.productionMode) {
      return JSON.stringify(fullLog);
    } else {
      // In development, use readable format
      const contextStr = context ? ` | ${Object.entries(context)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')}` : '';
      return `${timestamp} [${level}] ${message}${contextStr}`;
    }
  }

  public error(message: string, context?: LogContext, error?: Error): void {
    if (this.logLevel >= LogLevel.ERROR) {
      const errorContext = error ? {
        ...context,
        errorCode: error.name,
        stackTrace: error.stack,
        errorMessage: error.message
      } : context;
      
      console.error(this.formatLog('ERROR', message, errorContext));
    }
  }

  public warn(message: string, context?: LogContext): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(this.formatLog('WARN', message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.log(this.formatLog('INFO', message, context));
    }
  }

  public debug(message: string, context?: LogContext): void {
    if (this.logLevel >= LogLevel.DEBUG) {
      console.log(this.formatLog('DEBUG', message, context));
    }
  }

  // Specialized logging methods for common use cases
  public apiRequest(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    this.info('API Request', {
      method,
      path,
      statusCode,
      duration,
      ...context
    });
  }

  public userAction(action: string, context?: LogContext): void {
    this.info(`User Action: ${action}`, {
      operation: action,
      ...context
    });
  }

  public aiProcessing(engine: string, operation: string, context?: LogContext): void {
    this.info(`AI Processing: ${operation}`, {
      aiEngine: engine,
      operation,
      component: 'ai-service',
      ...context
    });
  }

  public documentProcessing(operation: string, context?: LogContext): void {
    this.info(`Document Processing: ${operation}`, {
      operation,
      component: 'document-processor',
      ...context
    });
  }

  public authentication(operation: string, success: boolean, context?: LogContext): void {
    const level = success ? 'info' : 'warn';
    const message = `Authentication ${operation}: ${success ? 'Success' : 'Failed'}`;
    
    if (level === 'warn') {
      this.warn(message, {
        operation,
        component: 'auth',
        ...context
      });
    } else {
      this.info(message, {
        operation,
        component: 'auth',
        ...context
      });
    }
  }

  public security(event: string, context?: LogContext): void {
    this.warn(`Security Event: ${event}`, {
      operation: event,
      component: 'security',
      ...context
    });
  }

  public performance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 5000 ? 'warn' : 'info'; // Warn if operation takes > 5 seconds
    const message = `Performance: ${operation} took ${duration}ms`;
    
    if (level === 'warn') {
      this.warn(message, {
        operation,
        duration,
        component: 'performance',
        ...context
      });
    } else {
      this.info(message, {
        operation,
        duration,
        component: 'performance',
        ...context
      });
    }
  }

  public businessEvent(event: string, context?: LogContext): void {
    this.info(`Business Event: ${event}`, {
      operation: event,
      component: 'business',
      ...context
    });
  }

  // Generate correlation IDs for request tracing
  public static generateRequestId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Helper to extract common context from Express request
  public static extractRequestContext(req: any): LogContext {
    return {
      requestId: req.requestId || Logger.generateRequestId(),
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      sessionId: req.sessionID,
      userId: req.user?.id,
      customerUuid: req.user?.customerUuid
    };
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Express middleware for request correlation
export function requestLoggingMiddleware(req: any, res: any, next: any) {
  req.requestId = Logger.generateRequestId();
  const startTime = Date.now();
  
  // Log the start of the request
  logger.debug('Request started', Logger.extractRequestContext(req));
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const context = {
      ...Logger.extractRequestContext(req),
      statusCode: res.statusCode,
      duration
    };
    
    if (req.path.startsWith('/api')) {
      logger.apiRequest(req.method, req.path, res.statusCode, duration, context);
    }
  });
  
  next();
}