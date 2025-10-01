# Local Development Setup Guide

This guide documents how to run the SBG-with-AQI application locally with Google Cloud SQL connectivity.

## Prerequisites

1. **Service Account Credentials**: Google Cloud service account JSON key with "Cloud SQL Client" role
2. **Database Access**: Connection details for the Cloud SQL instance
3. **Environment Variables**: All required variables configured in `.env`

## Setup Steps

### 1. Install Cloud SQL Proxy

Download and install the Cloud SQL Proxy (v1 or v2):

```bash
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
chmod +x cloud_sql_proxy
```

### 2. Start Cloud SQL Proxy

Set the service account credentials and start the proxy:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
./cloud_sql_proxy -instances=future-sunrise-473100-q7:us-central1:aqi-development=tcp:5433 &
```

The proxy will listen on `localhost:5433` and forward connections to the Cloud SQL instance.

### 3. Configure Environment Variables

Update `.env` with the correct database connection:

```bash
# Database Configuration (via Cloud SQL Proxy)
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5433/aqi-development?sslmode=disable
```

**Important**: 
- Use `localhost:5433` (proxy port), not the direct Cloud SQL IP
- Database name must be `aqi-development` (not `postgres`)
- Add `?sslmode=disable` since the proxy handles SSL encryption
- Do NOT use URL-encoded password (use raw password)

### 4. Install Dependencies and Start Dev Server

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:5000`.

## Verification

Verify database connectivity:

```bash
node -e "require('dotenv').config(); const { Pool } = require('pg'); const pool = new Pool({ host: 'localhost', port: 5433, user: 'postgres', password: 'PASSWORD', database: 'aqi-development', ssl: false }); pool.query('SELECT COUNT(*) FROM standards').then(r => { console.log('Standards count:', r.rows[0].count); pool.end(); });"
```

Expected output: `Standards count: 1970787`

## Troubleshooting

### "The server does not support SSL connections"
- Ensure `?sslmode=disable` is in the DATABASE_URL
- The Cloud SQL Proxy handles SSL, so the PostgreSQL client shouldn't use it

### "google: could not find default credentials"
- Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- Verify the service account JSON key has "Cloud SQL Client" role

### Connection timeout
- Verify the Cloud SQL Proxy is running: `ps aux | grep cloud_sql_proxy`
- Check proxy logs for authentication or connection errors

## Key Configuration Files

- `.env` - Environment variables including DATABASE_URL
- `server/index.ts` - Loads dotenv config for environment variables
- `server/routes.ts` - Conditionally enables Replit auth based on REPL_ID

## Database Details

- **Instance**: `future-sunrise-473100-q7:us-central1:aqi-development`
- **Database**: `aqi-development`
- **Tables**: 1,970,787 rows in `standards` table
- **Connection**: Via Cloud SQL Proxy on localhost:5433
