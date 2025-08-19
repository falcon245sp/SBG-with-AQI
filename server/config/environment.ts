/**
 * Environment Configuration Manager
 * Automatically selects DEV_ or PROD_ prefixed environment variables based on NODE_ENV
 */

export interface EnvironmentConfig {
  // Web Service Configuration
  webServiceBaseUrl: string;
  webServiceApiKey: string;
  
  // Security Configuration
  sessionSecret: string;
  cookieSecure: boolean;
  
  // Admin Configuration
  adminEmail: string;
  
  // Production Domain (used by Replit Auth)
  productionDomain: string;
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

  public getConfig(): EnvironmentConfig {
    return {
      // Web Service Configuration
      webServiceBaseUrl: this.getEnvVar('WEB_SERVICE_BASE_URL', 
        this.isProduction() 
          ? 'https://your-production-web-service-url.com'
          : 'http://localhost:3000'
      ),
      webServiceApiKey: this.getEnvVar('WEB_SERVICE_API_KEY', 
        'dps_demo_key_development_only'
      ),
      
      // Security Configuration
      sessionSecret: this.getEnvVar('SESSION_SECRET', 
        this.isProduction() 
          ? undefined // Force production to set this
          : 'dev-session-secret-not-for-production'
      ),
      cookieSecure: this.isProduction(),
      
      // Admin Configuration
      adminEmail: this.getEnvVar('ADMIN_EMAIL', 'admin@standardssherpa.com'),
      
      // Production Domain
      productionDomain: this.getEnvVar('PRODUCTION_DOMAIN', 
        'docu-proc-serv-jfielder1.replit.app'
      ),
    };
  }
}

export const environmentManager = new EnvironmentManager();
export const config = environmentManager.getConfig();