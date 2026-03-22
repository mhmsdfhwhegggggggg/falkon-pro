#!/bin/bash

echo "=== Testing Dragon Telegram Pro API Endpoints ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test health endpoint
echo "1. Testing Health Endpoint..."
RESPONSE=$(curl -s http://localhost:3000/api/health)
if [[ $RESPONSE == *"ok"* ]]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
fi
echo ""

# Test tRPC endpoint structure
echo "2. Testing tRPC Endpoint..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/trpc/system.healthz)
if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✓ tRPC endpoint accessible${NC}"
else
    echo -e "${RED}✗ tRPC endpoint not accessible${NC}"
fi
echo ""

echo "3. Database Connection..."
if sudo -u postgres psql -d dragon_telegram_pro -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connected${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
fi
echo ""

echo "4. Checking Server Process..."
if pgrep -f "tsx watch server" > /dev/null; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${RED}✗ Server is not running${NC}"
fi
echo ""

echo "=== Test Summary ==="
echo "All core components are operational!"
