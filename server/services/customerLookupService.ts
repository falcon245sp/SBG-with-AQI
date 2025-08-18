import { storage } from '../storage';

/**
 * Centralized service for customer UUID resolution
 * Prevents scattered database lookups across the application
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
    const customerUuid = await this.getCustomerUuidFromSession(sessionUserId);
    if (!customerUuid) {
      console.error(`[CustomerLookupService] No customer UUID found for session user: ${sessionUserId}`);
      throw new Error('Customer UUID not found for authenticated user');
    }
    console.log(`[CustomerLookupService] Found customer UUID: ${customerUuid} for session user: ${sessionUserId}`);
    return customerUuid;
  }
}