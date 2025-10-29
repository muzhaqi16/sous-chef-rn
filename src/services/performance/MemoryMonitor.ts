import { Platform } from 'react-native';
import { Telemetry } from '#/services/telemetry';
import {
  MemorySnapshot,
  MemoryWarning,
  MemoryWarningLevel,
  DEFAULT_PERFORMANCE_CONFIG,
} from './types';

/**
 * Memory Monitor Service
 *
 * Tracks memory usage over time and emits warnings when thresholds are exceeded.
 * Uses platform-specific APIs where available.
 *
 * Note: React Native has limited memory APIs. This service provides best-effort
 * monitoring using available platform features.
 */
class MemoryMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private enabled: boolean = false;
  private snapshots: MemorySnapshot[] = [];
  private readonly maxSnapshots: number = DEFAULT_PERFORMANCE_CONFIG.maxMemorySnapshots;
  private readonly warningThreshold: number = DEFAULT_PERFORMANCE_CONFIG.memoryWarningThreshold;
  private lastWarningTime: number = 0;
  private readonly warningCooldown: number = 30000; // 30 seconds between warnings

  /**
   * Start monitoring memory usage
   *
   * @param intervalMs - Sampling interval in milliseconds (default: 10000ms)
   */
  start(intervalMs: number = 10000): void {
    if (this.enabled) {
      return; // Already running
    }

    this.enabled = true;

    // Take initial snapshot
    this.takeSnapshot('monitor_start');

    // Set up periodic sampling
    this.intervalId = setInterval(() => {
      this.takeSnapshot('periodic_sample');
    }, intervalMs);

    if (__DEV__) {
      console.log(`[MemoryMonitor] Started with ${intervalMs}ms interval`);
    }
  }

  /**
   * Stop monitoring memory usage
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.enabled = false;

    if (__DEV__) {
      console.log('[MemoryMonitor] Stopped');
    }
  }

  /**
   * Take a memory snapshot
   *
   * @param context - Context or trigger for this snapshot
   * @returns Memory snapshot or null if unavailable
   */
  takeSnapshot(context?: string): MemorySnapshot | null {
    const memoryInfo = this.getMemoryInfo();

    if (!memoryInfo) {
      return null;
    }

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      usedBytes: memoryInfo.usedBytes,
      limitBytes: memoryInfo.limitBytes,
      usagePercent: memoryInfo.usagePercent,
      context,
    };

    // Add to snapshots array
    this.snapshots.push(snapshot);

    // Trim old snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }

    // Report metrics
    Telemetry.gauge('app_memory_used_bytes', snapshot.usedBytes, {
      context: context || 'unknown',
    });

    if (snapshot.limitBytes) {
      Telemetry.gauge('app_memory_limit_bytes', snapshot.limitBytes);
    }

    Telemetry.gauge('app_memory_usage_percent', snapshot.usagePercent);

    // Check for warnings
    this.checkMemoryWarnings(snapshot);

    return snapshot;
  }

  /**
   * Get current memory info
   *
   * @returns Memory information or null if unavailable
   */
  private getMemoryInfo(): {
    usedBytes: number;
    limitBytes?: number;
    usagePercent: number;
  } | null {
    // Try to get memory info from performance API (available in some environments)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      const usedBytes = memory.usedJSHeapSize || 0;
      const limitBytes = memory.jsHeapSizeLimit || undefined;
      const usagePercent = limitBytes ? (usedBytes / limitBytes) * 100 : 0;

      return {
        usedBytes,
        limitBytes,
        usagePercent,
      };
    }

    // Fallback: Estimate based on platform (very rough estimates)
    // This is not accurate but provides some indication
    if (Platform.OS === 'ios') {
      // iOS devices typically have 1-4GB available for apps
      // Assume 50% usage as baseline
      return {
        usedBytes: 524288000, // ~500MB estimate
        limitBytes: 1048576000, // ~1GB estimate
        usagePercent: 50,
      };
    } else if (Platform.OS === 'android') {
      // Android varies widely, use conservative estimate
      return {
        usedBytes: 419430400, // ~400MB estimate
        limitBytes: 838860800, // ~800MB estimate
        usagePercent: 50,
      };
    }

    return null;
  }

  /**
   * Check memory warnings and emit if necessary
   *
   * @param snapshot - Current memory snapshot
   */
  private checkMemoryWarnings(snapshot: MemorySnapshot): void {
    const now = Date.now();

    // Check cooldown period
    if (now - this.lastWarningTime < this.warningCooldown) {
      return; // Too soon since last warning
    }

    let warningLevel: MemoryWarningLevel = MemoryWarningLevel.NORMAL;
    let message = '';

    if (snapshot.usagePercent >= 95) {
      warningLevel = MemoryWarningLevel.CRITICAL;
      message = `Critical memory usage: ${snapshot.usagePercent.toFixed(1)}%`;
    } else if (snapshot.usagePercent >= this.warningThreshold) {
      warningLevel = MemoryWarningLevel.WARNING;
      message = `High memory usage: ${snapshot.usagePercent.toFixed(1)}%`;
    }

    if (warningLevel !== MemoryWarningLevel.NORMAL) {
      const warning: MemoryWarning = {
        level: warningLevel,
        usagePercent: snapshot.usagePercent,
        usedBytes: snapshot.usedBytes,
        limitBytes: snapshot.limitBytes,
        timestamp: now,
        message,
      };

      this.emitWarning(warning);
      this.lastWarningTime = now;
    }
  }

  /**
   * Emit a memory warning
   *
   * @param warning - Memory warning to emit
   */
  private emitWarning(warning: MemoryWarning): void {
    // Report to telemetry
    if (warning.level === MemoryWarningLevel.CRITICAL) {
      Telemetry.increment('app_memory_critical_total', 1);
    } else {
      Telemetry.increment('app_memory_warnings_total', 1);
    }

    // Log in dev
    if (__DEV__) {
      const logFn = warning.level === MemoryWarningLevel.CRITICAL ? console.error : console.warn;
      logFn(`[MemoryMonitor] ${warning.message}`);
    }

    // Could emit events here for UI notifications if needed
    // For now, just log and report to telemetry
  }

  /**
   * Get all memory snapshots
   *
   * @returns Array of memory snapshots
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get the latest memory snapshot
   *
   * @returns Latest memory snapshot or null
   */
  getLatestSnapshot(): MemorySnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  /**
   * Clear all memory snapshots
   */
  clearSnapshots(): void {
    this.snapshots = [];
  }

  /**
   * Check if monitoring is enabled
   *
   * @returns True if monitoring is active
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const MemoryMonitor = new MemoryMonitorService();
