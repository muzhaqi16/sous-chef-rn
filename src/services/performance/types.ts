/**
 * Performance Monitoring Types
 *
 * Type definitions for performance metrics, memory monitoring, and render tracking.
 */

/**
 * Render metrics for a component
 */
export interface RenderMetrics {
  /** Component name or identifier */
  componentName: string;
  /** Total number of renders */
  renderCount: number;
  /** Duration of the last render in milliseconds */
  lastRenderTime: number;
  /** Average render duration in milliseconds */
  avgRenderTime: number;
  /** Maximum render duration recorded in milliseconds */
  maxRenderTime: number;
  /** Total time spent rendering (sum of all renders) */
  totalRenderTime: number;
  /** Timestamp of last render */
  lastRenderTimestamp: number;
}

/**
 * Screen transition metrics
 */
export interface ScreenMetrics {
  /** Screen name */
  screenName: string;
  /** Number of times screen was visited */
  transitionCount: number;
  /** Last mount time in milliseconds */
  lastMountTime: number;
  /** Last interactive time in milliseconds */
  lastInteractiveTime: number;
  /** Average time to mount in milliseconds */
  avgMountTime: number;
  /** Average time to interactive in milliseconds */
  avgInteractiveTime: number;
  /** Maximum mount time recorded */
  maxMountTime: number;
  /** Maximum interactive time recorded */
  maxInteractiveTime: number;
  /** Total mount time (for calculating average) */
  totalMountTime: number;
  /** Total interactive time (for calculating average) */
  totalInteractiveTime: number;
  /** Timestamp of last transition */
  lastTransitionTimestamp: number;
}

/**
 * Memory snapshot at a point in time
 */
export interface MemorySnapshot {
  /** Timestamp of the snapshot */
  timestamp: number;
  /** Memory used in bytes */
  usedBytes: number;
  /** Memory limit in bytes (if available) */
  limitBytes?: number;
  /** Memory usage percentage (0-100) */
  usagePercent: number;
  /** Context or trigger for this snapshot */
  context?: string;
}

/**
 * Performance configuration options
 */
export interface PerformanceConfig {
  /** Enable performance tracking */
  enabled: boolean;
  /** Track component render times */
  trackRenders: boolean;
  /** Track memory usage */
  trackMemory: boolean;
  /** Track screen transitions */
  trackScreens: boolean;
  /** Sample rate (0-1, percentage of events to track) */
  sampleRate: number;
  /**
   * Per-SESSION probability that a FlashList arms its per-cell mount
   * instrumentation (the `MountedCellRenderer` wrapper + blank-state
   * evaluation). Decided once per list mount, never per event — the wrapper
   * changes the cell tree shape (a Reanimated `Animated.View` around every
   * cell), so it must not flip mid-session. `flashlist_initial_load_ms`,
   * session duration, and the first-content-layout latch are never gated by
   * this.
   */
  flashListInstrumentationSampleRate: number;
  /** Threshold for "slow" renders in milliseconds */
  /** Threshold for memory warnings (percentage 0-100) */
  memoryWarningThreshold: number;
  /** Maximum number of memory snapshots to keep */
  maxMemorySnapshots: number;
}

/**
 * Memory warning level
 */
export enum MemoryWarningLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

/**
 * Memory warning event
 */
export interface MemoryWarning {
  level: MemoryWarningLevel;
  usagePercent: number;
  usedBytes: number;
  limitBytes?: number;
  timestamp: number;
  message: string;
}

/** Single scroll frame measurement */
export interface ScrollFrameMetric {
  timestamp: number;
  visibleStart: number;
  visibleEnd: number;
  /** Distinct visible indices that have a committed cell */
  mountedCount: number;
  expectedCount: number;
  blankDetected: boolean;
  /** ms between rAF callbacks */
  frameGap: number;
  /** mountedCount / expectedCount (0.0 - 1.0) */
  coverageRatio: number;
  /** Estimated scroll speed in items/second */
  scrollVelocity: number;
}

/** Per-mount session metrics */
export interface FlashListSessionMetrics {
  initialLoadTime: number | null;
  dataReferenceChanges: number;
  blankFrameCount: number;
  /** Blanks sustained for 3+ consecutive frames at overlapping visible ranges — user-visible whitespace */
  sustainedBlankCount: number;
  totalScrollFrames: number;
  longestBlankStreak: number;
  /** frames with >32ms gap */
  longFrameCount: number;
  peakFrameGap: number;
  viewabilityChangeCount: number;
  sessionStart: number;
  /** Number of predictive warnings emitted */
  predictiveWarnings: number;
  /** Fastest observed scroll speed in items/second */
  peakScrollVelocity: number;
}

/** Full diagnostic report */
export interface FlashListDiagnosticReport {
  session: FlashListSessionMetrics;
  recentFrames: ScrollFrameMetric[];
  dataChangeTimestamps: number[];
  dataChangeBlankCorrelations: number;
}

export type BlankRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface BlankRiskAssessment {
  level: BlankRiskLevel;
  factors: string[];
  coverageRatio: number;
  scrollVelocity: number;
}

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enabled: true, // Enabled in all environments - telemetry pipeline handles routing
  trackRenders: true, // Track component renders (sampled in production)
  trackMemory: false, // Disable - RN APIs are unreliable
  trackScreens: true, // Track screen transitions in all environments
  // Commit-gap telemetry volume. Full capture in dev; sampled in release —
  // the emission runs on the commit path of the busiest components.
  sampleRate: __DEV__ ? 1.0 : 0.2,
  // Per-cell FlashList instrumentation costs real mount time on the initial
  // paint path (~30-60 ms of a ~320 ms first-layout window on an SM-S908U1;
  // docs/audits/perf-blank-window-2026-08-26.md). Full capture in dev; a
  // sampled minority of release sessions keeps `flashlist_blank_cells_total`
  // and `flashlist_scroll_coverage_ratio` alive as series.
  flashListInstrumentationSampleRate: __DEV__ ? 1.0 : 0.05,
  memoryWarningThreshold: 80, // Warn at 80% memory usage
  maxMemorySnapshots: 100, // Keep last 100 snapshots
};
