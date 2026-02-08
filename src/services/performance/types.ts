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
  /** Threshold for "slow" renders in milliseconds */
  slowRenderThreshold: number;
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

/**
 * Default performance configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enabled: true, // Enabled in all environments - telemetry pipeline handles routing
  trackRenders: true, // Track component renders (sampled in production)
  trackMemory: false, // Disable - RN APIs are unreliable
  trackScreens: true, // Track screen transitions in all environments
  sampleRate: __DEV__ ? 1.0 : 0.1, // 100% in dev, 10% in production
  slowRenderThreshold: __DEV__ ? 500 : 16, // Android emulator adds 5-10x overhead; 16ms = 60fps for production
  memoryWarningThreshold: 80, // Warn at 80% memory usage
  maxMemorySnapshots: 100, // Keep last 100 snapshots
};
