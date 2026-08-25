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

MODE="${MODE:-debug}"

# The device Detox expects, so a hand-run build and a Detox run land on the
# same simulator and can be compared.
DEVICE="${DEVICE:-$(node -e "console.log(require('./.detoxrc.js').devices.simulator.device.type)")}"

# Build variants that target a deployed API read their own env file. Debug and
# the release perf build fall through to `.env` — which is where NODE_ENV,
# DEV_API_URL and the OTLP endpoints live. An ENVFILE already set in the
# caller's environment always wins.
case "$MODE" in
  staging)    export ENVFILE="${ENVFILE:-.env.staging}" ;;
  production) export ENVFILE="${ENVFILE:-.env.production}" ;;
esac

# The measuring builds accept an auth state from launch arguments so Detox can
# skip the UI login. It is a named, default-off capability rather than something
# inferred from NODE_ENV — see `Environment.allowsLaunchArgAuth`. Exported here
# (never written into a committed env file) so only a build produced by this
# script has it, and CI never does.
case "$MODE" in
  debug|release|localRelease) export ALLOW_LAUNCH_ARG_AUTH=true ;;
esac

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
