/**
 * Environment Configuration Manager
 * - DEV_/PROD_ prefixed variables: Environment-specific settings
 * - STABLE_ prefixed variables: Environment-stable constants
 */

export interface EnvironmentConfig {
  // Environment-Specific Configuration (DEV_/PROD_)
  webServiceBaseUrl: string;
  webServiceApiKey: string;
  sessionSecret: string;
  cookieSecure: boolean;
  adminEmail: string;
  productionDomain: string;
  
  // Environment-Stable Configuration (STABLE_)
  sessionTtlMs: number;
  oidcCacheMaxAgeMs: number;
  oauthRedirectDelayMs: number;
  defaultPort: number;
  databaseTableName: string;
  performanceWarnThresholdMs: number;
  
  // File Path Configuration (STABLE_)
  uploadsDir: string;
  generatedDir: string;
  rubricsDir: string;
  coversheetsDir: string;
  gradedDir: string;
}

class EnvironmentManager {
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private getEnvVar(key: string, fallback?: string): string {
    const prefix = this.isProduction() ? 'PROD_' : 'DEV_';
    const envKey = `${prefix}${key}`;
    const value = process.env[envKey];
    
    if (!value && !fallback) {
      throw new Error(`Required environment variable ${envKey} is not set`);
    }
    
    return value || fallback!;
  }

  private getStableEnvVar(key: string, fallback: string | number): string | number {
    const envKey = `STABLE_${key}`;
    const value = process.env[envKey];
    
    if (!value) {
      return fallback;
    }
    
    // Convert to number if fallback is a number
    if (typeof fallback === 'number') {
      const numValue = parseInt(value, 10);
      return isNaN(numValue) ? fallback : numValue;
    }
    
    return value;
  }

  public getConfig(): EnvironmentConfig {
    return {
      // Environment-Specific Configuration (DEV_/PROD_)
      webServiceBaseUrl: this.getEnvVar('WEB_SERVICE_BASE_URL', 
        this.isProduction() 
          ? 'https://your-production-web-service-url.com'
          : 'http://localhost:3000'
      ),
      webServiceApiKey: this.getEnvVar('WEB_SERVICE_API_KEY', 
        'dps_demo_key_development_only'
      ),
      sessionSecret: this.getEnvVar('SESSION_SECRET', 
        this.isProduction() 
          ? 'dev-session-secret-not-for-production' // Use same default as dev, should be overridden in production
          : 'dev-session-secret-not-for-production'
      ),
      cookieSecure: this.isProduction(),
      adminEmail: this.getEnvVar('ADMIN_EMAIL', 'admin@standardssherpa.com'),
      productionDomain: this.getEnvVar('PRODUCTION_DOMAIN', 
        'docu-proc-serv-jfielder1.replit.app'
      ),
      
      // Environment-Stable Configuration (STABLE_)
      sessionTtlMs: this.getStableEnvVar('SESSION_TTL_MS', 7 * 24 * 60 * 60 * 1000) as number, // 1 week
      oidcCacheMaxAgeMs: this.getStableEnvVar('OIDC_CACHE_MAX_AGE_MS', 3600 * 1000) as number, // 1 hour
      oauthRedirectDelayMs: this.getStableEnvVar('OAUTH_REDIRECT_DELAY_MS', 2000) as number, // 2 seconds
      defaultPort: this.getStableEnvVar('DEFAULT_PORT', 5000) as number,
      databaseTableName: this.getStableEnvVar('DATABASE_TABLE_NAME', 'sessions') as string,
      performanceWarnThresholdMs: this.getStableEnvVar('PERFORMANCE_WARN_THRESHOLD_MS', 5000) as number, // 5 seconds
      
      // File Path Configuration (STABLE_)
      uploadsDir: this.getStableEnvVar('UPLOADS_DIR', 
        this.isProduction() ? '/tmp/uploads' : 'appdata/uploads') as string,
      generatedDir: this.getStableEnvVar('GENERATED_DIR', 
        this.isProduction() ? '/tmp/generated' : 'appdata/generated') as string,
      rubricsDir: this.getStableEnvVar('RUBRICS_DIR', 
        this.isProduction() ? '/tmp/generated/rubrics' : 'appdata/generated/rubrics') as string,
      coversheetsDir: this.getStableEnvVar('COVERSHEETS_DIR', 
        this.isProduction() ? '/tmp/generated/coversheets' : 'appdata/generated/coversheets') as string,
      gradedDir: this.getStableEnvVar('GRADED_DIR', 
        this.isProduction() ? '/tmp/generated/graded' : 'appdata/generated/graded') as string,
    };
  }
}

export const environmentManager = new EnvironmentManager();
export const config = environmentManager.getConfig();

// Export individual file path constants for easy access
export const STABLE_UPLOADS_DIR = config.uploadsDir;
export const STABLE_GENERATED_DIR = config.generatedDir;
export const STABLE_RUBRICS_DIR = config.rubricsDir;
export const STABLE_COVERSHEETS_DIR = config.coversheetsDir;
export const STABLE_GRADED_DIR = config.gradedDir;
