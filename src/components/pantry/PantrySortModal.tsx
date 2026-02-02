import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, IconLibrary } from '#utils/iconUtils';
import type { SortOption, SortDirection } from './PantryContent';

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
  library?: IconLibrary;
}> = [
  {
    key: 'name',
    label: 'Name',
    icon: 'sort-by-alpha',
    library: 'MaterialIcons',
  },
  {
    key: 'expiry',
    label: 'Expiry Date',
    icon: 'calendar-month',
  },
  {
    key: 'quantity',
    label: 'Quantity',
    icon: 'bar-chart',
  },
  {
    key: 'recent',
    label: 'Recently Added',
    icon: 'clock',
    library: 'Feather',
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
export const PantrySortModal: React.FC<PantrySortModalProps> = React.memo(
  ({ visible, sortOption, sortDirection, onSelect, onClose }) => {
    const { theme } = useUnistyles();

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sortModal}>
                <Text style={styles.sortModalTitle}>Sort by</Text>
                {SORT_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.key}
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
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.sortOptionLabel,
                        sortOption === option.key &&
                          styles.sortOptionLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {sortOption === option.key && (
                      <Icon
                        name={
                          sortDirection === 'asc'
                            ? 'arrow-upward'
                            : 'arrow-downward'
                        }
                        size={18}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  },
);

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
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: theme.spacing.xs },
    shadowOpacity: 0.15,
    shadowRadius: theme.spacing['3'],
    elevation: 10,
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
}));
