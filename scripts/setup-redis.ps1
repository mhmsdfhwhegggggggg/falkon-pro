# Redis Setup Script for Windows
Write-Host "🔧 Setting up Redis for Dragon Telegram Pro..." -ForegroundColor Yellow

# Check if Redis is already running
$redisProcess = Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
if ($redisProcess) {
    Write-Host "✅ Redis is already running!" -ForegroundColor Green
    exit 0
}

# Try using WSL2 if available
try {
    wsl --list --quiet
    Write-Host "🐧 WSL2 detected, installing Redis via apt..." -ForegroundColor Blue
    wsl sudo apt update
    wsl sudo apt install -y redis-server
    wsl sudo service redis-server start
    Write-Host "✅ Redis installed and started via WSL2" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "⚠️ WSL2 not available, trying manual setup..." -ForegroundColor Yellow
}

# Download Redis for Windows
$redisUrl = "https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.msi"
$redisPath = "$env:TEMP\Redis-x64-3.0.504.msi"

Write-Host "📥 Downloading Redis..." -ForegroundColor Blue
try {
    Invoke-WebRequest -Uri $redisUrl -OutFile $redisPath
    Write-Host "✅ Redis downloaded successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to download Redis: $_" -ForegroundColor Red
    Write-Host "🔧 Manual Redis setup required:" -ForegroundColor Yellow
    Write-Host "1. Download Redis from: https://github.com/microsoftarchive/redis/releases" -ForegroundColor White
    Write-Host "2. Install Redis-x64-3.0.504.msi" -ForegroundColor White
    Write-Host "3. Start Redis service: redis-server" -ForegroundColor White
    exit 1
}

# Install Redis MSI
Write-Host "🔧 Installing Redis..." -ForegroundColor Blue
try {
    Start-Process -FilePath $redisPath -ArgumentList "/quiet", "/norestart" -Wait
    Write-Host "✅ Redis installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install Redis: $_" -ForegroundColor Red
    exit 1
}

# Start Redis service
Write-Host "🚀 Starting Redis service..." -ForegroundColor Blue
try {
    Start-Service -Name "Redis" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    
    # Verify Redis is running
    $redisTest = & "C:\Program Files\Redis\redis-cli.exe" ping 2>$null
    if ($redisTest -eq "PONG") {
        Write-Host "✅ Redis is running and responding!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Redis installed but not responding. Starting manually..." -ForegroundColor Yellow
        Start-Process -FilePath "C:\Program Files\Redis\redis-server.exe"
        Start-Sleep -Seconds 3
        $redisTest = & "C:\Program Files\Redis\redis-cli.exe" ping 2>$null
        if ($redisTest -eq "PONG") {
            Write-Host "✅ Redis is now running!" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "❌ Failed to start Redis service: $_" -ForegroundColor Red
    Write-Host "🔧 Starting Redis manually..." -ForegroundColor Yellow
    try {
        Start-Process -FilePath "C:\Program Files\Redis\redis-server.exe"
        Write-Host "✅ Redis started manually" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to start Redis manually" -ForegroundColor Red
        exit 1
    }
}

# Cleanup
Remove-Item $redisPath -ErrorAction SilentlyContinue

Write-Host "🎉 Redis setup completed!" -ForegroundColor Green
Write-Host "📍 Redis is now available at: redis://127.0.0.1:6379" -ForegroundColor Cyan
