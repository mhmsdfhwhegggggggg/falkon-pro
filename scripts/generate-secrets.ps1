# Generate Secure Production Secrets
Write-Host "🔐 Generating secure production secrets for Dragon Telegram Pro..." -ForegroundColor Yellow

# Generate secure random values
$encryptionKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$jwtSecret = -join ((48..57) + (65..90) + (97..122) + (33, 35, 36, 37, 42, 43, 45, 61, 63, 64, 95) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$sessionSecret = -join ((48..57) + (65..90) + (97..122) + (33, 35, 36, 37, 42, 43, 45, 61, 63, 64, 95) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$sessionEncKey = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($encryptionKey))

# Create production .env file
$envContent = @"
# Dragon Telegram Pro - Production Environment Variables
# Generated on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

# Application
NODE_ENV=production
APP_NAME=Dragon Telegram Pro
APP_VERSION=6.0.0
PORT=3000
EXPO_PORT=8081

# Database (Production - PostgreSQL recommended)
DATABASE_URL=postgresql://username:password@localhost:5432/dragaan_pro
# For development use: file:./dev.db

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Authentication & Security (SECURE VALUES GENERATED)
JWT_SECRET=$jwtSecret
SESSION_SECRET=$sessionSecret
ENCRYPTION_KEY=$encryptionKey

# Telegram API (Get from my.telegram.org/apps)
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here

# OAuth Configuration
OAUTH_SERVER_URL=https://your-oauth-server.com
APP_ID=your_app_id

# CORS (Production)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Anti-Ban System
ANTI_BAN_ENABLED=true
ANTI_BAN_STRICT_MODE=true

# Monitoring
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true

# License System
ENABLE_LICENSE_CHECK=true

# Proxy Settings
PROXY_ROTATION_ENABLED=true
PROXY_CHECK_INTERVAL=300000

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Storage
STORAGE_TYPE=local
STORAGE_PATH=./uploads

# Feature Flags
ENABLE_BULK_OPERATIONS=true
ENABLE_ADVANCED_EXTRACTION=true
ENABLE_REAL_TIME_UPDATES=true
ENABLE_ANALYTICS=true

# Security Headers
HELMET_ENABLED=true
ENABLE_CSRF_PROTECTION=true

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
"@

# Create secrets file
$secretsContent = @"
{
  "SESSION_ENC_KEY": "$sessionEncKey",
  "TELEGRAM_API_ID": 12345678,
  "TELEGRAM_API_HASH": "your_api_hash_here",
  "DATABASE_URL": "file:./dev.db",
  "REDIS_URL": "redis://127.0.0.1:6379"
}
"@

# Write files
Write-Host "📝 Creating .env.production file..." -ForegroundColor Blue
$envContent | Out-File -FilePath ".env.production" -Encoding UTF8 -Force

Write-Host "🔒 Creating server/.secrets.json file..." -ForegroundColor Blue
if (!(Test-Path "server")) {
    New-Item -ItemType Directory -Path "server" -Force
}
$secretsContent | Out-File -FilePath "server/.secrets.json" -Encoding UTF8 -Force

# Display generated secrets (for manual copy)
Write-Host "🔐 Generated Secure Secrets:" -ForegroundColor Green
Write-Host "ENCRYPTION_KEY: $encryptionKey" -ForegroundColor Cyan
Write-Host "JWT_SECRET: $jwtSecret" -ForegroundColor Cyan  
Write-Host "SESSION_SECRET: $sessionSecret" -ForegroundColor Cyan
Write-Host "SESSION_ENC_KEY (Base64): $sessionEncKey" -ForegroundColor Cyan

Write-Host "✅ Production secrets generated successfully!" -ForegroundColor Green
Write-Host "⚠️  IMPORTANT: Update these values in your production environment:" -ForegroundColor Yellow
Write-Host "   - TELEGRAM_API_ID and TELEGRAM_API_HASH from my.telegram.org" -ForegroundColor White
Write-Host "   - DATABASE_URL for your PostgreSQL instance" -ForegroundColor White
Write-Host "   - CORS_ORIGINS for your domain" -ForegroundColor White
Write-Host "   - OAuth configuration" -ForegroundColor White
