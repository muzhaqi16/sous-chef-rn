import { useEffect, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance/types';
import { usePerformanceStore } from '#/store/performanceStore';

/**
 * Maximum valid render duration in ms. Any measurement above this is treated
 * as contaminated (e.g. tree-batching overhead, app backgrounded, hot reload)
 * and discarded. Individual component renders should not exceed 1 second even
 * in dev mode — the render-to-commit gap includes other components' work
 * during batched updates, inflating the measurement.
 */
const MAX_VALID_RENDER_MS = 1000;

/**
 * Tracks the last wall-clock time the app left the foreground.
 * Module-level subscription — runs once at import, lives for the process.
 */
let lastBackgroundedAt = 0;

AppState.addEventListener('change', nextAppState => {
  if (nextAppState !== 'active') {
    lastBackgroundedAt = Date.now();
  }
});

/** @internal Test-only: reset module-level background tracking state */
export function _resetForTesting() {
  lastBackgroundedAt = 0;
}

/** @internal Test-only: simulate app going to background at a given timestamp */
export function _simulateBackground(timestamp: number) {
  lastBackgroundedAt = timestamp;
}

/**
 * Tracks how often a component commits, and how much wall time elapsed since
 * its previous commit.
 *
 * This is NOT render cost. `useLayoutEffect` captures `Date.now()` per commit
 * and reports the gap to the previous one, so the value is dominated by idle
 * time between commits. React's `<Profiler onRender>` would give true
 * `actualDuration`, but `ReactFabric-prod.js` strips `onRender` entirely, so it
 * cannot report from a release build — hence the commit-gap approach, named for
 * what it actually measures.
 *
 * The useful signal here is `component_render_count`: a component committing
 * many times without user input is churning. Reports in production as well as
 * dev, gated by `enabled` and `sampleRate`; console output stays dev-only.
 *
 * @param componentName - Name of the component being tracked
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   useCommitTracking('MyComponent');
 *   return <View>...</View>;
 * }
 * ```
 */
export function useCommitTracking(
  componentName: string,
  options?: {
    enabled?: boolean;
    sampleRate?: number;
  },
) {
  const renderDurationRef = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const totalRenderTime = useRef<number>(0);
  const lastCommitTimeRef = useRef<number>(0);

  const enabled = options?.enabled ?? DEFAULT_PERFORMANCE_CONFIG.enabled;
  const sampleRate =
    options?.sampleRate ?? DEFAULT_PERFORMANCE_CONFIG.sampleRate;

  // Measure commit-to-commit duration synchronously after commit.
  // All timing captured inside useLayoutEffect — no impure calls during render.
  useLayoutEffect(() => {
    const commitTime = Date.now();
    const prevCommitTime = lastCommitTimeRef.current;
    lastCommitTimeRef.current = commitTime;

    // First commit — establish baseline, no duration to measure yet
    if (prevCommitTime === 0) {
      renderDurationRef.current = -1;
      return;
    }

    const duration = commitTime - prevCommitTime;

    // Discard if app went to background between commits or duration
    // exceeds the safety cap (likely includes background/idle time).
    const wasBackgrounded = lastBackgroundedAt >= prevCommitTime;
    if (wasBackgrounded || duration > MAX_VALID_RENDER_MS) {
      renderDurationRef.current = -1;
      if (__DEV__) {
        console.debug(
          `[Performance] ${componentName} render discarded: ${
            wasBackgrounded
              ? 'app backgrounded'
              : `exceeded ${MAX_VALID_RENDER_MS}ms cap (${duration}ms)`
          }`,
        );
      }
    } else {
      renderDurationRef.current = duration;
      renderCount.current += 1;
    }
  });

  // Report metrics after paint.
  // Intentionally omitting deps — this effect must run after every render to capture timing.
  useEffect(() => {
    // Skip discarded renders (first render, backgrounded, or exceeded max duration cap)
    if (renderDurationRef.current < 0) return;

    // Skip if disabled
    if (!enabled) {
      return;
    }

    // Apply sampling decision inside effect to avoid impure Math.random() during render
    const shouldTrack = Math.random() < sampleRate;

    // Skip if not tracking this render (except first measured render)
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

    Telemetry.histogram('component_commit_gap_ms', renderDuration, {
      component: componentName,
    });

    // Record metrics in performance store for dashboard (isolated from main store)
    usePerformanceStore
      .getState()
      .recordComponentRender(componentName, renderDuration);

    if (!__DEV__) {
      return;
    }

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
