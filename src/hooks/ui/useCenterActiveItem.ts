import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { ScrollMetrics } from '#hooks/ui/useScrollEdgeFades';
import { animateScrollOffset } from '#utils/animateScrollOffset';

interface ItemLayout {
  x: number;
  width: number;
}

// ── Module-level caches keyed by `cacheKey` ──
// Let a second instance of the same scroller (e.g. a sticky-header copy of a
// filter strip) start at the correct scroll offset without a flicker, by
// reusing the measurements the first instance recorded. Only used when a
// `cacheKey` is supplied; single-instance scrollers keep their layouts in a
// per-instance ref instead.
const itemLayoutCache = new Map<string, Map<unknown, ItemLayout>>();
const viewportWidthCache = new Map<string, number>();

// Offset that centers `activeKey` in the viewport, from cached measurements
// only (no refs) so it's safe to call from a render-time useState initializer.
function cachedCenterOffset(activeKey: unknown, cacheKey: string): number {
  const layouts = itemLayoutCache.get(cacheKey);
  const vp = viewportWidthCache.get(cacheKey);
  if (!layouts || !vp) return 0;
  const pos = layouts.get(activeKey);
  if (!pos) return 0;
  return Math.max(0, pos.x - vp / 2 + pos.width / 2);
}

interface UseCenterActiveItemParams<K> {
  /** The currently selected item's key — centering re-runs when it changes. */
  activeKey: K;
  /**
   * Live viewport/content widths, shared with `useScrollEdgeFades` so the same
   * numbers aren't measured twice.
   */
  metrics: React.RefObject<ScrollMetrics>;
  /**
   * Imperative scroll, owned by the caller because RN's and RNGH's ScrollView
   * refs differ. `(x, animated) => ref.current?.scrollTo({ x, animated })`.
   */
  scrollTo: (x: number, animated: boolean) => void;
  /**
   * When set, item layouts + viewport width persist in a module cache under
   * this key so a second instance (sticky-header copy) starts centered without
   * a flicker. Omit for a single-instance scroller.
   */
  cacheKey?: string;
}

/**
 * Keeps the active item of a horizontal scroller centered: instantly on first
 * paint, then animated on later selection changes. Wire `onItemLayout` onto
 * each item, `onScrollViewLayout` onto the ScrollView, and pass
 * `initialContentOffset` as its `contentOffset`.
 *
 * The centering effect retries across a few frames because layout can land
 * after mount (or after a sticky copy remounts), and clamps to the real scroll
 * range so end items settle flush against the edge instead of over-scrolling.
 */
export function useCenterActiveItem<K>({
  activeKey,
  metrics,
  scrollTo,
  cacheKey,
}: UseCenterActiveItemParams<K>) {
  // Gates the animation: the first positioning is instant so the strip doesn't
  // visibly scroll on appear; later activeKey changes slide smoothly.
  const hasAutoCenteredRef = useRef(false);
  // Per-instance layouts when there's no shared cache.
  const instanceLayouts = useRef<Map<unknown, ItemLayout>>(new Map());
  // Hold the latest scrollTo so the centering effect can call it without taking
  // it as a dependency (which would re-center on every render).
  const scrollToRef = useRef(scrollTo);
  useEffect(() => {
    scrollToRef.current = scrollTo;
  });

  const layouts = (): Map<unknown, ItemLayout> => {
    if (!cacheKey) return instanceLayouts.current;
    let cached = itemLayoutCache.get(cacheKey);
    if (!cached) {
      cached = new Map();
      itemLayoutCache.set(cacheKey, cached);
    }
    return cached;
  };
  const viewportW = (): number =>
    metrics.current.viewportW ||
    (cacheKey ? viewportWidthCache.get(cacheKey) ?? 0 : 0);
  const centerOffset = (key: K): number => {
    const pos = layouts().get(key);
    const vp = viewportW();
    if (!pos || vp <= 0) return 0;
    return Math.max(0, pos.x - vp / 2 + pos.width / 2);
  };

  // Start the sticky copy at the cached offset; a fresh first instance starts
  // at 0 and the effect below centers it once measured.
  const [initialContentOffset] = useState(() => ({
    x: cacheKey ? cachedCenterOffset(activeKey, cacheKey) : 0,
    y: 0,
  }));

  useEffect(() => {
    let cancelled = false;
    let rafId: number | null = null;
    let cancelSlide: (() => void) | null = null;

    const tryCenter = (attempt: number) => {
      if (cancelled) return;
      const map = cacheKey
        ? itemLayoutCache.get(cacheKey)
        : instanceLayouts.current;
      const pos = map?.get(activeKey);
      const vp =
        metrics.current.viewportW ||
        (cacheKey ? viewportWidthCache.get(cacheKey) ?? 0 : 0);
      if (pos && vp > 0) {
        const centered = Math.max(0, pos.x - vp / 2 + pos.width / 2);
        const contentW = metrics.current.contentW;
        const maxScroll = contentW > 0 ? Math.max(0, contentW - vp) : centered;
        const dest = Math.min(centered, maxScroll);
        // First positioning is instant (no visible scroll on appear); later
        // selection changes glide from the current scroll position.
        if (hasAutoCenteredRef.current) {
          cancelSlide = animateScrollOffset(metrics.current.scrollX, dest, x =>
            scrollToRef.current(x, false),
          );
        } else {
          scrollToRef.current(dest, false);
          hasAutoCenteredRef.current = true;
        }
        return;
      }
      if (attempt < 5) {
        rafId = requestAnimationFrame(() => tryCenter(attempt + 1));
      }
    };

    rafId = requestAnimationFrame(() => tryCenter(0));
    return () => {
      cancelled = true;
      // Cancel the retry loop and any in-flight slide so a new selection (or
      // unmount) doesn't fight the previous animation.
      if (rafId != null) cancelAnimationFrame(rafId);
      cancelSlide?.();
    };
  }, [activeKey, cacheKey, metrics]);

  const onItemLayout = (key: K, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layouts().set(key, { x, width });
    // On initial mount, scroll to the active item as soon as its position is
    // known — ahead of the effect's rAF, so there's no visible jump.
    if (key === activeKey) {
      const offset = centerOffset(activeKey);
      if (offset > 0) scrollToRef.current(offset, false);
    }
  };

  const onScrollViewLayout = (e: LayoutChangeEvent) => {
    if (cacheKey) {
      viewportWidthCache.set(cacheKey, e.nativeEvent.layout.width);
    }
  };

  return { onItemLayout, onScrollViewLayout, initialContentOffset };
}
