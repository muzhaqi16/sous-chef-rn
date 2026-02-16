import { Telemetry } from '#/services/telemetry';
import DeviceInfo from 'react-native-device-info';
import {
  MemorySnapshot,
  MemoryWarning,
  MemoryWarningLevel,
  DEFAULT_PERFORMANCE_CONFIG,
} from './types';
import { usePerformanceStore } from '#/store/performanceStore';

/**
 * Memory Monitor Service
 *
 * Tracks memory usage over time and emits warnings when thresholds are exceeded.
 * Uses react-native-device-info for actual memory readings instead of hardcoded fallbacks.
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
  }

  /**
   * Take a memory snapshot
   *
   * @param context - Context or trigger for this snapshot
   * @returns Memory snapshot or null if unavailable
   */
  async takeSnapshot(context?: string): Promise<MemorySnapshot | null> {
    const memoryInfo = await this.getMemoryInfo();

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

    // Record snapshot in performance store for dashboard (isolated from main store)
    usePerformanceStore.getState().addMemorySnapshot(snapshot);

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
   * Get current memory info using react-native-device-info
   *
   * @returns Memory information or null if unavailable
   */
  private async getMemoryInfo(): Promise<{
    usedBytes: number;
    limitBytes?: number;
    usagePercent: number;
  } | null> {
    try {
      // Use react-native-device-info for actual memory readings
      const [usedBytes, totalBytes] = await Promise.all([
        DeviceInfo.getUsedMemory(),
        DeviceInfo.getTotalMemory(),
      ]);

      const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

      return {
        usedBytes,
        limitBytes: totalBytes,
        usagePercent,
      };
    } catch {
      return null;
    }
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
