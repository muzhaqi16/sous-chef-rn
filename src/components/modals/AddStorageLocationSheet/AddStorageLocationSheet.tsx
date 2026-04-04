import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StorageType } from '#generated';

/** Module-level async wrapper to keep try-catch out of the component body (React Compiler). */
async function executeCreateLocation(
  createFn: (input: { name: string; type: StorageType }) => Promise<unknown>,
  input: { name: string; type: StorageType },
): Promise<{ error?: string }> {
  try {
    await createFn(input);
    return {};
  } catch {
    return { error: 'Failed to create location' };
  }
}

interface AddStorageLocationSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreateLocation: (input: {
    name: string;
    type: StorageType;
  }) => Promise<unknown>;
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
export const AddStorageLocationSheet: React.FC<
  AddStorageLocationSheetProps
> = ({ visible, onClose, onCreateLocation, creating = false }) => {
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      visible,
      onDismiss: onClose,
      snapPoints: ['35%'],
      keyboardBehavior: 'interactive',
    });
  const inputRef =
    useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when sheet closes (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) {
      setName('');
      setError(null);
    }
  }

  // Focus input after sheet open animation completes
  useEffect(() => {
    if (visible) {
      requestIdleCallback(() => inputRef.current?.focus());
    }
  }, [visible]);

  const handleCreate = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Location name is required');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    const result = await executeCreateLocation(onCreateLocation, {
      name: trimmedName,
      type: StorageType.Custom,
    });
    if (result.error) {
      setError(result.error);
    } else {
      onClose();
    }
  };

  const handleCancel = () => {
    setName('');
    setError(null);
    onClose();
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (error) setError(null);
  };

  const isCreateDisabled = creating || name.trim().length < 2;

  return (
    <BottomSheetModal ref={ref} {...modalProps} index={0}>
      <BottomSheetView style={[styles.content, contentContainerStyle]}>
        {/* Header with Cancel/Create */}
        <View style={styles.header}>
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text
              style={[styles.cancelText, { color: theme.colors.textSecondary }]}
            >
              Cancel
            </Text>
          </Pressable>

          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Add Location
          </Text>

          <Pressable
            onPress={handleCreate}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
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
          </Pressable>
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
            defaultValue={name}
            onChangeText={handleNameChange}
            placeholder="e.g., Kitchen Cabinet, Garage Shelf"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={50}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          {!!error && (
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
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    fontSize: theme.typography.fontSize.md,
  },
  saveText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
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
    fontWeight: theme.fonts.weight.medium,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default AddStorageLocationSheet;
