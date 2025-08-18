import { storage } from '../storage';
import { User } from '../../shared/schema';

/**
 * Centralized database service for customer and user data resolution
 * Single source of truth for all customer UUID lookups and user data access
 * Handles PII decryption in one place and provides clean data to calling functions
 */
export class CustomerLookupService {
  /**
   * Get customer UUID from authenticated session user ID
   */
  static async getCustomerUuidFromSession(sessionUserId: string): Promise<string | null> {
    try {
      const user = await storage.getUser(sessionUserId);
      return user?.customerUuid || null;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get customer UUID from session:', error);
      return null;
    }
  }

  /**
   * Get full user data from session user ID with decryption handled
   */
  static async getUserFromSession(sessionUserId: string): Promise<User | null> {
    try {
      const user = await storage.getUser(sessionUserId);
      return user || null;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get user from session:', error);
      return null;
    }
  }

  /**
   * Get customer UUID from email address
   */
  static async getCustomerUuidFromEmail(email: string): Promise<string | null> {
    try {
      const user = await storage.getUserByEmail(email);
      return user?.customerUuid || null;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get customer UUID from email:', error);
      return null;
    }
  }

  /**
   * Get customer UUID from Google ID
   */
  static async getCustomerUuidFromGoogleId(googleId: string): Promise<string | null> {
    try {
      const user = await storage.getUserByGoogleId(googleId);
      return user?.customerUuid || null;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get customer UUID from Google ID:', error);
      return null;
    }
  }

  /**
   * Validate that a customer UUID exists in the system
   */
  static async validateCustomerUuid(customerUuid: string): Promise<boolean> {
    try {
      const user = await storage.getUserByCustomerUuid(customerUuid);
      return !!user;
    } catch (error) {
      console.error('CustomerLookupService: Failed to validate customer UUID:', error);
      return false;
    }
  }

  /**
   * Get full user details from customer UUID
   */
  static async getUserFromCustomerUuid(customerUuid: string) {
    try {
      return await storage.getUserByCustomerUuid(customerUuid);
    } catch (error) {
      console.error('CustomerLookupService: Failed to get user from customer UUID:', error);
      return null;
    }
  }

  /**
   * Helper method to get customer UUID from session with error handling
   * This is the most common use case for authenticated routes
   */
  static async requireCustomerUuid(sessionUserId: string): Promise<string> {
    console.log(`[CustomerLookupService] Looking up customer UUID for session user: ${sessionUserId}`);
    const user = await this.getUserFromSession(sessionUserId);
    if (!user?.customerUuid) {
      console.error(`[CustomerLookupService] No customer UUID found for session user: ${sessionUserId}`);
      throw new Error('Customer UUID not found for authenticated user');
    }
    console.log(`[CustomerLookupService] Found customer UUID: ${user.customerUuid} for session user: ${sessionUserId}`);
    return user.customerUuid;
  }

  /**
   * Get both user data and customer UUID from session in one call
   * Reduces database hits and ensures consistency
   */
  static async requireUserAndCustomerUuid(sessionUserId: string): Promise<{ user: User; customerUuid: string }> {
    console.log(`[CustomerLookupService] Looking up user and customer UUID for session user: ${sessionUserId}`);
    const user = await this.getUserFromSession(sessionUserId);
    if (!user?.customerUuid) {
      console.error(`[CustomerLookupService] No user or customer UUID found for session user: ${sessionUserId}`);
      throw new Error('User or customer UUID not found for authenticated user');
    }
    console.log(`[CustomerLookupService] Found user and customer UUID: ${user.customerUuid} for session user: ${sessionUserId}`);
    return { user, customerUuid: user.customerUuid };
  }

  /**
   * Validate that session user has access to specific customer UUID
   * Used for authorization checks
   */
  static async validateUserCustomerAccess(sessionUserId: string, targetCustomerUuid: string): Promise<boolean> {
    try {
      const user = await this.getUserFromSession(sessionUserId);
      return user?.customerUuid === targetCustomerUuid;
    } catch (error) {
      console.error('CustomerLookupService: Failed to validate customer access:', error);
      return false;
    }
  }

  /**
   * Get customer UUID by email address
   * Returns null if user not found
   */
  static async getCustomerUuidByEmail(email: string): Promise<string | null> {
    try {
      const user = await storage.getUserByEmail(email);
      return user?.customerUuid || null;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get customer UUID by email:', error);
      return null;
    }
  }

  /**
   * Get user data by email address with decryption handled
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await storage.getUserByEmail(email);
      return user || null;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get user by email:', error);
      return null;
    }
  }

  /**
   * Get user data by customer UUID with decryption handled
   */
  static async getUserByCustomerUuid(customerUuid: string): Promise<User | null> {
    try {
      const user = await storage.getUserByCustomerUuid(customerUuid);
      return user || null;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get user by customer UUID:', error);
      return null;
    }
  }

  /**
   * Get customer UUID by Google ID
   * Returns null if user not found
   */
  static async getCustomerUuidByGoogleId(googleId: string): Promise<string | null> {
    try {
      const user = await storage.getUserByGoogleId(googleId);
      return user?.customerUuid || null;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get customer UUID by Google ID:', error);
      return null;
    }
  }

  /**
   * Get user data by Google ID with decryption handled
   */
  static async getUserByGoogleId(googleId: string): Promise<User | null> {
    try {
      const user = await storage.getUserByGoogleId(googleId);
      return user || null;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get user by Google ID:', error);
      return null;
    }
  }

  /**
   * Search for customer UUID by name (first name or last name)
   * Returns array of matching customer UUIDs since names may not be unique
   */
  static async getCustomerUuidsByName(firstName?: string, lastName?: string): Promise<string[]> {
    try {
      const users = await storage.getUsersByName(firstName, lastName);
      return users.map(user => user.customerUuid).filter(Boolean);
    } catch (error) {
      console.error('CustomerLookupService: Failed to get customer UUIDs by name:', error);
      return [];
    }
  }

  /**
   * Search for users by name with decryption handled
   */
  static async getUsersByName(firstName?: string, lastName?: string): Promise<User[]> {
    try {
      const users = await storage.getUsersByName(firstName, lastName);
      return users;
    } catch (error) {
      console.error('CustomerLookupService: Failed to get users by name:', error);
      return [];
    }
  }
}