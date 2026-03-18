# PostgreSQL Setup Script for Dragon Telegram Pro
Write-Host "🐘 Setting up PostgreSQL for Dragon Telegram Pro..." -ForegroundColor Yellow

# Check if PostgreSQL is already installed and running
$postgresService = Get-Service -Name "postgresql" -ErrorAction SilentlyContinue
if ($postgresService) {
    Write-Host "✅ PostgreSQL service is already running" -ForegroundColor Green
    $postgresRunning = $true
} else {
    Write-Host "⚠️ PostgreSQL service not found" -ForegroundColor Yellow
    $postgresRunning = $false
}

# Check if PostgreSQL is installed
try {
    $psqlVersion = & psql --version 2>$null
    if ($psqlVersion) {
        Write-Host "✅ PostgreSQL is installed: $psqlVersion" -ForegroundColor Green
        $postgresInstalled = $true
    } else {
        $postgresInstalled = $false
    }
} catch {
    $postgresInstalled = $false
}

# Installation options
if (-not $postgresInstalled) {
    Write-Host "❌ PostgreSQL is not installed" -ForegroundColor Red
    Write-Host "📋 Installation options:" -ForegroundColor Blue
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "2. Use Chocolatey: choco install postgresql" -ForegroundColor White
    Write-Host "3. Use Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dragaan_pro postgres:15" -ForegroundColor White
    Write-Host "4. Use WSL2: wsl --install -y postgresql postgresql-contrib" -ForegroundColor White
    
    $continue = Read-Host "Do you want to continue with Docker setup? (y/n)"
    if ($continue -eq 'y') {
        Write-Host "🐳 Setting up PostgreSQL with Docker..." -ForegroundColor Blue
        try {
            docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dragaan_pro -e POSTGRES_DB=dragaan_pro --name postgres-db postgres:15
            Write-Host "✅ PostgreSQL Docker container started" -ForegroundColor Green
            $postgresRunning = $true
            Write-Host "📍 PostgreSQL is available at: localhost:5432" -ForegroundColor Cyan
            Write-Host "🔑 Database: dragaan_pro, Password: dragaan_pro" -ForegroundColor Cyan
        } catch {
            Write-Host "❌ Failed to start PostgreSQL container" -ForegroundColor Red
            Write-Host "Please install Docker and try again" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Please install PostgreSQL manually and run this script again" -ForegroundColor Red
        exit 1
    }
}

# Create database if it doesn't exist
if ($postgresRunning) {
    Write-Host "🔧 Creating database and user..." -ForegroundColor Blue
    
    try {
        # Test connection
        $testConnection = & psql -h localhost -U postgres -c "SELECT 1;" 2>$null
        if ($testConnection) {
            Write-Host "✅ PostgreSQL connection successful" -ForegroundColor Green
            
            # Create database
            & psql -h localhost -U postgres -c "CREATE DATABASE dragaan_pro;" 2>$null
            Write-Host "✅ Database 'dragaan_pro' created" -ForegroundColor Green
            
            # Create user
            & psql -h localhost -U postgres -c "CREATE USER dragaan_user WITH PASSWORD 'dragaan_secure_password_2024';" 2>$null
            Write-Host "✅ User 'dragaan_user' created" -ForegroundColor Green
            
            # Grant privileges
            & psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE dragaan_pro TO dragaan_user;" 2>$null
            Write-Host "✅ Privileges granted to dragaan_user" -ForegroundColor Green
            
            Write-Host "🎉 PostgreSQL setup completed!" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Failed to connect to PostgreSQL" -ForegroundColor Red
        Write-Host "Please check your PostgreSQL installation and configuration" -ForegroundColor Red
        exit 1
    }
}

# Update environment file
Write-Host "📝 Updating environment configuration..." -ForegroundColor Blue

$envContent = @"
# PostgreSQL Database Configuration for Production
DATABASE_URL=postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro

# Alternative connection strings:
# For local development without password:
# DATABASE_URL=postgresql://localhost:5432/dragaan_pro

# For remote PostgreSQL server:
# DATABASE_URL=postgresql://username:password@hostname:5432/dragaan_pro

# For cloud services (AWS RDS, Google Cloud SQL, etc.):
# DATABASE_URL=postgresql://user:pass@host:5432/dbname
"@

$envContent | Out-File -FilePath ".env.postgresql" -Encoding UTF8 -Force

# Update secrets file
if (Test-Path "server\.secrets.json") {
    $secretsContent = Get-Content "server\.secrets.json" | ConvertFrom-Json
    $secretsContent.DATABASE_URL = "postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro"
    $secretsContent | ConvertTo-Json -Depth 10 | Out-File -FilePath "server\.secrets.json" -Encoding UTF8 -Force
    Write-Host "✅ Updated server/.secrets.json" -ForegroundColor Green
}

Write-Host "✅ Environment files updated" -ForegroundColor Green
Write-Host "📄 Created .env.postgresql" -ForegroundColor Cyan

# Update Drizzle config
Write-Host "🔧 Updating Drizzle configuration..." -ForegroundColor Blue

$drizzleConfig = @"
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema-postgres.ts",
  out: "./drizzle/migrations-postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://dragaan_user:dragaan_secure_password_2024@localhost:5432/dragaan_pro",
  },
  verbose: true,
  strict: true,
});
"@

$drizzleConfig | Out-File -FilePath "drizzle.config.ts" -Encoding UTF8 -Force
Write-Host "✅ Updated drizzle.config.ts" -ForegroundColor Green

# Update package.json scripts
Write-Host "📦 Adding PostgreSQL scripts to package.json..." -ForegroundColor Blue

$packageJson = Get-Content "package.json" | ConvertFrom-Json
$packageJson.scripts | Add-Member -NotePropertyName "db:generate:pg" "drizzle-kit generate --config=drizzle/config-postgres.ts"
$packageJson.scripts | Add-Member -NotePropertyName "db:push:pg" "drizzle-kit push --config=drizzle/config-postgres.ts"
$packageJson.scripts | Add-Member -NotePropertyName "db:migrate:pg" "drizzle-kit migrate --config=drizzle/config-postgres.ts"
$packageJson.scripts | Add-Member -NotePropertyName "db:studio:pg" "drizzle-kit studio --config=drizzle/config-postgres.ts"

$packageJson | ConvertTo-Json -Depth 10 | Out-File -FilePath "package.json" -Encoding UTF8 -Force
Write-Host "✅ Added PostgreSQL scripts to package.json" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 PostgreSQL setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: npm run db:push:pg" -ForegroundColor White
Write-Host "2. Update your application to use PostgreSQL" -ForegroundColor White
Write-Host "3. Test the connection with: npm run db:studio:pg" -ForegroundColor White
Write-Host ""
Write-Host "📍 PostgreSQL connection details:" -ForegroundColor Cyan
Write-Host "   Host: localhost" -ForegroundColor White
Write-Host "   Port: 5432" -ForegroundColor White
Write-Host "   Database: dragaan_pro" -ForegroundColor White
Write-Host "   User: dragaan_user" -ForegroundColor White
Write-Host "   Password: dragaan_secure_password_2024" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  SECURITY NOTE: Change the default password in production!" -ForegroundColor Red
