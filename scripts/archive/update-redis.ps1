# Update Redis to version 7.x for BullMQ compatibility
Write-Host "Updating Redis to version 7.x..." -ForegroundColor Green

# Stop Redis service
Write-Host "Stopping Redis service..." -ForegroundColor Yellow
Stop-Service Redis -Force -ErrorAction SilentlyContinue

# Remove old Redis
Write-Host "Removing old Redis..." -ForegroundColor Yellow
Remove-Item -Path "C:\Program Files\Redis" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Service Redis -ErrorAction SilentlyContinue

# Download Redis 7.x
$tempDir = "C:\temp\redis-new"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$redisUrl = "https://github.com/tporadowski/redis/releases/download/v7.0.15/Redis-x64-7.0.15.msi"
$redisPath = "$tempDir\Redis-x64-7.0.15.msi"

Write-Host "Downloading Redis 7.x from: $redisUrl"
Invoke-WebRequest -Uri $redisUrl -OutFile $redisPath

Write-Host "Installing Redis 7.x..." -ForegroundColor Green
Start-Process msiexec -ArgumentList "/i `"$redisPath`" /quiet" -Wait

Write-Host "Starting Redis service..." -ForegroundColor Green
Start-Service Redis

Write-Host "Redis 7.x installation completed!" -ForegroundColor Green

# Test Redis connection
Write-Host "Testing Redis connection..." -ForegroundColor Green
try {
    $redis = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 6379)
    $redis.Close()
    Write-Host "✅ Redis 7.x is running successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Redis connection failed" -ForegroundColor Red
}

# Clean up
Remove-Item -Path $tempDir -Recurse -Force
