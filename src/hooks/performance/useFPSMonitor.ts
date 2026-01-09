import { useState, useEffect, useRef, useCallback } from 'react';

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
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState<FPSStats>({
    current: 60,
    min: 60,
    max: 60,
    avg: 60,
    lowFPSCount: 0,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const rafIdRef = useRef<number | null>(null);
  const fpsHistoryRef = useRef<number[]>([]);
  const lowFPSCountRef = useRef(0);
  const logTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Frame counting loop
  const countFrame = useCallback(() => {
    frameCountRef.current++;
    rafIdRef.current = requestAnimationFrame(countFrame);
  }, []);

  // Calculate and update FPS
  const updateFPS = useCallback(() => {
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
      const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);

      setFps(currentFPS);
      setStats({
        current: currentFPS,
        min,
        max,
        avg,
        lowFPSCount: lowFPSCountRef.current,
      });
    }
  }, [lowFPSThreshold]);

  // Periodic logging
  const logStats = useCallback(() => {
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
  }, [fps, lowFPSThreshold]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!__DEV__ || isMonitoring) return;

    setIsMonitoring(true);
    frameCountRef.current = 0;
    lastTimeRef.current = Date.now();
    fpsHistoryRef.current = [];
    lowFPSCountRef.current = 0;

    // Start frame counting
    rafIdRef.current = requestAnimationFrame(countFrame);

    // Start FPS calculation interval
    const fpsInterval = setInterval(updateFPS, 100);

    // Start periodic logging
    logTimerRef.current = setInterval(logStats, logInterval);

    console.log('[PERF] FPS monitor: started');

    return () => {
      clearInterval(fpsInterval);
    };
  }, [isMonitoring, countFrame, updateFPS, logStats, logInterval]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
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
  }, [logStats]);

  // Reset stats
  const resetStats = useCallback(() => {
    fpsHistoryRef.current = [];
    lowFPSCountRef.current = 0;
    setStats({
      current: 60,
      min: 60,
      max: 60,
      avg: 60,
      lowFPSCount: 0,
    });
  }, []);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart && __DEV__) {
      const cleanup = startMonitoring();
      return () => {
        cleanup?.();
        stopMonitoring();
      };
    }
  }, [autoStart, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
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

    let frames = 0;
    let lastTime = Date.now();

    const countFrame = () => {
      frames++;
      const now = Date.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }
      requestAnimationFrame(countFrame);
    };

    const rafId = requestAnimationFrame(countFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return fps;
}
