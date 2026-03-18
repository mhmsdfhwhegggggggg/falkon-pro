# PostgreSQL Manual Setup Instructions for Dragon Telegram Pro

## STEP 1: Install PostgreSQL

Choose one of the following options:

### Option A: Docker (Recommended)
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dragaan_pro -e POSTGRES_DB=dragaan_pro --name postgres-db postgres:15
```

### Option B: Windows
Download from https://www.postgresql.org/download/windows/

### Option C: Chocolatey
```bash
choco install postgresql
```

### Option D: WSL2
```bash
wsl --install -y postgresql postgresql-contrib
```

## STEP 2: Create Database and User

Run these commands in PostgreSQL:
```bash
createdb -U postgres dragaan_pro
createuser -s dragaan_user
psql -U postgres -c 'GRANT ALL PRIVILEGES ON DATABASE dragaan_pro TO dragaan_user'
```

## STEP 3: Update Configuration Files

### Create .env.postgresql file:
```env
DATABASE_URL=postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro
```

### Update server/.secrets.json to include:
```json
{
  "DATABASE_URL": "postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro"
}
```

## STEP 4: Update Drizzle Configuration

Replace drizzle.config.ts content with PostgreSQL configuration:
```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema-postgres.ts",
  out: "./drizzle/migrations-postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro"
  },
  verbose: true,
  strict: true,
});
```

Update schema import to use `schema-postgres.ts` instead of `schema-sqlite.ts`.

## STEP 5: Add PostgreSQL Scripts

Add these scripts to package.json:
```json
{
  "scripts": {
    "db:generate:pg": "drizzle-kit generate --config=drizzle/config-postgres.ts",
    "db:push:pg": "drizzle-kit push --config=drizzle/config-postgres.ts",
    "db:migrate:pg": "drizzle-kit migrate --config=drizzle/config-postgres.ts",
    "db:studio:pg": "drizzle-kit studio --config=drizzle/config-postgres.ts"
  }
}
```

## STEP 6: Run Migrations

```bash
npm run db:push:pg
```

## Connection Details

- **Host**: localhost:5432
- **Database**: dragaan_pro
- **User**: dragaan_user
- **Password**: dragaan_secure_password_2024

## SECURITY NOTE

⚠️ **Change the default password in production!**

## Migration from SQLite

If you're migrating from SQLite to PostgreSQL:

1. Export your data from SQLite
2. Update your application code to use the new PostgreSQL functions
3. Run the PostgreSQL migrations
4. Import your data into PostgreSQL

## Testing Connection

Test your PostgreSQL connection with:
```bash
npm run db:studio:pg
```

This will open Drizzle Studio connected to your PostgreSQL database.
