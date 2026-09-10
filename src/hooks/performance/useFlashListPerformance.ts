/**
 * FlashList instrumentation: blank cells, initial load, frame gaps, blank risk.
 * A cell is blank when its index is visible with no cell committed for it,
 * measured from the `CellRendererComponent` registry — NOT `onViewableItemsChanged`,
 * whose geometric 250 ms-gated viewability measures scroll speed instead.
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
  PlainAnimatedCellRenderer,
  MountedCellRegistry,
  type MountedCellRenderer,
} from './mountedCellRenderer';

// Explicit bounds for non-latency metrics: the transport default is in ms,
// which collapses a 0-1 ratio into one bucket and caps long sessions.
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
   * Whether the list presents REAL data rather than chrome. REQUIRED because
   * getting it wrong is silent: one sticky-header sentinel satisfies `onLoad`,
   * so `app_fully_drawn_ms` would latch on the skeleton frame. A resolved EMPTY
   * result IS content — false means "still waiting", not "nothing to show".
   */
  hasRealContent: boolean;
  /**
   * How many rows the list is being handed. A settled EMPTY list has no cell to
   * wait for, and FlashList commits its layout once for data that goes empty to
   * empty — a commit that lands while `hasRealContent` is still false and is
   * discarded. Without the count, such a list never reports a content layout.
   */
  rowCount: number;
  /**
   * Fires on the first layout commit landing while `hasRealContent` is true —
   * the frame that actually shows content, not the sentinel layout. For a parent
   * gating its own overlay; the owner reads `hasContentLayout` instead.
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
   * The FlashList's `onCommitLayoutEffect`. Every cell is held at `opacity: 0`
   * until the progressive first layout commits, and this fires from exactly that
   * commit. `onLoad` cannot stand in: it latches once per mount, and a
   * sentinel-only skeleton layout consumes it before real data arrives.
   */
  onCommitLayoutEffect: () => void;
  /**
   * The earliest render in which the list's cells are actually visible. Gate a
   * skeleton overlay on THIS, never on data-ready: between the two the list is
   * mounted but transparent — a 300 ms+ blank frame on a mid-range device.
   */
  hasContentLayout: boolean;
  onDataReferenceChange: () => void;
  printReport: () => void;
  getBlankRisk: () => BlankRiskAssessment;
  /**
   * The FlashList's `CellRendererComponent`. Always set; in an unsampled session
   * it wraps cells without registering them and blank evaluation is skipped.
   */
  CellRendererComponent: MountedCellRenderer;
}

const noopRisk: BlankRiskAssessment = {
  level: 'none',
  factors: [],
  coverageRatio: 1,
  scrollVelocity: 0,
};

const COVERAGE_REPORT_INTERVAL = 2000;

// Per-cell instrumentation sampling, decided ONCE per session — module scope is
// what makes it per-session, so a remount cannot re-roll it.
let cellInstrumentationDecision: boolean | undefined;
const shouldInstrumentCellsThisSession = (): boolean => {
  cellInstrumentationDecision ??=
    Math.random() <
    DEFAULT_PERFORMANCE_CONFIG.flashListInstrumentationSampleRate;
  return cellInstrumentationDecision;
};

export function useFlashListPerformance<T>(
  flashListRef: React.RefObject<FlashListRef<T> | null>,
  options: UseFlashListPerformanceOptions,
): UseFlashListPerformanceReturn {
  const frameGapStarted = useRef(false);
  const idleHandle = useRef<number | null>(null);
  const intervalHandle = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingMetricRef = useRef<ScrollFrameMetric | null>(null);
  const dedupeRAFRef = useRef<number | null>(null);

  const wasBlankRef = useRef(false);
  const streakCountRef = useRef(0);

  // An EPISODE, not a check: commits trigger checks too, so counting checks
  // would not be comparable over time.
  const inBlankEpisodeRef = useRef(false);

  // State, not a ref: the fully-drawn latch depends on BOTH this and
  // `hasRealContent`, and content usually arrives on a later commit than layout.
  const [hasFinishedLayout, setHasFinishedLayout] = useState(false);

  // A CYCLE NUMBER, not a boolean: `hasRealContent` legitimately goes
  // true -> false -> true (a tab switch re-arms skeletons), and a one-shot latch
  // collapses `hasContentLayout` to the data flag, re-exposing the 300 ms+ blank
  // frame. Advanced during RENDER — an effect would be a synchronous setState,
  // and a render-time ref write bails out the compiler. `markFullyDrawn` keeps
  // its own one-shot latch; the startup metric must NOT re-arm.
  const [contentCycle, setContentCycle] = useState(0);
  const [laidOutCycle, setLaidOutCycle] = useState(-1);
  const [hadRealContent, setHadRealContent] = useState(options.hasRealContent);
  if (hadRealContent !== options.hasRealContent) {
    setHadRealContent(options.hasRealContent);
    if (!options.hasRealContent) setContentCycle(cycle => cycle + 1);
  }
  // The empty clause is not an optimization: it is the only path for a list
  // FlashList commits exactly once, before content is ready.
  const hasContentLayout =
    laidOutCycle === contentCycle ||
    (options.hasRealContent && options.rowCount === 0);

  // Guards against the callback firing twice within one cycle before a
  // re-render is observed: un-guarded setState in `onCommitLayoutEffect` can
  // loop. Read and written ONLY inside the callback, never during render.
  const firedForCycleRef = useRef(-1);
  const onCommitLayoutEffect = () => {
    if (!options.hasRealContent) return;
    if (firedForCycleRef.current === contentCycle) return;
    firedForCycleRef.current = contentCycle;
    setLaidOutCycle(contentCycle);
    options.onFirstContentLayout?.();
  };

  // Per-SESSION, never per-instance: the layout effect costs ~30-60 ms of the
  // ~320 ms first-layout window, and re-rolling on remount would report one list
  // inconsistently and make `sum(...) by (screen)` meaningless.
  const instrumentCells = shouldInstrumentCellsThisSession();

  // Written only by the cell renderer's layout effects, read only from handlers
  // and effects; the once-created renderer reaches the current check through
  // `cellRegistry.onChange`, re-pointed in an effect below.
  const [cellRegistry] = useState(() => new MountedCellRegistry());
  // ALWAYS a renderer — the `Animated.View` both wrap the cell in is what keeps
  // Reanimated cell layout animations working; only the registry is sampled.
  const [CellRendererComponent] = useState(() =>
    instrumentCells
      ? createMountedCellRenderer(cellRegistry)
      : PlainAnimatedCellRenderer,
  );

  const [diagnostics] = useState(() =>
    __DEV__ ? new FlashListDiagnostics(options.componentName) : null,
  );

  const [sessionStart] = useState(() => performance.now());
  const lastCoverageReportRef = useRef(0);

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

  // First meaningful paint: layout finished AND what was laid out is data. Here
  // rather than in a screen, so it works for whichever list the launch lands on.
  // Latched locally as well as in the service — leaning on `markFullyDrawn`'s
  // own guard would hide an ordering bug here behind one that exists for another
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

    // Layout is complete; whether it laid out CONTENT is a separate question —
    // one sentinel row satisfies `onLoad` while the body is still skeletons.
    setHasFinishedLayout(true);

    if (__DEV__ && diagnostics) {
      diagnostics.recordOnLoad(info.elapsedTimeInMs);
      console.debug(
        `📊 [FlashList:${options.componentName}] ${
          options.componentName
        } initial load: ${info.elapsedTimeInMs.toFixed(0)}ms`,
      );
    }
  };

  /** Visible index range vs committed cells; run on commits and viewability. */
  const evaluateBlankState = () => {
    // Unsampled, nothing registers mounts, so every index would read blank.
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

    if (blankDetected && !inBlankEpisodeRef.current) {
      Telemetry.increment('flashlist_blank_cells_total', 1, {
        component: options.componentName,
      });
    }
    inBlankEpisodeRef.current = blankDetected;

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

    // rAF-deduplicated, last check per frame wins. Still needed despite the
    // registry's own coalescing: `onViewableItemsChanged` calls this directly,
    // so one frame can carry both a viewability call and a registry flush.
    if (__DEV__ && diagnostics) {
      const frameGap = diagnostics.getLastFrameGap();
      const coverageRatio = mountedCount / expectedCount;
      const scrollVelocity = diagnostics.computeScrollVelocity(startIndex, now);

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

            // Streak start, complete blanks and streak end only.
            if (pending.blankDetected) {
              streakCountRef.current += 1;
              if (!wasBlankRef.current || pending.mountedCount === 0) {
                console.debug(
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
                console.debug(
                  `📊 [FlashList:${options.componentName}] Blank streak ended after ${streakCountRef.current} frames`,
                );
              }
              streakCountRef.current = 0;
              wasBlankRef.current = false;

              const risk = diagnostics.assessBlankRisk();
              if (risk.level === 'medium') {
                console.debug(
                  `⚠️ [FlashList:${
                    options.componentName
                  }] Blank risk MEDIUM: ${risk.factors.join(
                    ', ',
                  )} (coverage=${risk.coverageRatio.toFixed(
                    2,
                  )}, velocity=${risk.scrollVelocity.toFixed(0)} items/s)`,
                );
              } else if (risk.level === 'high') {
                console.debug(
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
