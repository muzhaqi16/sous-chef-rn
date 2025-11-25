import { useState, useEffect } from 'react';

/**
 * Hook to defer heavy rendering until after the current frame.
 *
 * Uses requestAnimationFrame to wait until after the browser/native
 * has finished the current paint before signaling that the component
 * is ready to render heavy content.
 *
 * @param delay - Optional additional delay in ms after frame completes
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
