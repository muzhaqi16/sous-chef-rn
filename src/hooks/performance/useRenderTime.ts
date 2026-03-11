import { useEffect, useLayoutEffect, useRef } from 'react';
import performance from 'react-native-performance';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance/types';
import { usePerformanceStore } from '#/store/performanceStore';

/**
 * Hook to track component render time and count
 *
 * Measures render duration using `react-native-performance` marks/measures
 * and reports metrics to telemetry via the central observer pattern in
 * `NativePerformanceService`. Captures `performance.now()` during render,
 * then creates a `performance.measure()` in `useLayoutEffect` for accurate
 * render+commit duration.
 *
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
  const renderDurationRef = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const totalRenderTime = useRef<number>(0);

  const enabled = options?.enabled ?? DEFAULT_PERFORMANCE_CONFIG.enabled;
  const sampleRate =
    options?.sampleRate ?? DEFAULT_PERFORMANCE_CONFIG.sampleRate;
  const slowThreshold =
    options?.slowThreshold ?? DEFAULT_PERFORMANCE_CONFIG.slowRenderThreshold;

  // Capture render start time during render phase.
  // performance.now() is an impure call — the compiler won't memoize it.
  const renderStart = __DEV__ ? performance.now() : 0;

  const measureName = `component:${componentName}:render`;

  // Create a performance.measure() synchronously after commit to capture
  // accurate render+commit duration. Store duration in ref for the passive effect.
  useLayoutEffect(() => {
    if (!__DEV__) return;

    const measure = performance.measure(measureName, { start: renderStart });
    renderDurationRef.current = measure.duration;
    renderCount.current += 1;
  });

  // Report metrics after paint.
  // Intentionally omitting deps — this effect must run after every render to capture timing.
  useEffect(() => {
    if (!__DEV__) return;

    // Skip if disabled
    if (!enabled) {
      return;
    }

    // Apply sampling decision inside effect to avoid impure Math.random() during render
    const shouldTrack = Math.random() < sampleRate;

    // Skip if not tracking this render (except first render)
    if (!shouldTrack && renderCount.current > 1) {
      return;
    }

    const renderDuration = renderDurationRef.current;

    // Update totals
    totalRenderTime.current += renderDuration;
    const avgRenderTime = totalRenderTime.current / renderCount.current;

    // Histogram is routed by the central observer in NativePerformanceService
    // (component:*:render measures → component_render_duration_ms histogram)

    Telemetry.increment('component_render_count', 1, {
      component: componentName,
    });

    // Record metrics in performance store for dashboard (isolated from main store)
    usePerformanceStore
      .getState()
      .recordComponentRender(componentName, renderDuration);

    // Track slow renders
    if (renderDuration > slowThreshold) {
      Telemetry.increment('slow_component_renders_total', 1, {
        component: componentName,
        duration: renderDuration.toFixed(2),
      });

      console.warn(
        `[Performance] Slow render detected: ${componentName} took ${renderDuration.toFixed(
          2,
        )}ms`,
      );
    }

    // Log render metrics in dev
    if (renderCount.current === 1) {
      console.log(
        `[Performance] ${componentName} first render: ${renderDuration.toFixed(
          2,
        )}ms`,
      );
    } else if (renderCount.current <= 10) {
      // Log first 10 renders to track unnecessary re-renders
      console.log(
        `[Performance] ${componentName} render #${
          renderCount.current
        }: ${renderDuration.toFixed(2)}ms (avg: ${avgRenderTime.toFixed(2)}ms)`,
      );
    }

    // Clean up measures to avoid unbounded memory growth
    performance.clearMeasures(measureName);
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
