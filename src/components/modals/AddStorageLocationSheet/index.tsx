import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs, useBottomSheetBackHandler } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { StorageType } from '#generated';

interface AddStorageLocationSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreateLocation: (input: { name: string; type: StorageType }) => Promise<unknown>;
  creating?: boolean;
}

/**
 * AddStorageLocationSheet - Simple bottom sheet for quick storage location creation
 *
 * Features:
 * - Text input for location name
 * - Cancel/Create buttons
 * - Creates location with default type (Other)
 * - Used from PantryMain for quick creation
 */
export const AddStorageLocationSheet: React.FC<AddStorageLocationSheetProps> = ({
  visible,
  onClose,
  onCreateLocation,
  creating = false,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const inputRef = useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(bottomSheetRef, visible);

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Control visibility
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      // Focus input after a short delay for animation
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      bottomSheetRef.current?.dismiss();
      // Reset state when closing
      setName('');
      setError(null);
    }
  }, [visible]);

  const handleCreate = useCallback(async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Location name is required');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    try {
      await onCreateLocation({
        name: trimmedName,
        type: StorageType.Custom,
      });
      onClose();
    } catch {
      setError('Failed to create location');
    }
  }, [name, onCreateLocation, onClose]);

  const handleCancel = useCallback(() => {
    setName('');
    setError(null);
    onClose();
  }, [onClose]);

  const handleNameChange = useCallback((text: string) => {
    setName(text);
    if (error) setError(null);
  }, [error]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const isCreateDisabled = creating || name.trim().length < 2;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['30%', '50%']}
      index={0}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView
        style={[styles.content, { paddingBottom: insets.bottom + 16 }]}
      >
        {/* Header with Cancel/Create */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text
              style={[styles.cancelText, { color: theme.colors.textSecondary }]}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Add Location
          </Text>

          <TouchableOpacity
            onPress={handleCreate}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Create"
            disabled={isCreateDisabled}
          >
            {creating ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  {
                    color: isCreateDisabled
                      ? theme.colors.textTertiary
                      : theme.colors.primary,
                  },
                ]}
              >
                Create
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Input Field */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Location Name
          </Text>

          <BottomSheetTextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: error ? theme.colors.error : theme.colors.border,
              },
            ]}
            value={name}
            onChangeText={handleNameChange}
            placeholder="e.g., Kitchen Cabinet, Garage Shelf"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={50}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          {error && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}

          <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
            You can edit details later in Settings &gt; Storage Locations
          </Text>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  headerButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    minWidth: 60,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    fontSize: theme.typography.fontSize.md,
  },
  saveText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginBottom: theme.spacing.lg,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
    marginBottom: theme.spacing.sm,
  },
  input: {
    fontSize: theme.typography.fontSize.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  hint: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.sm,
  },
}));

export default AddStorageLocationSheet;
