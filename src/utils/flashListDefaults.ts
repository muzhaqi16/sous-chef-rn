import type { FlashListProps } from '@shopify/flash-list';

type FlashListPerformanceProps = Pick<
  FlashListProps<unknown>,
  'drawDistance' | 'maxItemsInRecyclePool'
>;

export const FLASHLIST_DEFAULTS: Record<string, FlashListPerformanceProps> = {
  fullScreen: {
    drawDistance: 250,
    maxItemsInRecyclePool: 15,
  },
  bottomSheet: {
    drawDistance: 150,
    maxItemsInRecyclePool: 10,
  },
};
