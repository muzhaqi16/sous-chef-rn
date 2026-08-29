import { useFocusEffect } from '@react-navigation/native';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { useScreenTransition } from '#/hooks/performance/useScreenTransition';
import { useScreenTelemetry } from '#/hooks/performance/useScreenTelemetry';

/**
 * Module-scope focus callback shared by all tab screens.
 *
 * Pauses Apollo cache persistence on blur (so heavy serialization doesn't
 * fire during the next screen's scroll) and resumes on focus to flush
 * pending saves.
 *
 * Defined at module scope (not inside the hook) so the reference is stable
 * and React Compiler doesn't need to memoize it.
 */
const onScreenFocus = () => {
  apolloCachePersistence.resume();
  return () => {
    apolloCachePersistence.pause();
  };
};

interface UseTabScreenLifecycleOptions {
  screenName: string;
  telemetryProperties: () => Record<string, unknown>;
}

/**
 * Consolidates the three hooks that every tab screen calls identically:
 *
 * 1. `useFocusEffect(onScreenFocus)` -- pauses/resumes cache persistence
 * 2. `useScreenTransition` -- measures navigation performance
 * 3. `useScreenTelemetry` -- tracks screen view once
 *
 * @example
 * ```tsx
 * function PantryMainInner() {
 *   useTabScreenLifecycle({
 *     screenName: 'PantryMain',
 *     telemetryProperties: () => ({
 *       home_id: selectedHomeId,
 *       pantry_id: pantry?.id,
 *       item_count: pantryItems.length,
 *     }),
 *   });
 *   // ...
 * }
 * ```
 */
export function useTabScreenLifecycle({
  screenName,
  telemetryProperties,
}: UseTabScreenLifecycleOptions): void {
  useFocusEffect(onScreenFocus);
  useScreenTransition(screenName);
  useScreenTelemetry(screenName, telemetryProperties);
}
