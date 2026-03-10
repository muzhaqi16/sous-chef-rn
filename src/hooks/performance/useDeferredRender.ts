import { useDeferredValue } from 'react';

/**
 * Hook to defer heavy rendering until React's concurrent scheduler is ready.
 *
 * Uses React 19's `useDeferredValue` with an initial value of `false`,
 * which transitions to `true` once the runtime is idle. This replaces
 * `requestIdleCallback` which has iOS reliability issues (RN #28602).
 *
 * React's concurrent scheduler is interruptible and cross-platform,
 * making it more reliable than manual idle detection.
 *
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
export function useDeferredRender(): boolean {
  return useDeferredValue(true, false);
}
