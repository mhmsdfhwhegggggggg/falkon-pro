# Simple Redis Setup for Windows
Write-Host "🔧 Setting up Redis for FALKON PRO Telegram Pro..." -ForegroundColor Yellow

# Check if Redis is already running
$redisProcess = Get-Process -Name "redis-server" -ErrorAction SilentlyContinue
if ($redisProcess) {
    Write-Host "✅ Redis is already running!" -ForegroundColor Green
    exit 0
}

# Try WSL2 first
try {
    wsl --list --quiet 2>$null
    Write-Host "🐧 Installing Redis via WSL2..." -ForegroundColor Blue
    wsl sudo apt update -y
    wsl sudo apt install -y redis-server
    wsl sudo service redis-server start
    Write-Host "✅ Redis installed via WSL2!" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "⚠️ WSL2 not available" -ForegroundColor Yellow
}

# Manual setup instructions
Write-Host "📋 Manual Redis Setup Required:" -ForegroundColor Yellow
Write-Host "1. Download Redis: https://github.com/microsoftarchive/redis/releases" -ForegroundColor White
Write-Host "2. Install: Redis-x64-3.0.504.msi" -ForegroundColor White
Write-Host "3. Start: redis-server" -ForegroundColor White
Write-Host "4. Test: redis-cli ping" -ForegroundColor White

# Try to start if already installed
if (Test-Path "C:\Program Files\Redis\redis-server.exe") {
    Write-Host "🚀 Starting existing Redis..." -ForegroundColor Blue
    try {
        Start-Process -FilePath "C:\Program Files\Redis\redis-server.exe"
        Start-Sleep -Seconds 3
        $test = & "C:\Program Files\Redis\redis-cli.exe" ping 2>$null
        if ($test -eq "PONG") {
            Write-Host "✅ Redis is running!" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Failed to start Redis" -ForegroundColor Red
    }
}

