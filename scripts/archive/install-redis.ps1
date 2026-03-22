# Redis Installation Script for Windows
# Download and install Redis

Write-Host "Downloading Redis..." -ForegroundColor Green

# Create temp directory
$tempDir = "C:\temp\redis"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Download Redis (using Microsoft Archive)
$redisUrl = "https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.msi"
$redisPath = "$tempDir\Redis-x64-3.0.504.msi"

Write-Host "Downloading Redis from: $redisUrl"
Invoke-WebRequest -Uri $redisUrl -OutFile $redisPath

Write-Host "Installing Redis..." -ForegroundColor Green
# Install Redis silently
Start-Process msiexec -ArgumentList "/i `"$redisPath`" /quiet" -Wait

Write-Host "Starting Redis service..." -ForegroundColor Green
# Start Redis service
Start-Service Redis

Write-Host "Redis installation completed!" -ForegroundColor Green
Write-Host "Redis is now running on port 6379" -ForegroundColor Yellow

# Clean up
Remove-Item -Path $tempDir -Recurse -Force

# Test Redis connection
Write-Host "Testing Redis connection..." -ForegroundColor Green
try {
    $redis = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 6379)
    $redis.Close()
    Write-Host "✅ Redis is running successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Redis connection failed" -ForegroundColor Red
}
