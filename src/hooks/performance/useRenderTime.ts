import { useEffect, useRef } from 'react';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance/types';
import { usePerformanceStore } from '#/store/performanceStore';

/* eslint-disable react-compiler/react-compiler, react-hooks/purity -- Render-time measurement is inherently impure (performance.now, Math.random during render). Compiler optimization is not applicable. */

/**
 * Hook to track component render time and count
 *
 * Measures render duration and reports metrics to telemetry system.
 * Uses sampling to minimize performance overhead.
 * Gated behind __DEV__ so it's completely inert in production builds.
 *
 * @param componentName - Name of the component being tracked
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   useRenderTime('MyComponent');
 *   return <View>...</View>;
 * }
 * ```
 */
export function useRenderTime(
  componentName: string,
  options?: {
    enabled?: boolean;
    sampleRate?: number;
    slowThreshold?: number;
  },
) {
  // In production, this hook is a no-op — all refs and effects are skipped.
  // The __DEV__ guard is a compile-time constant so the branch is dead-code-eliminated.
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const totalRenderTime = useRef<number>(0);

  if (__DEV__) {
    renderStartTime.current = performance.now();
  }

  const enabled = options?.enabled ?? DEFAULT_PERFORMANCE_CONFIG.enabled;
  const sampleRate = options?.sampleRate ?? DEFAULT_PERFORMANCE_CONFIG.sampleRate;
  const slowThreshold = options?.slowThreshold ?? DEFAULT_PERFORMANCE_CONFIG.slowRenderThreshold;

  if (__DEV__) {
    renderCount.current += 1;
  }

  // Apply sampling - only track a percentage of renders
  const shouldTrack = __DEV__ ? Math.random() < sampleRate : false;

  // Measure render time after paint
  // Intentionally omitting deps — this effect must run after every render to capture timing.
  useEffect(() => {
    if (!__DEV__) return;

    // Skip if disabled
    if (!enabled) {
      return;
    }

    // Skip if not tracking this render (except first render)
    if (!shouldTrack && renderCount.current > 1) {
      return;
    }
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;

    // Update totals
    totalRenderTime.current += renderDuration;
    const avgRenderTime = totalRenderTime.current / renderCount.current;

    // Record metrics
    Telemetry.histogram('component_render_duration_ms', renderDuration, {
      component: componentName,
    });

    Telemetry.increment('component_render_count', 1, {
      component: componentName,
    });

    // Record metrics in performance store for dashboard (isolated from main store)
    usePerformanceStore.getState().recordComponentRender(componentName, renderDuration);

    // Track slow renders
    if (renderDuration > slowThreshold) {
      Telemetry.increment('slow_component_renders_total', 1, {
        component: componentName,
        duration: renderDuration.toFixed(2),
      });

      console.warn(
        `[Performance] Slow render detected: ${componentName} took ${renderDuration.toFixed(2)}ms`,
      );
    }

    // Log render metrics in dev
    if (renderCount.current === 1) {
      console.log(
        `[Performance] ${componentName} first render: ${renderDuration.toFixed(2)}ms`,
      );
    } else if (renderCount.current <= 10) {
      // Log first 10 renders to track unnecessary re-renders
      console.log(
        `[Performance] ${componentName} render #${renderCount.current}: ${renderDuration.toFixed(2)}ms (avg: ${avgRenderTime.toFixed(2)}ms)`,
      );
    }
  });
}

/**
 * Hook to track render time with automatic component name detection
 *
 * @param displayName - Optional display name (falls back to 'Component')
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   useRenderTime('MyComponent');
 *   // ... component code
 * }
 * ```
 */
export function useAutoRenderTime(displayName?: string) {
  const componentName = displayName || 'Component';
  useRenderTime(componentName);
}
