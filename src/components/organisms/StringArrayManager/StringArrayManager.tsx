import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';

export interface StringArrayManagerProps {
  /**
   * Section title displayed at the top
   */
  title: string;

  /**
   * Array of string items to display
   */
  items: string[];

  /**
   * Callback when a new item is added
   * Should return true on success, false on failure
   */
  onAdd: (item: string) => Promise<boolean>;

  /**
   * Callback when an item is removed
   */
  onRemove: (item: string) => Promise<void>;

  /**
   * Placeholder text for the add input modal
   */
  inputPlaceholder?: string;

  /**
   * Label for the add button modal title
   */
  addButtonLabel?: string;

  /**
   * Message to display when array is empty
   */
  emptyMessage?: string;

  /**
   * Maximum number of items allowed (optional)
   */
  maxItems?: number;

  /**
   * Custom validation function
   * Return error message if invalid, null if valid
   */
  validate?: (item: string) => string | null;

  /**
   * Transform function applied before adding (e.g., capitalize)
   */
  transform?: (item: string) => string;

  /**
   * Show the add button (default: true)
   */
  showAddButton?: boolean;

  /**
   * Custom style for the container
   */
  containerStyle?: any;
}

/**
 * StringArrayManager - A reusable component for managing string arrays
 *
 * Provides a complete UI for displaying, adding, and removing string items
 * with chips, modal input, validation, and empty states.
 *
 * @example Basic usage (Dietary Profile - Cuisines)
 * ```tsx
 * <StringArrayManager
 *   title="Preferred Cuisines"
 *   items={profile.preferredCuisines}
 *   onAdd={async (cuisine) => {
 *     const success = await updateDietaryProfile({
 *       preferredCuisines: [...profile.preferredCuisines, cuisine]
 *     });
 *     return success;
 *   }}
 *   onRemove={async (cuisine) => {
 *     await updateDietaryProfile({
 *       preferredCuisines: profile.preferredCuisines.filter(c => c !== cuisine)
 *     });
 *   }}
 *   inputPlaceholder="e.g., Italian, Mexican, Thai"
 *   addButtonLabel="Add Cuisine"
 *   emptyMessage="No cuisines added yet"
 * />
 * ```
 *
 * @example With validation and max items
 * ```tsx
 * <StringArrayManager
 *   title="Tags"
 *   items={item.tags}
 *   onAdd={handleAddTag}
 *   onRemove={handleRemoveTag}
 *   maxItems={5}
 *   validate={(tag) => {
 *     if (tag.length < 2) return 'Tag must be at least 2 characters';
 *     if (tag.length > 20) return 'Tag must be less than 20 characters';
 *     return null;
 *   }}
 *   transform={(tag) => tag.trim().toLowerCase()}
 * />
 * ```
 */
export const StringArrayManager: React.FC<StringArrayManagerProps> = ({
  title,
  items,
  onAdd,
  onRemove,
  inputPlaceholder = 'Enter value...',
  addButtonLabel = 'Add Item',
  emptyMessage = 'No items added yet',
  maxItems,
  validate,
  transform = item => item.trim(),
  showAddButton = true,
  containerStyle,
}) => {
  const { theme } = useUnistyles();
  const [isAddingModal, setIsAddingModal] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddPress = () => {
    if (maxItems && items.length >= maxItems) {
      setError(`Maximum ${maxItems} items allowed`);
      return;
    }
    setIsAddingModal(true);
  };

  const handleAdd = async () => {
    setError('');

    const transformedItem = transform(newItem);

    // Basic validation
    if (!transformedItem) {
      setError('Please enter a value');
      return;
    }

    // Check for duplicates
    if (items.includes(transformedItem)) {
      setError('This item already exists');
      return;
    }

    // Custom validation
    if (validate) {
      const validationError = validate(transformedItem);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setLoading(true);
    try {
      const success = await onAdd(transformedItem);

      if (success) {
        setNewItem('');
        setError('');
        setIsAddingModal(false);
      } else {
        setError('Failed to add item');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (item: string) => {
    try {
      await onRemove(item);
    } catch (err: any) {
      console.error('Failed to remove item:', err);
    }
  };

  const handleCancel = () => {
    setIsAddingModal(false);
    setNewItem('');
    setError('');
  };

  return (
    <View style={[commonStyles.card, containerStyle]}>
      {/* Header with title and add button */}
      <View style={styles.header}>
        <Text style={commonStyles.subtitle}>{title}</Text>
        {showAddButton && (
          <Pressable onPress={handleAddPress} style={({pressed}) => [styles.addButton, pressed && styles.pressed]}>
            <Icon
              name="add"
              size={20}
              color={theme.colors.primary}
            />
          </Pressable>
        )}
      </View>

      {/* Chip grid using static chips */}
      <View style={styles.chipContainer}>
        {items.map((item, index) => (
          <View key={index} style={styles.chipWrapper}>
            <View style={styles.displayChip}>
              <Text style={styles.displayChipText}>{item}</Text>
            </View>
            <Pressable
              style={({pressed}) => [styles.removeButton, pressed && styles.pressed]}
              onPress={() => handleRemove(item)}
            >
              <Icon
                name="close-circle-outline"
                size={18}
                color={theme.colors.error}
              />
            </Pressable>
          </View>
        ))}

        {/* Empty state */}
        {items.length === 0 && (
          <Text style={commonStyles.bodySecondary}>{emptyMessage}</Text>
        )}
      </View>

      {/* Add modal */}
      <Modal
        visible={isAddingModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[commonStyles.card, styles.modalContent]}>
            <Text style={commonStyles.h3}>{addButtonLabel}</Text>

            <TextInput
              style={[commonStyles.input, error && styles.inputError]}
              value={newItem}
              onChangeText={text => {
                setNewItem(text);
                setError(''); // Clear error on input
              }}
              placeholder={inputPlaceholder}
              autoFocus
              editable={!loading}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.modalButtons}>
              <Pressable
                style={({pressed}) => [commonStyles.button, styles.modalButton, pressed && styles.pressed]}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={commonStyles.buttonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({pressed}) => [
                  commonStyles.button,
                  commonStyles.buttonPrimary,
                  styles.modalButton,
                  loading && styles.buttonDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={handleAdd}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.onPrimary} />
                ) : (
                  <Text
                    style={[
                      commonStyles.buttonText,
                      commonStyles.buttonTextPrimary,
                    ]}
                  >
                    Add
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  chipWrapper: {
    position: 'relative',
    margin: theme.spacing.xs,
  },
  displayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii['2xl'],
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.chipSelectedBackground,
  },
  displayChipText: {
    fontSize: theme.typography.fontSize.sm + 1,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.chipSelectedText,
  },
  removeButton: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.full,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: theme.spacing.lg,
  },
  inputError: {
    borderColor: theme.colors.danger,
    borderWidth: 1,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
