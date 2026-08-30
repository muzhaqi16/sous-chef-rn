/**
 * Per-list diagnostics instance: recycling, blank cells, frame-gap jank and
 * blank-risk assessment. Guarded by __DEV__ — every method no-ops in production.
 */
import type {
  ScrollFrameMetric,
  FlashListSessionMetrics,
  FlashListDiagnosticReport,
  BlankRiskLevel,
  BlankRiskAssessment,
} from './types';

const RING_BUFFER_SIZE = 120;
const COVERAGE_TREND_SIZE = 5;
const CORRELATION_WINDOW_MS = 500;

/** Minimum consecutive blank frames at overlapping ranges to count as sustained */
const SUSTAINED_BLANK_THRESHOLD = 3;

function createEmptySession(): FlashListSessionMetrics {
  return {
    initialLoadTime: null,
    dataReferenceChanges: 0,
    blankFrameCount: 0,
    sustainedBlankCount: 0,
    totalScrollFrames: 0,
    longestBlankStreak: 0,
    longFrameCount: 0,
    peakFrameGap: 0,
    viewabilityChangeCount: 0,
    sessionStart: 0,
    predictiveWarnings: 0,
    peakScrollVelocity: 0,
  };
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;
}

export class FlashListDiagnostics {
  private componentName: string;
  private session: FlashListSessionMetrics = createEmptySession();
  private ringBuffer: ScrollFrameMetric[] = [];
  private ringBufferIndex = 0;
  private dataChangeTimestamps: number[] = [];
  private rAFHandle: number | null = null;
  private lastFrameTime = 0;
  private lastFrameGap = 0;
  private currentBlankStreak = 0;

  // Sustained blank tracking — consecutive blanks at overlapping visible ranges
  private sustainedBlankStreak = 0;
  private sustainedBlankLastStart = -1;
  private sustainedBlankLastEnd = -1;

  // Predictive state
  private coverageTrend: number[] = [];
  private previousVisibleStart = -1;
  private previousFrameTimestamp = 0;
  private currentScrollVelocity = 0;
  private isScrolling = false;

  // Report deduplication
  private lastReportedFrameCount = 0;

  // Bound rAF callback
  private boundRAFLoop: (now: number) => void;

  constructor(componentName: string) {
    this.componentName = componentName;
    this.boundRAFLoop = this.rAFLoop.bind(this);
  }

  private rAFLoop(now: number): void {
    if (this.lastFrameTime > 0) {
      this.lastFrameGap = now - this.lastFrameTime;
      if (this.lastFrameGap > 32) {
        this.session.longFrameCount += 1;
      }
      if (this.lastFrameGap > this.session.peakFrameGap) {
        this.session.peakFrameGap = this.lastFrameGap;
      }
    }
    this.lastFrameTime = now;
    this.rAFHandle = requestAnimationFrame(this.boundRAFLoop);
  }

  private getRecentFrames(): ScrollFrameMetric[] {
    if (this.ringBuffer.length < RING_BUFFER_SIZE) {
      return this.ringBuffer.slice();
    }
    return [
      ...this.ringBuffer.slice(this.ringBufferIndex),
      ...this.ringBuffer.slice(0, this.ringBufferIndex),
    ];
  }

  private computeDataChangeBlankCorrelations(): number {
    let correlations = 0;
    const blankFrames = this.getRecentFrames().filter(f => f.blankDetected);
    for (const frame of blankFrames) {
      const hasRecentDataChange = this.dataChangeTimestamps.some(
        ts =>
          frame.timestamp - ts >= 0 &&
          frame.timestamp - ts <= CORRELATION_WINDOW_MS,
      );
      if (hasRecentDataChange) {
        correlations += 1;
      }
    }
    return correlations;
  }

  startSession(): void {
    if (!__DEV__) return;
    this.session = createEmptySession();
    this.session.sessionStart = performance.now();
    this.ringBuffer = [];
    this.ringBufferIndex = 0;
    this.dataChangeTimestamps = [];
    this.currentBlankStreak = 0;
    this.lastFrameTime = 0;
    this.lastFrameGap = 0;
    // Reset sustained blank state
    this.sustainedBlankStreak = 0;
    this.sustainedBlankLastStart = -1;
    this.sustainedBlankLastEnd = -1;
    // Reset predictive state
    this.coverageTrend = [];
    this.previousVisibleStart = -1;
    this.previousFrameTimestamp = 0;
    this.currentScrollVelocity = 0;
    this.isScrolling = false;
    this.lastReportedFrameCount = 0;
  }

  endSession(): void {
    if (!__DEV__) return;
    this.stopFrameGapMonitor();
    this.printReport();
  }

  recordScrollFrame(metric: ScrollFrameMetric): void {
    if (!__DEV__) return;

    this.session.totalScrollFrames += 1;

    if (metric.blankDetected) {
      this.session.blankFrameCount += 1;
      this.currentBlankStreak += 1;
      if (this.currentBlankStreak > this.session.longestBlankStreak) {
        this.session.longestBlankStreak = this.currentBlankStreak;
      }

      // Sustained blank: blank at overlapping visible range for 3+ consecutive frames
      const rangesOverlap =
        metric.visibleStart <= this.sustainedBlankLastEnd &&
        metric.visibleEnd >= this.sustainedBlankLastStart;

      if (rangesOverlap || this.sustainedBlankStreak === 0) {
        this.sustainedBlankStreak += 1;
      } else {
        // Non-overlapping range — reset streak (user scrolled past, different region)
        this.sustainedBlankStreak = 1;
      }

      this.sustainedBlankLastStart = metric.visibleStart;
      this.sustainedBlankLastEnd = metric.visibleEnd;

      if (this.sustainedBlankStreak === SUSTAINED_BLANK_THRESHOLD) {
        this.session.sustainedBlankCount += 1;
      }
    } else {
      this.currentBlankStreak = 0;
      this.sustainedBlankStreak = 0;
    }

    // Update coverage trend
    if (this.coverageTrend.length >= COVERAGE_TREND_SIZE) {
      this.coverageTrend.shift();
    }
    this.coverageTrend.push(metric.coverageRatio);

    // Update peak scroll velocity
    if (metric.scrollVelocity > this.session.peakScrollVelocity) {
      this.session.peakScrollVelocity = metric.scrollVelocity;
    }

    // Write to ring buffer
    if (this.ringBuffer.length < RING_BUFFER_SIZE) {
      this.ringBuffer.push(metric);
    } else {
      this.ringBuffer[this.ringBufferIndex] = metric;
    }
    this.ringBufferIndex = (this.ringBufferIndex + 1) % RING_BUFFER_SIZE;
  }

  recordOnLoad(elapsedTimeInMs: number): void {
    if (!__DEV__) return;
    this.session.initialLoadTime = elapsedTimeInMs;
  }

  recordDataReferenceChange(): void {
    if (!__DEV__) return;
    this.session.dataReferenceChanges += 1;
    this.dataChangeTimestamps.push(performance.now());

    if (this.isScrolling) {
      console.log(
        `⚠️ [FlashList:${this.componentName}] Data reference changed during active scroll`,
      );
    }
  }

  recordViewabilityChange(): void {
    if (!__DEV__) return;
    this.session.viewabilityChangeCount += 1;
  }

  startFrameGapMonitor(): void {
    if (!__DEV__) return;
    if (this.rAFHandle !== null) return;
    this.lastFrameTime = 0;
    this.lastFrameGap = 0;
    this.isScrolling = true;
    this.rAFHandle = requestAnimationFrame(this.boundRAFLoop);
  }

  stopFrameGapMonitor(): void {
    if (!__DEV__) return;
    if (this.rAFHandle !== null) {
      cancelAnimationFrame(this.rAFHandle);
      this.rAFHandle = null;
    }
    this.isScrolling = false;
  }

  getLastFrameGap(): number {
    return this.lastFrameGap;
  }

  getSessionMetrics(): FlashListSessionMetrics {
    return { ...this.session };
  }

  computeScrollVelocity(visibleStart: number, timestamp: number): number {
    if (this.previousVisibleStart < 0 || this.previousFrameTimestamp === 0) {
      this.previousVisibleStart = visibleStart;
      this.previousFrameTimestamp = timestamp;
      return 0;
    }

    const deltaItems = Math.abs(visibleStart - this.previousVisibleStart);
    const deltaTime = (timestamp - this.previousFrameTimestamp) / 1000; // seconds

    this.previousVisibleStart = visibleStart;
    this.previousFrameTimestamp = timestamp;

    if (deltaTime <= 0) return this.currentScrollVelocity;

    const rawVelocity = deltaItems / deltaTime;
    // Exponential moving average (alpha=0.3) to smooth spikes
    this.currentScrollVelocity =
      0.3 * rawVelocity + 0.7 * this.currentScrollVelocity;

    return this.currentScrollVelocity;
  }

  assessBlankRisk(): BlankRiskAssessment {
    const factors: string[] = [];

    // Factor: coverage declining (last 3 entries monotonically decreasing AND latest < 0.9)
    if (this.coverageTrend.length >= 3) {
      const len = this.coverageTrend.length;
      const last3 = this.coverageTrend.slice(len - 3);
      const declining = last3[0] > last3[1] && last3[1] > last3[2];
      if (declining && last3[2] < 0.9) {
        factors.push('coverage declining');
      }
    }

    // Factor: high scroll velocity (> 30 items/second)
    if (this.currentScrollVelocity > 30) {
      factors.push('high scroll velocity');
    }

    // Factor: data churn during scroll
    if (this.isScrolling && this.dataChangeTimestamps.length > 0) {
      const now = performance.now();
      const recentDataChange = this.dataChangeTimestamps.some(
        ts => now - ts >= 0 && now - ts <= CORRELATION_WINDOW_MS,
      );
      if (recentDataChange) {
        factors.push('data churn during scroll');
      }
    }

    // Factor: frame jank (last frame gap > 48ms = 3 dropped frames)
    if (this.lastFrameGap > 48) {
      factors.push('frame jank');
    }

    // Risk mapping
    let level: BlankRiskLevel;
    if (factors.length === 0) {
      level = 'none';
    } else if (factors.length === 1) {
      level = 'low';
    } else if (factors.length === 2) {
      level = 'medium';
    } else {
      level = 'high';
    }

    if (level === 'medium' || level === 'high') {
      this.session.predictiveWarnings += 1;
    }

    const latestCoverage =
      this.coverageTrend.length > 0
        ? this.coverageTrend[this.coverageTrend.length - 1]
        : 1;

    return {
      level,
      factors,
      coverageRatio: latestCoverage,
      scrollVelocity: this.currentScrollVelocity,
    };
  }

  generateReport(): FlashListDiagnosticReport {
    const recentFrames = this.getRecentFrames();
    return {
      session: { ...this.session },
      recentFrames,
      dataChangeTimestamps: this.dataChangeTimestamps.slice(),
      dataChangeBlankCorrelations: this.computeDataChangeBlankCorrelations(),
    };
  }

  printReport(): void {
    if (!__DEV__) return;

    // Skip if no new scroll activity since last report
    if (this.session.totalScrollFrames === this.lastReportedFrameCount) return;
    this.lastReportedFrameCount = this.session.totalScrollFrames;

    const report = this.generateReport();
    const { session: s } = report;
    const duration = performance.now() - s.sessionStart;
    const blankPercent =
      s.totalScrollFrames > 0
        ? ((s.blankFrameCount / s.totalScrollFrames) * 100).toFixed(1)
        : '0.0';
    const sustainedBlankPercent =
      s.totalScrollFrames > 0
        ? ((s.sustainedBlankCount / s.totalScrollFrames) * 100).toFixed(1)
        : '0.0';

    const recentBlanks = report.recentFrames
      .filter(f => f.blankDetected)
      .slice(-5);

    const blankLines = recentBlanks
      .map(f => {
        const offset = formatDuration(f.timestamp - s.sessionStart);
        return `  +${offset}  gap=${f.frameGap.toFixed(0)}ms  visible=[${
          f.visibleStart
        },${f.visibleEnd}]  mounted=${f.mountedCount}/${f.expectedCount}`;
      })
      .join('\n');

    const avgCoverage =
      this.coverageTrend.length > 0
        ? (
            this.coverageTrend.reduce((a, b) => a + b, 0) /
            this.coverageTrend.length
          ).toFixed(2)
        : 'N/A';

    console.log(
      `\n📊 [FlashList:${this.componentName}] Session Report\n` +
        `====================================================\n` +
        `Initial Load:     ${
          s.initialLoadTime !== null ? formatDuration(s.initialLoadTime) : 'N/A'
        }\n` +
        `Session Duration: ${formatDuration(duration)}\n` +
        `Data Ref Changes: ${s.dataReferenceChanges} (${report.dataChangeBlankCorrelations} correlated with blank frames)\n` +
        `----------------------------------------------------\n` +
        `Scroll Quality:\n` +
        `  Total Frames:   ${s.totalScrollFrames}\n` +
        `  Blank Frames:   ${s.blankFrameCount} (${blankPercent}%) transient\n` +
        `  Sustained:      ${s.sustainedBlankCount} (${sustainedBlankPercent}%) user-visible\n` +
        `  Longest Blank:  ${s.longestBlankStreak} consecutive\n` +
        `  Long Frames:    ${s.longFrameCount} (>32ms gap)\n` +
        `  Peak Frame Gap: ${s.peakFrameGap.toFixed(0)}ms\n` +
        `----------------------------------------------------\n` +
        `Predictive:\n` +
        `  Warnings:       ${s.predictiveWarnings}\n` +
        `  Peak Velocity:  ${s.peakScrollVelocity.toFixed(0)} items/s\n` +
        `  Avg Coverage:   ${avgCoverage}\n` +
        `----------------------------------------------------\n` +
        (recentBlanks.length > 0
          ? `Recent Blank Events:\n${blankLines}\n`
          : `No recent blank events.\n`) +
        `====================================================\n`,
    );
  }
}
