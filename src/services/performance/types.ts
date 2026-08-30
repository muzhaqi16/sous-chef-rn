export interface RenderMetrics {
  componentName: string;
  renderCount: number;
  lastRenderTime: number; // ms
  avgRenderTime: number; // ms
  maxRenderTime: number; // ms
  totalRenderTime: number; // ms, sum of all renders
  lastRenderTimestamp: number;
}

export interface ScreenMetrics {
  screenName: string;
  transitionCount: number;
  lastInteractiveTime: number; // ms
  avgInteractiveTime: number; // ms
  maxInteractiveTime: number; // ms
  totalInteractiveTime: number; // ms, sum used for the average
  lastTransitionTimestamp: number;
}

export interface MemorySnapshot {
  timestamp: number;
  usedBytes: number;
  limitBytes?: number;
  usagePercent: number; // 0-100
  context?: string;
}

export interface PerformanceConfig {
  enabled: boolean;
  trackRenders: boolean;
  trackMemory: boolean;
  trackScreens: boolean;
  sampleRate: number; // 0-1, fraction of events tracked
  /**
   * Per-SESSION probability that a FlashList arms per-cell mount instrumentation.
   * Decided once per list mount — the wrapper adds an `Animated.View` around
   * every cell, so it must not flip mid-session. Never gates
   * `flashlist_initial_load_ms`, session duration or the first-layout latch.
   */
  flashListInstrumentationSampleRate: number;
  memoryWarningThreshold: number; // percent, 0-100
  maxMemorySnapshots: number;
}

export enum MemoryWarningLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface MemoryWarning {
  level: MemoryWarningLevel;
  usagePercent: number;
  usedBytes: number;
  limitBytes?: number;
  timestamp: number;
  message: string;
}

export interface ScrollFrameMetric {
  timestamp: number;
  visibleStart: number;
  visibleEnd: number;
  mountedCount: number; // distinct visible indices with a committed cell
  expectedCount: number;
  blankDetected: boolean;
  frameGap: number; // ms between rAF callbacks
  coverageRatio: number; // mountedCount / expectedCount, 0.0-1.0
  scrollVelocity: number; // items/second
}

export interface FlashListSessionMetrics {
  initialLoadTime: number | null;
  dataReferenceChanges: number;
  blankFrameCount: number;
  // Blanks over 3+ consecutive frames at overlapping visible ranges, i.e.
  // whitespace the user actually saw.
  sustainedBlankCount: number;
  totalScrollFrames: number;
  longestBlankStreak: number;
  longFrameCount: number; // frames with >32ms gap
  peakFrameGap: number;
  viewabilityChangeCount: number;
  sessionStart: number;
  predictiveWarnings: number;
  peakScrollVelocity: number; // items/second
}

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

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enabled: true, // on everywhere; the telemetry pipeline handles routing
  trackRenders: true,
  trackMemory: false, // RN memory APIs are unreliable
  trackScreens: true,
  // Commit-gap emission runs on the commit path of the busiest components.
  sampleRate: __DEV__ ? 1.0 : 0.2,
  // Per-cell FlashList instrumentation costs ~30-60 ms of a ~320 ms first-layout
  // window on device, so release keeps only enough sessions to hold the series.
  flashListInstrumentationSampleRate: __DEV__ ? 1.0 : 0.05,
  memoryWarningThreshold: 80, // Warn at 80% memory usage
  maxMemorySnapshots: 100, // Keep last 100 snapshots
};
