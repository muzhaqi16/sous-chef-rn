import React from 'react';
import { View } from 'react-native';
import { measureRenders } from 'reassure';
import { BaseItemCard } from '#components/molecules/BaseItemCard/BaseItemCard';
import { Text } from '#components/atoms/Text';
import type { SwipeAction } from '#components/molecules/SwipeableItem/types';

/**
 * The pantry/shopping row shell, rendered as a list-sized batch.
 *
 * **Why `BaseItemCard` and not `PantryItemCard`:** the row's render cost lives
 * here — on device, `BaseItemCard` measures 12.7 ms inclusive per recycled row
 * against `PantryItemCard`'s own 0.7 ms self. `PantryItemCard` adds only a
 * `useFragment` read and a context lookup on top, and wrapping this scenario in
 * an Apollo provider would measure provider setup and cache-read variance
 * rather than the tree that actually costs something.
 *
 * **What this guards:** the swipeable path. `hasSwipeActions` mounts
 * `SwipeableItem` (RNGH `ReanimatedSwipeable` + two gesture detectors), which is
 * the single most expensive part of a row, so the scenario passes actions —
 * a regression that only shows on swipeable rows would otherwise be invisible.
 *
 * **Sizing:** 40 rows, matching `TextCluster.perf-test.tsx`. Below ~1 ms a
 * scenario measures timer granularity, not code — see that file's note.
 *
 * NOTE: this guards RENDER cost only. It cannot see the frame cost that
 * dominates scrolling on device (GPU compositing — see
 * `docs/flashlist-performance-analysis.md` § Two different symptoms), so a green
 * run here is not evidence that scrolling is smooth.
 */
const ROWS = Array.from({ length: 40 }, (_, index) => index);

const noop = () => {};

const SWIPE_ACTIONS: SwipeAction[] = [
  {
    key: 'consume',
    labelKey: 'pantry.consume',
    icon: 'restaurant',
    onPress: noop,
  },
  { key: 'waste', labelKey: 'pantry.waste', icon: 'trash', onPress: noop },
];

test('BaseItemCard x40 swipeable rows', async () => {
  await measureRenders(
    <View>
      {ROWS.map(index => (
        <BaseItemCard
          key={index}
          itemId={`item-${index}`}
          testID={`perf-row-${index}`}
          onPress={noop}
          leftActions={SWIPE_ACTIONS}
          rightActions={SWIPE_ACTIONS}
          leftElement={<View style={{ width: 48, height: 48 }} />}
          rightElement={
            <Text size="sm" tone="secondary">
              2 L
            </Text>
          }
        >
          <Text size="md" weight="semibold">{`Item ${index}`}</Text>
          <Text size="sm" tone="secondary">
            Fridge
          </Text>
        </BaseItemCard>
      ))}
    </View>,
  );
});
