import React from 'react';
import { View } from 'react-native';
import { FilterTabsItem } from '#components/organisms/FilterTabs/FilterTabsItem';
import { useMeasuredRect } from '#hooks/ui/useMeasuredRect';

interface FilterTabItemProps {
  routeKey: string;
  title: string;
  isActive: boolean;
  count?: number;
  onPress: () => void;
  testID: string;
  /** Optional: measure this tab's screen-coordinate rect for tutorial spotlight */
  onMeasure?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

/**
 * The shared pill, wrapped so a tab bar keyed by ROUTE can render one and the
 * tutorial can measure it. The look and the press behaviour are the kit's.
 */
const FilterTabItemComponent: React.FC<FilterTabItemProps> = ({
  routeKey,
  title,
  isActive,
  count,
  onPress,
  testID,
  onMeasure,
}) => {
  const { ref: tabRef, measure: measureTab } = useMeasuredRect(onMeasure);

  return (
    <View
      ref={tabRef}
      collapsable={false}
      onLayout={onMeasure ? measureTab : undefined}
    >
      <FilterTabsItem
        tab={{ id: routeKey, label: title }}
        isActive={isActive}
        isFiltered={false}
        count={count}
        showCounts={count !== undefined}
        isCompact={false}
        onPress={onPress}
        testID={testID}
      />
    </View>
  );
};

export const FilterTabItem = FilterTabItemComponent;
FilterTabItem.displayName = 'FilterTabItem';
