/**
 * FlashList Performance Instrumentation Hook
 *
 * Produces FlashList callback props for blank cell detection, initial load
 * tracking, frame gap correlation, and predictive blank risk assessment.
 *
 * DEV: Full diagnostics via FlashListDiagnostics (ring buffers, frame gap
 * monitoring, predictive risk assessment, formatted console reports).
 *
 * PRODUCTION: Lightweight sampled metrics via Telemetry service:
 * - flashlist_initial_load_ms (histogram)
 * - flashlist_blank_cells_total (counter, incremented per detection)
 * - flashlist_scroll_coverage_ratio (histogram, throttled to 1 report/2s)
 * - flashlist_data_reference_changes (counter)
 * - flashlist_session_duration_ms (histogram, reported on unmount)
 *
 * No try-catch in hook body (React Compiler safe).
 */
import { useEffect, useRef, useState } from 'react';
import type { FlashListRef } from '@shopify/flash-list';
import type ViewToken from '@shopify/flash-list/dist/recyclerview/viewability/ViewToken';
import { FlashListDiagnostics } from '#/services/performance/FlashListDiagnostics';
import { Telemetry } from '#/services/telemetry';
import type {
  ScrollFrameMetric,
  BlankRiskAssessment,
} from '#/services/performance/types';

interface UseFlashListPerformanceOptions {
  componentName: string;
  /** ms between periodic reports. 0 = manual only. Default: 10000 */
  reportInterval?: number;
}

interface UseFlashListPerformanceReturn {
  onLoad: (info: { elapsedTimeInMs: number }) => void;
  onViewableItemsChanged: (info: {
    viewableItems: ViewToken<unknown>[];
    changed: ViewToken<unknown>[];
  }) => void;
  onDataReferenceChange: () => void;
  printReport: () => void;
  getBlankRisk: () => BlankRiskAssessment;
}

const noopRisk: BlankRiskAssessment = {
  level: 'none',
  factors: [],
  coverageRatio: 1,
  scrollVelocity: 0,
};

// Throttle interval for coverage ratio reporting (ms)
const COVERAGE_REPORT_INTERVAL = 2000;

export function useFlashListPerformance<T>(
  flashListRef: React.RefObject<FlashListRef<T> | null>,
  options: UseFlashListPerformanceOptions,
): UseFlashListPerformanceReturn {
  // DEV-only refs for frame gap monitoring
  const frameGapStarted = useRef(false);
  const idleHandle = useRef<number | null>(null);
  const intervalHandle = useRef<ReturnType<typeof setInterval> | null>(null);

  // DEV: rAF deduplication — only record one metric per animation frame
  const pendingMetricRef = useRef<ScrollFrameMetric | null>(null);
  const dedupeRAFRef = useRef<number | null>(null);

  // DEV: streak-based logging — log only streak start/end, not every blank frame
  const wasBlankRef = useRef(false);
  const streakCountRef = useRef(0);

  // DEV-only diagnostics instance
  const [diagnostics] = useState(() =>
    __DEV__ ? new FlashListDiagnostics(options.componentName) : null,
  );

  // Production metrics: session timing
  const [sessionStart] = useState(() => performance.now());
  const lastCoverageReportRef = useRef(0);

  // DEV: start diagnostics session + periodic reports
  // PROD: cleanup reports session metrics on unmount
  useEffect(() => {
    if (__DEV__ && diagnostics) {
      diagnostics.startSession();

      const reportMs = options.reportInterval ?? 10000;
      if (reportMs > 0) {
        intervalHandle.current = setInterval(() => {
          diagnostics.printReport();
        }, reportMs);
      }
    }

    return () => {
      // DEV cleanup
      if (__DEV__) {
        if (intervalHandle.current !== null) {
          clearInterval(intervalHandle.current);
          intervalHandle.current = null;
        }
        if (idleHandle.current !== null) {
          cancelIdleCallback(idleHandle.current);
          idleHandle.current = null;
        }
        if (dedupeRAFRef.current !== null) {
          cancelAnimationFrame(dedupeRAFRef.current);
          dedupeRAFRef.current = null;
        }
        diagnostics?.endSession();
        frameGapStarted.current = false;
      }

      // Production: report session duration on unmount
      const duration = performance.now() - sessionStart;
      Telemetry.histogram('flashlist_session_duration_ms', duration, {
        component: options.componentName,
      });
    };
  }, [
    diagnostics,
    options.componentName,
    options.reportInterval,
    sessionStart,
  ]);

  const onLoad = (info: { elapsedTimeInMs: number }) => {
    Telemetry.histogram('flashlist_initial_load_ms', info.elapsedTimeInMs, {
      component: options.componentName,
    });

    if (__DEV__ && diagnostics) {
      diagnostics.recordOnLoad(info.elapsedTimeInMs);
      console.log(
        `📊 [FlashList:${options.componentName}] ${
          options.componentName
        } initial load: ${info.elapsedTimeInMs.toFixed(0)}ms`,
      );
    }
  };

  const onViewableItemsChanged = (info: {
    viewableItems: ViewToken<unknown>[];
    changed: ViewToken<unknown>[];
  }) => {
    // DEV: diagnostics tracking + frame gap monitoring
    if (__DEV__ && diagnostics) {
      diagnostics.recordViewabilityChange();

      if (!frameGapStarted.current) {
        frameGapStarted.current = true;
        diagnostics.startFrameGapMonitor();
      }

      if (idleHandle.current !== null) {
        cancelIdleCallback(idleHandle.current);
        idleHandle.current = null;
      }

      idleHandle.current = requestIdleCallback(
        () => {
          diagnostics.stopFrameGapMonitor();
          frameGapStarted.current = false;
          idleHandle.current = null;
        },
        { timeout: 2000 },
      );
    }

    // Blank detection — shared between DEV and production
    const visibleIndices = flashListRef.current?.computeVisibleIndices();
    if (!visibleIndices) return;

    const { startIndex, endIndex } = visibleIndices;
    const expectedCount = endIndex - startIndex + 1;
    const viewableCount = info.viewableItems.length;
    const blankDetected = viewableCount < expectedCount;

    // Production: report each blank detection immediately
    if (blankDetected) {
      Telemetry.increment('flashlist_blank_cells_total', 1, {
        component: options.componentName,
      });
    }

    // Production: throttled coverage ratio reporting
    const now = performance.now();
    if (now - lastCoverageReportRef.current > COVERAGE_REPORT_INTERVAL) {
      lastCoverageReportRef.current = now;
      const coverageRatio =
        expectedCount > 0 ? viewableCount / expectedCount : 1;
      Telemetry.histogram('flashlist_scroll_coverage_ratio', coverageRatio, {
        component: options.componentName,
      });
    }

    // DEV: rAF-deduplicated diagnostics — only record one metric per animation
    // frame (last callback wins). This prevents intra-frame viewability updates
    // from inflating totalScrollFrames and sustained blank counts, and reduces
    // console.log overhead that degrades FlashList recycling speed.
    if (__DEV__ && diagnostics) {
      const frameGap = diagnostics.getLastFrameGap();
      const coverageRatio =
        expectedCount > 0 ? viewableCount / expectedCount : 1;
      const scrollVelocity = diagnostics.computeScrollVelocity(startIndex, now);

      // Store as pending — only the last callback per frame gets recorded
      pendingMetricRef.current = {
        timestamp: now,
        visibleStart: startIndex,
        visibleEnd: endIndex,
        viewableCount,
        expectedCount,
        blankDetected,
        frameGap,
        coverageRatio,
        scrollVelocity,
      };

      if (dedupeRAFRef.current === null) {
        dedupeRAFRef.current = requestAnimationFrame(() => {
          const pending = pendingMetricRef.current;
          if (pending && diagnostics) {
            diagnostics.recordScrollFrame(pending);

            // Streak-based logging: only log streak start, complete blanks, and streak end
            if (pending.blankDetected) {
              streakCountRef.current += 1;
              if (!wasBlankRef.current || pending.viewableCount === 0) {
                console.log(
                  `📊 [FlashList:${options.componentName}] Blank: viewable=${
                    pending.viewableCount
                  }/${pending.expectedCount} visible=[${pending.visibleStart},${
                    pending.visibleEnd
                  }] gap=${pending.frameGap.toFixed(0)}ms`,
                );
              }
              wasBlankRef.current = true;
            } else {
              if (wasBlankRef.current && streakCountRef.current > 1) {
                console.log(
                  `📊 [FlashList:${options.componentName}] Blank streak ended after ${streakCountRef.current} frames`,
                );
              }
              streakCountRef.current = 0;
              wasBlankRef.current = false;

              // Risk assessment only on non-blank frames (same as before)
              const risk = diagnostics.assessBlankRisk();
              if (risk.level === 'medium') {
                console.log(
                  `⚠️ [FlashList:${
                    options.componentName
                  }] Blank risk MEDIUM: ${risk.factors.join(
                    ', ',
                  )} (coverage=${risk.coverageRatio.toFixed(
                    2,
                  )}, velocity=${risk.scrollVelocity.toFixed(0)} items/s)`,
                );
              } else if (risk.level === 'high') {
                console.log(
                  `🚨 [FlashList:${
                    options.componentName
                  }] Blank risk HIGH: ${risk.factors.join(
                    ', ',
                  )} (coverage=${risk.coverageRatio.toFixed(
                    2,
                  )}, velocity=${risk.scrollVelocity.toFixed(0)} items/s)`,
                );
              }
            }
          }
          pendingMetricRef.current = null;
          dedupeRAFRef.current = null;
        });
      }
    }
  };

  const onDataReferenceChange = () => {
    Telemetry.increment('flashlist_data_reference_changes', 1, {
      component: options.componentName,
    });

    if (__DEV__) {
      diagnostics?.recordDataReferenceChange();
    }
  };

  const printReport = () => {
    if (__DEV__) {
      diagnostics?.printReport();
    }
  };

  const getBlankRisk = () => {
    if (__DEV__ && diagnostics) {
      return diagnostics.assessBlankRisk();
    }
    return noopRisk;
  };

  return {
    onLoad,
    onViewableItemsChanged,
    onDataReferenceChange,
    printReport,
    getBlankRisk,
  };
}
