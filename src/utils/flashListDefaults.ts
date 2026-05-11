import { Dimensions } from 'react-native';
import type { FlashListProps } from '@shopify/flash-list';

type FlashListPerformanceProps = Pick<
  FlashListProps<unknown>,
  'drawDistance' | 'maxItemsInRecyclePool' | 'onEndReachedThreshold'
>;

// onEndReachedThreshold: 0.5 fires pagination when the user is half a viewport
// away from the end — early enough to hide network latency, late enough to
// avoid double-fetches on rubber-banding scrolls. The "analyticsHeavy" preset
// uses 0.8 for screens whose next-page render is expensive (Skia charts) and
// benefits from earlier prefetch.
export const FLASHLIST_DEFAULTS: Record<string, FlashListPerformanceProps> = {
  fullScreen: {
    drawDistance: Math.round(Dimensions.get('window').height * 2),
    maxItemsInRecyclePool: 15,
    onEndReachedThreshold: 0.5,
  },
  bottomSheet: {
    drawDistance: 250,
    maxItemsInRecyclePool: 12,
    onEndReachedThreshold: 0.5,
  },
  analyticsHeavyFullScreen: {
    drawDistance: Math.round(Dimensions.get('window').height * 2),
    maxItemsInRecyclePool: 15,
    onEndReachedThreshold: 0.8,
  },
};

// ── Sticky header sentinel pattern ──
// Used to prepend a "sticky tab" item to FlashList data arrays so that
// stickyHeaderIndices pins it at the top natively (UI thread, no JS bridge).
// Screens provide their own renderItem that checks isStickyHeaderSentinel()
// and renders their specific tab component for sentinel items.

/** Discriminator for sentinel items prepended to FlashList data arrays. */
export interface StickyHeaderSentinel {
  __sentinel: 'stickyHeader';
}

/** Singleton sentinel instance — prepend to data[0] for stickyHeaderIndices. */
export const STICKY_HEADER_SENTINEL: StickyHeaderSentinel = {
  __sentinel: 'stickyHeader',
};

/** Type guard for sentinel items in a mixed data array. */
export const isStickyHeaderSentinel = (
  item: unknown,
): item is StickyHeaderSentinel =>
  typeof item === 'object' &&
  item !== null &&
  '__sentinel' in item &&
  (item as StickyHeaderSentinel).__sentinel === 'stickyHeader';

/** Stable stickyHeaderIndices array — data[0] is always the sticky sentinel. */
export const STICKY_HEADER_INDICES = [0];

/** Default sticky header config — native driver for smooth Android performance. */
export const STICKY_HEADER_CONFIG = { useNativeDriver: true };
