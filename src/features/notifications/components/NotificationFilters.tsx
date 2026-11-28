import React from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#i18n';
import { StyleSheet } from 'react-native-unistyles';
import {
  ChipScrollRow,
  type ChipOption,
} from '#components/molecules/ChipScrollRow';
import { kitTestIDs } from '#components/testIDs';
import { NotificationCategory } from '#graphql/generated/schemaTypes';
import { NOTIFICATION_CATEGORIES } from '#features/notifications/types';
import { notificationsTestIDs } from '#features/notifications/testIDs';

interface NotificationFiltersProps {
  selectedCategory: NotificationCategory | null;
  onCategoryChange: (category: NotificationCategory | null) => void;
}

// The "All" chip's key, since the absence of a category is `null`.
const ALL_TAB = 'all';
type FilterTabId = NotificationCategory | typeof ALL_TAB;

// Static category → locale key map so the label lookup can't drift from the
// enum (a new category is a compile error until it gets a key).
const CATEGORY_LABEL_KEYS: Record<NotificationCategory, TranslationKey> = {
  [NotificationCategory.Home]: 'labels.home',
  [NotificationCategory.Pantry]: 'labels.pantry',
  [NotificationCategory.Recipe]: 'notifications.categoryRecipe',
  [NotificationCategory.Shopping]: 'labels.shopping',
  [NotificationCategory.System]: 'labels.system',
};

/** The notifications list's category filter, the kit's chip strip. */
export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  selectedCategory,
  onCategoryChange,
}) => {
  const { t } = useTranslation();

  // Resolve labels at render time so a language switch re-labels the tabs.
  const keys: FilterTabId[] = [ALL_TAB, ...NOTIFICATION_CATEGORIES];
  const options: ChipOption<FilterTabId>[] = keys.map(key => ({
    key,
    label: t(key === ALL_TAB ? 'labels.all' : CATEGORY_LABEL_KEYS[key]),
    testID: kitTestIDs.filterTab(notificationsTestIDs.filterTabs, key),
  }));

  return (
    <View style={styles.container}>
      <ChipScrollRow<FilterTabId>
        options={options}
        selected={selectedCategory ?? ALL_TAB}
        onSelect={id => onCategoryChange(id === ALL_TAB ? null : id)}
        edgeFadeColor="background"
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  // Hairline separator below the filter strip so it reads as a distinct band
  // above the list, consistent with the warm background showing through.
  container: {
    // The chip strip carries no inset of its own, and this screen has none.
    paddingHorizontal: theme.layout.pageGutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
}));
