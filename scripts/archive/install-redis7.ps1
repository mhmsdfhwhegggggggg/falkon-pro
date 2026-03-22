# Install Redis 7.x manually
Write-Host "Installing Redis 7.x for BullMQ compatibility..." -ForegroundColor Green

# Create temp directory
$tempDir = "C:\temp\redis7"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Download Redis 7.x (alternative source)
$redisUrl = "https://github.com/tporadowski/redis/releases/download/v7.2.5/Redis-x64-7.2.5.msi"
$redisPath = "$tempDir\Redis-x64-7.2.5.msi"

Write-Host "Downloading Redis 7.x from: $redisUrl"
try {
    Invoke-WebRequest -Uri $redisUrl -OutFile $redisPath -TimeoutSec 300
    Write-Host "Download completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Download failed, trying alternative method..." -ForegroundColor Yellow
    # Alternative: Use WebClient
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($redisUrl, $redisPath)
    Write-Host "Download completed with WebClient!" -ForegroundColor Green
}

# Stop old Redis service
Write-Host "Stopping old Redis service..." -ForegroundColor Yellow
try {
    Stop-Service Redis -Force -ErrorAction SilentlyContinue
    Write-Host "Old Redis service stopped" -ForegroundColor Green
} catch {
    Write-Host "No Redis service to stop" -ForegroundColor Yellow
}

# Install new Redis
Write-Host "Installing Redis 7.x..." -ForegroundColor Green
Start-Process msiexec -ArgumentList "/i `"$redisPath`" /quiet /norestart" -Wait

# Wait for installation
Start-Sleep -Seconds 5

# Start Redis service
Write-Host "Starting Redis service..." -ForegroundColor Green
try {
    Start-Service Redis
    Write-Host "Redis service started successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to start Redis service, trying manual start..." -ForegroundColor Yellow
    # Try to start redis-server directly
    $redisPath = "C:\Program Files\Redis\redis-server.exe"
    if (Test-Path $redisPath) {
        Start-Process -FilePath $redisPath -WindowStyle Hidden
        Write-Host "Redis server started manually!" -ForegroundColor Green
    }
}

Write-Host "Redis 7.x installation completed!" -ForegroundColor Green

# Test Redis connection
Write-Host "Testing Redis connection..." -ForegroundColor Green
$attempts = 0
$maxAttempts = 10

while ($attempts -lt $maxAttempts) {
    try {
        $redis = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 6379)
        $redis.Close()
        Write-Host "✅ Redis 7.x is running successfully!" -ForegroundColor Green
        break
    } catch {
        $attempts++
        Write-Host "Attempt $attempts/$maxAttempts failed, retrying in 2 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if ($attempts -eq $maxAttempts) {
    Write-Host "❌ Redis connection failed after $maxAttempts attempts" -ForegroundColor Red
} else {
    Write-Host "🎉 Redis is ready for BullMQ!" -ForegroundColor Green
}

# Clean up
Remove-Item -Path $tempDir -Recurse -Force
