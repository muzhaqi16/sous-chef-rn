import { useEffect, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance/types';
import { usePerformanceStore } from '#/store/performanceStore';

/**
 * Above this, a measurement is contaminated (batching overhead, backgrounding,
 * hot reload) and discarded — no single component render takes a second.
 */
const MAX_VALID_RENDER_MS = 1000;

/** Last time the app left the foreground; the subscription lives for the process. */
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
 * Commit COUNT and the wall-clock gap between commits — NOT render cost, hence
 * the name. `<Profiler onRender>` would give true `actualDuration`, but
 * `ReactFabric-prod.js` strips it from release builds. The useful signal is
 * `component_render_count`: many commits with no user input means churn.
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

  // All timing inside the layout effect — no impure calls during render.
  useLayoutEffect(() => {
    const commitTime = Date.now();
    const prevCommitTime = lastCommitTimeRef.current;
    lastCommitTimeRef.current = commitTime;

    // First commit: a baseline, with no gap to measure yet.
    if (prevCommitTime === 0) {
      renderDurationRef.current = -1;
      return;
    }

    const duration = commitTime - prevCommitTime;

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

  // No deps on purpose: this must run after EVERY render to capture timing.
  useEffect(() => {
    if (renderDurationRef.current < 0) return;

    if (!enabled) {
      return;
    }

    // Sampled in the effect, so `Math.random()` never runs during render.
    const shouldTrack = Math.random() < sampleRate;

    // The first measured render always reports.
    if (!shouldTrack && renderCount.current > 1) {
      return;
    }

    const renderDuration = renderDurationRef.current;

    totalRenderTime.current += renderDuration;
    const avgRenderTime = totalRenderTime.current / renderCount.current;

    Telemetry.increment('component_render_count', 1, {
      component: componentName,
    });

    Telemetry.histogram('component_commit_gap_ms', renderDuration, {
      component: componentName,
    });

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
      console.log(
        `[Performance] ${componentName} render #${
          renderCount.current
        }: ${renderDuration.toFixed(2)}ms (avg: ${avgRenderTime.toFixed(2)}ms)`,
      );
    }
  });
}
