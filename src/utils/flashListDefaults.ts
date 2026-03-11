import type { FlashListProps } from '@shopify/flash-list';

type FlashListPerformanceProps = Pick<
  FlashListProps<unknown>,
  'drawDistance' | 'maxItemsInRecyclePool'
>;

export const FLASHLIST_DEFAULTS = {
  fullScreen: {
    drawDistance: 250,
    maxItemsInRecyclePool: 15,
  },
  bottomSheet: {
    drawDistance: 150,
    maxItemsInRecyclePool: 10,
  },
} as const satisfies Record<string, FlashListPerformanceProps>;
