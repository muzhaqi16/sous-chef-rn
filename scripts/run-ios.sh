#!/usr/bin/env bash
# Builds and installs the iOS app on a simulator.
#
#   MODE=debug|staging|production|release   (default: debug)
#   DEVICE=<name or UDID>                   (default: the Detox simulator)
#
# The named npm scripts (ios, ios:stg, ios:release, …) are thin wrappers that
# set these; any combination works directly too:
#
#   MODE=release npm run ios
#   MODE=release DEVICE="iPhone 17 Pro" npm run ios
#
# `release` is the mode to measure on: it embeds the bundle and builds JS with
# `__DEV__` false. Unlike Android — where `localRelease` had to be introduced
# because the release variant still loaded dev JS from Metro — iOS needs no
# special variant: AppDelegate.swift picks the embedded bundle under
# `#if !DEBUG`, so Release really is release for JS.
#
# There is no `adb reverse` analogue and none is needed: the simulator shares
# the Mac's network stack, so `localhost:4000` already reaches the dev API.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/build-mode.sh
. scripts/build-mode.sh

MODE="${MODE:-debug}"

# The device Detox expects, so a hand-run build and a Detox run land on the
# same simulator and can be compared.
DEVICE="${DEVICE:-$(node -e "console.log(require('./.detoxrc.js').devices.simulator.device.type)")}"

resolve_envfile
# Release is safe here because this script only builds for the simulator; see
# the gate comment below.
allow_launch_arg_auth "debug release localRelease"

# This script only ever builds for the simulator (`--simulator` below), and a
# simulator artifact cannot be installed on a phone — which is what makes the
# Release configuration safe to measure on iOS without a separate variant, the
# way Android needed `localRelease`. The gate is passed the sdk rather than the
# mode so that stays true if this script ever grows a device destination.
node scripts/check-launch-arg-auth.mjs --platform ios --sdk iphonesimulator

case "$MODE" in
  staging)    SCHEME="SousChefRN (Staging)" ;;
  production) SCHEME="SousChefRN (Production)" ;;
  *)          SCHEME="SousChefRN" ;;
esac

# Xcode has two build configurations, Debug and Release. Everything that is not
# an explicit debug build is measured, so it gets Release.
case "$MODE" in
  debug) CONFIGURATION="Debug" ;;
  *)     CONFIGURATION="Release" ;;
esac

if [ ! -f .env ] && [ -z "${ENVFILE:-}" ]; then
  echo "WARNING: no .env and no ENVFILE." >&2
  echo "  generate-env.js will emit undefined for every key, which means:" >&2
  echo "    - OTLP_METRICS_ENDPOINT undefined -> telemetry transport OFF, zero" >&2
  echo "      metrics emitted, and NO error at runtime." >&2
  echo "    - NODE_ENV falls back to production in a release build -> the app" >&2
  echo "      talks to the PRODUCTION API, not localhost." >&2
fi

echo "==> $DEVICE  (mode=$MODE, scheme=$SCHEME, configuration=$CONFIGURATION)"

xcrun simctl boot "$DEVICE" 2>/dev/null || true

exec npx react-native run-ios \
  --scheme "$SCHEME" \
  --mode "$CONFIGURATION" \
  --simulator "$DEVICE"
