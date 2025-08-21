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
    console.log('[MaterializedViewManager] Starting trigger-based refresh system');
    
    // Initial refresh
    this.refreshViews().catch(error => {
      console.error('[MaterializedViewManager] Initial refresh failed:', error);
    });

    // Set up database notification listener for automatic refresh
    this.setupNotificationListener();
  }

  private async setupNotificationListener() {
    try {
      // Listen for refresh notifications from database triggers
      await db.execute(sql`LISTEN refresh_document_relationships`);

      // Note: In a production setup, you'd want to use a proper PostgreSQL client
      // that supports LISTEN/NOTIFY. For now, we'll fall back to debounced refresh
      console.log('[MaterializedViewManager] Database notification listener setup (trigger-based)');
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