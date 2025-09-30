import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Session cleanup utility for removing expired sessions from the database
 * This helps maintain database performance and storage efficiency
 */
export class SessionCleanup {
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  private static readonly LOG_CLEANUP = true;

  /**
   * Start automatic session cleanup
   * Runs every hour to remove expired sessions
   */
  static startAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      console.log('[SessionCleanup] Automatic cleanup already running');
      return;
    }

    console.log('[SessionCleanup] Starting automatic session cleanup (every 1 hour)');
    
    // Run initial cleanup
    this.runCleanup();
    
    // Schedule recurring cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop automatic session cleanup
   */
  static stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[SessionCleanup] Automatic session cleanup stopped');
    }
  }

  /**
   * Run session cleanup manually
   * Removes all sessions where expire < NOW()
   */
  static async runCleanup(): Promise<{ deletedCount: number }> {
    try {
      const startTime = Date.now();
      
      // Delete expired sessions
      const result = await db.execute(
        sql`DELETE FROM sessions WHERE expire < NOW()`
      );
      
      const deletedCount = result.rowCount || 0;
      const duration = Date.now() - startTime;
      
      if (this.LOG_CLEANUP && deletedCount > 0) {
        console.log(`[SessionCleanup] Removed ${deletedCount} expired sessions in ${duration}ms`);
      } else if (this.LOG_CLEANUP && deletedCount === 0) {
        console.log(`[SessionCleanup] No expired sessions to clean (${duration}ms)`);
      }
      
      return { deletedCount };
    } catch (error) {
      console.error('[SessionCleanup] Error during session cleanup:', error);
      return { deletedCount: 0 };
    }
  }

  /**
   * Get session statistics
   */
  static async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    try {
      const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM sessions`);
      const activeResult = await db.execute(sql`SELECT COUNT(*) as count FROM sessions WHERE expire > NOW()`);
      const expiredResult = await db.execute(sql`SELECT COUNT(*) as count FROM sessions WHERE expire <= NOW()`);
      
      return {
        totalSessions: Number(totalResult.rows[0]?.count) || 0,
        activeSessions: Number(activeResult.rows[0]?.count) || 0,
        expiredSessions: Number(expiredResult.rows[0]?.count) || 0,
      };
    } catch (error) {
      console.error('[SessionCleanup] Error getting session stats:', error);
      return { totalSessions: 0, activeSessions: 0, expiredSessions: 0 };
    }
  }
}