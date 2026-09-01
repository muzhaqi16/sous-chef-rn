import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { errorService } from '#/services/errorService';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { localizedErrorMessage } from '#/services/errorService';
import { commonStyles } from '#/styles/commonStyles';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { Text } from '#components/atoms/Text';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';

const defaultTransform = (item: string) => item.trim();

export interface StringArrayManagerProps {
  title: string;

  items: string[];

  /** Returns true on success, false on failure. */
  onAdd: (item: string) => Promise<boolean>;

  onRemove: (item: string) => Promise<void>;

  inputPlaceholder?: string;

  addButtonLabel?: string;

  emptyMessage?: string;

  maxItems?: number;

  /** Returns an error message, or null when valid. */
  validate?: (item: string) => string | null;

  /** Applied before adding (e.g. capitalize). */
  transform?: (item: string) => string;

  /** Default true. */
  showAddButton?: boolean;

  containerStyle?: StyleProp<ViewStyle>;
}

/** Displays, adds and removes string items as chips, with a modal input. */
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
  transform = defaultTransform,
  showAddButton = true,
  containerStyle,
}) => {
  const { t } = useTranslation();
  const [isAddingModal, setIsAddingModal] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCancel = () => {
    setIsAddingModal(false);
    setNewItem('');
    setError('');
  };

  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible: isAddingModal,
    onDismiss: handleCancel,
    snapPoints: ['30%'],
  });

  const handleAddPress = () => {
    if (maxItems && items.length >= maxItems) {
      setError(`Maximum ${maxItems} items allowed`);
      return;
    }
    setIsAddingModal(true);
  };

  const handleAdd = () => {
    setError('');

    const transformedItem = transform(newItem);

    if (!transformedItem) {
      setError('Please enter a value');
      return;
    }

    if (items.includes(transformedItem)) {
      setError('This item already exists');
      return;
    }

    if (validate) {
      const validationError = validate(transformedItem);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    executeWithLoadingState(
      async () => {
        const success = await onAdd(transformedItem);

        if (success) {
          setNewItem('');
          setError('');
          setIsAddingModal(false);
        } else {
          setError(t('errors.addItemFailed'));
        }
      },
      setLoading,
      (err: unknown) => {
        setError(localizedErrorMessage(err, t('errors.generic')));
      },
    );
  };

  const handleRemove = async (item: string) => {
    try {
      await onRemove(item);
    } catch (err) {
      errorService.reportError(err, { operation: 'removeStringArrayItem' });
    }
  };

  return (
    <View style={[commonStyles.card, containerStyle]}>
      <View style={styles.header}>
        <Text style={commonStyles.subtitle}>{title}</Text>
        {!!showAddButton && (
          <AppPressable onPress={handleAddPress} style={styles.addButton}>
            <Icon name="add" size={20} tone="primary" />
          </AppPressable>
        )}
      </View>
      <View style={styles.chipContainer}>
        {items.map((item, index) => (
          <View key={index} style={styles.chipWrapper}>
            <View style={styles.displayChip}>
              <Text style={styles.displayChipText}>{item}</Text>
            </View>
            <AppPressable
              style={styles.removeButton}
              onPress={() => handleRemove(item)}
            >
              <Icon name="close-circle-outline" size={18} tone="error" />
            </AppPressable>
          </View>
        ))}

        {items.length === 0 && (
          <Text style={commonStyles.bodySecondary}>{emptyMessage}</Text>
        )}
      </View>
      <BottomSheetModal ref={ref} {...modalProps}>
        <BottomSheetView style={[styles.sheetContent, contentContainerStyle]}>
          <BottomSheetHeader
            title={addButtonLabel}
            onCancel={handleCancel}
            onConfirm={handleAdd}
            confirmLabel={t('labels.add')}
            confirmDisabled={loading}
          />

          <ThemedBottomSheetTextInput
            style={[styles.sheetInput, error && styles.inputError]}
            value={newItem}
            onChangeText={text => {
              setNewItem(text);
              setError('');
            }}
            placeholder={inputPlaceholder}
            autoFocus
            editable={!loading}
          />

          {error ? (
            <Text size="sm" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
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
    borderCurve: 'continuous',
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
  sheetContent: {
    paddingHorizontal: theme.spacing.lg,
  },
  sheetInput: {
    fontSize: theme.typography.fontSize.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceVariant,
    color: theme.colors.textPrimary,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
