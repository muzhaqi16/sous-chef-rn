# Android Multi-Device Development Guide

## How the Android scripts work

Every `android:*` script is a thin wrapper around `scripts/run-android.sh`,
which takes two environment variables:

| Variable | Values | Default |
|---|---|---|
| `MODE` | `debug`, `staging`, `production`, `release`, `localRelease` | `debug` |
| `TARGET` | `default`, `all`, `emulator`, `phone`, or a device id | `default` |

`DEVICE_ID=<id>` is shorthand for `TARGET=<id>`. The named scripts cover the
common combinations; anything else you set directly:

```bash
npm run android                                  # debug, CLI picks the device
MODE=staging TARGET=all npm run android          # staging on every device
MODE=release DEVICE_ID=emulator-5554 npm run android
```

The script sets up the `tcp:4000` adb reverse tunnel for each target before
installing, so the app can reach the local GraphQL API — no separate port
forwarding step is needed when running through it.

## Quick Commands

### List Connected Devices
```bash
npm run adb:devices           # List all devices with details
```

### Run by Build Variant
```bash
npm run android               # debug (.env)
npm run android:stg           # staging build (.env.staging)
npm run android:prod          # debug build with production env (.env.production)
npm run android:release       # release build
npm run android:local-release # release build signed with the debug key
```

### Run by Device
```bash
npm run android:all        # Every attached device, sequentially
npm run android:emulator   # First attached emulator
npm run android:phone      # First attached physical device

export DEVICE_ID="emulator-5554"
npm run android            # That specific device
```

Combine the two by setting `MODE` yourself:

```bash
MODE=staging TARGET=all npm run android
MODE=release TARGET=phone npm run android
```

### Port Forwarding for GraphQL
Only needed on its own if you want the tunnel without reinstalling the app —
`npm run android` already does this for whatever it installs to.

```bash
npm run adb:gql                      # Forward tcp:4000 on every attached device
TARGET=emulator npm run adb:gql      # Emulator only
DEVICE_ID=emulator-5554 npm run adb:gql
npm run adb:gql:clear                # Remove all reverse mappings
```

## Common Device Scenarios

### 1. Single Emulator + Single Physical Device
```bash
npm run android:all        # Both
npm run android:emulator   # Emulator only
npm run android:phone      # Phone only
```

### 2. Multiple Emulators
```bash
npm run adb:devices        # Get the device ids

export DEVICE_ID="emulator-5554"
npm run android            # One specific emulator

npm run android:all        # Or all of them
```

### 3. Wireless Debugging
```bash
# Connect device over WiFi first
adb tcpip 5555
adb connect 192.168.1.100:5555

# Then run normally — it shows up as a regular target
npm run android:all
```

An explicit `TARGET`/`DEVICE_ID` that matches no attached device is an error
rather than a silent fallback, so a typo'd or disconnected id fails fast with
the current device list.

## Environment Variables

```bash
# Target a specific device for any android:* / adb:gql script
export DEVICE_ID="emulator-5554"
export DEVICE_ID="192.168.1.100:5555"
```

## Troubleshooting

### "More than one device/emulator" Error
This happens when a command doesn't specify which device to use:
```bash
npm run adb:devices        # See all connected devices
export DEVICE_ID="YOUR_DEVICE_ID"
npm run android
```

### Port Already in Use / Connection Issues
```bash
npm run adb:kill           # Kill and restart ADB server
npm run adb:gql:clear      # Clear all reverse port mappings
npm run adb:gql            # Re-setup port forwarding
```

### Build Cache Issues
```bash
npm run android:clean      # Clean Android build cache
npm run reset:cache        # Reset Metro bundler cache
npm run watchman          # Reset Watchman
```

### View Device Logs
```bash
npm run adb:log            # View logs from default device
export DEVICE_ID="emulator-5554"
npm run adb:log            # View logs from that device
```

## Tips

- **For Unix/Mac**: The scripts use bash syntax. Windows users should use Git Bash or WSL.
- **Device IDs**: Run `npm run adb:devices` to see all device IDs
- **Offline devices** are skipped — only devices in the `device` state are targeted
- **Multiple Builds**: When running on all devices, builds happen sequentially, not in parallel
