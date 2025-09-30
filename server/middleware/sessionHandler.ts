/**
 * Session Handler Middleware
 * Provides elegant handling of session expiration and authentication errors
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface SessionError extends Error {
  statusCode: number;
  userMessage: string;
  shouldRedirect: boolean;
}

export class SessionExpiredError extends Error implements SessionError {
  statusCode = 401;
  userMessage = 'Your session has expired. Please sign in again.';
  shouldRedirect = true;

  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export class AuthenticationError extends Error implements SessionError {
  statusCode = 403;
  userMessage = 'Access denied. Please sign in to continue.';
  shouldRedirect = true;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class SessionCorruptedError extends Error implements SessionError {
  statusCode = 401;
  userMessage = 'Your session data is corrupted. Please sign in again.';
  shouldRedirect = true;

  constructor(message = 'Session data corrupted') {
    super(message);
    this.name = 'SessionCorruptedError';
  }
}

/**
 * Middleware to gracefully handle session-related errors
 */
export const sessionErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle known session errors
  if (error instanceof SessionExpiredError || 
      error instanceof AuthenticationError || 
      error instanceof SessionCorruptedError) {
    
    logger.userAction('session-error-handled', {
      errorType: error.name,
      userMessage: error.userMessage,
      requestPath: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      sessionId: req.sessionID
    });

    return res.status(error.statusCode).json({
      error: error.name,
      message: error.userMessage,
      shouldRedirect: error.shouldRedirect,
      redirectUrl: '/auth/login'
    });
  }

  // Handle decryption errors that indicate session corruption
  if (error.message?.includes('Failed to decrypt') || 
      error.message?.includes('Malformed UTF-8 data') ||
      error.message?.includes('invalid key or corrupted data')) {
    
    const sessionError = new SessionCorruptedError('Session data is corrupted');
    
    logger.userAction('session-corruption-detected', {
      originalError: error.message,
      requestPath: req.path,
      sessionId: req.sessionID,
      userAgent: req.get('User-Agent')
    });

    return res.status(sessionError.statusCode).json({
      error: sessionError.name,
      message: sessionError.userMessage,
      shouldRedirect: sessionError.shouldRedirect,
      redirectUrl: '/auth/login'
    });
  }

  // Pass other errors to the next handler
  next(error);
};

/**
 * Wrapper for async route handlers that automatically converts session errors
 */
export const withSessionHandling = (handler: (req: any, res: Response) => Promise<any>) => {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      // Convert common session-related errors to our custom error types
      if (error instanceof Error) {
        if (error.message?.includes('Session not found') || 
            error.message?.includes('No active session')) {
          return next(new SessionExpiredError(error.message));
        }
        
        if (error.message?.includes('Access denied') || 
            error.message?.includes('Unauthorized')) {
          return next(new AuthenticationError(error.message));
        }
        
        if (error.message?.includes('Failed to decrypt') || 
            error.message?.includes('Malformed UTF-8 data')) {
          return next(new SessionCorruptedError(error.message));
        }
      }
      
      // Pass other errors to the generic error handler
      next(error);
    }
  };
};

export default sessionErrorHandler;