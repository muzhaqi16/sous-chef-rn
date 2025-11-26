import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Hook for progressive/chunked list rendering.
 *
 * Instead of rendering all items at once (blocking JS thread),
 * this hook progressively adds items in small batches across multiple frames.
 * This keeps the UI responsive during heavy list initialization.
 *
 * @param items - The full array of items to render
 * @param options - Configuration options
 * @returns The progressively expanding array of items to render
 */
interface UseProgressiveListOptions {
  /** Number of items to render immediately (default: 3) */
  initialBatch?: number;
  /** Number of items to add per batch (default: 3) */
  batchSize?: number;
  /** Delay between batches in ms (default: 32 for ~2 frames at 60fps) */
  batchDelay?: number;
  /** Whether progressive loading is enabled (default: true) */
  enabled?: boolean;
}

export function useProgressiveList<T>(
  items: T[],
  options: UseProgressiveListOptions = {},
): T[] {
  const {
    initialBatch = 3,
    batchSize = 3,
    batchDelay = 32,
    enabled = true,
  } = options;

  // Track how many items we're currently showing
  const [visibleCount, setVisibleCount] = useState(() =>
    enabled ? Math.min(initialBatch, items.length) : items.length,
  );

  // Track the items array length to detect when new data arrives
  const prevLengthRef = useRef(items.length);
  // Track if we've finished loading all items for the current batch
  const isLoadingRef = useRef(false);

  // When items array changes significantly, reset progressive loading
  useEffect(() => {
    const prevLength = prevLengthRef.current;
    const newLength = items.length;
    prevLengthRef.current = newLength;

    if (!enabled) {
      setVisibleCount(newLength);
      return;
    }

    // Items went from empty to having data - start progressive loading
    if (prevLength === 0 && newLength > 0) {
      setVisibleCount(Math.min(initialBatch, newLength));
      isLoadingRef.current = true;
      return;
    }

    // Items changed while we already have some - just show all
    // This handles add/remove/reorder operations smoothly
    if (prevLength > 0 && newLength !== prevLength) {
      setVisibleCount(newLength);
      isLoadingRef.current = false;
      return;
    }
  }, [items.length, initialBatch, enabled]);

  // Progressively add more items
  useEffect(() => {
    if (!enabled) return;
    if (visibleCount >= items.length) {
      isLoadingRef.current = false;
      return;
    }

    // Use requestAnimationFrame + setTimeout to yield to the browser
    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return;
      const timerId = setTimeout(() => {
        if (cancelled) return;
        setVisibleCount(prev => Math.min(prev + batchSize, items.length));
      }, batchDelay);

      // Store for cleanup
      (frameId as any)._timerId = timerId;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      const timerId = (frameId as any)?._timerId;
      if (timerId) clearTimeout(timerId);
    };
  }, [visibleCount, items.length, batchSize, batchDelay, enabled]);

  // Return the slice of items to render
  return useMemo(
    () => (enabled ? items.slice(0, visibleCount) : items),
    [items, visibleCount, enabled],
  );
}
