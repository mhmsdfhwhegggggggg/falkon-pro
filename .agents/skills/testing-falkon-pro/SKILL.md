# Testing Falkon Pro

## Overview
Falkon Pro is a full-stack TypeScript application with:
- **Backend**: Express.js + tRPC server (port 3000)
- **Frontend**: React Native / Expo (port 8081)
- **Database**: PostgreSQL (via Drizzle ORM)
- **Queue**: Redis/BullMQ with MockQueue fallback
- **External**: Telegram API integration

## Quick Validation Commands
```bash
# TypeScript type checking
npx tsc --noEmit

# Server build
npm run build

# Worker build  
npm run build:worker

# Start dev server only (no frontend)
npm run dev:server

# Start both server + Expo frontend
npm run dev

# Run test suite (requires PostgreSQL)
npm run test
```

## Local Development Setup

### Minimum (Server Only, No DB)
The server will start without PostgreSQL or Redis:
- Redis falls back to MockQueue automatically
- Database operations will fail gracefully (health check shows "degraded")
- Health endpoints (`/`, `/health`, `/live`, `/ready`) will respond
- tRPC routes that require DB will return errors

This is useful for verifying TypeScript fixes, build integrity, and server startup.

### Full Setup (Requires PostgreSQL)
For full integration testing:
1. Install and start PostgreSQL
2. Set `DATABASE_URL=postgresql://user:pass@localhost:5432/falkon_pro`
3. Run `npm run db:push` to generate and apply migrations
4. Start server: `npm run dev:server`
5. (Optional) Start Redis for real queue processing
6. (Optional) Set `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` for Telegram features

### Environment Variables
Key env vars (see `server/_core/env.ts` for full list):
- `DATABASE_URL` - PostgreSQL connection string (default: `file:./dev.db` but only PostgreSQL works)
- `REDIS_URL` - Redis URL (optional, falls back to MockQueue)
- `JWT_SECRET` - Must be >= 32 chars for auth
- `ENCRYPTION_KEY` - Must be exactly 32 chars
- `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` - Required in production
- `PORT` - Server port (default: 3000, auto-increments if busy)

## Health Endpoints
- `GET /` - Root status page (always 200)
- `GET /health` - Full health check (200 if all OK, 503 if degraded)
- `GET /live` - Liveness probe (always 200 with `{"alive":true}`)
- `GET /ready` - Readiness probe (503 if DB not connected)

## Build & Deploy
- Project uses **npm** (not pnpm) - `package-lock.json` is the lockfile
- `Dockerfile.production` uses multi-stage build with `npm ci`
- Render configs (`render-production.yaml`, `render-deploy.yaml`) use `npm install && npm run build`
- Start commands: `npm run start` (runs migrations then starts server), `npm run start:worker`

## Known Issues
- Port 3000 may be occupied; server auto-finds next available port
- `npm ci` in Docker may fail if lockfile version doesn't match Docker's npm version
- The app uses `trpcAny` (untyped tRPC client) in frontend, so client-server mismatches won't be caught by TypeScript
- No CI/CD pipeline is configured on the repository

## Devin Secrets Needed
- `DATABASE_URL` - PostgreSQL connection string for full integration testing
- `TELEGRAM_API_ID` - Telegram API ID for Telegram feature testing
- `TELEGRAM_API_HASH` - Telegram API hash for Telegram feature testing
