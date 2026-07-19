import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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

// Static category → locale key map so the label lookup can't drift from the
// enum (a new category is a compile error until it gets a key).
const CATEGORY_LABEL_KEYS: Record<NotificationCategory, string> = {
  [NotificationCategory.Home]: 'notifications.categoryHome',
  [NotificationCategory.Pantry]: 'notifications.categoryPantry',
  [NotificationCategory.Recipe]: 'notifications.categoryRecipe',
  [NotificationCategory.Shopping]: 'notifications.categoryShopping',
  [NotificationCategory.System]: 'notifications.categorySystem',
};

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
  const { t } = useTranslation();

  // Resolve labels at render time so a language switch re-labels the tabs.
  const tabs: FilterTabConfig<FilterTabId>[] = [
    { id: ALL_TAB, label: t('notifications.categoryAll') },
    ...NOTIFICATION_CATEGORIES.map(category => ({
      id: category,
      label: t(CATEGORY_LABEL_KEYS[category]),
    })),
  ];

  return (
    <View style={styles.container}>
      <FilterTabs<FilterTabId>
        tabs={tabs}
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
