#!/bin/bash

###############################################################################
# Dragon Telegram Pro - Production Setup Script
# This script helps setup the application for production deployment
###############################################################################

set -e  # Exit on error

echo "========================================"
echo "Dragon Telegram Pro - Production Setup"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "ℹ $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run this script as root"
    exit 1
fi

# Step 1: Check Node.js and pnpm
echo "Step 1: Checking dependencies..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
print_success "Node.js $(node --version) found"

if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install pnpm first."
    exit 1
fi
print_success "pnpm $(pnpm --version) found"

# Step 2: Check PostgreSQL
echo ""
echo "Step 2: Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL client not found. Please ensure PostgreSQL is installed."
else
    print_success "PostgreSQL client found"
fi

# Step 3: Check Redis
echo ""
echo "Step 3: Checking Redis..."
if ! command -v redis-cli &> /dev/null; then
    print_warning "Redis client not found. Please ensure Redis is installed."
else
    print_success "Redis client found"
    if redis-cli ping &> /dev/null; then
        print_success "Redis server is running"
    else
        print_warning "Redis server is not running"
    fi
fi

# Step 4: Install dependencies
echo ""
echo "Step 4: Installing dependencies..."
pnpm install
print_success "Dependencies installed"

# Step 5: Setup environment file
echo ""
echo "Step 5: Setting up environment file..."
if [ ! -f .env ]; then
    cp .env.example .env
    print_success ".env file created from .env.example"
    print_warning "Please edit .env file and add your configuration"
    print_warning "Required: DATABASE_URL, TELEGRAM_API_ID, TELEGRAM_API_HASH, JWT_SECRET, ENCRYPTION_KEY"
else
    print_info ".env file already exists"
fi

# Step 6: Generate secrets
echo ""
echo "Step 7: Generating encryption keys..."
ENCRYPTION_KEY=$(openssl rand -base64 32 | head -c 32)
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 32)

echo ""
print_info "Generated secrets (add these to your .env file):"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "JWT_SECRET=$JWT_SECRET"
echo "SESSION_SECRET=$SESSION_SECRET"
echo ""

# Step 7: Database setup
echo "Step 8: Database setup..."
read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    pnpm db:push
    print_success "Database migrations completed"
else
    print_warning "Skipping database migrations. Run 'pnpm db:push' manually later."
fi

# Step 8: Build application
echo ""
echo "Step 9: Building application..."
pnpm build
print_success "Application built successfully"

# Step 9: Test configuration
echo ""
echo "Step 10: Testing configuration..."
if [ -f .env ]; then
    # Check required variables
    REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "ENCRYPTION_KEY")
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^${var}=" .env; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        print_success "All required environment variables are set"
    else
        print_error "Missing required environment variables:"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
    fi
fi

# Step 10: Setup PM2 (optional)
echo ""
read -p "Do you want to setup PM2 for process management? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! command -v pm2 &> /dev/null; then
        print_info "Installing PM2..."
        npm install -g pm2
    fi
    print_success "PM2 is ready"
    print_info "To start the application with PM2, run: pm2 start server/pm2.config.cjs"
fi

# Final summary
echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
print_info "Next steps:"
echo "1. Edit .env file and add your configuration"
echo "2. Make sure PostgreSQL and Redis are running"
echo "3. Run database migrations: pnpm db:push"
echo "4. Start the application: pnpm start"
echo "   or with PM2: pm2 start server/pm2.config.cjs"
echo ""
print_warning "Important: Change all default secrets in production!"
echo ""
