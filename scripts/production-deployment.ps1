# Production Deployment Script
Write-Host "🚀 FALKON PRO Telegram Pro - Production Deployment" -ForegroundColor Yellow

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Blue

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18+." -ForegroundColor Red
    exit 1
}

# Check if Redis is running
try {
    $redisTest = & redis-cli ping 2>$null
    if ($redisTest -eq "PONG") {
        Write-Host "✅ Redis is running" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Redis not responding. Starting Redis..." -ForegroundColor Yellow
        Start-Process -FilePath "redis-server"
        Start-Sleep -Seconds 3
    }
} catch {
    Write-Host "⚠️ Redis not found. Please install Redis." -ForegroundColor Yellow
}

# Check if database exists
if (Test-Path "dev.db") {
    Write-Host "✅ Database found" -ForegroundColor Green
} else {
    Write-Host "❌ Database not found. Running migrations..." -ForegroundColor Yellow
    npx drizzle-kit push
}

# Check if build files exist
if (Test-Path "dist\index.js") {
    Write-Host "✅ Build files found" -ForegroundColor Green
} else {
    Write-Host "❌ Build files not found. Building..." -ForegroundColor Yellow
    npm run build
    npm run build:worker
}

# Production configuration
Write-Host "⚙️ Production Configuration:" -ForegroundColor Blue

# Load production environment
if (Test-Path ".env.production") {
    Write-Host "✅ .env.production found" -ForegroundColor Green
    Get-Content ".env.production" | Where-Object { $_ -match "^[A-Z_]+=.*" } | ForEach-Object {
        $key, $value = $_ -split '=', 2
        if ($key -in @("NODE_ENV", "APP_NAME", "PORT", "DATABASE_URL", "REDIS_URL")) {
            Write-Host "  $key = $value" -ForegroundColor Cyan
        }
    }
} else {
    Write-Host "❌ .env.production not found. Please run secrets generation script." -ForegroundColor Red
    exit 1
}

# Check secrets file
if (Test-Path "server\.secrets.json") {
    Write-Host "✅ Secrets file found" -ForegroundColor Green
} else {
    Write-Host "❌ Secrets file not found. Please run secrets generation script." -ForegroundColor Red
    exit 1
}

# Health checks
Write-Host "🏥 Running health checks..." -ForegroundColor Blue

# Test database connection
try {
    $testResult = node -e "
const { getDb } = require('./dist/index.js');
getDb().then(db => {
    console.log('✅ Database connection successful');
    process.exit(0);
}).catch(err => {
    console.log('❌ Database connection failed:', err.message);
    process.exit(1);
});
"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database connection OK" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Database connection test failed" -ForegroundColor Red
}

# Test Redis connection
try {
    $redisTest = & redis-cli ping
    if ($redisTest -eq "PONG") {
        Write-Host "✅ Redis connection OK" -ForegroundColor Green
    } else {
        Write-Host "❌ Redis connection failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Redis connection test failed" -ForegroundColor Red
}

# Production deployment
Write-Host "🚀 Starting production deployment..." -ForegroundColor Blue

# Set production environment
$env:NODE_ENV = "production"

# Start the application
Write-Host "🌟 Starting FALKON PRO Telegram Pro..." -ForegroundColor Green
Write-Host "📍 Server will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📊 Health check: http://localhost:3000/api/health" -ForegroundColor Cyan
Write-Host "🔧 Worker process will run in background" -ForegroundColor Cyan

# Start worker in background
Start-Process -FilePath "node" -ArgumentList "dist\worker.js" -WindowStyle Hidden

# Start main server
try {
    & node dist\index.js
} catch {
    Write-Host "❌ Failed to start server: $_" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Configure your Telegram API credentials" -ForegroundColor White
Write-Host "   2. Set up your domain and SSL" -ForegroundColor White
Write-Host "   3. Configure OAuth provider" -ForegroundColor White
Write-Host "   4. Set up monitoring and logging" -ForegroundColor White

