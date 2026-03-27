import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { SortOption, SortDirection } from './pantryDisplay/types';

interface PantrySortModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Current sort option */
  sortOption: SortOption;
  /** Current sort direction */
  sortDirection: SortDirection;
  /** Callback when a sort option is selected */
  onSelect: (option: SortOption) => void;
  /** Callback when modal is closed */
  onClose: () => void;
}

// Sort option configuration
const SORT_OPTIONS: Array<{
  key: SortOption;
  label: string;
  icon: string;
  library?: string;
}> = [
  {
    key: 'name',
    label: 'Name',
    icon: 'text-outline',
  },
  {
    key: 'expiry',
    label: 'Expiry Date',
    icon: 'calendar-outline',
  },
  {
    key: 'quantity',
    label: 'Quantity',
    icon: 'bar-chart',
  },
  {
    key: 'recent',
    label: 'Recently Added',
    icon: 'time-outline',
  },
];

/**
 * PantrySortModal - Modal for selecting pantry item sort order
 *
 * Displays:
 * - List of sort options (Name, Expiry, Quantity, Recent)
 * - Visual indicator for current selection
 * - Direction indicator (ascending/descending)
 */
export const PantrySortModal: React.FC<PantrySortModalProps> = ({
  visible,
  sortOption,
  sortDirection,
  onSelect,
  onClose,
}) => {
  const { theme } = useUnistyles();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sortModal}>
              <Text style={styles.sortModalTitle}>Sort by</Text>
              {SORT_OPTIONS.map(option => (
                <Pressable
                  key={option.key}
                  style={({ pressed }) => [
                    styles.sortOption,
                    sortOption === option.key && styles.sortOptionActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onSelect(option.key)}
                >
                  <Icon
                    name={option.icon}
                    size={18}
                    library={option.library}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.sortOptionLabel,
                      sortOption === option.key && styles.sortOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {sortOption === option.key && (
                    <Icon
                      name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={18}
                      color={theme.colors.primary}
                    />
                  )}
                </Pressable>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    padding: theme.spacing['5'],
    width: '80%',
    maxWidth: theme.sizes.modal.sm,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: theme.spacing.xs,
        blurRadius: theme.spacing['3'],
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
    paddingVertical: theme.spacing['3'] + 2,
    paddingHorizontal: theme.spacing['3'],
    borderRadius: theme.radii.lg,
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
