#!/usr/bin/env bash
# Shared MODE handling for run-ios.sh and run-android.sh. Sourced, not executed.

# Build variants that target a deployed API read their own env file; debug and
# the release/localRelease perf builds fall through to `.env`, which is where
# NODE_ENV, DEV_API_URL and the OTLP endpoints live. An ENVFILE already set in
# the caller's environment always wins.
resolve_envfile() {
  case "$MODE" in
    staging)    export ENVFILE="${ENVFILE:-.env.staging}" ;;
    production) export ENVFILE="${ENVFILE:-.env.production}" ;;
  esac
}

# The measuring builds accept an auth state from launch arguments so Detox can
# skip the UI login. It is a named, default-off capability rather than something
# inferred from NODE_ENV — see `Environment.allowsLaunchArgAuth`. Exported here
# (never written into a committed env file) so only a build produced by these
# scripts has it, and CI never does.
#
# The allowed modes are an ARGUMENT, never a default: the two platforms differ,
# and which variants qualify is a signing question that belongs at the call
# site where a reader will look for it.
allow_launch_arg_auth() {
  for allowed in $1; do
    if [ "$MODE" = "$allowed" ]; then
      export ALLOW_LAUNCH_ARG_AUTH=true
      return
    fi
  done
}
