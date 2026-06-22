import { useEffect, useRef, useState, type Component } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { ScrollMetrics } from '#hooks/ui/useScrollEdgeFades';
import { SCROLL_SLIDE } from '#constants/animations';

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
   * When set, item layouts + viewport width persist in a module cache under
   * this key so a second instance (sticky-header copy) starts centered without
   * a flicker. Omit for a single-instance scroller.
   */
  cacheKey?: string;
}

/**
 * Keeps the active item of a horizontal scroller centered: instantly on first
 * paint, then glided on later selection changes. Attach the returned
 * `animatedRef` to the scroller (an `Animated.ScrollView` or any
 * `Animated.createAnimatedComponent(ScrollView)`), wire `onItemLayout` onto
 * each item, `onScrollViewLayout` onto the scroller, and pass
 * `initialContentOffset` as its `contentOffset`.
 *
 * The glide runs on the UI thread via Reanimated's `scrollTo` (no per-frame JS
 * round-trip): `target` holds the destination offset and the reaction below
 * pushes it to the native scroller. `driving` gates that push so a manual user
 * scroll — which never writes `target` — is never fought, and the first paint
 * isn't yanked to 0 before the row is measured.
 *
 * The centering effect retries across a few frames because layout can land
 * after mount (or after a sticky copy remounts), and clamps to the real scroll
 * range so end items settle flush against the edge instead of over-scrolling.
 */
export function useCenterActiveItem<
  K,
  TScroll extends Component = Animated.ScrollView,
>({ activeKey, metrics, cacheKey }: UseCenterActiveItemParams<K>) {
  // Gates the glide: the first positioning is instant so the strip doesn't
  // visibly scroll on appear; later activeKey changes glide smoothly.
  const hasAutoCenteredRef = useRef(false);
  // Per-instance layouts when there's no shared cache.
  const instanceLayouts = useRef<Map<unknown, ItemLayout>>(new Map());

  const animatedRef = useAnimatedRef<TScroll>();
  const target = useSharedValue(0);
  const driving = useSharedValue(false);
  useAnimatedReaction(
    () => (driving.value ? target.value : null),
    x => {
      if (x !== null) scrollTo(animatedRef, x, 0, false);
    },
  );

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
        const from = metrics.current.scrollX;
        cancelAnimation(target);
        driving.set(true);
        // First positioning is instant (no visible scroll on appear); later
        // selection changes glide from the current scroll position, with the
        // duration scaled to distance so a far jump eases in rather than snaps.
        if (hasAutoCenteredRef.current && Math.abs(dest - from) >= 1) {
          const duration = Math.min(
            SCROLL_SLIDE.MAX_MS,
            Math.max(
              SCROLL_SLIDE.MIN_MS,
              Math.abs(dest - from) * SCROLL_SLIDE.MS_PER_PX,
            ),
          );
          target.set(from);
          target.set(
            withTiming(dest, { duration, easing: Easing.out(Easing.cubic) }),
          );
        } else {
          target.set(dest);
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
      // Cancel the retry loop and any in-flight glide so a new selection (or
      // unmount) doesn't fight the previous animation.
      if (rafId != null) cancelAnimationFrame(rafId);
      cancelAnimation(target);
    };
  }, [activeKey, cacheKey, metrics, target, driving]);

  const onItemLayout = (key: K, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layouts().set(key, { x, width });
    // On initial mount, scroll to the active item as soon as its position is
    // known — ahead of the effect's rAF, so there's no visible jump.
    if (key === activeKey) {
      const offset = centerOffset(activeKey);
      if (offset > 0) {
        cancelAnimation(target);
        driving.set(true);
        target.set(offset);
      }
    }
  };

  const onScrollViewLayout = (e: LayoutChangeEvent) => {
    if (cacheKey) {
      viewportWidthCache.set(cacheKey, e.nativeEvent.layout.width);
    }
  };

  return {
    animatedRef,
    onItemLayout,
    onScrollViewLayout,
    initialContentOffset,
  };
}
