import React from 'react';
import { View, Modal } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
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
  labelKey: string;
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        {/* Absorb taps on the card so they don't bubble to the backdrop and close it */}
        <View
          style={styles.sortModal}
          onStartShouldSetResponder={() => true}
          testID="pantry-sort-modal"
        >
          <Text style={styles.sortModalTitle}>{t('pantrySort.title')}</Text>
          {SORT_OPTIONS.map(option => (
            <AppPressable
              key={option.key}
              // Derived from the option key, so a new sort option is reachable
              // from a test the moment it is added.
              testID={`pantry-sort-option-${option.key}`}
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
      </Pressable>
    </Modal>
  );
};

PantrySortModal.displayName = 'PantrySortModal';

const styles = StyleSheet.create(theme => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    padding: theme.spacing.mdPlus,
    width: '80%',
    maxWidth: theme.sizes.modal.sm,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: theme.spacing.xs,
        blurRadius: theme.spacing.base,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.15)',
      },
    ],
  },
  sortModalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
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
    fontSize: theme.typography.fontSize.sm + 1,
    color: theme.colors.textSecondary,
  },
  sortOptionLabelActive: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
