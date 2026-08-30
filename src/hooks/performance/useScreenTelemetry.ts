import { useEffect, useRef } from 'react';
import { Telemetry } from '#/services/telemetry';

/**
 * Fires `Telemetry.trackScreen` once per component lifecycle, deferred until
 * `isReady`. `getProperties` is called lazily at fire time, so it can read refs.
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

    const idleId = requestIdleCallback(() => {
      Telemetry.trackScreen(screenName, getPropertiesRef.current());
    });

    // Deps exclude getProperties deliberately: it is read from the ref.
    return () => cancelIdleCallback(idleId);
  }, [isReady, screenName]);
}
