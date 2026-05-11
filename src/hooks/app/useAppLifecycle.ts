import { useNetworkStatus } from '#hooks/useNetworkStatus';
import { useTheme } from '#hooks/useTheme';
import { useAppearance } from '#hooks/useAppearance';
import { useOnlineQueueSync } from '#hooks/app/useOnlineQueueSync';
import { useStartupInit } from '#hooks/app/useStartupInit';
import { useAppStateLifecycle } from '#hooks/app/useAppStateLifecycle';

/**
 * App-root lifecycle orchestrator. Mounts every concern that the App
 * component needs to wire up at startup in one call, mirroring how
 * useTabScreenLifecycle composes per-screen lifecycle hooks.
 *
 * Order is intentional:
 *   1. Theme + appearance — must run before any UI paints
 *   2. Network status — populates isOnline used by the queue sync below
 *   3. Online queue sync — reacts to isOnline transitions
 *   4. Startup init — one-time bootstrap (telemetry, perf, device ID, ...)
 *   5. AppState lifecycle — token refresh + queue resume + telemetry flush
 */
export function useAppLifecycle(): void {
  useTheme();
  useAppearance();
  useNetworkStatus();
  useOnlineQueueSync();
  useStartupInit();
  useAppStateLifecycle();
}
