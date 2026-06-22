// Slide tuning defaults: duration scales with distance (a near jump is snappy,
// a far one glides) but stays within these bounds. `ease-out cubic` decelerates
// into the resting position.
const DEFAULT_MS_PER_PX = 1.5;
const DEFAULT_MIN_MS = 250;
const DEFAULT_MAX_MS = 500;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export interface ScrollSlideOptions {
  /** Milliseconds of animation per px of distance, before clamping. */
  msPerPx?: number;
  /** Lower clamp on the computed duration, in ms. */
  minMs?: number;
  /** Upper clamp on the computed duration, in ms. */
  maxMs?: number;
  /** Easing applied to normalized time (0→1). Default ease-out cubic. */
  easing?: (t: number) => number;
}

/**
 * Eased, distance-scaled scroll slide. Animates an offset from `from` to `to`,
 * calling `onFrame(offset)` each frame so the caller drives a scroller with
 * `scrollTo({ x | y: offset, animated: false })`. Axis-agnostic — works for
 * horizontal or vertical scrollers.
 *
 * Returns a cancel function; call it before starting a new slide or on unmount.
 *
 * Why not `scrollTo({ animated: true })`: the native animation snaps in a
 * fixed, short time regardless of distance, so a far jump reads as a snap. This
 * gives a duration that grows with distance and a deceleration curve, so far
 * jumps glide.
 */
export function animateScrollOffset(
  from: number,
  to: number,
  onFrame: (offset: number) => void,
  options: ScrollSlideOptions = {},
): () => void {
  const {
    msPerPx = DEFAULT_MS_PER_PX,
    minMs = DEFAULT_MIN_MS,
    maxMs = DEFAULT_MAX_MS,
    easing = easeOutCubic,
  } = options;

  const distance = to - from;
  if (Math.abs(distance) < 1) {
    onFrame(to);
    return () => {};
  }

  const duration = Math.min(
    maxMs,
    Math.max(minMs, Math.abs(distance) * msPerPx),
  );
  const startTime = Date.now();
  let rafId: number | null = null;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const t = Math.min(1, (Date.now() - startTime) / duration);
    onFrame(from + distance * easing(t));
    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    }
  };
  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}
