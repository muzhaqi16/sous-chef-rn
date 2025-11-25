import { useState, useEffect } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Hook to defer heavy rendering until after interactions complete.
 *
 * Uses InteractionManager to wait until navigation animations and other
 * interactions have finished before signaling that the component is ready
 * to render heavy content. This prevents janky animations during screen
 * transitions.
 *
 * @param delay - Optional additional delay in ms after interactions complete (default: 100ms)
 * @returns boolean - true when it's safe to render heavy content
 *
 * @example
 * ```tsx
 * const MyComponent = ({ items }) => {
 *   const isReady = useDeferredRender();
 *
 *   if (!isReady) {
 *     return <SkeletonPlaceholder />;
 *   }
 *
 *   return <HeavyListComponent items={items} />;
 * };
 * ```
 */
export function useDeferredRender(delay = 100): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    // Use InteractionManager to wait for navigation animations to complete
    // This is critical for smooth screen transitions with heavy list components
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;

      if (delay > 0) {
        // Additional delay after interactions complete
        // This gives extra buffer for the UI to settle
        timerId = setTimeout(() => {
          if (!cancelled) setIsReady(true);
        }, delay);
      } else {
        setIsReady(true);
      }
    });

    return () => {
      cancelled = true;
      interactionHandle.cancel();
      if (timerId) clearTimeout(timerId);
    };
  }, [delay]);

  return isReady;
}
