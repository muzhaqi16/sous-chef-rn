import { useEffect, useRef, useState } from 'react';

/**
 * Anti-flicker latch: once true, stays true for `minDurationMs`, so a skeleton
 * on a cache-warm load does not flash. If `active` is false from the FIRST
 * render the latch never arms, so instant content is never delayed. NOT a
 * measurement input — the hold would floor any metric that reads it.
 */
export function useMinimumVisible(
  active: boolean,
  minDurationMs = 280,
): boolean {
  const [visible, setVisible] = useState(active);
  const [prevActive, setPrevActive] = useState(active);
  // When the latch most recently armed (ms). Read/written only inside effects
  // and timeout callbacks — never during render.
  const shownAtRef = useRef<number | null>(null);

  // Arm immediately when `active` turns on, during render, so the indicator
  // appears without a frame of delay.
  if (prevActive !== active) {
    setPrevActive(active);
    if (active && !visible) {
      setVisible(true);
    }
  }

  useEffect(() => {
    if (visible && shownAtRef.current == null) {
      shownAtRef.current = Date.now();
    }
  }, [visible]);

  // Released from the timeout callback, never synchronously in the effect body.
  useEffect(() => {
    if (active || !visible) return;
    const shownAt = shownAtRef.current ?? Date.now();
    const remaining = Math.max(0, minDurationMs - (Date.now() - shownAt));
    const timer = setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);
    return () => clearTimeout(timer);
  }, [active, visible, minDurationMs]);

  return visible;
}
