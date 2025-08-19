# Environment Variables Configuration

## Production-Critical Environment Variables

The following environment variables use **DEV_** and **PROD_** prefixes and are automatically selected based on `NODE_ENV`:

### Web Service Configuration

#### Development Environment
```bash
DEV_WEB_SERVICE_BASE_URL=http://localhost:3000
DEV_WEB_SERVICE_API_KEY=dps_demo_key_development_only
```

#### Production Environment
```bash
PROD_WEB_SERVICE_BASE_URL=https://your-production-web-service-url.com
PROD_WEB_SERVICE_API_KEY=your_production_api_key_here
```

### Security Configuration

#### Development Environment
```bash
DEV_SESSION_SECRET=dev-session-secret-not-for-production
```

#### Production Environment
```bash
PROD_SESSION_SECRET=your_secure_production_session_secret_here
```

### Admin Configuration

#### Development Environment
```bash
DEV_ADMIN_EMAIL=admin@standardssherpa.com
```

#### Production Environment
```bash
PROD_ADMIN_EMAIL=admin@yourproductiondomain.com
```

### Domain Configuration

#### Development Environment
```bash
DEV_PRODUCTION_DOMAIN=your-dev-repl-url.replit.dev
```

#### Production Environment
```bash
PROD_PRODUCTION_DOMAIN=your-production-app.replit.app
```

## Frontend Environment Variables (Vite)

For client-side configuration, use `VITE_` prefix:

#### Development Environment
```bash
VITE_DEV_WEB_SERVICE_BASE_URL=http://localhost:3000
VITE_DEV_WEB_SERVICE_API_KEY=dps_demo_key_development_only
VITE_DEV_ADMIN_EMAIL=admin@standardssherpa.com
```

#### Production Environment
```bash
VITE_PROD_WEB_SERVICE_BASE_URL=https://your-production-web-service-url.com
VITE_PROD_WEB_SERVICE_API_KEY=your_production_api_key_here
VITE_PROD_ADMIN_EMAIL=admin@yourproductiondomain.com
```

## Environment-Stable Variables (STABLE_)

These values remain consistent across environments but can be customized if needed:

```bash
# Session Configuration
STABLE_SESSION_TTL_MS=604800000              # 1 week in milliseconds
STABLE_OIDC_CACHE_MAX_AGE_MS=3600000         # 1 hour in milliseconds
STABLE_OAUTH_REDIRECT_DELAY_MS=2000          # 2 seconds

# Server Configuration  
STABLE_DEFAULT_PORT=5000                     # Default server port
STABLE_DATABASE_TABLE_NAME=sessions          # Session table name

# Performance Configuration
STABLE_PERFORMANCE_WARN_THRESHOLD_MS=5000    # Performance warning threshold
```

## Frontend Stable Variables (Vite)

```bash
VITE_STABLE_OAUTH_REDIRECT_DELAY_MS=2000     # OAuth redirect delay
```

## Automatic Environment Selection

The system automatically detects the environment using `process.env.NODE_ENV`:

- **Development**: `NODE_ENV !== 'production'` → Uses `DEV_` prefixed variables
- **Production**: `NODE_ENV === 'production'` → Uses `PROD_` prefixed variables
- **Stable Values**: Always uses `STABLE_` prefixed variables (or defaults)

## Fallback Values

If environment variables are not set, the system falls back to:

- **Development**: Safe development defaults
- **Production**: Either throws an error (for critical values) or uses conservative production defaults

## Required for Production

The following **MUST** be set in production or the application will fail to start:

1. `PROD_SESSION_SECRET` - Critical for session security
2. `PROD_WEB_SERVICE_API_KEY` - Required for external service integration

## Security Notes

1. **Never commit production secrets** to version control
2. **Use Replit Secrets** for production environment variables
3. **Session secrets** should be cryptographically secure random strings
4. **API keys** should be obtained from legitimate service providers

## Cookie Security

Cookie security is automatically configured:
- **Development**: `secure: false` (allows HTTP)
- **Production**: `secure: true` (requires HTTPS)