import React from 'react';
import { View } from 'react-native';
import { measureRenders } from 'reassure';
import { BaseItemCard } from '#components/molecules/BaseItemCard/BaseItemCard';
import { Text } from '#components/atoms/Text';
import {
  deleteAction,
  editAction,
} from '#components/molecules/SwipeableItem/commonActions';
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

// A row's two edges publish ONE `accessibilityActions` list, so a key may
// appear once per row, not once per edge — `SwipeableItem` throws on a
// duplicate. Mirrors the pantry's real vocabulary (`pantrySwipeActions`):
// domain verbs left, edit/delete right.
const LEFT_ACTIONS: SwipeAction[] = [
  {
    key: 'consume',
    labelKey: 'swipeActions.consume',
    icon: 'restaurant-outline',
    onPress: noop,
  },
  {
    key: 'waste',
    labelKey: 'swipeActions.recordWaste',
    icon: 'warning-outline',
    onPress: noop,
  },
];

const RIGHT_ACTIONS: SwipeAction[] = [editAction(noop), deleteAction(noop)];

test('BaseItemCard x40 swipeable rows', async () => {
  await measureRenders(
    <View>
      {ROWS.map(index => (
        <BaseItemCard
          key={index}
          itemId={`item-${index}`}
          testID={`perf-row-${index}`}
          onPress={noop}
          leftActions={LEFT_ACTIONS}
          rightActions={RIGHT_ACTIONS}
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
