#!/usr/bin/env bash
# Builds and installs the Android app.
#
#   MODE=debug|staging|production|release|localRelease   (default: debug)
#   TARGET / DEVICE_ID                                   (see android-target.sh)
#
# The named npm scripts (android, android:stg, android:all, …) are thin
# wrappers that set these; any combination works directly too:
#
#   MODE=staging TARGET=all npm run android
#   MODE=release DEVICE_ID=emulator-5554 npm run android
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/android-target.sh
. scripts/android-target.sh

MODE="${MODE:-debug}"

# Build variants that target a deployed API read their own env file; debug and
# the release/localRelease perf builds fall through to `.env`. An ENVFILE that
# is already set in the caller's environment always wins.
case "$MODE" in
  staging)    export ENVFILE="${ENVFILE:-.env.staging}" ;;
  production) export ENVFILE="${ENVFILE:-.env.production}" ;;
esac

devices="$(resolve_targets)"
require_targets "$devices"

# The app talks to the local API over an adb reverse tunnel, so the forward has
# to exist before the freshly installed build launches.
if [ -z "$devices" ]; then
  adb reverse tcp:4000 tcp:4000 || true
  exec npx react-native run-android --mode="$MODE"
fi

for device in $devices; do
  echo "==> $device ($MODE)"
  adb -s "$device" reverse tcp:4000 tcp:4000 || true
  npx react-native run-android --mode="$MODE" --device="$device"
done
