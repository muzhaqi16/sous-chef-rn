/**
 * FlashList Performance Instrumentation Hook
 *
 * Produces FlashList callback props for blank cell detection, initial load
 * tracking, frame gap correlation, and predictive blank risk assessment.
 * Creates an instance-based FlashListDiagnostics per list.
 *
 * Entirely a no-op when !__DEV__ (early return with stub callbacks).
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
const noop = () => {};
const STUB_RETURN: UseFlashListPerformanceReturn = {
  onLoad: noop,
  onViewableItemsChanged: noop,
  onDataReferenceChange: noop,
  printReport: noop,
  getBlankRisk: () => noopRisk,
};

export function useFlashListPerformance<T>(
  flashListRef: React.RefObject<FlashListRef<T> | null>,
  options: UseFlashListPerformanceOptions,
): UseFlashListPerformanceReturn {
  const frameGapStarted = useRef(false);
  const idleHandle = useRef<number | null>(null);
  const intervalHandle = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable instance per hook mount — useState initializer only runs once
  const [diagnostics] = useState(
    () => new FlashListDiagnostics(options.componentName),
  );

  useEffect(() => {
    if (!__DEV__) return;

    diagnostics.startSession();

    const reportMs = options.reportInterval ?? 10000;
    if (reportMs > 0) {
      intervalHandle.current = setInterval(() => {
        diagnostics.printReport();
      }, reportMs);
    }

    return () => {
      if (intervalHandle.current !== null) {
        clearInterval(intervalHandle.current);
        intervalHandle.current = null;
      }
      if (idleHandle.current !== null) {
        cancelIdleCallback(idleHandle.current);
        idleHandle.current = null;
      }
      diagnostics.endSession();
      frameGapStarted.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!__DEV__) return STUB_RETURN;

  const onLoad = (info: { elapsedTimeInMs: number }) => {
    diagnostics.recordOnLoad(info.elapsedTimeInMs);
    Telemetry.histogram('flashlist_initial_load_ms', info.elapsedTimeInMs, {
      component: options.componentName,
    });
    console.log(
      `📊 [FlashList:${options.componentName}] ${options.componentName} initial load: ${info.elapsedTimeInMs.toFixed(0)}ms`,
    );
  };

  const onViewableItemsChanged = (info: {
    viewableItems: ViewToken<unknown>[];
    changed: ViewToken<unknown>[];
  }) => {
    diagnostics.recordViewabilityChange();

    // Start frame gap monitor on first viewability change (scroll start proxy)
    if (!frameGapStarted.current) {
      frameGapStarted.current = true;
      diagnostics.startFrameGapMonitor();
    }

    // Cancel any pending idle stop — we're still scrolling
    if (idleHandle.current !== null) {
      cancelIdleCallback(idleHandle.current);
      idleHandle.current = null;
    }

    // Stop frame gap monitor after 2s of inactivity
    idleHandle.current = requestIdleCallback(
      () => {
        diagnostics.stopFrameGapMonitor();
        frameGapStarted.current = false;
        idleHandle.current = null;
      },
      { timeout: 2000 },
    );

    // Blank detection: compare computeVisibleIndices vs viewable items
    const visibleIndices = flashListRef.current?.computeVisibleIndices();
    if (!visibleIndices) return;

    const { startIndex, endIndex } = visibleIndices;
    const expectedCount = endIndex - startIndex + 1;
    const viewableCount = info.viewableItems.length;
    const blankDetected = viewableCount < expectedCount;
    const frameGap = diagnostics.getLastFrameGap();

    // Compute predictive metrics
    const now = performance.now();
    const coverageRatio = expectedCount > 0 ? viewableCount / expectedCount : 1;
    const scrollVelocity = diagnostics.computeScrollVelocity(startIndex, now);

    const metric: ScrollFrameMetric = {
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

    diagnostics.recordScrollFrame(metric);

    if (blankDetected) {
      console.log(
        `📊 [FlashList:${options.componentName}] Blank detected: viewable=${viewableCount}/${expectedCount} visible=[${startIndex},${endIndex}] gap=${frameGap.toFixed(0)}ms`,
      );
    }

    // Predictive assessment runs on EVERY frame so predictiveWarnings count
    // reflects true risk state. Only log for non-blank frames (blanks have
    // their own log above — avoid double-logging).
    const risk = diagnostics.assessBlankRisk();
    if (!blankDetected) {
      if (risk.level === 'medium') {
        console.log(
          `⚠️ [FlashList:${options.componentName}] Blank risk MEDIUM: ${risk.factors.join(', ')} (coverage=${risk.coverageRatio.toFixed(2)}, velocity=${risk.scrollVelocity.toFixed(0)} items/s)`,
        );
      } else if (risk.level === 'high') {
        console.log(
          `🚨 [FlashList:${options.componentName}] Blank risk HIGH: ${risk.factors.join(', ')} (coverage=${risk.coverageRatio.toFixed(2)}, velocity=${risk.scrollVelocity.toFixed(0)} items/s)`,
        );
      }
    }
  };

  const onDataReferenceChange = () => {
    diagnostics.recordDataReferenceChange();
  };

  const printReport = () => {
    diagnostics.printReport();
  };

  const getBlankRisk = () => diagnostics.assessBlankRisk();

  return {
    onLoad,
    onViewableItemsChanged,
    onDataReferenceChange,
    printReport,
    getBlankRisk,
  };
}
