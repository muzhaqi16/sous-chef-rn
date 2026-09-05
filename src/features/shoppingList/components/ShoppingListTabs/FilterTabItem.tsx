import React, { useRef } from 'react';
import { View } from 'react-native';
import { FilterTabsItem } from '#components/organisms/FilterTabs/FilterTabsItem';

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
  const tabRef = useRef<View>(null);

  const handleLayout = () => {
    if (!onMeasure) return;
    requestAnimationFrame(() => {
      tabRef.current?.measure((_x, _y, w, h, pageX, pageY) => {
        if (w > 0 && h > 0) {
          onMeasure({ x: pageX, y: pageY, width: w, height: h });
        }
      });
    });
  };

  return (
    <View
      ref={onMeasure ? tabRef : undefined}
      collapsable={false}
      onLayout={onMeasure ? handleLayout : undefined}
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
