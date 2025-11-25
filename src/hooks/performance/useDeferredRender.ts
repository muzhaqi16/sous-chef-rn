import { useState, useEffect } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Hook to defer heavy rendering until after navigation animations complete.
 *
 * Uses InteractionManager.runAfterInteractions to wait for all pending
 * interactions (like navigation animations) to complete before signaling
 * that the component is ready to render heavy content.
 *
 * @param delay - Optional additional delay in ms after interactions complete
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
export function useDeferredRender(delay = 0): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for all interactions (navigation animations, etc.) to complete
    const handle = InteractionManager.runAfterInteractions(() => {
      if (delay > 0) {
        // Optional additional delay after interactions
        const timer = setTimeout(() => setIsReady(true), delay);
        return () => clearTimeout(timer);
      } else {
        setIsReady(true);
      }
    });

    return () => handle.cancel();
  }, [delay]);

  return isReady;
}
