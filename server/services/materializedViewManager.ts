/**
 * Materialized View Manager
 * Handles automatic refresh of materialized views using database triggers and notifications
 */

import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';

class MaterializedViewManager {
  private notificationListener: any = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private readonly REFRESH_DEBOUNCE_MS = 1000; // Debounce multiple rapid changes

  start() {
    console.log('[MaterializedViewManager] No materialized views to manage - using direct queries');
    // No longer needed - using direct queries instead of materialized views
  }

  private async setupNotificationListener() {
    try {
      // Skip LISTEN setup in production to avoid websocket connection issues during deployment
      const isProduction = process.env.NODE_ENV === 'production';
      
      if (!isProduction) {
        // Listen for refresh notifications from database triggers
        await db.execute(sql`LISTEN refresh_document_relationships`);
        console.log('[MaterializedViewManager] Database notification listener setup (trigger-based)');
      } else {
        console.log('[MaterializedViewManager] Skipping LISTEN setup in production environment');
      }
    } catch (error) {
      console.warn('[MaterializedViewManager] Could not setup notification listener, using fallback:', error);
    }
  }

  stop() {
    if (this.notificationListener) {
      this.notificationListener = null;
    }
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    console.log('[MaterializedViewManager] Stopped trigger-based refresh system');
  }

  async refreshViews(): Promise<void> {
    try {
      const startTime = Date.now();
      await storage.refreshDocumentRelationships();
      const duration = Date.now() - startTime;
      console.log(`[MaterializedViewManager] Document relationships refreshed in ${duration}ms`);
    } catch (error) {
      console.error('[MaterializedViewManager] Failed to refresh document relationships:', error);
      throw error;
    }
  }

  // Debounced refresh to handle multiple rapid changes
  private debouncedRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    this.refreshTimeout = setTimeout(() => {
      this.refreshViews().catch(error => {
        console.error('[MaterializedViewManager] Debounced refresh failed:', error);
      });
    }, this.REFRESH_DEBOUNCE_MS);
  }

  // Manual refresh trigger (now just triggers debounced refresh)
  async refreshOnDemand(): Promise<void> {
    console.log('[MaterializedViewManager] Triggering debounced refresh');
    this.debouncedRefresh();
  }
}

export const materializedViewManager = new MaterializedViewManager();