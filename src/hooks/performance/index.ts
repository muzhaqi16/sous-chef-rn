/**
 * Performance Monitoring & Optimization Hooks
 *
 * React hooks for tracking component render times, memory usage,
 * screen transitions, and React 18+ performance patterns.
 */

// Monitoring hooks
export { useRenderTime, useAutoRenderTime } from './useRenderTime';
export { useMemoryMonitor, useCurrentMemory } from './useMemoryMonitor';
export { useScreenTransition } from './useScreenTransition';
export { useFPSMonitor, useSimpleFPS } from './useFPSMonitor';

// Rendering optimization hooks
export { useDeferredRender } from './useDeferredRender';
export { useProgressiveList } from './useProgressiveList';

// React 18+ performance patterns
export {
  useFilterTransition,
  useFilterTransitionWithDeps,
} from './useFilterTransition';
export {
  useDeferredSearch,
  useDeferredSearchWithSort,
} from './useDeferredSearch';
