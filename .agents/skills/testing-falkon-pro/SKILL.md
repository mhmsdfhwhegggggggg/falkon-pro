# Testing Falkon Pro

## Overview
Falkon Pro is a Telegram automation platform built with Expo (React Native) frontend and Express.js + tRPC backend with PostgreSQL.

## Devin Secrets Needed
- No external secrets required for local testing
- Admin credentials are configured in `.env` (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)

## Environment Setup

### Prerequisites
- PostgreSQL must be running on localhost:5432
- Database `falkon_pro` with user `falkon` / password `falkon123`
- Node.js v22+

### Database Setup
```bash
sudo -u postgres psql -c "CREATE USER falkon WITH PASSWORD 'falkon123';"
sudo -u postgres psql -c "CREATE DATABASE falkon_pro OWNER falkon;"
npm run db:push  # Runs drizzle-kit generate && drizzle-kit migrate
```

### Starting the Server
```bash
# Source .env first (it sets DATABASE_URL, JWT_SECRET, etc.)
cd /home/ubuntu/repos/falkon-pro
source .env
PORT=3000 npx tsx watch server/_core/index.ts
```
- Server runs on port 3000 by default
- If port 3000 is busy, it auto-increments (3001, 3002, etc.)
- The tRPC client (frontend) expects the server on port 3000 when running locally

### Starting the Web App (Expo Web)
```bash
npx expo start --web --port 8081
```

**Known Issue:** Expo web may fail to start with `ReferenceError: require is not defined` in `tailwind.config.js`. This is a pre-existing CJS/ESM incompatibility (`package.json` has `"type": "module"` but `tailwind.config.js` uses `require()`). This blocks UI testing in the browser. If you encounter this, fall back to API-level testing via curl.

## Testing Server-Side Features via tRPC API

tRPC endpoints are at `http://localhost:3000/api/trpc/{router}.{procedure}`.

### Authentication
```bash
# Login
curl -s -X POST http://localhost:3000/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"json":{"email":"admin@falcon.pro","password":"admin123456"}}'

# Register (requires ENABLE_REGISTRATION=true in .env)
curl -s -X POST http://localhost:3000/api/trpc/auth.register \
  -H "Content-Type: application/json" \
  -d '{"json":{"email":"test@test.com","password":"test123456","name":"Test User"}}'
```

### Protected Endpoints
For endpoints requiring auth, extract the JWT token from login response and pass as Bearer token:
```bash
curl -s -X POST http://localhost:3000/api/trpc/dashboard.getStats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"json":{}}'
```

### License Validation
```bash
curl -s -X POST http://localhost:3000/api/trpc/security.validateLicense \
  -H "Content-Type: application/json" \
  -d '{"json":{"key":"test-key","hwid":"test-hwid"}}'
```
When `ENABLE_LICENSE_CHECK=false`, this always returns `{valid: true, type: "unlimited"}`.

## Code Quality Checks
```bash
npm run check   # TypeScript typecheck (tsc --noEmit)
npm run lint    # ESLint via Expo (expo lint)
```

## Key Architecture Notes
- **tRPC routers** are in `server/routers/` - each router handles a feature domain
- **Screens** are in `app/(drawer)/` - Expo Router with drawer navigation
- **DB schema** uses Drizzle ORM - schema in `server/db/schema.ts`
- **Auth** uses JWT tokens signed with HS256
- The `users` table has a `username` field (not `name`) - be careful with this distinction
- License check can be disabled via `ENABLE_LICENSE_CHECK=false` in `.env`

## Common Gotchas
- The `source .env` command may print `bash: Admin: command not found` due to spaces in ADMIN_NAME - this is harmless
- tRPC mutations require POST requests (GET will return METHOD_NOT_SUPPORTED error)
- Shell commands with `app/(drawer)/` paths need quotes around the parentheses
- The server uses `superjson` transformer - curl requests should use `{"json":{...}}` format
