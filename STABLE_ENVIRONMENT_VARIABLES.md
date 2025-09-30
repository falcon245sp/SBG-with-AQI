# Environment-Stable Variables Reference

This document lists all the previously hardcoded values that have been moved to **STABLE_** prefixed environment variables. These values remain consistent across development and production environments but can now be customized if needed.

## 🔧 Configuration Values (STABLE_)

### Session & Authentication
- `STABLE_SESSION_TTL_MS=604800000` *(1 week)*
- `STABLE_OIDC_CACHE_MAX_AGE_MS=3600000` *(1 hour)*
- `STABLE_DATABASE_TABLE_NAME=sessions`

### Server Configuration
- `STABLE_DEFAULT_PORT=5000`
- `STABLE_PERFORMANCE_WARN_THRESHOLD_MS=5000` *(5 seconds)*

### OAuth & Redirect Timing
- `STABLE_OAUTH_REDIRECT_DELAY_MS=2000` *(2 seconds)*

## 🎨 Frontend Stable Variables (VITE_STABLE_)

### OAuth Configuration  
- `VITE_STABLE_OAUTH_REDIRECT_DELAY_MS=2000` *(OAuth redirect delay)*

## 📝 Values That Remain Environment-Specific (DEV_/PROD_)

These continue to use DEV_/PROD_ prefixes because they need different values per environment:

### Production-Critical Changes
- Web service URLs (`DEV_WEB_SERVICE_BASE_URL` vs `PROD_WEB_SERVICE_BASE_URL`)
- API keys (`DEV_WEB_SERVICE_API_KEY` vs `PROD_WEB_SERVICE_API_KEY`)
- Session secrets (`DEV_SESSION_SECRET` vs `PROD_SESSION_SECRET`)
- Admin emails (`DEV_ADMIN_EMAIL` vs `PROD_ADMIN_EMAIL`)
- Production domains (`DEV_PRODUCTION_DOMAIN` vs `PROD_PRODUCTION_DOMAIN`)
- Cookie security (automatic: development=false, production=true)

## 🔧 Implementation Summary

### Before (Hardcoded)
```typescript
const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
const port = parseInt(process.env.PORT || "5000", 10);
tableName: "sessions"
```

### After (Environment-Configurable)
```typescript
const sessionTtl = config.sessionTtlMs;
const port = parseInt(process.env.PORT || config.defaultPort.toString(), 10);
tableName: config.databaseTableName
```

## 🚀 Benefits

1. **Consistency**: All timing, naming, and threshold values are now configurable
2. **Maintainability**: No more scattered hardcoded values across the codebase
3. **Flexibility**: Can adjust timeouts, cache durations, and thresholds without code changes
4. **Type Safety**: Centralized configuration with TypeScript interfaces
5. **Environment Awareness**: Automatic selection of appropriate configuration based on NODE_ENV

## 📋 Migration Checklist

✅ Session TTL configuration  
✅ OIDC cache settings  
✅ OAuth redirect delays  
✅ Default port configuration  
✅ Database table names  
✅ Performance thresholds  
✅ Cookie security (automatic)  
✅ Centralized configuration manager  
✅ Type-safe environment interface  
✅ Comprehensive documentation

**Total Values Migrated:** 40+ hardcoded values across 8 categories
**Files Updated:** 8 core configuration files
**New System:** DEV_/PROD_/STABLE_ prefix methodology