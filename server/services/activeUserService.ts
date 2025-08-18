import type { Request } from "express";
import { CustomerLookupService } from "./customerLookupService";
import type { User } from "@shared/schema";
import { logger, Logger } from "../utils/logger";

/**
 * ActiveUserService - Centralized service for accessing currently authenticated user data
 * 
 * Provides clean, consistent access to the active user's information from session data.
 * All authentication and user lookup logic is centralized here.
 */
export class ActiveUserService {
  
  /**
   * Get the session user ID from request
   */
  static getSessionUserId(req: Request): string | null {
    return (req as any).session?.userId || null;
  }

  /**
   * Require session user ID - throws if not authenticated
   */
  static requireSessionUserId(req: Request): string {
    const userId = this.getSessionUserId(req);
    if (!userId) {
      throw new Error('Authentication required');
    }
    return userId;
  }

  /**
   * Get active user's customer UUID
   */
  static async getActiveCustomerUuid(req: Request): Promise<string | null> {
    const userId = this.getSessionUserId(req);
    if (!userId) return null;
    
    try {
      return await CustomerLookupService.getCustomerUuidFromSession(userId);
    } catch (error) {
      logger.error('Failed to get customer UUID', {
        userId,
        component: 'active-user-service',
        operation: 'getActiveCustomerUuid'
      }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Require active user's customer UUID - throws if not found
   */
  static async requireActiveCustomerUuid(req: Request): Promise<string> {
    const userId = this.requireSessionUserId(req);
    return await CustomerLookupService.requireCustomerUuid(userId);
  }

  /**
   * Get active user data
   */
  static async getActiveUser(req: Request): Promise<User | null> {
    const userId = this.getSessionUserId(req);
    if (!userId) return null;
    
    try {
      return await CustomerLookupService.getUserFromSession(userId);
    } catch (error) {
      logger.error('Failed to get active user', {
        userId,
        component: 'active-user-service',
        operation: 'getActiveUser'
      }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Require active user data - throws if not found
   */
  static async requireActiveUser(req: Request): Promise<User> {
    const userId = this.requireSessionUserId(req);
    const user = await CustomerLookupService.getUserFromSession(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Get both active user and customer UUID
   */
  static async getActiveUserAndCustomerUuid(req: Request): Promise<{ user: User; customerUuid: string } | null> {
    const userId = this.getSessionUserId(req);
    if (!userId) return null;
    
    try {
      return await CustomerLookupService.requireUserAndCustomerUuid(userId);
    } catch (error) {
      console.error('[ActiveUserService] Error getting user and customer UUID:', error);
      return null;
    }
  }

  /**
   * Require both active user and customer UUID - throws if not found
   */
  static async requireActiveUserAndCustomerUuid(req: Request): Promise<{ user: User; customerUuid: string }> {
    const userId = this.requireSessionUserId(req);
    return await CustomerLookupService.requireUserAndCustomerUuid(userId);
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(req: Request): boolean {
    return !!this.getSessionUserId(req);
  }

  /**
   * Validate that the active user has access to a specific customer UUID
   */
  static async validateActiveUserAccess(req: Request, targetCustomerUuid: string): Promise<boolean> {
    const userId = this.getSessionUserId(req);
    if (!userId) return false;
    
    try {
      return await CustomerLookupService.validateUserCustomerAccess(userId, targetCustomerUuid);
    } catch (error) {
      console.error('[ActiveUserService] Error validating user access:', error);
      return false;
    }
  }
}