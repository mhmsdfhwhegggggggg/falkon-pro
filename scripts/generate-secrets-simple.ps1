# Generate Secure Production Secrets
Write-Host "Generating secure production secrets..." -ForegroundColor Yellow

# Generate secure random values
$encryptionKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$jwtSecret = -join ((48..57) + (65..90) + (97..122) + (33,35,36,37,42,43,45,61,63,64,95) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$sessionSecret = -join ((48..57) + (65..90) + (97..122) + (33,35,36,37,42,43,45,61,63,64,95) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$sessionEncKey = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($encryptionKey))

# Create production .env file
$envContent = @"
NODE_ENV=production
APP_NAME=Dragon Telegram Pro
APP_VERSION=6.0.0
PORT=3000
EXPO_PORT=8081
DATABASE_URL=postgresql://username:password@localhost:5432/dragaan_pro
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=$jwtSecret
SESSION_SECRET=$sessionSecret
ENCRYPTION_KEY=$encryptionKey
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
OAUTH_SERVER_URL=https://your-oauth-server.com
APP_ID=your_app_id
CORS_ORIGINS=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ANTI_BAN_ENABLED=true
ANTI_BAN_STRICT_MODE=true
ENABLE_METRICS=true
ENABLE_HEALTH_CHECKS=true
ENABLE_LICENSE_CHECK=true
PROXY_ROTATION_ENABLED=true
PROXY_CHECK_INTERVAL=300000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
STORAGE_TYPE=local
STORAGE_PATH=./uploads
ENABLE_BULK_OPERATIONS=true
ENABLE_ADVANCED_EXTRACTION=true
ENABLE_REAL_TIME_UPDATES=true
ENABLE_ANALYTICS=true
HELMET_ENABLED=true
ENABLE_CSRF_PROTECTION=true
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
Write-Host "Creating .env.production file..." -ForegroundColor Blue
$envContent | Out-File -FilePath ".env.production" -Encoding UTF8 -Force

Write-Host "Creating server/.secrets.json file..." -ForegroundColor Blue
if (!(Test-Path "server")) {
    New-Item -ItemType Directory -Path "server" -Force
}
$secretsContent | Out-File -FilePath "server/.secrets.json" -Encoding UTF8 -Force

# Display generated secrets
Write-Host "Generated Secure Secrets:" -ForegroundColor Green
Write-Host "ENCRYPTION_KEY: $encryptionKey" -ForegroundColor Cyan
Write-Host "JWT_SECRET: $jwtSecret" -ForegroundColor Cyan  
Write-Host "SESSION_SECRET: $sessionSecret" -ForegroundColor Cyan
Write-Host "SESSION_ENC_KEY (Base64): $sessionEncKey" -ForegroundColor Cyan

Write-Host "Production secrets generated successfully!" -ForegroundColor Green
Write-Host "IMPORTANT: Update these values in production:" -ForegroundColor Yellow
Write-Host "   - TELEGRAM_API_ID and TELEGRAM_API_HASH from my.telegram.org" -ForegroundColor White
Write-Host "   - DATABASE_URL for your PostgreSQL instance" -ForegroundColor White
Write-Host "   - CORS_ORIGINS for your domain" -ForegroundColor White
