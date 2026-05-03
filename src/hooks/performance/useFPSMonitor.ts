import { useState, useEffect, useRef } from 'react';

/**
 * FPS Monitor Hook for Development
 *
 * Tracks frames per second during scroll and interaction to identify
 * performance bottlenecks. Only active in __DEV__ mode.
 *
 * Usage:
 * ```tsx
 * const { fps, isLowFPS, startMonitoring, stopMonitoring } = useFPSMonitor();
 *
 * // Display FPS in dev UI
 * {__DEV__ && <Text>FPS: {fps}</Text>}
 * ```
 */

interface FPSMonitorOptions {
  /** Threshold below which FPS is considered "low" (default: 30) */
  lowFPSThreshold?: number;
  /** Interval for logging FPS stats in ms (default: 5000) */
  logInterval?: number;
  /** Whether to auto-start monitoring on mount (default: true in DEV) */
  autoStart?: boolean;
}

interface FPSStats {
  current: number;
  min: number;
  max: number;
  avg: number;
  lowFPSCount: number;
}

export function useFPSMonitor(options: FPSMonitorOptions = {}) {
  const {
    lowFPSThreshold = 30,
    logInterval = 5000,
    autoStart = __DEV__,
  } = options;

  const [fps, setFps] = useState(60);
  const [isMonitoring, setIsMonitoring] = useState(autoStart && __DEV__);
  const [stats, setStats] = useState<FPSStats>({
    current: 60,
    min: 60,
    max: 60,
    avg: 60,
    lowFPSCount: 0,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const fpsHistoryRef = useRef<number[]>([]);
  const lowFPSCountRef = useRef(0);
  const logTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fpsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Frame counting loop
  const countFrame = () => {
    frameCountRef.current++;
    rafIdRef.current = requestAnimationFrame(countFrame);
  };

  // Calculate and update FPS
  const updateFPS = () => {
    const now = Date.now();
    const elapsed = now - lastTimeRef.current;

    if (elapsed >= 1000) {
      const currentFPS = Math.round((frameCountRef.current * 1000) / elapsed);
      frameCountRef.current = 0;
      lastTimeRef.current = now;

      // Track history for stats
      fpsHistoryRef.current.push(currentFPS);
      if (fpsHistoryRef.current.length > 60) {
        fpsHistoryRef.current.shift(); // Keep last 60 samples
      }

      // Track low FPS occurrences
      if (currentFPS < lowFPSThreshold) {
        lowFPSCountRef.current++;
      }

      // Calculate stats
      const history = fpsHistoryRef.current;
      const min = Math.min(...history);
      const max = Math.max(...history);
      const avg = Math.round(
        history.reduce((a, b) => a + b, 0) / history.length,
      );

      setFps(currentFPS);
      setStats({
        current: currentFPS,
        min,
        max,
        avg,
        lowFPSCount: lowFPSCountRef.current,
      });
    }
  };

  // Periodic logging
  const logStats = () => {
    if (!__DEV__) return;

    const history = fpsHistoryRef.current;
    if (history.length === 0) return;

    const min = Math.min(...history);
    const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);

    console.log(`[PERF] FPS: ${fps} (avg: ${avg}, min: ${min})`);

    // Log if average is low
    if (avg < lowFPSThreshold) {
      console.log(`[PERF] Low FPS: ${avg} avg`);
    }
  };

  // Start monitoring
  const startMonitoring = () => {
    if (!__DEV__ || isMonitoring) return;

    setIsMonitoring(true);
    frameCountRef.current = 0;
    lastTimeRef.current = Date.now();
    fpsHistoryRef.current = [];
    lowFPSCountRef.current = 0;

    // Start frame counting
    rafIdRef.current = requestAnimationFrame(countFrame);

    // Start FPS calculation interval
    fpsIntervalRef.current = setInterval(updateFPS, 100);

    // Start periodic logging
    logTimerRef.current = setInterval(logStats, logInterval);

    console.log('[PERF] FPS monitor: started');
  };

  // Stop monitoring
  const stopMonitoring = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (fpsIntervalRef.current) {
      clearInterval(fpsIntervalRef.current);
      fpsIntervalRef.current = null;
    }
    if (logTimerRef.current) {
      clearInterval(logTimerRef.current);
      logTimerRef.current = null;
    }
    setIsMonitoring(false);

    if (__DEV__) {
      console.log('[PERF] FPS monitor: stopped');
      logStats(); // Log final stats
    }
  };

  // Reset stats
  const resetStats = () => {
    fpsHistoryRef.current = [];
    lowFPSCountRef.current = 0;
    setStats({
      current: 60,
      min: 60,
      max: 60,
      avg: 60,
      lowFPSCount: 0,
    });
  };

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart && __DEV__) {
      // Inline all monitoring logic to avoid dependency issues
      frameCountRef.current = 0;
      lastTimeRef.current = Date.now();
      fpsHistoryRef.current = [];
      lowFPSCountRef.current = 0;

      // Inline frame counting loop
      const localCountFrame = () => {
        frameCountRef.current++;
        rafIdRef.current = requestAnimationFrame(localCountFrame);
      };

      // Inline FPS calculation
      const localUpdateFPS = () => {
        const now = Date.now();
        const elapsed = now - lastTimeRef.current;

        if (elapsed >= 1000) {
          const currentFPS = Math.round(
            (frameCountRef.current * 1000) / elapsed,
          );
          frameCountRef.current = 0;
          lastTimeRef.current = now;

          fpsHistoryRef.current.push(currentFPS);
          if (fpsHistoryRef.current.length > 60) {
            fpsHistoryRef.current.shift();
          }

          if (currentFPS < lowFPSThreshold) {
            lowFPSCountRef.current++;
          }

          const history = fpsHistoryRef.current;
          const min = Math.min(...history);
          const max = Math.max(...history);
          const avg = Math.round(
            history.reduce((a, b) => a + b, 0) / history.length,
          );

          setFps(currentFPS);
          setStats({
            current: currentFPS,
            min,
            max,
            avg,
            lowFPSCount: lowFPSCountRef.current,
          });
        }
      };

      // Inline periodic logging
      const localLogStats = () => {
        const history = fpsHistoryRef.current;
        if (history.length === 0) return;
        const min = Math.min(...history);
        const avg = Math.round(
          history.reduce((a, b) => a + b, 0) / history.length,
        );
        console.log(`[PERF] FPS: current (avg: ${avg}, min: ${min})`);
        if (avg < lowFPSThreshold) {
          console.log(`[PERF] Low FPS: ${avg} avg`);
        }
      };

      rafIdRef.current = requestAnimationFrame(localCountFrame);
      fpsIntervalRef.current = setInterval(localUpdateFPS, 100);
      logTimerRef.current = setInterval(localLogStats, logInterval);

      console.log('[PERF] FPS monitor: started');

      return () => {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        if (fpsIntervalRef.current) {
          clearInterval(fpsIntervalRef.current);
          fpsIntervalRef.current = null;
        }
        if (logTimerRef.current) {
          clearInterval(logTimerRef.current);
          logTimerRef.current = null;
        }
        setIsMonitoring(false);
      };
    }
  }, [autoStart, logInterval, lowFPSThreshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
      if (logTimerRef.current) {
        clearInterval(logTimerRef.current);
      }
    };
  }, []);

  return {
    fps,
    isLowFPS: fps < lowFPSThreshold,
    isMonitoring,
    stats,
    startMonitoring,
    stopMonitoring,
    resetStats,
  };
}

/**
 * Simple FPS display component for development overlay
 */
export function useSimpleFPS(): number {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    if (!__DEV__) return;

    let cancelled = false;
    let rafId: number | null = null;
    let frames = 0;
    let lastTime = Date.now();

    const countFrame = () => {
      if (cancelled) return;
      frames += 1;
      const now = Date.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(countFrame);
    };

    rafId = requestAnimationFrame(countFrame);
    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return fps;
}
