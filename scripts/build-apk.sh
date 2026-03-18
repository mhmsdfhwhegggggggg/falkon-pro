#!/bin/bash

# Dragon Telegram Pro - APK Build Script
# This script automates the APK building process

set -e

echo "🚀 Dragon Telegram Pro - APK Build Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ Error: pnpm is not installed. Please install it first.${NC}"
    echo "   npm install -g pnpm"
    exit 1
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pnpm install

# Check build method
echo ""
echo "Select build method:"
echo "1) EAS Build (Cloud) - Recommended"
echo "2) Local Build (Requires Android SDK)"
echo "3) Development Build"
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo -e "${GREEN}☁️  Using EAS Build (Cloud)${NC}"
        
        # Check if EAS CLI is installed
        if ! command -v eas &> /dev/null; then
            echo -e "${YELLOW}📥 Installing EAS CLI...${NC}"
            npm install -g eas-cli
        fi
        
        # Check if logged in
        if ! eas whoami &> /dev/null; then
            echo -e "${YELLOW}🔐 Please login to Expo...${NC}"
            eas login
        fi
        
        # Configure EAS if needed
        if [ ! -f "eas.json" ]; then
            echo -e "${YELLOW}⚙️  Configuring EAS...${NC}"
            eas build:configure
        fi
        
        # Build
        echo -e "${GREEN}🔨 Building APK with EAS...${NC}"
        eas build --platform android --profile preview --non-interactive
        
        echo -e "${GREEN}✅ Build submitted! Check your Expo dashboard for the download link.${NC}"
        echo "   https://expo.dev"
        ;;
        
    2)
        echo -e "${GREEN}🏠 Using Local Build${NC}"
        
        # Check if Android SDK is installed
        if [ -z "$ANDROID_HOME" ]; then
            echo -e "${RED}❌ Error: ANDROID_HOME is not set.${NC}"
            echo "   Please install Android SDK and set ANDROID_HOME environment variable."
            exit 1
        fi
        
        # Prebuild
        echo -e "${YELLOW}🔧 Running prebuild...${NC}"
        npx expo prebuild --platform android --clean
        
        # Build
        echo -e "${GREEN}🔨 Building APK...${NC}"
        cd android
        ./gradlew assembleRelease
        cd ..
        
        # Find APK
        APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
        if [ -f "$APK_PATH" ]; then
            echo -e "${GREEN}✅ APK built successfully!${NC}"
            echo "   Location: $APK_PATH"
            
            # Get APK size
            APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
            echo "   Size: $APK_SIZE"
            
            # Copy to root
            cp "$APK_PATH" "./dragon-telegram-pro.apk"
            echo "   Copied to: ./dragon-telegram-pro.apk"
        else
            echo -e "${RED}❌ Error: APK not found at $APK_PATH${NC}"
            exit 1
        fi
        ;;
        
    3)
        echo -e "${GREEN}🔧 Using Development Build${NC}"
        
        # Check if EAS CLI is installed
        if ! command -v eas &> /dev/null; then
            echo -e "${YELLOW}📥 Installing EAS CLI...${NC}"
            npm install -g eas-cli
        fi
        
        # Build development client
        echo -e "${GREEN}🔨 Building development APK...${NC}"
        eas build --platform android --profile development
        
        echo -e "${GREEN}✅ Development build submitted!${NC}"
        ;;
        
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Build process completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the APK on real devices"
echo "2. Check for any crashes or issues"
echo "3. If everything works, proceed with distribution"
echo ""
