import { useState, useEffect } from 'react';

/**
 * Hook to defer heavy rendering until after navigation animations complete.
 *
 * Uses requestAnimationFrame + delay to wait until after the browser/native
 * has finished the current paint and navigation animations before signaling
 * that the component is ready to render heavy content.
 *
 * @param delay - Delay in ms after frame completes (default 250ms for navigation)
 * @returns boolean - true when it's safe to render heavy content
 *
 * @example
 * ```tsx
 * const MyComponent = ({ items }) => {
 *   const isReady = useDeferredRender(); // Default 250ms delay
 *
 *   if (!isReady) {
 *     return <SkeletonPlaceholder />;
 *   }
 *
 *   return <HeavyListComponent items={items} />;
 * };
 * ```
 */
export function useDeferredRender(delay = 250): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    // Use requestAnimationFrame to defer until after current frame
    // This allows navigation animations to complete before heavy rendering
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;

      if (delay > 0) {
        // Optional additional delay after frame
        timerId = setTimeout(() => {
          if (!cancelled) setIsReady(true);
        }, delay);
      } else {
        setIsReady(true);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      if (timerId) clearTimeout(timerId);
    };
  }, [delay]);

  return isReady;
}
