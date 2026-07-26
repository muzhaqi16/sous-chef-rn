#!/usr/bin/env bash
# Sets up (or with CLEAR=1, tears down) the adb reverse tunnel that lets the app
# reach the local GraphQL API on tcp:4000.
#
#   TARGET / DEVICE_ID   (see android-target.sh; defaults to every attached device)
#   CLEAR=1              remove all reverse mappings instead of adding one
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=scripts/android-target.sh
. scripts/android-target.sh

devices="$(resolve_targets)"
require_targets "$devices"

# Port forwarding is per-device and harmless to repeat, so an unqualified run
# covers everything attached rather than just the CLI's default pick.
if [ -z "$devices" ]; then
  devices="$(attached_devices)"
fi

if [ -z "$devices" ]; then
  echo "No attached devices." >&2
  exit 1
fi

for device in $devices; do
  if [ -n "${CLEAR:-}" ]; then
    echo "Clearing reverse mappings on $device"
    adb -s "$device" reverse --remove-all
  else
    echo "Forwarding tcp:4000 on $device"
    adb -s "$device" reverse tcp:4000 tcp:4000
  fi
done
