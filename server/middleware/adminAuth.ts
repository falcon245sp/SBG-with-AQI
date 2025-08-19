import type { Request, Response, NextFunction } from 'express';
import { ActiveUserService } from '../services/activeUserService';
import { logger } from '../utils/logger';

// Admin customer UUIDs - in production, this should come from environment variables or database
const ADMIN_CUSTOMER_UUIDS = [
  process.env.ADMIN_CUSTOMER_UUID,
  // Add more admin UUIDs as needed
].filter(Boolean);

const ADMIN_EMAILS = [
  'admin@standardssherpa.com',
  // Add your email here when we identify it
].filter(Boolean);

// Development mode - allow any authenticated user admin access
const isDevelopment = process.env.NODE_ENV !== 'production';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await ActiveUserService.getActiveUser(req);
    
    if (!user) {
      logger.security('Admin access attempted without authentication', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(401).json({ 
        message: 'Authentication required for admin access' 
      });
    }

    const isAdminByUuid = user.customerUuid && ADMIN_CUSTOMER_UUIDS.includes(user.customerUuid);
    const isAdminByEmail = user.email && ADMIN_EMAILS.includes(user.email);
    const isDevelopmentAccess = isDevelopment && user.email; // Any authenticated user in development
    
    if (!isAdminByUuid && !isAdminByEmail && !isDevelopmentAccess) {
      logger.security('Non-admin user attempted admin access', {
        customerUuid: user.customerUuid,
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(403).json({ 
        message: 'Admin privileges required' 
      });
    }

    logger.info('Admin access granted', {
      customerUuid: user.customerUuid,
      userId: user.id,
      email: user.email,
      path: req.path,
      component: 'admin-auth'
    });

    next();
  } catch (error) {
    logger.error('Admin authentication check failed', {
      path: req.path,
      ip: req.ip,
      component: 'admin-auth'
    }, error instanceof Error ? error : new Error(String(error)));
    
    res.status(500).json({ 
      message: 'Admin authentication check failed' 
    });
  }
}

export function isAdmin(customerUuid?: string, email?: string): boolean {
  if (customerUuid && ADMIN_CUSTOMER_UUIDS.includes(customerUuid)) {
    return true;
  }
  
  if (email && ADMIN_EMAILS.includes(email)) {
    return true;
  }
  
  return false;
}