/**
 * Materialized View Manager
 * Handles automatic refresh of materialized views for optimal performance
 */

import { storage } from '../storage';

class MaterializedViewManager {
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  start() {
    console.log('[MaterializedViewManager] Starting periodic refresh');
    
    // Initial refresh
    this.refreshViews().catch(error => {
      console.error('[MaterializedViewManager] Initial refresh failed:', error);
    });

    // Set up periodic refresh
    this.refreshInterval = setInterval(() => {
      this.refreshViews().catch(error => {
        console.error('[MaterializedViewManager] Periodic refresh failed:', error);
      });
    }, this.REFRESH_INTERVAL_MS);
  }

  stop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('[MaterializedViewManager] Stopped periodic refresh');
    }
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

  // Manual refresh trigger for when documents are modified
  async refreshOnDemand(): Promise<void> {
    console.log('[MaterializedViewManager] Performing on-demand refresh');
    await this.refreshViews();
  }
}

export const materializedViewManager = new MaterializedViewManager();