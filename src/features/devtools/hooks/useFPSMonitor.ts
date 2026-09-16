import { useState, useEffect, useRef } from 'react';
import { logger } from '#/utils/environment';

/** Frames per second during scroll and interaction. `__DEV__` only. */

interface FPSMonitorOptions {
  /** Threshold below which FPS is considered "low" (default: 30) */
  lowFPSThreshold?: number;
  /** Interval for logging FPS stats in ms (default: 5000) */
  logInterval?: number;
  /** Whether to start monitoring on mount (default: true in DEV) */
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
  const [stats, setStats] = useState<FPSStats>({
    current: 60,
    min: 60,
    max: 60,
    avg: 60,
    lowFPSCount: 0,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  const fpsHistoryRef = useRef<number[]>([]);
  const lowFPSCountRef = useRef(0);

  useEffect(() => {
    if (!autoStart || !__DEV__) return;

    frameCountRef.current = 0;
    lastTimeRef.current = Date.now();
    fpsHistoryRef.current = [];
    lowFPSCountRef.current = 0;

    let rafId: number | null = null;

    const countFrame = () => {
      frameCountRef.current++;
      rafId = requestAnimationFrame(countFrame);
    };

    const updateFPS = () => {
      const now = Date.now();
      const elapsed = now - lastTimeRef.current;
      if (elapsed < 1000) return;

      const currentFPS = Math.round((frameCountRef.current * 1000) / elapsed);
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
    };

    const logStats = () => {
      const history = fpsHistoryRef.current;
      if (history.length === 0) return;
      const min = Math.min(...history);
      const avg = Math.round(
        history.reduce((a, b) => a + b, 0) / history.length,
      );
      logger.debug(`[PERF] FPS: current (avg: ${avg}, min: ${min})`);
      if (avg < lowFPSThreshold) {
        logger.debug(`[PERF] Low FPS: ${avg} avg`);
      }
    };

    rafId = requestAnimationFrame(countFrame);
    const fpsInterval = setInterval(updateFPS, 100);
    const logTimer = setInterval(logStats, logInterval);

    logger.debug('[PERF] FPS monitor: started');

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      clearInterval(fpsInterval);
      clearInterval(logTimer);
    };
  }, [autoStart, logInterval, lowFPSThreshold]);

  return {
    fps,
    isLowFPS: fps < lowFPSThreshold,
    stats,
  };
}
