import { useEffect, useLayoutEffect, useRef } from 'react';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance/types';
import { usePerformanceStore } from '#/store/performanceStore';

/**
 * Hook to track component render time and count
 *
 * Uses `Date.now()` during render to capture a start timestamp (the React
 * Compiler recognises `Date.now()` as impure so it won't be memoised),
 * then computes the render-to-commit duration in `useLayoutEffect`.
 *
 * Includes batched-render detection: if the render function ran before
 * the previous commit's layout effects finished (common during app startup
 * when the entire tree renders simultaneously), the hook uses the
 * commit-to-commit gap as a proxy duration instead of the inflated
 * render-to-commit measurement.
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
  const lastCommitTimeRef = useRef<number>(0);

  const enabled = options?.enabled ?? DEFAULT_PERFORMANCE_CONFIG.enabled;
  const sampleRate =
    options?.sampleRate ?? DEFAULT_PERFORMANCE_CONFIG.sampleRate;
  const slowThreshold =
    options?.slowThreshold ?? DEFAULT_PERFORMANCE_CONFIG.slowRenderThreshold;

  // Capture render start time during render phase.
  // Date.now() is intentionally impure — the React Compiler won't memoise it,
  // ensuring a fresh timestamp on every render. The imported performance.now()
  // was incorrectly memoised by the compiler (treated as pure), causing stale
  // renderStart values and inflated render-to-commit measurements.
  // eslint-disable-next-line react-hooks/purity
  const renderStart = __DEV__ ? Date.now() : 0;

  // Compute render-to-commit duration synchronously after commit.
  //
  // Batched-render detection: if renderStart < prevCommitTime, this render's
  // function ran before the previous cycle's effects finished — the duration
  // spans external work (other components, JS thread congestion).
  // Use the commit-to-commit gap as a more accurate proxy in that case.
  useLayoutEffect(() => {
    if (!__DEV__) return;

    const commitTime = Date.now();
    const prevCommitTime = lastCommitTimeRef.current;
    lastCommitTimeRef.current = commitTime;

    const duration = commitTime - renderStart;
    const wasBatched = prevCommitTime > 0 && renderStart < prevCommitTime;

    if (wasBatched) {
      renderDurationRef.current = commitTime - prevCommitTime;
    } else {
      renderDurationRef.current = duration;
    }
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

    Telemetry.increment('component_render_count', 1, {
      component: componentName,
    });

    Telemetry.histogram('component_render_duration_ms', renderDuration, {
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
