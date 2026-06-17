import { useEffect, useRef, useState } from 'react';

/**
 * Latches a "visible" flag so that once it turns true it stays true for at
 * least `minDurationMs`. This prevents loading indicators (skeletons,
 * spinners) from flashing for a sub-perceptible time on fast — typically
 * cache-warm — loads, which reads to the user as the UI "switching between
 * states very quickly."
 *
 * Key property: when `active` is false from the very first render, the latch
 * never arms, so genuinely-instant content is never artificially delayed. The
 * minimum only applies once a loading state has actually been shown.
 *
 * Implementation notes: arming uses the "adjusting state during render"
 * pattern (no effect), and the release is deferred through a `setTimeout`
 * callback. Both avoid the synchronous-setState-in-effect anti-pattern; the
 * show timestamp is written to a ref only inside effects/callbacks, never
 * during render.
 *
 * @param active        The raw loading flag (true while content is pending).
 * @param minDurationMs Minimum time the latched flag stays true once shown.
 * @returns The latched flag — true for at least `minDurationMs` after `active`
 *          first becomes true.
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

  // Record the show time once the latch is visible.
  useEffect(() => {
    if (visible && shownAtRef.current == null) {
      shownAtRef.current = Date.now();
    }
  }, [visible]);

  // Release once loading is done and the minimum has elapsed. The state update
  // happens inside the timeout callback (not synchronously in the effect body).
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
