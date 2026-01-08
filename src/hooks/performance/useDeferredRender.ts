import { useState, useEffect } from 'react';

/**
 * Hook to defer heavy rendering until after the runtime is idle.
 *
 * Uses requestIdleCallback to wait until the JavaScript runtime is idle
 * before signaling that the component is ready to render heavy content.
 * This prevents janky animations during screen transitions.
 *
 * @param delay - Timeout in ms to guarantee callback execution (default: 150ms)
 * @returns boolean - true when it's safe to render heavy content
 *
 * @example
 * ```tsx
 * const MyComponent = ({ items }) => {
 *   const isReady = useDeferredRender(); // Default 150ms timeout
 *
 *   if (!isReady) {
 *     return <SkeletonPlaceholder />;
 *   }
 *
 *   return <HeavyListComponent items={items} />;
 * };
 * ```
 *
 * @note If requestIdleCallback causes issues, can switch to useDeferredValue:
 * ```tsx
 * return useDeferredValue(true, false); // React 19 initialValue
 * ```
 */
export function useDeferredRender(delay = 150): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // requestIdleCallback runs when the runtime is idle
    // timeout ensures callback fires within (delay + 150)ms max
    const id = requestIdleCallback(
      () => {
        setIsReady(true);
      },
      { timeout: delay + 150 },
    );

    return () => cancelIdleCallback(id);
  }, [delay]);

  return isReady;
}
