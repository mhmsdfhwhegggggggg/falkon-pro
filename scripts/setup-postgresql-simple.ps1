# PostgreSQL Setup Script for Dragon Telegram Pro
Write-Host "Setting up PostgreSQL for Dragon Telegram Pro..." -ForegroundColor Yellow

# Check if PostgreSQL is available
try {
    $psqlVersion = & psql --version 2>$null
    if ($psqlVersion) {
        Write-Host "PostgreSQL is installed: $psqlVersion" -ForegroundColor Green
    } else {
        Write-Host "PostgreSQL not found. Please install PostgreSQL first." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "PostgreSQL not found. Please install PostgreSQL first." -ForegroundColor Red
    exit 1
}

# Create environment file
$envContent = @"
# PostgreSQL Database Configuration
DATABASE_URL=postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro
"@

Write-Host "Creating .env.postgresql file..." -ForegroundColor Blue
$envContent | Out-File -FilePath ".env.postgresql" -Encoding UTF8 -Force

# Update secrets file
if (Test-Path "server\.secrets.json") {
    Write-Host "Updating server/.secrets.json..." -ForegroundColor Blue
    $secretsContent = Get-Content "server\.secrets.json" | ConvertFrom-Json
    $secretsContent.DATABASE_URL = "postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro"
    $secretsContent | ConvertTo-Json -Depth 10 | Out-File -FilePath "server\.secrets.json" -Encoding UTF8 -Force
}

# Update Drizzle config
Write-Host "Updating drizzle.config.ts..." -ForegroundColor Blue
$drizzleConfig = @"
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema-postgres.ts",
  out: "./drizzle/migrations-postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro"
  },
  verbose: true,
  strict: true
});
"@

$drizzleConfig | Out-File -FilePath "drizzle.config.ts" -Encoding UTF8 -Force

# Update package.json scripts
Write-Host "Adding PostgreSQL scripts to package.json..." -ForegroundColor Blue
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$packageJson.scripts."db:generate:pg" = "drizzle-kit generate --config=drizzle/config-postgres.ts"
$packageJson.scripts."db:push:pg" = "drizzle-kit push --config=drizzle/config-postgres.ts"
$packageJson.scripts."db:migrate:pg" = "drizzle-kit migrate --config=drizzle/config-postgres.ts"
$packageJson.scripts."db:studio:pg" = "drizzle-kit studio --config=drizzle/config-postgres.ts"
$packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath "package.json" -Encoding UTF8 -Force

Write-Host "PostgreSQL setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Make sure PostgreSQL is running on localhost:5432" -ForegroundColor White
Write-Host "2. Create database: createdb -U postgres dragaan_pro" -ForegroundColor White
Write-Write-Host "3. Create user: createuser -s dragaan_user" -ForegroundColor White
Write-Host "4. Grant privileges: psql -U postgres -c 'GRANT ALL PRIVILEGES ON DATABASE dragaan_pro TO dragaan_user'" -ForegroundColor White
Write-Host "5. Run migrations: npm run db:push:pg" -ForegroundColor White
Write-Host ""
Write-Host "Connection details:" -ForegroundColor Cyan
Write-Host "Host: localhost:5432" -ForegroundColor White
Write-Host "Database: dragaan_pro" -ForegroundColor White
Write-Host "User: dragaan_user" -ForegroundColor White
Write-Host "Password: dragaan_secure_password_2024" -ForegroundColor White
Write-Host ""
Write-Host "SECURITY NOTE: Change the default password in production!" -ForegroundColor Red
