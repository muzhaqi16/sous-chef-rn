import { useEffect, useRef } from 'react';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';
import {
  cancelAnimation,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { ScrollMetrics } from '#hooks/ui/useScrollEdgeFades';
import { SCROLL_SLIDE } from '#constants/animations';
import { motion } from '#theme/motion';

interface ItemLayout {
  x: number;
  width: number;
}

interface UseCenterActiveItemParams<K> {
  /** The currently selected item's key — centering re-runs when it changes. */
  activeKey: K;
  /**
   * Live viewport/content widths, shared with `useScrollEdgeFades` so the same
   * numbers aren't measured twice.
   */
  metrics: React.RefObject<ScrollMetrics>;
}

/**
 * Centers a horizontal scroller's active item: instantly on first paint, glided
 * afterwards. Wire `animatedRef` and `onItemLayout`. The UI-thread glide is
 * gated by `driving`, so a manual
 * scroll is never fought and the first paint is not yanked to 0 pre-measurement.
 */
export function useCenterActiveItem<K>({
  activeKey,
  metrics,
}: UseCenterActiveItemParams<K>) {
  // Gates the glide: the first positioning is instant so the strip doesn't
  // visibly scroll on appear; later activeKey changes glide smoothly.
  const hasAutoCenteredRef = useRef(false);
  const itemLayouts = useRef<Map<unknown, ItemLayout>>(new Map());

  const animatedRef = useAnimatedRef<ScrollViewInstance>();
  const target = useSharedValue(0);
  const driving = useSharedValue(false);
  useAnimatedReaction(
    () => (driving.get() ? target.get() : null),
    x => {
      if (x !== null) scrollTo(animatedRef, x, 0, false);
    },
  );

  const centerOffset = (key: K): number => {
    const pos = itemLayouts.current.get(key);
    const vp = metrics.current.viewportW;
    if (!pos || vp <= 0) return 0;
    return Math.max(0, pos.x - vp / 2 + pos.width / 2);
  };

  useEffect(() => {
    let cancelled = false;
    let rafId: number | null = null;

    const tryCenter = (attempt: number) => {
      if (cancelled) return;
      const pos = itemLayouts.current.get(activeKey);
      const vp = metrics.current.viewportW;
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
            withTiming(dest, { duration, easing: motion.easing.decelerate }),
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
  }, [activeKey, metrics, target, driving]);

  const onItemLayout = (key: K, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    itemLayouts.current.set(key, { x, width });
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

  return {
    animatedRef,
    onItemLayout,
  };
}
