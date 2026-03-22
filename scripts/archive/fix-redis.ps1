# Fix Redis version issue by using Docker
Write-Host "Starting Redis 7.x using Docker..." -ForegroundColor Green

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "Docker is available!" -ForegroundColor Green
} catch {
    Write-Host "Docker is not available. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Stop any existing Redis container
Write-Host "Stopping existing Redis containers..." -ForegroundColor Yellow
docker stop redis -ErrorAction SilentlyContinue
docker rm redis -ErrorAction SilentlyContinue

# Start Redis 7.x container
Write-Host "Starting Redis 7.x container..." -ForegroundColor Green
docker run -d -p 6379:6379 --name redis --restart always redis:7-alpine

# Wait for Redis to start
Write-Host "Waiting for Redis to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test Redis connection
Write-Host "Testing Redis connection..." -ForegroundColor Green
$attempts = 0
$maxAttempts = 10

while ($attempts -lt $maxAttempts) {
    try {
        $redis = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 6379)
        $redis.Close()
        Write-Host "✅ Redis 7.x is running successfully!" -ForegroundColor Green
        Write-Host "🎉 Ready for BullMQ!" -ForegroundColor Green
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
    # Test Redis version
    Write-Host "Checking Redis version..." -ForegroundColor Green
    try {
        $version = docker exec redis redis-server --version
        Write-Host "Redis version: $version" -ForegroundColor Green
    } catch {
        Write-Host "Could not get Redis version, but connection is working" -ForegroundColor Yellow
    }
}

Write-Host "Redis setup completed!" -ForegroundColor Green
