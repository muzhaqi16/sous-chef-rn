import { useEffect, useRef } from 'react';
import { Telemetry } from '#/services/telemetry';
import { DEFAULT_PERFORMANCE_CONFIG } from '#/services/performance';

/**
 * Hook to track component render time and count
 *
 * Measures render duration and reports metrics to telemetry system.
 * Uses sampling to minimize performance overhead.
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
  const renderStartTime = useRef<number>(performance.now());
  const renderCount = useRef<number>(0);
  const totalRenderTime = useRef<number>(0);
  const enabled = options?.enabled ?? DEFAULT_PERFORMANCE_CONFIG.enabled;
  const sampleRate = options?.sampleRate ?? DEFAULT_PERFORMANCE_CONFIG.sampleRate;
  const slowThreshold = options?.slowThreshold ?? DEFAULT_PERFORMANCE_CONFIG.slowRenderThreshold;

  // Skip if disabled
  if (!enabled) {
    return;
  }

  // Increment render count
  renderCount.current += 1;

  // Apply sampling - only track a percentage of renders
  const shouldTrack = Math.random() < sampleRate;
  if (!shouldTrack && renderCount.current > 1) {
    // Always track first render, then apply sampling
    return;
  }

  // Measure render time after paint
  useEffect(() => {
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

    // Track slow renders
    if (renderDuration > slowThreshold) {
      Telemetry.increment('slow_component_renders_total', 1, {
        component: componentName,
        duration: renderDuration.toFixed(2),
      });

      if (__DEV__) {
        console.warn(
          `[Performance] Slow render detected: ${componentName} took ${renderDuration.toFixed(2)}ms`,
        );
      }
    }

    // Log render metrics in dev
    if (__DEV__ && renderCount.current === 1) {
      console.log(
        `[Performance] ${componentName} first render: ${renderDuration.toFixed(2)}ms`,
      );
    }

    // Reset start time for next render
    renderStartTime.current = performance.now();
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
