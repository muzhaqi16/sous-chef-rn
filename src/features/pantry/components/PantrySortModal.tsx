import { pantryTestIDs } from '#features/pantry/testIDs';
import React from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { Sheet } from '#components/templates/Sheet';
import { Icon } from '#utils/iconUtils';
import type { SortOption, SortDirection } from './pantryDisplay/types';
import {
  PantrySortOption,
  PantrySortDirection,
} from '#store/slices/preferenceTypes';

interface PantrySortModalProps {
  visible: boolean;
  sortOption: SortOption;
  sortDirection: SortDirection;
  onSelect: (option: SortOption) => void;
  onClose: () => void;
}

const SORT_OPTIONS: Array<{
  key: SortOption;
  labelKey: TranslationKey;
  icon: string;
  library?: string;
}> = [
  {
    key: PantrySortOption.NAME,
    labelKey: 'pantrySort.sortName',
    icon: 'text-outline',
  },
  {
    key: PantrySortOption.EXPIRY,
    labelKey: 'pantrySort.sortExpiryDate',
    icon: 'calendar-outline',
  },
  {
    key: PantrySortOption.QUANTITY,
    labelKey: 'labels.quantity',
    icon: 'bar-chart',
  },
  {
    key: PantrySortOption.RECENT,
    labelKey: 'pantrySort.sortRecentlyAdded',
    icon: 'time-outline',
  },
];

export const PantrySortModal: React.FC<PantrySortModalProps> = ({
  visible,
  sortOption,
  sortDirection,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();
  return (
    <Sheet
      mode="action"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['45%']}
      title={t('pantrySort.title')}
    >
      <View testID={pantryTestIDs.sortModal}>
        {SORT_OPTIONS.map(option => (
          <AppPressable
            key={option.key}
            // Derived from the option key, so a new sort option is reachable
            // from a test the moment it is added.
            testID={pantryTestIDs.sortOption(option.key)}
            style={[
              styles.sortOption,
              sortOption === option.key && styles.sortOptionActive,
            ]}
            onPress={() => onSelect(option.key)}
          >
            <Icon
              name={option.icon}
              size={18}
              library={option.library}
              tone="primary"
            />
            <Text
              role="bodyStrong"
              style={[
                styles.sortOptionLabel,
                sortOption === option.key && styles.sortOptionLabelActive,
              ]}
            >
              {t(option.labelKey)}
            </Text>
            {sortOption === option.key && (
              <Icon
                name={
                  sortDirection === PantrySortDirection.ASC
                    ? 'arrow-up'
                    : 'arrow-down'
                }
                size={18}
                tone="primary"
              />
            )}
          </AppPressable>
        ))}
      </View>
    </Sheet>
  );
};

PantrySortModal.displayName = 'PantrySortModal';

const styles = StyleSheet.create(theme => ({
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.basePlus,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  sortOptionActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  sortOptionLabel: {
    flex: 1,
    color: theme.colors.textSecondary,
  },
  sortOptionLabelActive: {
    color: theme.colors.primary,
  },
}));
