#!/bin/bash
#
# Script to test release builds locally
# This helps debug issues that only occur in release mode
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Release Build Testing Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Function to print colored status
info() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Choose environment
echo "Which API environment do you want to test against?"
echo "  1) Production API (https://api.souschef.dev)"
echo "  2) Local development API (http://localhost:4000)"
echo ""
read -p "Enter choice [1-2]: " ENV_CHOICE

case $ENV_CHOICE in
    1)
        info "Using Production API"
        ENV_FILE=".env.production"
        ;;
    2)
        info "Using Local API"
        warn "Note: Local API requires cleartext traffic and ADB port forwarding"
        ENV_FILE=".env.development"
        ;;
    *)
        error "Invalid choice"
        exit 1
        ;;
esac

# Step 2: Copy appropriate .env file
if [ ! -f "$ENV_FILE" ]; then
    error "Environment file $ENV_FILE not found!"
    exit 1
fi

info "Copying $ENV_FILE to .env"
cp "$ENV_FILE" .env

# Step 3: Check if app is installed
PACKAGE_NAME="dev.souschef.app"
if adb shell pm list packages | grep -q "$PACKAGE_NAME"; then
    warn "App is currently installed. Uninstalling to clear all data..."
    adb uninstall "$PACKAGE_NAME" || true
    info "App uninstalled successfully"
else
    info "App not installed, proceeding with fresh install"
fi

# Step 4: Set up ADB port forwarding (if using local API)
if [ "$ENV_CHOICE" = "2" ]; then
    info "Setting up ADB port forwarding for localhost:4000"
    adb reverse tcp:4000 tcp:4000
    info "Port forwarding active: device port 4000 -> localhost:4000"
fi

# Step 5: Clean and build
info "Cleaning Android build cache..."
cd android && ./gradlew clean && cd ..

# Choice 1 (production HTTPS) → staging variant
# Choice 2 (local HTTP) → localRelease variant (allows cleartext)
if [ "$ENV_CHOICE" = "2" ]; then
    BUILD_VARIANT="localRelease"
    GRADLE_TASK="assembleLocalRelease"
    APK_DIR="localRelease"
    APK_SUFFIX="localRelease"
else
    BUILD_VARIANT="staging"
    GRADLE_TASK="assembleStaging"
    APK_DIR="staging"
    APK_SUFFIX="staging"
fi

info "Building $BUILD_VARIANT APK (with debug signing)..."
info "Note: This has all release optimizations but uses debug keystore"
cd android && ./gradlew "$GRADLE_TASK" && cd ..

# Step 6: Install APK
APK_PATH="android/app/build/outputs/apk/${APK_DIR}/app-universal-${APK_SUFFIX}.apk"

if [ ! -f "$APK_PATH" ]; then
    error "APK not found at $APK_PATH"
    error "Build may have failed. Check the output above."
    exit 1
fi

info "Installing APK..."
adb install "$APK_PATH"

# Step 7: Instructions for viewing logs
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
info "$BUILD_VARIANT APK installed successfully"
echo ""
info "Build info: $BUILD_VARIANT variant (ProGuard enabled, debug signed)"
echo ""
echo "To view debug logs, run:"
echo "  ${YELLOW}adb logcat | grep -E '(Auth:|Network:|Queue Link:|Store:)'${NC}"
echo ""
echo "Look for these key log messages:"
echo "  📡 Network: Initial state fetched"
echo "  🏪 Store: Hydrated successfully"
echo "  🔐 Auth: Starting login"
echo "  ✅ Queue Link: Login mutation passing through"
echo ""
warn "The app is running with RELEASE optimizations (ProGuard, minification) but debug signing"
echo ""
