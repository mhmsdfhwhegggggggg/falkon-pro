#!/bin/bash

# Dragon Telegram Pro - APK Build Script
# This script helps you build APK quickly

set -e

echo "🚀 Dragon Telegram Pro - APK Builder"
echo "===================================="
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Installing..."
    npm install -g eas-cli
    echo "✅ EAS CLI installed"
fi

echo ""
echo "Select build type:"
echo "1) Preview (for testing, faster)"
echo "2) Production (for release, optimized)"
echo "3) Development (with DevTools)"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🔨 Building Preview APK..."
        eas build --platform android --profile preview
        ;;
    2)
        echo ""
        echo "🔨 Building Production APK..."
        eas build --platform android --profile production
        ;;
    3)
        echo ""
        echo "🔨 Building Development APK..."
        eas build --platform android --profile development
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Build started!"
echo ""
echo "📱 You can monitor the build at: https://expo.dev/accounts/[your-account]/projects/dragaan-pro/builds"
echo ""
echo "💡 Tip: Use 'eas build:list' to see all builds"
echo ""
