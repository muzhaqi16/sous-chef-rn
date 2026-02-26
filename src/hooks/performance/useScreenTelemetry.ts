import { useEffect, useRef } from 'react';
import { Telemetry } from '#/services/telemetry';

/**
 * Track a screen view exactly once on mount.
 *
 * Fires `Telemetry.trackScreen` a single time per component lifecycle,
 * using a ref guard to prevent re-firing when data changes.
 * Optionally defers until an `isReady` flag becomes true (e.g. after
 * a deferred render pass).
 *
 * @param screenName - Name reported to telemetry (e.g. 'ShoppingListMain')
 * @param getProperties - Function that returns the properties bag at fire time.
 *   Called lazily inside setTimeout so it can read from refs.
 * @param isReady - When false, defers the tracking call until it flips to true
 *
 * @example
 * ```tsx
 * // Simple — pass static-ish values
 * useScreenTelemetry('PantryMain', () => ({
 *   home_id: selectedHomeId,
 *   item_count: items.length,
 * }));
 *
 * // With refs — read current values at fire time
 * useScreenTelemetry('ShoppingListMain', () => ({
 *   list_id: listIdRef.current,
 *   item_count: itemsRef.current.length,
 * }));
 *
 * // Deferred — wait until interactive
 * useScreenTelemetry('PantryMain', () => ({ ... }), isInteractive);
 * ```
 */
export function useScreenTelemetry(
  screenName: string,
  getProperties: () => Record<string, unknown>,
  isReady: boolean = true,
) {
  const firedRef = useRef(false);
  const getPropertiesRef = useRef(getProperties);
  useEffect(() => {
    getPropertiesRef.current = getProperties;
  });

  useEffect(() => {
    if (!isReady || firedRef.current) return;
    firedRef.current = true;

    const timer = setTimeout(() => {
      Telemetry.trackScreen(screenName, getPropertiesRef.current());
    }, 500);

    return () => clearTimeout(timer);
    // Fire once — getProperties is read from ref at fire time
  }, [isReady, screenName]);
}
