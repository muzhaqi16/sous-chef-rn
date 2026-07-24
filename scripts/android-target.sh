# Shared device-selection helper for the Android npm scripts.
# Sourced by run-android.sh and adb-reverse.sh — not executable on its own.
#
# Selection comes from TARGET, or DEVICE_ID as a shorthand for TARGET=<id>:
#
#   TARGET=default    let the React Native CLI pick (single-device default)
#   TARGET=all        every attached device and emulator
#   TARGET=emulator   first attached emulator
#   TARGET=phone      first attached physical device
#   TARGET=<id>       that exact device id (see `npm run adb:devices`)

# Ids of devices in the "device" state — skips offline/unauthorized entries,
# which `adb -s` would fail on anyway.
attached_devices() {
  adb devices | tail -n +2 | awk '$2 == "device" { print $1 }'
}

selected_target() {
  echo "${TARGET:-${DEVICE_ID:-default}}"
}

# Device ids for the current selection, one per line. Empty for `default`,
# which means "pass no --device flag and let the CLI choose".
resolve_targets() {
  case "$(selected_target)" in
    default)  ;;
    all)      attached_devices ;;
    emulator) attached_devices | grep '^emulator-' | head -1 ;;
    phone)    attached_devices | grep -v '^emulator-' | head -1 ;;
    *)        attached_devices | grep -Fx "$(selected_target)" ;;
  esac
}

# Fail loudly when an explicit selection matches nothing, rather than silently
# falling back to whichever device happens to be attached.
require_targets() {
  local target devices
  target="$(selected_target)"
  devices="$1"
  if [ "$target" != "default" ] && [ -z "$devices" ]; then
    echo "No attached device matches TARGET=$target" >&2
    adb devices -l >&2
    exit 1
  fi
}
