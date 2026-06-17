import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { FilterTabs } from '#components/molecules/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { NOTIFICATION_CATEGORIES } from '#store/slices/notificationSlice';

interface NotificationFiltersProps {
  selectedCategory: NotificationCategory | null;
  onCategoryChange: (category: NotificationCategory | null) => void;
}

// Sentinel id for the "All" pill, since the absence of a category is `null`
// but FilterTabs keys tabs by string id.
const ALL_TAB = 'all';
type FilterTabId = NotificationCategory | typeof ALL_TAB;

// 'HOME' → 'Home', 'SHOPPING_LIST' → 'Shopping List'
const titleCase = (value: string): string =>
  value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const TABS: FilterTabConfig<FilterTabId>[] = [
  { id: ALL_TAB, label: 'All' },
  ...NOTIFICATION_CATEGORIES.map(category => ({
    id: category,
    label: titleCase(category),
  })),
];

/**
 * Category filter row for the notifications list. Delegates to the shared
 * {@link FilterTabs} so it matches every other filter strip in the app
 * (animated sliding pill, scroll-edge fade, auto-centering) instead of
 * re-implementing one.
 */
export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  selectedCategory,
  onCategoryChange,
}) => {
  return (
    <View style={styles.container}>
      <FilterTabs<FilterTabId>
        tabs={TABS}
        activeTabId={selectedCategory ?? ALL_TAB}
        onTabChange={id =>
          onCategoryChange(id === ALL_TAB ? null : (id as NotificationCategory))
        }
        showCounts={false}
        testIDPrefix="notification-filter-tab"
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  // Hairline separator below the filter strip so it reads as a distinct band
  // above the list, consistent with the warm background showing through.
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
}));
