# Android Multi-Device Development Guide

## Quick Commands

### List Connected Devices
```bash
npm run adb:devices           # List all devices with details
npm run adb:devices:count     # Show count of connected devices
```

### Run on All Devices
```bash
npm run android:all        # Run on all devices (debug mode)
npm run android:stg:all    # Run on all devices (staging mode)
npm run android:release:all # Run on all devices (release mode)
```

### Run on Specific Device
```bash
# Set environment variable then run
export DEVICE_ID="emulator-5554"
npm run android:device      # Uses DEVICE_ID
npm run android:stg:device  # Staging mode with DEVICE_ID

# Or pass directly to react-native
npx react-native run-android --deviceId="emulator-5554"
```

### Run on Device Types
```bash
npm run android:emulator   # Run on emulator only
npm run android:phone      # Run on physical device only
```

### Port Forwarding for GraphQL
```bash
npm run adb:gql:all       # Setup port forwarding on all devices
npm run adb:gql:device    # Setup on specific device (uses DEVICE_ID env)
npm run adb:gql:emulator  # Setup on emulator only
npm run adb:gql:phone     # Setup on physical device only
npm run adb:clear:all     # Clear all reverse port mappings
```

## Common Device Scenarios

### 1. Single Emulator + Single Physical Device
```bash
# Run on both
npm run android:all

# Run on emulator only  
npm run android:emulator

# Run on phone only
npm run android:phone
```

### 2. Multiple Emulators
```bash
# List all devices to get IDs
npm run adb:devices

# Run on specific emulator
export DEVICE_ID="emulator-5554"
npm run android:device

# Or run on all
npm run android:all
```

### 3. Wireless Debugging
```bash
# Connect device over WiFi first
adb tcpip 5555
adb connect 192.168.1.100:5555

# Then run normally
npm run android:all
```

## Environment Variables

Set these in your terminal or `.env.local`:

```bash
# Default device for single-device commands
export DEVICE_ID="emulator-5554"

# Example: Run on specific device
export DEVICE_ID="192.168.1.100:5555" && npm run android:device
```

## Troubleshooting

### "More than one device/emulator" Error
This happens when a command doesn't specify which device to use:
```bash
npm run adb:devices        # See all connected devices
export DEVICE_ID="YOUR_DEVICE_ID"
npm run android:device     # Run with specified device
```

### Port Already in Use / Connection Issues
```bash
npm run adb:kill           # Kill and restart ADB server  
npm run adb:clear:all      # Clear all reverse port mappings
npm run adb:gql:all        # Re-setup port forwarding
```

### Build Cache Issues
```bash
npm run android:clean      # Clean Android build cache
npm run reset:cache        # Reset Metro bundler cache
npm run watchman          # Reset Watchman
```

### View Device Logs
```bash
npm run adb:log           # View logs from default device
export DEVICE_ID="emulator-5554"
npm run adb:log:device    # View logs from specific device
```

## Tips

- **For Unix/Mac**: The scripts use bash syntax. Windows users should use Git Bash or WSL.
- **Device IDs**: Run `npm run adb:devices` to see all device IDs
- **Emulator vs Phone**: The `-e` flag targets emulators, `-d` targets physical devices
- **Multiple Builds**: When running on all devices, builds happen sequentially, not in parallel