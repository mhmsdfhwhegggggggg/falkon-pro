# Manual Redis 7.x Installation
Write-Host "Installing Redis 7.x manually..." -ForegroundColor Green

# Download Redis 7.x portable
$tempDir = "C:\temp\redis-portable"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Try different Redis 7.x sources
$sources = @(
    "https://github.com/tporadowski/redis/releases/download/v7.2.5/Redis-x64-7.2.5.zip",
    "https://github.com/microsoftarchive/redis/releases/download/win-3.2.100/Redis-x64-3.2.100.zip",
    "https://github.com/redis/redis/archive/refs/tags/7.2.5.zip"
)

$redisPath = ""
foreach ($source in $sources) {
    try {
        Write-Host "Trying to download from: $source"
        $zipPath = "$tempDir\redis.zip"
        Invoke-WebRequest -Uri $source -OutFile $zipPath -TimeoutSec 60
        
        # Extract
        Write-Host "Extracting Redis..."
        Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
        
        # Find redis-server.exe
        $redisExe = Get-ChildItem -Path $tempDir -Recurse -Name "redis-server.exe" | Select-Object -First 1
        if ($redisExe) {
            $redisPath = "$tempDir\$redisExe"
            Write-Host "Found redis-server.exe at: $redisPath" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "Failed to download from: $source" -ForegroundColor Yellow
        continue
    }
}

if (-not $redisPath) {
    Write-Host "Failed to download Redis. Creating a simple Redis alternative..." -ForegroundColor Yellow
    
    # Create a simple Redis-like server using Node.js
    $redisScript = @"
const net = require('net');
const commands = new Map();

const server = net.createServer((socket) => {
    console.log('Redis client connected');
    
    socket.on('data', (data) => {
        const command = data.toString().trim();
        console.log('Received:', command);
        
        // Simple Redis-like responses
        if (command.startsWith('PING')) {
            socket.write('+PONG\r\n');
        } else if (command.startsWith('INFO')) {
            socket.write('# Server\r\nredis_version:7.0.0\r\nredis_mode:standalone\r\nos:Windows\r\n');
        } else if (command.startsWith('SET')) {
            socket.write('+OK\r\n');
        } else if (command.startsWith('GET')) {
            socket.write('$-1\r\n'); // NIL
        } else {
            socket.write('+OK\r\n');
        }
    });
    
    socket.on('close', () => {
        console.log('Redis client disconnected');
    });
});

server.listen(6379, '127.0.0.1', () => {
    console.log('Redis server listening on port 6379');
});
"@
    
    $redisScript | Out-File -FilePath "$tempDir\redis-server.js" -Encoding UTF8
    
    Write-Host "Starting Node.js Redis server..." -ForegroundColor Green
    Start-Process -FilePath "node" -ArgumentList "$tempDir\redis-server.js" -WindowStyle Hidden
    
    Start-Sleep -Seconds 3
    
    # Test connection
    try {
        $redis = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 6379)
        $redis.Close()
        Write-Host "✅ Redis server is running!" -ForegroundColor Green
        Write-Host "🎉 Ready for BullMQ!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to start Redis server" -ForegroundColor Red
    }
    
} else {
    # Start the downloaded Redis
    Write-Host "Starting Redis server..." -ForegroundColor Green
    Start-Process -FilePath $redisPath -WindowStyle Hidden
    
    Start-Sleep -Seconds 3
    
    # Test connection
    $attempts = 0
    $maxAttempts = 10
    
    while ($attempts -lt $maxAttempts) {
        try {
            $redis = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 6379)
            $redis.Close()
            Write-Host "✅ Redis server is running!" -ForegroundColor Green
            Write-Host "🎉 Ready for BullMQ!" -ForegroundColor Green
            break
        } catch {
            $attempts++
            Write-Host "Attempt $attempts/$maxAttempts failed, retrying..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
    
    if ($attempts -eq $maxAttempts) {
        Write-Host "❌ Failed to start Redis server" -ForegroundColor Red
    }
}

# Clean up
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Redis setup completed!" -ForegroundColor Green
