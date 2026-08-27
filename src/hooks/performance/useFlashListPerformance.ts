/**
 * FlashList Performance Instrumentation Hook
 *
 * Produces FlashList props for blank-cell detection, initial-load tracking,
 * frame-gap correlation, and predictive blank-risk assessment.
 *
 * A cell is blank when its index is inside the visible range but no cell is
 * committed for it. Committed cells are tracked by the `CellRendererComponent`
 * this hook returns — FlashList wraps every cell in it and passes `index`, so
 * the registry reflects what React has actually mounted. It is deliberately
 * NOT derived from `onViewableItemsChanged`: FlashList's viewability is
 * geometric (layout table against scroll offset, never whether a cell exists)
 * and gated by a 250 ms `minimumViewTime`, so "visible but not yet viewable"
 * was measuring scroll speed. The check runs after every commit that mounts,
 * moves or unmounts a cell and on every viewability change, deduplicated to
 * one recorded metric per animation frame.
 *
 * DEV: Full diagnostics via FlashListDiagnostics (ring buffers, frame gap
 * monitoring, predictive risk assessment, formatted console reports).
 *
 * PRODUCTION: Lightweight sampled metrics via Telemetry service:
 * - flashlist_initial_load_ms (histogram)
 * - flashlist_blank_cells_total (counter, incremented when a blank episode starts)
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
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';
import {
  DEFAULT_PERFORMANCE_CONFIG,
  type ScrollFrameMetric,
  type BlankRiskAssessment,
} from '#/services/performance/types';
import {
  createMountedCellRenderer,
  MountedCellRegistry,
  type MountedCellRenderer,
} from './mountedCellRenderer';

// Explicit histogram bounds for non-latency metrics. The transport default is
// in milliseconds, which collapses a 0-1 coverage ratio into one bucket and
// caps multi-minute sessions; these let histogram_quantile resolve real
// percentiles.
const COVERAGE_RATIO_BOUNDS = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
];
const SESSION_DURATION_BOUNDS = [
  1000, 5000, 10000, 30000, 60000, 120000, 300000,
];

interface UseFlashListPerformanceOptions {
  componentName: string;
  /** ms between periodic reports. 0 = manual only. Default: 10000 */
  reportInterval?: number;
  /**
   * Whether the list is presenting REAL data rather than chrome.
   *
   * Required, not optional, because getting it wrong is silent: FlashList's
   * `onLoad` fires as soon as every VISIBLE index has been measured, and a
   * skeleton state that hands the list one sticky-header sentinel satisfies
   * that immediately. `app_fully_drawn_ms` then latched on the skeleton frame
   * and reported the chrome, never the frame where items appeared — while its
   * contract row promised "real content on screen".
   *
   * A genuinely-resolved empty result IS content: false means "still waiting",
   * not "nothing to show".
   */
  hasRealContent: boolean;
  /**
   * Called once per mount, on the first FlashList layout commit that lands
   * while `hasRealContent` is true — i.e. the commit whose frame actually
   * shows content (or a settled empty state), not the sentinel/skeleton
   * layout. For a parent above this hook's owner that gates its own skeleton
   * overlay; the owner itself reads `hasContentLayout` instead.
   */
  onFirstContentLayout?: () => void;
}

interface UseFlashListPerformanceReturn {
  onLoad: (info: { elapsedTimeInMs: number }) => void;
  onViewableItemsChanged: (info: {
    viewableItems: ViewToken<unknown>[];
    changed: ViewToken<unknown>[];
  }) => void;
  /**
   * Pass as the FlashList's `onCommitLayoutEffect`. FlashList holds every cell
   * — the sticky sentinel included — at `opacity: 0` until its progressive
   * first layout commits (`ViewHolderCollection`'s `renderId` gate), and this
   * callback fires from exactly that commit, then again on every later stable
   * layout commit (including the first one after a data change). `onLoad`
   * cannot stand in for it: it latches once per mount, and a sentinel-only
   * skeleton layout consumes it before real data arrives.
   */
  onCommitLayoutEffect: () => void;
  /**
   * True from the first layout commit that lands while `hasRealContent` is
   * true — the earliest render in which the list's cells are actually
   * visible. Latched once per mount. Gate a skeleton overlay on this rather
   * than on the data being ready: between those two moments the list is
   * mounted but transparent, which on a mid-range device is a 300 ms+
   * header-only blank frame.
   */
  hasContentLayout: boolean;
  onDataReferenceChange: () => void;
  printReport: () => void;
  getBlankRisk: () => BlankRiskAssessment;
  /**
   * Pass as the FlashList's `CellRendererComponent`. It is how mounted cells
   * are tracked. `undefined` in sessions the per-cell instrumentation
   * sampling left unarmed (see `flashListInstrumentationSampleRate`) —
   * FlashList then uses its own plain-View cell container, and blank-state
   * evaluation is skipped for the session.
   */
  CellRendererComponent: MountedCellRenderer | undefined;
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

  // Production: a blank "episode" starts when a check first finds a blank and
  // ends at the next check that finds none. Counting episodes rather than
  // checks keeps the counter comparable now that commits trigger checks too.
  const inBlankEpisodeRef = useRef(false);

  // State, not a ref: the fully-drawn latch depends on BOTH this and
  // `hasRealContent`, and content usually arrives on a later commit than
  // layout. A ref would not re-run the effect when the second condition
  // becomes true.
  const [hasFinishedLayout, setHasFinishedLayout] = useState(false);

  // First layout commit with real content: state drives the owner's overlay,
  // the ref guards the callback (read only inside the commit callback, never
  // during render). One-shot per mount — FlashList warns that un-guarded
  // setState in `onCommitLayoutEffect` can loop.
  const [hasContentLayout, setHasContentLayout] = useState(false);
  const hasContentLayoutRef = useRef(false);
  const onCommitLayoutEffect = () => {
    if (hasContentLayoutRef.current || !options.hasRealContent) return;
    hasContentLayoutRef.current = true;
    setHasContentLayout(true);
    options.onFirstContentLayout?.();
  };

  // Per-SESSION sampling of the per-cell instrumentation: the cell wrapper is
  // a Reanimated `Animated.View` + a layout effect around EVERY cell, and on
  // the initial paint path that costs real mount time (~30-60 ms of a ~320 ms
  // first-layout window on device — perf-blank-window-2026-08-26.md). Decided
  // once at mount so the cell tree shape never flips mid-session. Unsampled
  // sessions hand FlashList `CellRendererComponent: undefined`, falling back
  // to its own plain-View cell container, and skip blank-state evaluation
  // (which would otherwise read every visible cell as blank). `onLoad`,
  // session duration, and the first-content-layout latch stay unsampled.
  const [instrumentCells] = useState(
    () =>
      Math.random() <
      DEFAULT_PERFORMANCE_CONFIG.flashListInstrumentationSampleRate,
  );

  // Which indices currently have a committed cell. Written only by the cell
  // renderer's layout effects, read only from event handlers and effects. The
  // renderer is created once; it reaches the current blank check through
  // `cellRegistry.onChange`, re-pointed in an effect below.
  const [cellRegistry] = useState(() => new MountedCellRegistry());
  const [CellRendererComponent] = useState(() =>
    instrumentCells ? createMountedCellRenderer(cellRegistry) : undefined,
  );

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

      // Shared: a coalesced blank check must not land after the list is gone.
      cellRegistry.dispose();

      // Production: report session duration on unmount
      const duration = performance.now() - sessionStart;
      Telemetry.histogram(
        'flashlist_session_duration_ms',
        duration,
        { component: options.componentName },
        SESSION_DURATION_BOUNDS,
      );
    };
  }, [
    cellRegistry,
    diagnostics,
    options.componentName,
    options.reportInterval,
    sessionStart,
  ]);

  // First meaningful paint: layout finished AND what was laid out is data.
  // Reported from here rather than from a screen so it works for whichever
  // list the launch lands on.
  //
  // Latched locally as well as in the service. `hasRealContent` legitimately
  // goes true -> false -> true (switching pantry tabs re-arms skeletons), and
  // leaning on `markFullyDrawn`'s own one-shot guard to absorb the repeats
  // would hide an ordering bug here behind a guard that exists for a different
  // reason. Written in an effect, never during render.
  const hasLatchedFullyDrawnRef = useRef(false);
  useEffect(() => {
    if (hasLatchedFullyDrawnRef.current) return;
    if (!hasFinishedLayout || !options.hasRealContent) return;
    hasLatchedFullyDrawnRef.current = true;
    NativePerformanceService.markFullyDrawn();
  }, [hasFinishedLayout, options.hasRealContent]);

  const onLoad = (info: { elapsedTimeInMs: number }) => {
    Telemetry.histogram('flashlist_initial_load_ms', info.elapsedTimeInMs, {
      component: options.componentName,
    });

    // Layout is complete; whether it laid out CONTENT is a separate question,
    // answered by the effect below. FlashList reports `onLoad` once every
    // visible index is measured, which one sentinel row satisfies while the
    // body is still skeletons.
    setHasFinishedLayout(true);

    if (__DEV__ && diagnostics) {
      diagnostics.recordOnLoad(info.elapsedTimeInMs);
      console.log(
        `📊 [FlashList:${options.componentName}] ${
          options.componentName
        } initial load: ${info.elapsedTimeInMs.toFixed(0)}ms`,
      );
    }
  };

  /**
   * Compare the visible index range against the committed cells. Called after
   * commits that change the registry and on viewability changes.
   */
  const evaluateBlankState = () => {
    // Without the cell renderer nothing registers mounts, so every visible
    // index would read as blank — the check is only meaningful when sampled.
    if (!instrumentCells) return;
    const list = flashListRef.current;
    // Guarded as a function: test doubles of FlashList expose a bare instance.
    if (!list || typeof list.computeVisibleIndices !== 'function') return;
    const visibleIndices = list.computeVisibleIndices();
    if (!visibleIndices) return;

    const { startIndex, endIndex } = visibleIndices;
    const expectedCount = endIndex - startIndex + 1;
    if (expectedCount <= 0) return;
    const mountedCount = cellRegistry.countMountedInRange(startIndex, endIndex);
    const blankDetected = mountedCount < expectedCount;

    // Production: report the start of each blank episode
    if (blankDetected && !inBlankEpisodeRef.current) {
      Telemetry.increment('flashlist_blank_cells_total', 1, {
        component: options.componentName,
      });
    }
    inBlankEpisodeRef.current = blankDetected;

    // Production: throttled coverage ratio reporting
    const now = performance.now();
    if (now - lastCoverageReportRef.current > COVERAGE_REPORT_INTERVAL) {
      lastCoverageReportRef.current = now;
      Telemetry.histogram(
        'flashlist_scroll_coverage_ratio',
        mountedCount / expectedCount,
        { component: options.componentName },
        COVERAGE_RATIO_BOUNDS,
      );
    }

    // DEV: rAF-deduplicated diagnostics — only record one metric per animation
    // frame (last check wins). Still needed even though the registry now
    // coalesces its own flushes: `onViewableItemsChanged` calls this evaluation
    // directly rather than through the registry, so one frame can still carry a
    // viewability call and a registry flush.
    if (__DEV__ && diagnostics) {
      const frameGap = diagnostics.getLastFrameGap();
      const coverageRatio = mountedCount / expectedCount;
      const scrollVelocity = diagnostics.computeScrollVelocity(startIndex, now);

      // Store as pending — only the last check per frame gets recorded
      pendingMetricRef.current = {
        timestamp: now,
        visibleStart: startIndex,
        visibleEnd: endIndex,
        mountedCount,
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
              if (!wasBlankRef.current || pending.mountedCount === 0) {
                console.log(
                  `📊 [FlashList:${options.componentName}] Blank: mounted=${
                    pending.mountedCount
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

  // Re-pointed every render so the once-created renderer calls the closure
  // that sees this render's values.
  useEffect(() => {
    cellRegistry.setOnChange(evaluateBlankState);
  });

  const onViewableItemsChanged = () => {
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

    evaluateBlankState();
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
    onCommitLayoutEffect,
    hasContentLayout,
    onDataReferenceChange,
    printReport,
    getBlankRisk,
    CellRendererComponent,
  };
}
